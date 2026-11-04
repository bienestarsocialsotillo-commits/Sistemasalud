import { Worker } from '../types';

/**
 * Normaliza una cédula venezolana al estándar oficial: Tipo (V/E/J/G/P) + '-' + Dígitos
 * Ejemplo:
 *   "12.345.678" -> "V-12345678"
 *   "v-12345678" -> "V-12345678"
 *   "E 84123456" -> "E-84123456"
 *   "V-14567890-HIJO1" -> "V-14567890-HIJO1"
 */
export function normalizeDni(rawDni: string): string {
  if (!rawDni) return '';
  const trimmed = rawDni.trim().toUpperCase();

  // Si tiene formato de menor dependiente con sufijo (-HIJO, -M, etc.)
  const minorMatch = trimmed.match(/^([VEJGP])?[-.\s]?(\d+)[-.\s]?(HIJO\d*|MENOR\d*|M\d*)$/i);
  if (minorMatch) {
    const prefix = (minorMatch[1] || 'V').toUpperCase();
    const num = minorMatch[2];
    const suffix = minorMatch[3].toUpperCase();
    return `${prefix}-${num}-${suffix}`;
  }

  // Extraer letra de nacionalidad inicial si existe
  let prefix = 'V';
  let rest = trimmed;
  if (/^[VEJGP][-\s.]/i.test(trimmed)) {
    prefix = trimmed[0].toUpperCase();
    rest = trimmed.substring(1);
  } else if (/^[VEJGP]\d+/i.test(trimmed)) {
    prefix = trimmed[0].toUpperCase();
    rest = trimmed.substring(1);
  }

  // Extraer dígitos limpios
  const digitsOnly = rest.replace(/\D/g, '');
  if (!digitsOnly) return trimmed;

  return `${prefix}-${digitsOnly}`;
}

/**
 * Extrae solo los dígitos numéricos de la cédula para comparaciones matemáticas
 */
export function cleanNumericDni(dni: string): string {
  if (!dni) return '';
  return dni.replace(/\D/g, '');
}

/**
 * Genera una cédula estándar para menores sin documento de identidad propio
 * basándose en la cédula del representante legal.
 */
export function generateMinorDni(repDni: string, childIndex: number = 1): string {
  const normRep = normalizeDni(repDni);
  const base = normRep || `V-${cleanNumericDni(repDni) || '00000000'}`;
  return `${base}-HIJO${childIndex}`;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  type: 'exact_dni' | 'numeric_match' | 'name_birth_match' | 'phone_match' | null;
  matchedWorker?: Worker;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Evalúa en memoria si un ciudadano ya existe o presenta riesgo de homónimo/clon
 */
export function detectDuplicateCitizen(
  candidate: {
    id?: string;
    dni?: string;
    fullName?: string;
    birthDate?: string;
    phone?: string;
  },
  existingWorkers: Worker[]
): DuplicateDetectionResult {
  if (!existingWorkers || existingWorkers.length === 0) {
    return { isDuplicate: false, type: null, message: '', severity: 'info' };
  }

  const candidateId = candidate.id;
  const candidateDni = (candidate.dni || '').trim();
  const normalizedCandidateDni = normalizeDni(candidateDni);
  const numericCandidateDni = cleanNumericDni(candidateDni);
  const cleanCandidateName = (candidate.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanCandidateBirth = (candidate.birthDate || '').trim();
  const candidatePhone = (candidate.phone || '').trim().replace(/\D/g, '');

  for (const w of existingWorkers) {
    if (candidateId && w.id === candidateId) continue;

    const wDni = (w.dni || '').trim();
    const normalizedWDni = normalizeDni(wDni);
    const numericWDni = cleanNumericDni(wDni);

    // 1. Coincidencia exacta o normalizada de Cédula (BLOQUEO CRÍTICO)
    if (normalizedCandidateDni && normalizedCandidateDni === normalizedWDni) {
      return {
        isDuplicate: true,
        type: 'exact_dni',
        matchedWorker: w,
        message: `La cédula ${candidateDni} ya está registrada a nombre de ${w.fullName}.`,
        severity: 'error'
      };
    }

    // 2. Coincidencia de solo dígitos (mismo número con o sin 'V-' o con puntos)
    if (numericCandidateDni.length >= 6 && numericCandidateDni === numericWDni) {
      return {
        isDuplicate: true,
        type: 'numeric_match',
        matchedWorker: w,
        message: `El número de cédula (${numericCandidateDni}) coincide con ${w.fullName} (${w.dni}).`,
        severity: 'error'
      };
    }

    // 3. Coincidencia de Nombre Completo + Fecha de Nacimiento (Alerta de posible error de tipeo en DNI)
    if (
      cleanCandidateName.length >= 8 &&
      cleanCandidateBirth &&
      cleanCandidateBirth !== 'SIN FECHA'
    ) {
      const wName = (w.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const wBirth = (w.birthDate || '').trim();
      if (wName === cleanCandidateName && wBirth === cleanCandidateBirth) {
        return {
          isDuplicate: true,
          type: 'name_birth_match',
          matchedWorker: w,
          message: `Coincidencia exacta de Nombre y Fecha de Nacimiento con ${w.fullName} (C.I. ${w.dni}). Verifique el documento físico para descartar un error en la cédula.`,
          severity: 'warning'
        };
      }
    }

    // 4. Coincidencia de Teléfono (Alerta secundaria informativa)
    if (
      candidatePhone.length >= 10 &&
      candidatePhone !== '0000000000' &&
      candidatePhone !== '1234567890'
    ) {
      const wPhone = (w.phone || '').trim().replace(/\D/g, '');
      if (wPhone === candidatePhone) {
        return {
          isDuplicate: false, // no bloqueante, solo informativo
          type: 'phone_match',
          matchedWorker: w,
          message: `El número telefónico coincide con el expediente de ${w.fullName} (C.I. ${w.dni}).`,
          severity: 'info'
        };
      }
    }
  }

  return { isDuplicate: false, type: null, message: '', severity: 'info' };
}
