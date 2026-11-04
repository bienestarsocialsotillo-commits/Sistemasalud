/**
 * Utilidad de Auditoría de Integridad y Detección de Corrupción del Sistema
 * Alcaldía Bolivariana del Municipio Juan Antonio Sotillo · Dirección de Bienestar Social
 */

import { Worker, MedicationRecipe, UserProfile, Evaluation, MedicalHistory } from '../types';
import { normalizeDni } from './securityDni';

export interface AuditAnomaly {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'users' | 'workers' | 'recipes' | 'evaluations';
  title: string;
  description: string;
  recordId?: string;
  recordIdentifier?: string; // DNI, email, etc.
  autoFixable?: boolean;
}

export interface SystemAuditReport {
  timestamp: string;
  healthScore: number; // 0 to 100
  totalAnomalies: number;
  criticalErrorsCount: number;
  warningsCount: number;
  stats: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    totalWorkers: number;
    duplicateWorkersCount: number;
    invalidDniCount: number;
    totalRecipes: number;
    orphanRecipesCount: number;
    deliveryInconsistenciesCount: number;
    totalEvaluations: number;
  };
  anomalies: AuditAnomaly[];
}

/**
 * Realiza un escaneo exhaustivo en memoria de todas las entidades del sistema
 * para detectar registros corruptos, huérfanos, inconsistencias o anomalías.
 */
export function runSystemIntegrityAudit({
  users = [],
  workers = [],
  recipes = [],
  evaluations = [],
  medicalHistories = []
}: {
  users?: UserProfile[];
  workers?: Worker[];
  recipes?: MedicationRecipe[];
  evaluations?: Evaluation[];
  medicalHistories?: MedicalHistory[];
}): SystemAuditReport {
  const anomalies: AuditAnomaly[] = [];
  const workerIdSet = new Set(workers.map(w => w.id));
  const workerDniMap = new Map<string, Worker[]>();

  // 1. AUDITORÍA DE USUARIOS Y ROLES
  let blockedUsersCount = 0;
  users.forEach(u => {
    if (u.blocked) {
      blockedUsersCount++;
      anomalies.push({
        id: `user_blocked_${u.uid}`,
        type: 'warning',
        category: 'users',
        title: 'Usuario Bloqueado en el Sistema',
        description: `El usuario "${u.fullName || 'Sin Nombre'}" (${u.email}) tiene el acceso revocado.`,
        recordId: u.uid,
        recordIdentifier: u.email
      });
    }

    if (!u.email) {
      anomalies.push({
        id: `user_no_email_${u.uid}`,
        type: 'error',
        category: 'users',
        title: 'Usuario sin Correo Electrónico',
        description: `El usuario con UID ${u.uid} no tiene correo institucional registrado.`,
        recordId: u.uid
      });
    }

    if (!['superadmin', 'admin', 'editor'].includes(u.role)) {
      anomalies.push({
        id: `user_invalid_role_${u.uid}`,
        type: 'error',
        category: 'users',
        title: 'Rol de Usuario Desconocido',
        description: `El usuario ${u.email} posee un rol no reconocido ("${u.role}").`,
        recordId: u.uid,
        recordIdentifier: u.email,
        autoFixable: true
      });
    }
  });

  // 2. AUDITORÍA DE EXPEDIENTES (WORKERS)
  let invalidDniCount = 0;
  workers.forEach(w => {
    // Normalización de DNI para detectar duplicados
    const rawDni = (w.dni || '').trim();
    const cleanDni = normalizeDni(rawDni) || rawDni.toUpperCase();

    if (!rawDni || rawDni.length < 5) {
      invalidDniCount++;
      anomalies.push({
        id: `worker_invalid_dni_${w.id}`,
        type: 'warning',
        category: 'workers',
        title: 'Cédula de Identidad Inválida o Incompleta',
        description: `El ciudadano "${w.fullName || 'Sin Nombre'}" tiene una cédula no estándar: "${rawDni || 'VACÍA'}".`,
        recordId: w.id,
        recordIdentifier: rawDni
      });
    } else {
      const existing = workerDniMap.get(cleanDni) || [];
      existing.push(w);
      workerDniMap.set(cleanDni, existing);
    }

    if (!w.fullName || w.fullName.trim().length < 3) {
      anomalies.push({
        id: `worker_no_name_${w.id}`,
        type: 'error',
        category: 'workers',
        title: 'Expediente sin Nombre Válido',
        description: `El expediente con ID ${w.id} (C.I. ${w.dni || 'S/D'}) no tiene nombre completo registrado.`,
        recordId: w.id,
        recordIdentifier: w.dni
      });
    }

    if (!w.commune || w.commune.trim() === '' || w.commune === 'NO ESPECIFICADA') {
      anomalies.push({
        id: `worker_no_commune_${w.id}`,
        type: 'info',
        category: 'workers',
        title: 'Comuna no Asignada',
        description: `El ciudadano "${w.fullName}" (C.I. ${w.dni}) no tiene comuna registrada.`,
        recordId: w.id,
        recordIdentifier: w.dni
      });
    }
  });

  // Detección de Cédulas Duplicadas
  let duplicateWorkersCount = 0;
  workerDniMap.forEach((group, dniKey) => {
    if (group.length > 1) {
      duplicateWorkersCount += group.length - 1;
      anomalies.push({
        id: `worker_duplicate_dni_${dniKey}`,
        type: 'error',
        category: 'workers',
        title: 'Cédula de Identidad Duplicada',
        description: `Se detectaron ${group.length} expedientes con la misma cédula (${dniKey}): ${group.map(g => g.fullName).join(', ')}.`,
        recordIdentifier: dniKey,
        autoFixable: true
      });
    }
  });

  // 3. AUDITORÍA DE RECETAS Y DESPACHOS DE FARMACIA
  let orphanRecipesCount = 0;
  let deliveryInconsistenciesCount = 0;

  recipes.forEach(r => {
    // A) Registro huérfano (workerId no existe en la lista de ciudadanos)
    if (!r.workerId || !workerIdSet.has(r.workerId)) {
      orphanRecipesCount++;
      anomalies.push({
        id: `recipe_orphan_${r.id}`,
        type: 'error',
        category: 'recipes',
        title: 'Requerimiento Huérfano (Sin Ciudadano Titular)',
        description: `La solicitud de "${r.medication || r.technicalAidType || r.supplyName || 'Insumo'}" (ID ${r.id}) hace referencia a un ciudadano que no existe o fue eliminado.`,
        recordId: r.id,
        autoFixable: true
      });
    }

    // B) Inconsistencias en el estatus de entrega
    if (r.status === 'delivered') {
      if (!r.deliveredAt && !r.deliveredBy) {
        deliveryInconsistenciesCount++;
        anomalies.push({
          id: `recipe_delivery_inconsistency_${r.id}`,
          type: 'warning',
          category: 'recipes',
          title: 'Entrega Registrada sin Metadatos de Auditoría',
          description: `El beneficio "${r.medication || r.technicalAidType || r.supplyName}" está marcado como entregado pero carece de fecha o funcionario registrado.`,
          recordId: r.id,
          autoFixable: true
        });
      }
    }

    // C) Cantidad cero o inválida
    const qty = Number(r.quantity);
    if (isNaN(qty) || qty <= 0) {
      anomalies.push({
        id: `recipe_invalid_qty_${r.id}`,
        type: 'warning',
        category: 'recipes',
        title: 'Cantidad de Insumo Inválida o en Cero',
        description: `La solicitud ID ${r.id} tiene una cantidad no numérica o menor o igual a cero (${r.quantity}).`,
        recordId: r.id,
        autoFixable: true
      });
    }

    // D) Insumo o medicamento vacío
    if (!r.medication && !r.technicalAidType && !r.supplyName && !r.derivationService) {
      anomalies.push({
        id: `recipe_empty_item_${r.id}`,
        type: 'error',
        category: 'recipes',
        title: 'Requerimiento sin Nombre de Insumo o Ayuda',
        description: `El registro ID ${r.id} no posee especificado el medicamento, ayuda técnica o derivación clínica.`,
        recordId: r.id
      });
    }
  });

  // 4. AUDITORÍA DE EVALUACIONES
  evaluations.forEach(ev => {
    if (ev.workerId && !workerIdSet.has(ev.workerId)) {
      anomalies.push({
        id: `eval_orphan_${ev.id}`,
        type: 'warning',
        category: 'evaluations',
        title: 'Evaluación Médica Huérfana',
        description: `La evaluación médica ID ${ev.id} pertenece a un expediente que ya no existe en el sistema.`,
        recordId: ev.id
      });
    }
  });

  // Cálculo del puntaje de salud del sistema
  const criticalErrorsCount = anomalies.filter(a => a.type === 'error').length;
  const warningsCount = anomalies.filter(a => a.type === 'warning').length;

  // Cada error crítico resta 5 puntos, cada advertencia resta 1 punto
  let calculatedScore = 100 - (criticalErrorsCount * 5) - (warningsCount * 1);
  if (calculatedScore < 0) calculatedScore = 0;

  return {
    timestamp: new Date().toISOString(),
    healthScore: calculatedScore,
    totalAnomalies: anomalies.length,
    criticalErrorsCount,
    warningsCount,
    stats: {
      totalUsers: users.length,
      activeUsers: users.length - blockedUsersCount,
      blockedUsers: blockedUsersCount,
      totalWorkers: workers.length,
      duplicateWorkersCount,
      invalidDniCount,
      totalRecipes: recipes.length,
      orphanRecipesCount,
      deliveryInconsistenciesCount,
      totalEvaluations: evaluations.length
    },
    anomalies
  };
}
