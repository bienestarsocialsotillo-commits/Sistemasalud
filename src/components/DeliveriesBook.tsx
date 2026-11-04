import React, { useState, useMemo, useRef, useEffect } from "react";
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
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  FileSpreadsheet, 
  Pill, 
  Package, 
  Accessibility, 
  CheckCircle2, 
  Users, 
  User, 
  Calendar, 
  Eye, 
  Paperclip, 
  MapPin, 
  ShieldCheck, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Clock,
  Building2,
  Pencil,
  RotateCcw,
  Trash2,
  Award,
  PackageSearch,
  MessageSquare
} from "lucide-react";
import SocialAreaReportModal from "./SocialAreaReportModal";
import ItemBeneficiariesReportModal from "./ItemBeneficiariesReportModal";
import WhatsAppBroadcastModal from "./WhatsAppBroadcastModal";
import { MedicationRecipe, Worker } from "@/types";
import { format, isSameDay, isAfter, subDays, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { getRecipeCategory } from "@/utils/categoryUtils";

interface DeliveriesBookProps {
  recipes: MedicationRecipe[];
  workers: Worker[];
  isAdmin: boolean;
  onViewRecipe: (recipe: MedicationRecipe) => void;
  onEditRecipe?: (recipe: MedicationRecipe) => void;
  onDeleteRecipe?: (recipe: MedicationRecipe) => void;
  onRevertDelivery?: (recipe: MedicationRecipe) => void;
}

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

const parseDateSafe = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (val?.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function DeliveriesBook({
  recipes,
  workers,
  isAdmin,
  onViewRecipe,
  onEditRecipe,
  onDeleteRecipe,
  onRevertDelivery
}: DeliveriesBookProps) {
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation'>('all');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSocialReportOpen, setIsSocialReportOpen] = useState(false);
  const [isItemReportOpen, setIsItemReportOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const tableTopRef = useRef<HTMLDivElement>(null);

  // Trabajadores indexados por ID para búsqueda rápida
  const workersMap = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach(w => map.set(w.id, w));
    return map;
  }, [workers]);

  const getWorker = (workerId: string) => workersMap.get(workerId);

  // Base: solo entregados
  const deliveredRecipes = useMemo(() => {
    return recipes.filter(r => r.status === 'delivered');
  }, [recipes]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = subDays(todayStart, 6);
  const monthStart = startOfMonth(now);

  // Filtrado reactivo en memoria
  const filteredDeliveries = useMemo(() => {
    return deliveredRecipes.filter(r => {
      // Filtro Temporal
      if (timeFilter !== 'all') {
        const d = parseDateSafe(r.deliveredAt || r.createdAt);
        if (!d) return false;
        if (timeFilter === 'today' && !isSameDay(d, now)) return false;
        if (timeFilter === 'week' && !(isAfter(d, weekStart) || isSameDay(d, weekStart))) return false;
        if (timeFilter === 'month' && !(isAfter(d, monthStart) || isSameDay(d, monthStart))) return false;
      }

      // Filtro de Categoría
      const cat = getRecipeCategory(r);
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;

      // Filtro Textual
      const term = (search || "").trim().toLowerCase();
      if (!term) return true;

      const worker = getWorker(r.workerId);
      const workerName = (worker?.fullName || "").toLowerCase();
      const workerDni = (worker?.dni || "").toLowerCase();
      const cleanTermDigits = term.replace(/[^0-9]/g, '');
      const cleanWorkerDigits = workerDni.replace(/[^0-9]/g, '');

      const itemName = (r.technicalAidType || r.medication || "").toLowerCase();
      const presentation = (r.presentation || "").toLowerCase();
      const commune = (r.commune || worker?.commune || "").toLowerCase();
      const sector = (worker?.sector || "").toLowerCase();
      const officer = (r.deliveryOfficer || r.deliveredBy || "").toLowerCase();
      const notes = (r.deliveryNotes || "").toLowerCase();

      if (workerName.includes(term)) return true;
      if (workerDni.includes(term)) return true;
      if (cleanTermDigits.length > 0 && cleanWorkerDigits.includes(cleanTermDigits)) return true;
      if (itemName.includes(term)) return true;
      if (presentation.includes(term)) return true;
      if (commune.includes(term)) return true;
      if (sector.includes(term)) return true;
      if (officer.includes(term)) return true;
      if (notes.includes(term)) return true;

      // Coincidencia con Apoderado / Representante Legal
      if (r.isDeliveredToRepresentative) {
        const repName = (r.representativeFullName || "").toLowerCase();
        const repDni = (r.representativeDni || "").toLowerCase();
        const cleanRepDigits = repDni.replace(/[^0-9]/g, '');
        if (repName.includes(term)) return true;
        if (repDni.includes(term)) return true;
        if (cleanTermDigits.length > 0 && cleanRepDigits.includes(cleanTermDigits)) return true;
      }

      return false;
    });
  }, [deliveredRecipes, timeFilter, categoryFilter, search, workersMap, weekStart, monthStart]);

  const totalFiltered = filteredDeliveries.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedDeliveries = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredDeliveries.slice(start, start + pageSize);
  }, [filteredDeliveries, safeCurrentPage, pageSize]);

  // Desglose de insumos entregados en la vista actual
  const summaryDeliveries = useMemo(() => {
    let meds = 0;
    let aids = 0;
    let supplies = 0;

    filteredDeliveries.forEach(r => {
      const cat = getRecipeCategory(r);
      const qty = (cat === 'technical_aid' && r.technicalAidQuantity)
        ? Number(r.technicalAidQuantity)
        : (Number(r.quantity) || 1);

      if (cat === 'technical_aid') {
        aids += qty;
      } else if (cat === 'medical_supply') {
        supplies += qty;
      } else {
        meds += qty;
      }
    });

    return { meds, aids, supplies };
  }, [filteredDeliveries]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, timeFilter, categoryFilter, pageSize]);

  useEffect(() => {
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  // Exportar Acta de Entregas a CSV / Excel
  const handleExportCsv = () => {
    if (filteredDeliveries.length === 0) {
      toast.error("No hay entregas para exportar con los filtros seleccionados");
      return;
    }

    const headers = [
      "Fecha de Entrega",
      "Paciente Beneficiario",
      "Cédula de Identidad",
      "Comuna",
      "Sector",
      "Teléfono Paciente",
      "Categoría",
      "Insumo / Fármaco Entregado",
      "Presentación",
      "Cantidad FÍSICA",
      "Modalidad de Retiro",
      "Nombre Representante",
      "C.I. Representante",
      "Parentesco Representante",
      "Teléfono Representante",
      "Funcionario Despachador",
      "Observaciones de Entrega"
    ];

    const rows = filteredDeliveries.map(r => {
      const worker = getWorker(r.workerId);
      const cat = getRecipeCategory(r);
      const catLabel = cat === 'medication' ? 'Fármaco' : cat === 'technical_aid' ? 'Ayuda Humana' : cat === 'medical_supply' ? 'Insumo Médico' : 'Derivación / Atención';
      const itemName = r.technicalAidType || r.medication || r.derivationService || "Insumo";
      const presentation = r.presentation || "Unidad";
      const qty = r.requiresTechnicalAid ? (Number(r.technicalAidQuantity) || 1) : (Number(r.quantity) || 1);
      const repLabel = r.isDeliveredToRepresentative ? 'Representante / Familiar' : 'Titular Directo';
      const repName = r.representativeFullName || '';
      const repDni = r.representativeDni || '';
      const repRel = r.representativeRelationship || '';
      const repPhone = r.representativePhone || '';
      const officer = r.deliveryOfficer || r.deliveredBy || 'Alcaldía de Sotillo';
      const notes = r.deliveryNotes || '';

      const deliveryDate = parseDateSafe(r.deliveredAt || r.createdAt);
      const dateStr = deliveryDate ? format(deliveryDate, "yyyy-MM-dd HH:mm") : '';

      return [
        `"${dateStr}"`,
        `"${(worker?.fullName || 'Paciente').replace(/"/g, '""')}"`,
        `"${worker?.dni || ''}"`,
        `"${(r.commune || worker?.commune || '').replace(/"/g, '""')}"`,
        `"${(worker?.sector || '').replace(/"/g, '""')}"`,
        `"${worker?.phone || ''}"`,
        `"${catLabel}"`,
        `"${itemName.replace(/"/g, '""')}"`,
        `"${presentation.replace(/"/g, '""')}"`,
        qty,
        `"${repLabel}"`,
        `"${repName.replace(/"/g, '""')}"`,
        `"${repDni}"`,
        `"${repRel.replace(/"/g, '""')}"`,
        `"${repPhone}"`,
        `"${officer.replace(/"/g, '""')}"`,
        `"${notes.replace(/"/g, '""')}"`
      ].join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Libro_Entregas_Farmacia_Sotillo_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Libro de Entregas exportado con éxito (${filteredDeliveries.length} actas)`);
  };

  return (
    <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
      <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-sm font-black text-blue-950 uppercase tracking-widest">
                Libro Digital de Entregas Realizadas
              </CardTitle>
            </div>
            <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
              Registro histórico y fidedigno de insumos y fármacos despachados en dependencias a pacientes y apoderados
            </CardDescription>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <Button
                type="button"
                onClick={() => setIsWhatsAppOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider h-9 px-3.5 rounded-xl shadow-2xs gap-1.5 shrink-0 cursor-pointer"
                title="Abrir Centro de Difusión y Notificaciones WhatsApp a beneficiarios"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-100" />
                <span>Difusión WhatsApp</span>
              </Button>

              <Button
                type="button"
                onClick={() => setIsItemReportOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider h-9 px-3.5 rounded-xl shadow-2xs gap-1.5 shrink-0 cursor-pointer"
                title="Consultar y extraer nominalmente qué personas recibieron un fármaco o insumo específico (canastillas, sillas de ruedas, etc.)"
              >
                <PackageSearch className="w-3.5 h-3.5 text-indigo-200" />
                <span>Extracción por Ítem / Fármaco</span>
              </Button>

              <Button
                type="button"
                onClick={() => setIsSocialReportOpen(true)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider h-9 px-3.5 rounded-xl shadow-2xs gap-1.5 shrink-0 cursor-pointer"
                title="Generar informe cuantitativo por Razón Social (Jefes UBCH, Trabajadores Alcaldía, etc.)"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Informe por Razón Social (UBCH / Alcaldía)</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleExportCsv}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 font-black text-[10px] uppercase tracking-wider h-9 px-3.5 rounded-xl shadow-2xs gap-1.5 shrink-0"
                title="Descargar libro de entregas en formato CSV / Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exportar Libro de Entregas (CSV)</span>
              </Button>
            </div>
          )}
        </div>

        {/* Barra de Filtros Operativos */}
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center pt-1 border-t border-slate-200/60">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-900/60" />
            <Input
              placeholder="BUSCAR POR CÉDULA, PACIENTE, FÁRMACO, COMUNA O APODERADO..."
              className="pl-9 pr-8 h-9 bg-white text-[10px] font-bold border-slate-300 uppercase tracking-wider text-slate-800 shadow-2xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Temporal */}
          <div className="w-full sm:w-44">
            <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
              <SelectTrigger className="h-9 bg-white border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold">🏛️ Todos los Tiempos</SelectItem>
                <SelectItem value="today" className="text-xs font-bold text-blue-800">📅 Entregados Hoy</SelectItem>
                <SelectItem value="week" className="text-xs font-bold text-blue-800">📆 Esta Semana</SelectItem>
                <SelectItem value="month" className="text-xs font-bold text-blue-800">🗓️ Este Mes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Categoría */}
          <div className="w-full sm:w-48">
            <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
              <SelectTrigger className="h-9 bg-white border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold">📋 Todos los Requerimientos</SelectItem>
                <SelectItem value="medication" className="text-xs font-bold text-emerald-800">💊 Fármacos</SelectItem>
                <SelectItem value="technical_aid" className="text-xs font-bold text-amber-800">♿ Ayudas Humanas</SelectItem>
                <SelectItem value="medical_supply" className="text-xs font-bold text-indigo-800">📦 Insumos Médicos</SelectItem>
                <SelectItem value="medical_derivation" className="text-xs font-bold text-purple-800">🩺 Atención / Derivación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selector de Lote */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 h-9 shrink-0">
            <span className="text-[9px] font-black uppercase text-slate-400">Lote:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-6 w-20 border-none bg-transparent shadow-none text-[10px] font-black p-0 focus:ring-0 text-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25" className="text-xs font-bold">25 en 25</SelectItem>
                <SelectItem value="50" className="text-xs font-bold">50 en 50</SelectItem>
                <SelectItem value="100" className="text-xs font-bold">100 en 100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cifras de Entrega Fidedignas del Período / Búsqueda */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 lg:pt-0 lg:ml-auto">
            <span className="text-[9px] font-black uppercase text-slate-400 mr-1 hidden sm:inline">Despachado:</span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-300 font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
              💊 {summaryDeliveries.meds.toLocaleString()} fármacos
            </Badge>
            <Badge variant="outline" className="bg-cyan-50 text-cyan-900 border-cyan-300 font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
              ♿ {summaryDeliveries.aids.toLocaleString()} ayudas
            </Badge>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-900 border-indigo-300 font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
              📦 {summaryDeliveries.supplies.toLocaleString()} insumos
            </Badge>
            <Badge variant="secondary" className="bg-slate-100 text-slate-800 font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
              📋 {filteredDeliveries.length.toLocaleString()} actas
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div ref={tableTopRef} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 border-b border-slate-100">
                <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500">Fecha & Despachador</TableHead>
                <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500">Beneficiario / C.I.</TableHead>
                <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500">Insumo Entregado</TableHead>
                <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500 text-center">Cant. Física</TableHead>
                <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500">Modalidad de Retiro</TableHead>
                <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500 text-right">Soporte</TableHead>
                {isAdmin && (
                  <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500 text-right">Gestión Admin</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="py-16 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      No se encontraron actas de entrega con los filtros aplicados
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase">
                      Intente cambiar el período temporal o limpie los términos de búsqueda
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDeliveries.map((r) => {
                  const worker = getWorker(r.workerId);
                  const isTechAid = getRecipeCategory(r) === 'technical_aid';
                  const isSupply = getRecipeCategory(r) === 'medical_supply';
                  const isDerivation = getRecipeCategory(r) === 'medical_derivation';
                  const itemName = r.technicalAidType || r.medication || r.derivationService || "Insumo";
                  const qty = isTechAid ? (Number(r.technicalAidQuantity) || 1) : (Number(r.quantity) || 1);
                  const deliveryDate = parseDateSafe(r.deliveredAt || r.createdAt);

                  return (
                    <TableRow key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      {/* Fecha y Despachador */}
                      <TableCell className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {deliveryDate ? format(deliveryDate, "dd/MM/yyyy HH:mm") : "Fecha Registrada"}
                          </span>
                          <span className="text-[10px] font-semibold text-blue-900 uppercase mt-0.5 truncate max-w-[160px]">
                            {r.deliveryOfficer || r.deliveredBy || "Alcaldía de Sotillo"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Beneficiario */}
                      <TableCell className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 uppercase text-xs">
                            {worker?.fullName || "Beneficiario Registrado"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                            C.I. {worker?.dni || "---"}
                          </span>
                          <span className="text-[9px] text-blue-950 uppercase font-semibold flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                            {r.commune || worker?.commune || "Sin Comuna"} {worker?.sector ? `• ${worker.sector}` : ''}
                          </span>
                        </div>
                      </TableCell>

                      {/* Insumo Entregado */}
                      <TableCell className="px-5 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1.5">
                            {isTechAid ? (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[9px] font-black uppercase py-0.5 gap-1">
                                <Accessibility className="w-3 h-3" />
                                Ayuda Humana
                              </Badge>
                            ) : isSupply ? (
                              <Badge className="bg-indigo-100 text-indigo-900 border-indigo-200 text-[9px] font-black uppercase py-0.5 gap-1">
                                <Package className="w-3 h-3" />
                                Insumo
                              </Badge>
                            ) : isDerivation ? (
                              <Badge className="bg-purple-100 text-purple-900 border-purple-200 text-[9px] font-black uppercase py-0.5 gap-1">
                                <Building2 className="w-3 h-3" />
                                Derivación / Atención
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[9px] font-black uppercase py-0.5 gap-1">
                                <Pill className="w-3 h-3" />
                                Fármaco
                              </Badge>
                            )}
                          </div>
                          <span className="font-black text-slate-900 uppercase text-xs">
                            {itemName}
                          </span>
                          {r.presentation && (
                            <span className="text-[10px] text-slate-500 font-semibold uppercase">
                              {r.presentation} {r.dosage ? `• ${r.dosage}` : ''}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Cantidad Física */}
                      <TableCell className="px-5 py-3.5 text-center">
                        <Badge className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-lg">
                          {qty} {isTechAid ? 'un.' : (r.presentation ? r.presentation.slice(0, 4) : 'un.')}
                        </Badge>
                      </TableCell>

                      {/* Modalidad de Retiro */}
                      <TableCell className="px-5 py-3.5">
                        {r.isDeliveredToRepresentative ? (
                          <div className="p-2 bg-blue-50/90 border border-blue-200 rounded-lg max-w-xs shadow-2xs">
                            <div className="flex items-center gap-1 text-[9px] font-black text-blue-900 uppercase">
                              <Users className="w-3 h-3 text-blue-700 shrink-0" />
                              <span>Retiró Representante:</span>
                            </div>
                            <p className="text-[11px] font-black text-slate-900 uppercase mt-0.5 truncate">
                              {r.representativeFullName || "Familiar / Apoderado"}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-600 font-bold mt-0.5">
                              <span>C.I. {r.representativeDni || "S/D"}</span>
                              {r.representativeRelationship && <span>• {r.representativeRelationship}</span>}
                              {r.representativePhone && <span>• Tel: {r.representativePhone}</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-[11px] font-bold uppercase text-slate-800">
                              Titular Directo
                            </span>
                          </div>
                        )}
                        {r.deliveryNotes && (
                          <p className="text-[9px] text-slate-400 italic mt-1 line-clamp-1" title={r.deliveryNotes}>
                            Obs: {r.deliveryNotes}
                          </p>
                        )}
                      </TableCell>

                      {/* Soporte / Acciones */}
                      <TableCell className="px-5 py-3.5 text-right">
                        {r.recipeFileUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewRecipe(r)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200 font-bold text-[10px] uppercase h-8 px-2.5 rounded-lg shadow-2xs gap-1"
                            title="Ver soporte digital de recipe/orden"
                          >
                            <Paperclip className="w-3 h-3 text-blue-600" />
                            <span>Soporte</span>
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin adjunto</span>
                        )}
                      </TableCell>

                      {/* Gestión Admin (Solo visible para Administradores) */}
                      {isAdmin && (
                        <TableCell className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {onEditRecipe && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEditRecipe(r)}
                                className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer"
                                title="Corregir datos de este registro de entrega (Solo Administrador)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {onRevertDelivery && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onRevertDelivery(r)}
                                className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg cursor-pointer"
                                title="Revertir entrega a Solicitud Pendiente (Solo Administrador)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {onDeleteRecipe && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDeleteRecipe(r)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Eliminar registro permanentemente (Solo Administrador)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Mostrando {paginatedDeliveries.length} de {totalFiltered} actas de entrega
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage === 1}
              >
                <ChevronsLeft className="h-3.5 w-3.5 text-slate-600" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={safeCurrentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
              </Button>

              <div className="flex items-center gap-1">
                {getPageNumbers(safeCurrentPage, totalPages).map((p, i) => {
                  if (p === '...') {
                    return <span key={`dots-${i}`} className="px-1 text-slate-400 text-xs">...</span>;
                  }
                  const num = p as number;
                  const isActive = safeCurrentPage === num;
                  return (
                    <Button
                      key={`dp-${num}`}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={`h-7 min-w-7 px-2 rounded-lg text-xs font-bold ${
                        isActive ? "bg-blue-900 text-white" : "border-slate-200 text-slate-700"
                      }`}
                      onClick={() => setCurrentPage(num)}
                    >
                      {num}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg"
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={safeCurrentPage === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage === totalPages}
              >
                <ChevronsRight className="h-3.5 w-3.5 text-slate-600" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal de Informe Cuantitativo por Razón Social */}
      <SocialAreaReportModal
        isOpen={isSocialReportOpen}
        onClose={() => setIsSocialReportOpen(false)}
        workers={workers}
        recipes={recipes}
        initialSocialArea="JEFE UBCH"
      />

      {/* Modal de Extracción Nominal de Beneficiarios por Ítem / Fármaco */}
      <ItemBeneficiariesReportModal
        isOpen={isItemReportOpen}
        onClose={() => setIsItemReportOpen(false)}
        recipes={recipes}
        workers={workers}
      />

      {/* Modal de Difusión y Notificaciones WhatsApp */}
      <WhatsAppBroadcastModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        workers={workers}
        recipes={recipes}
      />
    </Card>
  );
}
