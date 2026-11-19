import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { COMMUNES, OTHER_COMMUNE_OPTION, WORKER_STATUS, SOCIAL_AREAS, ACADEMIC_LEVELS } from '@/constants';
import DisabilitySelect from '@/components/DisabilitySelect';
import { toast } from "sonner";
import { 
  User, 
  Briefcase, 
  MapPin, 
  Award, 
  Trash2, 
  PlusCircle, 
  Users, 
  GraduationCap, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  FolderOpen,
  Pill,
  ClipboardCheck,
  BookOpen,
  ArrowRight,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Baby,
  Edit3,
  Sparkles,
  Building2
} from "lucide-react";
import { Worker } from '@/types';
import { dataService } from '@/lib/dataService';
import { normalizeDni, generateMinorDni, detectDuplicateCitizen } from '@/utils/securityDni';

const familyMemberSchema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  dni: z.string().optional().or(z.literal('')),
  relationship: z.string().min(1, "Relación requerida"),
  birthDate: z.string().optional().or(z.literal('')).transform(v => (v && v.trim()) ? v.trim() : "SIN FECHA"),
  gender: z.enum(['M', 'F', 'Other']).default('M'),
  hasDisability: z.boolean().default(false),
  disabilityType: z.string().optional().or(z.literal('')),
});

const workerSchema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  dni: z.string().min(5, "Cédula requerida"),
  birthDate: z.string().optional().or(z.literal('')).transform(v => (v && v.trim()) ? v.trim() : "SIN FECHA"),
  gender: z.enum(['M', 'F', 'Other']),
  civilStatus: z.string().min(1, "Estado civil requerido"),
  phone: z.string().optional().or(z.literal('')).default("NO POSEE"),
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  commune: z.string().min(1, "Comuna requerida"),
  originLocation: z.string().optional().or(z.literal('')),
  sector: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'retired']),
  address: z.string().optional().or(z.literal('')),
  hasDisability: z.boolean().default(false),
  disabilityType: z.string().optional().or(z.literal('')),
  socialArea: z.string().optional().or(z.literal('')),
  customSocialArea: z.string().optional().or(z.literal('')),
  socialAreaSecondary: z.string().optional().or(z.literal('')),
  customSocialAreaSecondary: z.string().optional().or(z.literal('')),
  workplaceDepartment: z.string().optional().or(z.literal('')),
  votingCenter: z.string().optional().or(z.literal('')),
  academicLevel: z.string().optional().or(z.literal('')),
  academicDegree: z.string().optional().or(z.literal('')),
  familyMembers: z.array(familyMemberSchema).default([]),
}).superRefine((data, ctx) => {
  const isForeigner = data.commune === OTHER_COMMUNE_OPTION || data.commune === 'OTRO' || data.commune?.startsWith('OTRO');
  if (isForeigner) {
    if (!data.originLocation || data.originLocation.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar el municipio o lugar de procedencia del ciudadano foráneo",
        path: ["originLocation"]
      });
    }
  } else {
    if (!data.sector || data.sector.trim().length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sector requerido para comunas del Municipio Sotillo",
        path: ["sector"]
      });
    }
  }
});

interface WorkerFormProps {
  worker?: Worker;
  onSuccess?: () => void;
  onSavedWithAction?: (savedWorker: Worker, action: 'recipe' | 'expediente' | 'new' | 'close') => void;
  existingWorkers?: Worker[];
  onSelectExistingWorker?: (existing: Worker) => void;
}

export default function WorkerForm({ 
  worker, 
  onSuccess,
  onSavedWithAction,
  existingWorkers,
  onSelectExistingWorker
}: WorkerFormProps) {
  const isEditing = !!worker;
  const [savedWorkerModal, setSavedWorkerModal] = useState<Worker | null>(null);
  const submitActionRef = useRef<'modal' | 'recipe' | 'expediente'>('modal');
  
  // Decide what default values to render for social classification (soporte para 1 o 2 razones sociales)
  let rawPrimary = "";
  let rawSecondary = "";

  if (worker?.socialAreas && worker.socialAreas.length > 0) {
    rawPrimary = worker.socialAreas[0] || "";
    rawSecondary = worker.socialAreas[1] || "";
  } else if (worker?.socialArea) {
    if (worker.socialArea.includes(" / ")) {
      const parts = worker.socialArea.split(" / ");
      rawPrimary = parts[0]?.trim() || "";
      rawSecondary = parts[1]?.trim() || "";
    } else {
      rawPrimary = worker.socialArea.trim();
    }
  }

  const initialSocialArea = rawPrimary 
    ? (SOCIAL_AREAS.includes(rawPrimary) ? rawPrimary : (rawPrimary === "NO_APLICA" ? "NO_APLICA" : "OTROS")) 
    : "";
  const initialCustomSocialArea = rawPrimary && !SOCIAL_AREAS.includes(rawPrimary) && rawPrimary !== "NO_APLICA"
    ? rawPrimary
    : "";

  const initialSocialAreaSecondary = rawSecondary
    ? (SOCIAL_AREAS.includes(rawSecondary) ? rawSecondary : (rawSecondary === "NO_APLICA" ? "" : "OTROS"))
    : "";
  const initialCustomSocialAreaSecondary = rawSecondary && !SOCIAL_AREAS.includes(rawSecondary) && rawSecondary !== "NO_APLICA"
    ? rawSecondary
    : "";

  const isWorkerForeigner = worker?.isForeigner || 
    worker?.commune === OTHER_COMMUNE_OPTION || 
    worker?.commune === 'OTRO' || 
    worker?.commune?.startsWith('OTRO');

  const initialCommuneValue = isWorkerForeigner ? OTHER_COMMUNE_OPTION : (worker?.commune || "");
  const initialOriginLocation = worker?.originLocation || 
    (worker?.commune?.startsWith('OTRO: ') ? worker.commune.replace('OTRO: ', '') : "");

  const form = useForm<z.infer<typeof workerSchema>>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      fullName: worker?.fullName || "",
      dni: worker?.dni || "",
      birthDate: worker?.birthDate || "",
      status: worker?.status || "active",
      gender: worker?.gender || "M",
      civilStatus: worker?.civilStatus || "Soltero/a",
      phone: worker?.phone || "",
      email: worker?.email || "",
      commune: initialCommuneValue,
      originLocation: initialOriginLocation,
      sector: worker?.sector || "",
      address: worker?.address || "",
      hasDisability: worker?.hasDisability || false,
      disabilityType: worker?.disabilityType || "",
      socialArea: initialSocialArea,
      customSocialArea: initialCustomSocialArea,
      socialAreaSecondary: initialSocialAreaSecondary,
      customSocialAreaSecondary: initialCustomSocialAreaSecondary,
      workplaceDepartment: worker?.workplaceDepartment || "",
      votingCenter: worker?.votingCenter || "",
      academicLevel: worker?.academicLevel || "",
      academicDegree: worker?.academicDegree || "",
      familyMembers: worker?.familyMembers || [],
    },
  });

  // Commune Watch for conditional origin input
  const communeWatch = form.watch("commune");

  // DNI Existence Check State (Operatividad, Escalabilidad y Anti-Duplicados)
  const watchedDni = form.watch("dni");
  const [isCheckingDni, setIsCheckingDni] = useState(false);
  const [existingCitizen, setExistingCitizen] = useState<Worker | null>(null);
  const [lastCheckedDni, setLastCheckedDni] = useState<string>("");
  const [loadedExistingAsEdit, setLoadedExistingAsEdit] = useState<Worker | null>(null);
  const [secondaryWarning, setSecondaryWarning] = useState<{ type: string; worker: Worker; message: string } | null>(null);
  const [minorModalOpen, setMinorModalOpen] = useState(false);
  const [minorRepDni, setMinorRepDni] = useState('');
  const [minorChildIndex, setMinorChildIndex] = useState('1');

  const effectiveWorkerId = isEditing ? worker?.id : loadedExistingAsEdit?.id;

  useEffect(() => {
    const rawDni = (watchedDni || "").trim();
    
    // Ignorar si la cédula es menor a 5 caracteres, o si coincide con el ciudadano actualmente en edición
    const currentEditDni = (worker?.dni || loadedExistingAsEdit?.dni || "").trim().toLowerCase();
    if (rawDni.length < 5 || (effectiveWorkerId && rawDni.toLowerCase() === currentEditDni)) {
      setExistingCitizen(null);
      setIsCheckingDni(false);
      setLastCheckedDni("");
      setSecondaryWarning(null);
      return;
    }

    setIsCheckingDni(true);
    const timer = setTimeout(async () => {
      try {
        const cleanInput = rawDni.toLowerCase();
        const numInput = cleanInput.replace(/\D/g, '');
        const normInput = normalizeDni(rawDni).toLowerCase();

        let found: Worker | undefined = undefined;

        // 1. Verificación instantánea en memoria si se suministraron los trabajadores cargados (0ms latencia)
        if (existingWorkers && existingWorkers.length > 0) {
          found = existingWorkers.find(w => {
            if (effectiveWorkerId && w.id === effectiveWorkerId) return false;
            const wDni = (w.dni || "").trim().toLowerCase();
            if (wDni === cleanInput || wDni === normInput) return true;
            const wNum = wDni.replace(/\D/g, '');
            return numInput.length >= 5 && wNum === numInput;
          });
        }

        // 2. Consulta específica en Firestore si no se halló en memoria local
        if (!found) {
          const dbWorker = await dataService.findWorkerByDni(rawDni);
          if (dbWorker && (!effectiveWorkerId || dbWorker.id !== effectiveWorkerId)) {
            found = dbWorker;
          }
        }

        setExistingCitizen(found || null);
        setLastCheckedDni(rawDni);

        // 3. Verificación de homónimos / teléfonos secundarios si no hay match directo de C.I.
        if (!found && existingWorkers && existingWorkers.length > 0) {
          const secondaryCheck = detectDuplicateCitizen(
            {
              id: effectiveWorkerId,
              dni: rawDni,
              fullName: form.getValues("fullName"),
              birthDate: form.getValues("birthDate"),
              phone: form.getValues("phone"),
            },
            existingWorkers
          );
          if (secondaryCheck.type === 'name_birth_match' || secondaryCheck.type === 'phone_match') {
            setSecondaryWarning({
              type: secondaryCheck.type,
              worker: secondaryCheck.matchedWorker!,
              message: secondaryCheck.message,
            });
          } else {
            setSecondaryWarning(null);
          }
        } else {
          setSecondaryWarning(null);
        }
      } catch (err) {
        console.error("Error al validar existencia de cédula:", err);
      } finally {
        setIsCheckingDni(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [watchedDni, isEditing, worker, loadedExistingAsEdit, effectiveWorkerId, existingWorkers, form]);

  const handleLoadExistingToEdit = () => {
    if (!existingCitizen) return;
    const target = existingCitizen;
    setLoadedExistingAsEdit(target);
    let targetRawPrimary = "";
    let targetRawSecondary = "";
    if (target.socialAreas && target.socialAreas.length > 0) {
      targetRawPrimary = target.socialAreas[0] || "";
      targetRawSecondary = target.socialAreas[1] || "";
    } else if (target.socialArea) {
      if (target.socialArea.includes(" / ")) {
        const parts = target.socialArea.split(" / ");
        targetRawPrimary = parts[0]?.trim() || "";
        targetRawSecondary = parts[1]?.trim() || "";
      } else {
        targetRawPrimary = target.socialArea.trim();
      }
    }

    const loadedSocialArea = targetRawPrimary
      ? (SOCIAL_AREAS.includes(targetRawPrimary) ? targetRawPrimary : (targetRawPrimary === "NO_APLICA" ? "NO_APLICA" : "OTROS"))
      : "";
    const loadedCustomSocialArea = targetRawPrimary && !SOCIAL_AREAS.includes(targetRawPrimary) && targetRawPrimary !== "NO_APLICA"
      ? targetRawPrimary
      : "";

    const loadedSocialAreaSecondary = targetRawSecondary
      ? (SOCIAL_AREAS.includes(targetRawSecondary) ? targetRawSecondary : (targetRawSecondary === "NO_APLICA" ? "" : "OTROS"))
      : "";
    const loadedCustomSocialAreaSecondary = targetRawSecondary && !SOCIAL_AREAS.includes(targetRawSecondary) && targetRawSecondary !== "NO_APLICA"
      ? targetRawSecondary
      : "";

    form.reset({
      fullName: target.fullName || "",
      dni: target.dni || "",
      birthDate: target.birthDate || "",
      status: target.status || "active",
      gender: target.gender || "M",
      civilStatus: target.civilStatus || "Soltero/a",
      phone: target.phone || "",
      email: target.email || "",
      commune: target.commune || "",
      originLocation: target.originLocation || "",
      sector: target.sector || "",
      address: target.address || "",
      hasDisability: target.hasDisability || false,
      disabilityType: target.disabilityType || "",
      socialArea: loadedSocialArea,
      customSocialArea: loadedCustomSocialArea,
      socialAreaSecondary: loadedSocialAreaSecondary,
      customSocialAreaSecondary: loadedCustomSocialAreaSecondary,
      workplaceDepartment: target.workplaceDepartment || "",
      votingCenter: target.votingCenter || "",
      academicLevel: target.academicLevel || "",
      academicDegree: target.academicDegree || "",
      familyMembers: target.familyMembers || [],
    });
    setExistingCitizen(null);
    toast.success(`Expediente de ${target.fullName} cargado en el formulario para actualización directa.`);
  };

  const handleApplyMinorDni = () => {
    if (!minorRepDni || minorRepDni.trim().length < 4) {
      toast.error("Debe ingresar la cédula del representante legal.");
      return;
    }
    const idx = parseInt(minorChildIndex || "1", 10) || 1;
    const generated = generateMinorDni(minorRepDni, idx);
    form.setValue("dni", generated, { shouldValidate: true, shouldDirty: true });
    setMinorModalOpen(false);
    toast.success(`Identificador de menor asignado: ${generated}`);
  };

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "familyMembers"
  });

  async function onSubmit(values: z.infer<typeof workerSchema>) {
    try {
      // Blindaje adicional: Impedir registro si ya existe la cédula
      if (!isEditing && !loadedExistingAsEdit && existingCitizen) {
        toast.error(`Acción bloqueada: Esta cédula ya pertenece a ${existingCitizen.fullName}. Abra su expediente o cárguelo para actualizar.`);
        return;
      }

      const primaryVal = values.socialArea === "OTROS" 
        ? (values.customSocialArea?.trim().toUpperCase() || "OTROS") 
        : (values.socialArea && values.socialArea !== "NO_APLICA" ? values.socialArea : "");

      const secondaryVal = values.socialAreaSecondary === "OTROS"
        ? (values.customSocialAreaSecondary?.trim().toUpperCase() || "OTROS")
        : (values.socialAreaSecondary && values.socialAreaSecondary !== "NO_APLICA" ? values.socialAreaSecondary : "");

      const socialAreasList: string[] = [];
      if (primaryVal) socialAreasList.push(primaryVal);
      if (secondaryVal && secondaryVal !== primaryVal) socialAreasList.push(secondaryVal);

      const socialAreaCombined = socialAreasList.join(" / ");

      const isForeigner = values.commune === OTHER_COMMUNE_OPTION || values.commune === 'OTRO' || values.commune.startsWith('OTRO');
      const originLocationValue = isForeigner 
        ? (values.originLocation?.trim().toUpperCase() || "FUERA DEL MUNICIPIO SOTILLO") 
        : "";
      const finalCommune = isForeigner 
        ? (originLocationValue ? `OTRO: ${originLocationValue}` : OTHER_COMMUNE_OPTION) 
        : values.commune;
      const finalSector = values.sector?.trim() || (isForeigner ? (originLocationValue || "FORÁNEO") : "");

      const normalizedInputDni = normalizeDni(values.dni) || values.dni.trim().toUpperCase();

      const payload = {
        fullName: values.fullName.trim(),
        dni: normalizedInputDni,
        birthDate: values.birthDate || "",
        gender: values.gender,
        civilStatus: values.civilStatus,
        address: values.address?.trim() || "",
        phone: values.phone?.trim() ? values.phone.trim() : "NO POSEE",
        email: values.email?.trim() || "",
        emergencyContact: "",
        status: values.status,
        commune: finalCommune,
        isForeigner: !!isForeigner,
        originLocation: isForeigner ? originLocationValue : "",
        sector: finalSector,
        hasDisability: !!values.hasDisability,
        disabilityType: values.hasDisability ? values.disabilityType || "" : "",
        socialArea: socialAreaCombined,
        socialAreas: socialAreasList,
        workplaceDepartment: values.workplaceDepartment?.trim().toUpperCase() || "",
        votingCenter: values.votingCenter?.trim() || "",
        academicLevel: values.academicLevel?.trim() || "",
        academicDegree: values.academicDegree?.trim() || "",
        familyMembers: (values.familyMembers || []).map(m => ({
          fullName: m.fullName?.trim() || "",
          dni: m.dni?.trim() || "",
          relationship: m.relationship || "HIJO(A)",
          birthDate: m.birthDate || "",
          gender: (m.gender || "M") as "M" | "F" | "Other",
          hasDisability: !!m.hasDisability,
          disabilityType: m.disabilityType || ""
        })),
      };

      if (loadedExistingAsEdit) {
        await dataService.updateWorker(loadedExistingAsEdit.id, payload);
        toast.success("Expediente de ciudadano actualizado exitosamente");
        onSuccess?.();
      } else if (isEditing && worker) {
        await dataService.updateWorker(worker.id, payload);
        toast.success("Expediente de ciudadano actualizado exitosamente");
        onSuccess?.();
      } else {
        // Doble verificación directa en base de datos antes de insertar
        const dbExistingCheck = await dataService.findWorkerByDni(normalizedInputDni);
        if (dbExistingCheck) {
          setExistingCitizen(dbExistingCheck);
          toast.error(`Acción bloqueada: La cédula ${normalizedInputDni} ya está registrada a nombre de "${dbExistingCheck.fullName}".`);
          return;
        }

        const newWorkerId = await dataService.addWorker(payload);
        if (!newWorkerId) {
          throw new Error("No se pudo generar el identificador del nuevo ciudadano.");
        }

        const fullWorker: Worker = {
          ...payload,
          id: newWorkerId,
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        };

        const chosenAction = submitActionRef.current;
        if (chosenAction === 'recipe') {
          toast.success("Ciudadano registrado. Abriendo carga de requerimientos...");
          if (onSavedWithAction) {
            onSavedWithAction(fullWorker, 'recipe');
          } else {
            onSuccess?.();
          }
        } else if (chosenAction === 'expediente') {
          toast.success("Ciudadano registrado. Abriendo expediente...");
          if (onSavedWithAction) {
            onSavedWithAction(fullWorker, 'expediente');
          } else {
            onSuccess?.();
          }
        } else {
          // Modal de confirmación inmediata con acciones clave (Opción 1)
          toast.success("Ciudadano registrado exitosamente");
          setSavedWorkerModal(fullWorker);
        }
      }
    } catch (error: any) {
      console.error("Save Error:", error);
      if (error?.message?.startsWith("DUPLICATE_DNI")) {
        toast.error(error.message.replace("DUPLICATE_DNI: ", ""));
        return;
      }
      const isPermissionDenied = error?.message?.includes?.("permission-denied") || error?.message?.includes?.("PERMISSION_DENIED");
      if (isPermissionDenied) {
        toast.error("Permiso denegado: Tu usuario requiere rol de Editor o Administrador para registrar ciudadanos.");
      } else {
        toast.error(isEditing || loadedExistingAsEdit ? "Error al actualizar expediente" : "Error al registrar ciudadano");
      }
    }
  }

  const handleModalSelectAction = (action: 'recipe' | 'expediente' | 'new' | 'close') => {
    if (!savedWorkerModal) return;
    const workerToPass = savedWorkerModal;
    setSavedWorkerModal(null);

    if (action === 'new') {
      form.reset();
      submitActionRef.current = 'modal';
      onSavedWithAction?.(workerToPass, 'new');
      toast.info("Formulario reiniciado para registrar nuevo ciudadano");
    } else {
      if (onSavedWithAction) {
        onSavedWithAction(workerToPass, action);
      } else {
        onSuccess?.();
      }
    }
  };

  const handleCloseModal = () => {
    if (!savedWorkerModal) return;
    const workerToPass = savedWorkerModal;
    setSavedWorkerModal(null);
    if (onSavedWithAction) {
      onSavedWithAction(workerToPass, 'close');
    } else {
      onSuccess?.();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Datos Personales */}
          <Card className="border-slate-100 shadow-sm h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Datos del Ciudadano
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Información básica de identificación y contacto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Juan Perez" className="h-10 sm:h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Cédula de Identidad *
                        </FormLabel>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setMinorModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-all cursor-pointer"
                            title="Generar identificador oficial para menor sin cédula basado en el representante legal"
                          >
                            <Baby className="w-3 h-3 text-indigo-600" />
                            Menor sin C.I.
                          </button>
                          {isCheckingDni && (
                            <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1 animate-pulse">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              Verificando...
                            </span>
                          )}
                          {!isCheckingDni && existingCitizen && (
                            <span className="text-[9px] font-black uppercase text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 flex items-center gap-1">
                              <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                              Ya Registrado
                            </span>
                          )}
                          {!isCheckingDni && !existingCitizen && lastCheckedDni && lastCheckedDni.length >= 5 && (
                            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              Disponible
                            </span>
                          )}
                        </div>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="V-12.345.678" 
                            className={`h-10 sm:h-11 pr-8 ${
                              existingCitizen 
                                ? 'border-rose-400 focus-visible:ring-rose-400 bg-rose-50/60 text-rose-950 font-bold' 
                                : (!isCheckingDni && lastCheckedDni && lastCheckedDni.length >= 5)
                                ? 'border-emerald-400 focus-visible:ring-emerald-400 bg-emerald-50/20'
                                : ''
                            }`} 
                            {...field} 
                          />
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            {isCheckingDni ? (
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            ) : existingCitizen ? (
                              <ShieldAlert className="w-4 h-4 text-rose-600" />
                            ) : (!isCheckingDni && lastCheckedDni && lastCheckedDni.length >= 5) ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : null}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Fecha de Nacimiento
                        </FormLabel>
                        <button
                          type="button"
                          onClick={() => {
                            if (field.value === "SIN FECHA") {
                              form.setValue("birthDate", "", { shouldValidate: true, shouldDirty: true });
                            } else {
                              form.setValue("birthDate", "SIN FECHA", { shouldValidate: true, shouldDirty: true });
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border transition-all duration-150 cursor-pointer ${
                            field.value === "SIN FECHA"
                              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border-slate-200'
                          }`}
                          title="Marcar si el ciudadano no posee o no recuerda su fecha de nacimiento"
                        >
                          {field.value === "SIN FECHA" ? (
                            <>✓ Sin Fecha</>
                          ) : (
                            <>🚫 Sin Fecha</>
                          )}
                        </button>
                      </div>
                      <FormControl>
                        {field.value === "SIN FECHA" ? (
                          <div className="relative">
                            <Input
                              type="text"
                              value="SIN FECHA DE NACIMIENTO REGISTRADA"
                              readOnly
                              className="h-10 sm:h-11 bg-amber-50/70 border-amber-300 text-amber-900 font-bold text-xs cursor-default select-none"
                            />
                          </div>
                        ) : (
                          <Input type="date" className="h-10 sm:h-11" {...field} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Panel de Alerta y Bloqueo Preventivo cuando el Ciudadano ya está registrado */}
              {!isCheckingDni && existingCitizen && (
                <div className="p-3.5 sm:p-4 bg-rose-50/95 border-2 border-rose-400 rounded-xl space-y-2.5 text-rose-950 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between gap-2 border-b border-rose-200/80 pb-2">
                    <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-tight text-rose-950">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>¡Seguridad: Este ciudadano ya se encuentra registrado!</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      existingCitizen.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : existingCitizen.status === 'inactive' 
                        ? 'bg-rose-100 text-rose-800 border-rose-300' 
                        : 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      {existingCitizen.status === 'active' ? '🟢 Activo' : existingCitizen.status === 'inactive' ? '🔴 Inactivo' : '⚪ Jubilado'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] font-black text-rose-800/90 block uppercase tracking-wider">Nombre Registrado:</span>
                      <span className="font-black text-slate-900 text-sm">{existingCitizen.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-rose-800/90 block uppercase tracking-wider">Cédula:</span>
                      <span className="font-bold text-slate-800 font-mono text-sm">{existingCitizen.dni}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[9px] font-black text-rose-800/90 block uppercase tracking-wider">Comuna y Sector:</span>
                      <span className="font-bold text-slate-800">{existingCitizen.commune} {existingCitizen.sector ? `• Sector ${existingCitizen.sector}` : ''}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-rose-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <p className="text-[10px] text-rose-900 font-bold leading-tight">
                      Para evitar registros duplicados, puede abrir su expediente o cargar sus datos para actualizar.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleLoadExistingToEdit}
                        className="bg-blue-700 hover:bg-blue-800 text-white font-black text-[10px] uppercase tracking-wider h-8 rounded-lg shadow-xs cursor-pointer gap-1.5 shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Cargar para Actualizar
                      </Button>
                      {onSelectExistingWorker && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectExistingWorker(existingCitizen)}
                          className="bg-white hover:bg-slate-50 text-slate-800 border-rose-300 font-black text-[10px] uppercase tracking-wider h-8 rounded-lg shadow-xs cursor-pointer gap-1.5 shrink-0"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                          Abrir Expediente
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Panel Preventivo de Homónimos o Coincidencias Secundarias */}
              {!isCheckingDni && !existingCitizen && secondaryWarning && (
                <div className="p-3 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-2 text-amber-950 shadow-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Aviso Preventivo de Coincidencia de Datos</span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-400">
                      Homónimo Detectado
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-snug">
                    {secondaryWarning.message}
                  </p>
                  <div className="pt-1.5 border-t border-amber-200 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-amber-800 font-medium">
                      Verifique que no se trate de la misma persona con un error tipográfico en la cédula.
                    </span>
                    {onSelectExistingWorker && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectExistingWorker(secondaryWarning.worker)}
                        className="h-7 text-[9px] font-black uppercase tracking-wider text-amber-900 border-amber-400 hover:bg-amber-100 shrink-0"
                      >
                        <FolderOpen className="w-3 h-3 mr-1" />
                        Revisar Coincidente
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Notificación activa si se cargó un expediente para actualizar */}
              {loadedExistingAsEdit && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-blue-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Modo Actualización de Expediente Existente: {loadedExistingAsEdit.fullName} ({loadedExistingAsEdit.dni})</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLoadedExistingAsEdit(null);
                      form.reset();
                    }}
                    className="h-6 text-[9px] font-black uppercase text-blue-700 hover:bg-blue-100"
                  >
                    Salir de Actualización
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sexo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-10 sm:h-11">
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                          <SelectItem value="Other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Teléfono Celular</FormLabel>
                        <button
                          type="button"
                          onClick={() => {
                            if (field.value === "NO POSEE") {
                              form.setValue("phone", "", { shouldValidate: true, shouldDirty: true });
                            } else {
                              form.setValue("phone", "NO POSEE", { shouldValidate: true, shouldDirty: true });
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border transition-all duration-150 cursor-pointer ${
                            field.value === "NO POSEE"
                              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border-slate-200'
                          }`}
                          title="Marcar si el ciudadano no cuenta con teléfono celular"
                        >
                          {field.value === "NO POSEE" ? (
                            <>✓ Sin Número</>
                          ) : (
                            <>🚫 Sin Número</>
                          )}
                        </button>
                      </div>
                      <FormControl>
                        <Input 
                          placeholder="0412... o haga clic en 'Sin Número'" 
                          className={`h-10 sm:h-11 ${field.value === 'NO POSEE' ? 'bg-amber-50/50 border-amber-200 text-amber-900 font-bold' : ''}`} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dirección de Domicilio</FormLabel>
                    <FormControl>
                      <Input placeholder="Av. Principal, Edif..." className="h-10 sm:h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Territorio */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Territorialización
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Ubicación geográfica del ciudadano</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                 <FormField
                  control={form.control}
                  name="commune"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Comuna *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-10 sm:h-11">
                            <SelectValue placeholder="Seleccione Comuna" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[350px] min-w-[280px] md:min-w-[480px]">
                          {COMMUNES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          <SelectItem 
                            value={OTHER_COMMUNE_OPTION} 
                            className="font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/90 mt-1 border-t border-slate-200 cursor-pointer"
                          >
                            📍 {OTHER_COMMUNE_OPTION}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Casilla interactiva condicional para indicar de dónde viene el ciudadano */}
                {(communeWatch === OTHER_COMMUNE_OPTION || communeWatch === 'OTRO' || (communeWatch && communeWatch.startsWith('OTRO'))) && (
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
                          Especifique de dónde viene la persona para registrarla y monitorearla de forma independiente en las métricas institucionales.
                        </p>
                        <FormMessage className="text-amber-900 font-bold text-[11px]" />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {(communeWatch === OTHER_COMMUNE_OPTION || (communeWatch && communeWatch.startsWith('OTRO')))
                          ? 'Sector / Parroquia de Origen (Opcional)'
                          : 'Sector / Comunidad *'}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={(communeWatch === OTHER_COMMUNE_OPTION || (communeWatch && communeWatch.startsWith('OTRO')))
                            ? 'Ej. Casco Central / No Aplica'
                            : 'Ej. Barrio Lindo'} 
                          className="h-10 sm:h-11" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estatus en el Sistema</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-10 sm:h-11">
                            <SelectValue placeholder="Seleccione estatus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Activo (En seguimiento)</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                          <SelectItem value="retired">Dado de Alta / Fallecido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Clasificación Social y Electoral con Soporte de Doble Razón Social */}
            <Card className="border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    Estructura Social y Razón Social
                  </CardTitle>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded-md w-fit">
                    Doble Rol Soportado
                  </span>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  Permite asignar 2 razones sociales simultáneas (ej. Jefe de UBCH y Trabajador de la Alcaldía)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Atajos Rápidos de Doble Razón Social */}
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Atajos Rápidos para Casos con Doble Razón Social:
                    </span>
                    <span className="text-[9px] text-blue-700 font-bold hidden sm:inline">1 clic para completar</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("socialArea", "JEFE UBCH", { shouldDirty: true });
                        form.setValue("socialAreaSecondary", "TRABAJADOR DE LA ALCALDIA", { shouldDirty: true });
                        toast.success("Asignado: Jefe de UBCH + Trabajador de la Alcaldía");
                      }}
                      className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-950 hover:bg-blue-100/80 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      ⭐ Jefe UBCH + Trabajador Alcaldía
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("socialArea", "LIDER DE CALLE", { shouldDirty: true });
                        form.setValue("socialAreaSecondary", "TRABAJADOR DE LA ALCALDIA", { shouldDirty: true });
                        toast.success("Asignado: Líder de Calle + Trabajador de la Alcaldía");
                      }}
                      className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-950 hover:bg-blue-100/80 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      ⭐ Líder Calle + Trabajador Alcaldía
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("socialArea", "VOCERO CONSEJO COMUNAL", { shouldDirty: true });
                        form.setValue("socialAreaSecondary", "TRABAJADOR DE LA ALCALDIA", { shouldDirty: true });
                        toast.success("Asignado: Vocero Comunal + Trabajador de la Alcaldía");
                      }}
                      className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-950 hover:bg-blue-100/80 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      ⭐ Vocero Comunal + Trabajador Alcaldía
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("socialArea", "ADULTO MAYOR", { shouldDirty: true });
                        form.setValue("socialAreaSecondary", "TRABAJADOR DE LA ALCALDIA", { shouldDirty: true });
                        toast.success("Asignado: Adulto Mayor + Trabajador de la Alcaldía");
                      }}
                      className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-950 hover:bg-blue-100/80 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      ⭐ Adulto Mayor + Trabajador Alcaldía
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* 1ra Razón Social / Área Principal */}
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="socialArea"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1">
                            <span>1ra Razón Social / Área Principal</span>
                          </FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val !== "OTROS") {
                                form.setValue("customSocialArea", "");
                              }
                            }} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10 sm:h-11 bg-white font-bold text-xs">
                                <SelectValue placeholder="Seleccione 1ra Área Social" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="NO_APLICA">Ninguno / No Aplica</SelectItem>
                              {SOCIAL_AREAS.map((area) => (
                                <SelectItem key={area} value={area}>{area}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("socialArea") === "OTROS" && (
                      <FormField
                        control={form.control}
                        name="customSocialArea"
                        render={({ field }) => (
                          <FormItem className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-blue-600">Especifique 1ra Razón Social</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ej. TRABAJADOR DE SALUD..." 
                                className="h-10 sm:h-11 uppercase font-bold border-blue-200 focus-visible:ring-blue-600 text-xs" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {/* 2da Razón Social / Vinculación Institucional Adicional */}
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="socialAreaSecondary"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1">
                            <span>2da Razón Social / Vinculación Adicional (Opcional)</span>
                          </FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val !== "OTROS") {
                                form.setValue("customSocialAreaSecondary", "");
                              }
                            }} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10 sm:h-11 bg-white font-bold text-xs">
                                <SelectValue placeholder="Sin 2da razón (Opcional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="NO_APLICA">Ninguna / No Aplica</SelectItem>
                              {SOCIAL_AREAS.map((area) => (
                                <SelectItem key={`sec-${area}`} value={area}>{area}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("socialAreaSecondary") === "OTROS" && (
                      <FormField
                        control={form.control}
                        name="customSocialAreaSecondary"
                        render={({ field }) => (
                          <FormItem className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-blue-600">Especifique 2da Razón Social</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ej. PERSONAL ALCALDIA..." 
                                className="h-10 sm:h-11 uppercase font-bold border-blue-200 focus-visible:ring-blue-600 text-xs" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Badge visual de Doble Razón Social Activa */}
                {(() => {
                  const p = form.watch("socialArea");
                  const s = form.watch("socialAreaSecondary");
                  const pCustom = form.watch("customSocialArea");
                  const sCustom = form.watch("customSocialAreaSecondary");
                  const pFinal = p === "OTROS" ? (pCustom || "OTROS") : (p && p !== "NO_APLICA" ? p : "");
                  const sFinal = s === "OTROS" ? (sCustom || "OTROS") : (s && s !== "NO_APLICA" ? s : "");

                  if (pFinal && sFinal && pFinal !== sFinal) {
                    return (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center gap-2 text-xs animate-in fade-in duration-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-black uppercase tracking-tight text-[11px] text-emerald-950">
                            Afiliación Doble Configurada:
                          </p>
                          <p className="text-[11px] font-bold text-emerald-900 mt-0.5">
                            {pFinal} <span className="text-emerald-600 font-black">✚</span> {sFinal}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Casilla Dinámica y Directa: Dirección o Ente de la Alcaldía */}
                {(() => {
                  const s1 = form.watch("socialArea") || "";
                  const s2 = form.watch("socialAreaSecondary") || "";
                  const c1 = form.watch("customSocialArea") || "";
                  const c2 = form.watch("customSocialAreaSecondary") || "";
                  const isAlcaldia = 
                    s1 === "TRABAJADOR DE LA ALCALDIA" || 
                    s2 === "TRABAJADOR DE LA ALCALDIA" ||
                    c1.toUpperCase().includes("ALCALD") ||
                    c2.toUpperCase().includes("ALCALD");

                  if (!isAlcaldia) return null;

                  return (
                    <FormField
                      control={form.control}
                      name="workplaceDepartment"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 p-3.5 bg-blue-50/70 border-2 border-blue-200 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-blue-950 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            Dirección o Ente de la Alcaldía
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ej. Salud, Polisotillo, Servicios Públicos, Talento Humano, Infraestructura..." 
                              className="h-10 sm:h-11 uppercase font-bold text-xs bg-white border-blue-300 focus-visible:ring-blue-600 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                          <p className="text-[10px] text-blue-800 font-medium">
                            Indique el departamento, dirección o instituto de la alcaldía al que pertenece el trabajador.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })()}

                <FormField
                  control={form.control}
                  name="votingCenter"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Eje / Centro de Votación</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Escuela Básica Sotillo..." className="h-10 sm:h-11 uppercase text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Formación Académica */}
            <Card className="border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Formación Académica
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Nivel educativo alcanzado y profesión u oficio del ciudadano</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <FormField
                  control={form.control}
                  name="academicLevel"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nivel de Instrucción / Estudios</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-10 sm:h-11">
                            <SelectValue placeholder="Seleccione Nivel Educativo (Opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="NO_ESPECIFICADO">No especificado</SelectItem>
                          {ACADEMIC_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="academicDegree"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Título Obtenido / Profesión u Oficio</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Lcdo. en Educación, Mecánico, Bachiller, Albañil..." className="h-10 sm:h-11 uppercase" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Registrar Discapacidad Checkbox */}
            <Card className="border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                  <span className="text-blue-600">♿</span>
                  Diversidad Funcional
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Registro de condiciones de discapacidad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <FormField
                  control={form.control}
                  name="hasDisability"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                          checked={field.value}
                          onChange={field.onChange}
                          id="hasDisability-checkbox"
                        />
                      </FormControl>
                      <div className="space-y-0.5 cursor-pointer" onClick={() => field.onChange(!field.value)}>
                        <FormLabel className="text-xs font-black uppercase tracking-wider text-slate-700 cursor-pointer" htmlFor="hasDisability-checkbox">
                          ¿Presenta alguna Discapacidad?
                        </FormLabel>
                        <FormDescription className="text-[10px] leading-normal text-slate-500">
                          Habilite si padece de discapacidad física o sensorial.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("hasDisability") && (
                  <FormField
                    control={form.control}
                    name="disabilityType"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Tipo de Discapacidad / Clasificación *
                        </FormLabel>
                        <FormControl>
                          <DisabilitySelect
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="Seleccione Clasificación de Discapacidad..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 👪 BLOQUE IV: Núcleo Familiar */}
        <Card className="border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300 mt-6">
          <CardHeader className="pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 uppercase font-black text-blue-900 tracking-tight">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Carga Familiar (Núcleo Familiar)
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Registre los parientes directos que conviven con el ciudadano</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ fullName: "", dni: "", relationship: "HIJO(A)", birthDate: "", gender: "M", hasDisability: false, disabilityType: "" })}
              className="font-bold uppercase text-[10px] tracking-widest border-blue-200 text-blue-900 hover:bg-blue-50/50 w-full sm:w-auto h-10 flex items-center gap-2 shrink-0 animate-pulse"
            >
              <PlusCircle className="w-4 h-4" />
              Agregar Integrante
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {fields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-150 rounded-xl bg-slate-50/30">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">No se han ingresado familiares de carga</p>
                <p className="text-slate-400 text-[10px] mt-1 font-sans">Hago clic en "Agregar Integrante" para añadir parentesco a este ciudadano.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative border border-slate-200 hover:border-slate-350 p-4 rounded-xl bg-slate-50/20 hover:bg-slate-50/45 transition-colors duration-250 animate-in fade-in slide-in-from-top-2">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg border border-red-150 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Eliminar Integrante"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pr-8">
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombres y Apellidos</label>
                        <Input
                          placeholder="Ej. Juan Pérez"
                          className="h-10 uppercase text-xs font-bold"
                          {...form.register(`familyMembers.${index}.fullName`)}
                        />
                        {form.formState.errors.familyMembers?.[index]?.fullName && (
                          <p className="text-xs text-red-500">{form.formState.errors.familyMembers[index]?.fullName?.message}</p>
                        )}
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cédula de Identidad</label>
                        <Input
                          placeholder="Ej. V-123456"
                          className="h-10 uppercase text-xs"
                          {...form.register(`familyMembers.${index}.dni`)}
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Parentesco</label>
                        <select
                          className="w-full h-10 px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold uppercase text-slate-700 outline-none focus:border-blue-500"
                          {...form.register(`familyMembers.${index}.relationship`)}
                        >
                          <option value="HIJO(A)">HIJO(A)</option>
                          <option value="CONYUGUE">CONYUGE / PAREJA</option>
                          <option value="MADRE">MADRE</option>
                          <option value="PADRE">PADRE</option>
                          <option value="HERMANO(A)">HERMANO(A)</option>
                          <option value="ABUELO(A)">ABUELO(A)</option>
                          <option value="NIETO(A)">NIETO(A)</option>
                          <option value="OTRO">OTRO FAMILIAR</option>
                        </select>
                        {form.formState.errors.familyMembers?.[index]?.relationship && (
                          <p className="text-xs text-red-500">{form.formState.errors.familyMembers[index]?.relationship?.message}</p>
                        )}
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">F. Nacimiento</label>
                          <button
                            type="button"
                            onClick={() => {
                              const currentVal = form.watch(`familyMembers.${index}.birthDate`);
                              if (currentVal === "SIN FECHA") {
                                form.setValue(`familyMembers.${index}.birthDate`, "", { shouldDirty: true, shouldValidate: true });
                              } else {
                                form.setValue(`familyMembers.${index}.birthDate`, "SIN FECHA", { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              form.watch(`familyMembers.${index}.birthDate`) === "SIN FECHA"
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                            }`}
                            title="Marcar si no se posee la fecha de nacimiento del familiar"
                          >
                            {form.watch(`familyMembers.${index}.birthDate`) === "SIN FECHA" ? "✓ S/F" : "🚫 S/F"}
                          </button>
                        </div>
                        {form.watch(`familyMembers.${index}.birthDate`) === "SIN FECHA" ? (
                          <Input
                            type="text"
                            value="SIN FECHA"
                            readOnly
                            className="h-10 text-xs bg-amber-50/70 border-amber-300 text-amber-900 font-bold cursor-default select-none"
                          />
                        ) : (
                          <Input
                            type="date"
                            className="h-10 text-xs"
                            {...form.register(`familyMembers.${index}.birthDate`)}
                          />
                        )}
                        {form.formState.errors.familyMembers?.[index]?.birthDate && (
                          <p className="text-xs text-red-500">{form.formState.errors.familyMembers[index]?.birthDate?.message}</p>
                        )}
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Género</label>
                        <select
                          className="w-full h-10 px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold uppercase text-slate-700 outline-none focus:border-blue-500"
                          {...form.register(`familyMembers.${index}.gender`)}
                        >
                          <option value="M">MASCULINO</option>
                          <option value="F">FEMENINO</option>
                          <option value="Other">OTRO</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <label className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-wider text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                          {...form.register(`familyMembers.${index}.hasDisability`)}
                        />
                        <span>¿Posee alguna discapacidad funcional?</span>
                      </label>

                      {form.watch(`familyMembers.${index}.hasDisability`) && (
                        <div className="w-full sm:max-w-md">
                          <DisabilitySelect
                            value={form.watch(`familyMembers.${index}.disabilityType`) || ""}
                            onChange={(val) => form.setValue(`familyMembers.${index}.disabilityType`, val, { shouldDirty: true })}
                            placeholder="Seleccione discapacidad del familiar..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aviso de bloqueo preventivo anti-duplicados */}
        {!isEditing && !loadedExistingAsEdit && existingCitizen && (
          <div className="mt-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-tight">
                  Registro Bloqueado por Seguridad Anti-Duplicados
                </p>
                <p className="text-[11px] text-rose-800">
                  La cédula <strong>{watchedDni}</strong> ya pertenece a <strong>{existingCitizen.fullName}</strong>. Para no repetir a la persona, cargue los datos o abra su expediente existente.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                onClick={handleLoadExistingToEdit}
                className="bg-blue-700 hover:bg-blue-800 text-white font-black text-[10px] uppercase tracking-wider h-8 rounded-lg shadow-xs cursor-pointer gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Cargar y Actualizar
              </Button>
              {onSelectExistingWorker && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectExistingWorker(existingCitizen)}
                  className="bg-white hover:bg-slate-50 text-slate-800 border-rose-300 font-black text-[10px] uppercase tracking-wider h-8 rounded-lg shadow-xs cursor-pointer gap-1"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                  Abrir
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 sm:mt-10 pt-4 border-t border-slate-200">
          <Button 
            type="button" 
            variant="outline" 
            className="font-bold uppercase text-[10px] tracking-widest w-full sm:w-auto h-11 border-slate-300 text-slate-600 hover:bg-slate-100" 
            onClick={() => {
              setLoadedExistingAsEdit(null);
              form.reset();
            }}
          >
            Limpiar Formulario
          </Button>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {isEditing || loadedExistingAsEdit ? (
              <Button 
                type="submit" 
                className="bg-blue-900 hover:bg-blue-950 px-8 font-black uppercase text-[10px] tracking-widest h-11 w-full sm:w-auto shadow-md shadow-blue-900/20"
              >
                Guardar Expediente
              </Button>
            ) : (
              <>
                <Button 
                  type="submit"
                  disabled={!isEditing && !loadedExistingAsEdit && !!existingCitizen}
                  onClick={() => { submitActionRef.current = 'modal'; }}
                  variant="outline"
                  className="bg-white hover:bg-blue-50 text-blue-900 border-blue-300 font-black uppercase text-[10px] tracking-widest h-11 px-5 w-full sm:w-auto shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4 mr-2 text-blue-600" />
                  Registrar Ficha
                </Button>

                <Button 
                  type="submit"
                  disabled={!isEditing && !loadedExistingAsEdit && !!existingCitizen}
                  onClick={() => { submitActionRef.current = 'expediente'; }}
                  className="bg-blue-800 hover:bg-blue-900 text-white font-black uppercase text-[10px] tracking-widest h-11 px-5 w-full sm:w-auto shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ClipboardCheck className="w-4 h-4 mr-2 text-blue-200" />
                  Registrar y Ver Expediente
                </Button>

                <Button 
                  type="submit"
                  disabled={!isEditing && !loadedExistingAsEdit && !!existingCitizen}
                  onClick={() => { submitActionRef.current = 'recipe'; }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 font-black uppercase text-[10px] tracking-widest h-11 w-full sm:w-auto shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pill className="w-4 h-4 mr-2 text-white" />
                  Registrar y Cargar Requerimiento →
                </Button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* Diálogo Estandarizador para Menores sin Cédula */}
      <Dialog open={minorModalOpen} onOpenChange={setMinorModalOpen}>
        <DialogContent className="w-[94vw] sm:w-full max-w-[94vw] sm:max-w-md max-h-[90dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
          <div className="bg-gradient-to-r from-indigo-950 via-blue-900 to-indigo-900 text-white p-4 sm:p-5 pr-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shrink-0">
                <Baby className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight">
                  Generar Identificador de Menor sin C.I.
                </h4>
                <p className="text-[11px] text-indigo-200">
                  Estandariza el registro vinculado al representante legal (ej: V-12345678-HIJO1)
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 bg-white space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                Cédula del Representante Legal *
              </label>
              <Input
                placeholder="Ej. V-12345678 o 12345678"
                value={minorRepDni}
                onChange={(e) => setMinorRepDni(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                Número de Hijo o Dependiente *
              </label>
              <Select value={minorChildIndex} onValueChange={setMinorChildIndex}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccione número de hijo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Hijo 1 (-HIJO1)</SelectItem>
                  <SelectItem value="2">Hijo 2 (-HIJO2)</SelectItem>
                  <SelectItem value="3">Hijo 3 (-HIJO3)</SelectItem>
                  <SelectItem value="4">Hijo 4 (-HIJO4)</SelectItem>
                  <SelectItem value="5">Hijo 5 (-HIJO5)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                Vista Previa del Identificador Oficial:
              </span>
              <span className="font-mono font-bold text-blue-900 text-sm">
                {minorRepDni.trim() ? generateMinorDni(minorRepDni, parseInt(minorChildIndex, 10) || 1) : 'Ingrese la cédula para previsualizar'}
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMinorModalOpen(false)}
                className="h-9 text-[10px] font-bold uppercase tracking-wider text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleApplyMinorDni}
                disabled={!minorRepDni || minorRepDni.trim().length < 4}
                className="h-9 text-[10px] font-black uppercase tracking-wider bg-indigo-700 hover:bg-indigo-800 text-white"
              >
                Asignar al Formulario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ventana de Confirmación Inmediata con Acciones Clave (Modal Post-Guardado - Opción 1) */}
      <Dialog open={!!savedWorkerModal} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent className="w-[95vw] sm:w-full max-w-[95vw] sm:max-w-xl max-h-[90dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
          <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white p-4 sm:p-6 pr-12 relative">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-inner">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Registro Exitoso
                  </span>
                  <span className="text-[10px] font-bold text-blue-200">
                    Base de Datos Sotillo
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight uppercase truncate mt-1">
                  {savedWorkerModal?.fullName}
                </h3>
                <p className="text-xs text-blue-200 font-medium">
                  C.I. {savedWorkerModal?.dni} • Comuna: {savedWorkerModal?.commune} {savedWorkerModal?.sector ? `(${savedWorkerModal.sector})` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-slate-50">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
              ¿Qué acción desea realizar a continuación?
            </p>

            <div className="grid grid-cols-1 gap-3">
              {/* Opción 1: Requerimiento / Farmacia */}
              <button
                type="button"
                onClick={() => handleModalSelectAction('recipe')}
                className="group relative flex items-start gap-3.5 p-4 rounded-xl bg-white border-2 border-emerald-500/40 hover:border-emerald-600 hover:bg-emerald-50/40 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Pill className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-900">
                      Cargar Requerimiento / Solicitud Médica
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-normal mt-1 leading-relaxed">
                    Registrar entrega o solicitud de medicamentos, pañales o ayudas humanas con los datos del paciente ya precargados.
                  </p>
                </div>
              </button>

              {/* Opción 2: Expediente Completo */}
              <button
                type="button"
                onClick={() => handleModalSelectAction('expediente')}
                className="group relative flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <ClipboardCheck className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-900">
                    Abrir Expediente Integral del Paciente
                  </span>
                  <p className="text-xs text-slate-600 font-normal mt-1 leading-relaxed">
                    Consultar la ficha clínica integral, registrar antecedentes médicos, núcleo familiar o derivar a la red asistencial.
                  </p>
                </div>
              </button>

              {/* Opción 3: Nuevo Ciudadano */}
              <button
                type="button"
                onClick={() => handleModalSelectAction('new')}
                className="group relative flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-100 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <UserPlus className="w-5 h-5 text-slate-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    Censar a Otro Ciudadano
                  </span>
                  <p className="text-xs text-slate-600 font-normal mt-1 leading-relaxed">
                    Limpiar el formulario y preparar la pantalla para registrar a la siguiente persona.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleModalSelectAction('close')}
                className="text-slate-500 hover:text-slate-800 font-bold uppercase text-[10px] tracking-wider"
              >
                Volver al Directorio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
