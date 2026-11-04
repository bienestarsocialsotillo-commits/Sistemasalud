import React, { useState } from 'react';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import DisabilitySelect from '@/components/DisabilitySelect';
import { toast } from "sonner";
import { 
  History, 
  Heart, 
  User, 
  Briefcase, 
  Plus, 
  Trash2, 
  Activity, 
  Award, 
  ShieldAlert, 
  Stethoscope, 
  ClipboardCheck, 
  Scale,
  Home
} from "lucide-react";

import { useEffect } from 'react';
import { dataService } from '@/lib/dataService';

const historySchema = z.object({
  workerId: z.string().min(1),
  personalHistory: z.object({
    hypertension: z.boolean().default(false),
    diabetes: z.boolean().default(false),
    asthma: z.boolean().default(false),
    allergies: z.string().optional().or(z.literal('')),
    surgeries: z.string().optional().or(z.literal('')),
    chronicDiseases: z.string().optional().or(z.literal('')),
    permanentMeds: z.string().optional().or(z.literal('')),
    medicationsNeeded: z.string().optional().or(z.literal('')),
    medicationFrequency: z.string().optional().or(z.literal('')),
  }),
  familyHistory: z.object({
    heartDisease: z.boolean().default(false),
    diabetes: z.boolean().default(false),
    hypertension: z.boolean().default(false),
    cancer: z.boolean().default(false),
    others: z.string().optional().or(z.literal('')),
  }),
  // Nuevos campos para salud, discapacidad y ayudas humanas
  pathology: z.string().optional().or(z.literal('')),
  hasDisability: z.boolean().default(false),
  disabilityType: z.string().optional().or(z.literal('')),
  requiresTechnicalAid: z.boolean().default(false),
  technicalAidType: z.string().optional().or(z.literal('')),
  technicalAidQuantity: z.number().min(0).default(0),
  technicalAidNotes: z.string().optional().or(z.literal('')),
  dependency: z.string().optional().or(z.literal('')),
  housingConditions: z.object({
    housingType: z.string().default('casa'),
    ownTerrain: z.string().default('no'),
    tenure: z.string().default('propia'),
    roof: z.string().default('zinc'),
    walls: z.string().default('frisadas'),
    floor: z.string().default('cemento'),
    floorOther: z.string().optional().or(z.literal('')),
    waterSupply: z.string().default('acueducto'),
    sewage: z.string().default('cloacas'),
    electricity: z.string().default('publico_con_medidor'),
    gas: z.string().default('bombona'),
  }).optional(),

  // Carga integrada de examen físico y evaluación clínica
  includePhysicalExam: z.boolean().default(false),
  weight: z.coerce.number().min(0).default(0),
  height: z.coerce.number().min(0).default(0),
  bloodPressure: z.string().default('120/80'),
  heartRate: z.coerce.number().min(0).default(0),
  oxygenSaturation: z.coerce.number().min(0).default(0),
  temperature: z.coerce.number().min(0).default(0),
  diagnosis: z.string().optional().or(z.literal('')),
  recommendations: z.string().optional().or(z.literal('')),
  determination: z.string().default('fit'),
});

type HistoryValues = z.infer<typeof historySchema>;

export default function MedicalHistoryForm({ 
  workerId, 
  onSuccess, 
  defaultIncludePhysicalExam = false 
}: { 
  workerId: string; 
  onSuccess?: () => void; 
  defaultIncludePhysicalExam?: boolean; 
}) {
  const form = useForm<HistoryValues>({
    resolver: zodResolver(historySchema),
    defaultValues: {
      workerId,
      personalHistory: { 
        hypertension: false, 
        diabetes: false, 
        asthma: false, 
        allergies: "", 
        surgeries: "", 
        chronicDiseases: "", 
        permanentMeds: "",
        medicationsNeeded: "",
        medicationFrequency: "",
      },
      familyHistory: { 
        heartDisease: false, 
        diabetes: false, 
        hypertension: false, 
        cancer: false, 
        others: "" 
      },
      pathology: "",
      hasDisability: false,
      disabilityType: "",
      requiresTechnicalAid: false,
      technicalAidType: "ninguno",
      technicalAidQuantity: 0,
      technicalAidNotes: "",
      dependency: "INDEPENDIENTE",
      housingConditions: {
        housingType: "casa",
        ownTerrain: "no",
        tenure: "propia",
        roof: "zinc",
        walls: "frisadas",
        floor: "cemento",
        floorOther: "",
        waterSupply: "acueducto",
        sewage: "cloacas",
        electricity: "publico_con_medidor",
        gas: "bombona",
      },
      
      includePhysicalExam: defaultIncludePhysicalExam,
      weight: 0,
      height: 0,
      bloodPressure: "120/80",
      heartRate: 0,
      oxygenSaturation: 0,
      temperature: 0,
      diagnosis: "",
      recommendations: "",
      determination: "fit"
    },
  });

  useEffect(() => {
    const loadHistory = async () => {
      const data = await dataService.getMedicalHistory(workerId);
      if (data) {
        // Ensure properties exist before resetting
        form.reset({
          ...data,
          workerId: workerId, // Explicitly preserve workerId
          personalHistory: {
            hypertension: data.personalHistory?.hypertension || false,
            diabetes: data.personalHistory?.diabetes || false,
            asthma: data.personalHistory?.asthma || false,
            allergies: data.personalHistory?.allergies || "",
            surgeries: data.personalHistory?.surgeries || "",
            chronicDiseases: data.personalHistory?.chronicDiseases || "",
            permanentMeds: data.personalHistory?.permanentMeds || "",
            medicationsNeeded: data.personalHistory?.medicationsNeeded || "",
            medicationFrequency: data.personalHistory?.medicationFrequency || "",
          },
          familyHistory: {
            heartDisease: data.familyHistory?.heartDisease || false,
            diabetes: data.familyHistory?.diabetes || false,
            hypertension: data.familyHistory?.hypertension || false,
            cancer: data.familyHistory?.cancer || false,
            others: data.familyHistory?.others || "",
          },
          pathology: data.pathology || "",
          hasDisability: !!data.hasDisability,
          disabilityType: data.disabilityType || "",
          requiresTechnicalAid: !!data.requiresTechnicalAid,
          technicalAidType: data.technicalAidType || "ninguno",
          technicalAidQuantity: data.technicalAidQuantity || 0,
          technicalAidNotes: data.technicalAidNotes || "",
          dependency: data.dependency || "INDEPENDIENTE",
          housingConditions: {
            housingType: data.housingConditions?.housingType || "casa",
            ownTerrain: data.housingConditions?.ownTerrain || "no",
            tenure: data.housingConditions?.tenure || "propia",
            roof: data.housingConditions?.roof || "zinc",
            walls: data.housingConditions?.walls || "frisadas",
            floor: data.housingConditions?.floor || "cemento",
            floorOther: data.housingConditions?.floorOther || "",
            waterSupply: data.housingConditions?.waterSupply || "acueducto",
            sewage: data.housingConditions?.sewage || "cloacas",
            electricity: data.housingConditions?.electricity || "publico_con_medidor",
            gas: data.housingConditions?.gas || "bombona",
          },
          includePhysicalExam: defaultIncludePhysicalExam,
          weight: 0,
          height: 0,
          bloodPressure: "120/80",
          heartRate: 0,
          oxygenSaturation: 0,
          temperature: 0,
          diagnosis: "",
          recommendations: "",
          determination: "fit"
        });
      }
    };
    loadHistory();
  }, [workerId, form, defaultIncludePhysicalExam]);

  const onSubmit: SubmitHandler<HistoryValues> = async (values) => {
    try {
      // 1. Guardar antecedentes clínicos principales
      await dataService.saveMedicalHistory(workerId, {
        workerId: values.workerId,
        personalHistory: {
          hypertension: values.personalHistory.hypertension,
          diabetes: values.personalHistory.diabetes,
          asthma: values.personalHistory.asthma,
          allergies: values.personalHistory.allergies || "",
          surgeries: values.personalHistory.surgeries || "",
          chronicDiseases: values.personalHistory.chronicDiseases || "",
          permanentMeds: values.personalHistory.permanentMeds || "",
          medicationsNeeded: values.personalHistory.medicationsNeeded || "",
          medicationFrequency: values.personalHistory.medicationFrequency || "",
        },
        familyHistory: {
          heartDisease: values.familyHistory.heartDisease,
          diabetes: values.familyHistory.diabetes,
          hypertension: values.familyHistory.hypertension,
          cancer: values.familyHistory.cancer,
          others: values.familyHistory.others || "",
        },
        pathology: values.pathology || "",
        hasDisability: values.hasDisability,
        disabilityType: values.disabilityType || "",
        requiresTechnicalAid: values.requiresTechnicalAid,
        technicalAidType: values.technicalAidType || "ninguno",
        technicalAidQuantity: values.requiresTechnicalAid ? (values.technicalAidQuantity || 1) : 0,
        technicalAidNotes: values.technicalAidNotes || "",
        dependency: values.dependency || "INDEPENDIENTE",
        housingConditions: values.housingConditions ? {
          housingType: values.housingConditions.housingType || "casa",
          ownTerrain: values.housingConditions.ownTerrain || "no",
          tenure: values.housingConditions.tenure || "propia",
          roof: values.housingConditions.roof || "zinc",
          walls: values.housingConditions.walls || "frisadas",
          floor: values.housingConditions.floor || "cemento",
          floorOther: values.housingConditions.floorOther || "",
          waterSupply: values.housingConditions.waterSupply || "acueducto",
          sewage: values.housingConditions.sewage || "cloacas",
          electricity: values.housingConditions.electricity || "publico_con_medidor",
          gas: values.housingConditions.gas || "bombona",
        } : undefined,
      });

      // 2. Si se solicitó cargar el EXAMEN FÍSICO junto a los antecedentes
      if (values.includePhysicalExam) {
        const heightNum = typeof values.height === 'number' ? values.height : parseFloat(String(values.height)) || 0;
        const weightNum = typeof values.weight === 'number' ? values.weight : parseFloat(String(values.weight)) || 0;
        const imcNum = heightNum > 0 ? parseFloat((weightNum / (heightNum * heightNum)).toFixed(2)) : 0;

        await dataService.addEvaluation(workerId, {
          type: 'periodic',
          physical: {
            weight: weightNum,
            height: heightNum,
            bmi: imcNum,
            bloodPressure: values.bloodPressure || "120/80",
            heartRate: typeof values.heartRate === 'number' ? values.heartRate : parseInt(String(values.heartRate)) || 0,
            oxygenSaturation: typeof values.oxygenSaturation === 'number' ? values.oxygenSaturation : parseInt(String(values.oxygenSaturation)) || 0,
            temperature: typeof values.temperature === 'number' ? values.temperature : parseFloat(String(values.temperature)) || 0,
          },
          labs: {
            results: "Evaluado en Censo Directo de Antecedentes",
          },
          diagnosis: values.diagnosis || values.pathology || "Evaluación Clínica Realizada desde el Censo",
          medicationsNeeded: values.personalHistory.medicationsNeeded || "",
          medicationFrequency: values.personalHistory.medicationFrequency || "",
          recommendations: values.recommendations || "Control médico periódico",
          determination: (values.determination || "fit") as any,
        });
      }

      // 3. Si se cargaron medicamentos de base, registrar automáticamente la solicitud o requerimiento en Farmacia
      if (values.personalHistory.medicationsNeeded && values.personalHistory.medicationsNeeded.trim()) {
        try {
          const workersList = await dataService.getWorkers();
          const targetWorker = workersList.find(w => w.id === values.workerId);
          const workerCommune = targetWorker?.commune || "Sotillo";

          await dataService.addMedicationRecipe({
            workerId: values.workerId,
            medication: values.personalHistory.medicationsNeeded.trim(),
            presentation: "Caja/Frasco",
            dosage: "Continuo",
            frequency: values.personalHistory.medicationFrequency || "Según Indicación",
            duration: "Permanente",
            quantity: 1,
            commune: workerCommune,
            requiresTechnicalAid: false,
            status: 'pending',
          });
        } catch (recipeErr) {
          console.error("Error auto-creating medication recipe from clinical history:", recipeErr);
        }
      }

      // 4. Si requiere ayuda humana, registrarla automáticamente como solicitud en Farmacia
      if (values.requiresTechnicalAid && values.technicalAidType && values.technicalAidType !== 'ninguno') {
        try {
          const workersList = await dataService.getWorkers();
          const targetWorker = workersList.find(w => w.id === values.workerId);
          const workerCommune = targetWorker?.commune || "Sotillo";

          await dataService.addMedicationRecipe({
            workerId: values.workerId,
            medication: values.technicalAidType,
            presentation: "Unidad",
            dosage: "N/A",
            frequency: "Único",
            duration: "N/A",
            quantity: values.technicalAidQuantity || 1,
            commune: workerCommune,
            requiresTechnicalAid: true,
            technicalAidType: values.technicalAidType,
            technicalAidQuantity: values.technicalAidQuantity || 1,
            technicalAidNotes: values.technicalAidNotes || "Desde Historia Clínica",
            status: 'pending',
          });
        } catch (recipeErr) {
          console.error("Error auto-creating technical aid recipe from clinical history:", recipeErr);
        }
      }

      toast.success(values.includePhysicalExam 
        ? "Antecedentes e informe de examen físico cargados correctamente"
        : "Antecedentes clínicos actualizados con éxito"
      );
      onSuccess?.();
    } catch (error) {
      console.error("Save Error:", error);
      toast.error("Error al guardar antecedentes e información médica");
    }
  };

  const weightValue = form.watch("weight");
  const heightValue = form.watch("height");
  const weight = typeof weightValue === 'number' ? weightValue : parseFloat(weightValue) || 0;
  const height = typeof heightValue === 'number' ? heightValue : parseFloat(heightValue) || 0;
  const imc = height > 0 ? (weight / (height * height)).toFixed(2) : "0.00";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
        console.error("MedicalHistoryForm Validation Errors:", errors);
        toast.error("Por favor, corrija los errores en el formulario.");
      })} className="space-y-6">
        {/* Selector de Carga de Antecedentes y Examen Físico / Antropometría */}
        <div className="bg-slate-150 p-1.5 rounded-xl grid grid-cols-2 gap-1.5 w-full max-w-2xl mx-auto shadow-inner border border-slate-200">
          <button
            type="button"
            className={`flex items-center justify-center gap-2.5 py-3 rounded-lg text-xs tracking-wider transition-all cursor-pointer ${
              !form.watch("includePhysicalExam")
                ? "bg-white text-blue-900 shadow-md font-bold ring-1 ring-black/5"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
            onClick={() => form.setValue("includePhysicalExam", false)}
          >
            <History className="w-4.5 h-4.5 text-blue-600 shrink-0" />
            <div className="text-left leading-tight">
              <span className="block font-black uppercase tracking-tight text-[11px]">1. Solo Antecedentes</span>
              <span className="block text-[9px] text-slate-400 font-bold">Historial clínico y patologías</span>
            </div>
          </button>
          
          <button
            type="button"
            className={`flex items-center justify-center gap-2.5 py-3 rounded-lg text-xs tracking-wider transition-all cursor-pointer ${
              form.watch("includePhysicalExam")
                ? "bg-white text-emerald-950 shadow-md font-bold ring-1 ring-black/5 border-l border-slate-100"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
            onClick={() => form.setValue("includePhysicalExam", true)}
          >
            <Activity className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <div className="text-left leading-tight">
              <span className="block font-black uppercase tracking-tight text-[11px]">2. Antecedentes + Examen</span>
              <span className="block text-[9px] text-emerald-600 font-bold">Signos vitales y examen físico</span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Antecedentes Personales */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Antecedentes Personales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-slate-50">
                <FormField
                  control={form.control}
                  name="personalHistory.hypertension"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="hyper" checked={field.value} onCheckedChange={field.onChange} />
                      <label htmlFor="hyper" className="text-sm font-medium">Hipertensión</label>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="personalHistory.diabetes"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="diab" checked={field.value} onCheckedChange={field.onChange} />
                      <label htmlFor="diab" className="text-sm font-medium">Diabetes</label>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="personalHistory.asthma"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="asthma" checked={field.value} onCheckedChange={field.onChange} />
                      <label htmlFor="asthma" className="text-sm font-medium">Asma</label>
                    </div>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="personalHistory.allergies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alergias</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="personalHistory.medicationsNeeded"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medicamentos Requeridos</FormLabel>
                    <FormControl><Textarea className="min-h-[60px]" placeholder="Medicinas necesarias para el paciente..." {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="personalHistory.medicationFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frecuencia y Posología</FormLabel>
                    <FormControl><Textarea className="min-h-[60px]" placeholder="Instrucciones de uso..." {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Antecedentes Familiares */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600" />
                Antecedentes Familiares
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50">
                <FormField
                  control={form.control}
                  name="familyHistory.heartDisease"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="f_heart" checked={field.value} onCheckedChange={field.onChange} />
                      <label htmlFor="f_heart" className="text-sm font-medium">Cardiopatías</label>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="familyHistory.cancer"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="f_cancer" checked={field.value} onCheckedChange={field.onChange} />
                      <label htmlFor="f_cancer" className="text-sm font-medium">Cáncer</label>
                    </div>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="familyHistory.others"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Otros Antecedentes Familiares</FormLabel>
                    <FormControl><Textarea className="min-h-[140px]" {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Patología, Discapacidad y Ayudas Humanas */}
        <Card className="border border-slate-200 shadow-sm mt-6 overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-950 font-black uppercase tracking-wider">
              <Activity className="w-5 h-5 text-blue-800" />
              Patología, Discapacidad y Ayudas Humanas del Expediente
            </CardTitle>
            <CardDescription className="text-xs">
              Registre la patología de ingreso del paciente, su condición de discapacidad y la solicitud o necesidad de ayudas humanas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pathology */}
              <FormField
                control={form.control}
                name="pathology"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Patología Diagnosticada / de Ingreso</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Hipertensión Arterial Severa, Diabetes Tipo II, etc." {...field} />
                    </FormControl>
                    <FormDescription className="text-[11px] text-slate-400">
                      Escriba la patología principal identificada al momento del ingreso.
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* Dependency Level Classification */}
              <FormField
                control={form.control}
                name="dependency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Grado de Dependencia Funcional</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "INDEPENDIENTE"}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Clasifique dependencia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INDEPENDIENTE">INDEPENDIENTE (Se vale por sí mismo)</SelectItem>
                        <SelectItem value="DEPENDENCIA LEVE">DEPENDENCIA LEVE (Ayuda ocasional)</SelectItem>
                        <SelectItem value="DEPENDENCIA MODERADA">DEPENDENCIA MODERADA (Ayuda recurrente)</SelectItem>
                        <SelectItem value="DEPENDENCIA SEVERA / ENCAMADO">DEPENDENCIA SEVERA / ENCAMADO (Postrado / Dependencia total)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[11px] text-slate-400">
                      Indique si requiere asistencia o cuidados permanentes.
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* Disability hasDisability Checkbox & type */}
              <div className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-center">
                <FormField
                  control={form.control}
                  name="hasDisability"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="hasDisability" checked={field.value} onCheckedChange={field.onChange} />
                      <label htmlFor="hasDisability" className="text-sm font-bold text-slate-700">
                        ¿Presenta alguna Discapacidad?
                      </label>
                    </div>
                  )}
                />

                {form.watch("hasDisability") && (
                  <FormField
                    control={form.control}
                    name="disabilityType"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Tipo / Descripción de Discapacidad *
                        </FormLabel>
                        <FormControl>
                          <DisabilitySelect
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="Seleccione Clasificación de Discapacidad..."
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Technical Aids Help */}
            <div className="border border-blue-100 rounded-lg p-6 bg-blue-50/20 space-y-4">
              <div className="flex items-center justify-between col-span-2">
                <FormField
                  control={form.control}
                  name="requiresTechnicalAid"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="requiresTechnicalAid" checked={field.value} onCheckedChange={(val) => {
                        field.onChange(val);
                        // If checked, ensure quantity is at least 1
                        if (val) {
                          form.setValue("technicalAidQuantity", 1);
                          form.setValue("technicalAidType", "andadera");
                        } else {
                          form.setValue("technicalAidQuantity", 0);
                          form.setValue("technicalAidType", "ninguno");
                        }
                      }} />
                      <label htmlFor="requiresTechnicalAid" className="text-sm font-bold text-slate-800">
                        ¿Requiere de alguna Ayuda Humana (Andaderas, Sillas de ruedas, bastones, etc.)?
                      </label>
                    </div>
                  )}
                />
              </div>

              {form.watch("requiresTechnicalAid") && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <FormField
                    control={form.control}
                    name="technicalAidType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">Tipo de Ayuda Requerida</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "ninguno"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione ayuda humana" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ninguno">Ninguno</SelectItem>
                            <SelectItem value="andadera">Andadera</SelectItem>
                            <SelectItem value="silla_ruedas">Silla de Ruedas</SelectItem>
                            <SelectItem value="baston">Bastón</SelectItem>
                            <SelectItem value="muletas">Muletas</SelectItem>
                            <SelectItem value="cama_clinica">Cama Clínica</SelectItem>
                            <SelectItem value="panales_adulto">Pañales de Adulto</SelectItem>
                            <SelectItem value="otro">Otro (especificar en observaciones)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="technicalAidQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">Cantidad Solicitada</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="technicalAidNotes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">Observaciones de la Ayuda</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. silla de ruedas acolchada talla M" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 4. Condiciones de Habitabilidad de la Vivienda y Servicios Básicos */}
        <Card className="border border-slate-200 shadow-sm mt-6 overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-950 font-black uppercase tracking-wider">
              <Home className="w-5 h-5 text-blue-800" />
              4. Condiciones de Habitabilidad de la Vivienda y Servicios Básicos
            </CardTitle>
            <CardDescription className="text-xs">
              Especifique las condiciones físicas de la vivienda y el acceso a los servicios públicos esenciales del paciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Tipo Vivienda */}
              <FormField
                control={form.control}
                name="housingConditions.housingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Tipo de Vivienda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "casa"}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccione tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="casa">Casa</SelectItem>
                        <SelectItem value="apartamento">Apartamento</SelectItem>
                        <SelectItem value="rancho">Rancho</SelectItem>
                        <SelectItem value="quinta">Quinta</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Terreno Propio */}
              <FormField
                control={form.control}
                name="housingConditions.ownTerrain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">¿Terreno Propio?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "no"}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="si">SÍ tiene terreno propio</SelectItem>
                        <SelectItem value="no">NO tiene terreno propio</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Tenencia */}
              <FormField
                control={form.control}
                name="housingConditions.tenure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Tenencia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "propia"}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccione tenencia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="propia">Propia</SelectItem>
                        <SelectItem value="alquilada">Alquilada</SelectItem>
                        <SelectItem value="prestada_cuidador">Prestada / Cuidador</SelectItem>
                        <SelectItem value="arrimado">Arrimado</SelectItem>
                        <SelectItem value="alojado">Alojado</SelectItem>
                        <SelectItem value="opcion_compra">Opción de Compra</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Techo */}
              <FormField
                control={form.control}
                name="housingConditions.roof"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Material de Techo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "zinc"}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccione material" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="zinc">Zinc</SelectItem>
                        <SelectItem value="platabanda">Platabanda</SelectItem>
                        <SelectItem value="asbesto">Asbesto</SelectItem>
                        <SelectItem value="machihembrado">Machihembrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Paredes */}
              <FormField
                control={form.control}
                name="housingConditions.walls"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Material de Paredes</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "frisadas"}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccione material" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="frisadas">Frisadas</SelectItem>
                        <SelectItem value="sin_frisar">Sin Frisar</SelectItem>
                        <SelectItem value="madera_zinc">Madera / Zinc</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Piso */}
              <FormField
                control={form.control}
                name="housingConditions.floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Material del Piso</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "cemento"}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccione material" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ceramica">Cerámica</SelectItem>
                        <SelectItem value="cemento">Cemento</SelectItem>
                        <SelectItem value="tierra">Tierra</SelectItem>
                        <SelectItem value="otro">Otro (especificar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Otro Piso especificación (condicional) */}
              {form.watch("housingConditions.floor") === "otro" && (
                <FormField
                  control={form.control}
                  name="housingConditions.floorOther"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Especifique el Material del Piso</FormLabel>
                      <FormControl>
                        <Input placeholder="Escriba el tipo de piso..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

            </div>

            {/* Subtítulo: Servicios Básicos */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 font-sans">Acceso a Servicios Públicos y Básicos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Agua Blanca */}
                <FormField
                  control={form.control}
                  name="housingConditions.waterSupply"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-slate-500">Agua Blanca</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "acueducto"}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Seleccione abastecimiento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="acueducto">Acueducto</SelectItem>
                          <SelectItem value="camion_cisterna">Camión Cisterna</SelectItem>
                          <SelectItem value="pila_publica">Pila Pública</SelectItem>
                          <SelectItem value="rio">Río</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {/* Aguas Servidas */}
                <FormField
                  control={form.control}
                  name="housingConditions.sewage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-slate-500">Aguas Servidas</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "cloacas"}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Seleccione eliminación" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cloacas">Cloacas</SelectItem>
                          <SelectItem value="pozo_septico">Pozo Séptico</SelectItem>
                          <SelectItem value="al_aire_libre">Al Aire Libre</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {/* Electricidad */}
                <FormField
                  control={form.control}
                  name="housingConditions.electricity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-slate-500">Electricidad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "publico_con_medidor"}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Seleccione servicio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="publico_con_medidor">Público con Medidor</SelectItem>
                          <SelectItem value="publico_sin_medidor">Público sin Medidor</SelectItem>
                          <SelectItem value="no_posee">No Posee</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {/* Gas */}
                <FormField
                  control={form.control}
                  name="housingConditions.gas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-wider text-slate-500">Servicio de Gas</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "bombona"}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Seleccione servicio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bombona">Bombona</SelectItem>
                          <SelectItem value="tuberia">Tubería</SelectItem>
                          <SelectItem value="no_posee">No Posee</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel condicional del Examen Físico y Signos Vitales */}
        {form.watch("includePhysicalExam") && (
          <Card className="border border-emerald-250 shadow-md mt-6 overflow-hidden bg-emerald-50/5 animate-in fade-in duration-300">
            <CardHeader className="border-b border-emerald-100 bg-emerald-50/30 p-6">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2.5">
                <Stethoscope className="w-5 h-5 text-emerald-600 animate-pulse" />
                Carga de Examen Físico y Signos Vitales
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-semibold">
                Registre las mediciones clínicas actuales del ciudadano para anexar un informe de examen físico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Peso (Kg)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="Ej. 70.5" className="bg-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Talla (metros)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Ej. 1.75" className="bg-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">Clasificación IMC</span>
                  <div className="h-10 px-3 rounded-md border border-slate-200 bg-slate-50 font-extrabold text-xs text-blue-700 flex items-center justify-between">
                    <span>{imc} Kg/m²</span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-black">
                      {parseFloat(imc) < 18.5 ? 'Bajo Peso' : parseFloat(imc) < 25.0 ? 'Normal' : parseFloat(imc) < 30.0 ? 'Sobrepeso' : 'Obesidad'}
                    </span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="bloodPressure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tensión Arterial (PA)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 120/80" className="bg-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="heartRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Frecuencia Cardíaca (LPM)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej. 72" className="bg-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="oxygenSaturation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Saturación O2 (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej. 98" className="bg-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Temperatura (°C)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="Ej. 36.5" className="bg-white" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border border-dashed border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <FormField
                  control={form.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">Hallazgos y Diagnóstico Clínico del Examen</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Escriba el diagnóstico presuntivo o los hallazgos principales identificados en la jornada..." 
                          className="min-h-[80px] bg-white" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recommendations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">Recomendaciones y Tratamiento Médico</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Recomendaciones preventivas, remisión a especialistas, etc." 
                          className="min-h-[80px] bg-white" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="determination"
                  render={({ field }) => (
                    <FormItem className="max-w-md">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-600">Diagnóstico de Aptitud Clínica</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "fit"}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Determine aptitud" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fit">APTO (Condición física normal / sin limitaciones)</SelectItem>
                          <SelectItem value="fit-with-restrictions">APTO CON RESTRICCIONES (Aptitud condicionada)</SelectItem>
                          <SelectItem value="unfit">NO APTO (Requiere reposo absoluto o tratamiento intensivo)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button 
            type="submit" 
            className={`${
              form.watch("includePhysicalExam") 
                ? "bg-emerald-600 hover:bg-emerald-700" 
                : "bg-blue-900 hover:bg-blue-950"
            } text-white font-black uppercase text-[10px] tracking-widest px-12 h-11 transition-all shadow-md`}
          >
            {form.watch("includePhysicalExam") 
              ? "Guardar Antecedentes y Examen Físico" 
              : "Actualizar Ficha de Antecedentes"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}
