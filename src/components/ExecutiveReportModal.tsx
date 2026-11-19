import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, FileText, CheckCircle2, AlertTriangle, Users, Pill, MapPin, X } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Worker, MedicationRecipe } from '@/types';
import { COMMUNES } from '@/constants';
import { 
  isForeignerCommune, 
  getRecipeDeliveredAidUnits, 
  exportAllCommunesSectionedPdf,
  exportAllCommunesExcel
} from '@/utils/territoryPdf';
import { getRecipeCategory } from '@/utils/categoryUtils';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeFilterLabel: string;
  communeFilterLabel: string;
  metrics: {
    totalWorkers: number;
    totalRequests: number;
    deliveredRequests: number;
    pendingRequests: number;
    complianceRate: number;
    techAidsTotal: number;
    techAidsDelivered: number;
    techAidsPending: number;
    medicationsTotal: number;
    medicationsDelivered: number;
    medicationsPending: number;
    vulnerableCount: number;
    disabilityCount: number;
    activeCommunesCount: number;
  };
  communeRanking: Array<{ name: string; total: number }>;
  pendingList: Array<{
    id: string;
    citizenName: string;
    citizenDni: string;
    commune: string;
    sector: string;
    item: string;
    quantity: number;
    categoryLabel: string;
    daysWaiting: number;
    isUrgent?: boolean;
  }>;
  workers?: Worker[];
  recipes?: MedicationRecipe[];
}

export default function ExecutiveReportModal({
  isOpen,
  onClose,
  timeFilterLabel,
  communeFilterLabel,
  metrics,
  communeRanking,
  pendingList,
  workers = [],
  recipes = []
}: ExecutiveReportModalProps) {
  const currentDateFormatted = format(new Date(), "dd 'de' MMMM 'de' yyyy, hh:mm a", { locale: es });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadOficioPdf = () => {
    if (workers.length > 0) {
      exportAllCommunesSectionedPdf(workers, recipes);
    }
  };

  const handleDownloadExcel = () => {
    if (workers.length > 0) {
      exportAllCommunesExcel(workers, recipes, pendingList);
    }
  };

  const officialSet = useMemo(() => new Set(COMMUNES.map(c => c.trim().toUpperCase())), []);
  const workersMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);

  // Matrix calculation for the 21 communes and foreign cases
  // Harmonized 100% with Dashboard de Gestión:
  // - "Ayudas Entregadas" exclusively counts completed deliveries (r.status === 'delivered')
  // - Category breakdown maps 1:1 to the 4 categories
  // - Pending requests (r.status !== 'delivered') are tracked separately for Section 3
  const {
    sotilloMatrix,
    foreignSummary,
    grandTotalPeople,
    grandTotalAids,
    grandTotalMeds,
    grandTotalTechAids,
    grandTotalSupplies,
    grandTotalDerivations,
    totalDeliveredDispatches,
    pendingStats,
    grandTotalPending,
    activeSotilloCount
  } = useMemo(() => {
    // 1. Group workers into 21 Sotillo Communes vs Foreigners
    const communeWorkersMap = new Map<string, Worker[]>();
    COMMUNES.forEach(c => communeWorkersMap.set(c.trim().toUpperCase(), []));
    const foreignWorkersList: Worker[] = [];

    workers.forEach(w => {
      const isForeign = isForeignerCommune(w.commune) || !!w.isForeigner;
      if (isForeign) {
        foreignWorkersList.push(w);
      } else {
        const norm = (w.commune || "").trim().toUpperCase();
        if (norm && officialSet.has(norm)) {
          communeWorkersMap.get(norm)?.push(w);
        } else {
          foreignWorkersList.push(w);
        }
      }
    });

    // 2. Group DELIVERED recipes into communes and categories using standardized unit calculations
    const communeDeliveredMap = new Map<string, {
      total: number;
      meds: number;
      tech: number;
      supplies: number;
      derivations: number;
      dispatches: number;
    }>();
    COMMUNES.forEach(c => communeDeliveredMap.set(c.trim().toUpperCase(), {
      total: 0,
      meds: 0,
      tech: 0,
      supplies: 0,
      derivations: 0,
      dispatches: 0,
    }));

    const foreignDelivered = {
      total: 0,
      meds: 0,
      tech: 0,
      supplies: 0,
      derivations: 0,
      dispatches: 0,
    };

    const pendingStats = {
      total: 0,
      meds: 0,
      tech: 0,
      supplies: 0,
      derivations: 0,
    };

    let totalDeliveredDispatches = 0;

    recipes.forEach(r => {
      const isDelivered = r.status === 'delivered';
      const cat = getRecipeCategory(r);

      if (!isDelivered) {
        pendingStats.total++;
        if (cat === 'medication') pendingStats.meds++;
        else if (cat === 'technical_aid') pendingStats.tech++;
        else if (cat === 'medical_supply') pendingStats.supplies++;
        else if (cat === 'medical_derivation') pendingStats.derivations++;
        return; // Only delivered aids are counted in the deliveries balance!
      }

      totalDeliveredDispatches++;
      const { medsUnits, technicalAidUnits, medicalSupplyUnits, derivationUnits, totalUnits } = getRecipeDeliveredAidUnits(r);

      // Determine commune: check recipe commune, then worker commune
      let isForeign = isForeignerCommune(r.commune) || !!r.isForeigner;
      let targetCommune = (r.commune || "").trim().toUpperCase();

      if (!isForeign && !officialSet.has(targetCommune) && r.workerId) {
        const w = workersMap.get(r.workerId);
        if (w) {
          if (isForeignerCommune(w.commune) || !!w.isForeigner) {
            isForeign = true;
          } else {
            const wCom = (w.commune || "").trim().toUpperCase();
            if (officialSet.has(wCom)) {
              targetCommune = wCom;
            }
          }
        }
      }

      if (isForeign || !officialSet.has(targetCommune)) {
        foreignDelivered.total += totalUnits;
        foreignDelivered.meds += medsUnits;
        foreignDelivered.tech += technicalAidUnits;
        foreignDelivered.supplies += medicalSupplyUnits;
        foreignDelivered.derivations += derivationUnits;
        foreignDelivered.dispatches += 1;
      } else {
        const stats = communeDeliveredMap.get(targetCommune);
        if (stats) {
          stats.total += totalUnits;
          stats.meds += medsUnits;
          stats.tech += technicalAidUnits;
          stats.supplies += medicalSupplyUnits;
          stats.derivations += derivationUnits;
          stats.dispatches += 1;
        }
      }
    });

    const totalSotilloPeople = workers.length - foreignWorkersList.length;
    let activeCommunes = 0;
    let sumSotilloDeliveredTotal = 0;
    let sumSotilloMeds = 0;
    let sumSotilloTech = 0;
    let sumSotilloSupplies = 0;
    let sumSotilloDerivations = 0;
    let sumSotilloDispatches = 0;

    const sotilloMatrix = COMMUNES.map((communeName, idx) => {
      const norm = communeName.trim().toUpperCase();
      const cWorkers = communeWorkersMap.get(norm) || [];
      const countPeople = cWorkers.length;
      const cDelivered = communeDeliveredMap.get(norm) || { total: 0, meds: 0, tech: 0, supplies: 0, derivations: 0, dispatches: 0 };

      if (countPeople > 0 || cDelivered.total > 0) {
        activeCommunes++;
      }

      sumSotilloDeliveredTotal += cDelivered.total;
      sumSotilloMeds += cDelivered.meds;
      sumSotilloTech += cDelivered.tech;
      sumSotilloSupplies += cDelivered.supplies;
      sumSotilloDerivations += cDelivered.derivations;
      sumSotilloDispatches += cDelivered.dispatches;

      const percent = totalSotilloPeople > 0 ? ((countPeople / totalSotilloPeople) * 100).toFixed(1) : "0.0";

      return {
        num: idx + 1,
        name: communeName,
        people: countPeople,
        percent,
        totalAids: cDelivered.total,
        meds: cDelivered.meds,
        techAids: cDelivered.tech,
        supplies: cDelivered.supplies,
        derivations: cDelivered.derivations,
        dispatches: cDelivered.dispatches,
      };
    });

    const grandTotalPeople = workers.length;
    const grandTotalAids = sumSotilloDeliveredTotal + foreignDelivered.total;
    const grandTotalMeds = sumSotilloMeds + foreignDelivered.meds;
    const grandTotalTechAids = sumSotilloTech + foreignDelivered.tech;
    const grandTotalSupplies = sumSotilloSupplies + foreignDelivered.supplies;
    const grandTotalDerivations = sumSotilloDerivations + foreignDelivered.derivations;

    return {
      sotilloMatrix,
      foreignSummary: {
        people: foreignWorkersList.length,
        totalAids: foreignDelivered.total,
        meds: foreignDelivered.meds,
        techAids: foreignDelivered.tech,
        supplies: foreignDelivered.supplies,
        derivations: foreignDelivered.derivations,
        dispatches: foreignDelivered.dispatches,
      },
      grandTotalPeople,
      grandTotalAids,
      grandTotalMeds,
      grandTotalTechAids,
      grandTotalSupplies,
      grandTotalDerivations,
      totalDeliveredDispatches,
      pendingStats,
      grandTotalPending: pendingStats.total,
      activeSotilloCount: activeCommunes,
    };
  }, [workers, recipes, officialSet, workersMap]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-[96vw] sm:w-[95vw] max-w-[96vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] h-[94dvh] sm:h-[92dvh] max-h-[94dvh] p-0 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-2xl print:border-none print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none print:h-auto print:max-h-none print:rounded-none"
      >
        
        {/* Print Styles for OFICIO (Legal Landscape) and verified margins */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: legal landscape;
                margin: 12mm 15mm 12mm 15mm;
              }
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `
        }} />

        {/* Top Sticky Header Bar (Optimized for Mobile & Desktop) - Hidden in Print */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-3.5 pr-14 sm:pr-14 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800 print:hidden z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-300 flex items-center justify-center shrink-0 border border-blue-500/40">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide truncate">
                Informe Ejecutivo de Gestión Territorial (Página Oficio)
              </h2>
              <p className="text-[9px] sm:text-[10px] text-blue-200 font-semibold uppercase tracking-wider truncate">
                Márgenes de 15mm • Clasificación por Comuna y Balance General
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleDownloadOficioPdf}
              disabled={workers.length === 0}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] sm:text-xs uppercase px-3 sm:px-4 h-8 sm:h-9 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
              title="Descargar PDF oficial configurado en formato Página Oficio"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar</span> PDF Oficio
            </Button>
            <Button
              onClick={handleDownloadExcel}
              disabled={workers.length === 0}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] sm:text-xs uppercase px-3 sm:px-4 h-8 sm:h-9 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
              title="Descargar archivo Excel con exactamente el mismo formato y datos del Informe Ejecutivo Oficio"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar</span> Excel
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 font-bold text-[10px] sm:text-xs uppercase px-2.5 sm:px-3 h-8 sm:h-9 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Imprimir directamente en hoja oficio"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden md:inline">Imprimir</span>
            </Button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Container (Responsive padding: p-4 on mobile, p-8 on desktop) */}
        <div id="executive-report-printable" className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 text-slate-800 bg-white">

          {/* Institutional Header */}
          <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900">
            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500">
              República Bolivariana de Venezuela • Estado Anzoátegui
            </p>
            <h1 className="text-base sm:text-lg md:text-xl font-black uppercase text-blue-950 tracking-tight leading-tight">
              Alcaldía del Municipio Bolivariano Juan Antonio Sotillo
            </h1>
            <h2 className="text-xs sm:text-sm font-bold uppercase text-slate-700">
              Dirección de Bienestar Social • Gestión Alcalde Prof. Jesús Marcano Tábata
            </h2>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-600 font-semibold">
              <span className="bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                Formato: <strong>PÁGINA OFICIO (LEGAL)</strong>
              </span>
              <span className="bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                Ámbito Territorial: <strong>21 Comunas + Foráneos</strong>
              </span>
              <span className="bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                Emitido: <strong>{currentDateFormatted}</strong>
              </span>
            </div>
          </div>

          {/* 1. Macro Totales Arriba (Consolidado Ejecutivo) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3 bg-slate-100 p-2.5 rounded-lg border-l-4 border-blue-900">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                1. Balance Consolidado General (Totales de la Aplicación Web)
              </h3>
              <span className="text-[10px] font-bold text-blue-800 uppercase font-mono">
                Cobertura: {activeSotilloCount} de 21 Comunas Activas
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {/* Card 1: Personas Cargadas */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/80 shadow-2xs">
                <p className="text-[9.5px] font-black uppercase text-slate-500 tracking-wider truncate">Personas Cargadas</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{grandTotalPeople}</span>
                  <span className="text-[10px] font-bold text-slate-500">Censados</span>
                </div>
                <p className="text-[9px] text-slate-500 font-medium mt-1 truncate">
                  Sotillo: {workers.length - foreignSummary.people} | For.: {foreignSummary.people}
                </p>
              </div>

              {/* Card 2: Ayudas Entregadas Totales */}
              <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/50 shadow-2xs">
                <p className="text-[9.5px] font-black uppercase text-indigo-900 tracking-wider truncate">Ayudas Totales</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-indigo-950 leading-none">{grandTotalAids.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-indigo-700">Unidades</span>
                </div>
                <p className="text-[9px] text-indigo-700 font-bold mt-1 truncate">
                  En {totalDeliveredDispatches.toLocaleString()} Despachos Realizados
                </p>
              </div>

              {/* Card 3: Fármaco - Medicamento */}
              <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50 shadow-2xs">
                <p className="text-[9.5px] font-black uppercase text-emerald-900 tracking-wider truncate">Fármaco - Medicamento</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-emerald-900 leading-none">{grandTotalMeds}</span>
                  <span className="text-[10px] font-bold text-emerald-700">Unid.</span>
                </div>
                <p className="text-[9px] text-emerald-700 font-medium mt-1 truncate">
                  Tratamientos médicos
                </p>
              </div>

              {/* Card 4: Ayuda Humana */}
              <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/50 shadow-2xs">
                <p className="text-[9.5px] font-black uppercase text-purple-900 tracking-wider truncate">Ayuda Humana</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-purple-950 leading-none">{grandTotalTechAids}</span>
                  <span className="text-[10px] font-bold text-purple-700">Unid.</span>
                </div>
                <p className="text-[9px] text-purple-700 font-medium mt-1 truncate">
                  Sillas, andaderas, bastón
                </p>
              </div>

              {/* Card 5: Insumo Médico - Social */}
              <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/50 shadow-2xs">
                <p className="text-[9.5px] font-black uppercase text-amber-900 tracking-wider truncate">Insumo Médico - Social</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-amber-950 leading-none">{grandTotalSupplies}</span>
                  <span className="text-[10px] font-bold text-amber-700">Unid.</span>
                </div>
                <p className="text-[9px] text-amber-700 font-medium mt-1 truncate">
                  Pañales, canastillas, alimentos
                </p>
              </div>

              {/* Card 6: Atención / Derivación Clínica */}
              <div className="border border-cyan-200 rounded-xl p-3 bg-cyan-50/50 shadow-2xs">
                <p className="text-[9.5px] font-black uppercase text-cyan-900 tracking-wider truncate">Derivación Clínica</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-cyan-950 leading-none">{grandTotalDerivations}</span>
                  <span className="text-[10px] font-bold text-cyan-700">Serv.</span>
                </div>
                <p className="text-[9px] text-cyan-700 font-medium mt-1 truncate">
                  Ecos, laboratorios, consultas
                </p>
              </div>
            </div>
          </div>

          {/* 2. Matriz Territorial de las 21 Comunas + Foráneos (Desglose Abajo) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3 bg-slate-100 p-2.5 rounded-lg border-l-4 border-blue-900">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                2. Matriz Ejecutiva Territorial: 21 Comunas de Sotillo y Atención Foránea
              </h3>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Personas Cargadas vs. Desglose de Ayudas por Categoría
              </span>
            </div>

            {/* Responsive Table Scroll Container: overflow-x-auto enables smooth swipe on mobile */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full min-w-[850px] md:min-w-full text-xs text-left">
                <thead className="bg-blue-900 text-white font-bold border-b border-blue-950 uppercase text-[9.5px] sm:text-[10px]">
                  <tr>
                    <th className="py-2.5 px-2.5 text-center w-10">N°</th>
                    <th className="py-2.5 px-3">Comuna / Territorio</th>
                    <th className="py-2.5 px-2.5 text-center">Personas Cargadas</th>
                    <th className="py-2.5 px-2 text-center">% Padrón</th>
                    <th className="py-2.5 px-3 text-center bg-blue-950 text-yellow-300 font-black">Ayudas Entregadas Totales</th>
                    <th className="py-2.5 px-2.5 text-center">Fármaco - Medicamento</th>
                    <th className="py-2.5 px-2.5 text-center">Ayuda Humana</th>
                    <th className="py-2.5 px-2.5 text-center">Insumo Médico - Social</th>
                    <th className="py-2.5 px-2.5 text-center">Atención / Derivación Clínica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10.5px] sm:text-[11px]">
                  {sotilloMatrix.map((row) => (
                    <tr key={row.num} className={row.people > 0 ? "bg-white hover:bg-slate-50 transition-colors" : "bg-slate-50/60 opacity-60"}>
                      <td className="py-2 px-2.5 text-center font-bold text-slate-400">{row.num}</td>
                      <td className="py-2 px-3 font-bold text-slate-900 uppercase">{row.name}</td>
                      <td className="py-2 px-2.5 text-center font-bold text-blue-950">{row.people}</td>
                      <td className="py-2 px-2 text-center text-slate-500">{row.percent}%</td>
                      <td className="py-2 px-3 text-center font-black text-indigo-900 bg-indigo-50/50">
                        {row.totalAids}
                      </td>
                      <td className="py-2 px-2.5 text-center text-emerald-700 font-semibold">{row.meds}</td>
                      <td className="py-2 px-2.5 text-center text-purple-700 font-semibold">{row.techAids}</td>
                      <td className="py-2 px-2.5 text-center text-amber-700 font-semibold">{row.supplies}</td>
                      <td className="py-2 px-2.5 text-center text-cyan-700 font-semibold">{row.derivations}</td>
                    </tr>
                  ))}

                  {/* Fila de Casos Foráneos */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <td className="py-2.5 px-2.5 text-center text-slate-600 font-mono">EXT</td>
                    <td className="py-2.5 px-3 uppercase text-slate-900 font-black">
                      Casos Foráneos (Solidaridad Extramunicipal)
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-black text-blue-950">{foreignSummary.people}</td>
                    <td className="py-2.5 px-2 text-center text-slate-500">
                      {grandTotalPeople > 0 ? ((foreignSummary.people / grandTotalPeople) * 100).toFixed(1) : "0"}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-indigo-950 bg-indigo-100/60">
                      {foreignSummary.totalAids}
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-emerald-800 font-bold">{foreignSummary.meds}</td>
                    <td className="py-2.5 px-2.5 text-center text-purple-800 font-bold">{foreignSummary.techAids}</td>
                    <td className="py-2.5 px-2.5 text-center text-amber-800 font-bold">{foreignSummary.supplies}</td>
                    <td className="py-2.5 px-2.5 text-center text-cyan-800 font-bold">{foreignSummary.derivations}</td>
                  </tr>

                  {/* Fila de Gran Total Consolidado */}
                  <tr className="bg-blue-950 text-white font-black text-xs border-t-2 border-blue-900">
                    <td className="py-3 px-2.5 text-center text-yellow-300 font-mono">Σ</td>
                    <td className="py-3 px-3 uppercase text-yellow-300 tracking-wider">
                      GRAN TOTAL CONSOLIDADO (SOTILLO + FORÁNEOS)
                    </td>
                    <td className="py-3 px-2.5 text-center text-white">{grandTotalPeople}</td>
                    <td className="py-3 px-2 text-center text-slate-300">100.0%</td>
                    <td className="py-3 px-3 text-center text-yellow-300 text-sm bg-blue-900">
                      {grandTotalAids}
                    </td>
                    <td className="py-3 px-2.5 text-center text-emerald-300">{grandTotalMeds}</td>
                    <td className="py-3 px-2.5 text-center text-purple-300">{grandTotalTechAids}</td>
                    <td className="py-3 px-2.5 text-center text-amber-300">{grandTotalSupplies}</td>
                    <td className="py-3 px-2.5 text-center text-cyan-300">{grandTotalDerivations}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Resumen Numérico de Requerimientos en Espera (Exclusivamente Estadístico por Comunas y Categorías) */}
          {grandTotalPending > 0 && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3 bg-slate-100 p-2.5 rounded-lg border-l-4 border-amber-500">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  3. Balance Numérico de Requerimientos en Espera (Sin Registros Nominales)
                </h3>
                <span className="text-[10px] font-bold text-amber-800 uppercase font-mono">
                  {grandTotalPending} Solicitudes Totales en Espera
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50 text-center shadow-2xs">
                  <p className="text-[9.5px] font-bold text-emerald-800 uppercase">Fármacos en Espera</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">{pendingStats.meds}</p>
                  <p className="text-[9px] text-emerald-700 font-medium">solicitudes pendientes</p>
                </div>
                <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/50 text-center shadow-2xs">
                  <p className="text-[9.5px] font-bold text-purple-800 uppercase">Ayudas Humanas</p>
                  <p className="text-xl sm:text-2xl font-black text-purple-950 mt-1">{pendingStats.tech}</p>
                  <p className="text-[9px] text-purple-700 font-medium">equipos de movilidad</p>
                </div>
                <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/50 text-center shadow-2xs">
                  <p className="text-[9.5px] font-bold text-amber-800 uppercase">Insumos Médicos</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-950 mt-1">{pendingStats.supplies}</p>
                  <p className="text-[9px] text-amber-700 font-medium">pañales y descartables</p>
                </div>
                <div className="border border-cyan-200 rounded-xl p-3 bg-cyan-50/50 text-center shadow-2xs">
                  <p className="text-[9.5px] font-bold text-cyan-800 uppercase">Derivaciones Clínicas</p>
                  <p className="text-xl sm:text-2xl font-black text-cyan-950 mt-1">{pendingStats.derivations}</p>
                  <p className="text-[9px] text-cyan-700 font-medium">consultas y exámenes</p>
                </div>
              </div>
            </div>
          )}



        </div>
      </DialogContent>
    </Dialog>
  );
}
