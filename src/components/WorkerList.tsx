import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  History, 
  ClipboardCheck, 
  UserPlus, 
  Filter, 
  Loader2,
  MapPin,
  Pill,
  BookOpen,
  ArrowRight,
  User,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
  Award
} from "lucide-react";
import SocialAreaReportModal from './SocialAreaReportModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import WorkerForm from './WorkerForm';
import MedicalHistoryForm from './MedicalHistoryForm';
import EvaluationForm from './EvaluationForm';
import RecipeForm from './RecipeForm';
import WorkerExpediente from './WorkerExpediente';
import DuplicateAuditModal from './DuplicateAuditModal';
import NoRequirementsModal from './NoRequirementsModal';
import { dataService } from '@/lib/dataService';
import { Worker, MedicationRecipe } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { SOCIAL_AREAS } from '@/constants';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, UserX } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkerList() {
  const { user, isAdmin } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [openDuplicateAudit, setOpenDuplicateAudit] = useState(false);
  const [openNoRequirements, setOpenNoRequirements] = useState(false);
  const [openSocialReport, setOpenSocialReport] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [actionType, setActionType] = useState<'history' | 'evaluation' | 'recipe' | 'expediente' | 'edit' | null>(null);

  // Filtros Avanzados
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [socialAreaFilter, setSocialAreaFilter] = useState('all');
  const [votingCenterFilter, setVotingCenterFilter] = useState('');
  const [requirementFilter, setRequirementFilter] = useState<'all' | 'none' | 'pending' | 'delivered'>('all');

  // Paginación por Lotes
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Reiniciar a la página 1 cuando cambia cualquier filtro o el tamaño de página
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, socialAreaFilter, votingCenterFilter, requirementFilter, pageSize]);

  const workersWithoutRequirements = useMemo(() => {
    const reqIds = new Set(recipes.map(r => r.workerId));
    return workers.filter(w => !reqIds.has(w.id));
  }, [workers, recipes]);

  const handleDeleteWorker = async (worker: Worker) => {
    if (window.confirm(`¿Está seguro de que desea eliminar a ${worker.fullName}? Esta acción no se puede deshacer.`)) {
      try {
        await dataService.deleteWorker(worker.id);
        toast.success("Paciente eliminado correctamente");
        fetchWorkers();
      } catch (error) {
        console.error("Error deleting worker:", error);
        toast.error("Error al eliminar el registro médico");
      }
    }
  };

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const [workersData, recipesData] = await Promise.all([
        dataService.getWorkers(),
        dataService.getMedicationRecipes()
      ]);
      setWorkers(workersData);
      setRecipes(recipesData);
    } catch (e) {
      console.error("Error fetching workers/recipes:", e);
    } finally {
      setLoading(false);
    }
  };

  const getPendingRecipesCount = (workerId: string) => {
    return recipes.filter(r => r.workerId === workerId && (r.status === 'pending' || !r.status)).length;
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const filteredWorkers = workers.filter(w => {
    // Búsqueda textual general optimizada para nombres y cédulas
    const terms = search.toLowerCase().trim();
    const cleanSearchDigits = terms.replace(/[^0-9]/g, '');
    const cleanWorkerDniDigits = (w.dni || '').replace(/[^0-9]/g, '');
    const matchesDniDigits = cleanSearchDigits.length > 0 && cleanWorkerDniDigits.includes(cleanSearchDigits);

    const matchesSearch = !search ||
      w.fullName.toLowerCase().includes(terms) ||
      w.dni.toLowerCase().includes(terms) ||
      matchesDniDigits ||
      w.commune.toLowerCase().includes(terms) ||
      (w.socialArea || '').toLowerCase().includes(terms) ||
      (w.workplaceDepartment || '').toLowerCase().includes(terms) ||
      (w.votingCenter || '').toLowerCase().includes(terms);

    // Filtro de Estatus de sistema
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;

    // Filtro de Área Social del Ciudadano (Soporte para 1 o 2 razones sociales)
    let matchesSocialArea = true;
    if (socialAreaFilter !== 'all') {
      if (socialAreaFilter === 'NONE') {
        matchesSocialArea = !w.socialArea || w.socialArea === '' || w.socialArea === 'NO_APLICA';
      } else {
        const areaUpper = socialAreaFilter.toUpperCase();
        matchesSocialArea = (w.socialAreas && w.socialAreas.some(a => a.toUpperCase() === areaUpper || a.toUpperCase().includes(areaUpper))) ||
          (w.socialArea ? w.socialArea.toUpperCase().includes(areaUpper) : false);
      }
    }

    // Filtro de Centro de Votación
    const matchesVotingCenter = !votingCenterFilter ||
      (w.votingCenter || '').toLowerCase().includes(votingCenterFilter.toLowerCase());

    // Filtro de Estado de Requerimientos / Farmacia
    let matchesRequirement = true;
    if (requirementFilter !== 'all') {
      const workerRecipes = recipes.filter(r => r.workerId === w.id);
      if (requirementFilter === 'none') {
        matchesRequirement = workerRecipes.length === 0;
      } else if (requirementFilter === 'pending') {
        matchesRequirement = workerRecipes.some(r => r.status === 'pending' || !r.status);
      } else if (requirementFilter === 'delivered') {
        matchesRequirement = workerRecipes.some(r => r.status === 'delivered');
      }
    }

    return matchesSearch && matchesStatus && matchesSocialArea && matchesVotingCenter && matchesRequirement;
  });

  // Cálculos de Paginación Reactiva por Lotes
  const totalItems = filteredWorkers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedWorkers = filteredWorkers.slice(startIndex, endIndex);

  // Generador de números de páginas con elipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (safeCurrentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const exportToExcel = () => {
    const dataToExport = filteredWorkers.map(w => ({
      'Nombre Completo': w.fullName,
      'Cédula': w.dni,
      'Fecha Nacimiento': w.birthDate,
      'Género': w.gender,
      'Estado Civil': w.civilStatus,
      'Dirección': w.address,
      'Teléfono': w.phone,
      'Email': w.email,
      'Comuna': w.commune,
      'Sector': w.sector,
      'Clasificación / Área Social': w.socialArea || 'Ninguna / No Aplica',
      'Dependencia / Ente Alcaldía': w.workplaceDepartment || 'N/A',
      'Centro de Votación': w.votingCenter || 'No registrado',
      'Nivel Académico': w.academicLevel || 'No registrado',
      'Título / Profesión': w.academicDegree || 'N/A',
      'Estatus': w.status === 'active' ? 'Activo' : 'Inactivo',
      'Fecha Registro': w.createdAt ? new Date((w.createdAt as any).toDate?.() || w.createdAt).toLocaleDateString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ciudadanos");
    XLSX.writeFile(workbook, `Censo_Salud_Sotillo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">Censo de Salud Municipal</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Alcaldía Municipio Juan Antonio Sotillo</p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setOpenNoRequirements(true)}
            className="bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100 font-bold shadow-2xs uppercase text-xs tracking-wider flex-1 sm:flex-initial h-10 gap-1.5"
            title="Ver ciudadanos del censo sin requerimientos o solicitudes registradas"
          >
            <UserX className="w-4 h-4 text-amber-700" />
            <span className="hidden sm:inline">Sin Requerimiento {isAdmin ? `(${workersWithoutRequirements.length})` : ''}</span>
            <span className="sm:hidden">Sin Req {isAdmin ? `(${workersWithoutRequirements.length})` : ''}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setOpenDuplicateAudit(true)}
            className="bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-black shadow-sm uppercase text-xs tracking-widest flex-1 sm:flex-initial h-10 gap-1.5"
            title="Escanear y verificar personas o cédulas duplicadas en el sistema"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">Auditoría Anti-Duplicados</span>
            <span className="sm:hidden">Anti-Duplicados</span>
          </Button>
          {isAdmin && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setOpenSocialReport(true)}
                className="bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100 font-bold shadow-xs uppercase text-xs tracking-wider flex-1 sm:flex-initial h-10 gap-1.5 cursor-pointer"
                title="Generar informe cuantitativo de ayudas entregadas por Razón Social (UBCH, Alcaldía, etc.)"
              >
                <Award className="w-4 h-4 text-indigo-700" />
                <span className="hidden md:inline">Informe por Razón Social</span>
                <span className="md:hidden">Informe Razón</span>
              </Button>

              <Button 
                variant="outline" 
                onClick={exportToExcel}
                className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold shadow-sm uppercase text-xs tracking-widest flex-1 sm:flex-initial h-10"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                <span className="hidden xs:inline">Exportar Excel</span>
                <span className="xs:hidden">Excel</span>
              </Button>
            </>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={
              <Button className="bg-blue-600 hover:bg-blue-700 font-bold shadow-md uppercase text-xs tracking-widest flex-1 sm:flex-initial h-10">
                <UserPlus className="w-4 h-4 mr-2" />
                Nueva Ficha
              </Button>
            } />
            <DialogContent className="max-w-[96vw] md:max-w-[90vw] lg:max-w-4xl xl:max-w-5xl w-full max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl">
              <DialogHeader className="p-3.5 sm:p-5 bg-slate-50 border-b border-slate-200">
                <DialogTitle className="uppercase font-black text-blue-900 tracking-tight text-base sm:text-lg text-center sm:text-left">Registro de Nuevo Trabajador / Paciente</DialogTitle>
              </DialogHeader>
              <div className="p-3 sm:p-6 md:p-7">
                <WorkerForm 
                  existingWorkers={workers}
                  onSelectExistingWorker={(existingW) => {
                    setOpen(false);
                    setSelectedWorker(existingW);
                    setActionType('expediente');
                  }}
                  onSuccess={() => { setOpen(false); fetchWorkers(); }} 
                  onSavedWithAction={(savedWorker, action) => {
                    fetchWorkers();
                    if (action === 'recipe') {
                      setOpen(false);
                      setSelectedWorker(savedWorker);
                      setActionType('recipe');
                    } else if (action === 'expediente') {
                      setOpen(false);
                      setSelectedWorker(savedWorker);
                      setActionType('expediente');
                    } else if (action === 'close') {
                      setOpen(false);
                    }
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!actionType} onOpenChange={(val) => !val && setActionType(null)}>
          <DialogContent className={actionType === 'expediente' ? "max-w-[96vw] xl:max-w-[1400px] w-full h-[92vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl" : "max-w-[95vw] md:max-w-[85vw] lg:max-w-4xl xl:max-w-5xl w-full max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl"}>
            {actionType !== 'expediente' && (
              <DialogHeader className="p-3.5 sm:p-5 bg-slate-50 border-b border-slate-200">
                <DialogTitle className="uppercase font-black text-blue-900 text-sm sm:text-base tracking-tight">
                  {actionType === 'history' && `Antecedentes Médicos: ${selectedWorker?.fullName}`}
                  {actionType === 'evaluation' && `Nueva Evaluación: ${selectedWorker?.fullName}`}
                  {actionType === 'recipe' && `Suministro de Fármacos: ${selectedWorker?.fullName}`}
                  {actionType === 'edit' && `Editar Ficha Base: ${selectedWorker?.fullName}`}
                </DialogTitle>
              </DialogHeader>
            )}
            
            <div className={actionType === 'expediente' ? "" : "p-3 sm:p-6"}>
                 {actionType === 'history' && selectedWorker && (
                   <MedicalHistoryForm workerId={selectedWorker.id} onSuccess={() => setActionType(null)} />
                 )}
                 {actionType === 'evaluation' && selectedWorker && (
                   <EvaluationForm workerId={selectedWorker.id} workerName={selectedWorker.fullName} onSuccess={() => setActionType(null)} />
                 )}
                 {actionType === 'recipe' && selectedWorker && (
                   <RecipeForm 
                     workerId={selectedWorker.id} 
                     workerName={selectedWorker.fullName} 
                     commune={selectedWorker.commune} 
                     hasDisability={selectedWorker.hasDisability}
                     workers={workers.some(w => w.id === selectedWorker.id) ? workers : [selectedWorker, ...workers]}
                     existingRecipes={recipes}
                     onSuccess={() => { setActionType(null); fetchWorkers(); }} 
                   />
                 )}
                 {actionType === 'edit' && selectedWorker && (
                   <WorkerForm worker={selectedWorker} existingWorkers={workers} onSuccess={() => { setActionType(null); fetchWorkers(); }} />
                 )}
                 {actionType === 'expediente' && selectedWorker && (
                   <WorkerExpediente worker={selectedWorker} onClose={() => setActionType(null)} />
                 )}
               </div>
             </DialogContent>
          </Dialog>

          <Button 
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="font-bold border-slate-300 uppercase text-xs tracking-widest flex-1 sm:flex-initial h-10"
          >
            <Filter className={`w-4 h-4 mr-2 ${showFilters ? 'text-white' : 'text-slate-500'}`} />
            Filtros {showFilters ? '▲' : '▼'}
          </Button>
        </div>
      </div>

      <Card className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Buscar por nombre, cédula o comuna..."
              className="pl-10 bg-white border-slate-300 rounded-lg text-sm w-full md:max-w-md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-sans">Filtrar por Área Social</label>
                <select 
                  value={socialAreaFilter} 
                  onChange={(e) => setSocialAreaFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg text-xs leading-5 font-semibold px-3 py-2 uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-blue-600 block w-full text-slate-700"
                >
                  <option value="all">Todas las Clasificaciones</option>
                  <option value="NONE">Sin Área Social / No aplica</option>
                  {SOCIAL_AREAS.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-sans">Eje / Centro de Votación</label>
                <Input 
                  placeholder="Buscar Centro de Votación..."
                  className="h-9 text-xs bg-white border-slate-300 uppercase font-bold"
                  value={votingCenterFilter}
                  onChange={(e) => setVotingCenterFilter(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-sans">Estatus de Atención</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg text-xs leading-5 font-semibold px-3 py-2 uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-blue-600 block w-full text-slate-700"
                >
                  <option value="all">Todos los estatus</option>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="retired">Dados de Alta / Fallecido</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-sans">Requerimientos / Farmacia</label>
                <select 
                  value={requirementFilter} 
                  onChange={(e) => setRequirementFilter(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg text-xs leading-5 font-semibold px-3 py-2 uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-blue-600 block w-full text-slate-700"
                >
                  <option value="all">📋 Todos los Pacientes</option>
                  <option value="none">⚠️ Sin Requerimiento Registrado</option>
                  <option value="pending">⏳ Con Requerimientos Pendientes</option>
                  <option value="delivered">✅ Con Requerimientos Entregados</option>
                </select>
              </div>

              {(socialAreaFilter !== 'all' || statusFilter !== 'all' || votingCenterFilter !== '' || requirementFilter !== 'all') && (
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => {
                      setStatusFilter('all');
                      setSocialAreaFilter('all');
                      setVotingCenterFilter('');
                      setRequirementFilter('all');
                    }}
                    className="text-xs uppercase font-black text-red-500 p-0 hover:text-red-650"
                  >
                    Restablecer Filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600 opacity-50" />
              <p className="text-sm font-bold tracking-widest uppercase text-slate-400">Sincronizando registros médicos...</p>
            </div>
          ) : (
            <div className="font-sans">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3.5 sm:px-4 py-2.5 sm:py-3 min-w-[190px]">Información del Ciudadano</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3.5 sm:px-4 py-2.5 sm:py-3 min-w-[150px]">Enfoque Social</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3.5 sm:px-4 py-2.5 sm:py-3 min-w-[150px]">Territorialización</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3.5 sm:px-4 py-2.5 sm:py-3 min-w-[90px]">Estatus</TableHead>
                    <TableHead className="text-right text-[10px] font-black text-slate-500 uppercase tracking-widest px-3.5 sm:px-4 py-2.5 sm:py-3 min-w-[150px] sticky right-0 bg-[#f8fafc] border-l border-slate-200/60 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)] z-10">Gestión Central</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWorkers.map((worker) => (
                    <TableRow key={worker.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 group">
                      <TableCell className="px-3.5 sm:px-4 py-2 sm:py-2.5">
                        <div className="flex items-center gap-2.5">
                           <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xs sm:text-sm shrink-0 border border-blue-200 shadow-xs group-hover:scale-105 transition-transform">
                              {worker.fullName.charAt(0)}
                           </div>
                           <div className="flex flex-col">
                             <span className="font-bold text-slate-900 leading-tight uppercase text-xs sm:text-sm">{worker.fullName}</span>
                                {getPendingRecipesCount(worker.id) > 0 && (
                                  <Badge className="bg-amber-55 text-amber-800 border-amber-200 text-[8px] font-black px-1.5 py-0.5 rounded-full my-auto ml-1">
                                    {getPendingRecipesCount(worker.id)} SOLICITADO
                                  </Badge>
                                )}
                             <span className="text-[10px] text-slate-500 font-bold tracking-tight">C.I. {worker.dni}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 sm:px-4 py-2 sm:py-2.5">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const areasList = (worker.socialAreas && worker.socialAreas.length > 0)
                              ? worker.socialAreas
                              : (worker.socialArea && worker.socialArea !== 'NO_APLICA'
                                  ? worker.socialArea.split(' / ')
                                  : []);

                            if (areasList.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {areasList.map((area, aIdx) => (
                                    <Badge 
                                      key={aIdx} 
                                      className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded-md border ${
                                        aIdx === 0 
                                          ? 'bg-blue-50 text-blue-800 border-blue-200' 
                                          : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                      }`}
                                    >
                                      {area}
                                    </Badge>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider italic">No clasificado</span>
                            );
                          })()}
                          {worker.workplaceDepartment && (
                            <span className="text-[8.5px] font-black text-blue-900 bg-blue-100/70 border border-blue-200 px-1.5 py-0.5 rounded-md w-fit flex items-center gap-1 uppercase tracking-tight">
                              🏢 {worker.workplaceDepartment}
                            </span>
                          )}
                          <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-tight">
                            {worker.votingCenter ? `🗳️ ${worker.votingCenter}` : "📍 Sin Centro de Votación"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 sm:px-4 py-2 sm:py-2.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{worker.commune}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 italic ml-4">{worker.sector}</span>
                          {(worker.isForeigner || worker.commune?.startsWith('OTRO') || worker.commune?.includes('FUERA')) && (
                            <span className="mt-0.5 ml-4 text-[8px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded w-fit">
                              FORÁNEO {worker.originLocation ? `• ${worker.originLocation}` : ''}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 sm:px-4 py-2 sm:py-2.5">
                        <Badge 
                          variant="outline" 
                          className={worker.status === "active" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[8.5px] font-black px-2 py-0.5 animate-pulse" 
                            : "bg-slate-50 text-slate-500 border-slate-200 text-[8.5px] font-black px-2 py-0.5"
                          }
                        >
                          {worker.status === "active" ? "ACTIVO" : "INACTIVO"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3.5 sm:px-4 py-2 sm:py-2.5 text-right min-w-[150px] sticky right-0 bg-white group-hover:bg-slate-50/95 transition-colors border-l border-slate-200/50 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)] z-10">
                        <div className="flex justify-end gap-1.5 md:gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-9 px-2.5 md:px-3 text-blue-600 font-bold hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg group"
                            onClick={() => { setSelectedWorker(worker); setActionType('expediente'); }}
                            title="Ver Expediente"
                          >
                            <BookOpen className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline text-xs uppercase tracking-tight">Expediente</span>
                            <ArrowRight className="w-3 h-3 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all hidden md:inline-block" />
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 data-[state=open]:bg-blue-50 data-[state=open]:text-blue-700 transition-all cursor-pointer"
                                title="Más acciones del protocolo"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            } />
                            <DropdownMenuContent 
                              align="end" 
                              side="bottom" 
                              sideOffset={6}
                              className="w-64 z-50 p-1.5 rounded-xl bg-white border border-slate-200 shadow-2xl animate-in fade-in-0 zoom-in-95"
                            >
                              <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400 px-3 py-1.5 tracking-widest border-b border-slate-100 pb-1 mb-1">
                                Protocolo de Salud
                              </DropdownMenuLabel>
                              
                              <DropdownMenuItem
                                className="flex items-center px-3 py-2 hover:bg-blue-50/80 rounded-lg cursor-pointer text-slate-700 focus:bg-blue-50 focus:text-blue-900"
                                onClick={() => { 
                                  setSelectedWorker(worker); 
                                  setActionType('expediente'); 
                                }}
                              >
                                <BookOpen className="w-4 h-4 mr-3 text-blue-600 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-slate-800 tracking-tight leading-normal">Ficha de Expediente</span>
                                  <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Historial consolidado</span>
                                </div>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="flex items-center px-3 py-2 hover:bg-indigo-50/80 rounded-lg cursor-pointer text-slate-700 focus:bg-indigo-50 focus:text-indigo-900 mt-0.5"
                                onClick={() => { 
                                  setSelectedWorker(worker); 
                                  setActionType('edit'); 
                                }}
                              >
                                <User className="w-4 h-4 mr-3 text-indigo-500 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-slate-800 tracking-tight leading-normal">Editar Ficha Base</span>
                                  <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Modificar datos, núcleo familiar</span>
                                </div>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="flex items-center px-3 py-2 hover:bg-blue-50/80 rounded-lg cursor-pointer text-slate-700 focus:bg-blue-50 focus:text-blue-900 mt-0.5"
                                onClick={() => { 
                                  setSelectedWorker(worker); 
                                  setActionType('history'); 
                                }}
                              >
                                <History className="w-4 h-4 mr-3 text-blue-500 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-slate-800 tracking-tight leading-normal">Cargar Antecedentes</span>
                                  <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Historia médica y de patología</span>
                                </div>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="flex items-center px-3 py-2 hover:bg-emerald-50/80 rounded-lg cursor-pointer text-slate-700 focus:bg-emerald-50 focus:text-emerald-900 mt-0.5"
                                onClick={() => { 
                                  setSelectedWorker(worker); 
                                  setActionType('evaluation'); 
                                }}
                              >
                                <ClipboardCheck className="w-4 h-4 mr-3 text-emerald-600 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-slate-800 tracking-tight leading-normal">Examen Físico</span>
                                  <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Evaluación periódica</span>
                                </div>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="flex items-center px-3 py-2 hover:bg-amber-50/80 rounded-lg cursor-pointer text-slate-700 focus:bg-amber-50 focus:text-amber-900 mt-0.5"
                                onClick={() => { 
                                  setSelectedWorker(worker); 
                                  setActionType('recipe'); 
                                }}
                              >
                                <Pill className="w-4 h-4 mr-3 text-amber-500 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-slate-800 tracking-tight leading-normal">Suministrar Fármacos / Insumos</span>
                                  <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Control de farmacia y ayudas</span>
                                </div>
                              </DropdownMenuItem>

                              {(isAdmin || worker.createdBy === user?.uid) && (
                                <>
                                  <DropdownMenuSeparator className="my-1 bg-slate-100" />
                                  <DropdownMenuItem
                                    className="flex items-center px-3 py-2 hover:bg-red-50 rounded-lg cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 font-black text-[9px] uppercase tracking-widest"
                                    onClick={() => handleDeleteWorker(worker)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2.5 text-red-500 shrink-0" />
                                    Eliminar Registro
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredWorkers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-24 text-slate-400 italic">
                        <div className="flex flex-col items-center gap-2">
                           <Search className="w-12 h-12 opacity-20" />
                           <p className="text-sm font-medium">No se encontraron registros para la búsqueda actual.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Barra de Paginación Inteligente */}
              {filteredWorkers.length > 0 && (
                <div className="p-3.5 sm:p-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                  {/* Lado izquierdo: Selector de filas e información de conteo */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3 text-slate-600 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700 text-xs">Mostrar:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(val) => setPageSize(Number(val))}
                      >
                        <SelectTrigger className="h-8 w-[72px] text-xs font-black bg-white rounded-lg border-slate-300 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="min-w-[72px]">
                          <SelectItem value="15" className="text-xs font-bold">15</SelectItem>
                          <SelectItem value="25" className="text-xs font-bold">25</SelectItem>
                          <SelectItem value="50" className="text-xs font-bold">50</SelectItem>
                          <SelectItem value="100" className="text-xs font-bold">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-slate-400 text-[11px] font-semibold">por pág.</span>
                    </div>

                    <span className="text-slate-300 hidden sm:inline">|</span>

                    <span className="text-slate-600 text-xs">
                      Mostrando <strong className="text-slate-900 font-black">{totalItems === 0 ? 0 : startIndex + 1}</strong> - <strong className="text-slate-900 font-black">{endIndex}</strong> de <strong className="text-slate-900 font-black">{totalItems}</strong> ciudadanos
                    </span>
                  </div>

                  {/* Lado derecho: Controles de navegación de página */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      onClick={() => setCurrentPage(1)}
                      disabled={safeCurrentPage <= 1}
                      title="Primera página"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 sm:px-2.5 rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={safeCurrentPage <= 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-0.5 sm:mr-1" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>

                    {/* Botones numéricos de página */}
                    <div className="flex items-center gap-1 px-1">
                      {getPageNumbers().map((pageItem, idx) => (
                        typeof pageItem === 'number' ? (
                          <Button
                            key={idx}
                            variant={pageItem === safeCurrentPage ? "default" : "outline"}
                            size="icon"
                            className={`h-8 w-8 text-xs font-black rounded-lg transition-all ${
                              pageItem === safeCurrentPage
                                ? 'bg-blue-700 text-white shadow-sm border-blue-700 hover:bg-blue-800'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                            onClick={() => setCurrentPage(pageItem)}
                          >
                            {pageItem}
                          </Button>
                        ) : (
                          <span key={idx} className="px-1 text-slate-400 text-xs font-black select-none">
                            ...
                          </span>
                        )
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 sm:px-2.5 rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={safeCurrentPage >= totalPages}
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="w-4 h-4 ml-0.5 sm:ml-1" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safeCurrentPage >= totalPages}
                      title="Última página"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DuplicateAuditModal
        isOpen={openDuplicateAudit}
        onClose={() => setOpenDuplicateAudit(false)}
        workers={workers}
        isAdmin={isAdmin}
        onSelectWorker={(w) => {
          setSelectedWorker(w);
          setActionType('expediente');
        }}
        onRefresh={fetchWorkers}
      />

      <NoRequirementsModal
        isOpen={openNoRequirements}
        onOpenChange={setOpenNoRequirements}
        workersWithoutRequirements={workersWithoutRequirements}
        totalWorkersCount={workers.length}
        onSelectWorkerForRecipe={(worker) => {
          setSelectedWorker(worker);
          setActionType('recipe');
          setOpenNoRequirements(false);
        }}
      />

      <SocialAreaReportModal
        isOpen={openSocialReport}
        onClose={() => setOpenSocialReport(false)}
        workers={workers}
        recipes={recipes}
        initialSocialArea={socialAreaFilter !== 'all' && socialAreaFilter !== 'NONE' ? socialAreaFilter : "JEFE UBCH"}
      />
    </div>
  );
}
