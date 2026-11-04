import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MedicalHistory, MedicationRecipe, Evaluation } from "@/types";
import { 
  Heart, 
  User, 
  Pill, 
  Activity, 
  CheckCircle, 
  Calendar, 
  Stethoscope, 
  Scale, 
  Wind, 
  Thermometer, 
  AlertCircle,
  Home
} from "lucide-react";
import { format } from "date-fns";

interface MedicalHistoryDetailProps {
  history: MedicalHistory;
  recipes?: MedicationRecipe[];
  evaluations?: Evaluation[];
}

export default function MedicalHistoryDetail({ history, recipes = [], evaluations = [] }: MedicalHistoryDetailProps) {
  // Ordenar de más reciente a más antiguo
  const sortedEvals = [...(evaluations || [])].sort((a: any, b: any) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
    return dateB.getTime() - dateA.getTime();
  });
  
  // Buscar la última evaluación de tanda/física
  const latestPhysical = sortedEvals.find(
    e => e.physical && (e.physical.weight > 0 || e.physical.heartRate > 0 || e.physical.bloodPressure !== "120/80" || e.physical.temperature > 0)
  ) || (sortedEvals.length > 0 ? sortedEvals[0] : null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Antecedentes Personales */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
               <User className="w-4 h-4" /> Antecedentes Personales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
             <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Hipertensión</span>
                  <Badge variant={history.personalHistory.hypertension ? "destructive" : "outline"} className="text-[9px] uppercase font-black">
                    {history.personalHistory.hypertension ? "SI" : "NO"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Diabetes</span>
                  <Badge variant={history.personalHistory.diabetes ? "destructive" : "outline"} className="text-[9px] uppercase font-black">
                    {history.personalHistory.diabetes ? "SI" : "NO"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Asma</span>
                  <Badge variant={history.personalHistory.asthma ? "destructive" : "outline"} className="text-[9px] uppercase font-black">
                    {history.personalHistory.asthma ? "SI" : "NO"}
                  </Badge>
                </div>
             </div>
             {history.personalHistory.allergies && (
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alergias</p>
                 <p className="text-xs font-bold text-slate-700 uppercase">{history.personalHistory.allergies}</p>
               </div>
             )}
             {history.personalHistory.surgeries && (
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cirugías / Intervenciones</p>
                 <p className="text-xs font-bold text-slate-700 uppercase">{history.personalHistory.surgeries}</p>
               </div>
             )}
          </CardContent>
        </Card>

        {/* Antecedentes Familiares */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-black text-red-900 uppercase tracking-widest flex items-center gap-2">
               <Heart className="w-4 h-4" /> Cuadro Familiar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
             <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-50 flex flex-col gap-1">
                   <span className="text-[9px] font-black text-slate-400 uppercase">Cardiopatía</span>
                   <span className={`text-xs font-bold ${history.familyHistory.heartDisease ? 'text-red-600' : 'text-slate-400'}`}>
                     {history.familyHistory.heartDisease ? "PRESENTE" : "NO REGISTRA"}
                   </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 flex flex-col gap-1">
                   <span className="text-[9px] font-black text-slate-400 uppercase">Cáncer</span>
                   <span className={`text-xs font-bold ${history.familyHistory.cancer ? 'text-red-600' : 'text-slate-400'}`}>
                     {history.familyHistory.cancer ? "PRESENTE" : "NO REGISTRA"}
                   </span>
                </div>
             </div>
             {history.familyHistory.others && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Otros Hallazgos</p>
                  <p className="text-xs text-slate-600 leading-tight">{history.familyHistory.others}</p>
                </div>
             )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Condiciones de Habitabilidad de la Vivienda y Servicios Básicos */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white mt-6">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-black text-blue-950 uppercase tracking-widest flex items-center gap-2.5">
            <Home className="w-5 h-5 text-blue-600" />
            Condiciones de la Vivienda y Servicios Básicos
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-bold text-slate-400">
            Infraestructura habitacional y acceso a servicios esenciales del ciudadano
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {history.housingConditions ? (
            <div className="space-y-6">
              {/* Grid 1: Infraestructura y Habitabilidad */}
              <div>
                <h4 className="text-[10px] font-black text-blue-950 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100 font-sans">
                  Infraestructura de la Vivienda
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Tipo Vivienda */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">Tipo Vivienda</span>
                    <span className="text-xs font-bold text-slate-800 capitalize mt-1">
                      {history.housingConditions.housingType || "Casa"}
                    </span>
                  </div>

                  {/* Terreno Propio */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">Terreno Propio</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 uppercase">
                      {history.housingConditions.ownTerrain === "si" ? "SÍ" : "NO"}
                    </span>
                  </div>

                  {/* Tenencia */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">Tenencia</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 capitalize">
                      {(() => {
                        const val = history.housingConditions.tenure;
                        if (val === 'prestada_cuidador') return 'Prestada / Cuidador';
                        if (val === 'opcion_compra') return 'Opción Compra';
                        return val || "Propia";
                      })()}
                    </span>
                  </div>

                  {/* Techo */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">Techo</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 capitalize">
                      {history.housingConditions.roof || "Zinc"}
                    </span>
                  </div>

                  {/* Paredes */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                     <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">Paredes</span>
                     <span className="text-xs font-bold text-slate-800 mt-1 capitalize">
                       {history.housingConditions.walls === 'madera_zinc' ? 'Madera / Zinc' : (history.housingConditions.walls || "Frisadas")}
                     </span>
                  </div>

                  {/* Piso */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">Piso</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 capitalize">
                      {history.housingConditions.floor === 'otro' 
                        ? `Otro: ${history.housingConditions.floorOther || "No especificado"}` 
                        : (history.housingConditions.floor || "Cemento")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid 2: Servicios Públicos Básicos */}
              <div>
                <h4 className="text-[10px] font-black text-blue-950 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100 font-sans">
                  Acceso a Servicios Básicos
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Agua Blanca */}
                  <div className="bg-blue-50/30 p-3 rounded-xl border border-blue-100/50 flex flex-col">
                    <span className="text-[9px] font-black uppercase text-blue-800/80 tracking-wider font-sans">Agua Blanca (Abastecimiento)</span>
                    <span className="text-xs font-bold text-blue-950 capitalize mt-1">
                      {(() => {
                        const val = history.housingConditions.waterSupply;
                        if (val === 'camion_cisterna') return 'Camión Cisterna';
                        if (val === 'pila_publica') return 'Pila Pública';
                        return val || "Acueducto";
                      })()}
                    </span>
                  </div>

                  {/* Aguas Servidas */}
                  <div className="bg-purple-50/30 p-3 rounded-xl border border-purple-100/50 flex flex-col font-sans">
                    <span className="text-[9px] font-black uppercase text-purple-800/80 tracking-wider">Aguas Servidas (Eliminación)</span>
                    <span className="text-xs font-bold text-purple-950 mt-1 capitalize">
                      {(() => {
                        const val = history.housingConditions.sewage;
                        if (val === 'pozo_septico') return 'Pozo Séptico';
                        if (val === 'al_aire_libre') return 'Al Aire Libre';
                        return val || "Cloacas";
                      })()}
                    </span>
                  </div>

                  {/* Electricidad */}
                  <div className="bg-yellow-50/20 p-3 rounded-xl border border-yellow-150/40 flex flex-col">
                    <span className="text-[9px] font-black uppercase text-yellow-800/85 tracking-wider font-sans">Electricidad</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 capitalize">
                      {(() => {
                        const val = history.housingConditions.electricity;
                        if (val === 'publico_con_medidor') return 'Público c/Medidor';
                        if (val === 'publico_sin_medidor') return 'Público s/Medidor';
                        if (val === 'no_posee') return 'No Posee';
                        return val || "Público c/Medidor";
                      })()}
                    </span>
                  </div>

                  {/* Gas */}
                  <div className="bg-orange-50/20 p-3 rounded-xl border border-orange-100/30 flex flex-col">
                    <span className="text-[9px] font-black uppercase text-orange-855 tracking-wider font-sans">Gas</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 capitalize">
                      {(() => {
                        const val = history.housingConditions.gas;
                        if (val === 'no_posee') return 'No Posee';
                        return val || "Bombona";
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertCircle className="w-8 h-8 text-slate-350 mx-auto mb-2" />
              <p className="text-xs font-black text-slate-600 uppercase">Sin información habitacional registrada</p>
              <p className="text-[10px] text-slate-400 mt-1 font-sans">Registre o edite la historia médica permanente de este ciudadano para cargar sus condiciones habitacionales y de servicios básicos.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Examen Físico y Signos Vitales de Jornada */}
      <Card className="border border-emerald-250 shadow-sm overflow-hidden bg-[#f4fbf7]/30">
        <CardHeader className="bg-emerald-50/20 border-b border-emerald-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 p-5">
          <div className="space-y-1">
            <CardTitle className="text-sm font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2.5">
              <Stethoscope className="w-5 h-5 text-emerald-600" />
              Examen Físico y Signos Vitales (Abordaje de Salud)
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-slate-400">
               Clasificación antropométrica y reporte de triage en censo directo
            </CardDescription>
          </div>
          {latestPhysical && (
            <Badge className="bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider py-1 px-2.5">
              Evaluación: {(() => {
                try {
                  const rawDate = latestPhysical.createdAt as any;
                  const dt = rawDate?.toDate 
                    ? rawDate.toDate() 
                    : new Date(rawDate);
                  return !isNaN(dt.getTime()) ? format(dt, 'dd/MM/yyyy') : 'Fecha Reciente';
                } catch (e) {
                  return 'Fecha Reciente';
                }
              })()}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {latestPhysical ? (
            <div className="space-y-6">
              {/* Vitals & Anthropometrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {/* 1. PA */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
                  <Activity className="w-4 h-4 text-red-500 mb-1 animate-pulse" />
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tensión PA</span>
                  <span className="text-sm font-black text-slate-800">{latestPhysical.physical?.bloodPressure || "120/80"}</span>
                  <span className="text-[8px] text-slate-400 font-bold">mmHg</span>
                </div>

                {/* 2. HR */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
                  <Heart className="w-4 h-4 text-rose-500 mb-1" />
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Frecuencia HR</span>
                  <span className="text-sm font-black text-slate-800">
                    {latestPhysical.physical?.heartRate ? `${latestPhysical.physical.heartRate}` : "-"}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">LPM</span>
                </div>

                {/* 3. SpO2 */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
                  <Wind className="w-4 h-4 text-sky-500 mb-1" />
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Saturación O2</span>
                  <span className="text-sm font-black text-slate-800">
                    {latestPhysical.physical?.oxygenSaturation ? `${latestPhysical.physical.oxygenSaturation}%` : "98%"}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">SpO2</span>
                </div>

                {/* 4. Temp */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
                  <Thermometer className="w-4 h-4 text-amber-500 mb-1" />
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Temperatura</span>
                  <span className="text-sm font-black text-slate-800">
                    {latestPhysical.physical?.temperature ? `${latestPhysical.physical.temperature}°C` : "36.5°C"}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">Grados Cent.</span>
                </div>

                {/* 5. Peso */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
                  <Scale className="w-4 h-4 text-emerald-600 mb-1" />
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Peso</span>
                  <span className="text-sm font-black text-slate-800">
                    {latestPhysical.physical?.weight ? `${latestPhysical.physical.weight}` : "-"}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">Kg</span>
                </div>

                {/* 6. Talla */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-4 h-4 text-purple-600 font-black text-xs mb-1 flex items-center justify-center">H</div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Talla</span>
                  <span className="text-sm font-black text-slate-800">
                    {latestPhysical.physical?.height ? `${latestPhysical.physical.height}` : "-"}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold font-sans">metros</span>
                </div>

                {/* 7. IMC */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-4 h-4 text-blue-600 font-black text-xs mb-1 flex items-center justify-center">BMI</div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Índice IMC</span>
                  <span className="text-sm font-black text-slate-800">
                    {latestPhysical.physical?.bmi ? latestPhysical.physical.bmi.toFixed(2) : "-"}
                  </span>
                  <span className="text-[8px] font-black text-slate-400">
                    {latestPhysical.physical?.bmi && latestPhysical.physical.bmi > 0 ? (
                      latestPhysical.physical.bmi < 18.5 ? "Bajo Peso" : 
                      latestPhysical.physical.bmi < 25.0 ? "Normal" : 
                      latestPhysical.physical.bmi < 30.0 ? "Sobrepeso" : "Obesidad"
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
              </div>

              {/* Diagnosis, Recommendations & Determination */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-100">
                <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                     🔍 Diagnóstico y Resumen Clínico
                  </p>
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed uppercase">
                    {latestPhysical.diagnosis || "No se especificó diagnóstico descriptivo."}
                  </p>
                </div>

                <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                     📋 Recomendaciones Médicas
                  </p>
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed uppercase">
                    {latestPhysical.recommendations || "Control médico periódico y preventivo."}
                  </p>
                </div>

                <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                       ⚖️ Aptitud / Condición del Ciudadano
                    </p>
                    <Badge className={`font-black text-[9px] uppercase px-3 py-1 rounded shadow-sm border-none ${
                      latestPhysical.determination === 'fit' 
                        ? 'bg-emerald-500 text-white' 
                        : latestPhysical.determination === 'fit-with-restrictions'
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-650 text-white'
                    }`}>
                      {latestPhysical.determination === 'fit' ? 'APTO' : 
                       latestPhysical.determination === 'fit-with-restrictions' ? 'APTO CON RESTRICCIONES' : 'NO APTO'}
                    </Badge>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-2">
                    Evaluado por: {latestPhysical.evaluatorId || "Médico de Jornada"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-700 uppercase">Sin Examen Físico Registrado</p>
              <p className="text-[11px] text-slate-500 max-w-md leading-relaxed mt-1">
                Este ciudadano no cuenta con signos vitales ni mediciones antropométricas en la base de datos de abordajes. Edite la historia en la pestaña de antecedentes seleccionando la opción dual de carga.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patología, Discapacidad y Ayudas Humanas */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-700" /> Patología, Discapacidad y Ayudas Humanas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pathology column */}
            <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patología de Ingreso</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-blue-600 hover:bg-blue-700 text-[10px] font-bold py-1 px-3 uppercase">
                  {history.pathology ? history.pathology : "No registrada / Sano"}
                </Badge>
              </div>
            </div>

            {/* Disability column */}
            <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condición de Discapacidad</p>
              <div className="flex flex-col gap-1 mt-1">
                <span className={`text-xs font-black uppercase ${history.hasDisability ? "text-red-700" : "text-emerald-700"}`}>
                  {history.hasDisability ? "SÍ PRESENTA DISCAPACIDAD" : "NO PRESENTA DISCAPACIDAD"}
                </span>
                {history.hasDisability && history.disabilityType && (
                  <span className="text-xs font-bold text-slate-600 bg-red-50/50 border border-red-100 rounded px-2 py-1 uppercase mt-1">
                    Tipo: {history.disabilityType}
                  </span>
                )}
              </div>
            </div>

            {/* Technical Aids column */}
            <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ayudas Humanas Solicitadas</p>
              <div className="flex flex-col gap-1 mt-1">
                <span className={`text-xs font-black uppercase ${history.requiresTechnicalAid ? "text-blue-800" : "text-slate-500"}`}>
                  {history.requiresTechnicalAid ? `SÍ REQUIERE AYUDA` : "NO REQUIERE AYUDA"}
                </span>
                {history.requiresTechnicalAid && (
                  <div className="mt-1 space-y-1">
                    <div className="text-xs font-bold text-slate-700 flex justify-between">
                      <span>Tipo: <strong className="uppercase">{history.technicalAidType || "Silla de ruedas"}</strong></span>
                      <strong className="text-blue-600 bg-blue-50 border border-blue-100 rounded px-2">Cant: {history.technicalAidQuantity || 1}</strong>
                    </div>
                    {history.technicalAidNotes && (
                      <p className="text-[11px] italic text-slate-500 bg-white border rounded p-1 mt-1">
                        Obs: "{history.technicalAidNotes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
         <CardHeader className="bg-blue-50/50 border-b border-blue-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-blue-950 uppercase tracking-widest flex items-center gap-2">
               <Pill className="w-4 h-4 text-blue-700" /> Plan Terapéutico Actual
            </CardTitle>
         </CardHeader>
         <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medicamentos Requeridos</p>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 min-h-[80px]">
                     <p className="text-sm font-bold text-slate-700 italic">
                        {history.personalHistory.medicationsNeeded || "No se han especificado medicinas para tratamiento continuo."}
                     </p>
                  </div>
               </div>
               <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frecuencia y Observaciones</p>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 min-h-[80px]">
                     <p className="text-sm font-bold text-slate-700">
                        {history.personalHistory.medicationFrequency || "Sin instrucciones registradas."}
                     </p>
                  </div>
               </div>
            </div>
         </CardContent>
      </Card>

      {/* HISTÓRICO PERSONAL DE SUMINISTROS Y ENTREGAS */}
      <Card className="border-slate-200 shadow-sm overflow-hidden mt-6 animate-in fade-in duration-300">
        <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-sm font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-700" /> Historial de Apoyos y Suministros Entregados
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-1 sm:mt-0 font-sans">
                Histórico personal de medicamentos, medicinas y ayudas humanas otorgadas
              </CardDescription>
            </div>
            <Badge className="bg-emerald-100 text-emerald-850 border-none font-black text-[9px] uppercase px-2.5 py-0.5">
              {recipes.filter(r => r.status === 'delivered').length} Entregas
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {recipes.filter(r => r.status === 'delivered').length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic text-xs uppercase font-bold tracking-wider">
                No se registran entregas efectivas de medicamentos o ayudas humanas para este ciudadano.
              </div>
            ) : (
              recipes
                .filter(r => r.status === 'delivered')
                .sort((a, b) => {
                  const dateA = a.deliveredAt?.toDate ? a.deliveredAt.toDate() : a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
                  const dateB = b.deliveredAt?.toDate ? b.deliveredAt.toDate() : b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
                  return dateB.getTime() - dateA.getTime();
                })
                .map((recipe, idx) => (
                  <div key={recipe.id || idx} className="p-5 hover:bg-slate-50/40 transition-colors flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="flex gap-4 items-start">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${recipe.requiresTechnicalAid ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {recipe.requiresTechnicalAid ? <span className="text-sm font-bold">♿</span> : <Pill className="w-5 h-4" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 uppercase text-xs">
                            {recipe.requiresTechnicalAid ? (recipe.technicalAidType || recipe.medication) : recipe.medication}
                          </span>
                          <Badge className={`text-[8px] font-black uppercase border-none px-1.5 py-0.2 rounded ${
                            recipe.requiresTechnicalAid ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {recipe.requiresTechnicalAid ? "Ayuda Humana" : "Medicamento"}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold leading-tight uppercase font-sans">
                          {recipe.requiresTechnicalAid 
                            ? `Detalle: ${recipe.technicalAidNotes || "Sin observaciones"}` 
                            : `Dosificación: ${recipe.dosage || "N/A"} / ${recipe.frequency || "N/A"} (${recipe.presentation || "N/A"})`
                          }
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                          <Calendar className="w-3.5 h-3.5" /> 
                          Entrega: {recipe.deliveredAt?.toDate 
                            ? format(recipe.deliveredAt.toDate(), "dd/MM/yyyy HH:mm") 
                            : recipe.createdAt?.toDate 
                              ? format(recipe.createdAt.toDate(), "dd/MM/yyyy HH:mm") 
                              : "Fecha de entrega"}
                        </p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 font-sans">
                      <Badge className="bg-emerald-50 text-emerald-750 border border-emerald-200 font-black text-[9px] uppercase px-2 py-0.5">
                        {recipe.quantity || recipe.technicalAidQuantity || 1} {recipe.requiresTechnicalAid ? 'Unid.' : 'Fármacos'}
                      </Badge>
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">
                        Efectuado por: {recipe.deliveredBy || "Responsable"}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
