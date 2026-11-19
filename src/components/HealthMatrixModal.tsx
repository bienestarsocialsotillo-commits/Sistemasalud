import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Stethoscope, CheckCircle2, XCircle, Sparkles, Filter } from "lucide-react";
import { HEALTH_CENTERS, SERVICES_MATRIX, ServiceAvailability } from '@/data/healthNetworkMatrix';

interface HealthMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectService?: (serviceName: string) => void;
}

export default function HealthMatrixModal({ open, onOpenChange, onSelectService }: HealthMatrixModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCenterFilter, setSelectedCenterFilter] = useState<string>("all");

  const filteredServices = SERVICES_MATRIX.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCenterFilter !== "all") {
      const status = service.availability[selectedCenterFilter];
      return status === 'DISPONIBLE' || status === 'ESPECIALIZADO';
    }

    return true;
  });

  const getStatusBadge = (status: ServiceAvailability) => {
    if (status === 'DISPONIBLE') {
      return (
        <span className="inline-flex items-center justify-center gap-1 w-full py-1.5 px-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          DISPONIBLE
        </span>
      );
    }
    if (status === 'ESPECIALIZADO') {
      return (
        <span className="inline-flex items-center justify-center gap-1 w-full py-1.5 px-2 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black uppercase tracking-wider shadow-2xs">
          <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
          ESPECIALIZADO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center gap-1 w-full py-1.5 px-2 rounded-lg bg-rose-50/80 text-rose-700/80 border border-rose-200/60 text-[9px] font-bold uppercase tracking-wider">
        <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
        NO DISPONIBLE
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:w-[95vw] max-w-[96vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl h-[92dvh] max-h-[92dvh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-xl sm:rounded-2xl bg-white">
        <DialogHeader className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white p-4 sm:p-6 pr-14 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-blue-300" />
                <DialogTitle className="text-base sm:text-xl font-black uppercase tracking-wider text-white">
                  Reglas de Derivación y Disponibilidad de Servicios por Centro Público
                </DialogTitle>
              </div>
              <DialogDescription className="text-blue-200 text-xs font-medium">
                Matriz oficial de enrutamiento y servicios asistenciales en la red municipal y pública de salud
              </DialogDescription>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 bg-white/10 px-2.5 py-1 rounded-md">
                {HEALTH_CENTERS.length} Centros Asistenciales
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 bg-white/10 px-2.5 py-1 rounded-md">
                {SERVICES_MATRIX.length} Especialidades
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Filter bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="BUSCAR ESPECIALIDAD (EJ: RAYOS X, LABORATORIO)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-white text-xs font-bold border-slate-200 uppercase tracking-wider"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Filtrar Centro:
            </span>
            <button
              onClick={() => setSelectedCenterFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                selectedCenterFilter === 'all'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos los Centros
            </button>
            {HEALTH_CENTERS.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCenterFilter(c.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                  selectedCenterFilter === c.id
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {c.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/40">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
            <table className="w-full text-left border-collapse min-w-[1400px]">
              <thead>
                <tr className="bg-blue-950 text-white border-b border-blue-900">
                  <th className="p-3.5 text-xs font-black uppercase tracking-wider sticky left-0 bg-blue-950 z-20 w-72 shadow-md">
                    Servicio / Especialidad Médica
                  </th>
                  {HEALTH_CENTERS.map((center) => (
                    <th key={center.id} className="p-3 text-center text-xs font-black uppercase tracking-wider border-l border-blue-900/60 min-w-[130px] max-w-[160px]">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="leading-tight">{center.name}</span>
                        <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${
                          center.isConvenio 
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                            : center.id.startsWith('asic') 
                              ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30' 
                              : 'bg-white/10 text-blue-200'
                        }`}>
                          {center.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.map((service, idx) => (
                  <tr key={service.id} className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="p-3.5 sticky left-0 bg-inherit z-10 font-black text-xs text-slate-800 border-r border-slate-200 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span className="font-bold">{service.name}</span>
                        </div>
                        {onSelectService && (
                          <button
                            onClick={() => {
                              onSelectService(service.name);
                              onOpenChange(false);
                            }}
                            className="text-[9px] font-black text-blue-700 hover:text-white hover:bg-blue-700 cursor-pointer bg-blue-50 px-2 py-1 rounded-md border border-blue-200 transition-colors uppercase"
                            title="Seleccionar esta atención para la orden de derivación"
                          >
                            Usar ➔
                          </button>
                        )}
                      </div>
                    </td>
                    {HEALTH_CENTERS.map((center) => {
                      const status = service.availability[center.id] || 'NO DISPONIBLE';
                      return (
                        <td key={center.id} className="p-2 text-center border-l border-slate-100">
                          {getStatusBadge(status)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredServices.length === 0 && (
                  <tr>
                    <td colSpan={HEALTH_CENTERS.length + 1} className="p-12 text-center text-slate-400 font-bold uppercase text-xs">
                      No se encontraron especialidades médicas con ese criterio de búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info legend */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold uppercase text-[10px] text-slate-400">Leyenda:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
              <span className="text-[10px] uppercase font-bold text-slate-700">Disponible</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
              <span className="text-[10px] uppercase font-bold text-slate-700">Especializado (Previa Valoración)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300"></span>
              <span className="text-[10px] uppercase font-bold text-slate-700">No Disponible</span>
            </div>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs ml-auto"
          >
            Cerrar Matriz
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
