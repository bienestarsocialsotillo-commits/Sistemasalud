import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import firebaseConfig from "./firebase-applet-config.json";

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email?: string; emailVerified?: boolean } | null> {
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const user = data?.users?.[0];
    if (!user || !user.localId || user.disabled) return null;
    return {
      uid: user.localId,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
    };
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security headers (compatible with iframe embedding in AI Studio)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    next();
  });

  // Middleware with high limits for base64 file payloads
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", municipality: "Juan Antonio Sotillo" });
  });

  // AI-powered Census/Form Parser (protected by Firebase ID token verification)
  app.post("/api/parse-form", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!token) {
        return res.status(401).json({ error: "No autorizado: se requiere sesión autenticada." });
      }
      const verifiedUser = await verifyFirebaseIdToken(token);
      if (!verifiedUser || !verifiedUser.emailVerified) {
        return res.status(401).json({ error: "Token de sesión inválido o correo no verificado." });
      }

      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || typeof fileBase64 !== "string") {
        return res.status(400).json({ error: "No se proporcionó ningún archivo en base64 válido" });
      }

      // Strip potential base64 data URI header
      let rawBase64 = fileBase64;
      let detectedMimeType = mimeType || "image/jpeg";

      if (fileBase64.startsWith("data:")) {
        const parts = fileBase64.split(";base64,");
        if (parts.length === 2) {
          detectedMimeType = parts[0].replace("data:", "");
          rawBase64 = parts[1];
        }
      }

      const ALLOWED_MIME_TYPES = new Set([
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf"
      ]);
      if (!ALLOWED_MIME_TYPES.has(detectedMimeType.toLowerCase())) {
        return res.status(400).json({ error: "Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "La clave de la API de Gemini (GEMINI_API_KEY) no está configurada en los secretos del servidor." 
        });
      }

      // Initialize Google GenAI client according to SKILL.md
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const filePart = {
        inlineData: {
          mimeType: detectedMimeType,
          data: rawBase64,
        }
      };

      const promptPart = {
        text: `Analiza esta fotografía, imagen o documento de censo o planilla médica de la alcaldía. 
               Extrae detalladamente todos los campos que identifiques manuscritos u originales de los bloques de datos. 
               Establece valores consistentes con lo que lees. Devuelve única y exclusivamente el JSON requerido.`
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [filePart, promptPart]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING, description: "Nombre completo del paciente" },
              dni: { type: Type.STRING, description: "Cédula de identidad (ej: V-12345678 o 12345678)" },
              birthDate: { type: Type.STRING, description: "Fecha de nacimiento en formato YYYY-MM-DD" },
              gender: { type: Type.STRING, description: "M para masculino, F para femenino" },
              civilStatus: { type: Type.STRING, description: "Estado civil del paciente, ej. Soltero, Casado, Concubinato" },
              address: { type: Type.STRING, description: "Dirección de habitación en detalle" },
              phone: { type: Type.STRING, description: "Número de teléfono celular" },
              emergencyContact: { type: Type.STRING, description: "Contacto de emergencia" },
              commune: { type: Type.STRING, description: "Nombre de la comuna" },
              sector: { type: Type.STRING, description: "Nombre del sector" },
              hasDisability: { type: Type.BOOLEAN, description: "Verdadero o Falso si posee discapacidad" },
              disabilityType: { type: Type.STRING, description: "Detalle de discapacidad si tiene" },
              pathology: { type: Type.STRING, description: "Patologías encontradas o diagnósticos" },
              personalHistory_hypertension: { type: Type.BOOLEAN, description: "Verdadero o Falso si padece Hipertensión" },
              personalHistory_diabetes: { type: Type.BOOLEAN, description: "Verdadero o Falso si padece Diabetes" },
              personalHistory_asthma: { type: Type.BOOLEAN, description: "Verdadero o Falso si padece Asma" },
              personalHistory_allergies: { type: Type.STRING, description: "Alergias médicas o generales" },
              personalHistory_surgeries: { type: Type.STRING, description: "Cirugías previas" },
              personalHistory_chronicDiseases: { type: Type.STRING, description: "Otras enfermedades crónicas" },
              personalHistory_permanentMeds: { type: Type.STRING, description: "Medicamentos de por vida consumidos" },
              personalHistory_medicationsNeeded: { type: Type.STRING, description: "Medicamentos solicitados en este operativo" },
              personalHistory_medicationFrequency: { type: Type.STRING, description: "Dosis y frecuencia sugerida para los medicamentos" },
              requiresTechnicalAid: { type: Type.BOOLEAN, description: "Verdadero si solicita andadera, silla de ruedas, etc." },
              technicalAidType: { type: Type.STRING, description: "Silla de Ruedas, Andadera, Bastón, Muletas, Cama Clínica u Otro" },
              technicalAidQuantity: { type: Type.INTEGER, description: "Cantidad solicitada" },
              technicalAidNotes: { type: Type.STRING, description: "Observaciones u observaciones de la ayuda técnica" },
              dependency: { type: Type.STRING, description: "Grado de dependencia funcional: leve, moderado, severo o ninguno" },
              housingConditions_housingType: { type: Type.STRING, description: "Casa, Rancho, Apartamento, Vecindad" },
              housingConditions_roof: { type: Type.STRING, description: "Zinc, platabanda, teja, duralit" },
              housingConditions_walls: { type: Type.STRING, description: "Madera, Bloque, Zinc, Bahareque, Adobe" },
              housingConditions_floor: { type: Type.STRING, description: "Tierra, Cemento, Cerámica, Ladrillo" },
              housingConditions_ownTerrain: { type: Type.STRING, description: "Si, No (si el terreno es propio)" },
              housingConditions_tenure: { type: Type.STRING, description: "Propia, Alquilada, Prestada, Adjudicada, Compartida" },
              housingConditions_waterSupply: { type: Type.STRING, description: "Acueducto, Cisterna" },
              housingConditions_sewage: { type: Type.STRING, description: "Cloacas, Pozo Séptico" },
              housingConditions_electricity: { type: Type.STRING, description: "Con medidor, Sin medidor" },
              housingConditions_gas: { type: Type.STRING, description: "Bombona, Gas directo" },
              familyMembers: {
                type: Type.ARRAY,
                description: "Lista de integrantes del núcleo familiar (BLOQUE IV)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fullName: { type: Type.STRING, description: "Nombres y apellidos completos" },
                    dni: { type: Type.STRING, description: "Cédula de identidad si posee" },
                    relationship: { type: Type.STRING, description: "Parentesco: HIJO, HIJA, ESPOSO, ESPOSA, MADRE, PADRE, HERMANO, HERMANA, OTRO" },
                    birthDate: { type: Type.STRING, description: "Fecha de nacimiento en formato YYYY-MM-DD" },
                    gender: { type: Type.STRING, description: "M o F" },
                    hasDisability: { type: Type.BOOLEAN, description: "Verdadero o falso si tiene discapacidad" },
                    disabilityType: { type: Type.STRING, description: "Detalle de la discapacidad si aplica" }
                  }
                }
              }
            }
          }
        }
      });

      const text = response.text || "{}";
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Error al procesar planilla con IA:", error);
      res.status(500).json({ error: error.message || "Error al procesar el archivo con Gemini" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
