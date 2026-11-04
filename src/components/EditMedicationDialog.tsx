import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Pencil, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Pill, 
  Accessibility, 
  Package, 
  Building2, 
  Loader2,
  History
} from "lucide-react";
import { MedicationRecipe, Worker } from "@/types";
import { dataService } from "@/lib/dataService";
import { 
  COMMON_MEDICATIONS_CATALOG, 
  STANDARDIZED_TECHNICAL_AIDS, 
  STANDARDIZED_MEDICAL_SUPPLIES,
  getSpellingSuggestion,
  cleanItemDisplayName
} from "@/constants";
import { toast } from "sonner";

interface EditMedicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: MedicationRecipe | null;
  workers: Worker[];
  isAdmin: boolean;
  onSaved: () => void;
}

export default function EditMedicationDialog({
  isOpen,
  onClose,
  recipe,
  workers,
  isAdmin,
  onSaved
}: EditMedicationDialogProps) {
  if (!isAdmin || !recipe) return null;

  const worker = workers.find(w => w.id === recipe.workerId);

  // Form states
  const [medicationName, setMedicationName] = useState("");
  const [category, setCategory] = useState<'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation'>('medication');
  const [presentation, setPresentation] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgencyReason, setUrgencyReason] = useState("");
  
  // Delivery details (if already delivered)
  const [deliveryOfficer, setDeliveryOfficer] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const [saving, setSaving] = useState(false);

  // Inicializar campos al abrir con los datos de la receta
  useEffect(() => {
    if (recipe) {
      setMedicationName(recipe.medication || "");
      setCategory(recipe.category || (recipe.requiresTechnicalAid ? 'technical_aid' : 'medication'));
      setPresentation(recipe.presentation || "Tabletas");
      setDosage(recipe.dosage || "");
      setFrequency(recipe.frequency || "");
      setDuration(recipe.duration || "");
      setQuantity(recipe.quantity || recipe.technicalAidQuantity || 1);
      setNotes(recipe.technicalAidNotes || recipe.deliveryNotes || "");
      setIsUrgent(!!recipe.isUrgent);
      setUrgencyReason(recipe.urgencyReason || "");
      setDeliveryOfficer(recipe.deliveryOfficer || recipe.deliveredBy || "");
      setDeliveryNotes(recipe.deliveryNotes || "");
    }
  }, [recipe]);

  // Detección automática de corrección ortográfica o fonética
  const spellingSuggestion = getSpellingSuggestion(medicationName);

  const handleApplySuggestion = (suggested: string) => {
    setMedicationName(suggested);
    // Si la sugerencia coincide con un fármaco del catálogo, autocompletar presentación
    const matchMed = COMMON_MEDICATIONS_CATALOG.find(m => m.name === suggested);
    if (matchMed) {
      setPresentation(matchMed.presentation);
      setCategory('medication');
    } else if (STANDARDIZED_TECHNICAL_AIDS.includes(suggested)) {
      setCategory('technical_aid');
      setPresentation("Unidad");
    } else if (STANDARDIZED_MEDICAL_SUPPLIES.includes(suggested)) {
      setCategory('medical_supply');
      setPresentation("Paquete / Unidad");
    }
    toast.success(`Corrección ortográfica aplicada: ${suggested}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Solo los administradores tienen permiso para modificar requerimientos.");
      return;
    }

    if (!medicationName.trim()) {
      toast.error("El nombre del fármaco o insumo es obligatorio.");
      return;
    }

    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a cero.");
      return;
    }

    setSaving(true);
    try {
      const finalName = cleanItemDisplayName(medicationName.trim());
      
      // Preservar el valor original si es la primera vez que se corrige
      const originalText = recipe.originalMedication || (recipe.medication !== finalName ? recipe.medication : undefined);

      const updates: Partial<MedicationRecipe> = {
        medication: finalName,
        category,
        presentation: presentation.trim() || "Unidad",
        dosage: dosage.trim() || "N/A",
        frequency: frequency.trim() || "N/A",
        duration: duration.trim() || "N/A",
        quantity: Number(quantity),
        technicalAidQuantity: Number(quantity),
        technicalAidNotes: notes.trim(),
        deliveryNotes: deliveryNotes.trim() || notes.trim(),
        isUrgent,
        urgencyReason: isUrgent ? urgencyReason.trim() : "",
        ...(originalText ? { originalMedication: originalText } : {})
      };

      if (recipe.status === 'delivered') {
        updates.deliveryOfficer = deliveryOfficer.trim();
      }

      await dataService.updateMedicationRecipe(recipe.id, updates);
      toast.success("Fármaco / Requerimiento actualizado con éxito.");
      onSaved();
      onClose();
    } catch (error) {
      console.error("Error al actualizar receta:", error);
      toast.error("No se pudo guardar la modificación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-2xl bg-white rounded-2xl p-6 sm:p-7 shadow-2xl border border-blue-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-inner">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Corregir y Editar Requerimiento
                <Badge className="bg-blue-600 text-white text-[9px] uppercase font-black px-2 py-0.5">
                  Solo Administrador
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                Modifique la información, ortografía o presentación asignada al beneficiario.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Ficha resumen del beneficiario */}
        <div className="my-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Beneficiario Titular:</span>
            <span className="font-black text-slate-900 uppercase">{worker?.fullName || "No asignado"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Cédula:</span>
            <span className="font-bold text-slate-700">{worker?.dni || "S/D"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Comuna / Sector:</span>
            <span className="font-bold text-slate-700 uppercase">{recipe.commune || worker?.commune || "S/D"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Estado:</span>
            <Badge className={recipe.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-black' : 'bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-black'}>
              {recipe.status === 'delivered' ? '✓ Entregado' : '⚡ Pendiente'}
            </Badge>
          </div>
        </div>

        {/* Trazabilidad Histórica (Si ya tenía un texto original diferente) */}
        {recipe.originalMedication && recipe.originalMedication !== recipe.medication && (
          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
            <History className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Texto original cargado por el operador:</strong> <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950">{recipe.originalMedication}</code> (Conservado como respaldo de auditoría).
            </span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 mt-2">
          {/* Categoría del Insumo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Categoría Operativa
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setCategory('medication')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-black transition-all ${
                  category === 'medication'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Pill className="w-3.5 h-3.5 text-blue-600" />
                Fármaco
              </button>
              <button
                type="button"
                onClick={() => setCategory('technical_aid')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-black transition-all ${
                  category === 'technical_aid'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Accessibility className="w-3.5 h-3.5 text-amber-600" />
                Ayuda Humana
              </button>
              <button
                type="button"
                onClick={() => setCategory('medical_supply')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-black transition-all ${
                  category === 'medical_supply'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                Insumo
              </button>
              <button
                type="button"
                onClick={() => setCategory('medical_derivation')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-black transition-all ${
                  category === 'medical_derivation'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Derivación
              </button>
            </div>
          </div>

          {/* Nombre del Fármaco / Insumo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Nombre del Insumo / Principio Activo *
              </Label>
              <span className="text-[10px] text-slate-400 font-medium">
                Escriba libremente o elija sugerencia
              </span>
            </div>
            
            <div className="relative">
              <Input
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                placeholder="Ej. Losartán Potásico 50mg o Preservativos"
                list="edit-catalog-options"
                className="font-bold text-slate-900 h-11 rounded-xl text-sm border-slate-300 focus:border-blue-500"
                required
              />
              <datalist id="edit-catalog-options">
                {category === 'medication' && COMMON_MEDICATIONS_CATALOG.map((m, idx) => (
                  <option key={idx} value={m.name} label={`${m.category} (${m.presentation})`} />
                ))}
                {category === 'technical_aid' && STANDARDIZED_TECHNICAL_AIDS.map((a, idx) => (
                  <option key={idx} value={a} />
                ))}
                {category === 'medical_supply' && STANDARDIZED_MEDICAL_SUPPLIES.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>

            {/* Banner inteligente de autocorrección ortográfica */}
            {spellingSuggestion && spellingSuggestion.toLowerCase() !== medicationName.trim().toLowerCase() && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 text-xs text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Corrección sugerida: <strong>{spellingSuggestion}</strong>
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleApplySuggestion(spellingSuggestion)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-wider h-7 px-2.5 rounded-lg shadow-2xs"
                >
                  Aplicar Corrección
                </Button>
              </div>
            )}
          </div>

          {/* Presentación y Cantidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Presentación / Empaque
              </Label>
              <Input
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                placeholder="Ej. Tabletas, Frasco Jarabe, Paquete, Caja, Unidad"
                className="font-bold text-slate-800 h-10 rounded-xl text-xs border-slate-300"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Cantidad Solicitada / Asignada *
              </Label>
              <Input
                type="number"
                min="1"
                max="999"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="font-black text-slate-900 h-10 rounded-xl text-sm border-slate-300"
                required
              />
            </div>
          </div>

          {/* Dosis, Frecuencia y Duración (Si es fármaco) */}
          {category === 'medication' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600">Dosis</Label>
                <Input
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="Ej. 1 tableta"
                  className="h-9 text-xs font-semibold rounded-lg bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600">Frecuencia</Label>
                <Input
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  placeholder="Ej. Cada 12 horas"
                  className="h-9 text-xs font-semibold rounded-lg bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-600">Duración</Label>
                <Input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Ej. 30 días"
                  className="h-9 text-xs font-semibold rounded-lg bg-white"
                />
              </div>
            </div>
          )}

          {/* Observaciones o Especificaciones */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Observaciones o Especificaciones Clínicas
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, talla en caso de pañales, tipo de andadera, etc."
              rows={2}
              className="text-xs font-medium rounded-xl border-slate-300 resize-none"
            />
          </div>

          {/* Si ya fue entregado: edición de datos de despacho */}
          {recipe.status === 'delivered' && (
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                Datos de Despacho (Registro Oficial de Entrega)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-600">Funcionario que Entregó</Label>
                  <Input
                    value={deliveryOfficer}
                    onChange={(e) => setDeliveryOfficer(e.target.value)}
                    placeholder="Nombre del despachador"
                    className="h-9 text-xs font-bold bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-600">Nota de Entrega</Label>
                  <Input
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Observaciones de entrega"
                    className="h-9 text-xs font-medium bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto rounded-xl font-bold text-xs uppercase tracking-wider h-10 border-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider h-10 gap-2 shadow-md shadow-blue-500/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando Cambios...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Guardar Modificación
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
