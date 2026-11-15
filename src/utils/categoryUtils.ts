import { MedicationRecipe } from '@/types';

export type PharmacyCategoryType = 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation';

/**
 * Palabras clave y expresiones regulares que identifican exámenes de laboratorio,
 * consultas médicas, ecografías, ecosonogramas y estudios clínicos diagnósticos.
 */
export const CLINICAL_STUDY_REGEX = /\b(eco|ecos|ecograma|ecosonograma|ecosonografia|ecosonografía|ecografia|ecografias|ecografía|ecografías|ultrasonido|doppler|laboratorio|laboratorios|perfil|hematologia|hematología|serologia|serología|urocultivo|coproanalisis|coproanálisis|quimica sanguinea|química sanguínea|glicemia|glucosa|urea|creatinina|sangre|orina|heces|consulta|consultas|interconsulta|evaluacion medica|evaluación médica|valoracion medica|valoración médica|cita medica|cita médica|rayos x|rayos-x|\brx\b|radiografia|radiografias|radiografía|radiografías|tomografia|tomografía|tac|resonancia|resonancias|rmn|biopsia|biopsias|endoscopia|endoscopias|colonoscopia|colonoscopias|electrocardiograma|ekg|ecg|mamografia|mamografía|densitometria|densitometría|citologia|citología|papanicolau|audiometria|audiometría|espirometria|espirometría|descarte|antigeno|antígeno|examen|examenes|exámenes|prueba especial|pruebas especiales|catarata|cataratas|cirugia|cirugía|operacion|operación|oftalmologia|oftalmología|clinica colina|clínica colina)\b/i;

/**
 * Insumos físicos descartables que deben permanecer como Insumos Médicos
 * aunque puedan contener palabras afines en su presentación o empaque.
 */
export const PHYSICAL_SUPPLY_REGEX = /\b(pañal|pañales|gasa|gasas|sonda|sondas|guante|guantes|jeringa|jeringas|aguja|agujas|algodon|algodón|alcohol|macrogotero|pericraneal|cateter|catéter|scalp|centro de cama|adhesivo|adhesivos|solucion fisiologica|solución fisiológica|obturador|recolector de orina|bolsa de colostomia|bolsa de colostomía)\b/i;

/**
 * Expresión regular que identifica tratamientos farmacológicos crónicos regulares
 * de uso continuo (antihipertensivos, cardiovasculares, hipoglicemiantes, etc.)
 */
export const CHRONIC_MEDICATION_REGEX = /\b(losartan|losartán|enalapril|captopril|amlodipino|amlodipina|carvedilol|atenolol|bisoprolol|metoprolol|valsartan|valsartán|hidroclorotiazida|furosemida|espironolactona|metformina|glibenclamida|insulina|glimepirida|atorvastatina|sinvastatina|simvastatina|aspirina|aspirinita|acido acetilsalicilico|ácido acetilsalicílico|clopidogrel|levotiroxina|eutirox|digoxina|omeprazol|pantoprazol|salbutamol|budesonida)\b/i;

export function isChronicTreatment(recipeOrMedName?: string | MedicationRecipe): boolean {
  if (!recipeOrMedName) return false;
  if (typeof recipeOrMedName === 'string') {
    return CHRONIC_MEDICATION_REGEX.test(recipeOrMedName);
  }
  const r = recipeOrMedName;
  if (r.category && r.category !== 'medication') return false;
  const name = r.medication || r.supplyName || '';
  return CHRONIC_MEDICATION_REGEX.test(name);
}

/**
 * Determina de forma inteligente y transparente si un requerimiento
 * corresponde a una atención o derivación asistencial (examen, consulta, eco, estudio clínico).
 */
export function isClinicalDerivationItem(r: MedicationRecipe): boolean {
  // 1. Si ya está explícitamente marcada como derivación
  if (r.category === 'medical_derivation' || (r.derivationService && r.derivationService.trim().length > 0)) {
    return true;
  }

  // 2. Si es explícitamente una ayuda humana (silla de ruedas, andadera, etc.) no es derivación
  if (r.category === 'technical_aid' || r.requiresTechnicalAid || (r.technicalAidType && r.technicalAidType.trim().length > 0)) {
    return false;
  }

  // 3. Si es un donativo de bolsa de comida o aporte económico, permanece como ayuda social / insumo
  if (
    r.socialAidType === 'food_bag' || 
    (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0) ||
    r.socialAidType === 'economic_aid' ||
    (r.economicAmount !== undefined && Number(r.economicAmount) > 0)
  ) {
    return false;
  }

  // 4. Analizar textos descriptivos del requerimiento
  const candidateTexts: string[] = [
    r.medication,
    r.supplyName,
    r.presentation,
    r.economicConcept,
    r.deliveryNotes,
    r.technicalAidNotes,
    ...(r.medicalSupplies || []).map(s => s.supplyName)
  ].filter((t): t is string => Boolean(t && t.trim().length > 0));

  if (candidateTexts.length === 0) return false;

  const combinedText = candidateTexts.join(' ').toLowerCase();

  // Si contiene explícitamente un insumo físico descartable sin mención de consulta/estudio, mantenerlo como insumo
  if (PHYSICAL_SUPPLY_REGEX.test(combinedText) && !/\b(consulta|interconsulta|evaluacion|valoracion|cita|estudio)\b/i.test(combinedText)) {
    return false;
  }

  // Verificar si coincide con estudios clínicos, exámenes, ecos o consultas
  return CLINICAL_STUDY_REGEX.test(combinedText);
}

/**
 * Función central de categorización para todo el sistema.
 * Clasifica de forma transparente y unificada cualquier receta o solicitud sin alterar la base de datos.
 */
export function getRecipeCategory(r: MedicationRecipe): PharmacyCategoryType {
  // 1. Ayudas humanas y de movilidad
  if (r.category === 'technical_aid' || r.requiresTechnicalAid || (r.technicalAidType && r.technicalAidType.trim().length > 0)) {
    return 'technical_aid';
  }

  // 2. Atenciones y Derivaciones (incluyendo autoclasificación transparente de exámenes, consultas y ecos)
  if (isClinicalDerivationItem(r)) {
    return 'medical_derivation';
  }

  // 3. Insumos médicos y ayuda social (insumos descartables, bolsas de comida, aportes monetarios)
  if (
    r.category === 'medical_supply' || 
    (r.medicalSupplies && r.medicalSupplies.length > 0) || 
    (r.supplyName && r.supplyName.trim().length > 0) ||
    r.socialAidType ||
    r.economicAmount !== undefined ||
    r.foodBagsCount !== undefined
  ) {
    return 'medical_supply';
  }

  // 4. Por defecto, fármaco / medicamento
  return 'medication';
}
