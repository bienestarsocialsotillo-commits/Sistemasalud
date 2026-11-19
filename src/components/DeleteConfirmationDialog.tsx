import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  itemDetails?: { label: string; value: string }[];
  isDeleting?: boolean;
}

export default function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemDetails = [],
  isDeleting = false
}: DeleteConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isDeleting) onClose(); }}>
      <DialogContent className="w-[94vw] sm:w-full max-w-[94vw] sm:max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-200">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-inner mx-auto sm:mx-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <DialogTitle className="text-lg font-black text-slate-900 leading-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {itemDetails.length > 0 && (
          <div className="my-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
            {itemDetails.map((detail, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  {detail.label}:
                </span>
                <span className="text-slate-900 font-bold uppercase truncate max-w-[220px]">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 bg-red-50/80 border border-red-200/60 rounded-xl text-[11px] text-red-700 font-semibold flex items-center gap-2">
          <Trash2 className="w-4 h-4 shrink-0 text-red-600" />
          <span>Esta acción es irreversible y eliminará el registro permanentemente de la base de datos de salud.</span>
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto rounded-xl font-bold text-xs uppercase tracking-wider h-10 border-slate-300 hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full sm:w-auto rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider h-10 gap-2 shadow-md shadow-red-500/20"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Eliminar Registro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
