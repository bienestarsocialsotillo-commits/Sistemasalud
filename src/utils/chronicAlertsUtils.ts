/**
 * Utilidades para el cálculo, normalización y monitoreo de alertas de ciclo de 30 días
 * para pacientes con tratamientos crónicos regulares (hipertensión, diabetes, etc.)
 * Alcaldía Bolivariana del Municipio Juan Antonio Sotillo · Dirección de Bienestar Social
 */

import { Worker, MedicationRecipe, MedicalHistory } from '@/types';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateSafe } from '@/utils/dateUtils';
import { formatVenezuelanPhoneForWhatsApp } from '@/utils/whatsappUtils';
import { CHRONIC_MEDICATION_REGEX, getRecipeCategory } from '@/utils/categoryUtils';

export interface UnifiedMedicationResult {
  standardizedName: string;
  standardizedPresentation: string;
  conditionType: 'hipertension' | 'diabetes' | 'regular_med';
  originalRawName: string;
  originalRawPresentation: string;
}

/**
 * Normaliza y unifica de manera estricta las presentaciones farmacológicas
 * para evitar duplicados en el inventario y órdenes de compra.
 * Ej: "tableta", "tabletas", "tab", "comprimido", "comprimidos" -> "Tabletas"
 */
export function standardizePresentation(presentation?: string, medName?: string): string {
  const p = (presentation || '').toLowerCase().trim();
  const m = (medName || '').toLowerCase().trim();

  if (p.includes('inhalador') || p.includes('aerosol') || p.includes('puff') || m.includes('inhalador') || m.includes('aerosol')) {
    return 'Inhalador Aerosol';
  }
  if (p.includes('ampolla') || p.includes('vial') || p.includes('inyectable') || p.includes('amp') || m.includes('ampolla')) {
    return 'Frasco Ampolla / Inyectable';
  }
  if (p.includes('jarabe') || p.includes('suspension') || p.includes('suspensión') || p.includes('elixir') || m.includes('jarabe')) {
    return 'Frasco Jarabe / Suspensión';
  }
  if (p.includes('gota') || p.includes('solucion oftalmica') || p.includes('gotero') || m.includes('gotas')) {
    return 'Frasco Gotas';
  }
  if (p.includes('capsula') || p.includes('cápsula')) {
    return 'Cápsulas';
  }
  if (p.includes('crema') || p.includes('pomada') || p.includes('gel') || p.includes('unguento') || p.includes('ungüento')) {
    return 'Tubo Crema / Pomada';
  }
  if (p.includes('insulina') || m.includes('insulina')) {
    return 'Frasco Ampolla (100 UI/ml)';
  }
  // Valor estándar por defecto para fármacos orales sólidos
  return 'Tabletas';
}

/**
 * Normaliza y unifica de forma inteligente los nombres de fármacos crónicos y sus principios activos.
 * Absorbe errores ortográficos, variantes fonéticas y miligramos dispersos.
 */
export function unifyChronicMedication(rawMedication?: string, rawPresentation?: string): UnifiedMedicationResult {
  const raw = (rawMedication || '').trim();
  const lower = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let standardizedName = raw;
  let conditionType: 'hipertension' | 'diabetes' | 'regular_med' = 'regular_med';

  // 1. Losartán Potásico
  if (lower.includes('losartan')) {
    conditionType = 'hipertension';
    if (lower.includes('100')) {
      standardizedName = 'Losartán Potásico 100mg';
    } else {
      standardizedName = 'Losartán Potásico 50mg';
    }
  }
  // 2. Amlodipino / Amlodipina
  else if (lower.includes('amlodipin') || lower.includes('amplodipin')) {
    conditionType = 'hipertension';
    if (lower.includes('5')) {
      standardizedName = 'Amlodipino 5mg';
    } else {
      standardizedName = 'Amlodipino 10mg';
    }
  }
  // 3. Enalapril
  else if (lower.includes('enalapril')) {
    conditionType = 'hipertension';
    if (lower.includes('10')) {
      standardizedName = 'Enalapril Maleato 10mg';
    } else {
      standardizedName = 'Enalapril Maleato 20mg';
    }
  }
  // 4. Captopril
  else if (lower.includes('captopril')) {
    conditionType = 'hipertension';
    standardizedName = 'Captopril 25mg';
  }
  // 5. Carvedilol
  else if (lower.includes('carvedilol')) {
    conditionType = 'hipertension';
    if (lower.includes('6.25') || lower.includes('6,25') || lower.includes('6.2') || lower.includes('6')) {
      standardizedName = 'Carvedilol 6.25mg';
    } else if (lower.includes('12.5') || lower.includes('12,5') || lower.includes('12')) {
      standardizedName = 'Carvedilol 12.5mg';
    } else {
      standardizedName = 'Carvedilol 25mg';
    }
  }
  // 6. Atenolol / Bisoprolol / Metoprolol
  else if (lower.includes('atenolol')) {
    conditionType = 'hipertension';
    if (lower.includes('100')) {
      standardizedName = 'Atenolol 100mg';
    } else {
      standardizedName = 'Atenolol 50mg';
    }
  } else if (lower.includes('bisoprolol')) {
    conditionType = 'hipertension';
    standardizedName = lower.includes('2.5') ? 'Bisoprolol 2.5mg' : 'Bisoprolol 5mg';
  } else if (lower.includes('metoprolol')) {
    conditionType = 'hipertension';
    standardizedName = 'Metoprolol 50mg';
  }
  // 7. Diuréticos (Furosemida, Hidroclorotiazida, Espironolactona)
  else if (lower.includes('furosemid')) {
    conditionType = 'hipertension';
    standardizedName = 'Furosemida 40mg';
  } else if (lower.includes('hidroclorotiazid') || lower.includes('hctz')) {
    conditionType = 'hipertension';
    standardizedName = 'Hidroclorotiazida 25mg';
  } else if (lower.includes('espironolacton')) {
    conditionType = 'hipertension';
    standardizedName = 'Espironolactona 25mg';
  }
  // 8. Valsartán
  else if (lower.includes('valsartan')) {
    conditionType = 'hipertension';
    standardizedName = lower.includes('160') ? 'Valsartán 160mg' : 'Valsartán 80mg';
  }
  // 9. Diabetes: Metformina
  else if (lower.includes('metformin')) {
    conditionType = 'diabetes';
    if (lower.includes('500')) {
      standardizedName = 'Metformina 500mg';
    } else {
      standardizedName = 'Metformina 850mg';
    }
  }
  // 10. Diabetes: Glibenclamida / Glimepirida
  else if (lower.includes('glibenclamid')) {
    conditionType = 'diabetes';
    standardizedName = 'Glibenclamida 5mg';
  } else if (lower.includes('glimepirid')) {
    conditionType = 'diabetes';
    standardizedName = lower.includes('4') ? 'Glimepirida 4mg' : 'Glimepirida 2mg';
  }
  // 11. Diabetes: Insulinas
  else if (lower.includes('insulina')) {
    conditionType = 'diabetes';
    if (lower.includes('cristalina') || lower.includes('regular') || lower.includes('rapida')) {
      standardizedName = 'Insulina Cristalina / Regular 100 UI/ml';
    } else {
      standardizedName = 'Insulina NPH Humana 100 UI/ml';
    }
  }
  // 12. Atorvastatina / Simvastatina
  else if (lower.includes('atorvastatin')) {
    conditionType = 'hipertension';
    standardizedName = lower.includes('40') ? 'Atorvastatina 40mg' : 'Atorvastatina 20mg';
  } else if (lower.includes('simvastatin') || lower.includes('sinvastatin')) {
    conditionType = 'hipertension';
    standardizedName = 'Simvastatina 20mg';
  }
  // 13. Ácido Acetilsalicílico / Aspirina
  else if (lower.includes('aspirin') || lower.includes('acetilsalicilico') || lower.includes('asa')) {
    conditionType = 'hipertension';
    standardizedName = 'Ácido Acetilsalicílico (Aspirina) 100mg';
  }
  // 14. Gastrointestinal Crónico (Omeprazol / Pantoprazol)
  else if (lower.includes('omeprazol') || lower.includes('omeprasol')) {
    conditionType = 'regular_med';
    standardizedName = 'Omeprazol 20mg';
  } else if (lower.includes('pantoprazol')) {
    conditionType = 'regular_med';
    standardizedName = 'Pantoprazol 40mg';
  }
  // 15. Respiratorio Crónico (Salbutamol, Budesonida)
  else if (lower.includes('salbutamol')) {
    conditionType = 'regular_med';
    standardizedName = 'Salbutamol Inhalador 100mcg';
  } else if (lower.includes('budesonid')) {
    conditionType = 'regular_med';
    standardizedName = 'Budesonida Inhalador 200mcg';
  }
  // 16. Tiroides (Levotiroxina / Eutirox)
  else if (lower.includes('levotiroxin') || lower.includes('eutirox')) {
    conditionType = 'regular_med';
    standardizedName = lower.includes('100') ? 'Levotiroxina Sódica 100mcg' : 'Levotiroxina Sódica 50mcg';
  }
  // 17. Clopidogrel
  else if (lower.includes('clopidogrel')) {
    conditionType = 'hipertension';
    standardizedName = 'Clopidogrel 75mg';
  }
  // 18. Casos genéricos o sin principio activo explícito
  else if (lower.includes('antihipertensivo') || lower.includes('presion') || lower.includes('hipertension')) {
    conditionType = 'hipertension';
    standardizedName = 'Tratamiento Antihipertensivo Regular';
  } else if (lower.includes('diabetes') || lower.includes('glicemia') || lower.includes('azucar')) {
    conditionType = 'diabetes';
    standardizedName = 'Tratamiento Hipoglicemiante Regular';
  } else if (raw.length > 0) {
    // Si no está en el mapa, limpiar espacios y capitalizar prolijamente
    standardizedName = raw
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  } else {
    standardizedName = 'Tratamiento Regular Antihipertensivo';
    conditionType = 'hipertension';
  }

  const standardizedPresentation = standardizePresentation(rawPresentation, standardizedName);

  return {
    standardizedName,
    standardizedPresentation,
    conditionType,
    originalRawName: raw,
    originalRawPresentation: rawPresentation || 'Tabletas'
  };
}

export interface ChronicPatientAlert {
  workerId: string;
  fullName: string;
  dni: string;
  commune: string;
  sector: string;
  phone: string;
  phoneFormatted: string;
  isPhoneValid: boolean;
  medicationName: string;
  lastRecipeId: string;
  lastRecipeQuantity: number;
  lastRecipePresentation: string;
  lastDeliveredAt: Date | null;
  lastDeliveredFormatted: string;
  daysElapsed: number;
  daysRemaining: number;
  status: 'overdue' | 'expiring_soon' | 'active'; // 🔴 >=30 días, 🟡 25-29 días, 🟢 <25 días
  statusLabel: string;
  conditionType: 'hipertension' | 'diabetes' | 'regular_med';
  deliveryOfficer?: string;
  representativeName?: string;
  representativePhone?: string;
}

export interface ChronicAlertsSummary {
  totalMonitored: number;
  overdueCount: number; // 🔴 >= 30 días
  expiringSoonCount: number; // 🟡 25 a 29 días
  activeCount: number; // 🟢 < 25 días
  alerts: ChronicPatientAlert[];
}

/**
 * Evalúa todas las recetas y expedientes para identificar a los pacientes crónicos
 * y calcular con precisión los días transcurridos desde su última entrega.
 * Estandariza presentaciones y nombres para que la farmacia tenga control certero.
 */
export function calculateChronicPatientAlerts(
  workers: Worker[],
  recipes: MedicationRecipe[],
  medicalHistories: MedicalHistory[] = []
): ChronicAlertsSummary {
  const now = new Date();
  const historyMap = new Map<string, MedicalHistory>();
  medicalHistories.forEach(h => {
    if (h.workerId) historyMap.set(h.workerId, h);
  });

  // Agrupar recetas entregadas por paciente
  const deliveredByWorker = new Map<string, MedicationRecipe[]>();
  recipes
    .filter(r => r.status === 'delivered' && getRecipeCategory(r) === 'medication')
    .forEach(r => {
      if (!r.workerId) return;
      const list = deliveredByWorker.get(r.workerId) || [];
      list.push(r);
      deliveredByWorker.set(r.workerId, list);
    });

  const alerts: ChronicPatientAlert[] = [];

  workers.forEach(w => {
    const history = historyMap.get(w.id);
    const hasHypertension = history?.personalHistory?.hypertension === true;
    const hasDiabetes = history?.personalHistory?.diabetes === true;
    const permanentMedsStr = history?.personalHistory?.permanentMeds || '';

    const deliveredMeds = deliveredByWorker.get(w.id) || [];

    // Buscar si tiene alguna receta que corresponda a medicamentos crónicos
    const chronicRecipes = deliveredMeds.filter(r => {
      const name = (r.medication || r.supplyName || '').toLowerCase();
      return CHRONIC_MEDICATION_REGEX.test(name) || (hasHypertension && name.length > 0);
    });

    // Agrupar las recetas por fármaco unificado para que si el paciente toma múltiples
    // fármacos (ej: Losartán + Metformina), cada uno tenga su ciclo independiente
    const recipesByUnifiedDrug = new Map<string, { recipe: MedicationRecipe; unified: UnifiedMedicationResult }>();

    chronicRecipes.forEach(r => {
      const unified = unifyChronicMedication(r.medication || r.supplyName, r.presentation);
      const key = unified.standardizedName.toUpperCase();

      const existing = recipesByUnifiedDrug.get(key);
      const curDate = parseDateSafe(r.deliveredAt || r.createdAt);
      const curTime = curDate ? curDate.getTime() : 0;

      if (!existing) {
        recipesByUnifiedDrug.set(key, { recipe: r, unified });
      } else {
        const existDate = parseDateSafe(existing.recipe.deliveredAt || existing.recipe.createdAt);
        const existTime = existDate ? existDate.getTime() : 0;
        if (curTime > existTime) {
          recipesByUnifiedDrug.set(key, { recipe: r, unified });
        }
      }
    });

    // Validación de teléfonos de contacto
    const phoneVal = formatVenezuelanPhoneForWhatsApp(w.phone);
    const repPhoneVal = formatVenezuelanPhoneForWhatsApp(w.defaultRepresentative?.phone);

    // Caso A: Paciente tiene al menos un medicamento crónico registrado en recetas
    if (recipesByUnifiedDrug.size > 0) {
      recipesByUnifiedDrug.forEach(({ recipe, unified }) => {
        let lastDeliveredAt: Date | null = null;
        let lastDeliveredFormatted = "Sin entrega previa";
        let daysElapsed = 999;

        const d = parseDateSafe(recipe.deliveredAt || recipe.createdAt);
        if (d) {
          lastDeliveredAt = d;
          lastDeliveredFormatted = format(d, "dd/MM/yyyy", { locale: es });
          daysElapsed = Math.max(0, differenceInDays(now, d));
        }

        const daysRemaining = Math.max(0, 30 - daysElapsed);
        let status: 'overdue' | 'expiring_soon' | 'active' = 'active';
        let statusLabel = 'Al Día';

        if (daysElapsed >= 30) {
          status = 'overdue';
          statusLabel = daysElapsed === 999 ? 'Requiere Dotación Inicial' : `Vencido (${daysElapsed} días)`;
        } else if (daysElapsed >= 25) {
          status = 'expiring_soon';
          statusLabel = `Vence en ${daysRemaining} día(s)`;
        } else {
          status = 'active';
          statusLabel = `Al Día (${daysRemaining} días rest.)`;
        }

        alerts.push({
          workerId: w.id,
          fullName: w.fullName,
          dni: w.dni,
          commune: w.commune || 'SOTILLO',
          sector: w.sector || 'Casco Central',
          phone: w.phone || '',
          phoneFormatted: phoneVal.isValid ? phoneVal.displayFormatted : (w.phone || 'S/T'),
          isPhoneValid: phoneVal.isValid || repPhoneVal.isValid,
          medicationName: unified.standardizedName,
          lastRecipeId: recipe.id,
          lastRecipeQuantity: Number(recipe.quantity) || 1,
          lastRecipePresentation: unified.standardizedPresentation,
          lastDeliveredAt,
          lastDeliveredFormatted,
          daysElapsed,
          daysRemaining,
          status,
          statusLabel,
          conditionType: unified.conditionType,
          deliveryOfficer: recipe.deliveryOfficer || recipe.deliveredBy,
          representativeName: w.defaultRepresentative?.fullName,
          representativePhone: w.defaultRepresentative?.phone
        });
      });
    } 
    // Caso B: Paciente tiene diagnóstico de Hipertensión o Diabetes pero aún no tiene receta despachada
    else if (hasHypertension || hasDiabetes || permanentMedsStr.trim().length > 0) {
      const unified = unifyChronicMedication(
        permanentMedsStr.trim() || (hasHypertension ? 'Tratamiento Antihipertensivo Regular' : 'Tratamiento Hipoglicemiante Regular'),
        'Tabletas'
      );

      alerts.push({
        workerId: w.id,
        fullName: w.fullName,
        dni: w.dni,
        commune: w.commune || 'SOTILLO',
        sector: w.sector || 'Casco Central',
        phone: w.phone || '',
        phoneFormatted: phoneVal.isValid ? phoneVal.displayFormatted : (w.phone || 'S/T'),
        isPhoneValid: phoneVal.isValid || repPhoneVal.isValid,
        medicationName: unified.standardizedName,
        lastRecipeId: '',
        lastRecipeQuantity: 1,
        lastRecipePresentation: unified.standardizedPresentation,
        lastDeliveredAt: null,
        lastDeliveredFormatted: 'Sin entrega previa',
        daysElapsed: 999,
        daysRemaining: 0,
        status: 'overdue',
        statusLabel: 'Requiere Dotación Inicial',
        conditionType: hasHypertension ? 'hipertension' : (hasDiabetes ? 'diabetes' : 'regular_med'),
        representativeName: w.defaultRepresentative?.fullName,
        representativePhone: w.defaultRepresentative?.phone
      });
    }
  });

  // Ordenar por urgencia: primero los vencidos (más días transcurridos primero), luego próximos a vencer, luego activos
  alerts.sort((a, b) => {
    const priority = { overdue: 0, expiring_soon: 1, active: 2 };
    if (priority[a.status] !== priority[b.status]) {
      return priority[a.status] - priority[b.status];
    }
    return b.daysElapsed - a.daysElapsed;
  });

  const overdueCount = alerts.filter(a => a.status === 'overdue').length;
  const expiringSoonCount = alerts.filter(a => a.status === 'expiring_soon').length;
  const activeCount = alerts.filter(a => a.status === 'active').length;

  return {
    totalMonitored: alerts.length,
    overdueCount,
    expiringSoonCount,
    activeCount,
    alerts
  };
}

export interface ChronicProcurementItem {
  medicationKey: string;
  medicationName: string;
  presentation: string;
  conditionType: 'hipertension' | 'diabetes' | 'regular_med';
  overduePatientsCount: number;
  expiringSoonPatientsCount: number;
  activePatientsCount: number;
  totalPatientsCount: number;
  criticalPatientsCount: number; // overdue + expiring_soon
  immediateRequiredUnits: number; // units needed for overdue + expiring_soon patients
  monthlyProjectedUnits: number; // units needed for 100% of tracked patients for 30 days
  patients: ChronicPatientAlert[];
}

/**
 * Agrupa todas las alertas de pacientes crónicos por fármaco y presentación unificada,
 * calculando con precisión las cantidades totales a solicitar tanto para
 * atención inmediata (vencidos + próximos) como para el ciclo mensual proyectado.
 */
export function calculateChronicProcurementList(alerts: ChronicPatientAlert[]): ChronicProcurementItem[] {
  const map = new Map<string, ChronicProcurementItem>();

  alerts.forEach(alert => {
    const unified = unifyChronicMedication(alert.medicationName, alert.lastRecipePresentation);
    const key = `${unified.standardizedName.toUpperCase()}__${unified.standardizedPresentation.toUpperCase()}`;

    const existing = map.get(key);
    const qty = alert.lastRecipeQuantity > 0 ? alert.lastRecipeQuantity : 1;
    const isCritical = alert.status === 'overdue' || alert.status === 'expiring_soon';

    if (existing) {
      if (alert.status === 'overdue') existing.overduePatientsCount += 1;
      else if (alert.status === 'expiring_soon') existing.expiringSoonPatientsCount += 1;
      else existing.activePatientsCount += 1;

      existing.totalPatientsCount += 1;
      if (isCritical) {
        existing.criticalPatientsCount += 1;
        existing.immediateRequiredUnits += qty;
      }
      existing.monthlyProjectedUnits += qty;
      existing.patients.push(alert);
    } else {
      map.set(key, {
        medicationKey: key,
        medicationName: unified.standardizedName,
        presentation: unified.standardizedPresentation,
        conditionType: unified.conditionType,
        overduePatientsCount: alert.status === 'overdue' ? 1 : 0,
        expiringSoonPatientsCount: alert.status === 'expiring_soon' ? 1 : 0,
        activePatientsCount: alert.status === 'active' ? 1 : 0,
        totalPatientsCount: 1,
        criticalPatientsCount: isCritical ? 1 : 0,
        immediateRequiredUnits: isCritical ? qty : 0,
        monthlyProjectedUnits: qty,
        patients: [alert]
      });
    }
  });

  const list = Array.from(map.values());
  list.sort((a, b) => {
    if (b.immediateRequiredUnits !== a.immediateRequiredUnits) {
      return b.immediateRequiredUnits - a.immediateRequiredUnits;
    }
    return b.totalPatientsCount - a.totalPatientsCount;
  });

  return list;
}
