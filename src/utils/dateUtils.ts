import { format as dateFnsFormat } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Parses any date-like representation safely (Firestore Timestamp, ISO string, milliseconds, Date, etc.)
 * Returns a valid Date instance or null if unparseable. Never throws.
 */
export const parseDateSafe = (val: any): Date | null => {
  if (!val) return null;
  try {
    if (typeof val?.toDate === 'function') {
      const d = val.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    if (val?.seconds !== undefined) {
      const d = new Date(val.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;

      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;

      // Handle DD/MM/YYYY or DD-MM-YYYY format
      const parts = trimmed.split(/[/\-]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2].slice(0, 4), 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const customD = new Date(year, month, day);
          if (!isNaN(customD.getTime())) return customD;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Formats a date safely using date-fns and spanish locale.
 * Never throws RangeError: Invalid time value.
 */
export const formatDateSafe = (
  val: any,
  formatStr: string = 'dd/MM/yyyy',
  fallback: string = 'S/F'
): string => {
  const d = parseDateSafe(val);
  if (!d) return fallback;
  try {
    return dateFnsFormat(d, formatStr, { locale: es });
  } catch {
    return fallback;
  }
};
