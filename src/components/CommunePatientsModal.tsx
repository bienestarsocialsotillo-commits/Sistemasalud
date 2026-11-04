import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  MapPin,
  Users,
  Search,
  FileSpreadsheet,
  FileText,
  Printer,
  BookOpen,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Pill,
  Heart,
  Phone,
  Home,
  User,
  Calendar,
  X
} from "lucide-react";
import { Worker, MedicationRecipe } from '@/types';
import { dataService } from '@/lib/dataService';
import WorkerExpediente from './WorkerExpediente';
import * as XLSX from 'xlsx';
import { exportCommunePdf, isForeignerCommune, getRecipeDeliveredAidUnits } from '@/utils/territoryPdf';

interface CommunePatientsModalProps {
  commune: string | null;
  isOpen: boolean;
  onClose: () => void;
  workers?: Worker[];
}

export default function CommunePatientsModal({
  commune,
  isOpen,
  onClose,
  workers: initialWorkers
}: CommunePatientsModalProps) {
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers || []);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'elderly' | 'disability' | 'with-meds'>('all');
  const [selectedWorkerForExpediente, setSelectedWorkerForExpediente] = useState<Worker | null>(null);

  // Sync or fetch workers and recipes for this commune
  useEffect(() => {
    if (!isOpen || !commune) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [allWorkers, allRecipes] = await Promise.all([
          initialWorkers && initialWorkers.length > 0
            ? Promise.resolve(initialWorkers)
            : dataService.getWorkers(),
          dataService.getMedicationRecipes()
        ]);

        // Normalize commune comparison
        const isTargetForeign = isForeignerCommune(commune);
        const communeNormalized = commune.trim().toLowerCase();
        const filtered = allWorkers.filter(w => {
          if (isTargetForeign) {
            return isForeignerCommune(w.commune) || !!w.isForeigner;
          }
          return (w.commune || '').trim().toLowerCase() === communeNormalized;
        });

        setWorkers(filtered);
        setRecipes(allRecipes);
      } catch (err) {
        console.error("Error loading commune patients:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    setSearchTerm('');
    setFilterType('all');
    setSelectedWorkerForExpediente(null);
  }, [isOpen, commune, initialWorkers]);

  // Calculate age helper
  const calculateAge = (birthDateStr?: string) => {
    if (!birthDateStr) return null;
    try {
      const birth = new Date(birthDateStr);
      if (isNaN(birth.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

  // Check if citizen has requested medications
  const getCitizenRecipes = (workerId: string) => {
    return recipes.filter(r => r.workerId === workerId);
  };

  // Demographic and delivered aids metrics for this commune
  const metrics = useMemo(() => {
    let males = 0;
    let females = 0;
    let elderly = 0;
    let disabilities = 0;
    let medsUnits = 0;
    let aidsUnits = 0;

    const workerIds = new Set(workers.map(w => w.id));
    const communeRecipes = recipes.filter(r => workerIds.has(r.workerId) || (r.commune && commune && r.commune.toLowerCase().trim() === commune.toLowerCase().trim()));

    communeRecipes.forEach(r => {
      const u = getRecipeDeliveredAidUnits(r);
      medsUnits += u.medsUnits;
      aidsUnits += u.aidsUnits;
    });

    workers.forEach(w => {
      const g = (w.gender || '').toLowerCase();
      if (g.startsWith('m') || g === 'masculino') males++;
      if (g.startsWith('f') || g === 'femenino') females++;

      const age = calculateAge(w.birthDate);
      if (age !== null && age >= 60) elderly++;
      if (w.hasDisability) disabilities++;
    });

    const totalAids = medsUnits + aidsUnits;
    const avgAids = workers.length > 0 ? (totalAids / workers.length).toFixed(1) : "0.0";

    return {
      total: workers.length,
      males,
      females,
      elderly,
      disabilities,
      medsUnits,
      aidsUnits,
      totalAids,
      avgAids
    };
  }, [workers, recipes, commune]);

  // Filtered citizens based on search and quick chips
  const filteredWorkers = useMemo(() => {
    return workers.filter(worker => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        worker.fullName?.toLowerCase().includes(term) ||
        worker.dni?.toLowerCase().includes(term) ||
        worker.sector?.toLowerCase().includes(term) ||
        worker.address?.toLowerCase().includes(term) ||
        worker.socialArea?.toLowerCase().includes(term) ||
        worker.phone?.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      const age = calculateAge(worker.birthDate);
      if (filterType === 'elderly') return age !== null && age >= 60;
      if (filterType === 'disability') return !!worker.hasDisability;
      if (filterType === 'with-meds') {
        const wRecipes = recipes.filter(r => r.workerId === worker.id);
        return wRecipes.length > 0;
      }

      return true;
    });
  }, [workers, searchTerm, filterType, recipes]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!commune || filteredWorkers.length === 0) return;

    const dataToExport = filteredWorkers.map(w => {
      const age = calculateAge(w.birthDate);
      const wRecipes = getCitizenRecipes(w.id);
      return {
        'Cédula / DNI': w.dni,
        'Nombres y Apellidos': w.fullName,
        'Edad': age !== null ? `${age} años` : 'N/A',
        'Género': w.gender || 'N/A',
        'Comuna': w.commune,
        'Sector / Comunidad': w.sector || 'N/A',
        'Dirección': w.address || 'N/A',
        'Teléfono': w.phone || 'N/A',
        'Área Social / Clasificación': w.socialArea || 'No asignada',
        'Discapacidad': w.hasDisability ? 'SÍ' : 'NO',
        'Estatus': w.status === 'active' ? 'Activo' : 'Inactivo',
        'Requerimientos Fármacos': wRecipes.map(r => `${r.medication} (${r.quantity})`).join(', ') || 'Ninguno'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nomina Territorial");
    const cleanName = commune.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Nomina_Comuna_${cleanName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to official PDF (guaranteed vector output, avoids browser blank sheet issues)
  const handleExportPdf = () => {
    if (!commune || filteredWorkers.length === 0) return;
    exportCommunePdf(commune, filteredWorkers, recipes);
  };

  if (!commune) return null;

  return (
    <>
      <Dialog open={isOpen && !selectedWorkerForExpediente} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[96vw] xl:max-w-6xl w-full max-h-[92vh] flex flex-col p-0 border-none shadow-2xl bg-white overflow-hidden rounded-2xl">
          {/* Header section with Commune Branding */}
          <DialogHeader className="p-5 sm:p-6 bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 text-white border-b border-blue-800 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isForeignerCommune(commune) ? (
                    <Badge className="bg-amber-600/90 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest px-2.5 py-0.5 border border-amber-400/30">
                      <MapPin className="w-3 h-3 mr-1 text-amber-200" />
                      Atención Solidaria Extramunicipal
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-600/80 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest px-2.5 py-0.5 border border-blue-400/30">
                      <MapPin className="w-3 h-3 mr-1 text-blue-200" />
                      Comuna Municipal Sotillo
                    </Badge>
                  )}
                  <span className="text-xs text-blue-200 font-semibold tracking-wider uppercase">
                    Alcaldía Juan Antonio Sotillo
                  </span>
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mt-1">
                  {isForeignerCommune(commune) ? "Casos Foráneos (Otros Municipios)" : `Comuna: ${commune}`}
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-200 font-medium">
                  {isForeignerCommune(commune)
                    ? "Ciudadanos atendidos procedentes de fuera del Municipio Sotillo en operativos y centros asistenciales"
                    : "Nómina territorializada y expediente epidemiológico de ciudadanos censados"}
                </DialogDescription>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={filteredWorkers.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-none font-bold text-xs uppercase tracking-wider h-8 shadow-sm flex-1 sm:flex-none cursor-pointer"
                  title="Descargar nómina oficial en PDF"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Descargar PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={filteredWorkers.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold text-xs uppercase tracking-wider h-8 shadow-sm flex-1 sm:flex-none cursor-pointer"
                  title="Descargar lista en Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  Excel
                </Button>
              </div>
            </div>

            {/* Metric KPI Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4 mt-2 border-t border-blue-800/60">
              <div className="bg-white/10 rounded-xl px-3 py-2 border border-white/10">
                <p className="text-[9px] font-black uppercase text-blue-200 tracking-widest leading-none">Personas Cargadas</p>
                <p className="text-lg font-black text-white mt-1 leading-none">{metrics.total} <span className="text-[10px] text-blue-300 font-bold">censados</span></p>
              </div>
              <div className="bg-indigo-500/20 rounded-xl px-3 py-2 border border-indigo-400/30">
                <p className="text-[9px] font-black uppercase text-indigo-200 tracking-widest leading-none">Ayudas Entregadas</p>
                <p className="text-lg font-black text-indigo-200 mt-1 leading-none">
                  {metrics.totalAids} <span className="text-[10px] text-indigo-300 font-bold">({metrics.avgAids}/p)</span>
                </p>
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2 border border-white/10">
                <p className="text-[9px] font-black uppercase text-blue-200 tracking-widest leading-none">💊 Fármacos</p>
                <p className="text-lg font-black text-emerald-300 mt-1 leading-none">{metrics.medsUnits} <span className="text-[10px] text-emerald-400 font-bold">uni.</span></p>
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2 border border-white/10">
                <p className="text-[9px] font-black uppercase text-blue-200 tracking-widest leading-none">♿ Ayudas Técn./Soc.</p>
                <p className="text-lg font-black text-purple-300 mt-1 leading-none">{metrics.aidsUnits} <span className="text-[10px] text-purple-400 font-bold">uni.</span></p>
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2 border border-white/10 col-span-2 sm:col-span-1">
                <p className="text-[9px] font-black uppercase text-blue-200 tracking-widest leading-none">Vulnerabilidad</p>
                <p className="text-sm font-black text-amber-300 mt-1 leading-none">
                  {metrics.elderly} <span className="text-[9px] text-slate-300">60+</span> / {metrics.disabilities} <span className="text-[9px] text-slate-300">Disc.</span>
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Search, Filters, and Table Controls */}
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
            {/* Live Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por cédula, nombre, sector o calle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-slate-300 rounded-xl text-xs h-9 font-medium shadow-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <Button
                size="sm"
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                className={`h-8 text-[11px] font-bold uppercase rounded-lg px-3 ${
                  filterType === 'all'
                    ? 'bg-blue-900 hover:bg-blue-950 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Todos ({workers.length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'elderly' ? 'default' : 'outline'}
                onClick={() => setFilterType('elderly')}
                className={`h-8 text-[11px] font-bold uppercase rounded-lg px-3 ${
                  filterType === 'elderly'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Adultos Mayores ({metrics.elderly})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'disability' ? 'default' : 'outline'}
                onClick={() => setFilterType('disability')}
                className={`h-8 text-[11px] font-bold uppercase rounded-lg px-3 ${
                  filterType === 'disability'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Discapacidad ({metrics.disabilities})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'with-meds' ? 'default' : 'outline'}
                onClick={() => setFilterType('with-meds')}
                className={`h-8 text-[11px] font-bold uppercase rounded-lg px-3 ${
                  filterType === 'with-meds'
                    ? 'bg-cyan-700 hover:bg-cyan-800 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Fármacos ({metrics.withPendingMeds})
              </Button>
            </div>
          </div>

          {/* Table of Registered Citizens */}
          <div className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Users className="w-10 h-10 animate-bounce text-blue-500 mb-2 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest">Cargando nómina de {commune}...</p>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 px-4 text-center">
                <ShieldAlert className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">
                  {workers.length === 0
                    ? `No hay ciudadanos registrados en ${commune}`
                    : "No se encontraron coincidencias para los filtros aplicados"}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  {workers.length === 0
                    ? "Los ciudadanos pueden ser registrados y asignados a esta comuna desde el módulo central de Censo de Salud."
                    : "Intente modificar el término de búsqueda o seleccione otro filtro para ver los registros."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-5 py-3.5">
                      Ciudadano / Cédula
                    </TableHead>
                    <TableHead className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-5 py-3.5">
                      {isForeignerCommune(commune) ? "Procedencia / Origen" : "Ubicación / Sector"}
                    </TableHead>
                    <TableHead className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-5 py-3.5">
                      Edad / Género
                    </TableHead>
                    <TableHead className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-5 py-3.5">
                      Enfoque / Área Social
                    </TableHead>
                    <TableHead className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-5 py-3.5 text-right">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {filteredWorkers.map((worker) => {
                    const age = calculateAge(worker.birthDate);
                    const workerRecipes = getCitizenRecipes(worker.id);
                    const hasPendingRecipe = workerRecipes.some(r => r.status === 'requested');

                    return (
                      <TableRow
                        key={worker.id}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedWorkerForExpediente(worker)}
                      >
                        {/* Name & DNI */}
                        <TableCell className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0 border border-blue-200 shadow-xs">
                              {worker.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs text-slate-900 uppercase tracking-tight truncate">
                                  {worker.fullName}
                                </span>
                                {hasPendingRecipe && (
                                  <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-[8px] font-black px-1.5 py-0 leading-none">
                                    <Pill className="w-2.5 h-2.5 mr-0.5 inline" /> FÁRMACO
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-blue-700 font-mono tracking-tight">
                                V-{worker.dni}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Location / Sector */}
                        <TableCell className="px-5 py-3.5">
                          <div className="flex flex-col text-xs">
                            <span className="font-bold text-slate-800 uppercase tracking-tight truncate max-w-[220px]">
                              {isForeignerCommune(commune)
                                ? (worker.originLocation || worker.sector || "Municipio Vecino")
                                : (worker.sector || "Sector No especificado")}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[220px]">
                              {worker.address || "Sin dirección exacta"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Age & Gender */}
                        <TableCell className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                age !== null && age >= 60
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {age !== null ? `${age} años` : 'S/E'}
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {worker.gender === 'masculino' || worker.gender === 'M' ? 'Masc' : 'Fem'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Social Area / Disability */}
                        <TableCell className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-slate-100 hover:bg-slate-100 text-slate-800 border-slate-200 text-[9px] font-bold uppercase tracking-wider">
                              {worker.socialArea
                                ? worker.socialArea.replace('_', ' ')
                                : 'GENERAL'}
                            </Badge>
                            {worker.hasDisability && (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-black uppercase">
                                ♿ Discapacidad
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Action: Expediente */}
                        <TableCell className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkerForExpediente(worker);
                            }}
                            className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 font-black text-[10px] uppercase tracking-wider h-8 rounded-lg transition-all shadow-xs group/btn cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 mr-1 text-blue-600 group-hover/btn:text-white" />
                            Expediente
                            <ArrowRight className="w-3 h-3 ml-1 opacity-0 -translate-x-1 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 bg-slate-100/90 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="font-semibold text-slate-600">
              Mostrando <span className="font-bold text-slate-900">{filteredWorkers.length}</span> de <span className="font-bold text-slate-900">{workers.length}</span> ciudadanos de {commune}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="bg-white hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase h-8 px-4"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Worker Expediente Dialog */}
      {selectedWorkerForExpediente && (
        <Dialog
          open={!!selectedWorkerForExpediente}
          onOpenChange={(open) => !open && setSelectedWorkerForExpediente(null)}
        >
          <DialogContent className="max-w-[96vw] xl:max-w-[1400px] w-full max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl bg-white rounded-2xl z-[60]">
            <WorkerExpediente
              worker={selectedWorkerForExpediente}
              onClose={() => setSelectedWorkerForExpediente(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
