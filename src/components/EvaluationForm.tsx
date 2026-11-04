import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
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
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EVALUATION_TYPES, DETERMINATIONS } from '../constants';
import { toast } from "sonner";
import { Activity, ClipboardCheck, Scale } from "lucide-react";
import { dataService } from '../lib/dataService';

const evalSchema = z.object({
  workerId: z.string().min(1),
  type: z.enum(['pre-employment', 'entry', 'periodic', 'exit', 'special']),
  weight: z.coerce.number().min(0),
  height: z.coerce.number().min(0),
  bloodPressure: z.string().min(1),
  heartRate: z.coerce.number().min(0),
  oxygenSaturation: z.coerce.number().min(0),
  temperature: z.coerce.number().min(0),
  diagnosis: z.string().min(1),
  medicationsNeeded: z.string().optional(),
  medicationFrequency: z.string().optional(),
  recommendations: z.string().optional(),
  determination: z.enum(['fit', 'fit-with-restrictions', 'unfit']),
});

type EvaluationValues = z.infer<typeof evalSchema>;

export default function EvaluationForm({ workerId, workerName, onSuccess }: { workerId?: string, workerName?: string, onSuccess?: () => void }) {
  const form = useForm<EvaluationValues>({
    resolver: zodResolver(evalSchema),
    defaultValues: {
      workerId: workerId || "",
      type: "periodic",
      determination: "fit",
      bloodPressure: "120/80",
      weight: 0,
      height: 0,
      heartRate: 0,
      oxygenSaturation: 0,
      temperature: 0,
      diagnosis: "",
      medicationsNeeded: "",
      medicationFrequency: "",
      recommendations: "",
    },
  });

  const weightValue = form.watch("weight");
  const heightValue = form.watch("height");
  const weight = typeof weightValue === 'number' ? weightValue : 0;
  const height = typeof heightValue === 'number' ? heightValue : 0;
  const imc = height > 0 ? (weight / (height * height)).toFixed(2) : "0.00";

  const onSubmit: SubmitHandler<EvaluationValues> = async (values) => {
    try {
      const evaluationData = {
        type: values.type,
        physical: {
          weight: values.weight,
          height: values.height,
          bmi: parseFloat(imc),
          bloodPressure: values.bloodPressure,
          heartRate: values.heartRate,
          oxygenSaturation: values.oxygenSaturation,
          temperature: values.temperature,
        },
        labs: {
          results: "Pendiente", // Placeholder for now
        },
        diagnosis: values.diagnosis,
        medicationsNeeded: values.medicationsNeeded || "",
        medicationFrequency: values.medicationFrequency || "",
        recommendations: values.recommendations || "",
        determination: values.determination,
      };

      await dataService.addEvaluation(values.workerId, evaluationData);

      // Si se cargaron medicamentos, registrar automáticamente la solicitud o requerimiento en Farmacia
      if (values.medicationsNeeded && values.medicationsNeeded.trim()) {
        try {
          // Obtener comuna del ciudadano
          const workersList = await dataService.getWorkers();
          const targetWorker = workersList.find(w => w.id === values.workerId);
          const workerCommune = targetWorker?.commune || "Sotillo";

          // Admite múltiples medicamentos separados por comas, puntos o saltos de línea
          // Para no fragmentar demasiado se sube como solicitud con dosis e indicaciones
          await dataService.addMedicationRecipe({
            workerId: values.workerId,
            medication: values.medicationsNeeded.trim(),
            presentation: "Tratamiento / Operativo",
            dosage: "Según Evaluación Física",
            frequency: values.medicationFrequency || "Según Indicación",
            duration: "Operativo",
            quantity: 1,
            commune: workerCommune,
            requiresTechnicalAid: false,
            status: 'pending',
          });
        } catch (recipeErr) {
          console.error("Error auto-creating medication recipe from evaluation:", recipeErr);
        }
      }

      toast.success("Evaluación médica guardada y requerimiento de farmacia registrado");
      onSuccess?.();
    } catch (error) {
      console.error("Save Error:", error);
      toast.error("Error al guardar la evaluación");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-none shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Evaluación Física
              </CardTitle>
              <CardDescription>Signos vitales y medidas antropométricas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                 <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso (Kg)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="70.5" {...field} />
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
                      <FormLabel>Talla (m)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="1.75" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col space-y-2">
                  <Label className="mt-1">IMC</Label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-slate-50 font-bold text-blue-600 flex items-center">
                    {imc}
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="bloodPressure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tensión (PA)</FormLabel>
                      <FormControl>
                        <Input placeholder="120/80" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="heartRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frec. Cardíaca</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="72" {...field} />
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
                        <FormLabel>Saturación O2</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="98" {...field} />
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
                        <FormLabel>Temp (°C)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="36.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                Tipo de examen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de evaluación" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVALUATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="determination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Determinación Final</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Aptitud" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DETERMINATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Resultados y Plan de Tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hallazgos y Diagnóstico</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describa los resultados del examen físico..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="medicationsNeeded"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medicamentos Requeridos</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Escriba los fármacos necesarios..."
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medicationFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frecuencia de Uso</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ej: Cada 8 horas por 7 días..."
                        className="min-h-[80px]"
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
              name="recommendations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recomendaciones Médicas</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Medidas preventivas, reposo, remisiones..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-12">
            Finalizar Evaluación
          </Button>
        </div>
      </form>
    </Form>
  );
}
