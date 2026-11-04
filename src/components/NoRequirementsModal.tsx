import React, { useState, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
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
  Users, 
  Search, 
  FileSpreadsheet, 
  PlusCircle, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  UserX, 
  Phone, 
  MapPin, 
  Calendar 
} from "lucide-react";
import { Worker } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

interface NoRequirementsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workersWithoutRequirements: Worker[];
  totalWorkersCount: number;
  onSelectWorkerForRecipe: (worker: Worker) => void;
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

export default function NoRequirementsModal({
  isOpen,
  onOpenChange,
  workersWithoutRequirements,
  totalWorkersCount,
  onSelectWorkerForRecipe
}: NoRequirementsModalProps) {
  const [search, setSearch] = useState("");
  const [communeFilter, setCommuneFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Comunas presentes en este subconjunto
  const availableCommunes = useMemo(() => {
    const set = new Set<string>();
    workersWithoutRequirements.forEach(w => {
      if (w.commune && w.commune.trim()) {
        set.add(w.commune.trim());
      }
    });
    return Array.from(set).sort();
  }, [workersWithoutRequirements]);

  // Filtrado reactivo en memoria
  const filteredWorkers = useMemo(() => {
    return workersWithoutRequirements.filter(w => {
      if (communeFilter !== "all" && w.commune !== communeFilter) return false;

      const term = (search || "").trim().toLowerCase();
      if (!term) return true;

      const cleanTermDigits = term.replace(/[^0-9]/g, '');
      const cleanDniDigits = (w.dni || '').replace(/[^0-9]/g, '');

      return (
        w.fullName.toLowerCase().includes(term) ||
        w.dni.toLowerCase().includes(term) ||
        (cleanTermDigits.length > 0 && cleanDniDigits.includes(cleanTermDigits)) ||
        (w.commune || '').toLowerCase().includes(term) ||
        (w.sector || '').toLowerCase().includes(term) ||
        (w.phone || '').includes(term)
      );
    });
  }, [workersWithoutRequirements, search, communeFilter]);

  const totalFiltered = filteredWorkers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedWorkers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredWorkers.slice(start, start + pageSize);
  }, [filteredWorkers, safeCurrentPage, pageSize]);

  // Reiniciar a página 1 al filtrar
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, communeFilter, pageSize]);

  const percentage = totalWorkersCount > 0 
    ? ((workersWithoutRequirements.length / totalWorkersCount) * 100).toFixed(1)
    : "0";

  // Exportar listado a CSV / Excel
  const handleExportCsv = () => {
    if (filteredWorkers.length === 0) {
      toast.error("No hay registros para exportar con los filtros seleccionados");
      return;
    }

    const headers = [
      "ID",
      "Nombre Completo",
      "Cédula de Identidad",
      "Edad",
      "Género",
      "Teléfono de Contacto",
      "Comuna",
      "Sector",
      "Centro de Votación",
      "Área Social",
      "Discapacidad",
      "Estatus"
    ];

    const rows = filteredWorkers.map(w => [
      `"${w.id}"`,
      `"${(w.fullName || '').replace(/"/g, '""')}"`,
      `"${w.dni || ''}"`,
      w.age || '',
      `"${w.gender || ''}"`,
      `"${w.phone || ''}"`,
      `"${(w.commune || '').replace(/"/g, '""')}"`,
      `"${(w.sector || '').replace(/"/g, '""')}"`,
      `"${(w.votingCenter || '').replace(/"/g, '""')}"`,
      `"${(w.socialArea || '').replace(/"/g, '""')}"`,
      `"${w.hasDisability ? 'SÍ' : 'NO'}"`,
      `"${w.status || 'active'}"`
    ].join(';'));

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Padrón_Sin_Requerimiento_Sotillo_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exportados ${filteredWorkers.length} ciudadanos sin requerimiento a CSV`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl w-full max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-amber-400" />
                <DialogTitle className="uppercase font-black text-white text-base sm:text-lg tracking-wide">
                  Ciudadanos Censados Sin Requerimiento Registrado
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-300 font-medium">
                Padrón de personas inscritas que actualmente no tienen solicitudes de medicamentos ni ayudas humanas asociadas.
              </DialogDescription>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 shrink-0">
              <span className="text-[10px] font-bold uppercase text-slate-400">Total en Censo:</span>
              <Badge className="bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/40">
                {workersWithoutRequirements.length} ({percentage}%)
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {/* Banner de Orientación Operativa */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950">
            <div className="text-xs font-semibold">
              <p className="font-bold uppercase tracking-wider text-amber-900 text-[11px]">
                Focalización de Abordajes Territoriales
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Utilice esta lista para planificar visitas de pesquisa médica, jornadas de triaje o contacto directo con las familias en las comunas.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="bg-white hover:bg-amber-100 text-amber-900 border-amber-300 font-black text-[10px] uppercase tracking-wider h-8 px-3 rounded-lg shadow-2xs gap-1.5 shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
              <span>Exportar Padrón (CSV)</span>
            </Button>
          </div>

          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="BUSCAR POR NOMBRE, CÉDULA, SECTOR O TELÉFONO..."
                className="pl-9 pr-8 h-9 bg-white text-xs font-bold border-slate-300 uppercase tracking-wider text-slate-800"
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

            <div className="w-full sm:w-60">
              <Select value={communeFilter} onValueChange={setCommuneFilter}>
                <SelectTrigger className="h-9 bg-white border-slate-300 text-xs font-bold uppercase">
                  <SelectValue placeholder="Comuna" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all" className="text-xs font-bold">🏛️ Todas las Comunas</SelectItem>
                  {availableCommunes.map(c => (
                    <SelectItem key={c} value={c} className="text-xs font-bold uppercase">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 h-9 shrink-0">
              <span className="text-[9px] font-black uppercase text-slate-400">Lote:</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-6 w-20 border-none bg-transparent shadow-none text-xs font-black p-0 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25" className="text-xs font-bold">25 en 25</SelectItem>
                  <SelectItem value="50" className="text-xs font-bold">50 en 50</SelectItem>
                  <SelectItem value="100" className="text-xs font-bold">100 en 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabla de Ciudadanos */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b border-slate-100">
                    <TableHead className="px-4 py-3 text-[10px] uppercase font-black text-slate-500">Ciudadano / C.I.</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] uppercase font-black text-slate-500">Comuna & Sector</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] uppercase font-black text-slate-500">Contacto</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] uppercase font-black text-slate-500 text-center">Condición</TableHead>
                    <TableHead className="px-4 py-3 text-[10px] uppercase font-black text-slate-500 text-right">Acción Operativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWorkers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 opacity-60" />
                        <p className="text-xs font-bold uppercase tracking-wider">No se encontraron ciudadanos con los filtros aplicados</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedWorkers.map((w) => (
                      <TableRow key={w.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 uppercase text-xs">{w.fullName}</span>
                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">C.I. {w.dni}</span>
                            {w.age && <span className="text-[9px] text-slate-400 font-medium">{w.age} años {w.gender ? `• ${w.gender}` : ''}</span>}
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-blue-950 uppercase text-[11px] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                              {w.commune || "Sin Comuna Asignada"}
                            </span>
                            {w.sector && (
                              <span className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">
                                Sector: {w.sector}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          {w.phone ? (
                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {w.phone}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Sin teléfono registrado</span>
                          )}
                        </TableCell>

                        <TableCell className="px-4 py-3 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {w.hasDisability ? (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[9px] font-black uppercase">
                                Discapacidad
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 text-[9px] font-bold uppercase">
                                Regular
                              </Badge>
                            )}
                            {(() => {
                              const list = (w.socialAreas && w.socialAreas.length > 0)
                                ? w.socialAreas
                                : (w.socialArea && w.socialArea !== 'NO_APLICA' ? w.socialArea.split(' / ') : []);
                              return list.map((area, aIdx) => (
                                <Badge key={aIdx} variant="secondary" className="bg-blue-50 text-blue-800 border-blue-200 text-[8px] font-bold uppercase">
                                  {area}
                                </Badge>
                              ));
                            })()}
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => onSelectWorkerForRecipe(w)}
                            className="bg-blue-900 hover:bg-blue-950 text-white font-black text-[10px] uppercase tracking-wider h-8 px-3 rounded-lg shadow-2xs gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Crear Solicitud / Entrega</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginador */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Mostrando {paginatedWorkers.length} de {totalFiltered} ciudadanos
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
                          key={`p-${num}`}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
