export interface FamilyMember {
  fullName: string;
  dni: string;
  relationship: string;
  birthDate: string;
  gender: 'M' | 'F' | 'Other';
  hasDisability?: boolean;
  disabilityType?: string;
}

export interface Worker {
  id: string;
  fullName: string;
  dni: string;
  birthDate: string;
  gender: 'M' | 'F' | 'Other';
  civilStatus: string;
  address: string;
  phone: string;
  email: string;
  emergencyContact: string;
  status: 'active' | 'inactive' | 'retired';
  commune: string;
  sector: string;
  createdAt: string;
  updatedAt: string;
  hasDisability?: boolean;
  disabilityType?: string;
  socialArea?: string;
  socialAreas?: string[]; // Soporte nativo para 2 o más razones sociales / vinculaciones institucionales (ej: Jefe UBCH y Trabajador Alcaldía)
  workplaceDepartment?: string; // Dirección o Ente de la Alcaldía donde labora el trabajador
  votingCenter?: string;
  academicLevel?: string;
  academicDegree?: string;
  familyMembers?: FamilyMember[];
  isForeigner?: boolean;
  originLocation?: string;
  // Persona Encamada / Discapacidad Severa y Apoderado Legal
  isBedridden?: boolean;
  bedriddenNotes?: string;
  defaultRepresentative?: {
    fullName: string;
    dni: string;
    relationship: string;
    phone?: string;
  };
  // Historial y registro de difusión WhatsApp
  lastWhatsappSentAt?: any;
  lastWhatsappRecipient?: string;
  lastWhatsappTemplate?: string;
  whatsappOptOut?: boolean;
}

export interface MedicalHistory {
  workerId: string;
  personalHistory: {
    hypertension: boolean;
    diabetes: boolean;
    asthma: boolean;
    allergies?: string;
    surgeries?: string;
    chronicDiseases?: string;
    permanentMeds?: string;
    medicationsNeeded?: string;
    medicationFrequency?: string;
  };
  familyHistory: {
    heartDisease: boolean;
    diabetes: boolean;
    hypertension: boolean;
    cancer: boolean;
    others?: string;
  };
  // Campos clínicos solicitados por el usuario
  pathology?: string;
  hasDisability?: boolean;
  disabilityType?: string;
  requiresTechnicalAid?: boolean;
  technicalAidType?: string;
  technicalAidQuantity?: number;
  technicalAidNotes?: string;
  dependency?: string; // Grado de dependencia del paciente
  housingConditions?: {
    housingType: string;
    ownTerrain: string;
    tenure: string;
    roof: string;
    walls: string;
    floor: string;
    floorOther?: string;
    waterSupply: string;
    sewage: string;
    electricity: string;
    gas: string;
  };
  updatedAt: any; // Using any for Timestamp/Date compatibility
}

export interface Evaluation {
  id: string;
  workerId: string;
  type: 'pre-employment' | 'entry' | 'periodic' | 'exit' | 'special';
  physical: {
    weight: number;
    height: number;
    bmi: number;
    bloodPressure: string;
    heartRate: number;
    oxygenSaturation: number;
    temperature: number;
  };
  labs: {
    results: string;
    audiometry?: string;
    spirometry?: string;
    ecg?: string;
    visual?: string;
  };
  diagnosis: string;
  medicationsNeeded?: string;
  medicationFrequency?: string;
  recommendations: string;
  determination: 'fit' | 'fit-with-restrictions' | 'unfit';
  evaluatorId: string;
  createdAt: string;
}

export interface MedicationRecipe {
  id: string;
  workerId: string;
  medication: string;
  presentation: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  commune: string;
  prescribedBy: string;
  createdAt: any;
  category?: 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation';
  originalMedication?: string; // Respaldo histórico del texto original ingresado por el operador
  // Derivation / Referral fields
  derivationService?: string;
  derivationCenter?: string;
  derivationCenterId?: string;
  derivationStatus?: 'DISPONIBLE' | 'ESPECIALIZADO';
  derivationReason?: string;
  requiresTechnicalAid?: boolean;
  technicalAidType?: string;
  technicalAidQuantity?: number;
  technicalAidNotes?: string;
  status?: 'pending' | 'delivered';
  deliveredAt?: any;
  deliveredBy?: string;
  deliveryNotes?: string;
  deliveryOfficer?: string;
  recipeFileUrl?: string;
  recipeFileName?: string;
  isUrgent?: boolean;
  urgencyReason?: string;
  isForeigner?: boolean;
  originLocation?: string;
  // Retiro por Representante Legal / Familiar Autorizado
  isDeliveredToRepresentative?: boolean;
  representativeFullName?: string;
  representativeDni?: string;
  representativeRelationship?: string;
  representativePhone?: string;
  // Campos complementarios para categorías de farmacia e insumos
  customTechnicalAid?: string;
  technicalAidSpecs?: string;
  supplyName?: string;
  supplyPresentation?: string;
  medicalSuppliesNotes?: string;
  observations?: string;
  derivationDoctor?: string;
  workerFullName?: string;
  workerDni?: string;
  medications?: Array<{ medication: string; presentation?: string; quantity?: number }>;
  medicalSupplies?: Array<{ supplyName: string; presentation?: string; quantity?: number }>;
  // Campos de Ayuda Social Integral (dentro de categoría medical_supply)
  socialAidType?: 'supply' | 'economic_aid' | 'food_bag';
  economicAmount?: number;
  economicCurrency?: 'USD' | 'VES';
  economicConcept?: string;
  foodBagsCount?: number;
  foodDonationNotes?: string;
}

export type UserRole = 'superadmin' | 'admin' | 'editor';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  fullName: string;
  photoURL?: string;
  blocked?: boolean;
}
