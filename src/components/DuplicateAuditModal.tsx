import React, { useState, useMemo } from 'react';
import { Worker } from '../types';
import { dataService } from '../lib/dataService';
import { cleanNumericDni } from '../utils/securityDni';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  ShieldAlert, 
  AlertTriangle, 
  ArrowRight, 
  FolderOpen, 
  Merge, 
  CheckCircle2, 
  RefreshCw,
  Loader2,
  Calendar,
  Phone,
  MapPin,
  Search,
  X,
  User,
  Hash,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface DuplicateGroup {
  id: string;
  reason: 'dni' | 'name_birth' | 'phone';
  label: string;
  workers: Worker[];
}

interface DuplicateAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  isAdmin: boolean;
  onSelectWorker: (worker: Worker) => void;
  onRefresh: () => void;
}

export default function DuplicateAuditModal({
  isOpen,
  onClose,
  workers,
  isAdmin,
  onSelectWorker,
  onRefresh,
}: DuplicateAuditModalProps) {
  const [isMerging, setIsMerging] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'dni' | 'name_birth'>('all');
  const [candidateForMerge, setCandidateForMerge] = useState<{ primary: Worker; duplicate: Worker } | null>(null);

  // Analizar en memoria los grupos de posibles duplicados
  const duplicateGroups = useMemo(() => {
    const groups: DuplicateGroup[] = [];

    // 1. Agrupar por Cédula Limpia (solo dígitos)
    const dniMap = new Map<string, Worker[]>();
    for (const w of workers) {
      const numDni = cleanNumericDni(w.dni);
      if (numDni && numDni.length >= 5) {
        const list = dniMap.get(numDni) || [];
        list.push(w);
        dniMap.set(numDni, list);
      }
    }

    const processedWorkerIds = new Set<string>();

    dniMap.forEach((list, numDni) => {
      if (list.length > 1) {
        list.forEach(w => processedWorkerIds.add(w.id));
        groups.push({
          id: `dni-${numDni}`,
          reason: 'dni',
          label: `C.I. Coincidente (Dígitos: ${numDni})`,
          workers: list,
        });
      }
    });

    // 2. Agrupar por Nombre Completo + Fecha de Nacimiento
    const nameBirthMap = new Map<string, Worker[]>();
    for (const w of workers) {
      if (processedWorkerIds.has(w.id)) continue;
      const cleanName = (w.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const birth = (w.birthDate || '').trim();
      if (cleanName.length >= 8 && birth && birth !== 'SIN FECHA') {
        const key = `${cleanName}__${birth}`;
        const list = nameBirthMap.get(key) || [];
        list.push(w);
        nameBirthMap.set(key, list);
      }
    }

    nameBirthMap.forEach((list, key) => {
      if (list.length > 1) {
        const [name, birth] = key.split('__');
        groups.push({
          id: `nb-${key}`,
          reason: 'name_birth',
          label: `Posible Homónimo con Misma Fecha de Nacimiento (${birth})`,
          workers: list,
        });
      }
    });

    return groups;
  }, [workers]);

  // Filtrar grupos por término de búsqueda y tipo de conflicto
  const filteredGroups = useMemo(() => {
    return duplicateGroups.filter(group => {
      if (filterType !== 'all' && group.reason !== filterType) {
        return false;
      }
      if (!search.trim()) return true;

      const q = search.toLowerCase().trim();
      if (group.label.toLowerCase().includes(q)) return true;

      return group.workers.some(w => 
        (w.fullName || '').toLowerCase().includes(q) ||
        (w.dni || '').toLowerCase().includes(q) ||
        (w.phone || '').toLowerCase().includes(q) ||
        (w.commune || '').toLowerCase().includes(q) ||
        (w.sector || '').toLowerCase().includes(q)
      );
    });
  }, [duplicateGroups, search, filterType]);

  const executeMerge = async () => {
    if (!candidateForMerge) return;
    const { primary, duplicate } = candidateForMerge;

    if (!isAdmin) {
      toast.error("Solo los usuarios administradores pueden unificar registros.");
      return;
    }

    try {
      setIsMerging(duplicate.id);
      setCandidateForMerge(null);
      toast.loading("Unificando expedientes y reasignando requerimientos...");
      await dataService.mergeWorkers(primary.id, duplicate.id);
      toast.success("Expedientes fusionados exitosamente. Registro duplicado removido.");
      onRefresh();
    } catch (err: any) {
      console.error("Error fusionando:", err);
      toast.error("Error al fusionar expedientes: " + (err.message || "Error desconocido"));
    } finally {
      setIsMerging(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="w-[96vw] sm:w-[95vw] max-w-[96vw] lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1520px] h-[94dvh] sm:h-[92dvh] max-h-[94dvh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50 border border-slate-200 rounded-xl sm:rounded-3xl shadow-2xl">
          
          {/* Cabecera Fija */}
          <DialogHeader className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-4 sm:p-5 md:p-6 pr-14 shrink-0 relative border-b border-blue-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      Seguridad y Control de Calidad
                    </span>
                    <span className="text-[10px] font-bold text-blue-200">
                      Sotillo Salud
                    </span>
                  </div>
                  <DialogTitle className="text-base sm:text-lg md:text-xl font-black tracking-tight uppercase mt-1 text-white">
                    Auditoría Anti-Duplicados de Ciudadanos
                  </DialogTitle>
                  <DialogDescription className="text-xs text-blue-200/90 font-medium">
                    Verificación algorítmica de unicidad por cédula de identidad, homónimos y fechas de nacimiento.
                  </DialogDescription>
                </div>
              </div>

              {/* Botones Superiores de Acción */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  className="border-blue-400/40 text-blue-100 hover:bg-blue-800/40 bg-blue-900/40 text-xs font-bold uppercase tracking-wider h-9 px-3 rounded-xl gap-1.5 cursor-pointer shadow-2xs"
                  title="Volver a escanear el padrón"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-escanear</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-slate-300 hover:text-white hover:bg-white/10 h-9 w-9 rounded-xl cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Estadísticas de Auditoría */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-3.5 sm:mt-4 pt-3 sm:pt-4 border-t border-blue-900/60">
              <div className="bg-white/5 rounded-xl p-2.5 sm:p-3 border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">Total Censados</span>
                <span className="text-xl sm:text-2xl font-black text-white">{workers.length}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-2.5 sm:p-3 border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">Grupos con Conflicto</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">{duplicateGroups.length}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white/5 rounded-xl p-2.5 sm:p-3 border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">Estado de Integridad</span>
                <span className="text-xs sm:text-sm font-black text-emerald-400 block mt-0.5">
                  {duplicateGroups.length === 0 ? '✓ 100% Sin Duplicados' : `⚠️ ${duplicateGroups.length} Grupos para Revisión`}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Barra de Búsqueda y Filtros */}
          <div className="px-3 sm:px-5 md:px-6 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, cédula o sector..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs font-semibold bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-600 w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`h-8 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer shrink-0 ${
                  filterType === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Todos ({duplicateGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('dni')}
                className={`h-8 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  filterType === 'dni'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100/70 border border-amber-200/60'
                }`}
              >
                <Hash className="w-3 h-3" />
                <span>Por Cédula</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('name_birth')}
                className={`h-8 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  filterType === 'name_birth'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100/70 border border-blue-200/60'
                }`}
              >
                <User className="w-3 h-3" />
                <span>Por Homónimo y Fecha</span>
              </button>
            </div>
          </div>

          {/* Contenido / Listado con Scroll Independiente */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-slate-50 space-y-4">
            {duplicateGroups.length === 0 ? (
              <div className="py-16 px-6 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 max-w-xl mx-auto my-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black uppercase text-slate-800 tracking-tight">
                  Base de Datos Completamente Íntegra
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No se detectaron cédulas duplicadas, números clonados ni personas homónimas con la misma fecha de nacimiento entre los <strong>{workers.length} ciudadanos</strong> registrados en el sistema.
                </p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-12 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-2">
                <p className="text-sm font-black text-slate-700 uppercase">
                  No se encontraron coincidencias para la búsqueda
                </p>
                <p className="text-xs text-slate-500">
                  Intente con otro término o seleccione la pestaña &quot;Todos&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Grupos de Conflicto Detectados ({filteredGroups.length} de {duplicateGroups.length})
                  </p>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Revise cada caso y unifique los expedientes para consolidar solicitudes.
                  </span>
                </div>

                {filteredGroups.map((group) => (
                  <div 
                    key={group.id} 
                    className="bg-white rounded-2xl border-2 border-amber-200/90 shadow-sm p-3.5 sm:p-4 md:p-5 space-y-3.5 hover:border-amber-300 transition-colors"
                  >
                    {/* Encabezado del Grupo */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </span>
                        <div>
                          <span className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 block">
                            {group.label}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {group.reason === 'dni' 
                              ? 'Cédulas con numeración idéntica o formateada con prefijo distinto'
                              : 'Mismo nombre y fecha de nacimiento registrada'}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg self-start sm:self-auto shrink-0">
                        {group.workers.length} Registros Vinculados
                      </Badge>
                    </div>

                    {/* Comparación de los expedientes en cuadrícula responsiva */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                      {group.workers.map((w, index) => {
                        const isFirst = index === 0;
                        return (
                          <div 
                            key={w.id} 
                            className={`p-3.5 sm:p-4 rounded-xl border text-xs space-y-3 relative transition-all ${
                              isFirst 
                                ? 'bg-blue-50/60 border-blue-200 ring-1 ring-blue-300/40 shadow-2xs' 
                                : 'bg-slate-50/80 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {/* Cabecera del Expediente Individual */}
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                                isFirst
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'bg-slate-200 text-slate-800'
                              }`}>
                                {isFirst ? '★ Expediente Base (Sugerido Principal)' : `Expediente Duplicado #${index + 1}`}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={w.id}>
                                ID: {w.id.substring(0, 8)}...
                              </span>
                            </div>

                            {/* Datos del Ciudadano */}
                            <div>
                              <p className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                                {w.fullName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono font-black text-xs sm:text-sm text-blue-900 bg-white border border-blue-200 px-2 py-0.5 rounded-md shadow-2xs">
                                  C.I. {w.dni}
                                </span>
                                {w.isForeigner && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px] font-bold">
                                    Foráneo
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Metadatos Clave */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 text-[11px] bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span><strong>F. Nac:</strong> {w.birthDate || 'SIN FECHA'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span><strong>Tel:</strong> {w.phone || 'NO POSEE'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:col-span-2">
                                <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span className="truncate"><strong>Comuna:</strong> {w.commune} {w.sector ? `(${w.sector})` : ''}</span>
                              </div>
                            </div>

                            {/* Barra de Acciones del Registro */}
                            <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  onClose();
                                  onSelectWorker(w);
                                }}
                                className="h-8.5 text-xs font-bold uppercase tracking-wider gap-1.5 text-blue-700 border-blue-200 bg-white hover:bg-blue-50 cursor-pointer rounded-xl flex-1 justify-center shadow-2xs"
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                                <span>Ver Expediente</span>
                              </Button>

                              {isAdmin && !isFirst && (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isMerging === w.id}
                                  onClick={() => setCandidateForMerge({ primary: group.workers[0], duplicate: w })}
                                  className="h-8.5 text-xs font-black uppercase tracking-wider gap-1.5 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer rounded-xl shadow-xs flex-1 justify-center"
                                >
                                  {isMerging === w.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Merge className="w-3.5 h-3.5" />
                                  )}
                                  <span>Fusionar en Principal</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Seguro de Confirmación de Fusión */}
      {candidateForMerge && (
        <Dialog open={!!candidateForMerge} onOpenChange={(open) => { if (!open) setCandidateForMerge(null); }}>
          <DialogContent className="w-[94vw] sm:w-full max-w-[94vw] sm:max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xl space-y-4">
            <DialogHeader className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
                <Merge className="w-6 h-6" />
              </div>
              <DialogTitle className="text-base font-black uppercase text-center text-slate-900 tracking-tight">
                Confirmar Fusión de Expedientes
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 text-center leading-relaxed">
                Esta acción transferirá todas las solicitudes, récipes y registros médicos del expediente duplicado hacia el expediente principal, y posteriormente removerá el registro duplicado.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-[10px] font-black uppercase text-blue-800 block">Expediente Principal (Se Conserva):</span>
                <p className="font-bold text-slate-900">{candidateForMerge.primary.fullName}</p>
                <p className="font-mono text-[11px] text-blue-900 font-bold">C.I. {candidateForMerge.primary.dni}</p>
              </div>

              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-[10px] font-black uppercase text-amber-800 block">Expediente Duplicado (Se Absorbe y Elimina):</span>
                <p className="font-bold text-slate-900">{candidateForMerge.duplicate.fullName}</p>
                <p className="font-mono text-[11px] text-amber-900 font-bold">C.I. {candidateForMerge.duplicate.dni}</p>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCandidateForMerge(null)}
                className="w-full sm:w-auto h-9 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={executeMerge}
                className="w-full sm:w-auto h-9 text-xs font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white rounded-xl cursor-pointer shadow-xs"
              >
                Confirmar y Fusionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
