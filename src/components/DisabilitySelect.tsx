import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DISABILITY_TYPES } from '@/constants';

interface DisabilitySelectProps {
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export default function DisabilitySelect({
  value = "",
  onChange,
  placeholder = "Seleccione Tipo de Discapacidad",
  className = ""
}: DisabilitySelectProps) {
  const standardValues = DISABILITY_TYPES.map(t => t.value);
  const isCustomInitially = !!value && !standardValues.includes(value);

  const [isCustomMode, setIsCustomMode] = useState(isCustomInitially || value === "OTRO");
  const [customText, setCustomText] = useState(isCustomInitially ? value : "");

  useEffect(() => {
    if (value && !standardValues.includes(value)) {
      setIsCustomMode(true);
      setCustomText(value);
    } else if (value === "OTRO") {
      setIsCustomMode(true);
    } else if (standardValues.includes(value)) {
      setIsCustomMode(false);
    }
  }, [value]);

  const handleSelectChange = (selectedVal: string) => {
    if (selectedVal === "OTRO") {
      setIsCustomMode(true);
      onChange(customText || "OTRO");
    } else {
      setIsCustomMode(false);
      onChange(selectedVal);
    }
  };

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setCustomText(text);
    onChange(text);
  };

  const selectedSelectValue = isCustomMode ? "OTRO" : (standardValues.includes(value) ? value : "");

  return (
    <div className={`space-y-2 ${className}`}>
      <Select value={selectedSelectValue} onValueChange={handleSelectChange}>
        <SelectTrigger className="h-10 sm:h-11 rounded-xl text-xs font-bold bg-white border-slate-300">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[380px] w-full min-w-[290px] sm:min-w-[440px] max-w-[94vw]">
          {DISABILITY_TYPES.map((dt) => (
            <SelectItem key={dt.value} value={dt.value} className="py-2.5 cursor-pointer">
              <div className="flex flex-col text-left py-0.5">
                <span className="font-bold text-xs uppercase text-slate-900 leading-tight">
                  {dt.label}
                </span>
                <span className="text-[10px] text-slate-500 font-normal leading-snug mt-1">
                  {dt.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCustomMode && (
        <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[9px] font-black uppercase tracking-wider text-blue-700 mb-1">
            Especifique diagnóstico o detalle particular:
          </p>
          <Input
            placeholder="Ej. Pérdida visual unilateral / Amputación / Síndrome específico..."
            className="h-10 text-xs rounded-xl font-bold uppercase border-blue-300 focus-visible:ring-blue-600 bg-blue-50/20"
            value={customText}
            onChange={handleCustomTextChange}
          />
        </div>
      )}
    </div>
  );
}
