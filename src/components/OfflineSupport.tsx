import React, { useState, useEffect } from "react";
const logoBienestar = "/logo_sotillo_oficial.jpg";
const logoPuertoLaCruz = "/logo_bienestar.svg";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Wifi, 
  WifiOff, 
  Upload, 
  Sparkles, 
  Database, 
  RotateCw, 
  CheckCircle, 
  User, 
  FileText, 
  Home, 
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Printer,
  FileUp,
  Check,
  Pill,
  Info
} from "lucide-react";
import { COMMUNES } from "@/constants";
import { dataService } from "@/lib/dataService";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

interface OfflineRecord {
  id: string;
  timestamp: number;
  worker: {
    fullName: string;
    dni: string;
    birthDate: string;
    gender: 'M' | 'F' | 'Other';
    civilStatus: string;
    address: string;
    phone: string;
    email: string;
    emergencyContact: string;
    commune: string;
    sector: string;
    hasDisability: boolean;
    disabilityType: string;
    socialArea: string;
    votingCenter: string;
    status: 'active';
  };
  history: {
    personalHistory: {
      hypertension: boolean;
      diabetes: boolean;
      asthma: boolean;
      allergies: string;
      surgeries: string;
      chronicDiseases: string;
      permanentMeds: string;
      medicationsNeeded: string;
      medicationFrequency: string;
    };
    familyHistory: {
      heartDisease: boolean;
      diabetes: boolean;
      hypertension: boolean;
      cancer: boolean;
      others: string;
    };
    pathology: string;
    hasDisability: boolean;
    disabilityType: string;
    requiresTechnicalAid: boolean;
    technicalAidType: string;
    technicalAidQuantity: number;
    technicalAidNotes: string;
    dependency: string;
    housingConditions: {
      housingType: string;
      ownTerrain: string;
      tenure: string;
      roof: string;
      walls: string;
      floor: string;
      floorOther: string;
      waterSupply: string;
      sewage: string;
      electricity: string;
      gas: string;
    };
  };
}

const LOCAL_STORAGE_KEY = "bienestar_sotillo_offline_records";

export default function OfflineSupport() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineRecords, setOfflineRecords] = useState<OfflineRecord[]>([]);
  const [parsing, setParsing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasParsedData, setHasParsedData] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'planilla'>('upload');
  const [highlightFields, setHighlightFields] = useState<string[]>([]);

  // Form Fields mapped from parsed IA results
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("1980-01-01");
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>("M");
  const [civilStatus, setCivilStatus] = useState("Soltero(a)");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [commune, setCommune] = useState(COMMUNES[0] || "Pozuelos");
  const [sector, setSector] = useState("");
  const [hasDisability, setHasDisability] = useState(false);
  const [disabilityType, setDisabilityType] = useState("");
  const [socialArea, setSocialArea] = useState("Salud Municipal");
  const [votingCenter, setVotingCenter] = useState("");

  // Clinical History Fields
  const [pathology, setPathology] = useState("");
  const [hypertension, setHypertension] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [asthma, setAsthma] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [chronicDiseases, setChronicDiseases] = useState("");
  const [permanentMeds, setPermanentMeds] = useState("");
  const [medicationsNeeded, setMedicationsNeeded] = useState("");
  const [medicationFrequency, setMedicationFrequency] = useState("");

  // Technical Aid Fields
  const [requiresTechnicalAid, setRequiresTechnicalAid] = useState(false);
  const [technicalAidType, setTechnicalAidType] = useState("Silla de Ruedas");
  const [technicalAidQuantity, setTechnicalAidQuantity] = useState(1);
  const [technicalAidNotes, setTechnicalAidNotes] = useState("");
  const [dependency, setDependency] = useState("none");

  // Housing Fields
  const [housingType, setHousingType] = useState("Casa");
  const [ownTerrain, setOwnTerrain] = useState("Si");
  const [tenure, setTenure] = useState("Propia");
  const [roof, setRoof] = useState("Zinc");
  const [walls, setWalls] = useState("Bloque");
  const [floor, setFloor] = useState("Cement");
  const [waterSupply, setWaterSupply] = useState("Tubería");
  const [sewage, setSewage] = useState("Cloacas");
  const [electricity, setElectricity] = useState("Público");
  const [gas, setGas] = useState("Bombona");

  // File Upload
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial load of offline records
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        setOfflineRecords(JSON.parse(stored));
      } catch (err) {
        console.error("Error reading offline storage:", err);
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const clearExtractedForm = () => {
    setFullName("");
    setDni("");
    setBirthDate("1980-01-01");
    setGender("M");
    setCivilStatus("Soltero(a)");
    setAddress("");
    setPhone("");
    setEmergencyContact("");
    setSector("");
    setHasDisability(false);
    setDisabilityType("");
    setVotingCenter("");
    setPathology("");
    setHypertension(false);
    setDiabetes(false);
    setAsthma(false);
    setAllergies("");
    setSurgeries("");
    setChronicDiseases("");
    setPermanentMeds("");
    setMedicationsNeeded("");
    setMedicationFrequency("");
    setRequiresTechnicalAid(false);
    setTechnicalAidType("Silla de Ruedas");
    setTechnicalAidQuantity(1);
    setTechnicalAidNotes("");
    setDependency("none");
    setHousingType("Casa");
    setOwnTerrain("Si");
    setTenure("Propia");
    setRoof("Zinc");
    setWalls("Bloque");
    setFloor("Cement");
    setFileBase64(null);
    setFileName("");
    setHighlightFields([]);
    setHasParsedData(false);
  };

  // Convert uploaded image or PDF file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.onerror = (error) => {
      console.error("Error al leer archivo:", error);
      toast.error("Error al leer el archivo");
    };
    reader.readAsDataURL(file);
  };

  // AI Parser Caller
  const handleParsePlanilla = async () => {
    if (!fileBase64) {
      toast.error("Por favor, cargue una imagen o PDF del censo primero");
      return;
    }

    setParsing(true);
    toast.loading("Procesando planilla con Inteligencia Artificial de Gemini...");

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        toast.dismiss();
        toast.error("Debe iniciar sesión para procesar planillas con IA.");
        setParsing(false);
        return;
      }

      const response = await fetch("/api/parse-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          fileBase64,
          mimeType: fileBase64.split(";")[0]?.replace("data:", "") || "image/jpeg"
        })
      });

      const result = await response.json();
      toast.dismiss();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Fallo en la comunicación con el modelo");
      }

      const info = result.data;
      const detectedFields: string[] = [];

      // Map parsed fields to component state with highlight
      if (info.fullName) { setFullName(info.fullName); detectedFields.push("fullName"); }
      if (info.dni) { setDni(info.dni); detectedFields.push("dni"); }
      if (info.birthDate) { setBirthDate(info.birthDate); detectedFields.push("birthDate"); }
      if (info.gender) { 
        const g = info.gender.toUpperCase();
        if (g.startsWith("F")) setGender("F");
        else if (g.startsWith("M")) setGender("M");
        detectedFields.push("gender"); 
      }
      if (info.civilStatus) { setCivilStatus(info.civilStatus); detectedFields.push("civilStatus"); }
      if (info.address) { setAddress(info.address); detectedFields.push("address"); }
      if (info.phone) { setPhone(info.phone); detectedFields.push("phone"); }
      if (info.emergencyContact) { setEmergencyContact(info.emergencyContact); detectedFields.push("emergencyContact"); }
      if (info.commune) { 
        // Match approximate commune name if in COMMUNES
        const matched = COMMUNES.find(c => c.toLowerCase().includes(info.commune.toLowerCase()) || info.commune.toLowerCase().includes(c.toLowerCase()));
        if (matched) setCommune(matched);
        detectedFields.push("commune"); 
      }
      if (info.sector) { setSector(info.sector); detectedFields.push("sector"); }
      if (info.hasDisability !== undefined) { setHasDisability(!!info.hasDisability); detectedFields.push("hasDisability"); }
      if (info.disabilityType) { setDisabilityType(info.disabilityType); detectedFields.push("disabilityType"); }
      if (info.pathology) { setPathology(info.pathology); detectedFields.push("pathology"); }

      // Personal history
      if (info.personalHistory_hypertension !== undefined) { setHypertension(!!info.personalHistory_hypertension); detectedFields.push("hypertension"); }
      if (info.personalHistory_diabetes !== undefined) { setDiabetes(!!info.personalHistory_diabetes); detectedFields.push("diabetes"); }
      if (info.personalHistory_asthma !== undefined) { setAsthma(!!info.personalHistory_asthma); detectedFields.push("asthma"); }
      if (info.personalHistory_allergies) { setAllergies(info.personalHistory_allergies); detectedFields.push("allergies"); }
      if (info.personalHistory_surgeries) { setSurgeries(info.personalHistory_surgeries); detectedFields.push("surgeries"); }
      if (info.personalHistory_chronicDiseases) { setChronicDiseases(info.personalHistory_chronicDiseases); detectedFields.push("chronicDiseases"); }
      if (info.personalHistory_permanentMeds) { setPermanentMeds(info.personalHistory_permanentMeds); detectedFields.push("permanentMeds"); }
      if (info.personalHistory_medicationsNeeded) { setMedicationsNeeded(info.personalHistory_medicationsNeeded); detectedFields.push("medicationsNeeded"); }
      if (info.personalHistory_medicationFrequency) { setMedicationFrequency(info.personalHistory_medicationFrequency); detectedFields.push("medicationFrequency"); }

      // Technical aids
      if (info.requiresTechnicalAid !== undefined) { setRequiresTechnicalAid(!!info.requiresTechnicalAid); detectedFields.push("requiresTechnicalAid"); }
      if (info.technicalAidType) { setTechnicalAidType(info.technicalAidType); detectedFields.push("technicalAidType"); }
      if (info.technicalAidQuantity) { setTechnicalAidQuantity(info.technicalAidQuantity); detectedFields.push("technicalAidQuantity"); }
      if (info.technicalAidNotes) { setTechnicalAidNotes(info.technicalAidNotes); detectedFields.push("technicalAidNotes"); }
      if (info.dependency) { setDependency(info.dependency); detectedFields.push("dependency"); }

      // Housing conditions
      if (info.housingConditions_housingType) { setHousingType(info.housingConditions_housingType); detectedFields.push("housingType"); }
      if (info.housingConditions_roof) { setRoof(info.housingConditions_roof); detectedFields.push("roof"); }
      if (info.housingConditions_walls) { setWalls(info.housingConditions_walls); detectedFields.push("walls"); }
      if (info.housingConditions_floor) { setFloor(info.housingConditions_floor); detectedFields.push("floor"); }
      if (info.housingConditions_ownTerrain) { setOwnTerrain(info.housingConditions_ownTerrain); detectedFields.push("ownTerrain"); }
      if (info.housingConditions_tenure) { setTenure(info.housingConditions_tenure); detectedFields.push("tenure"); }
      if (info.housingConditions_waterSupply) { setWaterSupply(info.housingConditions_waterSupply); detectedFields.push("waterSupply"); }
      if (info.housingConditions_sewage) { setSewage(info.housingConditions_sewage); detectedFields.push("sewage"); }
      if (info.housingConditions_electricity) { setElectricity(info.housingConditions_electricity); detectedFields.push("electricity"); }
      if (info.housingConditions_gas) { setGas(info.housingConditions_gas); detectedFields.push("gas"); }

      setHighlightFields(detectedFields);
      setHasParsedData(true);
      toast.success("¡Planilla digitalizada con éxito! Por favor revise y verifique los datos capturados abajo.");

      // Fade out highlighted fields after 6 seconds
      setTimeout(() => {
        setHighlightFields([]);
      }, 6000);

    } catch (err: any) {
      console.error("AI Reader error:", err);
      toast.error("Ocurrió un error al digitalizar el censo", {
        description: err.message || "Por favor, verifica que el archivo cargado sea legible."
      });
    } finally {
      setParsing(false);
    }
  };

  // Submit and save locally in offline queue
  const handleSaveLocal = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !dni.trim()) {
      toast.error("Nombre Completo y Cédula son obligatorios para guardar el registro.");
      return;
    }

    const newRecord: OfflineRecord = {
      id: "offline_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      worker: {
        fullName,
        dni,
        birthDate: birthDate || "1980-01-01",
        gender,
        civilStatus,
        address: address || "Sotillo",
        phone: phone || "No asignado",
        email: `${dni}@sotillo.gob.ve`,
        emergencyContact: emergencyContact || "No asignado",
        commune,
        sector: sector || "Falta especificar",
        hasDisability,
        disabilityType: hasDisability ? disabilityType : "",
        socialArea,
        votingCenter: votingCenter || "Falta especificar",
        status: "active"
      },
      history: {
        personalHistory: {
          hypertension,
          diabetes,
          asthma,
          allergies: allergies || "N/A",
          surgeries: surgeries || "N/A",
          chronicDiseases: chronicDiseases || "N/A",
          permanentMeds: permanentMeds || "N/A",
          medicationsNeeded: medicationsNeeded || "N/A",
          medicationFrequency: medicationFrequency || "N/A"
        },
        familyHistory: {
          heartDisease: false,
          diabetes: false,
          hypertension: false,
          cancer: false,
          others: "N/A"
        },
        pathology: pathology || "Evaluación General",
        hasDisability,
        disabilityType: hasDisability ? disabilityType : "",
        requiresTechnicalAid,
        technicalAidType: requiresTechnicalAid ? technicalAidType : "ninguno",
        technicalAidQuantity: requiresTechnicalAid ? Number(technicalAidQuantity) : 0,
        technicalAidNotes: requiresTechnicalAid ? (technicalAidNotes || "Desde operativo") : "",
        dependency,
        housingConditions: {
          housingType,
          ownTerrain,
          tenure,
          roof,
          walls,
          floor,
          floorOther: "",
          waterSupply,
          sewage,
          electricity,
          gas
        }
      }
    };

    const updated = [newRecord, ...offlineRecords];
    setOfflineRecords(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    toast.success("📝 Registro validado y guardado en la Cola de Sincronización Local");
    clearExtractedForm();
  };

  // Remove single record
  const handleDeleteRecord = (id: string) => {
    if (confirm("¿Desea eliminar este registro local permanentemente?")) {
      const filtered = offlineRecords.filter(r => r.id !== id);
      setOfflineRecords(filtered);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      toast.info("Registro local eliminado");
    }
  };

  // Synchronize local reports to Firebase Firestore
  const handleSyncData = async () => {
    if (!isOnline) {
      toast.error("Aún no tienes conexión a internet estable. No podemos sincronizar todavía.");
      return;
    }

    if (offlineRecords.length === 0) {
      toast.info("No tienes registros pendientes de sincronización.");
      return;
    }

    setSyncing(true);
    toast.loading("Sincronizando expedientes y recetas con los servidores centrales...");

    try {
      let successCount = 0;

      for (const rec of offlineRecords) {
        try {
          // 1. Create or find patient (Worker) sin duplicar
          const workerId = await dataService.addWorker(rec.worker, { allowReturnExisting: true });

          // 2. Save Clinical history baseline
          await dataService.saveMedicalHistory(workerId, rec.history);

          // 3. Register medicine request in Farmacia if present
          const medsNeeded = rec.history.personalHistory.medicationsNeeded;
          if (medsNeeded && medsNeeded.trim() && medsNeeded !== "N/A" && medsNeeded !== "ninguno") {
            try {
              await dataService.addMedicationRecipe({
                workerId,
                medication: medsNeeded.trim(),
                presentation: "Caja/Frasco",
                dosage: "Continuo",
                frequency: rec.history.personalHistory.medicationFrequency || "Según Indicación",
                duration: "Permanente",
                quantity: 1,
                commune: rec.worker.commune || "Sotillo",
                requiresTechnicalAid: false,
                status: 'pending',
              });
            } catch (recipeErr) {
              console.error("Error auto-adding medication from offline sync:", recipeErr);
            }
          }

          // 4. Register technical aid request in Farmacia if required
          if (rec.history.requiresTechnicalAid && rec.history.technicalAidType && rec.history.technicalAidType !== 'ninguno') {
            try {
              await dataService.addMedicationRecipe({
                workerId,
                medication: rec.history.technicalAidType,
                presentation: "Unidad",
                dosage: "N/A",
                frequency: "Único",
                duration: "N/A",
                quantity: rec.history.technicalAidQuantity || 1,
                commune: rec.worker.commune || "Sotillo",
                requiresTechnicalAid: true,
                technicalAidType: rec.history.technicalAidType,
                technicalAidQuantity: rec.history.technicalAidQuantity || 1,
                technicalAidNotes: rec.history.technicalAidNotes || "Desde Operativo Remoto",
                status: 'pending',
              });
            } catch (recipeErr) {
              console.error("Error auto-adding technical aid from offline sync:", recipeErr);
            }
          }
          
          successCount++;
        } catch (individualErr) {
          console.error("Error syncing record for DNI:", rec.worker.dni, individualErr);
        }
      }

      if (successCount === offlineRecords.length) {
        toast.dismiss();
        toast.success(`🎉 ¡Felicidades! Sincronizados y consolidados con éxito ${successCount} registros.`);
        setOfflineRecords([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } else {
        toast.dismiss();
        const pending = offlineRecords.length - successCount;
        toast.warning(`Sincronizados ${successCount} registros. ${pending} fallaron y permanecen en cola.`);
        
        const failedRecords = offlineRecords.slice(successCount);
        setOfflineRecords(failedRecords);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(failedRecords));
      }

    } catch (error) {
      console.error("Fallo general de sincronización:", error);
      toast.dismiss();
      toast.error("Ocurrió un error general de red durante la sincronización");
    } finally {
      setSyncing(false);
    }
  };

  const getHighlightClass = (fieldname: string) => {
    return highlightFields.includes(fieldname) 
      ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-400/50 transition-all duration-700 animate-pulse"
      : "transition-all duration-350";
  };

  const handlePrint = () => {
    window.print();
  };

  // Unified Printable official form component (blank sheet for field workers)
  const renderOfficialBlankForm = (isForScreenHtml = false) => {
    return (
      <div 
        className={`font-sans bg-white text-black border-2 border-black max-w-[760px] mx-auto text-xs selection:bg-transparent ${
          isForScreenHtml ? 'p-6 shadow-xl relative' : 'p-4'
        }`}
        style={{ boxSizing: 'border-box' }}
      >
        {/* Registration crop marks for machine digestion */}
        <div className="absolute top-2 left-2 text-[10px] font-mono font-bold text-slate-400 select-none">[+] ALIGN_TL</div>
        <div className="absolute top-2 right-2 text-[10px] font-mono font-bold text-slate-400 select-none">ALIGN_TR [+]</div>
        <div className="absolute bottom-2 left-2 text-[10px] font-mono font-bold text-slate-400 select-none">[+] ALIGN_BL</div>
        <div className="absolute bottom-2 right-2 text-[10px] font-mono font-bold text-slate-400 select-none">ALIGN_BR [+]</div>

        {/* Form Head */}
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mt-1">
          <div className="flex gap-3 items-center">
            <img 
              src={logoPuertoLaCruz} 
              alt="Alcaldía Puerto La Cruz" 
              className="w-16 h-16 object-contain" 
              referrerPolicy="no-referrer"
            />
            <div className="font-extrabold uppercase text-[8px] tracking-tight leading-tight space-y-0.5">
              <p className="text-slate-900">ALCALDÍA MUNICIPIO JUAN ANTONIO SOTILLO</p>
              <p className="text-blue-950 border-t border-slate-300 mt-0.5 pt-0.5 font-black text-[9px]">DIRECCIÓN DE BIENESTAR SOCIAL</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <img 
              src={logoBienestar} 
              alt="Bienestar Social" 
              className="w-16 h-16 object-contain" 
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col items-center justify-between border border-black p-1 font-black uppercase text-[7px] tracking-tight bg-slate-50 min-w-[100px] h-14 rounded text-center">
              <span className="text-[5.5px] text-slate-500 font-bold block">FICHA DE DIGITALIZACIÓN</span>
              <span className="text-[10px] text-blue-900 font-extrabold font-mono tracking-wider">SOT-M-2026</span>
              <span className="text-[5.5px] text-slate-400 font-mono">ID: AI-OCR-ENABLE</span>
            </div>
          </div>
        </div>

        {/* Form Title */}
        <div className="text-center py-2 bg-slate-50 border-b border-black">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">DIRECCIÓN DE BIENESTAR SOCIAL</h2>
          <p className="text-[8px] text-slate-600 font-bold mt-0.5 uppercase tracking-wide">
            ✓ RELLENAR EN LETRA COMPLETAMENTE MAYÚSCULA CON BOLÍGRAFO NEGRO O AZUL OSCURO • NO DOBLAR LA PLANILLA
          </p>
        </div>

        {/* Block I: Información Personal */}
        <div className="mt-3 space-y-1.5">
          <h3 className="bg-black text-white font-black text-[9px] uppercase tracking-widest px-2 py-0.5 flex justify-between">
            <span>BLOQUE I: COORDENADAS PERSONALES DEL CIUDADANO</span>
            <span className="font-mono text-[7px] text-slate-300">CODE: SEC_01</span>
          </h3>
          
          <div className="grid grid-cols-12 gap-3 border-b border-slate-300 pb-2">
            <div className="col-span-8">
              <span className="text-[7.5px] font-black uppercase text-slate-500">1. NOMBRES Y APELLIDOS COMPLETOS (EN MAYÚSCULAS):</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
            <div className="col-span-4">
              <span className="text-[7.5px] font-black uppercase text-slate-500">2. CÉDULA DE IDENTIDAD (V/E):</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5 font-mono text-slate-400 flex items-center pt-1.5">
                <span className="mr-3 font-bold select-none">[v] [e]</span>
                <span>___.___.___</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 border-b border-slate-300 pb-2">
            <div className="col-span-3">
              <span className="text-[7.5px] font-black uppercase text-slate-500">3. FECHA DE NACIMIENTO:</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5 font-mono text-slate-400 flex items-center pt-1.5 justify-around">
                <span>DÍA / MES / AÑO: __ / __ / ____</span>
              </div>
            </div>
            <div className="col-span-4">
              <span className="text-[7.5px] font-black uppercase text-slate-500">4. GÉNERO:</span>
              <div className="flex gap-4 mt-2 text-[8px] font-black uppercase">
                <span className="flex items-center gap-1 cursor-pointer select-none">
                  <span className="inline-block w-3 h-3 border border-black rounded-sm mr-1"></span> [ M ] MASCULINO
                </span>
                <span className="flex items-center gap-1 cursor-pointer select-none">
                  <span className="inline-block w-3 h-3 border border-black rounded-sm mr-1"></span> [ F ] FEMENINO
                </span>
              </div>
            </div>
            <div className="col-span-5">
              <span className="text-[7.5px] font-black uppercase text-slate-500">5. ESTADO CIVIL:</span>
              <div className="flex gap-2 mt-2 text-[7.5px] font-black uppercase flex-wrap">
                <span className="flex items-center gap-0.5"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-0.5"></span> SOLTERO(A)</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-0.5"></span> CASADO(A)</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-0.5"></span> CONCUBINATO</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 border-b border-slate-300 pb-2">
            <div className="col-span-4">
              <span className="text-[7.5px] font-black uppercase text-slate-500">6. COMUNA HABITACIONAL SOTILLO:</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
            <div className="col-span-4">
              <span className="text-[7.5px] font-black uppercase text-slate-500">7. SECTOR / BARRIO / COMUNIDAD:</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
            <div className="col-span-4">
              <span className="text-[7.5px] font-black uppercase text-slate-500">8. TELÉFONO DE CONTACTO MÓVIL:</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5 font-mono text-slate-400 flex items-center pt-1.5">
                <span>0 4 __ __ - __ __ __ __ __ __ __</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 border-b border-slate-300 pb-2">
            <div className="col-span-7">
              <span className="text-[7.5px] font-black uppercase text-slate-500">9. DIRECCIÓN EXACTA DE HABITACIÓN:</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
            <div className="col-span-5">
              <span className="text-[7.5px] font-black uppercase text-slate-500">10. FAMILIAR DE CONTACTO (EMERGENCIA) Y NRO:</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 pb-0.5">
            <div className="col-span-7">
              <span className="text-[7.5px] font-black uppercase text-slate-500">11. ¿SUFRE DE DISCAPACIDAD?:</span>
              <div className="flex gap-4 mt-1.5 text-[8px] font-black uppercase items-center">
                <span className="flex items-center"><span className="inline-block w-3 h-3 border border-black rounded-sm mr-1"></span> [ ] SÍ</span>
                <span className="flex items-center"><span className="inline-block w-3 h-3 border border-black rounded-sm mr-1"></span> [ ] NO</span>
                <span className="text-[7.5px] font-bold text-slate-600 ml-1">ESPECIFIQUE: ________________________</span>
              </div>
            </div>
            <div className="col-span-5">
              <span className="text-[7.5px] font-black uppercase text-slate-500">12. CENTRO ELECTORAL DE VOTACIÓN (MUNICIPIO):</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
          </div>
        </div>

        {/* Block II: Antecedentes Clínicos */}
        <div className="mt-3 space-y-1.5">
          <h3 className="bg-black text-white font-black text-[9px] uppercase tracking-widest px-2 py-0.5 flex justify-between">
            <span>BLOQUE II: ANTECEDENTES DE SALUD Y REQUERIMIENTO CLÍNICO</span>
            <span className="font-mono text-[7px] text-slate-300">CODE: SEC_02</span>
          </h3>

          <div className="border-b border-slate-300 pb-2">
            <span className="text-[7.5px] font-black uppercase text-slate-500 flex justify-between">
              <span>1. MARQUE SI PADECE ALGUNA DE ESTAS PATOLOGÍAS CRÓNICAS:</span>
              <span className="text-slate-400 font-mono text-[7px] font-medium leading-none">MARCAR CON UNA [X]</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5 mt-2 text-[8px] font-black uppercase">
              <span className="flex items-center"><span className="inline-block w-3 h-3 border border-black rounded-sm mr-1.5"></span> [ ] HIPERTENSIÓN ARTERIAL (HTA)</span>
              <span className="flex items-center"><span className="inline-block w-3 h-3 border border-black rounded-sm mr-1.5"></span> [ ] DIABETES MELLITUS TYPE 1/2</span>
              <span className="flex items-center"><span className="inline-block w-3 h-3 border border-black rounded-sm mr-1.5"></span> [ ] ASMA BRONQUIAL / EPOC</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 border-b border-slate-300 pb-2">
            <div className="col-span-6">
              <span className="text-[7.5px] font-black uppercase text-slate-500">2. ALERGIAS CONOCIDAS (MEDICAMENTOS/ALIMENTOS):</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
            <div className="col-span-6">
              <span className="text-[7.5px] font-black uppercase text-slate-500">3. MEDICACIÓN DE CONSUMO PERMANENTE ACTUAL:</span>
              <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
            </div>
          </div>

          <div className="border-b border-slate-300 pb-2">
            <span className="text-[7.5px] font-black uppercase text-slate-500">4. EVALUACIÓN DIAGNÓSTICA / MOTIVO DE CONSULTA OPERATIVO:</span>
            <div className="border-b border-dashed border-slate-600 h-6 mt-0.5"></div>
          </div>

          <div className="border border-black p-2 bg-slate-50 rounded">
            <p className="text-[8px] font-black uppercase text-blue-900 border-b border-slate-300 pb-1 flex justify-between items-center">
              <span>A) FORMULACIÓN DE REQUISICIÓN DE MEDICAMENTOS (FARMACIA INTEGRAL)</span>
              <span className="text-[6.5px] text-slate-400 font-bold font-mono">REG_FARMA_01</span>
            </p>
            <div className="grid grid-cols-12 gap-3 pt-1.5">
              <div className="col-span-6">
                <span className="text-[7px] font-black uppercase text-slate-500">MEDICAMENTO SOLICITADO (NOMBRE Y MG):</span>
                <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
              </div>
              <div className="col-span-4">
                <span className="text-[7px] font-black uppercase text-slate-500">DOSIFICACIÓN ( FRECUENCIA / DIARIO ):</span>
                <div className="border-b border-dashed border-slate-600 h-5 mt-0.5"></div>
              </div>
              <div className="col-span-2">
                <span className="text-[7px] font-black uppercase text-slate-500">CANT. PEDIDA:</span>
                <div className="border-b border-dashed border-slate-600 h-5 mt-0.5 font-mono text-center">___</div>
              </div>
            </div>
          </div>

          <div className="border border-black p-2 bg-slate-50 rounded mt-2">
            <div className="flex justify-between items-center border-b border-slate-300 pb-1">
              <span className="text-[8px] font-black uppercase text-blue-900">B) REQUERIMIENTO DE AYUDA HUMANA DE MOVILIDAD SOCIAL</span>
              <span className="text-[6.5px] text-slate-400 font-bold font-mono">REG_SOCIAL_02</span>
            </div>
            <div className="grid grid-cols-12 gap-2 mt-1.5 text-[7.5px] font-black uppercase items-center flex-wrap">
              <span className="col-span-3 flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> SILLA RUEDAS</span>
              <span className="col-span-2 flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> ANDADERA</span>
              <span className="col-span-2 flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> BASTÓN / MULET</span>
              <span className="col-span-2 flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CAMA CLÍNICA</span>
              <span className="col-span-3 text-[7px] text-slate-600">CANT: _____ / OBS: ___________________</span>
            </div>
          </div>
        </div>

        {/* Block III: Caracterización de Vivienda */}
        <div className="mt-3 space-y-1.5 font-sans">
          <h3 className="bg-black text-white font-black text-[9px] uppercase tracking-widest px-2 py-0.5 flex justify-between">
            <span>BLOQUE III: CARACTERIZACIÓN PLAN DE VIVIENDA Y SEGURIDAD SOCIAL</span>
            <span className="font-mono text-[7px] text-slate-300">CODE: SEC_03</span>
          </h3>

          <div className="grid grid-cols-3 gap-2.5 text-[7.5px] font-black uppercase">
            <div className="border-r border-slate-200 pr-1.5">
              <span className="text-[7px] font-black uppercase text-slate-500 block mb-1">1. TIPO DE VIVIENDA:</span>
              <div className="space-y-1">
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CASA CONCRETO</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> RANCHO IMPROVISADO</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> APARTAMENTO / ANEXO</p>
              </div>
            </div>

            <div className="border-r border-slate-200 pr-1.5">
              <span className="text-[7px] font-black uppercase text-slate-500 block mb-1">2. MATERIAL DE PAREDES:</span>
              <div className="space-y-1">
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> BLOQUE FRISADO</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> MADERA / TABLAS</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CHAPA DE ZINC / S/C</p>
              </div>
            </div>

            <div>
              <span className="text-[7px] font-black uppercase text-slate-500 block mb-1">3. MATERIAL DE TECHOS:</span>
              <div className="space-y-1">
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> ZINC / ACEROLIT</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> PLATABANDA DE CONCRETO</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> TEJAS DE ARCILLA / ASBESTO</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-[7.5px] font-black uppercase border-t border-slate-200 pt-2 pb-2">
            <div className="border-r border-slate-200 pr-1.5">
              <span className="text-[7px] font-black uppercase text-slate-500 block mb-1">4. MATERIAL DE PISO:</span>
              <div className="space-y-1">
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CEMENTO PULIDO/LISO</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> TIERRA REVESTIDA</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CERÁMICA / BALDOSA</p>
              </div>
            </div>

            <div className="border-r border-slate-200 pr-1.5">
              <span className="text-[7px] font-black uppercase text-slate-500 block mb-1">5. TERRENO PROPIO:</span>
              <div className="space-y-1.5 pt-0.5">
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> SÍ ES PROPIO</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> NO ES PROPIO (EJIDO)</p>
              </div>
            </div>

            <div>
              <span className="text-[7px] font-black uppercase text-slate-500 block mb-1">6. TENENCIA DE VIVIENDA:</span>
              <div className="space-y-1">
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> PROPIA TOTAL</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> ALQUILADA</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> PRESTADA / ADJUDICADA</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2 pb-1.5">
            <span className="text-[7px] font-black uppercase text-slate-500 block mb-1">7. SERVICIOS BÁSICOS DOMÉSTICOS:</span>
            <div className="grid grid-cols-4 gap-2 text-[7px] font-black uppercase">
              <div>
                <p className="text-slate-400 text-[6.5px] font-bold mb-0.5">AGUA:</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> ACUEDUCTO</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CISTERNA</p>
              </div>
              <div>
                <p className="text-slate-400 text-[6.5px] font-bold mb-0.5">EXCRETAS:</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CLOACAS</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> POZO SÉPTICO</p>
              </div>
              <div>
                <p className="text-slate-400 text-[6.5px] font-bold mb-0.5">ELECTRICIDAD:</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> CON MEDIDOR</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> SIN MEDIDOR</p>
              </div>
              <div>
                <p className="text-slate-400 text-[6.5px] font-bold mb-0.5">GAS DOMÉSTICO:</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> BOMBONA</p>
                <p className="flex items-center"><span className="inline-block w-2.5 h-2.5 border border-black rounded-sm mr-1"></span> GAS DIRECTO</p>
              </div>
            </div>
          </div>
        </div>

        {/* Block IV: Integrantes del Núcleo Familiar */}
        <div className="mt-3 space-y-1.5 font-sans">
          <h3 className="bg-black text-white font-black text-[9px] uppercase tracking-widest px-2 py-0.5 flex justify-between">
            <span>BLOQUE IV: INTEGRANTES DEL NÚCLEO FAMILIAR (CARGA FAMILIAR)</span>
            <span className="font-mono text-[7px] text-slate-300">CODE: SEC_04</span>
          </h3>
          <table className="w-full border-collapse border border-black text-[7.5px] text-left">
            <thead>
              <tr className="bg-slate-100 uppercase font-black text-center text-[7px]">
                <th className="border border-black px-1.5 py-1 w-[35%]">Nombres y Apellidos</th>
                <th className="border border-black px-1.5 py-1 w-[15%]">Cédula (V/E) (Opcional)</th>
                <th className="border border-black px-1.5 py-1 w-[15%]">Parentesco</th>
                <th className="border border-black px-1.5 py-1 w-[13%]">F. Nacimiento</th>
                <th className="border border-black px-1.5 py-1 w-[10%]">Género (M/F)</th>
                <th className="border border-black px-1.5 py-1 w-[12%]">Discapacidad?</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="h-6">
                  <td className="border border-black px-1.5"></td>
                  <td className="border border-black px-1.5 text-center font-mono text-slate-400">__.___.___</td>
                  <td className="border border-black px-1.5 text-slate-400 text-[6.5px]">Ej. HIJO(A)</td>
                  <td className="border border-black px-1.5 text-center font-mono text-slate-400">__/__/____</td>
                  <td className="border border-black px-1.5 text-center font-mono text-slate-400">[ ] M  [ ] F</td>
                  <td className="border border-black px-1.5 text-center text-slate-400 text-[6.5px]">[ ] SÍ  [ ] NO</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification Footer barcode design */}
        <div className="mt-3.5 pt-2 border-t border-slate-300 flex justify-between items-center font-mono text-[7px] text-slate-400 select-none">
          <span>ALCALDÍA MUNICIPAL DE SOTILLO • TECNOLOGÍA EN CENSO OFF-LINE</span>
          <div className="flex gap-0.5 items-center">
            <div className="h-3 w-[1px] bg-slate-300"></div>
            <div className="h-3 w-[2px] bg-slate-300"></div>
            <div className="h-3 w-[1px] bg-slate-300"></div>
            <div className="h-3 w-[3px] bg-slate-300"></div>
            <span className="ml-1 font-bold">CENSO-OCR-CODE-2026</span>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <style>{`
        @media print {
          html, body {
            background-color: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: letter portrait;
            margin: 4mm 6mm;
          }
          /* Hide everything in normal interface */
          body * {
            visibility: hidden;
            background: white !important;
          }
          /* Only display the specific printable element */
          #printable-sotillo-form, #printable-sotillo-form * {
            visibility: visible;
          }
          #printable-sotillo-form {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
            color: black !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* header block - Hidden when printing */}
      <div className="space-y-2 no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-3xl font-black text-blue-950 tracking-tight uppercase flex items-center gap-2">
              <WifiOff className="w-8 h-8 text-amber-500 animate-pulse" />
              Formulario Offline
            </h2>
            <p className="text-slate-550 font-medium font-sans max-w-3xl leading-snug text-sm">
              Optimice los censos físicos del Municipio Sotillo. Imprima la <strong>Planilla de Campo Oficial</strong>, 
              llénela a mano durante el operativo y luego cargue una fotografía o escaneado para que el modelo Gemini extraiga 
              y unifique los expedientes de manera automatizada.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {isOnline ? (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-250 text-emerald-800 font-bold text-[11px] uppercase tracking-wider">
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Interconectado</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-250 text-amber-800 font-bold text-[11px] uppercase tracking-wider">
                <WifiOff className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                <span>Modo Remoto</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs navigation - Hidden when printing */}
      <div className="flex gap-2 border-b border-slate-200 pb-px no-print">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-5 py-2.5 font-black text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'upload'
              ? 'border-blue-900 text-blue-900 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileUp className="w-4 h-4" />
          Procesar y Recargar Ficha
        </button>
        <button
          onClick={() => setActiveTab('planilla')}
          className={`px-5 py-2.5 font-black text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'planilla'
              ? 'border-blue-900 text-blue-900 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Printer className="w-4 h-4" />
          Planilla Oficial de Censo (Modelo PDF)
        </button>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start no-print">
        
        {/* Left main area */}
        <div className="xl:col-span-2 space-y-6">

          {activeTab === 'upload' ? (
            <>
              {/* Card for photo / file upload */}
              <Card className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-2xl border-none shadow-xl relative overflow-hidden">
                <CardContent className="p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 z-10">
                      <Badge className="bg-amber-500 text-amber-950 font-black text-[10px] uppercase px-3 py-0.5 mb-2 rounded">
                        LECTOR DE CENSOS INTELIGENTE
                      </Badge>
                      <h3 className="text-xl font-black uppercase tracking-tight">Sube la Planilla Escaneada o Fotografía</h3>
                      <p className="text-xs text-blue-150 max-w-xl font-medium leading-normal">
                        Cargue la imagen (PNG, JPG, JPEG) o archivo PDF de la Planilla de Censo de campo completada. 
                        El motor de Gemini analizará la caligrafía humana, procesará los bloques de datos y auto-rellenará el registro.
                      </p>
                    </div>
                    <div className="shrink-0 z-10 flex flex-col items-center">
                      <Sparkles className="w-12 h-12 text-amber-400 animate-pulse" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* File Picker target */}
                    <div className="border border-dashed border-blue-400/50 hover:border-blue-300 bg-blue-950/45 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                      <Input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        id="form-ocr-uploader"
                      />
                      <Upload className="w-10 h-10 text-blue-350 mb-3 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-105">
                        {fileName ? fileName : "Buscar o arrastrar archivo aquí"}
                      </p>
                      <p className="text-[10px] text-blue-300 mt-1">Fotografía del censo manuscrito o PDF</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        onClick={handleParsePlanilla}
                        disabled={parsing || !fileBase64}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-6 px-4 rounded-xl flex items-center justify-center gap-2 tracking-wider text-xs uppercase shadow-md disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed uppercase"
                      >
                        {parsing ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin text-slate-950" />
                            Digitalizando con Gemini...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-slate-950 animate-bounce" />
                            Analizar Planilla con IA 🪄
                          </>
                        )}
                      </Button>
                      {fileBase64 && (
                        <Button
                          variant="ghost"
                          onClick={() => { setFileBase64(null); setFileName(""); }}
                          className="text-slate-350 hover:bg-white/10 hover:text-white text-[10px] font-bold uppercase tracking-wider h-8"
                        >
                          Limpiar Archivo
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Parsed Result Form Frame */}
              {hasParsedData ? (
                <form onSubmit={handleSaveLocal}>
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom duration-350">
                    <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            Resultados Extraídos por Inteligencia Artificial
                          </CardTitle>
                          <CardDescription className="text-[10px] uppercase font-bold text-emerald-700 mt-1">
                            Valores leídos del papel. Modifique cualquier anomalía antes de guardar en la cola.
                          </CardDescription>
                        </div>
                        <Badge className="bg-emerald-600 text-white font-black text-[10px] uppercase px-3 py-1">ÉXITO OCR</Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-6 space-y-8">
                      {/* Section 1: Personal Data */}
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-blue-600" />
                          1. Información Personal del Paciente
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Nombre Completo *</Label>
                            <Input 
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="Falta Nombre"
                              className={`h-10 ${getHighlightClass("fullName")} font-bold text-slate-800 bg-white`}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Cédula de Identidad *</Label>
                            <Input 
                              value={dni}
                              onChange={(e) => setDni(e.target.value)}
                              placeholder="Falta Cédula"
                              className={`h-10 ${getHighlightClass("dni")} font-black text-slate-800 bg-white`}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Fecha Nacimiento</Label>
                              <button
                                type="button"
                                onClick={() => setBirthDate(prev => prev === "SIN FECHA" ? "" : "SIN FECHA")}
                                className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                  birthDate === "SIN FECHA"
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800 border-slate-200'
                                }`}
                                title="Marcar si el ciudadano no posee fecha de nacimiento"
                              >
                                {birthDate === "SIN FECHA" ? "✓ Sin Fecha" : "🚫 Sin Fecha"}
                              </button>
                            </div>
                            {birthDate === "SIN FECHA" ? (
                              <Input 
                                value="SIN FECHA REGISTRADA"
                                readOnly
                                className="h-10 bg-amber-50/70 border-amber-300 text-amber-900 font-bold text-xs cursor-default select-none"
                              />
                            ) : (
                              <Input 
                                type="date"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                                className={`h-10 ${getHighlightClass("birthDate")} bg-white`}
                              />
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Género</Label>
                            <Select value={gender} onValueChange={(val: any) => setGender(val)}>
                              <SelectTrigger className={`h-10 ${getHighlightClass("gender")} bg-white`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="M">Masculino (M)</SelectItem>
                                <SelectItem value="F">Femenino (F)</SelectItem>
                                <SelectItem value="Other">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Estado Civil</Label>
                            <Input 
                              value={civilStatus}
                              onChange={(e) => setCivilStatus(e.target.value)}
                              className={`h-10 ${getHighlightClass("civilStatus")} bg-white`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Teléfono Celular</Label>
                              <button
                                type="button"
                                onClick={() => setPhone(phone === "NO POSEE" ? "" : "NO POSEE")}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border transition-all ${
                                  phone === "NO POSEE"
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800 border-slate-200'
                                }`}
                              >
                                {phone === "NO POSEE" ? "✓ Sin Número" : "🚫 Sin Número"}
                              </button>
                            </div>
                            <Input 
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="Teléfono (o clic en 'Sin Número')"
                              className={`h-10 ${getHighlightClass("phone")} ${phone === 'NO POSEE' ? 'bg-amber-50/50 border-amber-200 text-amber-900 font-bold' : 'bg-white'}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Comuna</Label>
                            <Select value={commune} onValueChange={setCommune}>
                              <SelectTrigger className={`h-10 ${getHighlightClass("commune")} bg-white`}>
                                <SelectValue placeholder="Seleccionar Comuna" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                {COMMUNES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Sector / Vecindario</Label>
                            <Input 
                              value={sector}
                              onChange={(e) => setSector(e.target.value)}
                              placeholder="Sector"
                              className={`h-10 ${getHighlightClass("sector")} bg-white`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Contacto de Emergencia</Label>
                              <button
                                type="button"
                                onClick={() => setEmergencyContact(emergencyContact === "NO POSEE" ? "" : "NO POSEE")}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border transition-all ${
                                  emergencyContact === "NO POSEE"
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800 border-slate-200'
                                }`}
                              >
                                {emergencyContact === "NO POSEE" ? "✓ Sin Contacto" : "🚫 Sin Contacto"}
                              </button>
                            </div>
                            <Input 
                              value={emergencyContact}
                              onChange={(e) => setEmergencyContact(e.target.value)}
                              placeholder="Contacto de emergencia (opcional)"
                              className={`h-10 ${getHighlightClass("emergencyContact")} ${emergencyContact === 'NO POSEE' ? 'bg-amber-50/50 border-amber-200 text-amber-900 font-bold' : 'bg-white'}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Dirección de Habitación Detallada</Label>
                            <Input 
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              className={`h-10 ${getHighlightClass("address")} bg-white`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Centro Electoral / Votación</Label>
                            <Input 
                              value={votingCenter}
                              onChange={(e) => setVotingCenter(e.target.value)}
                              className={`h-10 ${getHighlightClass("votingCenter")} bg-white`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                          <div className="flex items-center space-x-3 pt-4">
                            <input 
                              type="checkbox" 
                              id="parsed-has-disability"
                              checked={hasDisability}
                              onChange={(e) => setHasDisability(e.target.checked)}
                              className="h-4.5 w-4.5 rounded text-blue-900 border-slate-300 focus:ring-blue-900 cursor-pointer accent-blue-900"
                            />
                            <label htmlFor="parsed-has-disability" className="text-xs font-black uppercase tracking-wider text-slate-700 cursor-pointer">
                              Posee alguna Discapacidad
                            </label>
                          </div>
                          {hasDisability && (
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Especifique Discapacidad</Label>
                              <Input 
                                value={disabilityType}
                                onChange={(e) => setDisabilityType(e.target.value)}
                                className={`h-10 ${getHighlightClass("disabilityType")} bg-white`}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 2: Clinical Data */}
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          2. Diagnóstico y Requerimientos de Insumos
                        </h4>

                        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <label className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={hypertension} 
                              onChange={(e) => setHypertension(e.target.checked)}
                              className="h-4 w-4 accent-red-600"
                            />
                            <span>Hipertensión</span>
                          </label>
                          <label className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={diabetes} 
                              onChange={(e) => setDiabetes(e.target.checked)}
                              className="h-4 w-4 accent-amber-600"
                            />
                            <span>Diabetes</span>
                          </label>
                          <label className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={asthma} 
                              onChange={(e) => setAsthma(e.target.checked)}
                              className="h-4 w-4 accent-sky-600"
                            />
                            <span>Asma</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Alergias Detectadas</Label>
                            <Input 
                              value={allergies}
                              onChange={(e) => setAllergies(e.target.value)}
                              className={`h-10 ${getHighlightClass("allergies")} bg-white`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Otras Patologías / Diagnósticos</Label>
                            <Input 
                              value={chronicDiseases}
                              onChange={(e) => setChronicDiseases(e.target.value)}
                              className={`h-10 ${getHighlightClass("chronicDiseases")} bg-white`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Medicamentos Permanentes</Label>
                            <Input 
                              value={permanentMeds}
                              onChange={(e) => setPermanentMeds(e.target.value)}
                              className={`h-10 ${getHighlightClass("permanentMeds")} bg-white`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Evaluación / Síntomas de Consulta</Label>
                            <Input 
                              value={pathology}
                              onChange={(e) => setPathology(e.target.value)}
                              className={`h-10 ${getHighlightClass("pathology")} bg-white`}
                            />
                          </div>
                        </div>

                        {/* Prescription requests */}
                        <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-205 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase tracking-wider text-blue-900 font-bold">Insumo / Fármaco Solicitado</Label>
                              <Input 
                                value={medicationsNeeded}
                                onChange={(e) => setMedicationsNeeded(e.target.value)}
                                placeholder="Ej: Atorvastatina 20mg"
                                className={`h-10 ${getHighlightClass("medicationsNeeded")} bg-white border-blue-200`}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase tracking-wider text-blue-900 font-bold">Frecuencia / Dosis</Label>
                              <Input 
                                value={medicationFrequency}
                                onChange={(e) => setMedicationFrequency(e.target.value)}
                                placeholder="Ej: 1 al día de noche"
                                className={`h-10 ${getHighlightClass("medicationFrequency")} bg-white border-blue-200`}
                              />
                            </div>
                          </div>

                          <div className="space-y-3 pt-2">
                            <div className="flex items-center space-x-3">
                              <input 
                                type="checkbox" 
                                id="parsed-requires-tech-aid"
                                checked={requiresTechnicalAid}
                                onChange={(e) => setRequiresTechnicalAid(e.target.checked)}
                                className="h-4.5 w-4.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                              />
                              <label htmlFor="parsed-requires-tech-aid" className="text-xs font-black uppercase tracking-wider text-emerald-900 cursor-pointer">
                                Requiere de Ayuda Humana (Discapacidad / Movilidad)
                              </label>
                            </div>

                            {requiresTechnicalAid && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2.5 animate-in fade-in duration-200">
                                <div className="space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-sans">Tipo Requerido</Label>
                                  <Select value={technicalAidType} onValueChange={setTechnicalAidType}>
                                    <SelectTrigger className={`h-10 bg-white ${getHighlightClass("technicalAidType")}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Silla de Ruedas">Silla de Ruedas</SelectItem>
                                      <SelectItem value="Andadera">Andadera</SelectItem>
                                      <SelectItem value="Bastón">Bastón</SelectItem>
                                      <SelectItem value="Muletas">Muletas</SelectItem>
                                      <SelectItem value="Cama Clínica">Cama Clínica</SelectItem>
                                      <SelectItem value="Otro">Otro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Cantidad</Label>
                                  <Input 
                                    type="number"
                                    value={technicalAidQuantity}
                                    onChange={(e) => setTechnicalAidQuantity(Number(e.target.value))}
                                    className={`h-10 bg-white ${getHighlightClass("technicalAidQuantity")}`}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Notas de Entrega</Label>
                                  <Input 
                                    value={technicalAidNotes}
                                    onChange={(e) => setTechnicalAidNotes(e.target.value)}
                                    className={`h-10 bg-white ${getHighlightClass("technicalAidNotes")}`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Housing layout */}
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          <Home className="w-4 h-4 text-blue-600" />
                          3. Condiciones de la Vivienda y Caracterización Social
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Tipo de Inmueble</Label>
                            <Select value={housingType} onValueChange={setHousingType}>
                              <SelectTrigger className={`h-10 bg-white ${getHighlightClass("housingType")}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Casa">Casa</SelectItem>
                                <SelectItem value="Rancho">Rancho</SelectItem>
                                <SelectItem value="Apartamento">Apartamento</SelectItem>
                                <SelectItem value="Vecindad">Vecindad / Anexo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Material Paredes</Label>
                            <Select value={walls} onValueChange={setWalls}>
                              <SelectTrigger className={`h-10 bg-white ${getHighlightClass("walls")}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Bloque">Bloque / Friso</SelectItem>
                                <SelectItem value="Madera">Madera / Tablas</SelectItem>
                                <SelectItem value="Zinc">Láminas de Zinc</SelectItem>
                                <SelectItem value="Bahareque">Bahareque / Barro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Material Techo</Label>
                            <Select value={roof} onValueChange={setRoof}>
                              <SelectTrigger className={`h-10 bg-white ${getHighlightClass("roof")}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Zinc">Zinc / Acerolit</SelectItem>
                                <SelectItem value="Platabanda">Platabanda de Concreto</SelectItem>
                                <SelectItem value="Tejas">Tejas de Arcilla</SelectItem>
                                <SelectItem value="Asbesto">Asbesto / Fibrocemento</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Material Piso</Label>
                            <Select value={floor} onValueChange={setFloor}>
                              <SelectTrigger className={`h-10 bg-white ${getHighlightClass("floor")}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Cement">Cemento</SelectItem>
                                <SelectItem value="Tierra">Tierra</SelectItem>
                                <SelectItem value="Cerámica">Cerámica / Baldosa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Terreno Propio</Label>
                            <Select value={ownTerrain} onValueChange={setOwnTerrain}>
                              <SelectTrigger className={`h-10 bg-white ${getHighlightClass("ownTerrain")}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Si">Sí es Terreno Propio</SelectItem>
                                <SelectItem value="No">No es Propio / Ejidos</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Estatus Tenencia</Label>
                            <Select value={tenure} onValueChange={setTenure}>
                              <SelectTrigger className={`h-10 bg-white ${getHighlightClass("tenure")}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Propia">Vivienda Propia</SelectItem>
                                <SelectItem value="Alquilada">Alquilada</SelectItem>
                                <SelectItem value="Prestada">Prestada / Adjudicada</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Submit block */}
                      <div className="pt-6 border-t border-slate-100 flex justify-between items-center bg-slate-55/40 p-4 rounded-xl">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={clearExtractedForm}
                          className="hover:bg-slate-100 font-bold text-slate-500 text-xs uppercase tracking-wider h-11"
                        >
                          Limpiar e Iniciar Otro
                        </Button>
                        <Button 
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-12 uppercase text-xs tracking-wider shadow-md rounded-lg flex items-center gap-1.5"
                        >
                          <Check className="w-5 h-5 text-white" />
                          Confirmar y Guardar en Registro Local
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </form>
              ) : (
                <Card className="border border-slate-200 border-dashed bg-slate-50/50 p-12 text-center rounded-2xl flex flex-col items-center justify-center space-y-3">
                  <div className="bg-slate-200/50 p-4 rounded-full">
                    <Info className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-sm font-black text-blue-950 uppercase tracking-widest">A la espera de Digitalización</h4>
                  <p className="text-xs text-slate-450 font-medium max-w-sm leading-normal">
                    No hay censo procesado actualmente en esta sesión. Cargue el archivo completado arriba y presione{" "}
                    <strong> Analizar Planilla con IA 🪄</strong> para rellenar este panel al instante.
                  </p>
                </Card>
              )}
            </>
          ) : (
            /* Printable PDF Sheet Tab */
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-blue-950 uppercase tracking-tight">Modelo Oficial de Censo Físico (Ficha Única)</h3>
                  <p className="text-xs text-slate-550 font-medium leading-relaxed">
                    Esta es la ficha unificada oficial para el levantamiento de información en campo. Imprímala, llénela físicamente a mano 
                    con bolígrafo oscuro, y luego tómele una foto o escanéela para cargarla en la sección anterior. Formato optimizado para una sola página.
                  </p>
                </div>
                <Button
                  onClick={handlePrint}
                  className="bg-blue-900 hover:bg-blue-950 text-white font-black px-5 py-5 uppercase text-xs tracking-wider rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Printer className="w-4 h-4 text-white" />
                  Imprimir Planilla Oficial 🖨️
                </Button>
              </div>

              {/* Graphical representation of the printable sheet */}
              <div className="border border-slate-300 rounded-xl bg-stone-50 p-4 shadow-inner max-h-[820px] overflow-y-auto">
                {renderOfficialBlankForm(true)}
              </div>
            </Card>
          )}
        </div>

        {/* Right column: Local sync queue */}
        <div className="space-y-6">
          <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
              <CardTitle className="text-sm font-black text-blue-900 uppercase tracking-widest flex items-center justify-between">
                <span>Cola de Censo Sincronización</span>
                <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-[9px] font-black">
                  {offlineRecords.length} Por Subir
                </span>
              </CardTitle>
              <CardDescription className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">
                Expedientes digitales temporales listos para recargar a Firestore
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              
              <Button
                onClick={handleSyncData}
                disabled={syncing || offlineRecords.length === 0}
                className="w-full bg-blue-900 hover:bg-blue-950 font-black py-5 uppercase text-xs tracking-widest flex items-center justify-center gap-2 block shadow-lg disabled:bg-slate-100 disabled:text-slate-450 disabled:shadow-none"
              >
                {syncing ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-white" />
                    Consolidando Registros...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 text-white" />
                    Sincronizar con Firestore ⚡
                  </>
                )}
              </Button>

              {offlineRecords.length > 0 && !isOnline && (
                <div className="flex items-start gap-1 p-3 bg-amber-50 rounded-lg text-[10px] font-bold text-amber-805 uppercase tracking-wide border border-amber-150 leading-snug">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mr-1 mt-px" />
                  <span>Sin conexión de red activa. Sus censos permanecen seguros en este equipo.</span>
                </div>
              )}

              {offlineRecords.length > 0 && isOnline && (
                <div className="flex items-start gap-1 p-3 bg-emerald-50 rounded-lg text-[10px] font-bold text-emerald-855 uppercase tracking-wide border border-emerald-150 leading-snug">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mr-1 mt-px" />
                  <span>¡Señal restablecida con éxito! Proceda a sincronizar con los servidores.</span>
                </div>
              )}

              <div className="space-y-2 max-h-[500px] overflow-y-auto pt-2">
                {offlineRecords.map((rec) => (
                  <div key={rec.id} className="border border-slate-100 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 flex items-center justify-between group transition-all">
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase text-slate-800">{rec.worker.fullName}</p>
                      <div className="flex flex-wrap gap-1 text-[9px] font-black uppercase text-slate-400">
                        <span>C.I {rec.worker.dni}</span>
                        <span>•</span>
                        <span className="text-blue-700 font-bold">{rec.worker.commune}</span>
                      </div>
                      <div className="flex gap-1.5 pt-1.5 flex-wrap">
                        {rec.history.personalHistory.medicationsNeeded !== "N/A" && (
                          <span className="bg-blue-50 text-blue-800 border border-blue-150 rounded px-1.5 py-0.5 text-[8px] font-bold">💊 MEDICINA</span>
                        )}
                        {rec.history.requiresTechnicalAid && (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-150 rounded px-1.5 py-0.5 text-[8px] font-bold">♿ {rec.history.technicalAidType || "AYUDA TÉC"}</span>
                        )}
                      </div>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => handleDeleteRecord(rec.id)}
                      size="icon" 
                      className="w-8 h-8 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {offlineRecords.length === 0 && (
                  <div className="text-center py-10 text-slate-400 italic text-[10px] font-bold uppercase tracking-wider">
                    No hay censos en cola.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Hidden container styled explicitly for high contrast browser printing */}
      <div id="printable-sotillo-form" className="hidden p-0 bg-white text-black">
        {renderOfficialBlankForm(false)}
        <div className="hidden">
          
          <div className="flex justify-between items-center border-b-2 border-black pb-3">
            <div className="text-center font-black uppercase text-[10px] tracking-tight text-left space-y-0.5">
              <p>ALCALDÍA MUNICIPIO JUAN ANTONIO SOTILLO</p>
              <p className="text-black">DIRECCIÓN DE BIENESTAR SOCIAL</p>
            </div>
            <div className="text-right border border-black p-1.5 font-black uppercase text-[9px] tracking-wider bg-stone-100">
              <p className="text-[7px]">FOLIO OPERATIVO</p>
              <p className="text-xs">SOT-REG-FIELD</p>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-xs font-black uppercase tracking-wider">DIRECCIÓN DE BIENESTAR SOCIAL</h2>
            <p className="text-[9px] italic">Por favor, rellene toda la información con bolígrafo oscuro y letra de molde legible.</p>
          </div>

          <div className="space-y-1.5">
            <h3 className="bg-black text-white font-black text-[9px] uppercase tracking-widest p-1">
              BLOQUE I: COORDENADAS PERSONALES DEL CIUDADANO
            </h3>
            <div className="grid grid-cols-3 gap-2 border-b border-stone-300 pb-2">
              <div className="col-span-2">
                <span className="text-[8px] font-bold uppercase text-stone-550">1. Nombres y Apellidos Completos:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">2. Cédula de Identidad (V/E):</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 border-b border-stone-300 pb-2">
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">3. Fecha de Nacimiento:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">4. Género:</span>
                <div className="flex gap-2 mt-2 text-[9px] font-bold">
                  <span>[  ] MASC</span>
                  <span>[  ] FEM</span>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[8px] font-bold uppercase text-stone-550">5. Estado Civil:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-stone-300 pb-2">
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">6. Comuna:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">7. Sector / Barrio:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">8. Teléfono Móvil:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-stone-200 pb-2">
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">9. Dirección Exacta de Habitación:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">10. Contacto de Emergencia:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <span className="text-[8px] font-bold uppercase text-stone-550">11. ¿Sufre de alguna discapacidad?:</span>
                <div className="flex gap-3 mt-1.5 text-[9px] font-bold">
                  <span>[  ] SÍ</span>
                  <span>[  ] NO</span>
                  <span className="text-[8px] font-normal italic">Especifique tipo: ___________________________</span>
                </div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">12. Centro de Votación:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="bg-black text-white font-black text-[9px] uppercase tracking-widest p-1">
              BLOQUE II: ANTECEDENTES DE SALUD Y REQUERIMIENTO CLÍNICO
            </h3>
            <div className="border-b border-stone-300 pb-2">
              <span className="text-[8px] font-bold uppercase text-stone-550">1. Patologías Crónicas Presentes:</span>
              <div className="flex gap-6 mt-1.5 text-[9px] font-bold">
                <span>[  ] HIPERTENSIÓN ARTERIAL (HTA)</span>
                <span>[  ] DIABETES MELLITUS</span>
                <span>[  ] ASMA BRONQUIAL</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-stone-300 pb-2">
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">2. Alergias Conocidas:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">3. Medicamentos Permanentes:</span>
                <div className="border-b border-black h-5 mt-1"></div>
              </div>
            </div>

            <div className="border-b border-stone-300 pb-2">
              <span className="text-[8px] font-bold uppercase text-stone-550">4. Motivo Diagnóstico / Evaluación Primaria:</span>
              <div className="border-b border-black h-6 mt-1"></div>
            </div>

            <div className="border border-black p-3 bg-stone-50 rounded space-y-2">
              <p className="text-[8px] font-black uppercase">REQUISICIÓN DE MEDICAMENTOS PARA FARMACIA EN EL OPERATIVO:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[8px] font-bold uppercase">Medicamento y Dosis Solicitada:</span>
                  <div className="border-b border-black h-5 mt-1"></div>
                </div>
                <div>
                  <span className="text-[8px] font-bold uppercase">Frecuencia / Indicaciones:</span>
                  <div className="border-b border-black h-5 mt-1"></div>
                </div>
              </div>
            </div>

            <div className="border border-black p-3 bg-stone-50 rounded space-y-1.5">
              <span className="text-[8px] font-bold uppercase">¿Requiere de Ayuda Humana de Movilidad?:</span>
              <div className="flex flex-wrap gap-3 mt-1 text-[8px] font-bold">
                <span>[  ] SILLA DE RUEDAS</span>
                <span>[  ] ANDADERA</span>
                <span>[  ] BASTÓN</span>
                <span>[  ] MULETAS</span>
                <span>[  ] CAMA CLÍNICA</span>
                <span>[  ] OTRO: ________________</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[8px] font-bold uppercase">Cantidad:</span>
                  <div className="border-b border-black h-4 mt-1"></div>
                </div>
                <div>
                  <span className="text-[8px] font-bold uppercase">Observación Técnica:</span>
                  <div className="border-b border-black h-4 mt-1"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="bg-black text-white font-black text-[9px] uppercase tracking-widest p-1">
              BLOQUE III: CARACTERIZACIÓN DE VIVIENDA Y SEGURIDAD SOCIAL
            </h3>
            <div className="grid grid-cols-3 gap-2 border-b border-stone-200 pb-2 text-[8px] font-bold">
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">1. Tipo de Vivienda:</span>
                <div className="space-y-1 mt-1">
                  <p>[  ] CASA CONCRETO</p>
                  <p>[  ] RANCHO IMPROVISADO</p>
                  <p>[  ] APARTAMENTO</p>
                  <p>[  ] CUARTO / ANEXO</p>
                </div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">2. Material Paredes:</span>
                <div className="space-y-1 mt-1">
                  <p>[  ] BLOQUE FRISADO</p>
                  <p>[  ] MADERA / TABLAS</p>
                  <p>[  ] LÁMINA DE ZINC</p>
                  <p>[  ] BAHAREQUE / ADOBE</p>
                </div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">3. Material Techo:</span>
                <div className="space-y-1 mt-1">
                  <p>[  ] ZINC / ACEROLIT</p>
                  <p>[  ] PLATABANDA CONCRETO</p>
                  <p>[  ] TEJAS ARCILLA</p>
                  <p>[  ] ASBESTO / PLATABANDA</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[8px] font-bold">
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">4. Material Piso:</span>
                <div className="space-y-1 mt-1">
                  <p>[  ] CEMENTO</p>
                  <p>[  ] TIERRA</p>
                  <p>[  ] CERÁMICA / LÁMINA</p>
                </div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">5. Terreno Propio:</span>
                <div className="space-y-1 mt-1">
                  <p>[  ] SÍ ES PROPIO</p>
                  <p>[  ] NO PROPIO (EJIDO)</p>
                </div>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-stone-550">6. Tenencia Vivienda:</span>
                <div className="space-y-1 mt-1">
                  <p>[  ] PROPIA</p>
                  <p>[  ] ALQUILADA</p>
                  <p>[  ] PRESTADA / ADJUDICADA</p>
                </div>
              </div>
            </div>
          </div>

          {/* Removed signatures section */}

        </div>
      </div>

    </div>
  );
}
