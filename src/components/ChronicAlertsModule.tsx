import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  HeartPulse, 
  Timer, 
  Clock, 
  Pill, 
  Users, 
  Download, 
  Search, 
  MessageCircle, 
  CheckCircle, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  MapPin, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  FileSpreadsheet, 
  FileText,
  Filter,
  Layers,
  ArrowRight
} from "lucide-react";
import { dataService } from "@/lib/dataService";
import { Worker, MedicationRecipe, MedicalHistory } from "@/types";
import { useAuth } from "../contexts/AuthContext";
import { 
  calculateChronicPatientAlerts, 
  calculateChronicProcurementList, 
  ChronicPatientAlert, 
  ChronicAlertsSummary, 
  ChronicProcurementItem 
} from "@/utils/chronicAlertsUtils";
import { 
  formatVenezuelanPhoneForWhatsApp, 
  OFFICIAL_WHATSAPP_TEMPLATES, 
  interpolateWhatsAppMessage, 
  buildWhatsAppLink 
} from "@/utils/whatsappUtils";
import { generateProcurementOrderPdf } from "@/utils/chronicProcurementPdf";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function ChronicAlertsModule() {
  const { user, isAdmin } = useAuth();
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [medicalHistories, setMedicalHistories] = useState<MedicalHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Selector de Vista Principal
  const [activeModuleTab, setActiveModuleTab] = useState<'procurement_list' | 'nominal_alerts' | 'standardized_catalog'>('procurement_list');

  // Estado para la Vista 1: Consolidado de Fármacos a Solicitar
  const [procurementScope, setProcurementScope] = useState<'immediate' | 'all'>('immediate');
  const [procurementSearch, setProcurementSearch] = useState("");
  const [selectedProcurementItem, setSelectedProcurementItem] = useState<ChronicProcurementItem | null>(null);

  // Estado para la Vista 3: Auditoría y Estatus de Presentaciones
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogConditionFilter, setCatalogConditionFilter] = useState<'all' | 'hipertension' | 'diabetes' | 'regular_med'>('all');

  // Estado para la Vista 2: Semáforo Nominal de Pacientes
  const [chronicFilter, setChronicFilter] = useState<'all' | 'overdue' | 'expiring_soon' | 'active'>('all');
  const [nominalSearch, setNominalSearch] = useState("");
  const [nominalCommuneFilter, setNominalCommuneFilter] = useState("all");
  const [nominalPage, setNominalPage] = useState(1);
  const [nominalPageSize, setNominalPageSize] = useState(25);
  const [isQuickDispatching, setIsQuickDispatching] = useState<string | null>(null);
  const nominalTableRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recipesData, workersData, historiesData] = await Promise.all([
        dataService.getMedicationRecipes(),
        dataService.getWorkers(),
        dataService.getAllMedicalHistories()
      ]);
      setRecipes(recipesData);
      setWorkers(workersData);
      setMedicalHistories(historiesData);
    } catch (error) {
      console.error("Error cargando datos de reposición:", error);
      toast.error("Error al cargar los datos del sistema");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Cálculo de Alertas Individuales
  const chronicSummary: ChronicAlertsSummary = useMemo(() => {
    return calculateChronicPatientAlerts(workers, recipes, medicalHistories);
  }, [workers, recipes, medicalHistories]);

  // 2. Cálculo del Consolidado de Fármacos a Solicitar
  const procurementList: ChronicProcurementItem[] = useMemo(() => {
    return calculateChronicProcurementList(chronicSummary.alerts);
  }, [chronicSummary.alerts]);

  // 3. Fármacos filtrados para la Vista 1
  const filteredProcurementList = useMemo(() => {
    return procurementList.filter(item => {
      // Filtrar por término de búsqueda
      if (procurementSearch) {
        const term = procurementSearch.toLowerCase().trim();
        const matchName = item.medicationName.toLowerCase().includes(term);
        const matchPres = item.presentation.toLowerCase().includes(term);
        if (!matchName && !matchPres) return false;
      }
      // Si el alcance es inmediato, omitir ítems que no tengan demanda crítica
      if (procurementScope === 'immediate' && item.criticalPatientsCount === 0) {
        return false;
      }
      return true;
    });
  }, [procurementList, procurementSearch, procurementScope]);

  // Unidades totales a solicitar en la vista actual
  const totalUnitsToOrder = useMemo(() => {
    return filteredProcurementList.reduce((acc, item) => {
      return acc + (procurementScope === 'immediate' ? item.immediateRequiredUnits : item.monthlyProjectedUnits);
    }, 0);
  }, [filteredProcurementList, procurementScope]);

  const totalPatientsInOrder = useMemo(() => {
    return filteredProcurementList.reduce((acc, item) => {
      return acc + (procurementScope === 'immediate' ? item.criticalPatientsCount : item.totalPatientsCount);
    }, 0);
  }, [filteredProcurementList, procurementScope]);

  // Fármacos para la Vista 3: Auditoría y Estatus de Presentaciones
  const filteredCatalogList = useMemo(() => {
    return procurementList.filter(item => {
      if (catalogConditionFilter !== 'all' && item.conditionType !== catalogConditionFilter) {
        return false;
      }
      if (catalogSearch) {
        const term = catalogSearch.toLowerCase().trim();
        const matchName = item.medicationName.toLowerCase().includes(term);
        const matchPres = item.presentation.toLowerCase().includes(term);
        if (!matchName && !matchPres) return false;
      }
      return true;
    });
  }, [procurementList, catalogConditionFilter, catalogSearch]);

  // 4. Lista Nominal Filtrada para la Vista 2
  const filteredNominalAlerts = useMemo(() => {
    return chronicSummary.alerts.filter(alert => {
      if (chronicFilter === 'overdue' && alert.status !== 'overdue') return false;
      if (chronicFilter === 'expiring_soon' && alert.status !== 'expiring_soon') return false;
      if (chronicFilter === 'active' && alert.status !== 'active') return false;

      if (nominalCommuneFilter !== 'all' && alert.commune !== nominalCommuneFilter) return false;

      if (nominalSearch) {
        const term = nominalSearch.toLowerCase().trim();
        const cleanDigits = term.replace(/[^0-9]/g, '');
        const dniDigits = alert.dni.replace(/[^0-9]/g, '');

        const matchName = alert.fullName.toLowerCase().includes(term);
        const matchDni = alert.dni.toLowerCase().includes(term) || (cleanDigits && dniDigits.includes(cleanDigits));
        const matchMed = alert.medicationName.toLowerCase().includes(term);
        const matchCom = alert.commune.toLowerCase().includes(term);
        const matchSec = alert.sector.toLowerCase().includes(term);

        if (!matchName && !matchDni && !matchMed && !matchCom && !matchSec) return false;
      }

      return true;
    });
  }, [chronicSummary.alerts, chronicFilter, nominalCommuneFilter, nominalSearch]);

  const totalNominalPages = Math.max(1, Math.ceil(filteredNominalAlerts.length / nominalPageSize));
  const paginatedNominalAlerts = useMemo(() => {
    const start = (nominalPage - 1) * nominalPageSize;
    return filteredNominalAlerts.slice(start, start + nominalPageSize);
  }, [filteredNominalAlerts, nominalPage, nominalPageSize]);

  const uniqueCommunes = useMemo(() => {
    const set = new Set<string>();
    chronicSummary.alerts.forEach(a => {
      if (a.commune) set.add(a.commune);
    });
    return Array.from(set).sort();
  }, [chronicSummary.alerts]);

  useEffect(() => {
    setNominalPage(1);
  }, [chronicFilter, nominalCommuneFilter, nominalSearch, nominalPageSize]);

  useEffect(() => {
    if (nominalTableRef.current) {
      nominalTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [nominalPage]);

  // Acciones: WhatsApp Directo
  const handleSendWhatsAppNotification = (alert: ChronicPatientAlert) => {
    if (!alert.isPhoneValid) {
      toast.error(`El paciente ${alert.fullName} no cuenta con un número celular válido registrado.`);
      return;
    }
    const template = OFFICIAL_WHATSAPP_TEMPLATES.find(t => t.id === 'notificacion_reposicion_cronica') || OFFICIAL_WHATSAPP_TEMPLATES[0];
    const message = interpolateWhatsAppMessage(template.content, {
      nombre: alert.fullName,
      cedula: alert.dni,
      beneficio: `${alert.medicationName} (${alert.daysElapsed} días transcurridos)`,
      comuna: alert.commune,
      sector: alert.sector,
      fecha: "Convocatoria Inmediata para Reposición de Fármacos Crónicos (Lunes a Viernes 8:00 AM a 2:00 PM)",
      alcalde: "Prof. Jesús Marcano Tábata",
      primeraDama: "Ing. Yohana Estaba de Marcano"
    });
    const link = buildWhatsAppLink(alert.phoneFormatted, message);
    window.open(link, '_blank', 'noopener,noreferrer');
    toast.success(`WhatsApp preparado para convocar a ${alert.fullName}`);
  };

  // Acciones: Despacho Rápido de 30 Días
  const handleQuickDispatch = async (alert: ChronicPatientAlert) => {
    if (!isAdmin) {
      toast.error("Permiso denegado: Solo administradores de farmacia pueden registrar despachos.");
      return;
    }
    setIsQuickDispatching(alert.workerId);
    try {
      toast.loading(`Registrando nuevo ciclo mensual para ${alert.fullName}...`);
      const nowIso = new Date().toISOString();
      await dataService.addMedicationRecipe({
        workerId: alert.workerId,
        medication: alert.medicationName,
        presentation: alert.lastRecipePresentation || "Tabletas / Tratamiento Continuo",
        dosage: "1 dosis diaria según prescripción facultativa",
        quantity: alert.lastRecipeQuantity || 1,
        frequency: "Tratamiento de Mantenimiento Continuo (Ciclo 30 Días)",
        duration: "30 Días",
        category: 'medication',
        status: 'delivered',
        deliveredAt: nowIso as any,
        deliveredBy: user?.displayName || user?.email || 'Farmacia Municipal Sotillo',
        deliveryNotes: `Reposición de Ciclo de 30 Días. Diagnóstico: ${
          alert.conditionType === 'hipertension' 
            ? 'Hipertensión Arterial Crónica' 
            : alert.conditionType === 'diabetes' 
              ? 'Diabetes Mellitus' 
              : 'Tratamiento Crónico Regular'
        }`,
        isUrgent: false,
        commune: alert.commune,
      });
      toast.dismiss();
      toast.success(`¡Ciclo de 30 días renovado para ${alert.fullName}! El semáforo ha vuelto a verde (0 días).`);
      await fetchData();
    } catch (error) {
      toast.dismiss();
      console.error("Error al registrar despacho:", error);
      toast.error("Ocurrió un error al registrar el nuevo ciclo.");
    } finally {
      setIsQuickDispatching(null);
    }
  };

  // Exportar Orden Oficial en PDF
  const handleDownloadProcurementPdf = () => {
    if (filteredProcurementList.length === 0) {
      toast.error("No hay medicamentos en la lista con los filtros seleccionados");
      return;
    }
    try {
      generateProcurementOrderPdf(filteredProcurementList, procurementScope);
      toast.success("Orden Oficial de Adquisición PDF generada con éxito");
    } catch (error) {
      console.error("Error generando PDF de adquisición:", error);
      toast.error("Error al generar el documento PDF");
    }
  };

  // Exportar Consolidado a CSV
  const handleExportProcurementCsv = () => {
    if (filteredProcurementList.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const headers = [
      "Fármaco / Principio Activo",
      "Presentación",
      "Condición Base",
      "Pacientes Vencidos (≥30d)",
      "Pacientes Próximos (25-29d)",
      "Pacientes al Día (<25d)",
      "Total Pacientes",
      "Cantidad a Solicitar Inmediata",
      "Cantidad Mensual Proyectada 100%"
    ];
    const rows = filteredProcurementList.map(item => [
      `"${item.medicationName.replace(/"/g, '""')}"`,
      `"${item.presentation.replace(/"/g, '""')}"`,
      `"${item.conditionType}"`,
      item.overduePatientsCount,
      item.expiringSoonPatientsCount,
      item.activePatientsCount,
      item.totalPatientsCount,
      item.immediateRequiredUnits,
      item.monthlyProjectedUnits
    ].join(';'));

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Plan_Adquisicion_Farmacos_${procurementScope}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exportados ${filteredProcurementList.length} medicamentos a CSV`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-blue-900 animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Analizando Ciclos de Reposición y Demandas de Fármacos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 1. Encabezado del Módulo con Identidad Municipal */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 sm:p-7 text-white shadow-lg border border-blue-900/50 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30 shadow-inner">
                <HeartPulse className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                  Semáforo y Reposición de Fármacos Crónicos
                </h1>
                <p className="text-[11px] font-bold text-cyan-300 uppercase tracking-widest">
                  Control de Ciclo de 30 Días &bull; Demanda y Adquisición Centralizada
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              Supervisión de tratamientos permanentes para hipertensión, diabetes y condiciones de uso continuo en las 9 comunas del Municipio Sotillo. Programa de Protección Social impulsado por el <strong className="text-amber-300 font-bold">Prof. Jesús Marcano Tábata</strong> (Alcalde) y la <strong className="text-amber-300 font-bold">Ing. Yohana Estaba de Marcano</strong> (Primera Dama).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto">
            <Button
              onClick={handleDownloadProcurementPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider h-11 px-5 rounded-xl shadow-md gap-2 cursor-pointer flex-1 lg:flex-none"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>Orden Oficial PDF</span>
            </Button>
            <Button
              onClick={handleExportProcurementCsv}
              variant="outline"
              className="border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider h-11 px-4 rounded-xl gap-2 cursor-pointer flex-1 lg:flex-none"
            >
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              <span>Exportar Excel</span>
            </Button>
          </div>
        </div>

        {/* 4 Tarjetas de Métricas de Alto Impacto */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-800/80">
          {/* Card 1: Vencidos */}
          <div 
            onClick={() => {
              setActiveModuleTab('nominal_alerts');
              setChronicFilter('overdue');
            }}
            className="p-4 rounded-xl bg-slate-900/80 border border-rose-500/30 hover:border-rose-400 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">Vencidos (≥ 30d)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            </div>
            <div className="text-3xl font-black text-rose-400 mt-1 tabular-nums">
              {chronicSummary.overdueCount}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Requieren reposición inmediata</p>
          </div>

          {/* Card 2: Próximos */}
          <div 
            onClick={() => {
              setActiveModuleTab('nominal_alerts');
              setChronicFilter('expiring_soon');
            }}
            className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 hover:border-amber-400 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">Próximos (25-29d)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-400 mt-1 tabular-nums">
              {chronicSummary.expiringSoonCount}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Vencen en menos de 5 días</p>
          </div>

          {/* Card 3: Al Día */}
          <div 
            onClick={() => {
              setActiveModuleTab('nominal_alerts');
              setChronicFilter('active');
            }}
            className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 hover:border-emerald-400 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Al Día (&lt; 25d)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-1 tabular-nums">
              {chronicSummary.activeCount}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Con suministro vigente</p>
          </div>

          {/* Card 4: Demanda Calculada de Fármacos */}
          <div 
            onClick={() => setActiveModuleTab('procurement_list')}
            className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Demanda a Solicitar</span>
              <Pill className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-cyan-300 mt-1 tabular-nums">
              {totalUnitsToOrder.toLocaleString('es-VE')} <span className="text-xs font-bold text-slate-400">un.</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Para {totalPatientsInOrder} pacientes en espera</p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Selección de Vista Principal */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <Button
          variant={activeModuleTab === 'procurement_list' ? 'default' : 'outline'}
          onClick={() => setActiveModuleTab('procurement_list')}
          className={`h-11 px-5 rounded-xl font-black text-xs uppercase tracking-wider gap-2 transition-all cursor-pointer ${
            activeModuleTab === 'procurement_list'
              ? 'bg-blue-900 text-white shadow-md'
              : 'text-slate-600 border-slate-300 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>1. Fármacos y Cantidades a Solicitar (Plan de Compra)</span>
          <Badge className="bg-cyan-500/20 text-cyan-900 border border-cyan-300/40 text-[10px] font-black px-1.5 py-0 ml-1">
            {filteredProcurementList.length}
          </Badge>
        </Button>

        <Button
          variant={activeModuleTab === 'nominal_alerts' ? 'default' : 'outline'}
          onClick={() => setActiveModuleTab('nominal_alerts')}
          className={`h-11 px-5 rounded-xl font-black text-xs uppercase tracking-wider gap-2 transition-all cursor-pointer ${
            activeModuleTab === 'nominal_alerts'
              ? 'bg-blue-900 text-white shadow-md'
              : 'text-slate-600 border-slate-300 hover:bg-slate-100'
          }`}
        >
          <Timer className="w-4 h-4 text-rose-400" />
          <span>2. Semáforo Nominal de Pacientes y WhatsApp</span>
          {chronicSummary.overdueCount > 0 ? (
            <Badge className="bg-rose-600 text-white font-black text-[10px] px-1.5 py-0 ml-1 animate-pulse">
              {chronicSummary.overdueCount} vencidos
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-600 text-[10px] font-bold px-1.5 py-0 ml-1">
              {chronicSummary.totalMonitored}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeModuleTab === 'standardized_catalog' ? 'default' : 'outline'}
          onClick={() => setActiveModuleTab('standardized_catalog')}
          className={`h-11 px-5 rounded-xl font-black text-xs uppercase tracking-wider gap-2 transition-all cursor-pointer ${
            activeModuleTab === 'standardized_catalog'
              ? 'bg-blue-900 text-white shadow-md'
              : 'text-slate-600 border-slate-300 hover:bg-slate-100'
          }`}
        >
          <Pill className="w-4 h-4 text-emerald-400" />
          <span>3. Estatus y Unificación de Presentaciones</span>
          <Badge className="bg-emerald-500/20 text-emerald-900 border border-emerald-300/40 text-[10px] font-black px-1.5 py-0 ml-1">
            {procurementList.length}
          </Badge>
        </Button>
      </div>

      {/* VISTA 1: PLAN DE COMPRA Y CONSOLIDADO DE FÁRMACOS A SOLICITAR */}
      {activeModuleTab === 'procurement_list' && (
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-black uppercase tracking-wider text-blue-950 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-700" />
                  Listado Consolidado de Fármacos con Cantidades Totales a Solicitar
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium mt-0.5">
                  Cantidades calculadas a partir de las dosis mensuales requeridas por cada paciente para el abastecimiento oportuno.
                </CardDescription>
              </div>

              {/* Selector de Criterio de Cálculo */}
              <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setProcurementScope('immediate')}
                  className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${
                    procurementScope === 'immediate'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Totaliza los fármacos de pacientes con ciclo vencido (≥30d) o en ventana crítica (25-29d)"
                >
                  Ventana Crítica (Vencidos + Próximos)
                </button>
                <button
                  type="button"
                  onClick={() => setProcurementScope('all')}
                  className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${
                    procurementScope === 'all'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Totaliza el 100% de la demanda mensual proyectada para todos los pacientes crónicos censados"
                >
                  Proyección Mensual Total (100% Censo)
                </button>
              </div>
            </div>

            {/* Buscador de Medicamentos */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Filtrar por principio activo o presentación (ej. Losartán, Enalapril)..."
                  value={procurementSearch}
                  onChange={(e) => setProcurementSearch(e.target.value)}
                  className="pl-9 h-10 text-xs border-slate-300 rounded-xl bg-white"
                />
                {procurementSearch && (
                  <button 
                    onClick={() => setProcurementSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="ml-auto text-xs font-bold text-slate-600 hidden sm:block">
                Mostrando <strong className="text-blue-950 font-black">{filteredProcurementList.length}</strong> principios activos requeridos
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-100/70 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5 w-12 text-center">
                    #
                  </TableHead>
                  <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                    Fármaco / Principio Activo
                  </TableHead>
                  <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                    Presentación
                  </TableHead>
                  <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                    Patología Base
                  </TableHead>
                  <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5 text-center">
                    Pacientes en Espera
                  </TableHead>
                  <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5 text-right">
                    Cantidad a Solicitar ({procurementScope === 'immediate' ? 'Inmediata' : 'Mensual'})
                  </TableHead>
                  <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5 text-center">
                    Desglose Nominal
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcurementList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        <p className="text-sm font-bold text-slate-700">No hay fármacos pendientes de reposición con los filtros seleccionados</p>
                        <p className="text-xs text-slate-500">Todos los pacientes crónicos se encuentran al día en este momento.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProcurementList.map((item, idx) => {
                    const requiredUnits = procurementScope === 'immediate' ? item.immediateRequiredUnits : item.monthlyProjectedUnits;
                    const relevantPatientsCount = procurementScope === 'immediate' ? item.criticalPatientsCount : item.totalPatientsCount;

                    return (
                      <TableRow key={item.medicationKey} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                        <TableCell className="text-center font-bold text-xs text-slate-400 py-3">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="font-black text-xs text-slate-900 uppercase">
                            {item.medicationName}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs text-slate-600 font-medium">
                            {item.presentation}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          {item.conditionType === 'hipertension' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                              <HeartPulse className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              Hipertensión Arterial
                            </span>
                          ) : item.conditionType === 'diabetes' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                              <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              Diabetes Mellitus
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700">
                              <Pill className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              Uso Continuo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="tabular-nums font-black text-blue-950">{relevantPatientsCount}</span>
                            <span className="text-slate-400 font-medium">personas</span>
                          </div>
                          {item.overduePatientsCount > 0 && (
                            <div className="text-[10px] text-rose-600 font-bold">
                              ({item.overduePatientsCount} vencidos)
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="text-sm font-black text-rose-600 tabular-nums">
                            {requiredUnits.toLocaleString('es-VE')} <span className="text-xs text-slate-500 font-normal">unidades</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Para ciclo de 30 días
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedProcurementItem(item)}
                            className="h-8 px-3 text-[10px] font-black uppercase text-blue-900 border-blue-300 hover:bg-blue-50 rounded-lg gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Users className="w-3.5 h-3.5 text-blue-700" />
                            <span>Ver Pacientes ({item.patients.length})</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* VISTA 2: SEMÁFORO NOMINAL DE PACIENTES Y CONVOCATORIA WHATSAPP */}
      {activeModuleTab === 'nominal_alerts' && (
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-black uppercase tracking-wider text-blue-950 flex items-center gap-2">
                  <Timer className="w-5 h-5 text-rose-600" />
                  Semáforo Nominal y Convocatoria de Pacientes (Ciclo de 30 Días)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium mt-0.5">
                  Monitoreo de tiempo transcurrido desde el último retiro y citación oficial personalizada.
                </CardDescription>
              </div>

              {/* Botones de Filtro Rápido */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant={chronicFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChronicFilter('all')}
                  className={`h-9 text-xs font-bold uppercase rounded-lg ${
                    chronicFilter === 'all' ? 'bg-blue-900 text-white' : 'text-slate-600 border-slate-300'
                  }`}
                >
                  Todos ({chronicSummary.totalMonitored})
                </Button>
                <Button
                  variant={chronicFilter === 'overdue' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChronicFilter('overdue')}
                  className={`h-9 text-xs font-bold uppercase rounded-lg ${
                    chronicFilter === 'overdue' 
                      ? 'bg-rose-600 text-white hover:bg-rose-700' 
                      : 'text-rose-700 border-rose-200 bg-rose-50/60 hover:bg-rose-100'
                  }`}
                >
                  🔴 Vencidos ({chronicSummary.overdueCount})
                </Button>
                <Button
                  variant={chronicFilter === 'expiring_soon' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChronicFilter('expiring_soon')}
                  className={`h-9 text-xs font-bold uppercase rounded-lg ${
                    chronicFilter === 'expiring_soon' 
                      ? 'bg-amber-600 text-white hover:bg-amber-700' 
                      : 'text-amber-700 border-amber-200 bg-amber-50/60 hover:bg-amber-100'
                  }`}
                >
                  🟡 Próximos ({chronicSummary.expiringSoonCount})
                </Button>
                <Button
                  variant={chronicFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChronicFilter('active')}
                  className={`h-9 text-xs font-bold uppercase rounded-lg ${
                    chronicFilter === 'active' 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                      : 'text-emerald-700 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100'
                  }`}
                >
                  🟢 Al Día ({chronicSummary.activeCount})
                </Button>
              </div>
            </div>

            {/* Buscador y Filtro de Comuna */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar por cédula, nombre de paciente, medicamento o sector..."
                  value={nominalSearch}
                  onChange={(e) => setNominalSearch(e.target.value)}
                  className="pl-9 h-10 text-xs border-slate-300 rounded-xl bg-white"
                />
                {nominalSearch && (
                  <button 
                    onClick={() => setNominalSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <Select value={nominalCommuneFilter} onValueChange={setNominalCommuneFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-10 text-xs border-slate-300 rounded-xl font-medium shrink-0 bg-white">
                  <SelectValue placeholder="Comuna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Comunas</SelectItem>
                  {uniqueCommunes.map(comm => (
                    <SelectItem key={comm} value={comm}>{comm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div ref={nominalTableRef}>
              <Table>
                <TableHeader className="bg-slate-100/70 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                      Paciente / Cédula
                    </TableHead>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                      Comuna y Sector
                    </TableHead>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                      Patología
                    </TableHead>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                      Fármaco Prescrito
                    </TableHead>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5 text-center">
                      Última Entrega
                    </TableHead>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5 text-center">
                      Estado del Semáforo
                    </TableHead>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5">
                      Contacto WhatsApp
                    </TableHead>
                    <TableHead className="font-black text-[10px] text-blue-950 uppercase tracking-wider py-3.5 text-right">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNominalAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                          <Clock className="w-10 h-10 text-slate-300" />
                          <p className="text-sm font-bold text-slate-700">No se encontraron pacientes con los filtros seleccionados</p>
                          <p className="text-xs text-slate-500">Pruebe modificando el término de búsqueda o el filtro de estado.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedNominalAlerts.map(alert => {
                      const isOverdue = alert.status === 'overdue';
                      const isExpiringSoon = alert.status === 'expiring_soon';

                      return (
                        <TableRow 
                          key={`${alert.workerId}-${alert.lastRecipeId}`}
                          className={`border-b border-slate-100 transition-colors ${
                            isOverdue 
                              ? 'bg-rose-50/40 hover:bg-rose-50/70' 
                              : isExpiringSoon 
                                ? 'bg-amber-50/30 hover:bg-amber-50/60' 
                                : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <TableCell className="py-3">
                            <div className="flex items-start gap-2.5">
                              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                isOverdue ? 'bg-rose-100 text-rose-700' : isExpiringSoon ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-800'
                              }`}>
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-black text-xs text-slate-900 uppercase">
                                  {alert.fullName}
                                </div>
                                <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>C.I. {alert.dni}</span>
                                  {alert.representativeName && (
                                    <span className="text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded text-[9px] font-bold">
                                      Rep: {alert.representativeName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            <div className="text-xs font-bold text-slate-800">
                              {alert.commune}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{alert.sector}</span>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            {alert.conditionType === 'hipertension' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700">
                                <HeartPulse className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                Hipertensión
                              </span>
                            ) : alert.conditionType === 'diabetes' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700">
                                <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                Diabetes
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                <Pill className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                Uso Continuo
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="py-3">
                            <div className="font-bold text-xs text-blue-950">
                              {alert.medicationName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {alert.lastRecipePresentation} • Cant: {alert.lastRecipeQuantity}
                            </div>
                          </TableCell>

                          <TableCell className="py-3 text-center">
                            <div className="text-xs font-bold text-slate-800">
                              {alert.lastDeliveredFormatted}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              {alert.daysElapsed === 0 ? 'Hoy' : `Hace ${alert.daysElapsed} días`}
                            </div>
                          </TableCell>

                          <TableCell className="py-3 text-center">
                            {isOverdue ? (
                              <div className="inline-flex flex-col items-center">
                                <Badge className="bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 shadow-2xs">
                                  🔴 VENCIDO ({alert.daysElapsed}d)
                                </Badge>
                                <span className="text-[9px] font-bold text-rose-700 mt-0.5">
                                  +{alert.daysElapsed - 30} días de retraso
                                </span>
                              </div>
                            ) : isExpiringSoon ? (
                              <div className="inline-flex flex-col items-center">
                                <Badge className="bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 shadow-2xs">
                                  🟡 PRÓXIMO ({alert.daysElapsed}d)
                                </Badge>
                                <span className="text-[9px] font-bold text-amber-800 mt-0.5">
                                  Faltan {alert.daysRemaining} días
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center">
                                <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5">
                                  🟢 AL DÍA ({alert.daysElapsed}d)
                                </Badge>
                                <span className="text-[9px] font-medium text-emerald-800 mt-0.5">
                                  Restan {alert.daysRemaining} días
                                </span>
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-3">
                            {alert.isPhoneValid ? (
                              <div className="space-y-0.5">
                                <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  {alert.phone}
                                </span>
                                <span className="text-[9px] font-medium text-slate-400 block">
                                  +{alert.phoneFormatted}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic block">
                                {alert.phone ? alert.phone : "Sin celular"}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!alert.isPhoneValid}
                                onClick={() => handleSendWhatsAppNotification(alert)}
                                className="h-8 px-2.5 text-[10px] font-black border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg gap-1 shadow-2xs cursor-pointer"
                                title="Enviar convocatoria oficial por WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Notificar</span>
                              </Button>

                              {isAdmin && (
                                <Button
                                  size="sm"
                                  disabled={isQuickDispatching === alert.workerId}
                                  onClick={() => handleQuickDispatch(alert)}
                                  className="h-8 px-2.5 text-[10px] font-black bg-blue-900 hover:bg-blue-950 text-white rounded-lg gap-1 shadow-xs cursor-pointer"
                                  title="Registrar entrega mensual y reiniciar temporizador a 0 días"
                                >
                                  {isQuickDispatching === alert.workerId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  )}
                                  <span>+ Despachar Mes</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación Nominal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-200 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Mostrando {paginatedNominalAlerts.length} de {filteredNominalAlerts.length} pacientes</span>
                <Select 
                  value={nominalPageSize.toString()} 
                  onValueChange={(val) => setNominalPageSize(Number(val))}
                >
                  <SelectTrigger className="h-8 w-24 text-xs border-slate-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / pág</SelectItem>
                    <SelectItem value="25">25 / pág</SelectItem>
                    <SelectItem value="50">50 / pág</SelectItem>
                    <SelectItem value="100">100 / pág</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {totalNominalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={nominalPage === 1}
                    onClick={() => setNominalPage(p => Math.max(1, p - 1))}
                    className="h-8 px-2 text-xs rounded-lg"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  {getPageNumbers(nominalPage, totalNominalPages).map((p, idx) => (
                    typeof p === 'number' ? (
                      <Button
                        key={idx}
                        variant={nominalPage === p ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNominalPage(p)}
                        className={`h-8 w-8 text-xs font-bold rounded-lg p-0 ${
                          nominalPage === p ? 'bg-blue-900 text-white' : 'text-slate-700'
                        }`}
                      >
                        {p}
                      </Button>
                    ) : (
                      <span key={idx} className="px-1 text-slate-400">...</span>
                    )
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={nominalPage === totalNominalPages}
                    onClick={() => setNominalPage(p => Math.min(totalNominalPages, p + 1))}
                    className="h-8 px-2 text-xs rounded-lg"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VISTA 3: ESTATUS DE FÁRMACOS Y UNIFICACIÓN DE PRESENTACIONES */}
      {activeModuleTab === 'standardized_catalog' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Tarjeta Explicativa de Reglas de Estandarización */}
          <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-blue-800/40 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-md">
                    Sistema de Estandarización Farmacológica
                  </span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Alcaldía de Sotillo &bull; Farmacia Municipal
                  </span>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Pill className="w-5 h-5 text-emerald-400" />
                  Estatus de Principios Activos y Unificación de Presentaciones
                </h3>
                <p className="text-xs text-slate-300 font-medium max-w-3xl leading-relaxed">
                  Para evitar duplicaciones y fragmentación en compras, el sistema consolida automáticamente múltiples variantes de prescripción y presentación (ej: <em>«tab», «tableta», «comprimido», «pastilla»</em> se unifican bajo la presentación estándar <strong>Tabletas</strong>; y variantes como <em>«losartan», «LOSARTAN 50MG», «losartán potasico»</em> se agrupan en <strong>Losartán Potásico 50mg</strong>).
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0 bg-slate-900/80 p-3 rounded-xl border border-blue-500/20 text-center">
                <div className="p-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Fármacos Unificados</span>
                  <span className="text-xl font-black text-emerald-400 tabular-nums">{procurementList.length}</span>
                </div>
                <div className="p-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Pacientes</span>
                  <span className="text-xl font-black text-cyan-300 tabular-nums">{chronicSummary.totalMonitored}</span>
                </div>
                <div className="p-2 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Demanda Total Mes</span>
                  <span className="text-xl font-black text-amber-300 tabular-nums">
                    {procurementList.reduce((acc, i) => acc + i.monthlyProjectedUnits, 0).toLocaleString('es-VE')} un.
                  </span>
                </div>
              </div>
            </div>

            {/* Guía Rápida de Presentaciones Estandarizadas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-800 text-[11px]">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="font-bold text-blue-300 block uppercase text-[10px]">💊 Tabletas</span>
                <span className="text-slate-400 text-[10px]">Unifica: Comprimidos, Tabs, Pastillas, Grageas.</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="font-bold text-indigo-300 block uppercase text-[10px]">💉 Frasco Ampolla</span>
                <span className="text-slate-400 text-[10px]">Unifica: Viales, Inyectables, Insulinas NPH/Reg.</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="font-bold text-emerald-300 block uppercase text-[10px]">🧴 Jarabe / Suspensión</span>
                <span className="text-slate-400 text-[10px]">Unifica: Frascos líquidos, gotas y suspensiones.</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="font-bold text-amber-300 block uppercase text-[10px]">💨 Inhalador Aerosol</span>
                <span className="text-slate-400 text-[10px]">Unifica: Salbutamol, Budesonida, Spray, Puff.</span>
              </div>
            </div>
          </div>

          {/* Tabla de Auditoría del Catálogo */}
          <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar fármaco estandarizado o presentación..."
                    className="pl-9 h-9 text-xs bg-white rounded-xl border-slate-300"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setCatalogConditionFilter('all')}
                    className={`px-3 py-1 text-[11px] font-bold uppercase rounded-lg transition-all ${
                      catalogConditionFilter === 'all'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos ({procurementList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogConditionFilter('hipertension')}
                    className={`px-3 py-1 text-[11px] font-bold uppercase rounded-lg transition-all ${
                      catalogConditionFilter === 'hipertension'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hipertensión
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogConditionFilter('diabetes')}
                    className={`px-3 py-1 text-[11px] font-bold uppercase rounded-lg transition-all ${
                      catalogConditionFilter === 'diabetes'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Diabetes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogConditionFilter('regular_med')}
                    className={`px-3 py-1 text-[11px] font-bold uppercase rounded-lg transition-all ${
                      catalogConditionFilter === 'regular_med'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Uso Continuo
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-100/90 border-b border-slate-200">
                    <TableRow>
                      <TableHead className="w-12 text-center text-[10px] font-black uppercase text-slate-700 py-3">N°</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3">Principio Activo Estandarizado</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3">Presentación Unificada</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3">Condición Clínica</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3 text-center">Pacientes en Censo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3 text-center">En Espera Inmediata</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3 text-center">Demanda Mes (100%)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3 text-center">Estatus Semáforo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3 text-right">Detalle Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredCatalogList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400 font-bold">
                          No se encontraron fármacos que coincidan con los criterios de búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredCatalogList.map((item, idx) => {
                        return (
                          <tr key={item.medicationKey} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <span className="font-black text-blue-950 uppercase block">{item.medicationName}</span>
                              <span className="text-[10px] text-slate-400">Clave unificada: {item.medicationKey}</span>
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="text-slate-700 bg-slate-50 border-slate-300 font-bold text-[10px]">
                                {item.presentation}
                              </Badge>
                            </td>
                            <td className="py-3 px-3">
                              {item.conditionType === 'hipertension' ? (
                                <Badge className="bg-blue-100 text-blue-900 border-none font-bold text-[10px]">
                                  Hipertensión
                                </Badge>
                              ) : item.conditionType === 'diabetes' ? (
                                <Badge className="bg-amber-100 text-amber-900 border-none font-bold text-[10px]">
                                  Diabetes
                                </Badge>
                              ) : (
                                <Badge className="bg-purple-100 text-purple-900 border-none font-bold text-[10px]">
                                  Uso Continuo
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-black text-slate-800 tabular-nums">
                              {item.totalPatientsCount}
                            </td>
                            <td className="py-3 px-3 text-center tabular-nums">
                              {item.criticalPatientsCount > 0 ? (
                                <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  {item.criticalPatientsCount} pac. ({item.immediateRequiredUnits} un.)
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">0 pac.</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-black text-blue-950 tabular-nums">
                              {item.monthlyProjectedUnits} un.
                            </td>
                            <td className="py-3 px-3 text-center">
                              {item.overduePatientsCount > 0 ? (
                                <Badge className="bg-rose-600 text-white font-black text-[9px]">
                                  🔴 {item.overduePatientsCount} Vencidos
                                </Badge>
                              ) : item.expiringSoonPatientsCount > 0 ? (
                                <Badge className="bg-amber-500 text-white font-black text-[9px]">
                                  🟡 {item.expiringSoonPatientsCount} Próximos
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-600 text-white font-bold text-[9px]">
                                  🟢 Al Día
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedProcurementItem(item)}
                                className="h-7 px-2.5 text-[10px] font-black uppercase text-blue-900 border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer gap-1"
                              >
                                <span>Ver Pacientes</span>
                                <ArrowRight className="w-3 h-3 text-blue-600" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Modal de Desglose Nominal de Pacientes por Medicamento Seleccionado */}
      <Dialog 
        open={!!selectedProcurementItem} 
        onOpenChange={(open) => { if (!open) setSelectedProcurementItem(null); }}
      >
        <DialogContent className="max-w-3xl w-full max-h-[85vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 bg-gradient-to-r from-blue-950 to-slate-900 text-white border-b border-blue-900">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-cyan-400" />
              <DialogTitle className="text-base font-black uppercase text-white">
                Pacientes que Requieren: {selectedProcurementItem?.medicationName}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-blue-200 mt-1">
              Presentación: {selectedProcurementItem?.presentation} &bull; Total Pacientes: {selectedProcurementItem?.patients.length} ({selectedProcurementItem?.criticalPatientsCount} en espera inmediata)
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Vencidos (≥30d)</span>
                <span className="text-base font-black text-rose-600">{selectedProcurementItem?.overduePatientsCount}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Próximos (25-29d)</span>
                <span className="text-base font-black text-amber-600">{selectedProcurementItem?.expiringSoonPatientsCount}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total a Solicitar</span>
                <span className="text-base font-black text-blue-950">
                  {selectedProcurementItem?.immediateRequiredUnits} un.
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-100/80">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 py-2.5">Paciente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 py-2.5">Cédula</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 py-2.5">Comuna</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 py-2.5 text-center">Última Entrega</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 py-2.5 text-center">Semáforo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 py-2.5 text-right">WhatsApp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProcurementItem?.patients.map(p => (
                    <TableRow key={`${p.workerId}-${p.lastRecipeId}`} className="text-xs">
                      <TableCell className="font-bold uppercase py-2.5 text-slate-900">{p.fullName}</TableCell>
                      <TableCell className="font-medium text-slate-600 py-2.5">{p.dni}</TableCell>
                      <TableCell className="text-slate-600 py-2.5">{p.commune}</TableCell>
                      <TableCell className="text-center font-medium text-slate-600 py-2.5">{p.lastDeliveredFormatted}</TableCell>
                      <TableCell className="text-center py-2.5">
                        {p.status === 'overdue' ? (
                          <Badge className="bg-rose-600 text-white text-[9px] font-black">🔴 {p.daysElapsed}d</Badge>
                        ) : p.status === 'expiring_soon' ? (
                          <Badge className="bg-amber-500 text-white text-[9px] font-black">🟡 {p.daysElapsed}d</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-[9px] font-bold">🟢 {p.daysElapsed}d</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        {p.isPhoneValid ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendWhatsAppNotification(p)}
                            className="h-7 px-2 text-[10px] font-bold border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 gap-1 rounded-md"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" />
                            <span>Notificar</span>
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin cel.</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedProcurementItem(null)}
                className="text-xs font-bold uppercase rounded-xl h-9 px-4"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
