import { MedicationRecipe } from '@/types';

export interface DistinctAidDay {
  dateKey: string; // YYYY-MM-DD
  date: Date;
  recipes: MedicationRecipe[];
  businessDaysAgo: number;
}

export interface AidLimitStatus {
  totalAidsInWindow: number; // Number of distinct days with aids in the last 30 business days
  isBlocked: boolean; // true if totalAidsInWindow >= 2
  canProceedNormally: boolean; // true if totalAidsInWindow < 2
  isWarning: boolean; // true if totalAidsInWindow === 1
  remainingSlots: number; // 2 - totalAidsInWindow (capped at 0)
  aidDays: DistinctAidDay[]; // Distinct dates of aid in the window, ordered newest to oldest
  allAidDaysCount: number; // Total historic distinct aid days
  oldestAidInWindow?: DistinctAidDay; // The first aid in the current window (which will expire first)
  estimatedRenewalDate?: Date; // Date when oldest aid in window falls outside the 30-day window
  businessDaysUntilRenewal?: number; // How many business days until renewal
  formattedRenewalDate?: string;
}

/**
 * Returns true if the date is a Monday through Friday (business day).
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 is Sunday, 6 is Saturday
}

/**
 * Parses any date format from Firestore or JS into a valid Date object.
 */
export function parseDateSafe(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') {
    return raw.toDate();
  }
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (raw.seconds) {
    return new Date(raw.seconds * 1000);
  }
  return null;
}

/**
 * Formats a Date to YYYY-MM-DD for grouping
 */
export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Count the number of business days (Mon-Fri) between two dates.
 * If startDate >= endDate, returns 0.
 */
export function countBusinessDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start >= end) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    if (isBusinessDay(cur)) {
      count++;
    }
  }
  return count;
}

/**
 * Adds a specific number of business days to a starting date.
 */
export function addBusinessDays(startDate: Date, businessDaysToAdd: number): Date {
  const res = new Date(startDate);
  let added = 0;
  while (added < businessDaysToAdd) {
    res.setDate(res.getDate() + 1);
    if (isBusinessDay(res)) {
      added++;
    }
  }
  return res;
}

/**
 * Returns the Date representing N business days ago from referenceDate.
 */
export function getBusinessDaysAgoCutoff(businessDays: number, referenceDate: Date = new Date()): Date {
  const cur = new Date(referenceDate);
  cur.setHours(0, 0, 0, 0);
  let counted = 0;
  while (counted < businessDays) {
    cur.setDate(cur.getDate() - 1);
    if (isBusinessDay(cur)) {
      counted++;
    }
  }
  return cur;
}

/**
 * Format date in friendly Spanish format (e.g. "18 de Agosto de 2026")
 */
export function formatFriendlyDate(date: Date): string {
  return date.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Master evaluation function for the 30-business-day social aid limit rule.
 * Parameters:
 *  - Maximum 2 social aids per person in a 30-business-day window.
 *  - Multiple items on the same calendar day count as 1 single aid day.
 */
export function checkSocialAidLimit(
  recipes: MedicationRecipe[],
  workerId: string,
  referenceDate: Date = new Date()
): AidLimitStatus {
  if (!workerId) {
    return {
      totalAidsInWindow: 0,
      isBlocked: false,
      canProceedNormally: true,
      isWarning: false,
      remainingSlots: 2,
      aidDays: [],
      allAidDaysCount: 0
    };
  }

  // Filter recipes for this worker
  const workerRecipes = recipes.filter(r => r.workerId === workerId);

  // Group by distinct calendar date (YYYY-MM-DD)
  const dayGroups: Record<string, { date: Date; recipes: MedicationRecipe[] }> = {};

  for (const r of workerRecipes) {
    // Determine date of the aid (prefer deliveredAt or createdAt)
    const d = parseDateSafe(r.deliveredAt) || parseDateSafe(r.createdAt);
    if (!d) continue;

    const key = toDateKey(d);
    if (!dayGroups[key]) {
      dayGroups[key] = {
        date: d,
        recipes: []
      };
    }
    dayGroups[key].recipes.push(r);
  }

  const allDistinctKeys = Object.keys(dayGroups);
  const cutoff30BusinessDays = getBusinessDaysAgoCutoff(30, referenceDate);

  // Filter distinct days that fall within the last 30 business days
  const aidsInWindow: DistinctAidDay[] = [];

  for (const key of allDistinctKeys) {
    const group = dayGroups[key];
    const groupDate = new Date(group.date);
    groupDate.setHours(0, 0, 0, 0);

    if (groupDate >= cutoff30BusinessDays) {
      const businessDaysAgo = countBusinessDaysBetween(groupDate, referenceDate);
      aidsInWindow.push({
        dateKey: key,
        date: group.date,
        recipes: group.recipes,
        businessDaysAgo
      });
    }
  }

  // Sort by date descending (newest first)
  aidsInWindow.sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalAidsInWindow = aidsInWindow.length;
  const isBlocked = totalAidsInWindow >= 2;
  const isWarning = totalAidsInWindow === 1;
  const canProceedNormally = totalAidsInWindow < 2;
  const remainingSlots = Math.max(0, 2 - totalAidsInWindow);

  let oldestAidInWindow: DistinctAidDay | undefined = undefined;
  let estimatedRenewalDate: Date | undefined = undefined;
  let businessDaysUntilRenewal: number | undefined = undefined;
  let formattedRenewalDate: string | undefined = undefined;

  if (isBlocked && aidsInWindow.length > 0) {
    // The aid that will expire first from the window is the oldest in the window
    // (since aidsInWindow is sorted descending, the oldest is at index length - 1)
    oldestAidInWindow = aidsInWindow[aidsInWindow.length - 1];

    // Calculate how many business days have passed since oldestAidInWindow
    const daysPassed = countBusinessDaysBetween(oldestAidInWindow.date, referenceDate);
    // It requires 31 business days to completely exit the 30-business-day window
    const daysNeeded = Math.max(1, 31 - daysPassed);
    businessDaysUntilRenewal = daysNeeded;
    estimatedRenewalDate = addBusinessDays(referenceDate, daysNeeded);
    formattedRenewalDate = formatFriendlyDate(estimatedRenewalDate);
  }

  return {
    totalAidsInWindow,
    isBlocked,
    canProceedNormally,
    isWarning,
    remainingSlots,
    aidDays: aidsInWindow,
    allAidDaysCount: allDistinctKeys.length,
    oldestAidInWindow,
    estimatedRenewalDate,
    businessDaysUntilRenewal,
    formattedRenewalDate
  };
}

export interface AssistedPatientSummary {
  workerId: string;
  patientName?: string;
  count: number;
}

export interface RepresentativeAidLimitStatus {
  representativeDniClean: string;
  totalAidsInWindow: number; // Distinct aid days withdrawn by this representative in last 30 business days
  isBlocked: boolean; // true if totalAidsInWindow >= 2
  canProceedNormally: boolean;
  isWarning: boolean; // true if totalAidsInWindow === 1
  remainingSlots: number;
  aidDays: DistinctAidDay[];
  allAidDaysCount: number;
  assistedPatients: AssistedPatientSummary[];
  oldestAidInWindow?: DistinctAidDay;
  estimatedRenewalDate?: Date;
  businessDaysUntilRenewal?: number;
  formattedRenewalDate?: string;
}

/**
 * Strips formatting characters from a DNI for comparison.
 */
export function cleanDni(dni?: string): string {
  if (!dni) return '';
  return dni.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Evaluates the 30-business-day social aid limit for a Legal Representative / Authorized Caregiver.
 * Rule: Maximum 2 aid withdrawals per representative in a 30-business-day window across all patients.
 */
export function checkRepresentativeAidLimit(
  allRecipes: MedicationRecipe[],
  representativeDni: string,
  referenceDate: Date = new Date(),
  workersMap?: Map<string, string>
): RepresentativeAidLimitStatus {
  const cleanTarget = cleanDni(representativeDni);
  if (!cleanTarget || cleanTarget.length < 4) {
    return {
      representativeDniClean: cleanTarget,
      totalAidsInWindow: 0,
      isBlocked: false,
      canProceedNormally: true,
      isWarning: false,
      remainingSlots: 2,
      aidDays: [],
      allAidDaysCount: 0,
      assistedPatients: []
    };
  }

  // Filter recipes where aid was delivered to this representative
  const repRecipes = allRecipes.filter(r => {
    if (!r.isDeliveredToRepresentative) return false;
    const repDni = cleanDni(r.representativeDni);
    return repDni === cleanTarget;
  });

  // Group by distinct calendar date (YYYY-MM-DD)
  const dayGroups: Record<string, { date: Date; recipes: MedicationRecipe[] }> = {};
  const patientCountMap: Record<string, number> = {};

  for (const r of repRecipes) {
    const d = parseDateSafe(r.deliveredAt) || parseDateSafe(r.createdAt);
    if (!d) continue;

    const key = toDateKey(d);
    if (!dayGroups[key]) {
      dayGroups[key] = {
        date: d,
        recipes: []
      };
    }
    dayGroups[key].recipes.push(r);

    if (r.workerId) {
      patientCountMap[r.workerId] = (patientCountMap[r.workerId] || 0) + 1;
    }
  }

  const allDistinctKeys = Object.keys(dayGroups);
  const cutoff30BusinessDays = getBusinessDaysAgoCutoff(30, referenceDate);

  const aidsInWindow: DistinctAidDay[] = [];
  for (const key of allDistinctKeys) {
    const group = dayGroups[key];
    const groupDate = new Date(group.date);
    groupDate.setHours(0, 0, 0, 0);

    if (groupDate >= cutoff30BusinessDays) {
      const businessDaysAgo = countBusinessDaysBetween(groupDate, referenceDate);
      aidsInWindow.push({
        dateKey: key,
        date: group.date,
        recipes: group.recipes,
        businessDaysAgo
      });
    }
  }

  // Sort descending (newest first)
  aidsInWindow.sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalAidsInWindow = aidsInWindow.length;
  const isBlocked = totalAidsInWindow >= 2;
  const isWarning = totalAidsInWindow === 1;
  const canProceedNormally = totalAidsInWindow < 2;
  const remainingSlots = Math.max(0, 2 - totalAidsInWindow);

  // Extract assisted patients list
  const assistedPatients: AssistedPatientSummary[] = Object.entries(patientCountMap).map(([workerId, count]) => ({
    workerId,
    patientName: workersMap?.get(workerId),
    count
  }));

  let oldestAidInWindow: DistinctAidDay | undefined = undefined;
  let estimatedRenewalDate: Date | undefined = undefined;
  let businessDaysUntilRenewal: number | undefined = undefined;
  let formattedRenewalDate: string | undefined = undefined;

  if (isBlocked && aidsInWindow.length > 0) {
    oldestAidInWindow = aidsInWindow[aidsInWindow.length - 1];
    const daysPassed = countBusinessDaysBetween(oldestAidInWindow.date, referenceDate);
    const daysNeeded = Math.max(1, 31 - daysPassed);
    businessDaysUntilRenewal = daysNeeded;
    estimatedRenewalDate = addBusinessDays(referenceDate, daysNeeded);
    formattedRenewalDate = formatFriendlyDate(estimatedRenewalDate);
  }

  return {
    representativeDniClean: cleanTarget,
    totalAidsInWindow,
    isBlocked,
    canProceedNormally,
    isWarning,
    remainingSlots,
    aidDays: aidsInWindow,
    allAidDaysCount: allDistinctKeys.length,
    assistedPatients,
    oldestAidInWindow,
    estimatedRenewalDate,
    businessDaysUntilRenewal,
    formattedRenewalDate
  };
}

