import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { 
  COMMUNES, 
  OTHER_COMMUNE_OPTION, 
  DELIVERY_OBSERVATION_OPTIONS,
  STANDARDIZED_TECHNICAL_AIDS,
  STANDARDIZED_MEDICAL_SUPPLIES,
  COMMON_MEDICATIONS_CATALOG,
  cleanItemDisplayName
} from '@/constants';
import { toast } from "sonner";
import { 
  Pill, 
  User, 
  MapPin, 
  Calendar, 
  Upload, 
  FileText, 
  X, 
  Paperclip, 
  Package, 
  Accessibility, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  Sparkles,
  Building2,
  Stethoscope,
  HelpCircle,
  ExternalLink,
  Download,
  AlertCircle,
  Search,
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  Lock,
  AlertTriangle,
  ShieldAlert,
  History,
  Users,
  UserCheck,
  Printer,
  DollarSign,
  ShoppingBag
} from "lucide-react";
import { dataService } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import { 
  HEALTH_CENTERS, 
  SERVICES_MATRIX, 
  getCentersForService, 
  ServiceAvailability 
} from '@/data/healthNetworkMatrix';
import HealthMatrixModal from './HealthMatrixModal';
import { generateDerivationPdf } from '@/utils/derivationPdf';
import { Worker, MedicationRecipe } from '@/types';
import { 
  checkSocialAidLimit, 
  formatFriendlyDate, 
  AidLimitStatus,
  checkRepresentativeAidLimit,
  RepresentativeAidLimitStatus,
  cleanDni
} from '@/utils/socialAidLimits';

export const COMMON_MEDICATIONS_PRESETS = [
  "Losartán Potásico 50mg",
  "Amlodipina 10mg",
  "Metformina 850mg",
  "Enalapril 20mg",
  "Atorvastatina 20mg",
  "Carvedilol 6.25mg",
  "Omeprazol 20mg",
  "Acetaminofén 500mg",
  "Ibuprofeno 400mg",
  "Complejo B / Ácido Fólico"
];

const medicationItemSchema = z.object({
  medication: z.string().optional().or(z.literal('')),
  presentation: z.string().optional().or(z.literal('')),
  dosage: z.string().optional().or(z.literal('')),
  quantity: z.coerce.number().min(1, "Cantidad mínima 1").default(1),
});

const medicalSupplyItemSchema = z.object({
  supplyName: z.string().optional().or(z.literal('')),
  presentation: z.string().optional().or(z.literal('')),
  quantity: z.coerce.number().min(1, "Cantidad mínima 1").default(1),
});

const recipeSchema = z.object({
  workerId: z.string().min(1, "Debe seleccionar un paciente / beneficiario"),
  category: z.enum(['medication', 'technical_aid', 'medical_supply', 'medical_derivation']).default('medication'),
  deliveryMode: z.enum(['delivered', 'pending']).default('delivered'),
  deliveryOfficer: z.string().optional().or(z.literal('')),
  deliveryNotes: z.string().optional().or(z.literal('')),
  medication: z.string().optional().or(z.literal('')),
  supplyName: z.string().optional().or(z.literal('')),
  presentation: z.string().optional().or(z.literal('')),
  dosage: z.string().optional().or(z.literal('')),
  frequency: z.string().optional().or(z.literal('')),
  duration: z.string().optional().or(z.literal('')),
  quantity: z.coerce.number().min(1, "Cantidad requerida").default(1),
  // Array de medicamentos para soportar múltiples fármacos en la misma orden
  medications: z.array(medicationItemSchema).default([
    { medication: "", presentation: "Tabletas", dosage: "", quantity: 1 }
  ]),
  // Array de insumos médicos para soportar múltiples insumos en la misma orden
  medicalSupplies: z.array(medicalSupplyItemSchema).default([
    { supplyName: "", presentation: "Paquete / Unidad", quantity: 1 }
  ]),
  // Subtipo y campos de Ayuda Social (englobados en categoría medical_supply)
  socialAidSubtype: z.enum(['supply', 'economic_aid', 'food_bag']).default('supply'),
  economicAmount: z.coerce.number().optional().default(0),
  economicCurrency: z.enum(['USD', 'VES']).default('USD'),
  economicConcept: z.string().optional().or(z.literal('')),
  foodBagsCount: z.coerce.number().min(1, "Cantidad mínima 1").default(1),
  foodDonationNotes: z.string().optional().or(z.literal('')),
  commune: z.string().min(1, "Debe indicar la comuna del paciente"),
  originLocation: z.string().optional().or(z.literal('')),
  requiresTechnicalAid: z.boolean().default(false),
  technicalAidType: z.string().optional().or(z.literal('')),
  customTechnicalAid: z.string().optional().or(z.literal('')),
  technicalAidQuantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1").default(1),
  technicalAidNotes: z.string().optional().or(z.literal('')),
  attentionDate: z.string().min(1, "Debe indicar la fecha de atención"),
  // Salto de urgencia / excepción por bloqueo de ayudas
  isUrgent: z.boolean().default(false),
  urgencyReason: z.string().optional().or(z.literal('')),
  // Derivation fields
  derivationService: z.string().optional().or(z.literal('')),
  derivationCenter: z.string().optional().or(z.literal('')),
  derivationCenterId: z.string().optional().or(z.literal('')),
  derivationStatus: z.enum(['DISPONIBLE', 'ESPECIALIZADO']).optional(),
  derivationReason: z.string().optional().or(z.literal('')),
  // Retiro por Representante Legal / Familiar Autorizado (Bloqueo Dual Inteligente)
  isDeliveredToRepresentative: z.boolean().default(false),
  representativeFullName: z.string().optional().or(z.literal('')),
  representativeDni: z.string().optional().or(z.literal('')),
  representativeRelationship: z.string().optional().or(z.literal('')),
  representativePhone: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  const isForeignerSelected = data.commune === OTHER_COMMUNE_OPTION || data.commune === 'OTRO' || data.commune?.startsWith('OTRO');
  if (isForeignerSelected) {
    if (!data.originLocation || data.originLocation.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar el municipio o lugar de procedencia del ciudadano foráneo",
        path: ["originLocation"]
      });
    }
  }

  // Validación de Apoderado / Representante Legal
  if (data.isDeliveredToRepresentative) {
    if (!data.representativeFullName || data.representativeFullName.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar el nombre y apellido del representante legal o familiar",
        path: ["representativeFullName"]
      });
    }
    if (!data.representativeDni || data.representativeDni.trim().length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar la Cédula de Identidad (C.I.) del representante",
        path: ["representativeDni"]
      });
    }
    if (!data.representativeRelationship || data.representativeRelationship.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar el parentesco o vínculo con el paciente",
        path: ["representativeRelationship"]
      });
    }
    if (!data.representativePhone || data.representativePhone.trim().length < 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar un teléfono de contacto válido del representante",
        path: ["representativePhone"]
      });
    }
  }

  if (data.isUrgent) {
    if (!data.urgencyReason || data.urgencyReason.trim().length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe ingresar una justificación o motivo válido para el salto de urgencia (mínimo 8 caracteres)",
        path: ["urgencyReason"]
      });
    }
  }

  if (data.category === 'medication') {
    const validList = (data.medications || []).filter(m => m.medication && m.medication.trim().length > 0);
    if (validList.length === 0 && (!data.medication || data.medication.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe ingresar al menos un medicamento o fármaco en la solicitud",
        path: ["medications"]
      });
    }
  } else if (data.category === 'technical_aid') {
    const isOtherAid = data.technicalAidType?.toLowerCase() === 'otro' || data.technicalAidType?.startsWith('OTRO');
    if (!data.technicalAidType || data.technicalAidType.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe seleccionar o indicar el tipo de ayuda humana",
        path: ["technicalAidType"]
      });
    } else if (isOtherAid && (!data.customTechnicalAid || data.customTechnicalAid.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe ingresar la descripción o especificación de la ayuda humana",
        path: ["customTechnicalAid"]
      });
    }
  } else if (data.category === 'medical_supply') {
    if (data.socialAidSubtype === 'economic_aid') {
      if (!data.economicAmount || Number(data.economicAmount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe ingresar el monto del aporte económico (mayor a 0)",
          path: ["economicAmount"]
        });
      }
      if (!data.economicConcept || data.economicConcept.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe indicar el concepto para qué fue el aporte (ej. Tomografía, Biopsia, Exámenes, Operación...)",
          path: ["economicConcept"]
        });
      }
    } else if (data.socialAidSubtype === 'food_bag') {
      if (!data.foodBagsCount || Number(data.foodBagsCount) < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe indicar al menos 1 bolsa de comida a entregar",
          path: ["foodBagsCount"]
        });
      }
    } else {
      const validSupplies = (data.medicalSupplies || []).filter(s => s.supplyName && s.supplyName.trim().length > 0);
      if (validSupplies.length === 0 && (!data.supplyName || data.supplyName.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe ingresar al menos un insumo o material médico en la solicitud",
          path: ["medicalSupplies"]
        });
      }
    }
  } else if (data.category === 'medical_derivation') {
    if (!data.derivationService || data.derivationService.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe seleccionar el servicio o atención médica a derivar",
        path: ["derivationService"]
      });
    }
    if (!data.derivationCenter || data.derivationCenter.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe seleccionar el centro asistencial público de destino",
        path: ["derivationCenter"]
      });
    }
  }
});

type RecipeValues = z.infer<typeof recipeSchema>;

const TECHNICAL_AIDS_PRESETS = STANDARDIZED_TECHNICAL_AIDS;

const MEDICAL_SUPPLIES_PRESETS = STANDARDIZED_MEDICAL_SUPPLIES;

function extractFirstErrorMessage(errObj: any): string {
  if (!errObj) return "Por favor complete los campos obligatorios.";
  if (typeof errObj === 'string' && errObj.trim().length > 0) return errObj;
  if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
    return errObj.message;
  }
  if (Array.isArray(errObj)) {
    for (const item of errObj) {
      if (!item) continue;
      const msg = extractFirstErrorMessage(item);
      if (msg && msg !== "Por favor complete los campos obligatorios.") return msg;
    }
  }
  if (typeof errObj === 'object') {
    for (const key of Object.keys(errObj)) {
      const msg = extractFirstErrorMessage(errObj[key]);
      if (msg && msg !== "Por favor complete los campos obligatorios.") return msg;
    }
  }
  return "Por favor complete los campos obligatorios.";
}

export default function RecipeForm({ 
  workers = [], 
  onSuccess,
  workerId: initialWorkerId = "",
  workerName: initialWorkerName = "",
  commune: initialCommune = "",
  hasDisability: initialHasDisability = false,
  initialCategory = "medication",
  existingRecipes = []
}: { 
  workers?: Worker[], 
  onSuccess?: () => void,
  workerId?: string,
  workerName?: string,
  commune?: string,
  hasDisability?: boolean,
  initialCategory?: 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation',
  existingRecipes?: MedicationRecipe[]
}) {
  const { user } = useAuth();
  const [recipeFileUrl, setRecipeFileUrl] = useState<string>("");
  const [recipeFileName, setRecipeFileName] = useState<string>("");
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientSearch, setPatientSearch] = useState<string>("");
  const [isPatientPickerOpen, setIsPatientPickerOpen] = useState<boolean>(false);
  const [isCustomDeliveryNote, setIsCustomDeliveryNote] = useState<boolean>(false);
  const [workerRecipes, setWorkerRecipes] = useState<MedicationRecipe[]>(existingRecipes || []);
  const [isLoadingWorkerRecipes, setIsLoadingWorkerRecipes] = useState(false);

  const defaultCategory = initialHasDisability 
    ? 'technical_aid' 
    : (initialCategory || 'medication');

  const form = useForm<RecipeValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      workerId: initialWorkerId,
      category: defaultCategory,
      deliveryMode: defaultCategory === 'medical_derivation' ? 'delivered' : 'delivered',
      deliveryOfficer: user?.fullName || user?.email || "Evaluador de Bienestar Social",
      deliveryNotes: "",
      medication: "",
      supplyName: "",
      presentation: "",
      dosage: "",
      frequency: "",
      duration: "",
      quantity: 1,
      medications: [
        { medication: "", presentation: "Tabletas", dosage: "", quantity: 1 }
      ],
      medicalSupplies: [
        { supplyName: "", presentation: "Paquete / Unidad", quantity: 1 }
      ],
      socialAidSubtype: 'supply',
      economicAmount: 0,
      economicCurrency: 'USD',
      economicConcept: '',
      foodBagsCount: 1,
      foodDonationNotes: '',
      commune: initialCommune,
      originLocation: "",
      requiresTechnicalAid: initialHasDisability,
      technicalAidType: "Silla de Ruedas",
      customTechnicalAid: "",
      technicalAidQuantity: 1,
      technicalAidNotes: "",
      attentionDate: new Date().toISOString().split('T')[0],
      isUrgent: false,
      urgencyReason: "",
      derivationService: "",
      derivationCenter: "",
      derivationCenterId: "",
      derivationStatus: "DISPONIBLE",
      derivationReason: "",
      isDeliveredToRepresentative: false,
      representativeFullName: "",
      representativeDni: "",
      representativeRelationship: "",
      representativePhone: "",
    },
  });

  const { fields: medFields, append: appendMed, remove: removeMed } = useFieldArray({
    control: form.control,
    name: "medications"
  });

  const { fields: supplyFields, append: appendSupply, remove: removeSupply } = useFieldArray({
    control: form.control,
    name: "medicalSupplies"
  });

  const activeCategory = form.watch("category");
  const activeDeliveryMode = form.watch("deliveryMode");
  const selectedDerivationService = form.watch("derivationService");
  const selectedDerivationCenter = form.watch("derivationCenter");
  const selectedWorkerId = form.watch("workerId");
  const attentionDateWatch = form.watch("attentionDate");
  const isUrgentWatch = form.watch("isUrgent");
  const communeWatch = form.watch("commune");
  const technicalAidTypeWatch = form.watch("technicalAidType");
  const isDeliveredToRepresentativeWatch = form.watch("isDeliveredToRepresentative");
  const representativeDniWatch = form.watch("representativeDni");

  // Keep system-wide recipes for representative limit auditing
  const [allSystemRecipes, setAllSystemRecipes] = useState<MedicationRecipe[]>(existingRecipes || []);

  useEffect(() => {
    if (existingRecipes && existingRecipes.length > 0) {
      setAllSystemRecipes(existingRecipes);
    } else {
      let isMounted = true;
      dataService.getMedicationRecipes()
        .then(list => {
          if (isMounted) setAllSystemRecipes(list);
        })
        .catch(err => console.error("Error loading system recipes in RecipeForm:", err));
      return () => { isMounted = false; };
    }
  }, [existingRecipes]);

  // Selected worker object
  const selectedWorker = React.useMemo(() => {
    return workers.find(w => w.id === selectedWorkerId);
  }, [workers, selectedWorkerId]);

  // Workers map for looking up names in representative audits
  const workersMap = React.useMemo(() => {
    const map = new Map<string, string>();
    workers.forEach(w => map.set(w.id, w.fullName));
    return map;
  }, [workers]);

  // Auto-fill representative if selected worker has defaultRepresentative
  useEffect(() => {
    if (selectedWorker?.defaultRepresentative?.dni) {
      form.setValue("isDeliveredToRepresentative", true);
      form.setValue("representativeFullName", selectedWorker.defaultRepresentative.fullName || "");
      form.setValue("representativeDni", selectedWorker.defaultRepresentative.dni || "");
      form.setValue("representativeRelationship", selectedWorker.defaultRepresentative.relationship || "Representante Legal");
      form.setValue("representativePhone", selectedWorker.defaultRepresentative.phone || "");
    }
  }, [selectedWorker, form]);

  // Keep worker recipes in sync when selectedWorkerId changes
  useEffect(() => {
    if (!selectedWorkerId) {
      setWorkerRecipes([]);
      return;
    }

    if (existingRecipes && existingRecipes.length > 0) {
      const filtered = existingRecipes.filter(r => r.workerId === selectedWorkerId);
      setWorkerRecipes(filtered);
      return;
    }

    let isMounted = true;
    setIsLoadingWorkerRecipes(true);
    dataService.getMedicationRecipesByWorker(selectedWorkerId)
      .then(recipesList => {
        if (isMounted) {
          setWorkerRecipes(recipesList);
        }
      })
      .catch(err => {
        console.error("Error loading recipes for worker in RecipeForm:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingWorkerRecipes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedWorkerId, existingRecipes]);

  // Compute reference date for aid limit check
  const referenceDate = React.useMemo(() => {
    if (attentionDateWatch) {
      const d = new Date(attentionDateWatch + "T12:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [attentionDateWatch]);

  // Evaluate social aid limit: max 2 aids per 30 business days (Titular / Encamado)
  const aidLimitStatus: AidLimitStatus = React.useMemo(() => {
    return checkSocialAidLimit(workerRecipes, selectedWorkerId, referenceDate);
  }, [workerRecipes, selectedWorkerId, referenceDate]);

  // Evaluate social aid limit: max 2 aids per 30 business days (Representante Legal / Familiar)
  const representativeLimitStatus: RepresentativeAidLimitStatus = React.useMemo(() => {
    if (!isDeliveredToRepresentativeWatch || !representativeDniWatch) {
      return {
        representativeDniClean: "",
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
    return checkRepresentativeAidLimit(allSystemRecipes, representativeDniWatch, referenceDate, workersMap);
  }, [isDeliveredToRepresentativeWatch, representativeDniWatch, allSystemRecipes, referenceDate, workersMap]);

  // Dual Blocking Evaluation
  const isPatientBlocked = aidLimitStatus.isBlocked;
  const isRepBlocked = isDeliveredToRepresentativeWatch && representativeLimitStatus.isBlocked;
  const isDualBlocked = isPatientBlocked || isRepBlocked;

  // Evaluation of citizen inactive or blocked status
  const isWorkerInactiveOrBlocked = selectedWorker?.status === 'inactive' || (selectedWorker as any)?.status === 'retired';

  // Evaluation of citizen pending unresolved requests
  const pendingWorkerRequests = React.useMemo(() => {
    return workerRecipes.filter(r => r.status === 'pending' || !r.status);
  }, [workerRecipes]);

  // Reset urgency if neither is blocked
  useEffect(() => {
    if (!isDualBlocked) {
      form.setValue("isUrgent", false);
      form.setValue("urgencyReason", "");
    }
  }, [isDualBlocked, form]);

  // Keep deliveryOfficer synced if user profile loads
  useEffect(() => {
    if (user?.fullName && !form.getValues("deliveryOfficer")) {
      form.setValue("deliveryOfficer", user.fullName);
    }
  }, [user, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        toast.error("El archivo o foto supera el límite de 800KB permitido por la base de datos. Por favor cargue una foto más ligera o comprimida.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRecipeFileUrl(reader.result as string);
        setRecipeFileName(file.name);
        toast.success("Soporte digitalizado cargado exitosamente");
      };
      reader.onerror = () => {
        toast.error("Error al leer el archivo");
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setRecipeFileUrl("");
    setRecipeFileName("");
  };

  const watchedMedications = form.watch("medications");
  const watchedMedicalSupplies = form.watch("medicalSupplies");
  const watchedSocialAidSubtype = form.watch("socialAidSubtype") || "supply";
  const watchedEconomicCurrency = form.watch("economicCurrency") || "USD";

  const totalMedUnits = Array.isArray(watchedMedications)
    ? watchedMedications.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0)
    : 0;

  const totalSuppliesUnits = Array.isArray(watchedMedicalSupplies)
    ? watchedMedicalSupplies.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0)
    : 0;

  const handleCategoryChange = (cat: 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation') => {
    form.setValue("category", cat, { shouldValidate: false });
    form.clearErrors();
    if (cat === 'technical_aid') {
      form.setValue("requiresTechnicalAid", true);
      if (!form.getValues("technicalAidType")) {
        form.setValue("technicalAidType", "Silla de Ruedas");
      }
      if (!form.getValues("technicalAidQuantity") || Number(form.getValues("technicalAidQuantity")) < 1) {
        form.setValue("technicalAidQuantity", 1);
      }
    } else {
      form.setValue("requiresTechnicalAid", false);
    }

    if (cat === 'medication') {
      if (medFields.length === 0) {
        appendMed({ medication: "", presentation: "Tabletas", dosage: "", quantity: 1 });
      }
    }

    if (cat === 'medical_supply') {
      if (supplyFields.length === 0) {
        appendSupply({ supplyName: "", presentation: "Paquete / Unidad", quantity: 1 });
      }
    }
  };

  const handleSelectService = (serviceName: string) => {
    form.setValue("derivationService", serviceName, { shouldValidate: true });
    
    // Automatically check available centers for this service and pick the first available if not set
    const centers = getCentersForService(serviceName);
    const available = centers.filter(c => c.isAvailable);
    if (available.length > 0) {
      const best = available[0];
      form.setValue("derivationCenter", best.center.name, { shouldValidate: true });
      form.setValue("derivationCenterId", best.center.id);
      form.setValue("derivationStatus", best.status === 'ESPECIALIZADO' ? 'ESPECIALIZADO' : 'DISPONIBLE');
    } else {
      form.setValue("derivationCenter", "");
      form.setValue("derivationCenterId", "");
    }
  };

  const handleSelectCenter = (centerName: string, centerId: string, status: ServiceAvailability) => {
    form.setValue("derivationCenter", centerName, { shouldValidate: true });
    form.setValue("derivationCenterId", centerId);
    form.setValue("derivationStatus", status === 'ESPECIALIZADO' ? 'ESPECIALIZADO' : 'DISPONIBLE');
  };

  const availableCentersForSelectedService = selectedDerivationService 
    ? getCentersForService(selectedDerivationService)
    : [];

  const onSubmit: SubmitHandler<RecipeValues> = async (values) => {
    // ENFORCEMENT OF CITIZEN ACTIVE STATUS
    if (isWorkerInactiveOrBlocked) {
      toast.error("Ciudadano Inactivo o Bloqueado", {
        description: `El ciudadano ${selectedWorker?.fullName || ''} se encuentra con estatus inactivo o bloqueado en el sistema. No se pueden procesar solicitudes.`
      });
      return;
    }

    // ENFORCEMENT OF DUAL INTELLIGENT SOCIAL AID LIMIT (2 ayudas por 30 días hábiles)
    const isPatientBlockedNow = aidLimitStatus.isBlocked;
    const isRepBlockedNow = values.isDeliveredToRepresentative && representativeLimitStatus.isBlocked;

    if ((isPatientBlockedNow || isRepBlockedNow) && !values.isUrgent) {
      const reasonMsg = isPatientBlockedNow && isRepBlockedNow
        ? "Bloqueo Dual Inteligente: Tanto el paciente como el representante legal han alcanzado el límite de 2 ayudas en la ventana de 30 días hábiles."
        : isRepBlockedNow
          ? `Bloqueo de Representante: La C.I. ${values.representativeDni} (${values.representativeFullName || 'Representante'}) ya retiró 2 ayudas en los últimos 30 días hábiles.`
          : "Bloqueo de Paciente Titular: El ciudadano ya recibió el límite de 2 ayudas en la ventana de 30 días hábiles.";

      toast.error("Bloqueo de Ayudas Activo", {
        description: `${reasonMsg} Para casos de fuerza mayor o emergencia médica, active el Salto de Urgencia e ingrese la debida justificación obligatoria.`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let finalMed = "";
      let finalPres = values.presentation || "Unidad";
      let finalDos = values.dosage || "N/A";
      let finalFreq = values.frequency || "Único";
      let finalDur = values.duration || "N/A";
      let finalQty = values.quantity;
      const isTechAid = values.category === 'technical_aid';
      const isDerivation = values.category === 'medical_derivation';

      const isForeigner = values.commune === OTHER_COMMUNE_OPTION || values.commune === 'OTRO' || values.commune.startsWith('OTRO');
      const originLocationValue = isForeigner 
        ? (values.originLocation?.trim().toUpperCase() || "FUERA DEL MUNICIPIO SOTILLO") 
        : "";
      const finalCommune = isForeigner 
        ? (originLocationValue ? `OTRO: ${originLocationValue}` : OTHER_COMMUNE_OPTION) 
        : values.commune;

      const representativePayload = {
        isDeliveredToRepresentative: !!values.isDeliveredToRepresentative,
        representativeFullName: values.isDeliveredToRepresentative ? values.representativeFullName?.trim().toUpperCase() : undefined,
        representativeDni: values.isDeliveredToRepresentative ? (cleanDni(values.representativeDni || "") || values.representativeDni?.trim().toUpperCase()) : undefined,
        representativeRelationship: values.isDeliveredToRepresentative ? values.representativeRelationship?.trim().toUpperCase() : undefined,
        representativePhone: values.isDeliveredToRepresentative ? values.representativePhone?.trim() : undefined,
      };

      // MANEJO ESPECIALIZADO: MULTIPLE MEDICAMENTOS EN LA MISMA SOLICITUD U ORDEN
      if (values.category === 'medication') {
        const validMeds = (values.medications || []).filter(m => m.medication && m.medication.trim().length > 0);
        if (validMeds.length === 0 && values.medication && values.medication.trim().length > 0) {
          validMeds.push({
            medication: values.medication.trim(),
            presentation: values.presentation?.trim() || "Tabletas",
            dosage: values.dosage?.trim() || "N/A",
            quantity: values.quantity || 1,
          });
        }

        const isDelivered = values.deliveryMode === 'delivered';
        const rawDate = values.attentionDate ? new Date(values.attentionDate + "T12:00:00") : new Date();
        const dateOfAttention = (!isNaN(rawDate.getTime())) ? rawDate : new Date();
        const orderBatchCode = validMeds.length > 1 ? `ORD-${Date.now().toString().slice(-6)}` : undefined;

        for (const med of validMeds) {
          await dataService.addMedicationRecipe({
            workerId: values.workerId,
            category: 'medication',
            medication: cleanItemDisplayName(med.medication.trim()),
            presentation: med.presentation?.trim() || values.presentation || "Tabletas",
            dosage: med.dosage?.trim() || values.dosage || "N/A",
            frequency: values.frequency || "Según Indicación",
            duration: values.duration || "Permanente",
            quantity: Number(med.quantity) || 1,
            commune: finalCommune,
            isForeigner: !!isForeigner,
            originLocation: isForeigner ? originLocationValue : "",
            requiresTechnicalAid: false,
            status: isDelivered ? 'delivered' : 'pending',
            deliveredAt: isDelivered ? dateOfAttention : undefined,
            deliveredBy: isDelivered ? (values.deliveryOfficer || user?.fullName || user?.email || 'Funcionario en Campo') : undefined,
            deliveryOfficer: isDelivered ? values.deliveryOfficer : undefined,
            deliveryNotes: orderBatchCode 
              ? `${values.deliveryNotes ? values.deliveryNotes + " • " : ""}[Orden: ${orderBatchCode} (${validMeds.length} fármacos)]` 
              : (values.deliveryNotes || undefined),
            createdAt: dateOfAttention,
            recipeFileUrl: recipeFileUrl || undefined,
            recipeFileName: recipeFileName || undefined,
            isUrgent: values.isUrgent ? true : undefined,
            urgencyReason: values.isUrgent ? values.urgencyReason?.trim() : undefined,
            ...representativePayload,
          });
        }

        const medsSummary = validMeds.map(m => m.presentation ? `${m.medication} (${m.presentation})` : m.medication).join(", ");
        if (values.isUrgent) {
          toast.warning("Ayuda Asignada bajo Régimen Excepcional de Urgencia", {
            description: `Se procesó la orden médica [${medsSummary}] con salto de urgencia auditado para ${selectedWorker?.fullName || 'el ciudadano'}.`
          });
        } else if (isDelivered) {
          toast.success("Entrega Inmediata registrada exitosamente como ENTREGADO", {
            description: `Se asentó la entrega de ${validMeds.length} fármaco(s) [${medsSummary}] para el ciudadano.`
          });
        } else {
          toast.success("Solicitud registrada exitosamente en cola pendiente", {
            description: `Se programó la orden de ${validMeds.length} fármaco(s) [${medsSummary}] para posterior despacho.`
          });
        }

        setRecipeFileUrl("");
        setRecipeFileName("");
        onSuccess?.();
        return;
      }

      // MANEJO ESPECIALIZADO: CATEGORÍA INSUMO MÉDICO - SOCIAL (INSUMOS, APORTES $ / Bs Y BOLSAS DE COMIDA)
      if (values.category === 'medical_supply') {
        const isDelivered = values.deliveryMode === 'delivered';
        const rawSupplyDate = values.attentionDate ? new Date(values.attentionDate + "T12:00:00") : new Date();
        const dateOfAttention = (!isNaN(rawSupplyDate.getTime())) ? rawSupplyDate : new Date();

        // 1. APORTE ECONÓMICO MONETARIO ($ DIVISAS O BS AL CAMBIO)
        if (values.socialAidSubtype === 'economic_aid') {
          const numAmount = Number(values.economicAmount) || 0;
          const currency = values.economicCurrency || 'USD';
          const curLabel = currency === 'USD' ? '$' : 'Bs.';
          const conceptText = values.economicConcept?.trim() || 'Aporte Económico Especial';
          const formattedPresentation = `${curLabel} ${numAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (${currency === 'USD' ? 'Divisas USD' : 'Bolívares al cambio'})`;

          await dataService.addMedicationRecipe({
            workerId: values.workerId,
            category: 'medical_supply',
            socialAidType: 'economic_aid',
            economicAmount: numAmount,
            economicCurrency: currency,
            economicConcept: conceptText,
            medication: cleanItemDisplayName(`Aporte: ${conceptText}`),
            presentation: formattedPresentation,
            dosage: "Aporte Monetario Directo",
            frequency: "Único",
            duration: "N/A",
            quantity: 1,
            commune: finalCommune,
            isForeigner: !!isForeigner,
            originLocation: isForeigner ? originLocationValue : "",
            requiresTechnicalAid: false,
            status: isDelivered ? 'delivered' : 'pending',
            deliveredAt: isDelivered ? dateOfAttention : undefined,
            deliveredBy: isDelivered ? (values.deliveryOfficer || user?.fullName || user?.email || 'Funcionario en Campo') : undefined,
            deliveryOfficer: isDelivered ? values.deliveryOfficer : undefined,
            deliveryNotes: values.deliveryNotes ? `${values.deliveryNotes} • Aporte monetario sin convenio para procedimiento médico` : `Aporte monetario sin convenio para procedimiento médico`,
            createdAt: dateOfAttention,
            recipeFileUrl: recipeFileUrl || undefined,
            recipeFileName: recipeFileName || undefined,
            isUrgent: values.isUrgent ? true : undefined,
            urgencyReason: values.isUrgent ? values.urgencyReason?.trim() : undefined,
            ...representativePayload,
          });

          if (values.isUrgent) {
            toast.warning("Aporte Económico registrado con Salto de Urgencia", {
              description: `Se procesó aporte de ${curLabel} ${numAmount.toLocaleString('es-VE')} para [${conceptText}] bajo régimen de urgencia.`
            });
          } else {
            toast.success("Aporte Económico registrado exitosamente", {
              description: `Se registró el aporte de ${curLabel} ${numAmount.toLocaleString('es-VE')} para ${conceptText} (${isDelivered ? 'Entregado' : 'Pendiente'}).`
            });
          }

          setRecipeFileUrl("");
          setRecipeFileName("");
          onSuccess?.();
          return;
        }

        // 2. DONATIVO O ENTREGA DE BOLSAS DE COMIDA
        if (values.socialAidSubtype === 'food_bag') {
          const numBags = Number(values.foodBagsCount) || 1;
          const notes = values.foodDonationNotes?.trim() || "Entrega de bolsa(s) de alimentos / asistencia social";

          await dataService.addMedicationRecipe({
            workerId: values.workerId,
            category: 'medical_supply',
            socialAidType: 'food_bag',
            foodBagsCount: numBags,
            foodDonationNotes: notes,
            medication: "Donativo de Bolsas de Comida",
            presentation: `${numBags} ${numBags === 1 ? 'Bolsa de alimentos' : 'Bolsas de alimentos'}`,
            dosage: "Donativo Alimentario",
            frequency: "Único",
            duration: "N/A",
            quantity: numBags,
            commune: finalCommune,
            isForeigner: !!isForeigner,
            originLocation: isForeigner ? originLocationValue : "",
            requiresTechnicalAid: false,
            status: isDelivered ? 'delivered' : 'pending',
            deliveredAt: isDelivered ? dateOfAttention : undefined,
            deliveredBy: isDelivered ? (values.deliveryOfficer || user?.fullName || user?.email || 'Funcionario en Campo') : undefined,
            deliveryOfficer: isDelivered ? values.deliveryOfficer : undefined,
            deliveryNotes: values.deliveryNotes ? `${values.deliveryNotes} • ${notes}` : notes,
            createdAt: dateOfAttention,
            recipeFileUrl: recipeFileUrl || undefined,
            recipeFileName: recipeFileName || undefined,
            isUrgent: values.isUrgent ? true : undefined,
            urgencyReason: values.isUrgent ? values.urgencyReason?.trim() : undefined,
            ...representativePayload,
          });

          if (values.isUrgent) {
            toast.warning("Donativo de Alimentos registrado con Salto de Urgencia", {
              description: `Se procesó la entrega de ${numBags} bolsa(s) de comida con urgencia auditada.`
            });
          } else {
            toast.success("Donativo de Bolsas de Comida registrado exitosamente", {
              description: `Se registró la entrega de ${numBags} bolsa(s) de comida (${isDelivered ? 'Entregado' : 'Pendiente'}).`
            });
          }

          setRecipeFileUrl("");
          setRecipeFileName("");
          onSuccess?.();
          return;
        }

        // 3. INSUMO / MATERIAL MÉDICO FÍSICO (MÚLTIPLES INSUMOS)
        const validSupplies = (values.medicalSupplies || []).filter(s => s.supplyName && s.supplyName.trim().length > 0);
        if (validSupplies.length === 0 && values.supplyName && values.supplyName.trim().length > 0) {
          validSupplies.push({
            supplyName: values.supplyName.trim(),
            presentation: values.presentation?.trim() || "Paquete / Unidad",
            quantity: values.quantity || 1,
          });
        }

        const orderBatchCode = validSupplies.length > 1 ? `INS-${Date.now().toString().slice(-6)}` : undefined;

        for (const supply of validSupplies) {
          await dataService.addMedicationRecipe({
            workerId: values.workerId,
            category: 'medical_supply',
            socialAidType: 'supply',
            medication: cleanItemDisplayName(supply.supplyName.trim()),
            presentation: supply.presentation?.trim() || values.presentation || "Paquete / Unidad",
            dosage: "N/A",
            frequency: "Único",
            duration: "N/A",
            quantity: Number(supply.quantity) || 1,
            commune: finalCommune,
            isForeigner: !!isForeigner,
            originLocation: isForeigner ? originLocationValue : "",
            requiresTechnicalAid: false,
            status: isDelivered ? 'delivered' : 'pending',
            deliveredAt: isDelivered ? dateOfAttention : undefined,
            deliveredBy: isDelivered ? (values.deliveryOfficer || user?.fullName || user?.email || 'Funcionario en Campo') : undefined,
            deliveryOfficer: isDelivered ? values.deliveryOfficer : undefined,
            deliveryNotes: orderBatchCode 
              ? `${values.deliveryNotes ? values.deliveryNotes + " • " : ""}[Lote Insumos: ${orderBatchCode} (${validSupplies.length} artículos)]` 
              : (values.deliveryNotes || undefined),
            createdAt: dateOfAttention,
            recipeFileUrl: recipeFileUrl || undefined,
            recipeFileName: recipeFileName || undefined,
            isUrgent: values.isUrgent ? true : undefined,
            urgencyReason: values.isUrgent ? values.urgencyReason?.trim() : undefined,
            ...representativePayload,
          });
        }

        const suppliesSummary = validSupplies.map(s => s.presentation ? `${s.supplyName} (${s.presentation})` : s.supplyName).join(", ");
        if (values.isUrgent) {
          toast.warning("Ayuda Asignada bajo Régimen Excepcional de Urgencia", {
            description: `Se procesó la orden de insumos [${suppliesSummary}] con salto de urgencia auditado para ${selectedWorker?.fullName || 'el ciudadano'}.`
          });
        } else if (isDelivered) {
          toast.success("Entrega Inmediata de insumos registrada exitosamente como ENTREGADO", {
            description: `Se asentó la entrega de ${validSupplies.length} insumo(s) [${suppliesSummary}] para el ciudadano.`
          });
        } else {
          toast.success("Solicitud de insumos registrada exitosamente en cola pendiente", {
            description: `Se programó la orden de ${validSupplies.length} insumo(s) [${suppliesSummary}] para posterior despacho.`
          });
        }

        setRecipeFileUrl("");
        setRecipeFileName("");
        onSuccess?.();
        return;
      } else if (values.category === 'technical_aid') {
        const isOtherAid = values.technicalAidType?.toLowerCase() === 'otro' || values.technicalAidType?.startsWith('OTRO');
        const customDesc = values.customTechnicalAid?.trim().toUpperCase();
        finalMed = isOtherAid ? (customDesc ? `OTRO: ${cleanItemDisplayName(customDesc)}` : "OTRA AYUDA HUMANA") : (values.technicalAidType || "Silla de Ruedas Adulto (Estándar)");
        finalPres = "Unidad";
        finalDos = "N/A";
        finalFreq = "Único";
        finalDur = "N/A";
        finalQty = values.technicalAidQuantity || values.quantity || 1;
      } else if (values.category === 'medical_derivation') {
        finalMed = `${values.derivationService} ➔ ${values.derivationCenter}`;
        finalPres = values.derivationStatus === 'ESPECIALIZADO' ? 'Atención Especializada' : 'Derivación Directa';
        finalDos = values.derivationCenter || 'Centro Asistencial';
        finalFreq = 'Orden Asistencial';
        finalDur = 'Red Pública';
        finalQty = 1;
      }

      const isDelivered = values.deliveryMode === 'delivered';
      const rawGeneralDate = values.attentionDate ? new Date(values.attentionDate + "T12:00:00") : new Date();
      const dateOfAttention = (!isNaN(rawGeneralDate.getTime())) ? rawGeneralDate : new Date();

      const createdRecipeId = await dataService.addMedicationRecipe({
        workerId: values.workerId,
        category: values.category,
        medication: finalMed,
        presentation: finalPres,
        dosage: finalDos,
        frequency: finalFreq,
        duration: finalDur,
        quantity: finalQty,
        commune: finalCommune,
        isForeigner: !!isForeigner,
        originLocation: isForeigner ? originLocationValue : "",
        requiresTechnicalAid: isTechAid,
        technicalAidType: isTechAid ? finalMed : undefined,
        technicalAidQuantity: isTechAid ? finalQty : undefined,
        technicalAidNotes: isTechAid ? (values.technicalAidNotes?.trim() || undefined) : (values.deliveryNotes || undefined),
        // Derivation fields
        derivationService: isDerivation ? values.derivationService : undefined,
        derivationCenter: isDerivation ? values.derivationCenter : undefined,
        derivationCenterId: isDerivation ? values.derivationCenterId : undefined,
        derivationStatus: isDerivation ? values.derivationStatus : undefined,
        derivationReason: isDerivation ? values.derivationReason : undefined,
        status: isDelivered ? 'delivered' : 'pending',
        deliveredAt: isDelivered ? dateOfAttention : undefined,
        deliveredBy: isDelivered ? (values.deliveryOfficer || user?.fullName || user?.email || 'Funcionario en Campo') : undefined,
        deliveryOfficer: isDelivered ? values.deliveryOfficer : undefined,
        deliveryNotes: isDerivation ? values.derivationReason : (values.deliveryNotes || undefined),
        createdAt: dateOfAttention,
        recipeFileUrl: recipeFileUrl || undefined,
        recipeFileName: recipeFileName || undefined,
        isUrgent: values.isUrgent ? true : undefined,
        urgencyReason: values.isUrgent ? values.urgencyReason?.trim() : undefined,
        ...representativePayload,
      });

      if (isDerivation) {
        const derivationItem: MedicationRecipe = {
          id: createdRecipeId || `DER-${Date.now().toString().slice(-6)}`,
          workerId: values.workerId,
          medication: finalMed,
          presentation: finalPres,
          dosage: finalDos,
          frequency: finalFreq,
          duration: finalDur,
          quantity: 1,
          commune: finalCommune,
          prescribedBy: user?.uid || 'user',
          createdAt: dateOfAttention,
          category: 'medical_derivation',
          derivationService: values.derivationService,
          derivationCenter: values.derivationCenter,
          derivationStatus: values.derivationStatus,
          derivationReason: values.derivationReason,
          deliveryOfficer: values.deliveryOfficer,
          status: isDelivered ? 'delivered' : 'pending',
          isUrgent: values.isUrgent ? true : undefined,
          urgencyReason: values.isUrgent ? values.urgencyReason?.trim() : undefined,
        };

        if (values.isUrgent) {
          toast.warning("Derivación Médica con Salto de Urgencia Asignada", {
            description: `Se procesó la orden urgente a ${values.derivationCenter} (${values.derivationService}) para ${selectedWorker?.fullName || 'el ciudadano'}.`,
            duration: 12000,
            action: {
              label: "🖨️ Imprimir Orden PDF",
              onClick: () => generateDerivationPdf(derivationItem, selectedWorker),
            },
          });
        } else {
          toast.success("Derivación médica asignada con éxito", {
            description: `Se derivó a ${values.derivationCenter} para ${values.derivationService}. Puede imprimir la orden manualmente cuando lo requiera.`,
            duration: 12000,
            action: {
              label: "🖨️ Imprimir Orden PDF",
              onClick: () => generateDerivationPdf(derivationItem, selectedWorker),
            },
          });
        }
      } else if (values.isUrgent) {
        toast.warning("Ayuda Asignada bajo Régimen Excepcional de Urgencia", {
          description: `Se autorizó y procesó ${finalMed} con salto de urgencia auditado para ${selectedWorker?.fullName || 'el ciudadano'}.`
        });
      } else if (isDelivered) {
        toast.success("Entrega Inmediata registrada exitosamente como ENTREGADO", {
          description: `Se asentó la entrega de ${finalMed} (x${finalQty}) para el ciudadano.`
        });
      } else {
        toast.success("Solicitud registrada exitosamente en cola pendiente", {
          description: `Se programó el requerimiento de ${finalMed} para posterior despacho.`
        });
      }
      
      setRecipeFileUrl("");
      setRecipeFileName("");
      
      onSuccess?.();
    } catch (error: any) {
      console.error("Save Error:", error);
      let errorMsg = "Ocurrió un problema de comunicación con la base de datos.";
      const errStr = (error?.message || String(error)).toLowerCase();
      
      if (errStr.includes("exceeds maximum size") || errStr.includes("too large")) {
        errorMsg = "El archivo o soporte adjunto es demasiado grande para la base de datos. Retire el archivo o suba una foto más ligera.";
      } else if (errStr.includes("permission-denied") || errStr.includes("permission")) {
        errorMsg = "Permiso denegado por el servidor. Verifique que su sesión esté activa e intente nuevamente.";
      } else if (errStr.includes("network") || errStr.includes("offline") || errStr.includes("unavailable") || errStr.includes("failed to fetch") || errStr.includes("client is offline")) {
        errorMsg = "Error de red o conexión inestable en este equipo. Verifique su acceso a internet o use el Formulario Offline si está en campo.";
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      toast.error("Error al registrar la solicitud", {
        description: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (selectedWorker && selectedWorker.commune) {
      const isWorkerOther = selectedWorker.isForeigner || selectedWorker.commune === OTHER_COMMUNE_OPTION || selectedWorker.commune === 'OTRO' || selectedWorker.commune.startsWith('OTRO');
      if (isWorkerOther) {
        form.setValue("commune", OTHER_COMMUNE_OPTION);
        const extractedOrigin = selectedWorker.originLocation || (selectedWorker.commune.startsWith('OTRO: ') ? selectedWorker.commune.replace('OTRO: ', '') : '');
        if (extractedOrigin) {
          form.setValue("originLocation", extractedOrigin);
        }
      } else {
        form.setValue("commune", selectedWorker.commune);
      }
    }
  }, [selectedWorker, form]);

  return (
    <>
      <HealthMatrixModal 
        open={isMatrixModalOpen}
        onOpenChange={setIsMatrixModalOpen}
        onSelectService={(serviceName) => {
          handleSelectService(serviceName);
        }}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("RecipeForm Validation Errors:", errors);
          const firstErrorMessage = extractFirstErrorMessage(errors);
          toast.error(`Revisión requerida: ${firstErrorMessage}`);
        })} className="space-y-6">

          {/* 1. SELECTOR DE CATEGORÍA VISIBLE Y AUTOMÁTICO (4 OPCIONES) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                1. Seleccione la Categoría del Requerimiento / Atención
              </FormLabel>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-blue-900 border-blue-200 bg-blue-50/50">
                Paso Principal
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Opción 1: Fármaco */}
              <button
                key="category-btn-medication"
                type="button"
                onClick={() => handleCategoryChange('medication')}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                  activeCategory === 'medication'
                    ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20 text-blue-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${activeCategory === 'medication' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Pill className="w-5 h-5" />
                  </div>
                  {activeCategory === 'medication' && (
                    <Badge className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5">Activo</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black uppercase tracking-tight">💊 Fármaco / Medicamento</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Pastillas, ampollas, jarabes y tratamientos.</p>
                </div>
              </button>

              {/* Opción 2: Ayuda Humana */}
              <button
                key="category-btn-technical_aid"
                type="button"
                onClick={() => handleCategoryChange('technical_aid')}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                  activeCategory === 'technical_aid'
                    ? 'border-cyan-600 bg-cyan-50/70 shadow-md ring-2 ring-cyan-500/20 text-cyan-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${activeCategory === 'technical_aid' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Accessibility className="w-5 h-5" />
                  </div>
                  {activeCategory === 'technical_aid' && (
                    <Badge className="bg-cyan-600 text-white text-[9px] font-black uppercase px-2 py-0.5">Activo</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black uppercase tracking-tight">♿ Ayuda Humana</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Sillas de ruedas, andaderas, bastones y soportes.</p>
                </div>
              </button>

              {/* Opción 3: Insumo Médico / Social */}
              <button
                key="category-btn-medical_supply"
                type="button"
                onClick={() => handleCategoryChange('medical_supply')}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                  activeCategory === 'medical_supply'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-md ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${activeCategory === 'medical_supply' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  {activeCategory === 'medical_supply' && (
                    <Badge className="bg-indigo-600 text-white text-[9px] font-black uppercase px-2 py-0.5">Activo</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black uppercase tracking-tight">📦 Insumo Médico / Social</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Insumos, aportes en divisas ($ / Bs) y bolsas de comida.</p>
                </div>
              </button>

              {/* Opción 4: Derivación / Atención Médica */}
              <button
                key="category-btn-medical_derivation"
                type="button"
                onClick={() => handleCategoryChange('medical_derivation')}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                  activeCategory === 'medical_derivation'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20 text-emerald-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${activeCategory === 'medical_derivation' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  {activeCategory === 'medical_derivation' && (
                    <Badge className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5">Activo</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black uppercase tracking-tight">🏥 Atención / Derivación</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Remisión automática a centros asistenciales públicos.</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. REGISTRO DIRECTO DE ENTREGA INMEDIATA vs SOLICITUD PENDIENTE */}
          <div className="space-y-2">
            <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              2. Modalidad de Registro y Estado de la Atención
            </FormLabel>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opción Entrega / Emisión Inmediata */}
              <div
                onClick={() => form.setValue("deliveryMode", "delivered")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start gap-3 relative ${
                  activeDeliveryMode === 'delivered'
                    ? 'border-emerald-500 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20 text-emerald-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  activeDeliveryMode === 'delivered' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-tight text-emerald-950">
                      {activeCategory === 'medical_derivation' ? '🔘 Orden Emitida y Entregada al Paciente' : '🔘 Entrega Inmediata ("In Situ")'}
                    </span>
                    <Badge className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2">
                      {activeCategory === 'medical_derivation' ? 'Emitida' : 'Ya Entregado'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-emerald-800/80 leading-snug">
                    {activeCategory === 'medical_derivation' 
                      ? 'Se genera la orden oficial para que el ciudadano acuda directamente al centro asistencial asignado.' 
                      : 'Se guarda directo con estatus Entregado, registrando automáticamente la fecha y el funcionario actuante.'}
                  </p>
                </div>
              </div>

              {/* Opción Solicitud Pendiente */}
              <div
                onClick={() => form.setValue("deliveryMode", "pending")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start gap-3 relative ${
                  activeDeliveryMode === 'pending'
                    ? 'border-amber-500 bg-amber-50/80 shadow-md ring-2 ring-amber-500/20 text-amber-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  activeDeliveryMode === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-tight text-amber-950">
                      {activeCategory === 'medical_derivation' ? '🔘 Enlace / Coordinación en Trámite' : '🔘 Solicitud Pendiente por Despacho'}
                    </span>
                    <Badge className="bg-amber-500 text-white text-[8px] font-black uppercase px-2">
                      En Cola
                    </Badge>
                  </div>
                  <p className="text-[10px] text-amber-800/80 leading-snug">
                    {activeCategory === 'medical_derivation' 
                      ? 'Queda en cola de bienestar social para coordinar cupo o verificación previa con el centro médico.' 
                      : 'Queda programado en estado Solicitado en la cola de Farmacia para su posterior entrega.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FORMULARIO PRINCIPAL EN 2 COLUMNAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Columna Izquierda: Información del Paciente y Territorial */}
            <Card className="border-slate-200/80 shadow-sm rounded-2xl">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Información del Paciente / Territorio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 pt-4">
                <FormField
                  control={form.control}
                  name="workerId"
                  render={({ field }) => {
                    const selectedWorker = workers.find(w => w.id === field.value);
                    const filteredPatients = workers.filter(w => {
                      if (!patientSearch.trim()) return true;
                      const q = patientSearch.trim().toLowerCase();
                      const qDigits = q.replace(/[^0-9]/g, '');
                      const dniDigits = (w.dni || "").replace(/[^0-9]/g, '');
                      return (
                        w.fullName.toLowerCase().includes(q) ||
                        (w.dni && w.dni.toLowerCase().includes(q)) ||
                        (qDigits.length > 0 && dniDigits.includes(qDigits)) ||
                        (w.commune && w.commune.toLowerCase().includes(q))
                      );
                    });

                    return (
                      <FormItem className="space-y-1">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Paciente / Beneficiario *
                          </FormLabel>
                          {selectedWorker && !initialWorkerName && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsPatientPickerOpen(true);
                                setPatientSearch("");
                              }}
                              className="text-[10px] font-bold text-blue-700 hover:text-blue-900 underline uppercase"
                            >
                              Cambiar ciudadano
                            </button>
                          )}
                        </div>

                        {initialWorkerName ? (
                          <div className="flex items-center gap-3 p-3 border border-slate-200 bg-slate-50/70 rounded-xl text-xs sm:text-sm font-bold text-slate-800">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="truncate">{initialWorkerName}</span>
                          </div>
                        ) : selectedWorker && !isPatientPickerOpen ? (
                          <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50/60 rounded-xl">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-blue-900 text-white flex items-center justify-center font-black text-xs shrink-0">
                                {selectedWorker.fullName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase text-blue-950 truncate">
                                  {selectedWorker.fullName}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="bg-white text-[9px] font-bold text-slate-700 border-slate-300">
                                    C.I. {selectedWorker.dni}
                                  </Badge>
                                  {selectedWorker.commune && (
                                    <span className="text-[10px] text-slate-500 font-medium truncate">
                                      📍 {selectedWorker.commune}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setIsPatientPickerOpen(true);
                                setPatientSearch("");
                              }}
                              className="text-xs font-bold text-blue-800 hover:bg-blue-100 rounded-lg px-2 h-8"
                            >
                              Buscar otro
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-900/60" />
                              <Input
                                placeholder="Escribe Cédula (ej. 12345678) o Nombre del paciente..."
                                value={patientSearch}
                                onChange={(e) => setPatientSearch(e.target.value)}
                                className="pl-9 pr-8 h-10 bg-white text-xs font-bold border-slate-300 focus:border-blue-700"
                                autoFocus={isPatientPickerOpen}
                              />
                              {patientSearch && (
                                <button
                                  type="button"
                                  onClick={() => setPatientSearch("")}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                              {filteredPatients.length > 0 ? (
                                filteredPatients.slice(0, 15).map(w => {
                                  const isCurrent = field.value === w.id;
                                  return (
                                    <button
                                      key={w.id}
                                      type="button"
                                      onClick={() => {
                                        field.onChange(w.id);
                                        if (w.commune) {
                                          form.setValue("commune", w.commune, { shouldValidate: true });
                                        }
                                        setIsPatientPickerOpen(false);
                                        setPatientSearch("");
                                      }}
                                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                                        isCurrent 
                                          ? 'border-blue-600 bg-blue-100/70 text-blue-950 font-black' 
                                          : 'border-slate-200/80 bg-white hover:bg-blue-50/60 text-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                          isCurrent ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {w.fullName.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold uppercase truncate">{w.fullName}</p>
                                          <p className="text-[10px] text-slate-500">
                                            C.I. <span className="font-bold text-slate-700">{w.dni}</span>
                                            {w.commune && ` • ${w.commune}`}
                                          </p>
                                        </div>
                                      </div>
                                      {isCurrent && <Check className="w-4 h-4 text-blue-900 shrink-0" />}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="text-center py-6 text-slate-400">
                                  <p className="text-xs font-bold">No se encontró ningún ciudadano con esa cédula o nombre.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* SEMÁFORO DE VALIDACIÓN DE EXPEDIENTE: BLOQUEADO / SOLICITUDES PENDIENTES / HABILITADO */}
                {selectedWorker && (
                  <div className="space-y-2.5 pt-1">
                    {/* Alerta de Ciudadano Inactivo o Bloqueado */}
                    {isWorkerInactiveOrBlocked && (
                      <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 flex items-start gap-3 shadow-xs">
                        <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-wider text-rose-900">
                            🛑 CIUDADANO BLOQUEADO / INACTIVO EN EL SISTEMA
                          </p>
                          <p className="text-[11px] text-rose-800 mt-0.5">
                            Este expediente se encuentra con estatus <strong className="font-bold uppercase">{selectedWorker?.status || 'Inactivo'}</strong> en el censo municipal. No es posible generar solicitudes nuevas para este ciudadano.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Alerta de Solicitudes Pendientes sin Resolver */}
                    {pendingWorkerRequests.length > 0 && !isWorkerInactiveOrBlocked && (
                      <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 space-y-2 shadow-xs">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-black uppercase tracking-wider text-amber-950">
                                ⚠️ ATENCIÓN: EL CIUDADANO POSEE {pendingWorkerRequests.length} SOLICITUD(ES) PENDIENTE(S)
                              </p>
                              <Badge className="bg-amber-200 text-amber-900 border-amber-300 text-[10px] font-bold">
                                En Espera de Entrega
                              </Badge>
                            </div>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              Este beneficiario ya cuenta con requerimientos sin despachar en el sistema. Verifique para evitar solicitudes duplicadas:
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-11">
                          {pendingWorkerRequests.map((req, idx) => (
                            <div key={req.id || idx} className="bg-white/95 border border-amber-200 rounded-lg p-2 text-xs shadow-2xs">
                              <p className="font-bold text-slate-800 text-[11px] truncate">
                                {req.technicalAidType || req.medication || "Insumo Requerido"}
                              </p>
                              <p className="text-[10px] text-amber-900/80 font-medium">
                                Cant: {req.technicalAidQuantity || req.quantity || 1} • {req.createdAt ? formatFriendlyDate(req.createdAt) : "Pendiente"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Indicador de Expediente Habilitado y al Día */}
                    {!isWorkerInactiveOrBlocked && pendingWorkerRequests.length === 0 && !isLoadingWorkerRecipes && (
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 flex items-center gap-2.5 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <p className="text-xs font-bold text-emerald-900">
                          🟢 Expediente Habilitado · Sin solicitudes pendientes en espera de despacho
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PANEL DE CONTROL DE FRECUENCIA DE AYUDAS SOCIALES (MÁXIMO 2 EN 30 DÍAS HÁBILES) */}
                {selectedWorker && (
                  <div className="pt-1">
                    {isLoadingWorkerRecipes ? (
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs text-slate-500 animate-pulse">
                        <Clock className="w-4 h-4 animate-spin text-blue-900" />
                        <span>Auditando historial de ayudas del ciudadano en los últimos 30 días hábiles...</span>
                      </div>
                    ) : (
                      <div className={`p-4 rounded-xl border transition-all ${
                        aidLimitStatus.isBlocked
                          ? 'bg-rose-50/90 border-rose-200 text-rose-950 shadow-sm'
                          : aidLimitStatus.totalAidsInWindow === 1
                          ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                          : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/5">
                          <div className="flex items-center gap-2.5">
                            {aidLimitStatus.isBlocked ? (
                              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                <Lock className="w-4 h-4" />
                              </div>
                            ) : aidLimitStatus.totalAidsInWindow === 1 ? (
                              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider">Control de Frecuencia de Ayudas</span>
                                <Badge variant="outline" className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                                  aidLimitStatus.isBlocked
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : aidLimitStatus.totalAidsInWindow === 1
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                  {aidLimitStatus.isBlocked 
                                    ? 'Bloqueo Temporal Activo (2/2)' 
                                    : aidLimitStatus.totalAidsInWindow === 1
                                    ? 'Alerta Preventiva (1/2)'
                                    : 'Cupo Disponible (0/2)'}
                                </Badge>
                              </div>
                              <p className="text-[11px] opacity-80 mt-0.5">
                                Parámetro normativo: Máximo <strong className="font-bold">2 ayudas sociales</strong> en un lapso de <strong className="font-bold">30 días hábiles</strong>.
                              </p>
                            </div>
                          </div>

                          <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0">
                            <span className="text-xs font-black block">
                              {aidLimitStatus.totalAidsInWindow} de 2 ayudas computadas
                            </span>
                            {aidLimitStatus.isBlocked && aidLimitStatus.estimatedRenewalDate && (
                              <span className="text-[10px] font-bold text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-rose-200">
                                Próxima fecha habilitada: {aidLimitStatus.formattedRenewalDate || formatFriendlyDate(aidLimitStatus.estimatedRenewalDate)} ({aidLimitStatus.businessDaysUntilRenewal || 0} d. hábiles restantes)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Historial de ayudas recientes en la ventana activa */}
                        {aidLimitStatus.aidDays.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <p className="text-[10px] font-black uppercase tracking-wider opacity-75 flex items-center gap-1">
                              <History className="w-3 h-3" /> Días de ayuda computados dentro de la ventana de 30 días hábiles:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {aidLimitStatus.aidDays.map((dayItem, idx) => (
                                <div key={dayItem.dateKey || idx} className="bg-white/95 border border-black/10 rounded-lg p-2 text-xs flex items-center justify-between shadow-xs">
                                  <div className="min-w-0 pr-2">
                                    <p className="font-bold text-slate-800 truncate text-[11px]">
                                      {dayItem.recipes.map(r => r.medication).join(", ") || "Ayuda Social"}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      {formatFriendlyDate(dayItem.date)} • hace {dayItem.businessDaysAgo} d. hábiles
                                    </p>
                                  </div>
                                  {dayItem.recipes.some(r => r.isUrgent) && (
                                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-300 shrink-0 font-bold">
                                      Urgencia
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SECCIÓN DE SALTO DE URGENCIA / DESBLOQUEO */}
                        {aidLimitStatus.isBlocked ? (
                          <div className="mt-3.5 pt-3 border-t border-rose-200 bg-white/80 rounded-xl p-3 border shadow-xs">
                            <div className="flex items-start gap-3">
                              <FormField
                                control={form.control}
                                name="isUrgent"
                                render={({ field }) => (
                                  <FormItem className="flex items-start space-x-2.5 space-y-0 mt-0.5">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        className="data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600 w-5 h-5 rounded-md"
                                      />
                                    </FormControl>
                                    <div className="space-y-0.5 leading-none">
                                      <FormLabel className="text-xs font-black uppercase tracking-wide text-rose-950 cursor-pointer flex items-center gap-1.5">
                                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                                        Habilitar Salto de Urgencia (Excepción Autorizada)
                                      </FormLabel>
                                      <p className="text-[11px] text-slate-600">
                                        Omite el bloqueo temporal institucional por motivos de fuerza mayor, riesgo médico agudo o contingencia social justificada.
                                      </p>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            </div>

                            {isUrgentWatch && (
                              <div className="mt-3 pt-3 border-t border-rose-100 space-y-2">
                                <FormField
                                  control={form.control}
                                  name="urgencyReason"
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="text-[11px] font-black uppercase tracking-wider text-rose-900 flex items-center gap-1">
                                        Motivo o Justificación Obligatoria del Salto de Urgencia *
                                      </FormLabel>
                                      <FormControl>
                                        <Textarea
                                          placeholder="Describa detalladamente el cuadro médico de urgencia, contingencia social crítica o justificación autorizada para auditar..."
                                          {...field}
                                          value={field.value || ""}
                                          className="bg-white border-rose-300 text-xs focus-visible:ring-rose-500 rounded-xl min-h-[72px] resize-none"
                                        />
                                      </FormControl>
                                      <p className="text-[10px] text-slate-500 italic">
                                        Mínimo 8 caracteres. Esta justificación se guardará con la ayuda para su auditoría y fiscalización de control social.
                                      </p>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-[11px]">
                            <span className="text-slate-600">
                              {aidLimitStatus.totalAidsInWindow === 0 
                                ? "El ciudadano cuenta con disponibilidad total para asignación de ayudas."
                                : "Atención: El ciudadano dispone de 1 última ayuda antes de alcanzar el bloqueo temporal."}
                            </span>
                            <FormField
                              control={form.control}
                              name="isUrgent"
                              render={({ field }) => (
                                <div className="flex items-center gap-1.5">
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    id="optional-urgent-toggle"
                                    className="w-4 h-4"
                                  />
                                  <label htmlFor="optional-urgent-toggle" className="text-[10px] font-bold text-slate-600 cursor-pointer">
                                    Marcar como Urgencia Médica
                                  </label>
                                </div>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* OPCIÓN 1: BLOQUEO DUAL INTELIGENTE (PACIENTE Y C.I. DEL REPRESENTANTE) */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                  <FormField
                    control={form.control}
                    name="isDeliveredToRepresentative"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="representative-toggle"
                            className="w-5 h-5 rounded-md mt-0.5 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900"
                          />
                        </FormControl>
                        <div className="space-y-0.5">
                          <FormLabel 
                            htmlFor="representative-toggle" 
                            className="text-xs font-black uppercase tracking-wide text-slate-800 cursor-pointer flex items-center gap-1.5 flex-wrap"
                          >
                            <Users className="w-4 h-4 text-blue-700" />
                            Retiro por Representante Legal / Familiar Autorizado
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded border border-blue-200">
                              Persona Encamada / Discapacitada
                            </span>
                          </FormLabel>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Active esta casilla si la entrega no la recibe el titular en persona sino un apoderado o familiar. Activa la auditoría y <strong>Bloqueo Dual Inteligente</strong> (máx. 2 ayudas por paciente y por C.I. del representante en 30 días hábiles).
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Campos Condicionales del Representante Legal */}
                  {isDeliveredToRepresentativeWatch && (
                    <div className="pt-2 border-t border-slate-200/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="representativeFullName"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                Nombre y Apellido del Representante *
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Ej. María Elena Pérez" 
                                  className="h-10 rounded-xl bg-white text-xs font-bold uppercase" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="representativeDni"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center justify-between">
                                <span>Cédula de Identidad (C.I.) *</span>
                                <span className="text-[9px] text-blue-700 font-bold lowercase">para auditoría de retiros</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Ej. V-14.890.321" 
                                  className="h-10 rounded-xl bg-white text-xs font-bold uppercase" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="representativeRelationship"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                Parentesco o Vínculo con el Paciente *
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Ej. Hijo(a), Cónyuge, Hermano(a), Vecino(a)" 
                                  className="h-10 rounded-xl bg-white text-xs font-medium uppercase" 
                                  {...field} 
                                />
                              </FormControl>
                              <div className="flex flex-wrap gap-1 pt-1">
                                {["HIJO(A)", "CÓNYUGE", "MADRE/PADRE", "HERMANO(A)", "APODERADO LEGAL"].map((rel) => (
                                  <button
                                    key={rel}
                                    type="button"
                                    onClick={() => form.setValue("representativeRelationship", rel, { shouldValidate: true })}
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 hover:bg-blue-100 text-slate-700 hover:text-blue-800 transition-colors"
                                  >
                                    {rel}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="representativePhone"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                Teléfono de Contacto del Representante *
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Ej. 0414-1234567" 
                                  className="h-10 rounded-xl bg-white text-xs font-medium" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* AUDITORÍA Y CONTROL INTELIGENTE DE C.I. DEL REPRESENTANTE */}
                      {representativeDniWatch && representativeDniWatch.trim().length >= 4 && (
                        <div className={`p-3 rounded-xl border text-xs transition-all ${
                          representativeLimitStatus.isBlocked
                            ? 'bg-rose-50 border-rose-300 text-rose-950'
                            : representativeLimitStatus.isWarning
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              {representativeLimitStatus.isBlocked ? (
                                <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : representativeLimitStatus.isWarning ? (
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              ) : (
                                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              <div>
                                <span className="font-black uppercase tracking-wider text-[11px] block">
                                  Auditoría de C.I. del Representante ({representativeLimitStatus.representativeDniClean})
                                </span>
                                <span className="text-[10px] opacity-85">
                                  {representativeLimitStatus.isBlocked
                                    ? "Límite Máximo de Retiros Alcanzado (2 de 2 en 30 días hábiles)"
                                    : representativeLimitStatus.isWarning
                                    ? "Alerta Preventiva de Retiro (1 de 2 en 30 días hábiles)"
                                    : "Representante Habilitado (0 de 2 retiros en la ventana activa)"}
                                </span>
                              </div>
                            </div>
                            <Badge className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border self-start sm:self-auto ${
                              representativeLimitStatus.isBlocked
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : representativeLimitStatus.isWarning
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}>
                              {representativeLimitStatus.totalAidsInWindow} / 2 retiros
                            </Badge>
                          </div>

                          {/* Bloqueo específico con fecha estimada de renovación */}
                          {representativeLimitStatus.isBlocked && (
                            <div className="mt-2 pt-2 border-t border-rose-200 space-y-1.5">
                              <p className="text-[11px] text-rose-900 font-bold">
                                🚫 Esta C.I. de apoderado ya tramitó 2 ayudas en los últimos 30 días hábiles. El sistema bloquea nuevos retiros a través de esta misma cédula para prevenir que una persona retire ayudas continuas usando familiares distintos.
                              </p>
                              {representativeLimitStatus.estimatedRenewalDate && (
                                <p className="text-[10px] font-black text-rose-800 bg-rose-100/90 px-2 py-1 rounded-md border border-rose-200 inline-block">
                                  Próxima fecha habilitada para este apoderado: {representativeLimitStatus.formattedRenewalDate} ({representativeLimitStatus.businessDaysUntilRenewal} d. hábiles restantes)
                                </p>
                              )}
                            </div>
                          )}

                          {/* Retiros previos registrados por este apoderado en la ventana activa */}
                          {representativeLimitStatus.aidDays.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-black/10">
                              <p className="text-[10px] font-black uppercase tracking-wider opacity-80 mb-1 flex items-center gap-1">
                                <History className="w-3 h-3" /> Retiros previos con esta C.I. en los últimos 30 días hábiles:
                              </p>
                              <div className="space-y-1">
                                {representativeLimitStatus.aidDays.map((dayItem, dIdx) => {
                                  const patientNames = Array.from(new Set(dayItem.recipes.map(r => workersMap.get(r.workerId || '') || "Paciente"))).join(", ");
                                  const medNames = dayItem.recipes.map(r => r.medication).filter(Boolean).join(", ") || "Ayuda Social";
                                  return (
                                    <div key={dIdx} className="bg-white/90 border border-black/5 rounded-lg px-2.5 py-1.5 text-[11px] flex justify-between items-center">
                                      <div className="truncate mr-2">
                                        <span className="font-black text-slate-800">{patientNames}</span>
                                        <span className="text-slate-500 text-[10px]"> — {medNames}</span>
                                      </div>
                                      <span className="text-[10px] text-slate-600 shrink-0 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                        {formatFriendlyDate(dayItem.date)} (hace {dayItem.businessDaysAgo} d.h.)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Salto de Urgencia si el representante está bloqueado pero el paciente no */}
                          {representativeLimitStatus.isBlocked && !aidLimitStatus.isBlocked && (
                            <div className="mt-3 pt-2.5 border-t border-rose-200">
                              <div className="flex items-start gap-2.5">
                                <FormField
                                  control={form.control}
                                  name="isUrgent"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start space-x-2 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          className="data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600 w-4 h-4 rounded-md mt-0.5"
                                        />
                                      </FormControl>
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-xs font-black uppercase text-rose-950 cursor-pointer flex items-center gap-1">
                                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                          Habilitar Salto de Urgencia para el Representante
                                        </FormLabel>
                                        <p className="text-[10px] text-slate-600 leading-normal">
                                          Permite autorizar la entrega de emergencia para el paciente encamado a pesar del límite del representante.
                                        </p>
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {isUrgentWatch && (
                                <div className="mt-2 pt-2 border-t border-rose-100">
                                  <FormField
                                    control={form.control}
                                    name="urgencyReason"
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-wider text-rose-900">
                                          Justificación Obligatoria del Salto de Urgencia *
                                        </FormLabel>
                                        <FormControl>
                                          <Textarea
                                            placeholder="Indique la justificación médica o social para autorizar el retiro por este representante..."
                                            {...field}
                                            value={field.value || ""}
                                            className="bg-white border-rose-300 text-xs focus-visible:ring-rose-500 rounded-xl min-h-[64px] resize-none"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="commune"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Comuna (Impacto Territorial) *</FormLabel>
                      {initialCommune ? (
                        <div className="flex items-center gap-3 p-3 border border-slate-200 bg-slate-50/70 rounded-xl text-xs sm:text-sm font-bold text-slate-800">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            initialCommune.startsWith('OTRO') ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="truncate block font-bold text-slate-900">{initialCommune}</span>
                            {initialCommune.startsWith('OTRO') && (
                              <span className="text-[10px] text-amber-700 font-semibold block">Ciudadano Foráneo (Fuera del Municipio Sotillo)</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-xl">
                              <SelectValue placeholder="Seleccione comuna..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[320px] min-w-[280px] md:min-w-[420px]">
                            {COMMUNES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            <SelectItem 
                              value={OTHER_COMMUNE_OPTION} 
                              className="font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/90 mt-1 border-t border-slate-200 cursor-pointer"
                            >
                              📍 {OTHER_COMMUNE_OPTION}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Casilla interactiva cuando la persona no es del Municipio Sotillo */}
                {(communeWatch === OTHER_COMMUNE_OPTION || communeWatch === 'OTRO' || (communeWatch && communeWatch.startsWith('OTRO'))) && !initialCommune && (
                  <FormField
                    control={form.control}
                    name="originLocation"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-1 shadow-2xs">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-amber-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          Lugar de Procedencia (Municipio / Parroquia / Estado) *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ej. Municipio Bolívar (Barcelona), Guanta, Urbaneja, Caracas, etc." 
                            className="h-10 rounded-lg bg-white border-amber-300 text-xs font-medium focus-visible:ring-amber-500 shadow-none placeholder:text-slate-400" 
                            {...field} 
                          />
                        </FormControl>
                        <p className="text-[10px] text-amber-800 font-medium">
                          Indique detalladamente de dónde proviene el ciudadano foráneo para segregarlo en las métricas institucionales.
                        </p>
                        <FormMessage className="text-amber-900 font-bold text-[11px]" />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="attentionDate"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {activeDeliveryMode === 'delivered' ? 'Fecha de Atención' : 'Fecha de Registro'}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type="date" className="h-11 pl-10 rounded-xl" {...field} />
                            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryOfficer"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {activeCategory === 'medical_derivation' ? 'Funcionario / Médico Remitente' : 'Funcionario Responsable'}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del funcionario" className="h-11 rounded-xl text-xs" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {activeCategory !== 'medical_derivation' && activeDeliveryMode === 'delivered' && (
                  <div key="delivery-notes-wrapper">
                    <FormField
                      control={form.control}
                      name="deliveryNotes"
                      render={({ field }) => {
                        const standardOptions = [
                          "ENTREGADO OFICINA 1X10 BUEN GOBIERNO",
                          "ENTREGADO JORNADA DE ATENCION INTEGRAL",
                          "ENTREGADO OPERATIVO CASA A CASA",
                          "ENTREGADO VISITA SOCIAL"
                        ];
                        const isPredefined = standardOptions.includes(field.value || "");

                        return (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                              Observación de Entrega *
                            </FormLabel>
                            <Select
                              value={isCustomDeliveryNote || (!isPredefined && !!field.value) ? "OTRO" : (field.value || "")}
                              onValueChange={(val) => {
                                if (val === "OTRO") {
                                  setIsCustomDeliveryNote(true);
                                  field.onChange("");
                                } else {
                                  setIsCustomDeliveryNote(false);
                                  field.onChange(val);
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl text-xs font-bold bg-white border-slate-300">
                                  <SelectValue placeholder="Seleccione modalidad / observación..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {standardOptions.map((opt) => (
                                  <SelectItem key={opt} value={opt} className="text-xs font-bold uppercase py-2">
                                    {opt}
                                  </SelectItem>
                                ))}
                                <SelectItem value="OTRO" className="text-xs font-bold text-blue-700 uppercase py-2 border-t border-slate-100">
                                  ✍️ OTRA OBSERVACIÓN / DETALLE PERSONALIZADO
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            {(isCustomDeliveryNote || (!isPredefined && !!field.value)) && (
                              <div className="pt-1 animate-in fade-in duration-150">
                                <Input
                                  placeholder="Especifique observación de entrega personalizada..."
                                  className="h-10 text-xs rounded-xl font-medium border-blue-300 focus-visible:ring-blue-500"
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Columna Derecha: Detalle Adaptativo según Categoría Seleccionada */}
            <Card className="border-slate-200/80 shadow-sm rounded-2xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                  {activeCategory === 'medication' ? (
                    <span key="title-cat-med" className="flex items-center gap-2">
                      <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                      <span>Datos del Fármaco / Medicamento</span>
                    </span>
                  ) : activeCategory === 'technical_aid' ? (
                    <span key="title-cat-tech" className="flex items-center gap-2">
                      <Accessibility className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 shrink-0" />
                      <span>Datos de la Ayuda Humana</span>
                    </span>
                  ) : activeCategory === 'medical_supply' ? (
                    <span key="title-cat-sup" className="flex items-center gap-2">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
                      <span>Datos del Insumo Médico / Social</span>
                    </span>
                  ) : (
                    <span key="title-cat-der" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                      <span>Enrutamiento Asistencial a Red Pública</span>
                    </span>
                  )}
                </CardTitle>

                {activeCategory === 'medical_derivation' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMatrixModalOpen(true)}
                    className="text-[10px] font-black uppercase tracking-wider text-blue-900 border-blue-200 bg-blue-50/50 hover:bg-blue-100 h-8 gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver Matriz Completa
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-4">

                {/* CASO 1: FÁRMACO / MEDICAMENTO - SOPORTE DE MÚLTIPLES FÁRMACOS EN LA MISMA SOLICITUD */}
                {activeCategory === 'medication' && (
                  <div key="category-block-medication" className="space-y-3.5 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-black uppercase text-blue-950 tracking-tight">
                            Fármacos a Incluir en esta Orden
                          </p>
                          <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                            {medFields.length} {medFields.length === 1 ? 'medicamento' : 'medicamentos'}
                          </span>
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                            📦 Despacho Total: {totalMedUnits} unidades
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Cada fármaco incluye su casilla de cantidad precargada en <strong>1 unidad</strong> (sincronizada con el inventario total y métricas del dashboard).
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => appendMed({ medication: "", presentation: "Tabletas", dosage: "", quantity: 1 })}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider h-8 rounded-xl gap-1 shadow-xs cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Fármaco
                      </Button>
                    </div>

                    {(() => {
                      const err = form.formState.errors.medications;
                      const errMsg = err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
                        ? (err as any).message
                        : (err as any)?.root?.message;
                      return errMsg ? (
                        <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                          {errMsg}
                        </p>
                      ) : null;
                    })()}

                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {medFields.map((fieldItem, index) => (
                        <div 
                          key={fieldItem.id} 
                          className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2.5 relative group"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-md">
                                <Pill className="w-3 h-3 text-blue-600" />
                                Medicamento #{index + 1}
                              </span>
                              <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-md">
                                Entrega: {watchedMedications?.[index]?.quantity || 1} un.
                              </span>
                            </div>
                            {medFields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMed(index)}
                                className="h-6 px-2 text-[9px] font-bold text-red-600 hover:text-red-700 hover:bg-red-100/60 rounded-md gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                Quitar
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            <div className="sm:col-span-6">
                              <FormField
                                control={form.control}
                                name={`medications.${index}.medication`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                      Fármaco / Principio Activo *
                                    </FormLabel>
                                    <FormControl>
                                      <div>
                                        <Input 
                                          placeholder="Escriba o seleccione fármaco..." 
                                          list="catalog-medications-datalist"
                                          className="h-10 rounded-xl font-bold bg-white text-xs uppercase" 
                                          {...field}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            field.onChange(val);
                                            const matched = COMMON_MEDICATIONS_CATALOG.find(
                                              m => m.name.toLowerCase() === val.trim().toLowerCase()
                                            );
                                            if (matched) {
                                              form.setValue(`medications.${index}.presentation`, matched.presentation);
                                            }
                                          }}
                                        />
                                        <datalist id="catalog-medications-datalist">
                                          {COMMON_MEDICATIONS_CATALOG.map((m) => (
                                            <option key={m.name} value={m.name}>
                                              {m.category} • {m.presentation}
                                            </option>
                                          ))}
                                        </datalist>
                                        
                                        {/* Accesos Rápidos de Alta Rotación */}
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {[
                                            "Losartán Potásico 50mg",
                                            "Enalapril Maleato 20mg",
                                            "Amlodipino 10mg",
                                            "Metformina 850mg",
                                            "Acetaminofén / Paracetamol 500mg",
                                            "Omeprazol 20mg"
                                          ].map((quickMed) => (
                                            <button
                                              key={quickMed}
                                              type="button"
                                              onClick={() => {
                                                field.onChange(quickMed);
                                                const match = COMMON_MEDICATIONS_CATALOG.find(m => m.name === quickMed);
                                                if (match) {
                                                  form.setValue(`medications.${index}.presentation`, match.presentation);
                                                }
                                              }}
                                              className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 transition-colors"
                                            >
                                              + {quickMed.split(' ')[0]} {quickMed.split(' ').slice(-1)[0]}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <FormField
                                control={form.control}
                                name={`medications.${index}.presentation`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                      Presentación
                                    </FormLabel>
                                    <FormControl>
                                      <Input 
                                        placeholder="Ej. Tabletas" 
                                        className="h-10 rounded-xl bg-white text-xs uppercase" 
                                        {...field} 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <FormField
                                control={form.control}
                                name={`medications.${index}.quantity`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="text-[9px] font-black uppercase tracking-widest text-emerald-800 flex items-center justify-between">
                                      <span>Cantidad Entregada *</span>
                                    </FormLabel>
                                    <FormControl>
                                      <div className="relative flex items-center">
                                        <Input 
                                          type="number"
                                          min={1}
                                          step={1}
                                          className="h-10 rounded-xl bg-emerald-50/70 border-emerald-300 text-xs font-black text-emerald-950 text-center focus-visible:ring-emerald-500 shadow-none pr-8" 
                                          value={field.value !== undefined && field.value !== null ? field.value : 1}
                                          onChange={(e) => {
                                            const parsed = parseInt(e.target.value, 10);
                                            field.onChange(isNaN(parsed) || parsed < 1 ? 1 : parsed);
                                          }}
                                        />
                                        <span className="absolute right-2 text-[10px] font-bold text-emerald-700 pointer-events-none">
                                          un.
                                        </span>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Botón para agregar más medicamentos a la orden */}
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendMed({ medication: "", presentation: "Tabletas", dosage: "", quantity: 1 })}
                        className="w-full h-9 border-dashed border-blue-300 text-blue-700 hover:bg-blue-50/70 hover:border-blue-400 font-bold text-xs uppercase tracking-wider rounded-xl gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        + Agregar Otro Fármaco a la Solicitud
                      </Button>
                    </div>

                    {/* Sugerencias Rápidas de Fármacos Comunes */}
                    <div className="pt-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                        Sugerencias Rápidas de Fármacos Frecuentes:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_MEDICATIONS_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              if (medFields.length === 0) {
                                appendMed({ medication: preset, presentation: "Tabletas", dosage: "", quantity: 1 });
                                return;
                              }
                              const lastIdx = medFields.length - 1;
                              const currentVal = form.getValues(`medications.${lastIdx}.medication`);
                              if (!currentVal || currentVal.trim() === "") {
                                form.setValue(`medications.${lastIdx}.medication`, preset);
                              } else {
                                appendMed({ medication: preset, presentation: "Tabletas", dosage: "", quantity: 1 });
                              }
                            }}
                            className="text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* CASO 2: AYUDA HUMANA */}
                {activeCategory === 'technical_aid' && (
                  <div key="category-block-technical_aid" className="space-y-3.5 animate-in fade-in duration-200">
                    <FormField
                      control={form.control}
                      name="technicalAidType"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Tipo de Ayuda Humana Requerida / Entregada *
                          </FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val.toLowerCase() !== 'otro' && !val.startsWith('OTRO')) {
                                form.setValue("customTechnicalAid", "");
                              }
                            }} 
                            value={field.value || "Silla de Ruedas"}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 rounded-xl font-bold text-xs bg-white border-slate-300">
                                <SelectValue placeholder="Seleccione ayuda humana" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[340px]">
                              {TECHNICAL_AIDS_PRESETS.map((aid) => {
                                const isOtroOption = aid.toLowerCase() === 'otro';
                                return (
                                  <SelectItem 
                                    key={aid} 
                                    value={aid}
                                    className={isOtroOption ? "font-bold text-cyan-900 bg-cyan-50/80 hover:bg-cyan-100 mt-1 border-t border-slate-200 cursor-pointer" : "cursor-pointer"}
                                  >
                                    {isOtroOption ? "✨ OTRO (Especificar descripción)" : aid}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {TECHNICAL_AIDS_PRESETS.map((preset) => {
                        const isCurrent = technicalAidTypeWatch === preset;
                        const isOtroPreset = preset.toLowerCase() === "otro";
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              form.setValue("technicalAidType", preset, { shouldValidate: true });
                              if (!isOtroPreset) {
                                form.setValue("customTechnicalAid", "");
                              }
                            }}
                            className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                              isCurrent
                                ? (isOtroPreset ? 'bg-cyan-700 text-white border-cyan-700 shadow-xs' : 'bg-cyan-600 text-white border-cyan-600 shadow-xs')
                                : (isOtroPreset ? 'bg-cyan-50 text-cyan-900 border-cyan-300 hover:bg-cyan-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100')
                            }`}
                          >
                            {isOtroPreset ? "✨ OTRO" : preset}
                          </button>
                        );
                      })}
                    </div>

                    {/* Casilla interactiva para cargar descripción cuando se selecciona OTRO */}
                    {(technicalAidTypeWatch?.toLowerCase() === 'otro' || technicalAidTypeWatch?.startsWith('OTRO')) && (
                      <FormField
                        control={form.control}
                        name="customTechnicalAid"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5 p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl animate-in fade-in slide-in-from-top-1 shadow-2xs">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-cyan-950 flex items-center gap-1.5">
                              <Accessibility className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                              Descripción de la Ayuda Humana *
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ej. Prótesis auditiva, férula ortopédica, aspirador de flemas, cabestrillo..." 
                                className="h-10 rounded-lg bg-white border-cyan-300 text-xs font-bold uppercase focus-visible:ring-cyan-500 shadow-none placeholder:text-slate-400 placeholder:normal-case" 
                                {...field} 
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <p className="text-[10px] text-cyan-800 font-medium">
                              Especifique con exactitud el equipo, aditamento o ayuda humana requerida por el beneficiario.
                            </p>
                            <FormMessage className="text-rose-600 font-bold text-[11px]" />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <FormField
                        control={form.control}
                        name="technicalAidQuantity"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cantidad *</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} className="h-11 rounded-xl font-bold" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="technicalAidNotes"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Especificaciones</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej. Adulto / Pediátrico / Reforzada" className="h-11 rounded-xl text-xs" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* CASO 3: INSUMO MÉDICO / SOCIAL (ENGOLBANDO INSUMOS, APORTES MONETARIOS Y BOLSAS DE COMIDA) */}
                {activeCategory === 'medical_supply' && (
                  <div key="category-block-medical_supply" className="space-y-4 animate-in fade-in duration-200">
                    
                    {/* Barra de Subtipos de Ayuda Médica / Social */}
                    <div className="bg-slate-100 p-2 rounded-2xl border border-slate-200/90 shadow-2xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => form.setValue("socialAidSubtype", "supply", { shouldValidate: false })}
                          className={`flex items-center justify-center gap-2.5 py-3 px-3.5 min-h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            watchedSocialAidSubtype === 'supply'
                              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                              : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                          }`}
                        >
                          <Package className="w-4 h-4 shrink-0" />
                          <span>Insumos Médicos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => form.setValue("socialAidSubtype", "economic_aid", { shouldValidate: false })}
                          className={`flex items-center justify-center gap-2.5 py-3 px-3.5 min-h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            watchedSocialAidSubtype === 'economic_aid'
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                              : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                          }`}
                        >
                          <DollarSign className="w-4 h-4 shrink-0" />
                          <span>Aporte Económico ($ / Bs)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => form.setValue("socialAidSubtype", "food_bag", { shouldValidate: false })}
                          className={`flex items-center justify-center gap-2.5 py-3 px-3.5 min-h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            watchedSocialAidSubtype === 'food_bag'
                              ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                              : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                          }`}
                        >
                          <ShoppingBag className="w-4 h-4 shrink-0" />
                          <span>Bolsas de Comida</span>
                        </button>
                      </div>
                    </div>

                    {/* SUB-MODALIDAD 1: APORTE ECONÓMICO MONETARIO ($ DIVISAS O BS AL CAMBIO) */}
                    {watchedSocialAidSubtype === 'economic_aid' && (
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                        <div className="flex items-start gap-3 border-b border-emerald-200/70 pb-3.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-emerald-950 uppercase tracking-tight">
                              Aporte Económico para Procedimientos Médicos Especializados
                            </h4>
                            <p className="text-xs text-emerald-800 font-medium mt-0.5 leading-relaxed">
                              Ayuda monetaria otorgada en <strong>Divisas ($ USD)</strong> o <strong>Bolívares (Bs. al cambio)</strong> para cubrir tomografías, biopsias, resonancias, exámenes de laboratorio, consultas o cirugías en centros privados por no disponer de convenio público directo.
                            </p>
                          </div>
                        </div>

                        {/* Moneda y Monto */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                          {/* Selector de Moneda */}
                          <div className="sm:col-span-5 space-y-1.5">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                              Moneda del Aporte *
                            </FormLabel>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => form.setValue("economicCurrency", "USD")}
                                className={`h-11 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                                  watchedEconomicCurrency === 'USD'
                                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-200'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span className="text-base font-black">$</span>
                                <span>Divisas (USD)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => form.setValue("economicCurrency", "VES")}
                                className={`h-11 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                                  watchedEconomicCurrency === 'VES'
                                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-200'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span className="text-base font-black">Bs.</span>
                                <span>Al Cambio</span>
                              </button>
                            </div>
                          </div>

                          {/* Casilla de Monto */}
                          <div className="sm:col-span-7">
                            <FormField
                              control={form.control}
                              name="economicAmount"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    Monto del Aporte ({watchedEconomicCurrency === 'USD' ? '$ Divisas' : 'Bs. al cambio'}) *
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative flex items-center">
                                      <span className="absolute left-3.5 font-black text-emerald-800 text-base pointer-events-none">
                                        {watchedEconomicCurrency === 'USD' ? '$' : 'Bs.'}
                                      </span>
                                      <Input
                                        type="number"
                                        step="any"
                                        min={1}
                                        placeholder="0.00"
                                        className="h-11 pl-10 pr-3.5 rounded-xl font-black text-base bg-white border-emerald-300 focus-visible:ring-emerald-500"
                                        value={field.value || ""}
                                        onChange={(e) => field.onChange(e.target.value)}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Casilla abierta para que el editor cargue para qué fue el aporte */}
                        <div>
                          <FormField
                            control={form.control}
                            name="economicConcept"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                  Concepto del Aporte (¿Para qué fue otorgada la ayuda?) *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ej. Tomografía computarizada de tórax con contraste / Biopsia de cuello uterino / Resonancia cerebral..."
                                    className="h-11 rounded-xl bg-white border-emerald-300 text-xs font-bold uppercase focus-visible:ring-emerald-500"
                                    value={field.value || ""}
                                    onChange={(e) => field.onChange(e.target.value)}
                                  />
                                </FormControl>
                                <p className="text-[10px] text-slate-500">
                                  Casilla abierta para cargar el estudio, biopsia, examen, operación o consulta médica que motivó el aporte económico.
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Sugerencias Rápidas de Conceptos Médicos */}
                          <div className="mt-3 pt-3 border-t border-emerald-200/60">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900 mb-2">
                              Sugerencias Rápidas de Procedimientos Médicos:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                "Tomografía Computarizada",
                                "Biopsia / Estudio Patológico",
                                "Resonancia Magnética",
                                "Exámenes de Laboratorio Especiales",
                                "Intervención Quirúrgica / Operación",
                                "Consulta Médica Especializada",
                                "Ecografía Doppler",
                                "Endoscopia / Colonoscopia"
                              ].map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => {
                                    const current = form.getValues("economicConcept");
                                    form.setValue("economicConcept", current ? `${current} - ${suggestion}` : suggestion, { shouldValidate: true });
                                  }}
                                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-950 border border-emerald-300 hover:border-emerald-400 shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                >
                                  <span className="text-emerald-600 font-black">+</span>
                                  <span>{suggestion}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-MODALIDAD 2: DONATIVO DE BOLSAS DE COMIDA */}
                    {watchedSocialAidSubtype === 'food_bag' && (
                      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                        <div className="flex items-start gap-3 border-b border-amber-200/70 pb-3.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <ShoppingBag className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-amber-950 uppercase tracking-tight">
                              Donativo y Entrega de Bolsas de Comida
                            </h4>
                            <p className="text-xs text-amber-800 font-medium mt-0.5 leading-relaxed">
                              Registro directo de donación de bolsas de alimentos para protección social y asistencia nutricional a ciudadanos o familias vulnerables.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                          {/* Casilla de Cantidad de Bolsas */}
                          <div className="sm:col-span-5">
                            <FormField
                              control={form.control}
                              name="foodBagsCount"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    Cantidad de Bolsas de Comida *
                                  </FormLabel>
                                  <FormControl>
                                    <div className="space-y-2.5">
                                      <div className="relative flex items-center">
                                        <Input
                                          type="number"
                                          min={1}
                                          step={1}
                                          className="h-11 rounded-xl font-black text-base text-center bg-white border-amber-300 focus-visible:ring-amber-500 pr-14"
                                          value={field.value !== undefined ? field.value : 1}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            field.onChange(isNaN(val) || val < 1 ? 1 : val);
                                          }}
                                        />
                                        <span className="absolute right-3.5 text-xs font-bold text-amber-800 pointer-events-none">
                                          bolsa(s)
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-2">
                                        {[1, 2, 3, 5].map((count) => (
                                          <button
                                            key={count}
                                            type="button"
                                            onClick={() => field.onChange(count)}
                                            className={`h-9 text-xs font-black rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center shadow-2xs ${
                                              field.value === count
                                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                                            }`}
                                          >
                                            {count} {count === 1 ? 'bolsa' : 'bolsas'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Casilla de Observaciones de la Entrega */}
                          <div className="sm:col-span-7">
                            <FormField
                              control={form.control}
                              name="foodDonationNotes"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    Detalle / Observación de la Entrega (Opcional)
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Ej. Beneficio alimentario Clap / Caso de contingencia social"
                                      className="h-11 rounded-xl bg-white border-amber-300 text-xs font-medium focus-visible:ring-amber-500"
                                      value={field.value || ""}
                                      onChange={(e) => field.onChange(e.target.value)}
                                    />
                                  </FormControl>
                                  <p className="text-[10px] text-slate-500">
                                    Nota descriptiva opcional sobre la entrega alimentaria.
                                  </p>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-MODALIDAD 3: INSUMOS Y MATERIALES MÉDICOS FÍSICOS (SOPORTE MÚLTIPLE) */}
                    {watchedSocialAidSubtype === 'supply' && (
                      <div className="space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-black uppercase text-indigo-950 tracking-tight">
                                Insumos y Materiales a Incluir en esta Orden
                              </p>
                              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {supplyFields.length} {supplyFields.length === 1 ? 'insumo' : 'insumos'}
                              </span>
                              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                                📦 Despacho Total: {totalSuppliesUnits} unidades
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Cada insumo incluye su casilla de cantidad precargada en <strong>1 unidad</strong> (sincronizada con el inventario total y métricas del dashboard).
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => appendSupply({ supplyName: "", presentation: "Paquete / Unidad", quantity: 1 })}
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider h-9 px-3.5 rounded-xl gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
                          >
                            <Plus className="w-4 h-4" />
                            + Insumo
                          </Button>
                        </div>

                        {(() => {
                          const err = form.formState.errors.medicalSupplies;
                          const errMsg = err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
                            ? (err as any).message
                            : (err as any)?.root?.message;
                          return errMsg ? (
                            <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                              {errMsg}
                            </p>
                          ) : null;
                        })()}

                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                          {supplyFields.map((fieldItem, index) => (
                            <div 
                              key={fieldItem.id} 
                              className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2.5 relative group"
                            >
                              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                                    <Package className="w-3 h-3 text-indigo-600" />
                                    Insumo Médico #{index + 1}
                                  </span>
                                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-md">
                                    Entrega: {watchedMedicalSupplies?.[index]?.quantity || 1} un.
                                  </span>
                                </div>
                                {supplyFields.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSupply(index)}
                                    className="h-7.5 px-2.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-100/70 border border-red-200/60 rounded-lg gap-1.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Quitar
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                <div className="sm:col-span-6">
                                  <FormField
                                    control={form.control}
                                    name={`medicalSupplies.${index}.supplyName`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                          Insumo o Material Médico / Social *
                                        </FormLabel>
                                        <FormControl>
                                          <Input 
                                            placeholder="Ej. Pañales para Adultos Talla G / Gasas Estériles" 
                                            className="h-10 rounded-xl font-bold bg-white text-xs uppercase" 
                                            {...field} 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="sm:col-span-3">
                                  <FormField
                                    control={form.control}
                                    name={`medicalSupplies.${index}.presentation`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                          Presentación / Detalle
                                        </FormLabel>
                                        <FormControl>
                                          <Input 
                                            placeholder="Ej. Paquete / Unidad" 
                                            className="h-10 rounded-xl bg-white text-xs uppercase" 
                                            {...field} 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="sm:col-span-3">
                                  <FormField
                                    control={form.control}
                                    name={`medicalSupplies.${index}.quantity`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <FormLabel className="text-[9px] font-black uppercase tracking-widest text-emerald-800 flex items-center justify-between">
                                          <span>Cantidad *</span>
                                        </FormLabel>
                                        <FormControl>
                                          <div className="relative flex items-center">
                                            <Input 
                                              type="number"
                                              min={1}
                                              step={1}
                                              className="h-10 rounded-xl bg-emerald-50/70 border-emerald-300 text-xs font-black text-emerald-950 text-center focus-visible:ring-emerald-500 shadow-none pr-8" 
                                              value={field.value !== undefined && field.value !== null ? field.value : 1}
                                              onChange={(e) => {
                                                const parsed = parseInt(e.target.value, 10);
                                                field.onChange(isNaN(parsed) || parsed < 1 ? 1 : parsed);
                                              }}
                                            />
                                            <span className="absolute right-2 text-[10px] font-bold text-emerald-700 pointer-events-none">
                                              un.
                                            </span>
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Botón para agregar más insumos a la orden */}
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => appendSupply({ supplyName: "", presentation: "Paquete / Unidad", quantity: 1 })}
                            className="w-full h-9 border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50/70 hover:border-indigo-400 font-bold text-xs uppercase tracking-wider rounded-xl gap-2 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            + Agregar Otro Insumo a la Solicitud
                          </Button>
                        </div>

                        {/* Sugerencias Rápidas de Insumos Frecuentes */}
                        <div className="pt-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                            Sugerencias Rápidas de Insumos Frecuentes:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {MEDICAL_SUPPLIES_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  if (supplyFields.length === 0) {
                                    appendSupply({ supplyName: preset, presentation: "Paquete / Unidad", quantity: 1 });
                                    return;
                                  }
                                  const lastIdx = supplyFields.length - 1;
                                  const currentVal = form.getValues(`medicalSupplies.${lastIdx}.supplyName`);
                                  if (!currentVal || currentVal.trim() === "") {
                                    form.setValue(`medicalSupplies.${lastIdx}.supplyName`, preset);
                                    if (!form.getValues(`medicalSupplies.${lastIdx}.presentation`)) {
                                      form.setValue(`medicalSupplies.${lastIdx}.presentation`, "Paquete / Unidad");
                                    }
                                  } else {
                                    appendSupply({ supplyName: preset, presentation: "Paquete / Unidad", quantity: 1 });
                                  }
                                }}
                                className="text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* CASO 4: DERIVACIÓN / ATENCIÓN MÉDICA ESPECIALIZADA A RED PÚBLICA */}
                {activeCategory === 'medical_derivation' && (
                  <div key="category-block-medical_derivation" className="space-y-4 animate-in fade-in duration-200">
                    {/* Selector de Servicio Asistencial */}
                    <FormField
                      control={form.control}
                      name="derivationService"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1">
                              <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                              Servicio o Atención Requerida *
                            </FormLabel>
                            <span className="text-[9px] text-blue-700 font-black uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {SERVICES_MATRIX.length} Atenciones Consolidadas
                            </span>
                          </div>
                          <Select 
                            onValueChange={(val) => handleSelectService(val)} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 rounded-xl font-bold text-xs bg-white border-slate-300">
                                <SelectValue placeholder="Seleccione el servicio o examen médico..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[340px]">
                              {SERVICES_MATRIX.map((s) => (
                                <SelectItem key={s.id} value={s.name} className="text-xs font-semibold">
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Chips rápidos de servicios de alta demanda */}
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-slate-400">Atenciones Frecuentes:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Laboratorio",
                          "Rayos X (RX)",
                          "Ecosonografía / Eco",
                          "Medicina General",
                          "Medicina Interna",
                          "Pediatría",
                          "Traumatología",
                          "Ginecología",
                          "Cirugía General",
                          "Fisiatría / Rehabilitación (SRI)",
                          "Oftalmología / Salud Visual",
                          "Odontología / Salud Bucal",
                          "Trastornos Neurodesarrollo"
                        ].map((serviceQuick) => (
                          <button
                            key={serviceQuick}
                            type="button"
                            onClick={() => handleSelectService(serviceQuick)}
                            className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all ${
                              selectedDerivationService === serviceQuick
                                ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {serviceQuick}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Centros Asistenciales y Clínicas en Convenio Disponibles */}
                    {selectedDerivationService ? (
                      <div className="space-y-2 pt-2">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center justify-between">
                          <span>Instituciones Asistenciales / Clínicas con Disponibilidad:</span>
                          <span className="text-emerald-700 font-bold text-[9px]">{availableCentersForSelectedService.filter(c => c.isAvailable).length} Opciones</span>
                        </FormLabel>

                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                          {availableCentersForSelectedService.map(({ center, status, isAvailable, isSpecialized }) => {
                            const isSelected = selectedDerivationCenter === center.name;

                            return (
                              <div
                                key={center.id}
                                onClick={() => {
                                  if (isAvailable) {
                                    handleSelectCenter(center.name, center.id, status);
                                  }
                                }}
                                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                  !isAvailable 
                                    ? 'opacity-40 bg-slate-50/50 border-slate-200 cursor-not-allowed'
                                    : isSelected
                                      ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20 cursor-pointer'
                                      : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected 
                                      ? 'bg-emerald-600 text-white' 
                                      : isAvailable 
                                        ? 'bg-slate-100 text-slate-600' 
                                        : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    <Building2 className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className={`text-xs font-black truncate uppercase ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                                        {center.name}
                                      </p>
                                      {center.isConvenio && (
                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                          Convenio
                                        </span>
                                      )}
                                      {center.id.startsWith('asic') && (
                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 border border-cyan-300">
                                          ASIC Comunal
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[9px] text-slate-500 truncate">{center.type}</p>
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  {status === 'DISPONIBLE' && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Disponible
                                    </span>
                                  )}
                                  {status === 'ESPECIALIZADO' && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                                      <Sparkles className="w-2.5 h-2.5" /> Especializado
                                    </span>
                                  )}
                                  {status === 'NO DISPONIBLE' && (
                                    <span className="inline-flex items-center text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                                      No Disponible
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {form.formState.errors.derivationCenter && (
                          <p className="text-[10px] font-bold text-red-500 mt-1">
                            {form.formState.errors.derivationCenter.message}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
                        <Stethoscope className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-xs font-bold text-slate-600 uppercase">Seleccione una especialidad o examen</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">El sistema le presentará de inmediato las instituciones asistenciales disponibles.</p>
                      </div>
                    )}

                    {/* Motivo, Detalle de la Ayuda y Observaciones */}
                    <FormField
                      control={form.control}
                      name="derivationReason"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                              <span>Detalle de la Ayuda / Exámenes de Laboratorio / Observación Clínica</span>
                              {selectedDerivationCenter?.includes("Santa Ana") && (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                                  Convenio Clínica Santa Ana
                                </span>
                              )}
                            </FormLabel>
                          </div>
                          <FormControl>
                            <Input 
                              placeholder="Ej. Clínica Santa Ana: Perfil 20, Hematología Completa, Química Sanguínea, Consulta Cardiología..." 
                              className="h-11 rounded-xl text-xs bg-slate-50/50 focus:bg-white" 
                              {...field} 
                            />
                          </FormControl>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Sugerencias rápidas:</span>
                            {[
                              "Hematología Completa + Química",
                              "Perfil 20 + Orina y Heces",
                              "Perfil Lipídico + Glicemia",
                              "Ecografía Abdominal / Pélvica",
                              "Evaluación Médica Especializada"
                            ].map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => {
                                  const current = field.value || "";
                                  const newVal = current ? `${current}, ${sug}` : sug;
                                  field.onChange(newVal);
                                }}
                                className="text-[9px] font-semibold text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 px-2 py-0.5 rounded-md transition-colors"
                              >
                                + {sug}
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Información sobre la emisión de orden manual */}
                    <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-indigo-950">
                      <div className="flex items-start gap-2.5">
                        <Printer className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                          <span className="font-black uppercase tracking-wide">Impresión de Orden Médica Manual:</span>
                          <p className="text-slate-600 mt-0.5">
                            La orden se registra en el sistema <strong>sin descarga automática</strong>. Podrá imprimirla o descargarla manualmente mediante la notificación de confirmación o desde el panel de control.
                          </p>
                        </div>
                      </div>

                      {selectedDerivationService && selectedDerivationCenter && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            generateDerivationPdf({
                              id: 'BORRADOR',
                              createdAt: new Date(),
                              workerId: form.getValues('workerId'),
                              medication: `${selectedDerivationService} ➔ ${selectedDerivationCenter}`,
                              presentation: form.getValues('derivationStatus') === 'ESPECIALIZADO' ? 'Atención Especializada' : 'Derivación Directa',
                              dosage: selectedDerivationCenter,
                              frequency: 'Orden Asistencial',
                              duration: 'Red Pública',
                              quantity: 1,
                              commune: form.getValues('commune'),
                              prescribedBy: user?.uid || 'user',
                              category: 'medical_derivation',
                              derivationService: selectedDerivationService,
                              derivationCenter: selectedDerivationCenter,
                              derivationStatus: form.getValues('derivationStatus'),
                              derivationReason: form.getValues('derivationReason'),
                              deliveryOfficer: form.getValues('deliveryOfficer'),
                              status: form.getValues('deliveryMode') === 'delivered' ? 'delivered' : 'pending',
                            }, selectedWorker);
                          }}
                          className="shrink-0 h-8 text-[10px] font-bold border-indigo-300 bg-white hover:bg-indigo-100 text-indigo-900 gap-1.5 rounded-lg shadow-2xs"
                          title="Descargar o imprimir borrador preliminar de la orden"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-700" />
                          Imprimir Orden Manual
                        </Button>
                      )}
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* 4. CARGA / DIGITALIZACIÓN DE RÉCIPE / SOPORTE (OPCIONAL) */}
            <Card className="border-slate-200/80 shadow-sm md:col-span-2 rounded-2xl">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Soporte Digital / Fotografía de la Solicitud o Informe Médico (Opcional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <p className="text-[11px] text-slate-500 leading-normal">
                  Puede adjuntar una fotografía o copia escaneada de la orden previa, informe médico o justificativo. (Máximo: 2MB)
                </p>

                {!recipeFileUrl ? (
                  <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center text-center bg-slate-50/50 cursor-pointer relative group">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="recipe-file-uploader"
                    />
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Haga clic o arrastre una foto / documento aquí
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-medium">
                      Soporta imágenes (PNG, JPG) o PDF
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-blue-200 bg-blue-50/30 rounded-2xl">
                    {recipeFileUrl.startsWith("data:image/") ? (
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white shrink-0">
                        <img
                          src={recipeFileUrl}
                          alt="Vista previa de soporte"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <FileText className="w-8 h-8 text-slate-400" />
                        <span className="text-[8px] uppercase tracking-wider font-bold text-slate-500 mt-1">PDF</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Archivo Adjunto:</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{recipeFileName || "soporte-digitalizado"}</p>
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={removeFile}
                          className="px-3 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 uppercase font-black tracking-widest text-[9px] flex items-center gap-1 mx-auto sm:mx-0 shadow-none hover:text-rose-700"
                        >
                          <X className="w-3 h-3" /> Eliminar archivo
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 5. BOTONES DE ACCIÓN */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            {isWorkerInactiveOrBlocked ? (
              <Button 
                key="btn-inactive-blocked"
                type="button" 
                disabled={true}
                className="bg-rose-100 text-rose-800 border border-rose-300 px-6 font-black uppercase text-xs tracking-wider h-12 w-full sm:w-auto rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-90 shadow-none"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Ciudadano Inactivo / Bloqueado
              </Button>
            ) : isDualBlocked && !isUrgentWatch ? (
              <Button 
                key="btn-blocked"
                type="button" 
                onClick={() => {
                  const repDni = form.getValues("representativeDni") || "N/A";
                  const errorDesc = isPatientBlocked && isRepBlocked
                    ? `Tanto el paciente titular como el apoderado (C.I. ${repDni}) han alcanzado el límite de 2 ayudas en 30 días hábiles.`
                    : isRepBlocked
                    ? `El representante legal (C.I. ${repDni}) ya retiró el máximo de 2 ayudas en los últimos 30 días hábiles.`
                    : "El ciudadano titular ya alcanzó el límite de 2 ayudas en los últimos 30 días hábiles.";
                  toast.error("Bloqueo Dual Inteligente Activo", {
                    description: `${errorDesc} Active la casilla 'Habilitar Salto de Urgencia' e ingrese la justificación obligatoria para autorizar una excepción auditada.`
                  });
                }}
                className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-8 font-black uppercase text-xs tracking-wider h-12 w-full sm:w-auto rounded-xl flex items-center justify-center gap-2 cursor-not-allowed shadow-none"
              >
                <Lock className="w-4 h-4 text-rose-600" />
                {isPatientBlocked && isRepBlocked
                  ? "Bloqueo Dual: Paciente y Representante (2/2)"
                  : isRepBlocked
                  ? "Bloqueado: C.I. de Representante al Límite (2/2)"
                  : "Bloqueado por Límite de Ayudas (2/2)"}
              </Button>
            ) : isDualBlocked && isUrgentWatch ? (
              <Button 
                key="btn-urgent"
                type="submit" 
                disabled={isSubmitting}
                className="bg-rose-700 hover:bg-rose-800 text-white px-8 font-black uppercase text-xs tracking-wider h-12 w-full sm:w-auto rounded-xl shadow-lg shadow-rose-700/25 flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-5 h-5 text-amber-300" />
                {isSubmitting ? "Procesando Excepción Dual..." : "Registrar Ayuda con Salto de Urgencia"}
              </Button>
            ) : activeCategory === 'medical_derivation' ? (
              <Button 
                key="btn-derivation"
                type="submit" 
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 font-black uppercase text-xs tracking-wider h-12 w-full sm:w-auto rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isSubmitting ? "Registrando Derivación..." : "Registrar Requerimiento de Derivación"}
              </Button>
            ) : activeDeliveryMode === 'delivered' ? (
              <Button 
                key="btn-delivered"
                type="submit" 
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 font-black uppercase text-xs tracking-wider h-12 w-full sm:w-auto rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Guardar Entrega Inmediata (In Situ)
              </Button>
            ) : (
              <Button 
                key="btn-pending"
                type="submit" 
                disabled={isSubmitting}
                className="bg-blue-900 hover:bg-blue-950 text-white px-8 font-black uppercase text-xs tracking-wider h-12 w-full sm:w-auto rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                Registrar Solicitud en Cola
              </Button>
            )}
          </div>
        </form>
      </Form>
    </>
  );
}
