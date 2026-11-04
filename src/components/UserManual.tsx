import React, { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Shield, 
  User, 
  ChevronRight, 
  CheckCircle2, 
  Users, 
  Pill, 
  Map, 
  BarChart3, 
  Database, 
  FileText, 
  Settings,
  Sparkles,
  Search,
  Check,
  Smartphone,
  Server
} from "lucide-react";

export default function UserManual() {
  const [activeTab, setActiveTab] = useState<'admin' | 'editor'>('admin');
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const adminSteps = [
    {
      title: "1. Acceso Seguro y Dashboard Gerencial",
      desc: "Análisis y métricas unificadas de impacto de todo el municipio.",
      content: [
        "Inicia sesión con tu cuenta con privilegios de **Administrador**.",
        "Accede al **Dashboard de Gestión**, donde verás un resumen estadístico en tiempo real del total del censo.",
        "Utiliza los filtros territoriales rápidos por comuna y sectores para segmentar poblados con índices críticos de asma, diabetes, hipertensión o situaciones críticas de vivienda.",
        "Visualiza la **Eficiencia de Entrega de Farmacia** para evaluar cuántos casos ya fueron atendidos de forma exitosa."
      ]
    },
    {
      title: "2. Gestión Territorial y Asignación de Comunas",
      desc: "Administración integral de sectores e impacto en el Municipio Sotillo.",
      content: [
        "Ingresa a la pestaña **Impacto Territorial**.",
        "Monitorea el total de incidentes o registros vinculados a cada Comuna oficial del Municipio (Chuparín, Guanire, Pozuelos, etc.).",
        "Configura umbrales de alerta médica prioritaria para mapear áreas que sufran de escasez de ayudas humanas o requieran jornadas especiales de atención inmediata."
      ]
    },
    {
      title: "3. Administración y Auditoría de Cuentas",
      desc: "Creación de usuarios y control de perfiles editoriales remotos.",
      content: [
        "Accede a **Gestión de Usuarios** para ver el listado de prestadores de salud.",
        "Crea nuevos usuarios facilitando el nombre, correo electrónico y asignando el rol correspondiente: **Administrador** o **Editor**.",
        "Utiliza la opción de **Bloquear / Desbloquear** usuario para regular de manera estricta las autorizaciones sobre el sistema central.",
        "Audita permanentemente quién ha prescrito o dispensado cada medicamento o ayuda humana en el panel general de farmacia."
      ]
    },
    {
      title: "4. Métricas Avanzadas y Descarga de Reportes",
      desc: "Exportación oficial a PDF y hojas contables de Excel.",
      content: [
        "Navega a **Métricas y Análisis** para visualizar estadísticas demográficas y de vivienda estilo bento-grid.",
        "Descarga padrones de operativos consolidados en archivos unificados, listos para imprimir y auditar físicamente en la Alcaldía."
      ]
    }
  ];

  const editorSteps = [
    {
      title: "1. Búsqueda y Registro Rápido de Ciudadanos",
      desc: "Configuración física del expediente clínico y censo social.",
      content: [
        "Inicia sesión como **Editor** para comenzar la atención social en sitio.",
        "En la pestaña **Expediente de Salud**, busca la Cédula de Identidad del ciudadano para verificar si ya posee registro en el Municipio Sotillo.",
        "Si no está registrado, pulsa **NUEVO CIUDADANO** para completar su perfil demográfico (civil, discapacidades, comuna de residencia, número de teléfono).",
        "Si ya cuenta con expediente, pulsa su nombre para visualizar su perfil completo e históricos médicos."
      ]
    },
    {
      title: "2. Carga del Historial Clínico Integral",
      desc: "Toma de antecedentes patológicos, vivienda y necesidades básicas.",
      content: [
        "Desde la ficha del ciudadano, pulsa **NUEVA HISTORIA CLÍNICA**.",
        "Completa los campos clínicos esenciales: antecedentes personales (Hipertensión, Diabetes, Asma), antecedentes familiares, patologías observadas, y grado de independencia funcional.",
        "Llena el bloque de **Condiciones de Vivienda** para medir factores de riesgo (como pisos de tierra, techos de zinc, régimen de tenencia).",
        "Si el paciente solicita o requiere medicamentos, escríbelos en el apartado correspondiente con su frecuencia para que se envíe una alerta directa y consolidad en el depósito de **Farmacia**."
      ]
    },
    {
      title: "3. Dispensa de Medicamentos y Ayudas Humanas",
      desc: "Operatividad, control y entrega final de insumos.",
      content: [
        "Ve al panel de **Farmacia y Requerimientos** para gestionar las peticiones médicas activas del Municipio.",
        "Usa las subpestañas superiores para oscilar entre **Medicamentos y Medicinas** (como Losartán) y **Ayudas Humanas** (como Sillas de Ruedas, andaderas, bastones).",
        "Cuando completes la entrega física de un suministro, haz clic en **Registrar Entrega** para marcar la petición como atendida y liberar espacio, deduciendo del consolidado general del próximo operativo."
      ]
    },
    {
      title: "4. Formulario Offline",
      desc: "Carga de censos y fichas del ciudadano.",
      content: [
        "Al visitar zonas del municipio, ingresa a la sección **Formulario Offline**.",
        "Complete la planilla digital con los datos obtenidos en el campo.",
        "Verifique los campos completados, agrégueles detalles si es necesario, y pulse **Guardar en Registro Local**.",
        "Tus censos se guardarán de forma local en el dispositivo del navegador.",
        "Al estar listo, pulse **Sincronizar con Firestore ⚡** para subir todos los registros acumulados en un solo clic."
      ]
    }
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-350">
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-blue-950 tracking-tight uppercase flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-blue-900" />
          Manual de Usuario Integrado
        </h2>
        <p className="text-slate-500 font-medium font-sans max-w-3xl leading-snug">
          Guía interactiva paso a paso para el uso correcto del Sistema de Atención y Bienestar Social del Municipio Juan Antonio Sotillo. 
          Selecciona tu rol para desglosar las guías operativas oficiales.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => { setActiveTab('admin'); setExpandedSection(0); }}
          className={`px-6 py-3 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'admin'
              ? 'border-blue-900 text-blue-900 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Shield className="w-4 h-4" />
          Manual del Administrador
        </button>
        <button
          onClick={() => { setActiveTab('editor'); setExpandedSection(0); }}
          className={`px-6 py-3 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'editor'
              ? 'border-blue-900 text-blue-900 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <User className="w-4 h-4" />
          Manual del Editor / Jornada
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Step Breakdown */}
        <div className="lg:col-span-2 space-y-3">
          {(activeTab === 'admin' ? adminSteps : editorSteps).map((step, i) => {
            const isExpanded = expandedSection === i;
            return (
              <Card 
                key={i} 
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm ${
                  isExpanded ? 'border-blue-300 ring-1 ring-blue-500/20' : 'border-slate-200 hover:border-slate-350'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedSection(isExpanded ? null : i)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 focus:outline-none"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-blue-950 uppercase tracking-wide flex items-center gap-2">
                      {activeTab === 'admin' ? (
                        <Shield className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                      )}
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{step.desc}</p>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {isExpanded && (
                  <CardContent className="border-t border-slate-100/70 p-5 bg-slate-50/50 space-y-3">
                    <div className="space-y-3 font-sans text-stone-888 leading-relaxed text-xs font-semibold uppercase tracking-wide">
                      {step.content.map((point, index) => (
                        <div key={index} className="flex gap-2 items-start text-xs text-slate-700 normal-case leading-normal font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <p dangerouslySetInnerHTML={{ __html: point }} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Quick Help Card */}
        <div className="space-y-6">
          <Card className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800">
            <h3 className="text-md font-black uppercase tracking-wider text-slate-300 mb-3">Roles del Sistema</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <Badge className="bg-blue-600 text-white font-black text-[9px] uppercase">Administrador (Director)</Badge>
                <p className="text-xs text-slate-300 leading-normal font-serif italic">
                  Posee visibilidad absoluta. Puede auditar, crear editores, ver tableros demográficos del Municipio y depurar el inventario.
                </p>
              </div>
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <Badge className="bg-emerald-600 text-clean font-black text-[9px] uppercase">Editor (Personal de Jornada)</Badge>
                <p className="text-xs text-slate-300 leading-normal font-serif italic">
                  Se enfoca en el registro rápido. Atiende en sitio, registra planillas en el Formulario Offline, prescribe recetas y solicita insumos de farmacia.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
