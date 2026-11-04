export const COMMUNES = [
  "CIUDAD SOTILLO",
  "CORAZON DE MI PATRIA SIGLO XXI",
  "DON SIMON RODRIGUEZ",
  "EL GIGANTE DE AMERICA",
  "EL ROSTRO DE BOLIVAR",
  "GENERALISIMO EZEQUIEL ZAMORA",
  "GRAL. JOSE ANTONIO ANZOATEGUI 25",
  "GRAN MARICAL DE AYACUCHO",
  "GERREROS DE BELLO MONTE",
  "JOSEFA CAMEJO",
  "LA BATALLA DE BOLIVAR",
  "MARIA TERESA DEL TORO",
  "POR AMOR A CHAVEZ",
  "PRODUCTIVA 19 DE ABRIL",
  "PRODUCTIVA EL LEGADO  DE CHAVEZ",
  "PRODUCTIVA TERESITA DE ALFONSO",
  "SOCIALISTA BAHIA DE POZUELO EN REVOLUCION",
  "SOCIALISTA EL PARAISO",
  "SOCIALISTA ESTEBAN DIAZ",
  "SOCIALISTA PRODUCTIVA ROBERT SERRA 25",
  "UNIDOS DE LAS DELICIAS"
];

export const OTHER_COMMUNE_OPTION = "OTRO (FUERA DEL MUNICIPIO SOTILLO)";

export const WORKER_STATUS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "retired", label: "Jubilado" }
];

export const EVALUATION_TYPES = [
  { value: "pre-employment", label: "Pre-empleo" },
  { value: "entry", label: "Ingreso" },
  { value: "periodic", label: "Periódico" },
  { value: "exit", label: "Egreso" },
  { value: "special", label: "Especial" }
];

export const DETERMINATIONS = [
  { value: "fit", label: "Apto" },
  { value: "fit-with-restrictions", label: "Apto con restricciones" },
  { value: "unfit", label: "No Apto" }
];

export const RISK_CLASSIFICATIONS = [
  "Físicos",
  "Químicos",
  "Biológicos",
  "Mecánicos",
  "Ergonómicos",
  "Psicosociales"
];

export const SOCIAL_AREAS = [
  "ADULTO MAYOR",
  "EMBARAZADA",
  "TRABAJADOR DE LA ALCALDIA",
  "ATLETA DE ALTO RENDIMIENTO",
  "JEFE UBCH",
  "LIDER DE CALLE",
  "PARLAMENTARIO COMUNAL",
  "SECRETARIO DE SALA AUTOGOBIERNO COMUNAL",
  "VOCERO CONSEJO COMUNAL",
  "OTROS"
];

export const ACADEMIC_LEVELS = [
  "SIN ESTUDIOS / NINGUNO",
  "PRIMARIA INCOMPLETA",
  "PRIMARIA COMPLETA",
  "BACHILLERATO INCOMPLETO",
  "BACHILLER / EDUCACIÓN MEDIA",
  "TÉCNICO MEDIO",
  "TÉCNICO SUPERIOR UNIVERSITARIO (TSU)",
  "UNIVERSITARIO / LICENCIATURA / INGENIERÍA",
  "POSTGRADO / MAESTRÍA / DOCTORADO"
];

export const DELIVERY_OBSERVATION_OPTIONS = [
  "ENTREGADO OFICINA 1X10 BUEN GOBIERNO",
  "ENTREGADO JORNADA DE ATENCION INTEGRAL",
  "ENTREGADO OPERATIVO CASA A CASA",
  "ENTREGADO VISITA SOCIAL",
  "DONACIÓN DIRECTA / SERVICIO FUNERARIO",
  "OTRA OBSERVACIÓN"
];

export const DISABILITY_TYPES = [
  {
    value: "DISCAPACIDAD FÍSICA O MOTORA",
    label: "Discapacidad Física o Motora",
    description: "Dificultad o imposibilidad para caminar, moverse o coordinar extremidades (lesiones medulares, parálisis cerebral, amputaciones)."
  },
  {
    value: "DISCAPACIDAD VISUAL",
    label: "Discapacidad Visual",
    description: "Alteraciones que van desde baja visión parcial hasta ceguera total."
  },
  {
    value: "DISCAPACIDAD AUDITIVA",
    label: "Discapacidad Auditiva",
    description: "Pérdida de la capacidad de audición parcial (hipoacusia) o total (sordera)."
  },
  {
    value: "DISCAPACIDAD INTELECTUAL",
    label: "Discapacidad Intelectual",
    description: "Limitaciones significativas en el funcionamiento intelectual y habilidades adaptativas diarias."
  },
  {
    value: "DISCAPACIDAD PSICOSOCIAL O MENTAL",
    label: "Discapacidad Psicosocial o Mental",
    description: "Alteraciones en funciones mentales o del estado de ánimo (depresión severa, ansiedad, etc.) que limitan la participación social."
  },
  {
    value: "DISCAPACIDAD MÚLTIPLE",
    label: "Discapacidad Múltiple",
    description: "Presencia combinada de dos o más tipos de discapacidades."
  },
  {
    value: "OTRO",
    label: "Otra Discapacidad / Especificar",
    description: "Condición o diagnóstico particular que requiere descripción personalizada."
  }
];

export const STANDARDIZED_TECHNICAL_AIDS = [
  "Silla de Ruedas Adulto (Estándar)",
  "Silla de Ruedas Pediátrica",
  "Andadera de Adulto (Plegable)",
  "Andadera con Ruedas y Asiento",
  "Bastón de 1 Punto (Canadiense / T)",
  "Bastón de 4 Puntos (Base Ancha)",
  "Muletas de Aluminio (Pares)",
  "Cama Clínica (Manual / Eléctrica)",
  "Colchón Antiescaras con Compresor",
  "Silla Sanitaria / WC Portátil",
  "Férula / Cabestrillo Inmovilizador",
  "Urna Funeraria (Ataúd Adulto)",
  "Urna Funeraria (Ataúd Pediátrico)",
  "Servicio Funerario / Donación de Capilla y Traslado",
  "Otro (Especificar)"
];

export const STANDARDIZED_MEDICAL_SUPPLIES = [
  "Pañales para Adultos (Talla M)",
  "Pañales para Adultos (Talla G / L)",
  "Pañales para Adultos (Talla XL)",
  "Pañales Pediátricos (Talla P / M / G / XG)",
  "Centro de Cama / Empapadores Descartables",
  "Gasas Estériles y Vendas Elásticas",
  "Solución Fisiológica 0.9% (500ml)",
  "Solución Ringer Lactato / Dextrosa 5%",
  "Kit Quirúrgico / Bioseguridad Descartable",
  "Sonda Foley y Bolsa Colectora de Orina",
  "Suplemento Nutricional / Fórmula Alimentaria",
  "Preservativos (Masculino / Femenino)",
  "Guantes Descartables (Caja)",
  "Jeringas Descartables (3cc / 5cc / 10cc)",
  "Otro Insumo (Especificar)"
];

export interface StandardMedicationItem {
  name: string;
  presentation: string;
  category: string;
}

export const COMMON_MEDICATIONS_CATALOG: StandardMedicationItem[] = [
  // Antihipertensivos y Cardiovasculares
  { name: "Losartán Potásico 50mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Losartán Potásico 100mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Enalapril Maleato 10mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Enalapril Maleato 20mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Amlodipino 5mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Amlodipino 10mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Carvedilol 6.25mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Carvedilol 12.5mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Carvedilol 25mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Captopril 25mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Atenolol 50mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Atenolol 100mg", presentation: "Tabletas", category: "Cardiovascular / Hipertensión" },
  { name: "Furosemida 40mg", presentation: "Tabletas", category: "Cardiovascular / Diurético" },
  { name: "Hidroclorotiazida 25mg", presentation: "Tabletas", category: "Cardiovascular / Diurético" },
  { name: "Espironolactona 25mg", presentation: "Tabletas", category: "Cardiovascular / Diurético" },
  { name: "Ácido Acetilsalicílico (Aspirina) 100mg", presentation: "Tabletas", category: "Cardiovascular / Antiagregante" },

  // Analgésicos y Antiinflamatorios
  { name: "Acetaminofén / Paracetamol 500mg", presentation: "Tabletas", category: "Analgésico / Antipirético" },
  { name: "Acetaminofén / Paracetamol Jarabe 120mg/5ml", presentation: "Frasco Jarabe", category: "Analgésico Pediátrico" },
  { name: "Ibuprofeno 400mg", presentation: "Tabletas", category: "Analgésico / Antiinflamatorio" },
  { name: "Ibuprofeno 600mg", presentation: "Tabletas", category: "Analgésico / Antiinflamatorio" },
  { name: "Ibuprofeno Suspensión 100mg/5ml", presentation: "Frasco Suspensión", category: "Analgésico Pediátrico" },
  { name: "Diclofenac Sódico 50mg", presentation: "Tabletas", category: "Antiinflamatorio" },
  { name: "Diclofenac Potásico 50mg", presentation: "Tabletas", category: "Antiinflamatorio" },
  { name: "Ketoprofeno 100mg", presentation: "Cápsulas / Ampollas", category: "Antiinflamatorio" },
  { name: "Meloxicam 15mg", presentation: "Tabletas", category: "Antiinflamatorio" },
  { name: "Dipirona / Metamizol 500mg", presentation: "Tabletas / Ampollas", category: "Analgésico / Antipirético" },
  { name: "Tramadol 50mg", presentation: "Cápsulas / Gotas", category: "Analgésico Mayor" },

  // Antibióticos y Antimicrobianos
  { name: "Amoxicilina 500mg", presentation: "Cápsulas", category: "Antibiótico" },
  { name: "Amoxicilina Suspensión 250mg/5ml", presentation: "Frasco Suspensión", category: "Antibiótico Pediátrico" },
  { name: "Amoxicilina + Ácido Clavulánico 875/125mg", presentation: "Tabletas", category: "Antibiótico" },
  { name: "Azitromicina 500mg", presentation: "Tabletas", category: "Antibiótico" },
  { name: "Ciprofloxacina 500mg", presentation: "Tabletas", category: "Antibiótico" },
  { name: "Cefalexina 500mg", presentation: "Cápsulas", category: "Antibiótico" },
  { name: "Ampicilina 500mg", presentation: "Cápsulas", category: "Antibiótico" },
  { name: "Metronidazol 500mg", presentation: "Tabletas", category: "Antiparasitario / Antibacteriano" },
  { name: "Trimetoprim / Sulfametoxazol 800/160mg", presentation: "Tabletas", category: "Antibiótico" },

  // Diabetes y Metabolismo
  { name: "Metformina 500mg", presentation: "Tabletas", category: "Diabetes / Hipoglicemiante" },
  { name: "Metformina 850mg", presentation: "Tabletas", category: "Diabetes / Hipoglicemiante" },
  { name: "Glibenclamida 5mg", presentation: "Tabletas", category: "Diabetes / Hipoglicemiante" },
  { name: "Insulina NPH Humana 100 UI/ml", presentation: "Frasco Ampolla", category: "Insulina" },
  { name: "Insulina Cristalina / Regular 100 UI/ml", presentation: "Frasco Ampolla", category: "Insulina" },
  { name: "Atorvastatina 20mg", presentation: "Tabletas", category: "Hipolipemiante / Colesterol" },
  { name: "Atorvastatina 40mg", presentation: "Tabletas", category: "Hipolipemiante / Colesterol" },

  // Gastrointestinal
  { name: "Omeprazol 20mg", presentation: "Cápsulas", category: "Gastrointestinal / Antiulceroso" },
  { name: "Pantoprazol 40mg", presentation: "Tabletas", category: "Gastrointestinal / Antiulceroso" },
  { name: "Ranitidina 150mg", presentation: "Tabletas", category: "Gastrointestinal" },
  { name: "Domperidona 10mg", presentation: "Tabletas", category: "Gastrocinético / Antiemético" },
  { name: "Metoclopramida 10mg", presentation: "Tabletas / Ampollas", category: "Antiemético" },
  { name: "Loperamida 2mg", presentation: "Tabletas", category: "Antidiarreico" },

  // Respiratorio y Antialérgicos
  { name: "Loratadina 10mg", presentation: "Tabletas", category: "Antihistamínico" },
  { name: "Cetirizina 10mg", presentation: "Tabletas", category: "Antihistamínico" },
  { name: "Salbutamol Inhalador 100mcg", presentation: "Inhalador Aerosol", category: "Broncodilatador" },
  { name: "Budesonida Inhalador 200mcg", presentation: "Inhalador Aerosol", category: "Corticoide Inhalado" },
  { name: "Dexametasona 4mg", presentation: "Ampollas / Tabletas", category: "Corticoide Sistémico" },
  { name: "Prednisona 5mg", presentation: "Tabletas", category: "Corticoide Sistémico" },
  { name: "Prednisona 20mg", presentation: "Tabletas", category: "Corticoide Sistémico" },

  // Neuro / Anticonvulsivantes / Salud Mental
  { name: "Carbamazepina 200mg", presentation: "Tabletas", category: "Anticonvulsivante" },
  { name: "Fenobarbital 100mg", presentation: "Tabletas", category: "Anticonvulsivante" },
  { name: "Ácido Valproico 250mg", presentation: "Tabletas / Jarabe", category: "Anticonvulsivante" },
  { name: "Clonazepam 2mg", presentation: "Tabletas", category: "Sedante / Ansiolítico" },
  { name: "Diazepam 5mg", presentation: "Tabletas", category: "Ansiolítico" },

  // Vitaminas y Suplementos
  { name: "Ácido Fólico 5mg", presentation: "Tabletas", category: "Suplemento / Embarazo" },
  { name: "Sulfato Ferroso 200mg", presentation: "Tabletas", category: "Antianémico / Hierro" },
  { name: "Complejo B", presentation: "Tabletas / Ampollas", category: "Vitaminas" },
  { name: "Calcio + Vitamina D 600mg", presentation: "Tabletas", category: "Suplemento Óseo" }
];

/**
 * Diccionario de errores ortográficos y variantes fonéticas comunes
 */
export const COMMON_SPELLING_CORRECTIONS: Record<string, string> = {
  "precervativo": "Preservativos (Masculino / Femenino)",
  "precervativos": "Preservativos (Masculino / Femenino)",
  "preservativo": "Preservativos (Masculino / Femenino)",
  "preservativos": "Preservativos (Masculino / Femenino)",
  "condon": "Preservativos (Masculino / Femenino)",
  "condones": "Preservativos (Masculino / Femenino)",
  "asetaminofen": "Acetaminofén / Paracetamol 500mg",
  "acetaminofen": "Acetaminofén / Paracetamol 500mg",
  "paracetamol": "Acetaminofén / Paracetamol 500mg",
  "omeprasol": "Omeprazol 20mg",
  "omeprazol": "Omeprazol 20mg",
  "diclofenaco": "Diclofenac Sódico 50mg",
  "diclofenac": "Diclofenac Sódico 50mg",
  "losartan": "Losartán Potásico 50mg",
  "amoxacilina": "Amoxicilina 500mg",
  "amoxicilina": "Amoxicilina 500mg",
  "azitromicina": "Azitromicina 500mg",
  "ciprofloxacino": "Ciprofloxacina 500mg",
  "ciprofloxacina": "Ciprofloxacina 500mg",
  "ibuprufeno": "Ibuprofeno 400mg",
  "ibuprofeno": "Ibuprofeno 400mg",
  "metformina": "Metformina 850mg",
  "glibenclamida": "Glibenclamida 5mg",
  "atenolol": "Atenolol 50mg",
  "enalapril": "Enalapril Maleato 20mg",
  "captopril": "Captopril 25mg",
  "amlodipina": "Amlodipino 10mg",
  "amlodipino": "Amlodipino 10mg",
  "acido folico": "Ácido Fólico 5mg",
  "sulfato ferroso": "Sulfato Ferroso 200mg",
  "urna": "Urna Funeraria (Ataúd Adulto)",
  "urnas": "Urna Funeraria (Ataúd Adulto)",
  "ataud": "Urna Funeraria (Ataúd Adulto)",
  "ataúd": "Urna Funeraria (Ataúd Adulto)",
  "ataudes": "Urna Funeraria (Ataúd Adulto)",
  "servicios funerarios": "Servicio Funerario / Donación de Capilla y Traslado",
  "servicio funerario": "Servicio Funerario / Donación de Capilla y Traslado"
};

/**
 * Detecta si un texto tiene una corrección ortográfica o sugerencia recomendada
 */
export function getSpellingSuggestion(name: string): string | null {
  if (!name) return null;
  const key = normalizeItemKey(name);
  if (COMMON_SPELLING_CORRECTIONS[key]) {
    return COMMON_SPELLING_CORRECTIONS[key];
  }
  // Búsqueda por coincidencia de inicio o contención
  for (const [typo, correct] of Object.entries(COMMON_SPELLING_CORRECTIONS)) {
    if (key.includes(typo) || typo.includes(key)) {
      if (normalizeItemKey(correct) !== key) {
        return correct;
      }
    }
  }
  return null;
}

/**
 * Normaliza nombres de fármacos e insumos para evitar duplicados en reportes
 * Ejemplo: "losartan 50mg", "LOSARTAN 50 MG", "Losartán 50mg" se consolidan en una sola clave.
 */
export function normalizeItemKey(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9]/g, " ")     // quita caracteres raros
    .replace(/\s+/g, " ")           // unifica espacios
    .trim();
}

/**
 * Formatea un texto a formato de título limpio y legible
 */
export function cleanItemDisplayName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  const key = normalizeItemKey(trimmed);

  // 1. Revisa si hay corrección ortográfica explícita (ej: precervativo -> Preservativos)
  if (COMMON_SPELLING_CORRECTIONS[key]) {
    return COMMON_SPELLING_CORRECTIONS[key];
  }

  // 2. Busca si existe en el catálogo para devolver la etiqueta oficial
  const match = COMMON_MEDICATIONS_CATALOG.find(
    m => normalizeItemKey(m.name) === key
  );
  if (match) return match.name;

  // 3. Revisa si coincide con ayudas técnicas
  const matchAid = STANDARDIZED_TECHNICAL_AIDS.find(
    a => normalizeItemKey(a) === key
  );
  if (matchAid) return matchAid;

  // 4. Revisa si coincide con insumos médicos
  const matchSupply = STANDARDIZED_MEDICAL_SUPPLIES.find(
    s => normalizeItemKey(s) === key
  );
  if (matchSupply) return matchSupply;
  
  // Si no está en catálogo, limpia espacios duplicados
  return trimmed.replace(/\s+/g, " ");
}


