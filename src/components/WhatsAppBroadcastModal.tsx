import React from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import WhatsAppBroadcast from './WhatsAppBroadcast';
import { Worker, MedicationRecipe } from '@/types';

interface WhatsAppBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers?: Worker[];
  recipes?: MedicationRecipe[];
  initialItemFilter?: string;
}

export default function WhatsAppBroadcastModal({
  isOpen,
  onClose,
  workers,
  recipes,
  initialItemFilter = ""
}: WhatsAppBroadcastModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] xl:max-w-[1360px] w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border-slate-200 shadow-2xl bg-slate-100">
        <WhatsAppBroadcast
          workers={workers}
          recipes={recipes}
          initialItemFilter={initialItemFilter}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
