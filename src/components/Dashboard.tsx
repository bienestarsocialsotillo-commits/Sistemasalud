import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  Users, 
  Activity, 
  ShieldCheck, 
  AlertTriangle,
  TrendingUp,
  MapPin,
  FileText,
  Pill,
  ArrowUpRight,
  Stethoscope,
  Package,
  Loader2,
  Trash2,
  CheckCircle2,
  Clock,
  Accessibility,
  Filter,
  Printer,
  Download,
  Calendar,
  Building2,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  ExternalLink,
  Phone,
  Sparkles,
  Compass
} from "lucide-react";
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { dataService } from '@/lib/dataService';
import { MedicationRecipe, Worker } from '@/types';
import { format, startOfDay, startOfWeek, startOfMonth, isAfter, isSameDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { COMMUNES, OTHER_COMMUNE_OPTION, cleanItemDisplayName, normalizeItemKey } from '@/constants';
import { isForeignerCommune, getRecipeDeliveredAidUnits } from '@/utils/territoryPdf';
import CommunePatientsModal from '@/components/CommunePatientsModal';
import WorkerExpediente from '@/components/WorkerExpediente';
import ExecutiveReportModal from '@/components/ExecutiveReportModal';
import CategoryPatientsModal, { PharmacyCategoryType, getRecipeCategory } from '@/components/CategoryPatientsModal';
import { parseDateSafe } from '@/utils/dateUtils';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  const [selectedWorkerForExpediente, setSelectedWorkerForExpediente] = useState<Worker | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<PharmacyCategoryType | null>(null);

  // Executive Filter state
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [communeFilter, setCommuneFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation'>('all');

  // Mini-panel states
  const [resourceTab, setResourceTab] = useState<'technical_aids' | 'medications'>('technical_aids');
  const [pendingFilter, setPendingFilter] = useState<'all' | 'urgent' | 'technical_aids' | 'medications'>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [w, r] = await Promise.all([
          dataService.getWorkers(),
          dataService.getMedicationRecipes()
        ]);
        setWorkers(w);
        setRecipes(r);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
        toast.error("Error al sincronizar datos del tablero");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const now = new Date();

  // Set of 21 official Sotillo communes normalized for rapid lookup
  const officialCommunesSet = useMemo(() => {
    return new Set(COMMUNES.map(c => c.trim().toUpperCase()));
  }, []);

  // Helper to determine if a record belongs to the foreign / extra-municipal category
  const isForeignRecord = (communeStr?: string | null, isForeignerFlag?: boolean) => {
    if (isForeignerFlag) return true;
    if (!communeStr) return false;
    if (isForeignerCommune(communeStr)) return true;
    const upper = communeStr.trim().toUpperCase();
    return !officialCommunesSet.has(upper);
  };

  // Filtered Recipes computation
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      // 1. Time Filter
      if (timeFilter !== 'all') {
        const d = parseDateSafe(r.createdAt);
        if (!d) return false;
        if (timeFilter === 'today' && !isSameDay(d, now)) return false;
        if (timeFilter === 'week' && !isAfter(d, startOfWeek(now))) return false;
        if (timeFilter === 'month' && !isAfter(d, startOfMonth(now))) return false;
      }

      // 2. Commune Filter
      if (communeFilter !== 'all') {
        if (isForeignRecord(communeFilter)) {
          if (!isForeignRecord(r.commune, r.isForeigner)) return false;
        } else {
          const itemCommune = r.commune?.toUpperCase().trim();
          if (itemCommune !== communeFilter.toUpperCase().trim()) return false;
        }
      }

      // 3. Category Filter
      if (categoryFilter !== 'all') {
        if (getRecipeCategory(r) !== categoryFilter) return false;
      }

      return true;
    });
  }, [recipes, timeFilter, communeFilter, categoryFilter, officialCommunesSet]);

  // Specific 4-Category Statistics (Pharmacy, Tech Aids, Supplies, Derivations)
  const categoryStats = useMemo(() => {
    // Base recipes matching active Time and Commune filters (independent of categoryFilter)
    const baseRecipes = recipes.filter(r => {
      // 1. Time Filter
      if (timeFilter !== 'all') {
        const d = parseDateSafe(r.createdAt);
        if (!d) return false;
        if (timeFilter === 'today' && !isSameDay(d, now)) return false;
        if (timeFilter === 'week' && !isAfter(d, startOfWeek(now))) return false;
        if (timeFilter === 'month' && !isAfter(d, startOfMonth(now))) return false;
      }

      // 2. Commune Filter
      if (communeFilter !== 'all') {
        if (isForeignRecord(communeFilter)) {
          if (!isForeignRecord(r.commune, r.isForeigner)) return false;
        } else {
          const itemCommune = r.commune?.toUpperCase().trim();
          if (itemCommune !== communeFilter.toUpperCase().trim()) return false;
        }
      }
      return true;
    });

    const stats: Record<PharmacyCategoryType, { 
      total: number; 
      delivered: number; 
      pending: number; 
      deliveredUnits: number;
      pendingUnits: number;
      patientCount: number;
      economicUSD: number;
      economicVES: number;
      economicCount: number;
      foodBagsTotal: number;
      foodBagsCount: number;
      suppliesUnits: number;
    }> = {
      medication: { total: 0, delivered: 0, pending: 0, deliveredUnits: 0, pendingUnits: 0, patientCount: 0, economicUSD: 0, economicVES: 0, economicCount: 0, foodBagsTotal: 0, foodBagsCount: 0, suppliesUnits: 0 },
      technical_aid: { total: 0, delivered: 0, pending: 0, deliveredUnits: 0, pendingUnits: 0, patientCount: 0, economicUSD: 0, economicVES: 0, economicCount: 0, foodBagsTotal: 0, foodBagsCount: 0, suppliesUnits: 0 },
      medical_supply: { total: 0, delivered: 0, pending: 0, deliveredUnits: 0, pendingUnits: 0, patientCount: 0, economicUSD: 0, economicVES: 0, economicCount: 0, foodBagsTotal: 0, foodBagsCount: 0, suppliesUnits: 0 },
      medical_derivation: { total: 0, delivered: 0, pending: 0, deliveredUnits: 0, pendingUnits: 0, patientCount: 0, economicUSD: 0, economicVES: 0, economicCount: 0, foodBagsTotal: 0, foodBagsCount: 0, suppliesUnits: 0 },
    };

    const patientSets = {
      medication: new Set<string>(),
      technical_aid: new Set<string>(),
      medical_supply: new Set<string>(),
      medical_derivation: new Set<string>(),
    };

    baseRecipes.forEach(r => {
      const cat = getRecipeCategory(r);
      const { medsUnits, technicalAidUnits, medicalSupplyUnits, derivationUnits } = getRecipeDeliveredAidUnits(r);
      const units = cat === 'medication' ? medsUnits : cat === 'technical_aid' ? technicalAidUnits : cat === 'medical_supply' ? medicalSupplyUnits : derivationUnits;

      stats[cat].total++;
      if (r.status === 'delivered') {
        stats[cat].delivered++;
        stats[cat].deliveredUnits += units;
      } else {
        stats[cat].pending++;
        stats[cat].pendingUnits += units;
      }

      if (cat === 'medical_supply') {
        const isEcon = r.socialAidType === 'economic_aid' || (r.economicAmount !== undefined && Number(r.economicAmount) > 0);
        const isFood = r.socialAidType === 'food_bag' || (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0);
        if (isEcon) {
          stats.medical_supply.economicCount++;
          const amt = Number(r.economicAmount) || 0;
          if (r.economicCurrency === 'VES') {
            stats.medical_supply.economicVES += amt;
          } else {
            stats.medical_supply.economicUSD += amt;
          }
        } else if (isFood) {
          stats.medical_supply.foodBagsCount++;
          stats.medical_supply.foodBagsTotal += Number(r.foodBagsCount || r.quantity) || 1;
        } else {
          stats.medical_supply.suppliesUnits += (r.medicalSupplies?.length || 1);
        }
      }

      const pKey = r.workerDni || r.workerId || r.id;
      patientSets[cat].add(pKey);
    });

    return {
      medication: { ...stats.medication, patientCount: patientSets.medication.size },
      technical_aid: { ...stats.technical_aid, patientCount: patientSets.technical_aid.size },
      medical_supply: { ...stats.medical_supply, patientCount: patientSets.medical_supply.size },
      medical_derivation: { ...stats.medical_derivation, patientCount: patientSets.medical_derivation.size },
      baseRecipes,
    };
  }, [recipes, timeFilter, communeFilter, officialCommunesSet]);

  // Filtered Workers computation
  const filteredWorkers = useMemo(() => {
    if (communeFilter === 'all') return workers;
    if (isForeignRecord(communeFilter)) {
      return workers.filter(w => isForeignRecord(w.commune, w.isForeigner));
    }
    return workers.filter(w => w.commune?.toUpperCase().trim() === communeFilter.toUpperCase().trim());
  }, [workers, communeFilter, officialCommunesSet]);

  // Key Ratios & KPIs
  const totalRequests = filteredRecipes.length;
  const deliveredRequests = filteredRecipes.filter(r => r.status === 'delivered').length;
  const pendingRequests = filteredRecipes.filter(r => r.status !== 'delivered').length;
  const complianceRate = totalRequests > 0 ? Math.round((deliveredRequests / totalRequests) * 100) : 100;

  // Total physical aid units delivered across all categories
  const totalDeliveredAidUnits = useMemo(() => {
    return filteredRecipes
      .filter(r => r.status === 'delivered')
      .reduce((acc, r) => acc + getRecipeDeliveredAidUnits(r).totalUnits, 0);
  }, [filteredRecipes]);

  // Segregation of Sotillo vs Foreign Cases
  const sotilloWorkersInView = useMemo(() => {
    return filteredWorkers.filter(w => !isForeignRecord(w.commune, w.isForeigner));
  }, [filteredWorkers, officialCommunesSet]);

  const foreignWorkersInView = useMemo(() => {
    return filteredWorkers.filter(w => isForeignRecord(w.commune, w.isForeigner));
  }, [filteredWorkers, officialCommunesSet]);

  const sotilloRecipesInView = useMemo(() => {
    return filteredRecipes.filter(r => !isForeignRecord(r.commune, r.isForeigner));
  }, [filteredRecipes, officialCommunesSet]);

  const foreignRecipesInView = useMemo(() => {
    return filteredRecipes.filter(r => isForeignRecord(r.commune, r.isForeigner));
  }, [filteredRecipes, officialCommunesSet]);

  // Technical aids calculations
  const techAidsList = useMemo(() => {
    return filteredRecipes.filter(r => r.requiresTechnicalAid || r.category === 'technical_aid');
  }, [filteredRecipes]);
  const techAidsTotal = techAidsList.reduce((acc, r) => acc + (Number(r.technicalAidQuantity || r.quantity) || 1), 0);
  const techAidsDelivered = techAidsList.filter(r => r.status === 'delivered').reduce((acc, r) => acc + (Number(r.technicalAidQuantity || r.quantity) || 1), 0);
  const techAidsPending = techAidsList.filter(r => r.status !== 'delivered').reduce((acc, r) => acc + (Number(r.technicalAidQuantity || r.quantity) || 1), 0);

  // Medications calculations
  const medsList = useMemo(() => {
    return filteredRecipes.filter(r => !r.requiresTechnicalAid && r.category !== 'technical_aid');
  }, [filteredRecipes]);
  const medicationsTotal = medsList.reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
  const medicationsDelivered = medsList.filter(r => r.status === 'delivered').reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
  const medicationsPending = medsList.filter(r => r.status !== 'delivered').reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);

  // Vulnerable population
  const disabilityCount = filteredWorkers.filter(w => w.hasDisability).length;
  const vulnerableCount = filteredWorkers.filter(w => w.hasDisability || (w.vulnerabilityScore && w.vulnerabilityScore >= 2)).length;

  // Strict 21 Municipal Communes Coverage (Max 21)
  const activeSotilloCommunesSet = useMemo(() => {
    const set = new Set<string>();
    sotilloRecipesInView.forEach(r => {
      const com = r.commune?.trim().toUpperCase();
      if (com && officialCommunesSet.has(com)) {
        set.add(com);
      }
    });
    sotilloWorkersInView.forEach(w => {
      const com = w.commune?.trim().toUpperCase();
      if (com && officialCommunesSet.has(com)) {
        set.add(com);
      }
    });
    return set;
  }, [sotilloRecipesInView, sotilloWorkersInView, officialCommunesSet]);

  const activeCommunesCount = activeSotilloCommunesSet.size; // Strictly bounded between 0 and 21
  const totalCommunesCount = COMMUNES.length; // Exactly 21
  const coveragePercent = totalCommunesCount > 0 ? Math.min(100, Math.round((activeCommunesCount / totalCommunesCount) * 100)) : 0;

  // Strict Commune Ranking for the 21 Sotillo Communes
  const sotilloCommuneRanking = useMemo(() => {
    const map: Record<string, number> = {};
    sotilloRecipesInView.forEach(r => {
      const com = r.commune?.trim().toUpperCase();
      if (com && officialCommunesSet.has(com)) {
        const canonical = COMMUNES.find(c => c.trim().toUpperCase() === com) || com;
        map[canonical] = (map[canonical] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [sotilloRecipesInView, officialCommunesSet]);

  // Alias for compatibility across report modals and exports
  const communeRanking = sotilloCommuneRanking;

  const topBarData = sotilloCommuneRanking.slice(0, 7);

  // Foreign / Extramunicipal counters
  const foreignDeliveredCount = useMemo(() => {
    return foreignRecipesInView.filter(r => r.status === 'delivered').length;
  }, [foreignRecipesInView]);

  const foreignPendingCount = useMemo(() => {
    return foreignRecipesInView.filter(r => r.status !== 'delivered').length;
  }, [foreignRecipesInView]);

  // Top Technical Aids items normalizados
  const topTechAids = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    techAidsList.forEach(r => {
      const raw = r.technicalAidType || r.medication || 'Ayuda Humana General';
      const clean = cleanItemDisplayName(raw);
      const key = normalizeItemKey(clean);
      if (!key) return;
      const qty = Number(r.technicalAidQuantity || r.quantity) || 1;
      if (!map[key]) {
        map[key] = { name: clean, count: qty };
      } else {
        map[key].count += qty;
      }
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [techAidsList]);

  // Top Medications items normalizados
  const topMeds = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    medsList.forEach(r => {
      const raw = r.medication || 'Medicamento';
      const clean = cleanItemDisplayName(raw);
      const key = normalizeItemKey(clean);
      if (!key) return;
      const qty = Number(r.quantity) || 1;
      if (!map[key]) {
        map[key] = { name: clean, count: qty };
      } else {
        map[key].count += qty;
      }
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [medsList]);

  // Priority Pending Requests computation
  const pendingItems = useMemo(() => {
    const list = recipes
      .filter(r => r.status !== 'delivered')
      .map(r => {
        const associatedWorker = workers.find(w => w.id === r.workerId);
        const d = parseDateSafe(r.createdAt) || new Date();
        const daysWaiting = Math.max(0, differenceInDays(now, d));
        const isTech = r.requiresTechnicalAid || r.category === 'technical_aid';
        const itemName = isTech ? (r.technicalAidType || r.medication || 'Ayuda Humana') : r.medication;
        const qty = Number(isTech ? (r.technicalAidQuantity || r.quantity) : r.quantity) || 1;

        return {
          id: r.id,
          workerId: r.workerId,
          associatedWorker,
          citizenName: associatedWorker?.fullName || 'Ciudadano en Registro',
          citizenDni: associatedWorker?.dni || 'S/C',
          phone: associatedWorker?.phone || '',
          commune: r.commune || associatedWorker?.commune || 'S.I.',
          sector: r.sector || associatedWorker?.sector || 'S.I.',
          item: itemName,
          quantity: qty,
          isTech,
          categoryLabel: isTech ? 'Ayuda Humana' : 'Farmacia',
          daysWaiting,
          isUrgent: r.isUrgent || daysWaiting > 15,
          createdAt: d
        };
      })
      .sort((a, b) => {
        // Priority to urgent or older waiting times
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return b.daysWaiting - a.daysWaiting;
      });

    return list.filter(item => {
      if (pendingFilter === 'urgent') return item.isUrgent || item.daysWaiting > 15;
      if (pendingFilter === 'technical_aids') return item.isTech;
      if (pendingFilter === 'medications') return !item.isTech;
      return true;
    });
  }, [recipes, workers, pendingFilter]);

  // Labels for Report
  const timeFilterLabel = {
    all: 'Todo el Histórico Acumulado',
    today: 'Jornada de Hoy',
    week: 'Últimos 7 Días',
    month: 'Mes en Curso'
  }[timeFilter];

  const communeFilterLabel = communeFilter === 'all' ? 'Todas las Comunas (Municipio Sotillo)' : communeFilter;

  // 1-Click Excel Export
  const handleExportExcel = () => {
    try {
      // 1. Resumen sheet
      const summaryData = [
        ["REPORTE EJECUTIVO DE GESTIÓN SOCIAL - MUNICIPIO JUAN ANTONIO SOTILLO"],
        ["Fecha de Generación:", format(new Date(), "dd/MM/yyyy HH:mm:ss")],
        ["Filtro Temporal:", timeFilterLabel],
        ["Ámbito Territorial:", communeFilterLabel],
        [],
        ["INDICADOR MACRO", "VALOR", "DETALLE"],
        ["Población Censada", filteredWorkers.length, `${vulnerableCount} casos de alta vulnerabilidad`],
        ["Tasa de Cumplimiento", `${complianceRate}%`, `${deliveredRequests} entregadas de ${totalRequests} solicitudes`],
        ["Ayudas Humanas Totales", techAidsTotal, `${techAidsDelivered} entregadas, ${techAidsPending} en espera`],
        ["Medicamentos e Insumos", medicationsTotal, `${medicationsDelivered} dispensados, ${medicationsPending} en espera`],
        ["Comunas Abordadas", `${activeCommunesCount} de ${totalCommunesCount}`, `${Math.round((activeCommunesCount / totalCommunesCount) * 100)}% de cobertura territorial`]
      ];

      // 2. Ranking Comunal sheet
      const communeData = [
        ["#", "COMUNA / TERRITORIO", "SOLICITUDES TOTALES", "PORCENTAJE DE DEMANDA"],
        ...communeRanking.map((c, i) => [
          i + 1,
          c.name,
          c.total,
          totalRequests > 0 ? `${Math.round((c.total / totalRequests) * 100)}%` : '0%'
        ])
      ];

      // 3. Pendientes sheet
      const pendingSheetData = [
        ["BENEFICIARIO", "CÉDULA", "TELÉFONO", "COMUNA", "SECTOR", "RECURSO", "CANTIDAD", "TIPO", "DÍAS EN ESPERA", "ESTADO"],
        ...pendingItems.map(p => [
          p.citizenName,
          p.citizenDni,
          p.phone || 'N/A',
          p.commune,
          p.sector,
          p.item,
          p.quantity,
          p.categoryLabel,
          p.daysWaiting,
          p.isUrgent ? 'URGENTE' : 'REGULAR'
        ])
      ];

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      const wsCommunes = XLSX.utils.aoa_to_sheet(communeData);
      const wsPending = XLSX.utils.aoa_to_sheet(pendingSheetData);

      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen General");
      XLSX.utils.book_append_sheet(wb, wsCommunes, "Demanda Territorial");
      XLSX.utils.book_append_sheet(wb, wsPending, "Casos en Espera");

      const fileName = `Informe_Gestion_Sotillo_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Reporte Excel exportado correctamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al exportar archivo Excel");
    }
  };

  // Reset database handler (Strictly protected for Super Admin)
  const handleResetDatabase = async () => {
    if (!isSuperAdmin) {
      toast.error("Acceso denegado: Solo el Super Administrador puede reiniciar el censo.");
      return;
    }
    const confirm1 = window.confirm("¿ESTÁ COMPLETAMENTE SEGURO? Esta acción borrará permanentemente TODOS los registros del censo, farmacia, evaluaciones e historias clínicas.");
    if (confirm1) {
      const confirm2 = window.prompt("Para confirmar la eliminación total, escriba la palabra: ELIMINAR");
      if (confirm2 === "ELIMINAR") {
        try {
          toast.loading("Restableciendo base de datos a cero...");
          await dataService.resetAllDatabase();
          toast.dismiss();
          toast.success("Base de datos restablecida correctamente a cero");
          setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
          toast.dismiss();
          toast.error("Error al restablecer la base de datos");
        }
      } else if (confirm2 !== null) {
        toast.error("Confirmación incorrecta. No se realizaron cambios.");
      }
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 opacity-60" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          Sincronizando Métricas Municipales de Sotillo...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. Header Institucional */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
              Alcaldía del Municipio Juan Antonio Sotillo
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-blue-950 tracking-tight uppercase">
            Sistema de Gestión Social
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Monitoreo estratégico en tiempo real de asistencia social, ayudas humanas y farmacia comunitaria
          </p>
        </div>
      </div>

      {/* 2. Barra de Control Contextual y Filtros Rápidos */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          
          {/* Temporal Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Período:
            </span>
            {(
              [
                { id: 'all', label: 'Todo el Histórico' },
                { id: 'today', label: 'Hoy' },
                { id: 'week', label: 'Esta Semana' },
                { id: 'month', label: 'Este Mes' },
              ] as const
            ).map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeFilter(tf.id)}
                className={`text-xs font-bold px-3 py-1 rounded-xl transition-all cursor-pointer ${
                  timeFilter === tf.id
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Category Toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Recurso:
            </span>
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'medication', label: '💊 Fármacos' },
                { id: 'technical_aid', label: '♿ Ayudas Humanas' },
                { id: 'medical_supply', label: '📦 Insumos' },
                { id: 'medical_derivation', label: '🩺 Derivación' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-blue-950 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Commune Territory Selector */}
        <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 uppercase">Filtrar por Comuna:</span>
            <select
              value={communeFilter}
              onChange={(e) => setCommuneFilter(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-xs cursor-pointer uppercase"
            >
              <option value="all">TODAS LAS COMUNAS ({COMMUNES.length})</option>
              {COMMUNES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={OTHER_COMMUNE_OPTION}>{OTHER_COMMUNE_OPTION}</option>
            </select>
          </div>

          <div className="text-[11px] font-medium text-slate-500">
            Mostrando <strong>{filteredRecipes.length}</strong> atenciones y <strong>{filteredWorkers.length}</strong> ciudadanos en el filtro
          </div>
        </div>
      </div>

      {/* 3. Golden Triangle: 5 Tarjetas Macro de Ratio y Alto Impacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Tasa de Cumplimiento / Efectividad */}
        <Card className="bg-white rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-16 h-16 text-emerald-900" />
          </div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                Efectividad de Entrega
              </span>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Meta Cumplida
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-emerald-700">{complianceRate}%</h3>
              <span className="text-[10px] font-bold text-slate-500 uppercase">despachado</span>
            </div>
            
            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, complianceRate)}%` }}
              ></div>
            </div>

            <div className="mt-2 text-[10px] space-y-0.5">
              <p className="font-black text-emerald-800 uppercase tracking-tight">
                {totalDeliveredAidUnits.toLocaleString()} Ayudas Entregadas Totales
              </p>
              <p className="font-semibold text-slate-500 uppercase tracking-tight">
                En {deliveredRequests.toLocaleString()} Despachos Realizados • {pendingRequests} en Espera
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Ayudas Humanas Biomecánicas */}
        <Card 
          className="bg-white rounded-2xl border border-cyan-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
          onClick={() => setSelectedCategoryModal('technical_aid')}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Accessibility className="w-16 h-16 text-cyan-900" />
          </div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider">
                Ayudas Humanas
              </span>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                Movilidad
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-cyan-900">{techAidsTotal}</h3>
              <span className="text-[10px] font-bold text-slate-500 uppercase">equipos</span>
            </div>

            <div className="flex items-center gap-3 mt-3 text-[10px] font-bold">
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                ✓ {techAidsDelivered} Entregadas
              </span>
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                ⏳ {techAidsPending} En Espera
              </span>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold mt-2 uppercase tracking-tight flex items-center justify-between">
              <span>Sillas, andaderas, bastones y soportes</span>
              <span className="font-bold underline text-cyan-800">Ver nómina →</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Cobertura Territorial Activa de Sotillo (Estricto Base 21) */}
        <Card className="bg-white rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <MapPin className="w-16 h-16 text-blue-900" />
          </div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">
                Cobertura Sotillo
              </span>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
                21 Comunas
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-blue-950">
                {activeCommunesCount}
                <span className="text-sm text-slate-400 font-bold"> / {totalCommunesCount}</span>
              </h3>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                ({coveragePercent}%)
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${coveragePercent}%` }}
              ></div>
            </div>

            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tight">
              {sotilloWorkersInView.length} ciudadanos de Sotillo
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Atención Solidaria Foránea (Extramunicipal) */}
        <Card 
          className="bg-white rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
          onClick={() => setSelectedCommune(OTHER_COMMUNE_OPTION)}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Compass className="w-16 h-16 text-amber-900" />
          </div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                Atención Foránea
              </span>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                Extramunicipal
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-amber-950">{foreignWorkersInView.length}</h3>
              <span className="text-[10px] font-bold text-slate-500 uppercase">ciudadanos</span>
            </div>

            <div className="flex items-center gap-2 mt-3 text-[10px] font-bold">
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                ✓ {foreignDeliveredCount} Despachos
              </span>
              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {foreignRecipesInView.length} Solicitudes
              </span>
            </div>

            <p className="text-[10px] text-amber-700 font-semibold mt-2 uppercase tracking-tight flex items-center justify-between">
              <span>Otros municipios</span>
              <span className="font-bold underline text-amber-800">Ver censo →</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Atención a Población Vulnerable */}
        <Card className="bg-white rounded-2xl border border-purple-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-16 h-16 text-purple-900" />
          </div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider">
                Atención Vulnerable
              </span>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-900">
                Prioridad
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-purple-950">{vulnerableCount}</h3>
              <span className="text-[10px] font-bold text-slate-500 uppercase">casos</span>
            </div>

            <div className="flex items-center gap-2 mt-3 text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
              <Accessibility className="w-3 h-3 text-purple-600" />
              <span>{disabilityCount} con Discapacidad</span>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold mt-2 uppercase tracking-tight">
              Soporte y expediente social activo
            </p>
          </CardContent>
        </Card>

      </div>

      {/* 4 Categorías Especializadas de Farmacia y Asistencias Sociales */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Pill className="w-4 h-4 text-emerald-600" />
              Ayudas y Despachos por Categoría de Farmacia
            </h2>
            <p className="text-[11px] text-slate-500">
              Monitoreo sectorizado de requerimientos sociales. Haga clic en cualquiera de las 4 categorías para ver la nómina detallada de personas y entregas.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border-slate-300 w-fit">
            4 Categorías Oficiales • Clic para Explorar Nómina
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {/* Categoría 1: Fármacos y Tratamientos Médicos */}
          <Card 
            className="bg-white rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden group hover:border-emerald-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            onClick={() => setSelectedCategoryModal('medication')}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
              <Pill className="w-16 h-16 text-emerald-900" />
            </div>
            <CardContent className="p-5 md:p-5.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-emerald-600" />
                  Fármacos y Tratamientos
                </span>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Medicinas
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl md:text-4xl font-black text-emerald-950">
                  {categoryStats.medication.deliveredUnits.toLocaleString()}
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">unid. despachadas</span>
              </div>

              {/* Badges de Entregadas y En Espera */}
              <div className="flex items-center gap-2 mt-3 text-[10px] font-bold">
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ✓ {categoryStats.medication.delivered} Despachos
                </span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  ⏳ {categoryStats.medication.pending} En Espera
                </span>
              </div>

              {/* Progress Bar de efectividad en la categoría */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${categoryStats.medication.total > 0 ? Math.min(100, Math.round((categoryStats.medication.delivered / categoryStats.medication.total) * 100)) : 0}%`
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                <span className="font-semibold text-slate-500">{categoryStats.medication.patientCount} personas atendidas ({categoryStats.medication.total} sol.)</span>
                <span className="font-black text-emerald-700 group-hover:underline flex items-center gap-0.5">
                  Ver personas →
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Categoría 2: Ayudas Humanas y Movilidad */}
          <Card 
            className="bg-white rounded-2xl border border-cyan-200 shadow-sm relative overflow-hidden group hover:border-cyan-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            onClick={() => setSelectedCategoryModal('technical_aid')}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
              <Accessibility className="w-16 h-16 text-cyan-900" />
            </div>
            <CardContent className="p-5 md:p-5.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Accessibility className="w-3.5 h-3.5 text-cyan-600" />
                  Ayudas Humanas
                </span>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                  Movilidad
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl md:text-4xl font-black text-cyan-950">
                  {categoryStats.technical_aid.deliveredUnits.toLocaleString()}
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">equipos asignados</span>
              </div>

              {/* Badges de Entregadas y En Espera */}
              <div className="flex items-center gap-2 mt-3 text-[10px] font-bold">
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ✓ {categoryStats.technical_aid.delivered} Despachos
                </span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  ⏳ {categoryStats.technical_aid.pending} En Espera
                </span>
              </div>

              {/* Progress Bar de efectividad en la categoría */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-cyan-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${categoryStats.technical_aid.total > 0 ? Math.min(100, Math.round((categoryStats.technical_aid.delivered / categoryStats.technical_aid.total) * 100)) : 0}%`
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                <span className="font-semibold text-slate-500">{categoryStats.technical_aid.patientCount} personas ({categoryStats.technical_aid.total} sol.)</span>
                <span className="font-black text-cyan-700 group-hover:underline flex items-center gap-0.5">
                  Ver personas →
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Categoría 3: Insumos y Ayuda Social (Englobando Insumos, Aportes Monetarios y Comida) */}
          <Card 
            className="bg-white rounded-2xl border border-indigo-200 shadow-sm relative overflow-hidden group hover:border-indigo-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            onClick={() => setSelectedCategoryModal('medical_supply')}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
              <Package className="w-16 h-16 text-indigo-900" />
            </div>
            <CardContent className="p-5 md:p-5.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  Insumo Médico - Social
                </span>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Insumos • $ / Bs • Alimentos
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl md:text-4xl font-black text-indigo-950">
                  {categoryStats.medical_supply.deliveredUnits.toLocaleString()}
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">insumos entregados</span>
              </div>

              {/* Badges de Entregadas y En Espera */}
              <div className="flex items-center gap-2 mt-3 text-[10px] font-bold">
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ✓ {categoryStats.medical_supply.delivered} Despachos
                </span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  ⏳ {categoryStats.medical_supply.pending} En Espera
                </span>
              </div>

              {/* Sub-indicadores de Aportes Monetarios y Bolsas de Comida */}
              <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-indigo-100/70 text-[10px] font-bold">
                <div className="bg-emerald-50/80 text-emerald-900 border border-emerald-200 px-2 py-1 rounded-lg">
                  <span className="text-[9px] text-emerald-700 uppercase block font-black">💵 Aportes $ / Bs</span>
                  <span className="truncate block font-black text-[11px]">
                    {categoryStats.medical_supply.economicUSD > 0 ? `$ ${categoryStats.medical_supply.economicUSD.toLocaleString('es-VE')}` : ''}
                    {categoryStats.medical_supply.economicVES > 0 ? ` Bs. ${categoryStats.medical_supply.economicVES.toLocaleString('es-VE')}` : ''}
                    {categoryStats.medical_supply.economicUSD === 0 && categoryStats.medical_supply.economicVES === 0 ? '$ 0' : ''}
                  </span>
                </div>
                <div className="bg-amber-50/80 text-amber-900 border border-amber-200 px-2 py-1 rounded-lg">
                  <span className="text-[9px] text-amber-700 uppercase block font-black">🥫 Bolsas Comida</span>
                  <span className="font-black text-[11px] block">
                    {categoryStats.medical_supply.foodBagsTotal} bolsas
                  </span>
                </div>
              </div>

              {/* Progress Bar de efectividad en la categoría */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${categoryStats.medical_supply.total > 0 ? Math.min(100, Math.round((categoryStats.medical_supply.delivered / categoryStats.medical_supply.total) * 100)) : 0}%`
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                <span className="font-semibold text-slate-500">{categoryStats.medical_supply.patientCount} personas atendidas ({categoryStats.medical_supply.total} sol.)</span>
                <span className="font-black text-indigo-700 group-hover:underline flex items-center gap-0.5">
                  Ver personas →
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Categoría 4: Derivación y Consultas Especializadas */}
          <Card 
            className="bg-white rounded-2xl border border-purple-200 shadow-sm relative overflow-hidden group hover:border-purple-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            onClick={() => setSelectedCategoryModal('medical_derivation')}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-16 h-16 text-purple-900" />
            </div>
            <CardContent className="p-5 md:p-5.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-purple-600" />
                  Derivación Médica
                </span>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  Consultas
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl md:text-4xl font-black text-purple-950">
                  {categoryStats.medical_derivation.deliveredUnits.toLocaleString()}
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">atenciones gestionadas</span>
              </div>

              {/* Badges de Entregadas y En Espera */}
              <div className="flex items-center gap-2 mt-3 text-[10px] font-bold">
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ✓ {categoryStats.medical_derivation.delivered} Gestionadas
                </span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  ⏳ {categoryStats.medical_derivation.pending} En Espera
                </span>
              </div>

              {/* Progress Bar de efectividad en la categoría */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${categoryStats.medical_derivation.total > 0 ? Math.min(100, Math.round((categoryStats.medical_derivation.delivered / categoryStats.medical_derivation.total) * 100)) : 0}%`
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                <span className="font-semibold text-slate-500">{categoryStats.medical_derivation.patientCount} personas atendidas ({categoryStats.medical_derivation.total} sol.)</span>
                <span className="font-black text-purple-700 group-hover:underline flex items-center gap-0.5">
                  Ver personas →
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Bloque Estratégico Central: Demanda Territorial vs Top de Recursos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Ranking de Presión Territorial por Comuna (2/3 de ancho) */}
        <Card className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/60">
            <div>
              <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Demanda y Cobertura Territorial por Comunas
              </CardTitle>
              <CardDescription className="text-[11px] mt-0.5 text-slate-500">
                Presión social y solicitudes acumuladas. Haga clic en una barra para abrir el censo comunitario.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border-blue-200">
              Top 7 Zonas
            </Badge>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBarData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#1e293b', fontWeight: 'bold' }} 
                    width={130} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="total" 
                    radius={[0, 6, 6, 0]} 
                    barSize={22}
                    className="cursor-pointer"
                    onClick={(data: any) => {
                      if (data && data.name) {
                        setSelectedCommune(data.name);
                      }
                    }}
                  >
                    {topBarData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? '#1e3a8a' : index === 1 ? '#2563eb' : '#3b82f6'} 
                        className="hover:opacity-80 transition-opacity cursor-pointer" 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Acceso Directo Comuna de Mayor Demanda */}
            <div 
              className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center bg-blue-50/60 hover:bg-blue-100/60 transition-colors rounded-xl p-4 cursor-pointer group"
              onClick={() => topBarData[0]?.name && setSelectedCommune(topBarData[0].name)}
            >
              <div>
                <p className="text-[10px] font-black text-blue-900 uppercase flex items-center gap-1.5">
                  Comuna con Mayor Demanda Social (Sotillo)
                  <span className="text-[10px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    (Clic para ver censo de pacientes →)
                  </span>
                </p>
                <p className="text-lg font-black text-blue-950 uppercase group-hover:text-blue-700 transition-colors">
                  {topBarData[0]?.name || '---'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-blue-900 uppercase">Solicitudes</p>
                <p className="text-xl font-black text-blue-950">{topBarData[0]?.total || 0}</p>
              </div>
            </div>

            {/* Módulo Especial de Gestión Extramunicipal / Atención Foránea */}
            <div 
              className="mt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 transition-colors rounded-xl p-3.5 cursor-pointer group"
              onClick={() => setSelectedCommune(OTHER_COMMUNE_OPTION)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-900 uppercase flex items-center gap-1.5">
                    Atención Solidaria Extramunicipal (Fuera de Sotillo)
                    <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      (Ver censo foráneo →)
                    </span>
                  </p>
                  <p className="text-xs text-amber-800 font-medium">
                    {foreignWorkersInView.length} ciudadanos censados de otros municipios ({foreignRecipesInView.length} solicitudes gestionadas)
                  </p>
                </div>
              </div>
              <div className="mt-2 sm:mt-0 flex items-center gap-2 text-right">
                <span className="text-xs font-black text-amber-950 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                  {foreignDeliveredCount} Despachados
                </span>
                <span className="text-[11px] font-bold text-amber-800 underline group-hover:text-amber-950">
                  Ver detalle →
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Columna Derecha: Top de Recursos y Balance de Suministros (1/3 de ancho) */}
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Recursos de Mayor Demanda
              </CardTitle>
            </div>
            
            {/* Tab switch between Tech Aids and Meds */}
            <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-1 rounded-xl">
              <button
                onClick={() => setResourceTab('technical_aids')}
                className={`text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                  resourceTab === 'technical_aids'
                    ? 'bg-white text-blue-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ♿ Ayudas Humanas
              </button>
              <button
                onClick={() => setResourceTab('medications')}
                className={`text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                  resourceTab === 'medications'
                    ? 'bg-white text-blue-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💊 Farmacia
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              {resourceTab === 'technical_aids' ? (
                topTechAids.length > 0 ? (
                  topTechAids.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase mb-1">
                        <span className="truncate pr-2">{item.name}</span>
                        <span className="font-black text-blue-900">{item.count} <span className="text-[9px] text-slate-400">UDS</span></span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-cyan-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, (item.count / (topTechAids[0]?.count || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-slate-400 py-6 text-center">No hay registros de ayudas humanas en el filtro.</p>
                )
              ) : (
                topMeds.length > 0 ? (
                  topMeds.map((med, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase mb-1">
                        <span className="truncate pr-2">{med.name}</span>
                        <span className="font-black text-emerald-800">{med.count} <span className="text-[9px] text-slate-400">UDS</span></span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, (med.count / (topMeds[0]?.count || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-slate-400 py-6 text-center">No hay medicamentos registrados en el filtro.</p>
                )
              )}
            </div>

            {/* Smart Procurement Alert */}
            <div className="pt-2">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-amber-950 uppercase">Proyección de Reabastecimiento</p>
                  <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                    {pendingRequests > 0 
                      ? `Existen ${pendingRequests} solicitudes en cola. Priorizar adquisición de ${resourceTab === 'technical_aids' ? 'sillas y andaderas' : 'antihipertensivos e insumos'}.`
                      : 'Stock suficiente para atender la demanda actual sin requerimientos críticos pendientes.'}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => navigate('/medications')}
                className="w-full mt-3 bg-slate-900 hover:bg-slate-950 text-white font-bold h-9 uppercase text-xs tracking-wider rounded-xl cursor-pointer"
              >
                Ir al Módulo de Farmacia y Despacho →
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 5. Semáforo de Urgencias y Casos Prioritarios en Espera */}
      <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${pendingItems.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                Semáforo de Casos Prioritarios y Solicitudes en Espera
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Monitoreo continuo para evitar cuellos de botella y garantizar respuesta oportuna al ciudadano.
            </CardDescription>
          </div>

          {/* Filter chips inside alerts */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: `Todos (${pendingItems.length})` },
                { id: 'urgent', label: '🚨 Urgentes / >15 Días' },
                { id: 'technical_aids', label: '♿ Solo Ayudas Humanas' },
                { id: 'medications', label: '💊 Solo Farmacia' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPendingFilter(p.id)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  pendingFilter === p.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {pendingItems.length === 0 ? (
            <div className="p-8 text-center space-y-2 bg-emerald-50/30">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-black text-emerald-900 uppercase">
                ¡Atención Al Día!
              </p>
              <p className="text-xs text-emerald-700 max-w-md mx-auto font-medium">
                No existen solicitudes pendientes bajo los filtros seleccionados. Todos los requerimientos se encuentran formalmente despachados y entregados.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingItems.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-slate-900 uppercase">
                        {item.citizenName}
                      </p>
                      <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                        C.I: {item.citizenDni}
                      </Badge>
                      {item.isUrgent && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-[9px] font-black uppercase">
                          Atención Urgente
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                      <span className="font-semibold text-blue-900 uppercase">📍 {item.commune}</span>
                      <span>•</span>
                      <span>Sector: {item.sector}</span>
                      {item.phone && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><Phone className="w-3 h-3 text-slate-400" /> {item.phone}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Resource & Time waiting */}
                  <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                    <div className="text-left md:text-right">
                      <p className="text-xs font-black text-slate-900 uppercase">
                        {item.item}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">
                        {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'} ({item.categoryLabel})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full ${
                        item.daysWaiting > 15
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {item.daysWaiting === 0 ? 'Registrado hoy' : `${item.daysWaiting} días en espera`}
                      </span>
                    </div>

                    {/* View Dossier Action */}
                    {item.associatedWorker && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedWorkerForExpediente(item.associatedWorker || null)}
                        className="h-8 px-2.5 text-[11px] font-bold border-slate-200 hover:bg-blue-50 hover:text-blue-900 cursor-pointer rounded-lg shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-blue-600" />
                        Ver Ficha
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingItems.length > 10 && (
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <Button
                variant="link"
                onClick={() => navigate('/medications')}
                className="text-xs font-bold text-blue-800 cursor-pointer"
              >
                Ver los {pendingItems.length} casos en espera en el módulo de entregas →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Barra de Acciones Ejecutivas y Descargas (Al final de la página) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="text-sm font-black text-blue-950 uppercase tracking-tight">
            Acciones Ejecutivas y Reportes
          </h4>
          <p className="text-xs text-slate-500 font-medium">
            Generación de documentación oficial, exportación de bases de datos y administración del censo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          <Button
            onClick={() => setIsReportModalOpen(true)}
            className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs uppercase px-4 h-10 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimir Informe Ejecutivo
          </Button>

          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase px-4 h-10 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Exportar Excel
          </Button>

          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={handleResetDatabase}
              className="bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300 text-red-700 font-black text-[11px] uppercase tracking-wider h-10 px-3.5 rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              title="Borrado integral del censo (Exclusivo Super Administrador)"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              Reiniciar Censo
            </Button>
          )}
        </div>
      </div>

      {/* Modal de Detalle Territorial */}
      <CommunePatientsModal
        commune={selectedCommune}
        isOpen={!!selectedCommune}
        onClose={() => setSelectedCommune(null)}
        workers={workers}
      />

      {/* Modal de Expediente Individual del Ciudadano */}
      {selectedWorkerForExpediente && (
        <Dialog
          open={!!selectedWorkerForExpediente}
          onOpenChange={(open) => !open && setSelectedWorkerForExpediente(null)}
        >
          <DialogContent className="w-[98vw] sm:w-[98vw] max-w-[98vw] xl:max-w-[1600px] sm:max-w-[98vw] h-[95vh] max-h-[96vh] overflow-y-auto p-0 border-none shadow-2xl bg-white z-[60] rounded-2xl">
            <WorkerExpediente
              worker={selectedWorkerForExpediente}
              onClose={() => setSelectedWorkerForExpediente(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Informe Ejecutivo para Impresión / PDF */}
      <ExecutiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        timeFilterLabel={timeFilterLabel}
        communeFilterLabel={communeFilterLabel}
        metrics={{
          totalWorkers: filteredWorkers.length,
          totalRequests,
          deliveredRequests,
          pendingRequests,
          complianceRate,
          techAidsTotal,
          techAidsDelivered,
          techAidsPending,
          medicationsTotal,
          medicationsDelivered,
          medicationsPending,
          vulnerableCount,
          disabilityCount,
          activeCommunesCount,
        }}
        communeRanking={communeRanking}
        pendingList={pendingItems}
        workers={workers}
        recipes={categoryStats.baseRecipes}
      />

      {/* Modal de Detalle y Nómina de Pacientes por Categoría de Farmacia */}
      <CategoryPatientsModal
        category={selectedCategoryModal}
        isOpen={!!selectedCategoryModal}
        onClose={() => setSelectedCategoryModal(null)}
        recipes={categoryStats.baseRecipes}
        workers={workers}
      />

    </div>
  );
}
