import React, { useEffect, useState } from 'react';
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
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserCog, 
  ShieldCheck, 
  ShieldAlert,
  Loader2, 
  Trash2, 
  Ban, 
  Unlock,
  Crown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SearchCheck,
  Wrench,
  Database,
  FileCheck,
  Users
} from "lucide-react";
import { dataService } from '@/lib/dataService';
import { UserProfile, UserRole } from '@/types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { runSystemIntegrityAudit, SystemAuditReport, AuditAnomaly } from '@/utils/systemAuditUtils';

export default function UserManagement() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Pestaña activa: Gestión de Usuarios vs Auditoría de Integridad
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  // Estado del módulo de auditoría de integridad
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<SystemAuditReport | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await dataService.getAllUsers();
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error al obtener la lista de usuarios. Por favor, reintente.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (!isSuperAdmin) {
      toast.error("Acción denegada: Solo el Super Administrador puede modificar roles.");
      return;
    }
    try {
      await dataService.updateUserRole(uid, newRole);
      toast.success(`Rol cambiado correctamente a ${newRole.toUpperCase()}`);
      fetchUsers();
    } catch (error) {
      toast.error("Error al actualizar el rol");
    }
  };

  const handleToggleBlock = async (uid: string, currentBlocked: boolean) => {
    if (!isSuperAdmin) {
      toast.error("Acción denegada: Solo el Super Administrador puede bloquear usuarios.");
      return;
    }
    try {
      toast.loading(currentBlocked ? "Desbloqueando usuario..." : "Bloqueando usuario...");
      await dataService.updateUserBlockedStatus(uid, !currentBlocked);
      toast.dismiss();
      toast.success(currentBlocked ? "Usuario desbloqueado con éxito" : "Usuario bloqueado con éxito");
      fetchUsers();
    } catch (error) {
      toast.dismiss();
      toast.error("Error al cambiar estado de bloqueo");
    }
  };

  const handleDeleteUser = async (uid: string, fullName: string) => {
    if (!isSuperAdmin) {
      toast.error("Acción denegada: Solo el Super Administrador puede eliminar usuarios.");
      return;
    }
    const confirmed = window.confirm(`¿Está completamente seguro de eliminar permanentemente al usuario "${fullName || 'sin nombre'}" del sistema?`);
    if (confirmed) {
      try {
        toast.loading("Eliminando usuario...");
        await dataService.deleteUserProfile(uid);
        toast.dismiss();
        toast.success("Usuario eliminado exitosamente");
        fetchUsers();
      } catch (error) {
        toast.dismiss();
        toast.error("Error al eliminar el usuario");
      }
    }
  };

  // Ejecución de auditoría de integridad y detección de acciones/registros corruptos
  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      const [workersList, recipesList, usersList, evaluationsList] = await Promise.all([
        dataService.getWorkers(true),
        dataService.getMedicationRecipes(true),
        dataService.getAllUsers(),
        dataService.getAllEvaluations(300)
      ]);

      const report = runSystemIntegrityAudit({
        users: usersList,
        workers: workersList,
        recipes: recipesList,
        evaluations: evaluationsList
      });

      setAuditReport(report);

      if (report.totalAnomalies === 0) {
        toast.success("Auditoría completada: No se detectaron acciones corruptas ni registros huérfanos.");
      } else {
        toast.warning(`Auditoría completada: Se identificaron ${report.totalAnomalies} observaciones para revisión.`);
      }
    } catch (error) {
      console.error("Error al ejecutar auditoría de integridad:", error);
      toast.error("Error al escanear la base de datos.");
    } finally {
      setIsAuditing(false);
    }
  };

  // Ejecutar auditoría inicial automática al cambiar a la pestaña de auditoría si aún no se ha ejecutado
  useEffect(() => {
    if (activeTab === 'audit' && !auditReport && !isAuditing) {
      handleRunAudit();
    }
  }, [activeTab]);

  // Sanear registros huérfanos detectados
  const handleSanitizeOrphans = async () => {
    if (!auditReport) return;
    const orphans = auditReport.anomalies.filter(a => a.id.startsWith('recipe_orphan_') && a.recordId);
    if (orphans.length === 0) {
      toast.info("No hay registros huérfanos que sanear.");
      return;
    }

    const confirmed = window.confirm(`¿Desea sanear y eliminar ${orphans.length} requerimientos huérfanos que hacen referencia a ciudadanos inexistentes?`);
    if (!confirmed) return;

    setIsFixing(true);
    toast.loading("Saneando registros huérfanos...");
    try {
      for (const o of orphans) {
        if (o.recordId) {
          await dataService.deleteMedicationRecipe(o.recordId);
        }
      }
      toast.dismiss();
      toast.success(`${orphans.length} registros huérfanos saneados exitosamente.`);
      await handleRunAudit();
    } catch (err) {
      toast.dismiss();
      toast.error("Error al sanear registros huérfanos.");
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* CABECERA Y SELECTOR DE PESTAÑAS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <UserCog className="text-blue-600 w-6 h-6" /> Control de Acceso y Auditoría del Sistema
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium font-sans mt-0.5">
            Alcaldía Bolivariana del Municipio Juan Antonio Sotillo &bull; Dirección de Bienestar Social
          </p>
        </div>

        {/* SELECTOR SEGMENTADO DE MODOS */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl border border-slate-300/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-blue-600" />
            <span>Directorio de Personal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SearchCheck className="w-4 h-4 text-cyan-300" />
            <span>Auditoría de Integridad</span>
            {auditReport && auditReport.criticalErrorsCount > 0 && (
              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                {auditReport.criticalErrorsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: DIRECTORIO DE USUARIOS Y GESTIÓN DE ROLES */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <Card className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between p-4 sm:p-5">
              <div>
                <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-widest">Personal Registrado con Acceso</CardTitle>
                <CardDescription className="text-[11px] font-medium text-slate-400 mt-0.5">Control de cuentas autenticadas mediante Google Oficial</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchUsers}
                disabled={loading}
                className="text-xs font-bold gap-1.5 h-8 text-slate-700 border-slate-300"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600 opacity-60" />
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Verificando personal...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/40">
                      <TableRow className="hover:bg-transparent border-b border-slate-100">
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-3.5">Usuario</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-3.5">Email Google</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-3.5">Rol Asignado</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-3.5">Estado</TableHead>
                        {isSuperAdmin && (
                          <TableHead className="text-right text-[10px] font-black text-purple-700 uppercase tracking-widest px-6 py-3.5 min-w-[300px]">
                            Acciones de Control (Super Admin)
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => {
                        const isSelf = u.uid === currentUser?.uid;
                        const isUserSuperAdmin = u.role === 'superadmin' || u.email === 'direccioncondominiossotillo@gmail.com';
                        const isUserAdmin = !isUserSuperAdmin && u.role === 'admin';

                        return (
                          <TableRow key={u.uid} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                            <TableCell className="px-6 py-3.5">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 leading-tight uppercase text-xs sm:text-sm">
                                  {u.fullName || 'Sin Nombre'} {isSelf && <span className="text-[10px] text-blue-600 font-mono font-bold normal-case ml-1">(Tú)</span>}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-3.5">
                              <span className="text-xs font-mono font-medium text-slate-600">{u.email}</span>
                            </TableCell>
                            <TableCell className="px-6 py-3.5">
                              {isUserSuperAdmin ? (
                                <Badge 
                                  variant="outline" 
                                  className="bg-purple-50 text-purple-800 border-purple-200 text-[9px] font-black px-2.5 py-0.5"
                                >
                                  <Crown className="w-3 h-3 mr-1 text-purple-600" /> SUPER ADMINISTRADOR
                                </Badge>
                              ) : isUserAdmin ? (
                                <Badge 
                                  variant="outline" 
                                  className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-black px-2.5 py-0.5"
                                >
                                  <ShieldCheck className="w-3 h-3 mr-1" /> ADMINISTRADOR
                                </Badge>
                              ) : (
                                <Badge 
                                  variant="outline" 
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-black px-2.5 py-0.5"
                                >
                                  <ShieldAlert className="w-3 h-3 mr-1" /> EDITOR
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="px-6 py-3.5">
                              {u.blocked ? (
                                <Badge 
                                  variant="outline" 
                                  className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-black px-2.5 py-0.5"
                                >
                                  <Ban className="w-3 h-3 mr-1" /> BLOQUEADO
                                </Badge>
                              ) : (
                                <Badge 
                                  variant="outline" 
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-black px-2.5 py-0.5"
                                >
                                  <ShieldCheck className="w-3 h-3 mr-1" /> ACTIVO
                                </Badge>
                              )}
                            </TableCell>
                            {isSuperAdmin && (
                              <TableCell className="px-6 py-3.5 text-right min-w-[300px] whitespace-nowrap">
                                {isUserSuperAdmin ? (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 uppercase">
                                    <Crown className="w-3.5 h-3.5 text-purple-600" /> Cuenta Principal Protegida
                                  </span>
                                ) : (
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRoleChange(u.uid, u.role === 'admin' ? 'editor' : 'admin')}
                                      className="text-[10px] font-black uppercase px-2.5 h-8 bg-white hover:bg-slate-50 border-slate-300 text-slate-700 cursor-pointer"
                                    >
                                      Hacer {u.role === 'admin' ? 'Editor' : 'Administrador'}
                                    </Button>

                                    <Button 
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleToggleBlock(u.uid, !!u.blocked)}
                                      className={`text-[10px] font-black uppercase px-2.5 h-8 border shadow-sm flex items-center gap-1 cursor-pointer ${
                                        u.blocked 
                                          ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700" 
                                          : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700"
                                      }`}
                                    >
                                      {u.blocked ? (
                                        <><Unlock className="w-3 h-3" /> Desbloquear</>
                                      ) : (
                                        <><Ban className="w-3 h-3" /> Bloquear</>
                                      )}
                                    </Button>

                                    <Button 
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteUser(u.uid, u.fullName)}
                                      className="text-[10px] font-black uppercase px-2.5 h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex gap-3.5 items-start">
            <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-blue-900 uppercase">Jerarquía de Seguridad y Privilegios</h4>
              <p className="text-xs text-blue-700 font-medium leading-relaxed mt-1 font-sans">
                El <strong>Super Administrador</strong> posee control total exclusivo sobre asignación de roles, eliminación de cuentas y auditoría de la base de datos.<br />
                Los <strong>Administradores</strong> tienen acceso a métricas, informes ejecutivos, impacto territorial y censo poblacional.<br />
                Los <strong>Editores</strong> registran y actualizan expedientes de salud y entregas de farmacia.
              </p>
            </div>
          </div>

          {isSuperAdmin && (
            <Card className="border border-red-200 bg-red-50/20 rounded-xl overflow-hidden mt-6 shadow-sm">
              <CardHeader className="bg-red-50/50 border-b border-red-100 p-4 sm:p-5">
                <CardTitle className="text-xs sm:text-sm font-black text-red-700 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" /> Zona de Peligro: Restablecer a Cero (Exclusivo Super Administrador)
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-red-500 mt-0.5">
                  Acción irreversible para vaciar datos e iniciar nuevo ciclo operativo
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <p className="text-xs text-slate-600 leading-normal font-medium font-sans">
                  Esta opción permite eliminar todos los expedientes de pacientes, historias clínicas, evaluaciones físicas y recetas de farmacia. No elimina las cuentas de usuario de personal.
                </p>
                <Button 
                  variant="destructive"
                  onClick={async () => {
                    const confirm1 = window.confirm("¿ESTÁ COMPLETAMENTE SEGURO? Esta acción borrará permanentemente TODOS los pacientes, historias clínicas, de farmacia y evaluaciones.");
                    if (confirm1) {
                      const confirm2 = window.prompt("Para confirmar la eliminación total, escriba la palabra: ELIMINAR");
                      if (confirm2 === "ELIMINAR") {
                        try {
                          toast.loading("Restableciendo base de datos...");
                          await dataService.resetAllDatabase();
                          toast.dismiss();
                          toast.success("Base de datos restablecida correctamente a cero");
                          setTimeout(() => window.location.reload(), 1500);
                        } catch (e) {
                          toast.dismiss();
                          toast.error("Error al restablecer la base de datos");
                        }
                      } else if (confirm2 !== null) {
                        toast.error("Confirmación incorrecta. No se realizaron cambios.");
                      }
                    }
                  }}
                  className="w-full sm:w-auto text-[10px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white rounded-lg h-9 px-5 font-sans cursor-pointer"
                >
                  VACIAR BASE DE DATOS (VOLVER A CERO)
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* PESTAÑA 2: AUDITORÍA DE INTEGRIDAD Y DETECCIÓN DE CORRUPCIÓN */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          
          {/* TARJETA PRINCIPAL DEL ESTADO DE SALUD DEL SISTEMA */}
          <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md shrink-0 ${
                    auditReport && auditReport.healthScore >= 95 
                      ? 'bg-emerald-500 text-white' 
                      : auditReport && auditReport.healthScore >= 80 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-rose-500 text-white'
                  }`}>
                    {auditReport ? `${auditReport.healthScore}%` : '...'}
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <span>Auditoría de Salud e Integridad del Sistema</span>
                    </CardTitle>
                    <CardDescription className="text-slate-300 text-xs mt-0.5 font-medium">
                      Escaneo de expedientes, recetas, usuarios e integridad referencial de base de datos
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRunAudit}
                    disabled={isAuditing}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl gap-1.5 h-9 px-4 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                    <span>{isAuditing ? 'Escaneando...' : 'Re-escanear Base de Datos'}</span>
                  </Button>

                  {auditReport && auditReport.stats.orphanRecipesCount > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSanitizeOrphans}
                      disabled={isFixing}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl gap-1.5 h-9 px-4 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Sanear Huérfanos ({auditReport.stats.orphanRecipesCount})</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-6">
              
              {/* TARJETAS DE INDICADORES DE AUDITORÍA */}
              {auditReport ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    
                    {/* Expedientes de Salud */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Expedientes Totales</span>
                        <FileCheck className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="mt-2">
                        <p className="text-2xl font-black text-slate-900">{auditReport.stats.totalWorkers.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-bold">
                          {auditReport.stats.duplicateWorkersCount > 0 ? (
                            <span className="text-rose-600 flex items-center gap-0.5">
                              ⚠️ {auditReport.stats.duplicateWorkersCount} C.I. duplicadas
                            </span>
                          ) : (
                            <span className="text-emerald-700 flex items-center gap-0.5">
                              ✓ 0 duplicados
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Control de Farmacia e Insumos */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Recetas y Solicitudes</span>
                        <Database className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="mt-2">
                        <p className="text-2xl font-black text-slate-900">{auditReport.stats.totalRecipes.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-bold">
                          {auditReport.stats.orphanRecipesCount > 0 ? (
                            <span className="text-rose-600 flex items-center gap-0.5">
                              ⚠️ {auditReport.stats.orphanRecipesCount} huérfanas
                            </span>
                          ) : (
                            <span className="text-emerald-700 flex items-center gap-0.5">
                              ✓ 0 huérfanas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Usuarios y Cuentas */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Personal Autorizado</span>
                        <Users className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="mt-2">
                        <p className="text-2xl font-black text-slate-900">{auditReport.stats.totalUsers.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-bold">
                          <span className="text-emerald-700">{auditReport.stats.activeUsers} activos</span>
                          {auditReport.stats.blockedUsers > 0 && (
                            <span className="text-amber-700">· {auditReport.stats.blockedUsers} bloqueados</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Estado Global */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                      auditReport.totalAnomalies === 0 
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                        : 'bg-amber-50/70 border-amber-200 text-amber-950'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider">Diagnóstico de Corrupción</span>
                        {auditReport.totalAnomalies === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-2xl font-black">
                          {auditReport.totalAnomalies === 0 ? "100% LIMPIO" : `${auditReport.totalAnomalies} ALERTAS`}
                        </p>
                        <p className="text-[11px] font-bold mt-1">
                          {auditReport.totalAnomalies === 0 
                            ? "Sin registros corruptos" 
                            : `${auditReport.criticalErrorsCount} críticos · ${auditReport.warningsCount} leves`}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* DESGLOSE DETALLADO DE OBSERVACIONES Y ANOMALÍAS */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                          Registro Detallado de Hallazgos ({auditReport.anomalies.length})
                        </h4>
                      </div>

                      {/* Filtro de severidad */}
                      <div className="flex items-center gap-1 text-[10px] font-bold">
                        <span className="text-slate-400 uppercase mr-1">Filtrar:</span>
                        {(['all', 'error', 'warning', 'info'] as const).map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setAnomalyFilter(f)}
                            className={`px-2 py-0.5 rounded transition-colors uppercase ${
                              anomalyFilter === f 
                                ? 'bg-slate-900 text-white font-black' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            {f === 'all' ? 'Todos' : f === 'error' ? 'Críticos' : f === 'warning' ? 'Advertencias' : 'Informativos'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {auditReport.anomalies.length === 0 ? (
                      <div className="py-12 px-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-center space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                        <h5 className="text-sm font-black uppercase tracking-wider text-emerald-900">
                          ¡No se encontraron acciones ni registros corruptos en el sistema!
                        </h5>
                        <p className="text-xs text-emerald-700 max-w-lg mx-auto font-medium">
                          Todos los expedientes de ciudadanos poseen cédulas válidas, las recetas de farmacia cuentan con sus titulares vinculados, no hay duplicados y los accesos de usuario cumplen con los protocolos oficiales.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {auditReport.anomalies
                          .filter(a => anomalyFilter === 'all' || a.type === anomalyFilter)
                          .map((a) => (
                            <div 
                              key={a.id}
                              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                                a.type === 'error'
                                  ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                                  : a.type === 'warning'
                                  ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-[9px] font-black uppercase ${
                                    a.type === 'error' 
                                      ? 'bg-rose-600 text-white' 
                                      : a.type === 'warning' 
                                      ? 'bg-amber-600 text-white' 
                                      : 'bg-slate-600 text-white'
                                  }`}>
                                    {a.type === 'error' ? 'Crítico' : a.type === 'warning' ? 'Advertencia' : 'Informativo'}
                                  </Badge>
                                  <span className="text-xs font-black uppercase tracking-tight">{a.title}</span>
                                </div>
                                <p className="text-[11px] leading-relaxed opacity-90 font-medium">
                                  {a.description}
                                </p>
                              </div>

                              {a.recordIdentifier && (
                                <Badge variant="outline" className="font-mono text-[10px] font-bold shrink-0 bg-white">
                                  {a.recordIdentifier}
                                </Badge>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 opacity-60" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Ejecutando escaneo integral de base de datos...
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Auditando tablas de expedientes, farmacia, usuarios y reglas de seguridad.
                  </p>
                </div>
              )}

            </CardContent>
          </Card>

        </div>
      )}

    </div>
  );
}
