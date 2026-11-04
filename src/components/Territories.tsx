import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { COMMUNES, OTHER_COMMUNE_OPTION } from "@/constants";
import { 
  MapPin, 
  Users, 
  Activity, 
  Loader2, 
  ArrowRight, 
  Eye, 
  FileText, 
  FileSpreadsheet, 
  Search, 
  Pill, 
  HeartHandshake, 
  Download,
  AlertTriangle,
  Clock,
  Compass,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  BarChart2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import { dataService } from "@/lib/dataService";
import { Worker, MedicationRecipe } from "@/types";
import CommunePatientsModal from "@/components/CommunePatientsModal";
import { 
  exportAllCommunesSectionedPdf, 
  exportAllCommunesExcel, 
  exportCommunePdf,
  exportCommuneDensityReportPdf,
  isForeignerCommune,
  isMedicationRecipe,
  isTechnicalAidRecipe,
  calculateAge,
  getRecipeDeliveredAidUnits
} from "@/utils/territoryPdf";

type FilterMode = "all" | "sotillo" | "foreign" | "active" | "priority";

export default function Territories() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  const [densityViewMode, setDensityViewMode] = useState<'chart' | 'table'>('chart');

  // Search and Segmented Filter State
  const [searchCommune, setSearchCommune] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [wData, rData] = await Promise.all([
          dataService.getWorkers(),
          dataService.getMedicationRecipes()
        ]);
        setWorkers(wData);
        setRecipes(rData);
      } catch (err) {
        console.error("Error cargando datos territoriales:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 1. Separation: 21 Municipal Communes of Sotillo vs. Foreign Cases
  const sotilloWorkers = useMemo(() => {
    return workers.filter(w => !isForeignerCommune(w.commune) && !w.isForeigner);
  }, [workers]);

  const foreignWorkers = useMemo(() => {
    return workers.filter(w => isForeignerCommune(w.commune) || !!w.isForeigner);
  }, [workers]);

  // Counts by commune for Sotillo
  const sotilloCommuneCounts = useMemo(() => {
    return sotilloWorkers.reduce((acc, w) => {
      const c = (w.commune || "").trim().toUpperCase();
      if (c) {
        acc[c] = (acc[c] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [sotilloWorkers]);

  // Pure Base 21 Municipal Coverage
  const activeSotilloCommunesCount = useMemo(() => {
    return COMMUNES.filter(c => (sotilloCommuneCounts[c.toUpperCase().trim()] || 0) > 0).length;
  }, [sotilloCommuneCounts]);

  const sotilloCoveragePercent = ((activeSotilloCommunesCount / 21) * 100).toFixed(0);

  // 4. Support Breakdown (Fármacos vs. Ayudas Técnicas/Sociales) and Exact Delivered Aid Units
  const communeSupportBreakdown = useMemo(() => {
    const map: Record<string, { meds: number; aids: number; total: number; avg: string; disabilities: number; elderly: number }> = {};

    COMMUNES.forEach(c => {
      const norm = c.toUpperCase().trim();
      const cWorkers = sotilloWorkers.filter(w => (w.commune || "").toUpperCase().trim() === norm);
      const workerIds = new Set(cWorkers.map(w => w.id));
      const cRecipes = recipes.filter(r => workerIds.has(r.workerId) || (r.commune && r.commune.toUpperCase().trim() === norm));

      let medsUnits = 0;
      let aidsUnits = 0;
      cRecipes.forEach(r => {
        const u = getRecipeDeliveredAidUnits(r);
        medsUnits += u.medsUnits;
        aidsUnits += u.aidsUnits;
      });

      const totalDelivered = medsUnits + aidsUnits;
      const count = cWorkers.length;
      const avg = count > 0 ? (totalDelivered / count).toFixed(1) : "0.0";
      const disabilities = cWorkers.filter(w => !!w.hasDisability).length;
      const elderly = cWorkers.filter(w => {
        const a = calculateAge(w.birthDate);
        return a !== null && a >= 60;
      }).length;

      map[norm] = {
        meds: medsUnits,
        aids: aidsUnits,
        total: totalDelivered,
        avg,
        disabilities,
        elderly
      };
    });

    return map;
  }, [sotilloWorkers, recipes]);

  // 6. Last Activity / Operative History for each commune (Alert if > 45 days)
  const communeLastActivity = useMemo(() => {
    const map: Record<string, { date: Date | null; daysAgo: number | null; isPendingVisit: boolean }> = {};

    COMMUNES.forEach(c => {
      const norm = c.toUpperCase().trim();
      const cWorkers = sotilloWorkers.filter(w => (w.commune || "").toUpperCase().trim() === norm);
      const workerIds = new Set(cWorkers.map(w => w.id));
      const cRecipes = recipes.filter(r => workerIds.has(r.workerId) || (r.commune && r.commune.toUpperCase().trim() === norm));

      let latestTimestamp = 0;

      cWorkers.forEach(w => {
        if (w.updatedAt) {
          const t = new Date(w.updatedAt).getTime();
          if (t > latestTimestamp) latestTimestamp = t;
        }
        if (w.createdAt) {
          const t = new Date(w.createdAt).getTime();
          if (t > latestTimestamp) latestTimestamp = t;
        }
      });

      cRecipes.forEach(r => {
        if (r.deliveredAt) {
          const t = new Date(r.deliveredAt).getTime();
          if (t > latestTimestamp) latestTimestamp = t;
        }
        if (r.createdAt) {
          const t = new Date(r.createdAt).getTime();
          if (t > latestTimestamp) latestTimestamp = t;
        }
      });

      if (latestTimestamp > 0) {
        const daysAgo = Math.max(0, Math.floor((Date.now() - latestTimestamp) / (1000 * 60 * 60 * 24)));
        map[norm] = {
          date: new Date(latestTimestamp),
          daysAgo,
          isPendingVisit: daysAgo > 45 && cWorkers.length > 0
        };
      } else {
        map[norm] = {
          date: null,
          daysAgo: null,
          isPendingVisit: false
        };
      }
    });

    return map;
  }, [sotilloWorkers, recipes]);

  // Total municipal calculations for Sotillo
  const sotilloTotalDisabilities = useMemo(() => {
    return sotilloWorkers.filter(w => !!w.hasDisability).length;
  }, [sotilloWorkers]);

  const sotilloTotalElderly = useMemo(() => {
    return sotilloWorkers.filter(w => {
      const a = calculateAge(w.birthDate);
      return a !== null && a >= 60;
    }).length;
  }, [sotilloWorkers]);

  const sotilloWorkerIds = useMemo(() => new Set(sotilloWorkers.map(w => w.id)), [sotilloWorkers]);
  const sotilloRecipes = useMemo(() => recipes.filter(r => sotilloWorkerIds.has(r.workerId)), [recipes, sotilloWorkerIds]);
  
  // Sotillo exact aid units
  const { sotilloTotalMeds, sotilloTotalAids, sotilloTotalDelivered } = useMemo(() => {
    let meds = 0;
    let aids = 0;
    sotilloRecipes.forEach(r => {
      const u = getRecipeDeliveredAidUnits(r);
      meds += u.medsUnits;
      aids += u.aidsUnits;
    });
    return {
      sotilloTotalMeds: meds,
      sotilloTotalAids: aids,
      sotilloTotalDelivered: meds + aids
    };
  }, [sotilloRecipes]);

  // Foreign Cases stats
  const foreignStats = useMemo(() => {
    const workerIds = new Set(foreignWorkers.map(w => w.id));
    const fRecipes = recipes.filter(r => workerIds.has(r.workerId) || isForeignerCommune(r.commune));
    let meds = 0;
    let aids = 0;
    fRecipes.forEach(r => {
      const u = getRecipeDeliveredAidUnits(r);
      meds += u.medsUnits;
      aids += u.aidsUnits;
    });
    const total = meds + aids;
    const disabilities = foreignWorkers.filter(w => !!w.hasDisability).length;
    const elderly = foreignWorkers.filter(w => {
      const a = calculateAge(w.birthDate);
      return a !== null && a >= 60;
    }).length;
    const avg = foreignWorkers.length > 0 ? (total / foreignWorkers.length).toFixed(1) : "0.0";

    return {
      count: foreignWorkers.length,
      meds,
      aids,
      total,
      avg,
      disabilities,
      elderly
    };
  }, [foreignWorkers, recipes]);

  // Grand totals across the app
  const grandTotalPeople = workers.length;
  const grandTotalDeliveredAids = sotilloTotalDelivered + foreignStats.total;
  const grandAvgAids = grandTotalPeople > 0 ? (grandTotalDeliveredAids / grandTotalPeople).toFixed(1) : "0.0";

  // Chart statistics for the 21 Communes
  const territoryStats = useMemo(() => {
    return COMMUNES.map(c => {
      const norm = c.toUpperCase().trim();
      const count = sotilloCommuneCounts[norm] || 0;
      const bd = communeSupportBreakdown[norm] || { meds: 0, aids: 0 };
      return {
        name: c,
        workers: count,
        meds: bd.meds,
        aids: bd.aids
      };
    }).sort((a, b) => b.workers - a.workers);
  }, [sotilloCommuneCounts, communeSupportBreakdown]);

  const topCommune = territoryStats[0];

  // Classification by Social Area for Sotillo
  const classificationCounts = useMemo(() => {
    return sotilloWorkers.reduce((acc, w) => {
      const area = w.socialArea || "SIN CLASIFICAR";
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [sotilloWorkers]);

  const classifications = Object.entries(classificationCounts)
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count);

  // Filtered Communes for the Grid
  const filteredCommunes = useMemo(() => {
    if (filterMode === "foreign") return [];

    return COMMUNES.filter(commune => {
      const norm = commune.toUpperCase().trim();
      const count = sotilloCommuneCounts[norm] || 0;
      const term = searchCommune.toLowerCase().trim();
      const activity = communeLastActivity[norm];
      const support = communeSupportBreakdown[norm];

      // Search match
      if (term && !commune.toLowerCase().includes(term)) {
        return false;
      }

      // Filter modes
      if (filterMode === "active" && count === 0) return false;
      if (filterMode === "priority") {
        const hasVulnerability = (support?.disabilities || 0) > 0 || (support?.aids || 0) > 0 || (support?.meds || 0) >= 4 || !!activity?.isPendingVisit;
        if (!hasVulnerability && count < 8) return false;
      }

      return true;
    });
  }, [sotilloCommuneCounts, searchCommune, filterMode, communeLastActivity, communeSupportBreakdown]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header with Title and Executive Two-Chapter Export Buttons */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-blue-100 text-blue-900 border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
              Coordinación Geográfica
            </Badge>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Alcaldía de Sotillo • Bienestar Social
            </span>
          </div>
          <h2 className="text-2xl font-black text-blue-950 tracking-tight uppercase mt-1">Impacto Territorial</h2>
          <p className="text-xs uppercase font-bold text-slate-500 mt-0.5">
            Análisis demográfico en 21 Comunas Municipales y Registro de Atención Solidaria Foránea
          </p>
        </div>

        {/* Global Export Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          <Button
            onClick={() => exportAllCommunesSectionedPdf(workers, recipes)}
            disabled={workers.length === 0}
            className="bg-blue-900 hover:bg-blue-950 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer flex-1 md:flex-none transition-all"
            title="Generar Informe Ejecutivo de Gestión Territorial"
          >
            <FileText className="w-4 h-4 text-blue-200" />
            <span>Informe Ejecutivo de Gestión Territorial (PDF)</span>
          </Button>
          <Button
            onClick={() => exportAllCommunesExcel(workers, recipes)}
            disabled={workers.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer flex-1 md:flex-none transition-all"
            title="Exportar base completa en Excel (3 pestañas estructuradas)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Exportar Excel</span>
          </Button>
        </div>
      </div>

      {/* 1. KPI Overview Strip (Pure Base 21 Coverage + Casos Foráneos) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Cobertura Pura Base 21 */}
        <Card className="border border-slate-200 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cobertura Comunal</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-950 leading-none">{activeSotilloCommunesCount}</span>
                <span className="text-xs font-bold text-slate-400">/ 21 Comunas</span>
              </div>
              <p className="text-[10px] font-bold text-blue-700 mt-1">{sotilloCoveragePercent}% de presencia municipal</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Personas Cargadas Totales (Sotillo + Foráneos) */}
        <Card className="border border-slate-200 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Personas Cargadas</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-950 leading-none">{grandTotalPeople}</span>
                <span className="text-xs font-bold text-slate-400">Ciudadanos</span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                Sotillo: {sotilloWorkers.length} | Foráneos: {foreignWorkers.length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Ayudas Entregadas Totales (Macro balance de la app) */}
        <Card className="border border-slate-200 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-indigo-800 tracking-wider">Ayudas Entregadas Totales</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-indigo-950 leading-none">{grandTotalDeliveredAids}</span>
                <span className="text-xs font-bold text-indigo-600">Despachos</span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                💊 {sotilloTotalMeds + foreignStats.meds} fár. • ♿ {sotilloTotalAids + foreignStats.aids} ayud. ({grandAvgAids} ay/pers)
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <Pill className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Foco Vulnerable Municipal */}
        <Card className="border border-slate-200 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vulnerabilidad Sotillo</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-950 leading-none">{sotilloTotalDisabilities}</span>
                <span className="text-xs font-bold text-slate-400">Discapacidad</span>
              </div>
              <p className="text-[10px] font-bold text-amber-600 mt-1">
                {sotilloTotalElderly} Adultos Mayores (60+)
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis: Graphic Density + Highlight Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-slate-200 shadow-xs bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-black text-blue-900 uppercase tracking-widest">
                    Densidad de Pacientes por Comuna (21 Oficiales)
                  </CardTitle>
                  <Badge variant="outline" className="text-[9px] font-black bg-blue-50 text-blue-800 border-blue-200">
                    Base 21 Comunas
                  </Badge>
                </div>
                <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                  Carga demográfica comparativa • Haz clic en cualquier barra o fila para ver la nómina
                </CardDescription>
              </div>

              {/* Action buttons & View mode toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportCommuneDensityReportPdf(workers, recipes)}
                  disabled={workers.length === 0}
                  className="h-8 text-xs font-bold text-blue-900 border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Exportar documento oficial en PDF con el gráfico de barras comparativo de atención y personas por comuna"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>Exportar Gráfico de Barras (PDF)</span>
                </Button>

                <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-300/60">
                  <button
                    type="button"
                    onClick={() => setDensityViewMode('chart')}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                      densityViewMode === 'chart'
                        ? 'bg-white text-blue-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Gráfico
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensityViewMode('table')}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                      densityViewMode === 'table'
                        ? 'bg-white text-blue-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tabla
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {densityViewMode === 'chart' ? (
              <div className="h-[480px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={territoryStats} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <YAxis dataKey="name" type="category" fontSize={9} width={130} tickLine={false} axisLine={false} stroke="#64748b" className="font-sans font-bold uppercase" />
                    <Tooltip 
                      cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }} 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-lg text-xs">
                              <p className="font-black text-blue-950 uppercase">{data.name}</p>
                              <div className="mt-1.5 space-y-1 font-semibold text-slate-600">
                                <p className="text-blue-700 font-bold">👥 {data.workers} Ciudadanos censados</p>
                                <p className="text-indigo-600">💊 {data.meds} Fármacos asignados</p>
                                <p className="text-purple-600">♿ {data.aids} Ayudas humanas</p>
                                <p className="text-slate-900 font-bold border-t border-slate-100 pt-1 mt-1">📦 {data.meds + data.aids} Atenciones totales</p>
                              </div>
                              <p className="text-[9px] text-slate-400 mt-2 italic">Haz clic para abrir el censo detallado</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="workers" 
                      name="Pacientes" 
                      fill="#1e3a8a" 
                      radius={[0, 6, 6, 0]} 
                      barSize={16} 
                      className="cursor-pointer"
                      onClick={(data: any) => {
                        if (data && data.name) {
                          setSelectedCommune(data.name);
                        }
                      }}
                    >
                      {territoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#1e3a8a' : '#2563eb'} className="hover:opacity-80 transition-opacity cursor-pointer" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200 uppercase font-black text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 text-center">N°</th>
                      <th className="py-2.5 px-3">Comuna Oficial</th>
                      <th className="py-2.5 px-3 text-center">Personas (Censo)</th>
                      <th className="py-2.5 px-3 text-center">% Padrón</th>
                      <th className="py-2.5 px-3 text-center">Total Atenciones</th>
                      <th className="py-2.5 px-3 text-center">Fármacos</th>
                      <th className="py-2.5 px-3 text-center">Ayudas Humanas</th>
                      <th className="py-2.5 px-3">Densidad Visual</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {territoryStats.map((item, idx) => {
                      const maxW = territoryStats[0]?.workers || 1;
                      const barPct = Math.max(5, Math.round((item.workers / maxW) * 100));
                      const pctOfSotillo = sotilloWorkers.length > 0 ? ((item.workers / sotilloWorkers.length) * 100).toFixed(1) : "0.0";
                      const totalAids = item.meds + item.aids;

                      return (
                        <tr key={item.name} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-black text-slate-900 uppercase">{item.name}</td>
                          <td className="py-2 px-3 text-center font-black text-blue-950 tabular-nums">
                            {item.workers.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-500 font-bold tabular-nums">
                            {pctOfSotillo}%
                          </td>
                          <td className="py-2 px-3 text-center font-black text-indigo-900 tabular-nums">
                            {totalAids.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-center text-emerald-700 font-bold tabular-nums">
                            {item.meds.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-center text-purple-700 font-bold tabular-nums">
                            {item.aids.toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <div className="w-24 sm:w-28 bg-slate-200/70 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-700 rounded-full transition-all"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedCommune(item.name)}
                              className="h-7 px-2 text-[10px] font-bold text-blue-700 hover:bg-blue-100 rounded-lg cursor-pointer"
                            >
                              Ver Nómina
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Top Commune Card */}
          <Card 
            className="border border-blue-200 shadow-sm bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 text-white rounded-2xl overflow-hidden relative cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all group"
            onClick={() => topCommune && setSelectedCommune(topCommune.name)}
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users className="w-24 h-24 text-white" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-blue-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
                  Territorio con Mayor Carga
                </span>
                <span className="text-[9px] text-blue-300 flex items-center gap-1 group-hover:text-white transition-colors">
                  <Eye className="w-3 h-3" /> Ver Nómina
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-white group-hover:text-blue-200 transition-colors">
                {topCommune?.name || "N/A"}
              </h3>
              <p className="text-[10px] uppercase font-black text-blue-200 mt-3 flex items-center gap-1.5 bg-blue-800/40 w-fit px-2.5 py-1.5 rounded-full border border-blue-700/50 font-mono">
                <Activity className="w-3 h-3 text-emerald-400" /> 
                {topCommune ? ((topCommune.workers / (sotilloWorkers.length || 1)) * 100).toFixed(1) : 0}% de Sotillo ({topCommune?.workers} casos)
              </p>
            </CardContent>
          </Card>

          {/* Ranking Top Territories */}
          <Card className="border border-slate-200 shadow-xs bg-white rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-5">
              <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center justify-between">
                <span>Top Territorios con Casos</span>
                <span className="text-[9px] font-bold text-blue-600 normal-case">Clic para explorar</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[290px]">
              <div className="divide-y divide-slate-100">
                {territoryStats.slice(0, 8).map((stat) => (
                  <div 
                    key={stat.name} 
                    className="p-3.5 flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCommune(stat.name)}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-black text-slate-800 group-hover:text-blue-700 uppercase tracking-tight truncate transition-colors" title={stat.name}>
                        {stat.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">
                        {stat.workers} {stat.workers === 1 ? 'paciente' : 'pacientes'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-black bg-blue-50 text-blue-700 font-mono border border-blue-100 px-2 py-0.5 rounded-full shadow-2xs">
                        {((stat.workers / (sotilloWorkers.length || 1)) * 100).toFixed(0)}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Social Classification */}
          <Card className="border border-slate-200 shadow-xs bg-white rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-5">
              <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <span>🛡️</span> Áreas de Atención en Sotillo
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                Total de ciudadanos según su clasificación social
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[260px]">
              <div className="divide-y divide-slate-100">
                {classifications.map((item) => (
                  <div key={item.name} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-black text-blue-900 uppercase tracking-tight truncate leading-tight" title={item.name}>
                        {item.name === "NO_APLICA" ? "NINGUNO / NO APLICA" : item.name.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider leading-none">
                        {item.count} {item.count === 1 ? 'ciudadano' : 'ciudadanos'}
                      </p>
                    </div>
                    <span className="text-[10px] font-black bg-blue-900 text-white leading-none px-2 py-1 rounded-md shrink-0">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2. Territorial Directory with Segmented Fast Filters */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span>📊</span> Directorio Territorializado
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
              21 Comunas Constituidas de Sotillo • 1 Ítem de Atención Solidaria Foránea
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Buscar comuna..."
                value={searchCommune}
                onChange={(e) => setSearchCommune(e.target.value)}
                className="pl-8 text-xs h-8 rounded-xl border-slate-200 bg-slate-50/50"
              />
            </div>

            {/* Fast Segmented Filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
              <button
                onClick={() => setFilterMode("all")}
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === "all" ? "bg-white text-blue-950 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Todas (21+1)
              </button>
              <button
                onClick={() => setFilterMode("sotillo")}
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === "sotillo" ? "bg-white text-blue-950 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Comunas Sotillo (21)
              </button>
              <button
                onClick={() => setFilterMode("foreign")}
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === "foreign" ? "bg-white text-blue-950 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Solo Foráneos ({foreignWorkers.length})
              </button>
              <button
                onClick={() => setFilterMode("active")}
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === "active" ? "bg-white text-blue-950 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Con Casos ({activeSotilloCommunesCount})
              </button>
              <button
                onClick={() => setFilterMode("priority")}
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === "priority" ? "bg-white text-blue-950 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Alta Prioridad
              </button>
            </div>
          </div>
        </div>

        {/* 21 Municipal Communes Grid Cards (Shown unless "Solo Foráneos" is selected) */}
        {filterMode !== "foreign" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {filteredCommunes.map((commune) => {
              const normalized = commune.toUpperCase().trim();
              const count = sotilloCommuneCounts[normalized] || 0;
              const breakdown = communeSupportBreakdown[normalized] || { meds: 0, aids: 0, disabilities: 0, elderly: 0 };
              const activity = communeLastActivity[normalized] || { date: null, daysAgo: null, isPendingVisit: false };
              const hasData = count > 0;

              return (
                <Card 
                  key={commune} 
                  className={`border transition-all rounded-xl overflow-hidden group relative flex flex-col justify-between ${
                    activity.isPendingVisit
                      ? "bg-amber-50/40 border-amber-300 hover:border-amber-500 hover:shadow-md"
                      : hasData 
                        ? "bg-white border-slate-200 hover:border-blue-500 hover:shadow-md" 
                        : "bg-slate-50/60 border-slate-200/60 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div 
                    className="p-3.5 cursor-pointer flex-1"
                    onClick={() => setSelectedCommune(commune)}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        activity.isPendingVisit
                          ? "bg-amber-100 text-amber-800"
                          : hasData 
                            ? "bg-blue-50 text-blue-700 group-hover:bg-blue-900 group-hover:text-white" 
                            : "bg-slate-100 text-slate-400"
                      }`}>
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className={`font-mono text-[11px] font-bold leading-none px-2 py-0.5 rounded-md ${
                        hasData ? "bg-blue-50 text-blue-800 font-black border border-blue-100" : "bg-slate-100 text-slate-400"
                      }`}>
                        {count} {count === 1 ? 'cargado' : 'cargados'}
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <p 
                        className="text-[10.5px] font-black uppercase text-slate-800 group-hover:text-blue-900 tracking-tight leading-tight line-clamp-2" 
                        title={commune}
                      >
                        {commune}
                      </p>

                      {/* Ayudas Entregadas Totales and Desglose */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase text-indigo-950 bg-indigo-50/70 border border-indigo-100/80 px-2 py-1 rounded-md">
                          <span>Ayudas:</span>
                          <span className="font-mono text-indigo-700 font-black">{breakdown.total} entregadas</span>
                        </div>

                        {breakdown.total > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap mt-1.5">
                            {breakdown.meds > 0 && (
                              <span className="text-[7.5px] font-black bg-indigo-50/50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Pill className="w-2.5 h-2.5" /> {breakdown.meds} fár.
                              </span>
                            )}
                            {breakdown.aids > 0 && (
                              <span className="text-[7.5px] font-black bg-purple-50/50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                ♿ {breakdown.aids} ayud.
                              </span>
                            )}
                            <span className="text-[7.5px] font-bold text-slate-400 ml-auto font-mono">
                              ({breakdown.avg}/pers)
                            </span>
                          </div>
                        ) : (
                          <p className="text-[7.5px] font-semibold text-slate-400 mt-1">
                            Sin ayudas despachadas
                          </p>
                        )}
                      </div>

                      {/* 6. Historial de Abordajes y Última Jornada */}
                      <div className="mt-2 pt-1 border-t border-slate-100/80">
                        {activity.isPendingVisit ? (
                          <div className="text-[8px] font-black text-amber-700 bg-amber-100/70 border border-amber-300/80 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Visita Pendiente (+45d)</span>
                          </div>
                        ) : activity.daysAgo !== null && count > 0 ? (
                          <div className="text-[8px] font-semibold text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>Visita: {activity.daysAgo === 0 ? "hoy" : `hace ${activity.daysAgo}d`}</span>
                          </div>
                        ) : (
                          <span className="text-[7.5px] font-medium text-slate-400">Sin abordajes</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                    <button
                      onClick={() => setSelectedCommune(commune)}
                      className="text-[8.5px] font-black uppercase text-blue-700 hover:text-blue-950 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Ver nómina</span>
                      <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {hasData && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const communeWorkers = sotilloWorkers.filter(
                            w => (w.commune || '').trim().toUpperCase() === normalized
                          );
                          exportCommunePdf(commune, communeWorkers, recipes);
                        }}
                        className="text-[8px] font-bold text-slate-400 hover:text-blue-700 flex items-center gap-0.5 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Descargar PDF de esta comuna directamente"
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {filteredCommunes.length === 0 && filterMode !== "foreign" && (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-black uppercase text-slate-600">No se encontraron comunas con el filtro aplicado</p>
            <p className="text-[10px] text-slate-400 mt-1">Intenta con otro término de búsqueda o selecciona &quot;Todas&quot;</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchCommune("");
                setFilterMode("all");
              }}
              className="mt-3 text-xs font-bold"
            >
              Restablecer Filtros
            </Button>
          </div>
        )}

        {/* 1. Módulo Anexo Diferenciado para Casos Foráneos (Extensión Institucional) */}
        {(filterMode === "all" || filterMode === "foreign") && (
          <div className="pt-4">
            <Card className="border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950 text-white rounded-2xl overflow-hidden shadow-md">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5">
                        <Compass className="w-3 h-3 mr-1 text-amber-400" />
                        Atención Solidaria Extramunicipal
                      </Badge>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Extensión Institucional • Juan Antonio Sotillo
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                      <span>Casos Foráneos y Otros Municipios</span>
                      <span className="text-xs font-mono bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded-full border border-blue-700/50">
                        {foreignWorkers.length} registrados
                      </span>
                    </h4>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Ciudadanos con residencia fuera del Municipio Sotillo (Simón Bolívar, Guanta, Diego Bautista Urbaneja, entre otros) o en tránsito, que han recibido atención médica, fármacos o ayudas humanas a través de la Dirección de Bienestar Social.
                    </p>

                    {/* Mini Stats Strip inside the Foreign Module */}
                    <div className="flex items-center gap-3 flex-wrap pt-2">
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl">
                        <p className="text-[8.5px] font-bold text-slate-400 uppercase">Personas Cargadas</p>
                        <p className="text-sm font-black text-white font-mono">{foreignStats.count}</p>
                      </div>
                      <div className="bg-slate-800/80 border border-indigo-500/40 px-3 py-1.5 rounded-xl">
                        <p className="text-[8.5px] font-bold text-indigo-300 uppercase">Ayudas Entregadas</p>
                        <p className="text-sm font-black text-indigo-200 font-mono">{foreignStats.total}</p>
                      </div>
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl">
                        <p className="text-[8.5px] font-bold text-slate-400 uppercase">💊 Fármacos</p>
                        <p className="text-sm font-black text-emerald-300 font-mono">{foreignStats.meds}</p>
                      </div>
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl">
                        <p className="text-[8.5px] font-bold text-slate-400 uppercase">♿ Ayudas Técn./Soc.</p>
                        <p className="text-sm font-black text-purple-300 font-mono">{foreignStats.aids}</p>
                      </div>
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl">
                        <p className="text-[8.5px] font-bold text-slate-400 uppercase">Promedio</p>
                        <p className="text-sm font-black text-amber-300 font-mono">
                          {foreignStats.avg} ay/pers
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Foreign Cases */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
                    <Button
                      onClick={() => setSelectedCommune(OTHER_COMMUNE_OPTION)}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Nómina Foránea</span>
                    </Button>
                    <Button
                      onClick={() => exportCommunePdf(OTHER_COMMUNE_OPTION, foreignWorkers, recipes)}
                      disabled={foreignWorkers.length === 0}
                      variant="outline"
                      className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-600 text-xs font-black uppercase px-4 py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-300" />
                      <span>Descargar PDF Foráneos</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal de Detalle Territorial de Ciudadanos por Comuna o Foráneos */}
      <CommunePatientsModal
        commune={selectedCommune}
        isOpen={!!selectedCommune}
        onClose={() => setSelectedCommune(null)}
        workers={workers}
      />
    </div>
  );
}
