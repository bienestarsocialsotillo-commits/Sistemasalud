import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Pill,
  Accessibility,
  Package,
  Stethoscope,
  Search,
  FileSpreadsheet,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  ExternalLink,
  Users,
  DollarSign,
  ShoppingBag,
  FileText,
  Paperclip
} from "lucide-react";
import { Worker, MedicationRecipe } from '@/types';
import WorkerExpediente from './WorkerExpediente';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { formatDateSafe } from '@/utils/dateUtils';
import { PharmacyCategoryType, getRecipeCategory } from '@/utils/categoryUtils';

export type { PharmacyCategoryType };
export { getRecipeCategory };

interface CategoryPatientsModalProps {
  category: PharmacyCategoryType | null;
  isOpen: boolean;
  onClose: () => void;
  recipes: MedicationRecipe[];
  workers: Worker[];
}

export default function CategoryPatientsModal({
  category,
  isOpen,
  onClose,
  recipes,
  workers
}: CategoryPatientsModalProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'pending'>('all');
  const [socialAidFilter, setSocialAidFilter] = useState<'all' | 'supply' | 'economic_aid' | 'food_bag'>('all');
  const [selectedWorkerForExpediente, setSelectedWorkerForExpediente] = useState<Worker | null>(null);

  // Workers map for instant lookup by workerId or dni
  const workersMap = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach(w => {
      if (w.id) map.set(w.id, w);
      if (w.dni) map.set(w.dni.trim(), w);
    });
    return map;
  }, [workers]);

  // Information config based on category
  const categoryConfig = useMemo(() => {
    switch (category) {
      case 'medication':
        return {
          title: "Fármacos y Tratamientos Médicos",
          description: "Desglose de beneficiarios con solicitudes y despachos de medicamentos orales, inyectables y tratamientos continuos.",
          icon: Pill,
          colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
          itemColumnName: "Medicamento(s) / Principio Activo",
          badgeColor: "bg-emerald-600"
        };
      case 'technical_aid':
        return {
          title: "Ayudas Humanas y Movilidad",
          description: "Desglose de beneficiarios con asignación de sillas de ruedas, andaderas, bastones, muletas y soportes ortopédicos.",
          icon: Accessibility,
          colorClass: "text-cyan-700 bg-cyan-50 border-cyan-200",
          itemColumnName: "Equipo / Ayuda Humana",
          badgeColor: "bg-cyan-600"
        };
      case 'medical_supply':
        return {
          title: "Insumos Médicos y Ayuda Social",
          description: "Desglose de beneficiarios con entrega de insumos descartables, aportes económicos en divisas ($ USD) o bolívares (Bs. al cambio), y donativos de bolsas de comida.",
          icon: Package,
          colorClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
          itemColumnName: "Insumo / Aporte / Donativo",
          badgeColor: "bg-indigo-600"
        };
      case 'medical_derivation':
        return {
          title: "Derivaciones Médicas Hospitalarias",
          description: "Desglose de pacientes remitidos a centros asistenciales y consultas médicas especializadas.",
          icon: Stethoscope,
          colorClass: "text-blue-700 bg-blue-50 border-blue-200",
          itemColumnName: "Servicio / Centro Hospitalario",
          badgeColor: "bg-blue-600"
        };
      default:
        return {
          title: "Desglose de Farmacia",
          description: "Listado de pacientes y requerimientos",
          icon: Pill,
          colorClass: "text-slate-700 bg-slate-50 border-slate-200",
          itemColumnName: "Requerimiento",
          badgeColor: "bg-slate-600"
        };
    }
  }, [category]);

  // Filter recipes strictly matching this category
  const categoryRecipes = useMemo(() => {
    if (!category) return [];
    return recipes.filter(r => getRecipeCategory(r) === category);
  }, [recipes, category]);

  // Counts for Delivered vs Pending and specialized social aid counters
  const stats = useMemo(() => {
    let delivered = 0;
    let pending = 0;
    let economicUSD = 0;
    let economicVES = 0;
    let economicCount = 0;
    let foodBags = 0;
    let foodBagsOrders = 0;
    let suppliesUnits = 0;

    categoryRecipes.forEach(r => {
      if (r.status === 'delivered') delivered++;
      else pending++;

      const isEcon = r.socialAidType === 'economic_aid' || (r.economicAmount !== undefined && Number(r.economicAmount) > 0);
      const isFood = r.socialAidType === 'food_bag' || (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0);

      if (isEcon) {
        economicCount++;
        const amt = Number(r.economicAmount) || 0;
        if (r.economicCurrency === 'VES') {
          economicVES += amt;
        } else {
          economicUSD += amt;
        }
      } else if (isFood) {
        foodBagsOrders++;
        foodBags += Number(r.foodBagsCount || r.quantity) || 1;
      } else {
        if (r.medicalSupplies && r.medicalSupplies.length > 0) {
          suppliesUnits += r.medicalSupplies.reduce((acc, s) => acc + (Number(s.quantity) || 1), 0);
        } else {
          suppliesUnits += Number(r.quantity) || 1;
        }
      }
    });

    return {
      total: categoryRecipes.length,
      delivered,
      pending,
      economicUSD,
      economicVES,
      economicCount,
      foodBags,
      foodBagsOrders,
      suppliesUnits
    };
  }, [categoryRecipes]);

  // Extract display item text, badge, and quantity for a recipe
  const getItemDetails = (r: MedicationRecipe) => {
    if (r.category === 'technical_aid') {
      const type = r.technicalAidType?.toLowerCase() === 'otro' 
        ? (r.customTechnicalAid || 'Ayuda Humana Personalizada')
        : (r.technicalAidType || 'Ayuda Humana');
      return {
        name: type,
        details: r.technicalAidSpecs || '',
        quantity: r.quantity || 1,
        aidBadge: null
      };
    }

    if (
      r.category === 'medical_supply' ||
      (r.medicalSupplies && r.medicalSupplies.length > 0) ||
      (r.supplyName && r.supplyName.trim().length > 0) ||
      r.socialAidType ||
      r.economicAmount !== undefined ||
      r.foodBagsCount !== undefined
    ) {
      // 1. Aporte Económico
      if (r.socialAidType === 'economic_aid' || (r.economicAmount !== undefined && Number(r.economicAmount) > 0)) {
        const cur = r.economicCurrency === 'VES' ? 'Bs.' : '$';
        const numAmt = Number(r.economicAmount) || 0;
        const formattedAmount = `${cur} ${numAmt.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
        return {
          name: `Aporte Económico: ${r.economicConcept || r.medication?.replace(/^Aporte:\s*/i, '') || 'Procedimiento Médico Especial'}`,
          details: `Monto otorgado: ${formattedAmount} (${r.economicCurrency === 'VES' ? 'Bolívares al cambio' : 'Divisas USD'})`,
          quantity: 1,
          aidBadge: {
            label: `💵 ${formattedAmount}`,
            color: 'bg-emerald-100 text-emerald-900 border-emerald-300'
          }
        };
      }

      // 2. Bolsas de Comida
      if (r.socialAidType === 'food_bag' || (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0)) {
        const bags = Number(r.foodBagsCount || r.quantity) || 1;
        return {
          name: `Donativo de Bolsa(s) de Comida`,
          details: r.foodDonationNotes || 'Entrega de asistencia alimentaria / beneficio nutricional',
          quantity: bags,
          aidBadge: {
            label: `🥫 ${bags} ${bags === 1 ? 'Bolsa' : 'Bolsas'}`,
            color: 'bg-amber-100 text-amber-900 border-amber-300'
          }
        };
      }

      // 3. Insumos Físicos
      if (r.medicalSupplies && r.medicalSupplies.length > 0) {
        const names = r.medicalSupplies.map(s => `${s.supplyName} (${s.quantity || 1}${s.presentation ? ` - ${s.presentation}` : ''})`).join('; ');
        const totalQty = r.medicalSupplies.reduce((acc, s) => acc + (Number(s.quantity) || 1), 0);
        return {
          name: names,
          details: r.medicalSuppliesNotes || '',
          quantity: totalQty,
          aidBadge: {
            label: `📦 Insumos`,
            color: 'bg-indigo-100 text-indigo-900 border-indigo-300'
          }
        };
      }
      return {
        name: r.supplyName || r.medication || 'Insumo Médico',
        details: r.supplyPresentation || r.presentation || '',
        quantity: r.quantity || 1,
        aidBadge: {
          label: `📦 Insumo`,
          color: 'bg-indigo-100 text-indigo-900 border-indigo-300'
        }
      };
    }

    if (r.category === 'medical_derivation') {
      return {
        name: `${r.derivationService || 'Consulta Médica'}${r.derivationCenter ? ` - ${r.derivationCenter}` : ''}`,
        details: r.derivationDoctor || r.observations || '',
        quantity: 1,
        aidBadge: null
      };
    }

    // Default: medication
    if (r.medications && r.medications.length > 0) {
      const names = r.medications.map(m => `${m.medication} (${m.quantity || 1}${m.presentation ? ` - ${m.presentation}` : ''})`).join('; ');
      const totalQty = r.medications.reduce((acc, m) => acc + (Number(m.quantity) || 1), 0);
      return {
        name: names,
        details: r.dosage || '',
        quantity: totalQty,
        aidBadge: null
      };
    }

    return {
      name: r.medication || 'Medicamento',
      details: r.dosage || '',
      quantity: r.quantity || 1,
      aidBadge: null
    };
  };

  // Filtered list by search text, status, and social aid subtype
  const filteredList = useMemo(() => {
    return categoryRecipes.filter(r => {
      // Status filter
      if (statusFilter === 'delivered' && r.status !== 'delivered') return false;
      if (statusFilter === 'pending' && r.status === 'delivered') return false;

      // Subtype filter for medical_supply
      if (category === 'medical_supply' && socialAidFilter !== 'all') {
        const isEcon = r.socialAidType === 'economic_aid' || (r.economicAmount !== undefined && Number(r.economicAmount) > 0);
        const isFood = r.socialAidType === 'food_bag' || (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0);
        if (socialAidFilter === 'economic_aid' && !isEcon) return false;
        if (socialAidFilter === 'food_bag' && !isFood) return false;
        if (socialAidFilter === 'supply' && (isEcon || isFood)) return false;
      }

      // Text search
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const worker = workersMap.get(r.workerId) || workersMap.get(r.workerDni || '');
      const patientName = (r.workerFullName || worker?.fullName || '').toLowerCase();
      const patientDni = (r.workerDni || worker?.dni || '').toLowerCase();
      const commune = (r.commune || worker?.commune || '').toLowerCase();
      const itemInfo = getItemDetails(r);
      const itemName = itemInfo.name.toLowerCase();
      const itemDetails = (itemInfo.details || '').toLowerCase();
      const repName = (r.representativeFullName || '').toLowerCase();
      const econConcept = (r.economicConcept || '').toLowerCase();

      return (
        patientName.includes(term) ||
        patientDni.includes(term) ||
        commune.includes(term) ||
        itemName.includes(term) ||
        itemDetails.includes(term) ||
        repName.includes(term) ||
        econConcept.includes(term)
      );
    });
  }, [categoryRecipes, category, statusFilter, socialAidFilter, search, workersMap]);

  // Export to Excel function
  const handleExportExcel = () => {
    if (filteredList.length === 0) return;

    const dataRows = filteredList.map((r, idx) => {
      const worker = workersMap.get(r.workerId) || workersMap.get(r.workerDni || '');
      const itemInfo = getItemDetails(r);
      const fecha = formatDateSafe(r.createdAt, 'dd/MM/yyyy HH:mm', 'N/A');
      const isEcon = r.socialAidType === 'economic_aid' || (r.economicAmount !== undefined && Number(r.economicAmount) > 0);
      const isFood = r.socialAidType === 'food_bag' || (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0);
      const tipoAyuda = isEcon 
        ? 'Aporte Económico Monetario' 
        : isFood 
        ? 'Donativo de Bolsas de Comida' 
        : r.category === 'technical_aid' 
        ? 'Ayuda Humana' 
        : r.category === 'medication' 
        ? 'Fármaco' 
        : r.category === 'medical_derivation' 
        ? 'Derivación Médica' 
        : 'Insumo Médico Descartable';

      return {
        "N°": idx + 1,
        "Paciente": r.workerFullName || worker?.fullName || 'N/A',
        "Cédula": r.workerDni || worker?.dni || 'N/A',
        "Comuna / Territorio": r.commune || worker?.commune || 'No asignada',
        "Teléfono": worker?.phone || 'N/A',
        "Modalidad de Ayuda": tipoAyuda,
        "Requerimiento / Concepto": itemInfo.name,
        "Especificación / Dosis": itemInfo.details || 'N/A',
        "Moneda": isEcon ? (r.economicCurrency === 'VES' ? 'Bs. (al cambio)' : '$ (Divisas)') : '-',
        "Monto Aporte": isEcon ? (Number(r.economicAmount) || 0) : '-',
        "Cantidad / Bolsas": itemInfo.quantity,
        "Estado": r.status === 'delivered' ? 'Entregado / Despachado' : 'Pendiente en Espera',
        "Urgencia": r.isUrgent ? 'SÍ (Prioritario)' : 'Normal',
        "Recibido Por": r.isDeliveredToRepresentative 
          ? `Representante: ${r.representativeFullName || ''} (${r.representativeRelationship || ''})` 
          : 'Titular Directo',
        "Fecha de Registro": fecha
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Beneficiarios");

    // Auto column width
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 26 },
      { wch: 35 },
      { wch: 25 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 18 },
    ];

    const fileName = `Listado_${categoryConfig.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const IconComponent = categoryConfig.icon;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[96vw] sm:w-[95vw] max-w-[96vw] lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1520px] h-[94dvh] sm:h-[92dvh] max-h-[94dvh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50 border-slate-200 rounded-xl sm:rounded-2xl shadow-2xl">
          
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 md:p-6 pr-14 bg-white border-b border-slate-200 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${categoryConfig.colorClass}`}>
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-base sm:text-lg md:text-xl font-black text-slate-900 tracking-tight">
                      {categoryConfig.title}
                    </DialogTitle>
                    <Badge className={`${categoryConfig.badgeColor} text-white font-bold text-[11px] sm:text-xs uppercase px-2.5 py-0.5`}>
                      {stats.total} Solicitudes
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-slate-500 mt-1 max-w-2xl">
                    {categoryConfig.description}
                  </DialogDescription>
                </div>
              </div>

              {/* Status Summary Counters */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-800">Entregados</p>
                  <p className="text-base sm:text-lg font-black text-emerald-700">{stats.delivered}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-[10px] font-black uppercase text-amber-800">En Espera</p>
                  <p className="text-base sm:text-lg font-black text-amber-700">{stats.pending}</p>
                </div>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-80 md:w-96">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por paciente, cédula, comuna o ítem..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-lg focus-visible:ring-blue-600 w-full"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center bg-slate-100 p-1 rounded-lg w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer flex-1 sm:flex-none text-center ${
                      statusFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos ({stats.total})
                  </button>
                  <button
                    onClick={() => setStatusFilter('delivered')}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer flex-1 sm:flex-none text-center ${
                      statusFilter === 'delivered'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Entregados ({stats.delivered})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer flex-1 sm:flex-none text-center ${
                      statusFilter === 'pending'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    En Espera ({stats.pending})
                  </button>
                </div>

                <Button
                  onClick={handleExportExcel}
                  disabled={filteredList.length === 0}
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs font-bold text-emerald-800 border-emerald-300 hover:bg-emerald-50 shrink-0 gap-1.5 cursor-pointer ml-auto sm:ml-0"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Exportar Excel</span>
                  <span className="sm:hidden">Excel</span>
                </Button>
              </div>
            </div>

            {/* Sub-barra especializada cuando la categoría es Insumo Médico - Social */}
            {category === 'medical_supply' && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                {/* Desglose de Totales Sociales */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Desglose:
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-950 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl shadow-2xs">
                    💵 Aportes: {stats.economicUSD > 0 ? `$ ${stats.economicUSD.toLocaleString('es-VE')}` : ''} {stats.economicVES > 0 ? `Bs. ${stats.economicVES.toLocaleString('es-VE')}` : ''} {stats.economicUSD === 0 && stats.economicVES === 0 ? '$ 0' : ''} <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.2 rounded-md font-extrabold">({stats.economicCount})</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-950 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl shadow-2xs">
                    🥫 Comida: {stats.foodBags} bolsas <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded-md font-extrabold">({stats.foodBagsOrders})</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl shadow-2xs">
                    📦 Insumos: {stats.suppliesUnits} un.
                  </span>
                </div>

                {/* Subfiltro interactivo por modalidad */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full md:w-auto justify-between md:justify-start">
                  <button
                    onClick={() => setSocialAidFilter('all')}
                    className={`text-xs font-black uppercase px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                      socialAidFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setSocialAidFilter('economic_aid')}
                    className={`text-xs font-black uppercase px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      socialAidFilter === 'economic_aid'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Aportes ($ / Bs)</span>
                  </button>
                  <button
                    onClick={() => setSocialAidFilter('food_bag')}
                    className={`text-xs font-black uppercase px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      socialAidFilter === 'food_bag'
                        ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Comida</span>
                  </button>
                  <button
                    onClick={() => setSocialAidFilter('supply')}
                    className={`text-xs font-black uppercase px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      socialAidFilter === 'supply'
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Insumos</span>
                  </button>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Table / List Body Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-slate-50">
            {filteredList.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-700 uppercase">
                  No se encontraron beneficiarios
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {search
                    ? `No existen registros que coincidan con la búsqueda "${search}".`
                    : "No hay solicitudes registradas bajo el filtro seleccionado en esta categoría."}
                </p>
              </div>
            ) : (
              <>
                {/* 1. Vista de Tarjetas para Móviles (Visible en < md) */}
                <div className="block md:hidden space-y-3">
                  {filteredList.map((recipe) => {
                    const worker = workersMap.get(recipe.workerId) || workersMap.get(recipe.workerDni || '');
                    const itemInfo = getItemDetails(recipe);
                    const isDelivered = recipe.status === 'delivered';
                    const dateFormatted = recipe.createdAt 
                      ? formatDateSafe(recipe.createdAt, 'dd MMM yyyy', '')
                      : null;

                    return (
                      <div
                        key={recipe.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3 hover:border-slate-300 transition-colors"
                      >
                        {/* Cabecera del Paciente */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                              {(recipe.workerFullName || worker?.fullName || 'P').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-snug">
                                {recipe.workerFullName || worker?.fullName || 'Paciente'}
                              </p>
                              <p className="text-xs text-slate-500 font-semibold">
                                V- {recipe.workerDni || worker?.dni || 'S/C'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Estado */}
                          {isDelivered ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[10px] font-black uppercase px-2 py-0.5 shrink-0">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              Entregado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-[10px] font-black uppercase px-2 py-0.5 shrink-0">
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                              En Espera
                            </Badge>
                          )}
                        </div>

                        {recipe.isUrgent && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            🚨 PRIORITARIO / CASO URGENTE
                          </div>
                        )}

                        {/* Bloque del Requerimiento / Ítem */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                              {categoryConfig.itemColumnName}:
                            </span>
                            <span className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                              Cant: {itemInfo.quantity}
                            </span>
                          </div>
                          {itemInfo.aidBadge && (
                            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md border ${itemInfo.aidBadge.color} mb-1`}>
                              {itemInfo.aidBadge.label}
                            </span>
                          )}
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            {itemInfo.name}
                          </p>
                          {itemInfo.details && (
                            <p className="text-[11px] text-slate-600">
                              {itemInfo.details}
                            </p>
                          )}
                          {recipe.isDeliveredToRepresentative && (
                            <p className="text-[10px] text-purple-700 font-medium pt-1 border-t border-slate-200/60">
                              Retira rep.: {recipe.representativeFullName} ({recipe.representativeRelationship})
                            </p>
                          )}
                        </div>

                        {/* Metadatos: Comuna y Fecha */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate max-w-[170px]">
                              {recipe.commune || worker?.commune || 'No asignada'}
                            </span>
                          </div>
                          {dateFormatted && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Calendar className="w-3 h-3" />
                              <span>{dateFormatted}</span>
                            </div>
                          )}
                        </div>

                        {/* Acciones del Ciudadano */}
                        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                          {recipe.recipeFileUrl && (
                            <a
                              href={recipe.recipeFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-9.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                              title="Ver soporte adjunto"
                            >
                              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                              <span>Soporte</span>
                            </a>
                          )}
                          {worker ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedWorkerForExpediente(worker)}
                              className="flex-1 h-9.5 text-xs font-black text-blue-800 border-blue-200 bg-blue-50/80 hover:bg-blue-100/90 rounded-xl cursor-pointer justify-center gap-1.5 shadow-2xs"
                            >
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span>Ver Expediente del Ciudadano →</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 italic py-2 text-center w-full">Sin ficha de expediente</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Vista de Tabla Completa para Escritorio y Tablets (Visible en >= md) */}
                <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 border-b border-slate-200">
                        <TableRow>
                          <TableHead className="text-[11px] font-black uppercase text-slate-600 py-3.5 min-w-[220px]">
                            Paciente / Beneficiario
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase text-slate-600 py-3.5 min-w-[170px]">
                            Comuna / Territorio
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase text-slate-600 py-3.5 min-w-[280px]">
                            {categoryConfig.itemColumnName}
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase text-slate-600 py-3.5 text-center w-[80px]">
                            Cant.
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase text-slate-600 py-3.5 text-center w-[130px]">
                            Estado
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase text-slate-600 py-3.5 text-right min-w-[180px]">
                            Acciones
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100">
                        {filteredList.map((recipe) => {
                          const worker = workersMap.get(recipe.workerId) || workersMap.get(recipe.workerDni || '');
                          const itemInfo = getItemDetails(recipe);
                          const isDelivered = recipe.status === 'delivered';
                          const dateFormatted = recipe.createdAt 
                            ? formatDateSafe(recipe.createdAt, 'dd MMM yyyy', '')
                            : null;

                          return (
                            <TableRow key={recipe.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Paciente y Cédula */}
                              <TableCell className="py-3.5">
                                <div className="flex items-start gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                    {(recipe.workerFullName || worker?.fullName || 'P').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-900 leading-tight">
                                      {recipe.workerFullName || worker?.fullName || 'Paciente'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                      V- {recipe.workerDni || worker?.dni || 'S/C'}
                                    </p>
                                    {recipe.isUrgent && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 mt-0.5">
                                        🚨 PRIORITARIO
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Comuna / Territorio */}
                              <TableCell className="py-3.5">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span className="truncate max-w-[170px]">
                                    {recipe.commune || worker?.commune || 'No asignada'}
                                  </span>
                                </div>
                                {dateFormatted && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {dateFormatted}
                                  </p>
                                )}
                              </TableCell>

                              {/* Requerimiento / Ítem */}
                              <TableCell className="py-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {itemInfo.aidBadge && (
                                    <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded border ${itemInfo.aidBadge.color}`}>
                                      {itemInfo.aidBadge.label}
                                    </span>
                                  )}
                                  <p className="text-xs font-bold text-slate-900 leading-snug">
                                    {itemInfo.name}
                                  </p>
                                </div>
                                {itemInfo.details && (
                                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                                    {itemInfo.details}
                                  </p>
                                )}
                                {recipe.isDeliveredToRepresentative && (
                                  <p className="text-[10px] text-purple-700 font-medium mt-0.5">
                                    Retira rep.: {recipe.representativeFullName} ({recipe.representativeRelationship})
                                  </p>
                                )}
                              </TableCell>

                              {/* Cantidad */}
                              <TableCell className="py-3.5 text-center">
                                <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-900 font-black text-xs">
                                  {itemInfo.quantity}
                                </span>
                              </TableCell>

                              {/* Estado */}
                              <TableCell className="py-3.5 text-center">
                                {isDelivered ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[10px] font-black uppercase px-2 py-0.5">
                                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                    Entregado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-[10px] font-black uppercase px-2 py-0.5">
                                    <Clock className="w-3 h-3 mr-1 text-amber-600" />
                                    En Espera
                                  </Badge>
                                )}
                              </TableCell>

                              {/* Acciones / Expediente y Soporte */}
                              <TableCell className="py-3.5 text-right min-w-[180px]">
                                <div className="flex items-center justify-end gap-1.5">
                                  {recipe.recipeFileUrl && (
                                    <a
                                      href={recipe.recipeFileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="h-8 px-2.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 inline-flex items-center gap-1 transition-colors shadow-2xs"
                                      title="Ver soporte adjunto"
                                    >
                                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                                      <span className="hidden xl:inline text-[10px] uppercase font-black">Soporte</span>
                                    </a>
                                  )}
                                  {worker ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedWorkerForExpediente(worker)}
                                      className="h-8 px-3 text-xs font-black text-blue-800 border-blue-200 bg-blue-50/80 hover:bg-blue-100 hover:border-blue-300 rounded-lg shadow-2xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Expediente →</span>
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Sin ficha</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-500 font-medium">
              Mostrando <strong className="text-slate-800">{filteredList.length}</strong> de <strong className="text-slate-800">{categoryRecipes.length}</strong> solicitudes
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="font-bold text-xs h-8 sm:h-9 px-4 border-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expediente Modal if triggered */}
      {selectedWorkerForExpediente && (
        <Dialog
          open={!!selectedWorkerForExpediente}
          onOpenChange={(open) => !open && setSelectedWorkerForExpediente(null)}
        >
          <DialogContent className="w-[96vw] sm:w-[95vw] max-w-[96vw] lg:max-w-6xl xl:max-w-[1500px] h-[94dvh] sm:h-[92dvh] max-h-[94dvh] overflow-y-auto p-0 border-none shadow-2xl bg-white z-[70] rounded-xl sm:rounded-2xl">
            <WorkerExpediente
              worker={selectedWorkerForExpediente}
              onClose={() => setSelectedWorkerForExpediente(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
