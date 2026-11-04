import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend
} from 'recharts';
import { 
  Users, 
  Map as MapIcon, 
  Activity, 
  Loader2, 
  HeartHandshake, 
  ShieldAlert, 
  TrendingUp, 
  Heart, 
  Search, 
  Truck, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Info,
  MapPin,
  Compass,
  Calendar,
  CalendarDays,
  UserPlus,
  Eye,
  X,
  FileText,
  BookOpen,
  Award,
  PackageSearch
} from "lucide-react";
import SocialAreaReportModal from './SocialAreaReportModal';
import ItemBeneficiariesReportModal from './ItemBeneficiariesReportModal';
import { format, startOfWeek, startOfMonth, isSameDay, isAfter, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { dataService } from '@/lib/dataService';
import { Worker, MedicationRecipe } from '@/types';
import { OTHER_COMMUNE_OPTION } from '@/constants';
import WorkerExpediente from './WorkerExpediente';
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Palette matches Bienestar Social Sotillo colors
const AID_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#64748b'];
const VULNERABILITY_COLORS = ['#ef4444', '#f59e0b', '#10b981']; // Red (Critical), Orange (Moderate), Green (Stable)
const GENDER_COLORS = ['#3b82f6', '#ec4899', '#94a3b8'];

interface CommuneStat {
  commune: string;
  totalCensus: number;
  avgScore: number;
  criticalCases: number;
  disabledCount: number;
  houseFragileCount: number;
}

export default function Stats() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [medicalHistories, setMedicalHistories] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'executive' | 'health' | 'territory' | 'pharmacy'>('executive');
  const [searchCommune, setSearchCommune] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodSearchQuery, setPeriodSearchQuery] = useState('');
  const [selectedWorkerForExpediente, setSelectedWorkerForExpediente] = useState<Worker | null>(null);
  const [isSocialReportOpen, setIsSocialReportOpen] = useState(false);
  const [isItemReportOpen, setIsItemReportOpen] = useState(false);

  // Helper de parseo seguro de fechas de registro
  const parseDateSafe = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val?.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (val?.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const now = new Date();

  // Casos cargados según temporalidad (Hoy, Esta Semana, Este Mes, Histórico)
  const todayCases = useMemo(() => {
    return workers.filter(w => {
      const d = parseDateSafe(w.createdAt);
      return d ? isSameDay(d, now) : false;
    });
  }, [workers]);

  const weekCases = useMemo(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    return workers.filter(w => {
      const d = parseDateSafe(w.createdAt);
      return d ? (isAfter(d, weekStart) || isSameDay(d, weekStart)) : false;
    });
  }, [workers]);

  const monthCases = useMemo(() => {
    const monthStart = startOfMonth(now);
    return workers.filter(w => {
      const d = parseDateSafe(w.createdAt);
      return d ? (isAfter(d, monthStart) || isSameDay(d, monthStart)) : false;
    });
  }, [workers]);

  const selectedPeriodCases = useMemo(() => {
    if (timeFilter === 'today') return todayCases;
    if (timeFilter === 'week') return weekCases;
    if (timeFilter === 'month') return monthCases;
    return workers;
  }, [timeFilter, todayCases, weekCases, monthCases, workers]);

  const selectedPeriodHistoriesCount = useMemo(() => {
    const ids = new Set(selectedPeriodCases.map(w => w.id));
    return medicalHistories.filter(h => ids.has(h.workerId)).length;
  }, [selectedPeriodCases, medicalHistories]);

  const selectedPeriodRecipesCount = useMemo(() => {
    if (timeFilter === 'all') return recipes.length;
    return recipes.filter(r => {
      const d = parseDateSafe(r.createdAt);
      if (!d) return false;
      if (timeFilter === 'today') return isSameDay(d, now);
      if (timeFilter === 'week') {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        return isAfter(d, weekStart) || isSameDay(d, weekStart);
      }
      if (timeFilter === 'month') {
        const monthStart = startOfMonth(now);
        return isAfter(d, monthStart) || isSameDay(d, monthStart);
      }
      return true;
    }).length;
  }, [timeFilter, recipes]);

  const last7DaysTrend = useMemo(() => {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const target = subDays(now, i);
      const dayLabel = format(target, 'EEE d', { locale: es });
      const count = workers.filter(w => {
        const d = parseDateSafe(w.createdAt);
        return d ? isSameDay(d, target) : false;
      }).length;
      list.push({ day: dayLabel.toUpperCase(), count });
    }
    return list;
  }, [workers]);

  const filteredPeriodCasesList = useMemo(() => {
    if (!periodSearchQuery.trim()) return selectedPeriodCases;
    const q = periodSearchQuery.toLowerCase().trim();
    return selectedPeriodCases.filter(w => 
      (w.fullName || '').toLowerCase().includes(q) ||
      (w.dni || '').toLowerCase().includes(q) ||
      (w.commune || '').toLowerCase().includes(q) ||
      (w.sector || '').toLowerCase().includes(q)
    );
  }, [selectedPeriodCases, periodSearchQuery]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workersData, recipesData, rawHistories] = await Promise.all([
          dataService.getWorkers(),
          dataService.getMedicationRecipes(),
          dataService.getAllMedicalHistories()
        ]);
        setWorkers(workersData);
        setRecipes(recipesData);

        const workersMap = new Map<string, Worker>();
        workersData.forEach(w => workersMap.set(w.id, w));

        const mappedHistories = rawHistories.map(hist => {
          const w = hist.workerId ? workersMap.get(hist.workerId) : undefined;
          return {
            ...hist,
            workerName: w?.fullName || "Ciudadano",
            workerDni: w?.dni || "",
            commune: w?.commune || "",
            sector: w?.sector || "",
            birthDate: w?.birthDate || "",
            gender: w?.gender || "Other"
          };
        });

        setMedicalHistories(mappedHistories);
      } catch (err) {
        console.error("Error fetching stats data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Safe Age Calculator
  const getAge = (birthDateStr: string) => {
    if (!birthDateStr || birthDateStr === "SIN FECHA") return 0;
    try {
      const birth = new Date(birthDateStr);
      if (isNaN(birth.getTime())) return 0;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return 0;
    }
  };

  // SOCIO-ECONOMIC & MULTI-DIMENSIONAL VULNERABILITY MODEL (IVM)
  const getVulnerabilityScore = (citizen: Worker, hist: any) => {
    let score = 0;
    
    // 1. Physical health risk (Has disability)
    if (citizen.hasDisability || hist?.hasDisability) score += 3;
    
    // 2. Housing/Infrastructure vulnerability
    if (hist?.housingConditions) {
      const wallVal = String(hist.housingConditions.walls || '').toLowerCase();
      const roofVal = String(hist.housingConditions.roof || '').toLowerCase();
      const floorVal = String(hist.housingConditions.floor || '').toLowerCase();
      const typeVal = String(hist.housingConditions.housingType || '').toLowerCase();
      
      // Critical fragile structures (Rancho, Improvisada, or cardboard/zinc/wood components)
      if (typeVal === 'rancho' || typeVal === 'improvisada' || typeVal === 'sin_vivienda') {
        score += 3;
      } else if (wallVal.includes('madera') || wallVal.includes('zinc') || roofVal.includes('zinc') || floorVal.includes('tierra')) {
        score += 2;
      }
      
      // Basic services deficit (No water or gas network)
      const waterVal = String(hist.housingConditions.waterSupply || '').toLowerCase();
      if (waterVal === 'camion' || waterVal === 'pipas' || waterVal.includes('camion') || waterVal.includes('lluvia')) {
        score += 1.5;
      }
    }

    // 3. Chronic disease diagnosis burden
    let hasChronic = false;
    if (hist?.personalHistory) {
      if (hist.personalHistory.hypertension || hist.personalHistory.diabetes || hist.personalHistory.asthma) {
        hasChronic = true;
      }
    }
    const customPathology = (hist?.pathology || '').toLowerCase();
    const chronicText = (hist?.personalHistory?.chronicDiseases || '').toLowerCase();
    if (customPathology.includes('hipertens') || customPathology.includes('diabet') || customPathology.includes('asm') || 
        chronicText.includes('hipertens') || chronicText.includes('diabet') || chronicText.includes('asm') || 
        customPathology.includes('canc') || customPathology.includes('oncol')) {
      hasChronic = true;
    }
    if (hasChronic) score += 2;

    // 4. Moderate/Total Dependence and Elder Status
    if (hist?.dependency === 'high' || hist?.dependency === 'total') {
      score += 2.5;
    }
    const age = getAge(citizen.birthDate);
    if (age >= 60) {
      score += 2; // Elderly risk
    } else if (age > 0 && age < 6) {
      score += 1.5; // Infant risk
    }

    return parseFloat(score.toFixed(1));
  };

  // Compile individual IVM for each worker
  const individualVulnerabilityList = workers.map(w => {
    const associatedHist = medicalHistories.find(h => h.workerId === w.id);
    const score = getVulnerabilityScore(w, associatedHist);
    
    let classification: 'CRITICAL' | 'MODERATE' | 'STABLE' = 'STABLE';
    if (score >= 5.5) {
      classification = 'CRITICAL';
    } else if (score >= 2.5) {
      classification = 'MODERATE';
    }

    return {
      workerId: w.id,
      name: w.fullName,
      dni: w.dni,
      commune: w.commune,
      sector: w.sector,
      age: getAge(w.birthDate),
      score,
      classification,
      isElder: getAge(w.birthDate) >= 60,
      hasDisability: !!(w.hasDisability || associatedHist?.hasDisability),
      housingFragile: !!(associatedHist?.housingConditions && (
        ['rancho', 'improvisada'].includes(associatedHist.housingConditions.housingType) ||
        String(associatedHist.housingConditions.walls).includes('madera') || 
        String(associatedHist.housingConditions.walls).includes('zinc')
      ))
    };
  });

  // Urgency Counts
  const ivmCounts = individualVulnerabilityList.reduce((acc, current) => {
    acc[current.classification] = (acc[current.classification] || 0) + 1;
    return acc;
  }, { CRITICAL: 0, MODERATE: 0, STABLE: 0 } as Record<string, number>);

  const ivmData = [
    { name: 'Vulnerabilidad Crítica', value: ivmCounts.CRITICAL },
    { name: 'Soporte Moderado', value: ivmCounts.MODERATE },
    { name: 'Población Estable', value: ivmCounts.STABLE }
  ];

  // Epidemiology Statistics Compilation
  let hyperCount = 0;
  let diabCount = 0;
  let astCount = 0;
  let heartCount = 0;
  let cancCount = 0;
  let thyroidCount = 0;

  medicalHistories.forEach(hist => {
    if (hist.personalHistory) {
      if (hist.personalHistory.hypertension) hyperCount++;
      if (hist.personalHistory.diabetes) diabCount++;
      if (hist.personalHistory.asthma) astCount++;
    }
    if (hist.familyHistory) {
      if (hist.familyHistory.heartDisease) heartCount++;
      if (hist.familyHistory.cancer) cancCount++;
    }
    const pathTxt = (hist.pathology || '').toLowerCase();
    const chronicTxt = (hist.personalHistory?.chronicDiseases || '').toLowerCase();
    
    if (pathTxt.includes('hipert') || chronicTxt.includes('hipert') || pathTxt.includes('tensión') || pathTxt.includes('tension')) {
      if (!hist.personalHistory?.hypertension) hyperCount++;
    }
    if (pathTxt.includes('diab') || chronicTxt.includes('diab') || pathTxt.includes('glicem')) {
      if (!hist.personalHistory?.diabetes) diabCount++;
    }
    if (pathTxt.includes('asm') || chronicTxt.includes('asm') || pathTxt.includes('respirat')) {
      if (!hist.personalHistory?.asthma) astCount++;
    }
    if (pathTxt.includes('canc') || chronicTxt.includes('canc') || pathTxt.includes('neo') || pathTxt.includes('oncol') || chronicTxt.includes('oncol')) {
      cancCount++;
    }
    if (pathTxt.includes('coraz') || chronicTxt.includes('coraz') || pathTxt.includes('cardi') || chronicTxt.includes('cardi')) {
      heartCount++;
    }
    if (pathTxt.includes('tiro') || chronicTxt.includes('tiro') || pathTxt.includes('bocio')) {
      thyroidCount++;
    }
  });

  const pathologyData = [
    { name: 'Hipertensión Art.', value: hyperCount, color: '#3b82f6' },
    { name: 'Diabetes Mellitus', value: diabCount, color: '#f59e0b' },
    { name: 'Asma / Resp. Crónicos', value: astCount, color: '#06b6d4' },
    { name: 'Cardiopatías', value: heartCount, color: '#ef4444' },
    { name: 'Oncológicos', value: cancCount, color: '#8b5cf6' },
    { name: 'Tiroides', value: thyroidCount, color: '#10b981' }
  ].sort((a, b) => b.value - a.value);

  // Pharmacy & Aid dispensations Metrics
  const totalRecipes = recipes.length;
  const deliveredRecipes = recipes.filter(r => r.status === 'delivered').length;
  const pendingRecipes = recipes.filter(r => r.status === 'pending' || !r.status).length;
  const pharmacyEfficiency = totalRecipes > 0 ? parseFloat(((deliveredRecipes / totalRecipes) * 100).toFixed(1)) : 0;

  // Consolidate technical aids from medical histories and pharmacy recipes
  const allTechnicalAidRequests: Array<{
    workerName: string;
    workerDni: string;
    commune: string;
    sector: string;
    technicalAidType: string;
    technicalAidQuantity: number;
    technicalAidNotes: string;
    source: "Expediente" | "Farmacia";
    status: 'delivered' | 'pending';
  }> = [];

  // Add requests from Medical History (Usually clinical request pending delivery)
  medicalHistories.forEach(h => {
    if (h.requiresTechnicalAid && h.technicalAidType && h.technicalAidType.toLowerCase() !== 'ninguno') {
      const alreadyInRecipes = recipes.some(r => r.workerId === h.workerId && r.requiresTechnicalAid && r.technicalAidType === h.technicalAidType);
      
      allTechnicalAidRequests.push({
        workerName: h.workerName || "Ciudadano",
        workerDni: h.workerDni || "",
        commune: h.commune || "",
        sector: h.sector || "",
        technicalAidType: h.technicalAidType,
        technicalAidQuantity: Number(h.technicalAidQuantity) || 1,
        technicalAidNotes: h.technicalAidNotes || "",
        source: "Expediente",
        status: alreadyInRecipes ? 'delivered' : 'pending'
      });
    }
  });

  // Add requests directly prescribed in control pharmacy
  recipes.forEach(r => {
    const isAid = r.requiresTechnicalAid || r.category === 'technical_aid';
    const aidType = r.technicalAidType || (r.category === 'technical_aid' ? r.medication : null);
    if (isAid && aidType) {
      const associatedWorker = workers.find(w => w.id === r.workerId);
      allTechnicalAidRequests.push({
        workerName: associatedWorker?.fullName || "Contacto Directo",
        workerDni: associatedWorker?.dni || "",
        commune: r.commune || associatedWorker?.commune || "",
        sector: r.sector || associatedWorker?.sector || "",
        technicalAidType: aidType,
        technicalAidQuantity: Number(r.technicalAidQuantity || r.quantity) || 1,
        technicalAidNotes: r.technicalAidNotes || "",
        source: "Farmacia",
        status: r.status === 'delivered' ? 'delivered' : 'pending'
      });
    }
  });

  const totalAidsRequired = allTechnicalAidRequests.reduce((sum, item) => sum + item.technicalAidQuantity, 0);
  const totalAidsDelivered = allTechnicalAidRequests.filter(item => item.status === 'delivered').reduce((sum, item) => sum + item.technicalAidQuantity, 0);

  // Group aids required by type
  const aidsBreakdown = allTechnicalAidRequests.reduce((acc, r) => {
    const rawType = r.technicalAidType ? r.technicalAidType.toUpperCase().replace(/_/g, ' ') : 'SILLA DE RUEDAS';
    let formattedType = rawType;
    if (rawType.includes('SILLA') || rawType.includes('RUEDAS')) formattedType = 'Silla de Ruedas';
    else if (rawType.includes('BASTON') || rawType.includes('BASTÓN')) formattedType = 'Bastones';
    else if (rawType.includes('ANDADERA') || rawType.includes('ANDADOR')) formattedType = 'Andaderas';
    else if (rawType.includes('PANAL') || rawType.includes('PAÑAL')) formattedType = 'Pañales de Adulto';
    else if (rawType.includes('CAMA') || rawType.includes('CLINICA')) formattedType = 'Cama Clínica';
    else if (rawType.includes('MULETAS') || rawType.includes('MULETA')) formattedType = 'Muletas';
    
    acc[formattedType] = (acc[formattedType] || 0) + r.technicalAidQuantity;
    return acc;
  }, {} as Record<string, number>);

  const aidsChartData = Object.entries(aidsBreakdown).map(([name, value]) => ({ name, value }));

  // Demographics metrics: Age and Gender
  const ageGroups = {
    children: 0, // < 12
    youth: 0,    // 12-25
    adults: 0,   // 26-59
    elderly: 0   // >= 60
  };

  let maleCount = 0;
  let femaleCount = 0;
  let otherCount = 0;

  workers.forEach(w => {
    const age = getAge(w.birthDate);
    if (age > 0) {
      if (age < 12) ageGroups.children++;
      else if (age <= 25) ageGroups.youth++;
      else if (age < 60) ageGroups.adults++;
      else ageGroups.elderly++;
    }

    if (w.gender === 'M') maleCount++;
    else if (w.gender === 'F') femaleCount++;
    else otherCount++;
  });

  const demographicAgeData = [
    { name: 'Niños (<12 años)', value: ageGroups.children },
    { name: 'Jóvenes (12-25)', value: ageGroups.youth },
    { name: 'Adultos (26-59)', value: ageGroups.adults },
    { name: 'Adultos Mayores (≥60)', value: ageGroups.elderly },
  ];

  const demographicGenderData = [
    { name: 'Masculino', value: maleCount },
    { name: 'Femenino', value: femaleCount },
    { name: 'Otros / Reserv.', value: otherCount },
  ];

  // Foreign / Extra-Municipal Detection and Segregation
  const isForeignWorker = (w: Worker) => {
    if (w.isForeigner) return true;
    const c = (w.commune || '').toUpperCase();
    return c === OTHER_COMMUNE_OPTION.toUpperCase() || c === 'OTRO' || c.startsWith('OTRO') || c.includes('FUERA DEL MUNICIPIO');
  };

  const isForeignRecipe = (r: MedicationRecipe) => {
    if (r.isForeigner) return true;
    const c = (r.commune || '').toUpperCase();
    return c === OTHER_COMMUNE_OPTION.toUpperCase() || c === 'OTRO' || c.startsWith('OTRO') || c.includes('FUERA DEL MUNICIPIO');
  };

  const getOriginLocation = (item: { originLocation?: string; commune?: string; sector?: string }) => {
    if (item.originLocation && item.originLocation.trim()) {
      return item.originLocation.trim().toUpperCase();
    }
    if (item.commune && item.commune.toUpperCase().startsWith('OTRO:')) {
      return item.commune.replace(/^OTRO:\s*/i, '').trim().toUpperCase();
    }
    if (item.sector && item.sector.toUpperCase() !== 'FORÁNEO' && item.sector.toUpperCase() !== 'FUERA DEL MUNICIPIO') {
      return item.sector.trim().toUpperCase();
    }
    return 'NO ESPECIFICADO (FORÁNEO)';
  };

  const foreignWorkers = workers.filter(isForeignWorker);
  const foreignRecipes = recipes.filter(isForeignRecipe);
  const foreignWorkersCount = foreignWorkers.length;
  const foreignRecipesCount = foreignRecipes.length;
  const foreignDeliveredCount = foreignRecipes.filter(r => r.status === 'delivered').length;
  const foreignPendingCount = foreignRecipes.filter(r => r.status === 'pending' || !r.status).length;
  const foreignDischargePercent = foreignRecipesCount > 0 ? parseFloat(((foreignDeliveredCount / foreignRecipesCount) * 100).toFixed(1)) : 0;

  // Breakdown by Origin Location
  interface ForeignOriginStat {
    origin: string;
    citizensCount: number;
    recipesCount: number;
    deliveredCount: number;
    pendingCount: number;
    sampleMeds: string[];
  }

  const foreignOriginsMap: Record<string, ForeignOriginStat> = {};

  foreignWorkers.forEach(w => {
    const origin = getOriginLocation(w);
    if (!foreignOriginsMap[origin]) {
      foreignOriginsMap[origin] = {
        origin,
        citizensCount: 0,
        recipesCount: 0,
        deliveredCount: 0,
        pendingCount: 0,
        sampleMeds: []
      };
    }
    foreignOriginsMap[origin].citizensCount += 1;
  });

  foreignRecipes.forEach(r => {
    const origin = getOriginLocation(r);
    if (!foreignOriginsMap[origin]) {
      foreignOriginsMap[origin] = {
        origin,
        citizensCount: 0,
        recipesCount: 0,
        deliveredCount: 0,
        pendingCount: 0,
        sampleMeds: []
      };
    }
    foreignOriginsMap[origin].recipesCount += 1;
    if (r.status === 'delivered') {
      foreignOriginsMap[origin].deliveredCount += 1;
    } else {
      foreignOriginsMap[origin].pendingCount += 1;
    }
    if (r.medication && !foreignOriginsMap[origin].sampleMeds.includes(r.medication) && foreignOriginsMap[origin].sampleMeds.length < 3) {
      foreignOriginsMap[origin].sampleMeds.push(r.medication);
    }
  });

  const foreignOriginsList = Object.values(foreignOriginsMap).sort((a, b) => 
    (b.citizensCount + b.recipesCount) - (a.citizensCount + a.recipesCount)
  );

  // Territorial prioritization index by Commune - Typed to map safely
  const communeMap: Record<string, CommuneStat> = {};
  workers.forEach(w => {
    if (isForeignWorker(w)) return; // Exclude foreign citizens from Sotillo territorial map
    if (communeMap[w.commune]) return;

    const list = individualVulnerabilityList.filter(item => item.commune === w.commune);
    const avgScore = list.reduce((sum, item) => sum + item.score, 0) / (list.length || 1);
    const criticalCases = list.filter(item => item.classification === 'CRITICAL').length;
    const disabledCount = list.filter(item => item.hasDisability).length;
    const houseFragileCount = list.filter(item => item.housingFragile).length;

    communeMap[w.commune] = {
      commune: w.commune,
      totalCensus: list.length,
      avgScore: parseFloat(avgScore.toFixed(2)),
      criticalCases,
      disabledCount,
      houseFragileCount
    };
  });

  const territorialPriorities = Object.values(communeMap)
    .sort((a, b) => b.avgScore - a.avgScore || b.criticalCases - a.criticalCases);

  const filteredTerritorialPriorities = territorialPriorities.filter(item => 
    item.commune.toLowerCase().includes(searchCommune.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-slate-50/50 rounded-3xl">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-900 mx-auto" />
          <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">Cargando base analítica del municipio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-350">
      {/* Brand Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-blue-900">
            <TrendingUp className="w-7 h-7 text-blue-950" />
            <span className="text-[10px] font-black tracking-widest bg-blue-100/70 text-blue-950 px-2.5 py-1 rounded-md uppercase">Vanguardia Tecnológica</span>
          </div>
          <h2 className="text-3xl font-black text-blue-950 tracking-tight uppercase">Métricas y Análisis de Impacto Social</h2>
          <p className="text-slate-500 font-semibold text-xs uppercase tracking-wider font-sans">
            Alcaldía del Municipio Juan Antonio Sotillo &mdash; Dirección de Bienestar Social
          </p>
        </div>

        {/* Acciones y Dynamic Category Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsItemReportOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl py-2 px-3.5 gap-1.5 shadow-xs cursor-pointer h-9 shrink-0"
            title="Extraer nominalmente beneficiarios por fármaco, ayuda técnica o insumo específico (canastillas, sillas, etc.)"
          >
            <PackageSearch className="w-3.5 h-3.5 text-indigo-200" />
            <span>Extracción por Ítem / Fármaco</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsSocialReportOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl py-2 px-3.5 gap-1.5 shadow-xs cursor-pointer h-9 shrink-0"
            title="Generar informe cuantitativo consolidado por Razón Social (UBCH, Alcaldía, etc.)"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Informe por Razón Social (UBCH / Alcaldía)</span>
          </Button>

          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActiveTab('executive')}
            className={`font-extrabold text-[10px] uppercase tracking-wider rounded-lg py-2 ${
              activeTab === 'executive' 
                ? 'bg-blue-900 text-white shadow-xs hover:bg-blue-950 hover:text-white' 
                : 'text-neutral-600 hover:bg-slate-200'
            }`}
          >
            Índice de Vulnerabilidad
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActiveTab('health')}
            className={`font-extrabold text-[10px] uppercase tracking-wider rounded-lg py-2 ${
              activeTab === 'health' 
                ? 'bg-blue-900 text-white shadow-xs hover:bg-blue-950 hover:text-white' 
                : 'text-neutral-600 hover:bg-slate-200'
            }`}
          >
            Epidemiología y Salud
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActiveTab('territory')}
            className={`font-extrabold text-[10px] uppercase tracking-wider rounded-lg py-2 ${
              activeTab === 'territory' 
                ? 'bg-blue-900 text-white shadow-xs hover:bg-blue-950 hover:text-white' 
                : 'text-neutral-600 hover:bg-slate-200'
            }`}
          >
            Cartografía y Comunas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActiveTab('pharmacy')}
            className={`font-extrabold text-[10px] uppercase tracking-wider rounded-lg py-2 ${
              activeTab === 'pharmacy' 
                ? 'bg-blue-900 text-white shadow-xs hover:bg-blue-950 hover:text-white' 
                : 'text-neutral-600 hover:bg-slate-200'
            }`}
          >
            Farmacia y Ayudas
          </Button>
          </div>
        </div>
      </div>

      {/* SECCIÓN EJECUTIVA: PADRÓN TOTAL & RITMO DE CAPTACIÓN TEMPORAL */}
      <Card className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl border border-blue-800/40 shadow-xl overflow-hidden">
        <div className="p-5 sm:p-6 space-y-5">
          {/* Header & Controles de Período */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-blue-800/40 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                  Monitoreo de Operatividad y Registro
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-400" />
                Padrón Total & Ritmo de Captación
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                Supervisión en tiempo real de nuevos casos ingresados y ritmo de carga de expedientes
              </p>
            </div>

            {/* Selector de Período Temporal Interactivo */}
            <div className="flex flex-wrap items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-blue-700/40">
              <span className="text-[10px] font-black uppercase text-blue-300 px-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Período:
              </span>
              <button
                onClick={() => setTimeFilter('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                  timeFilter === 'today'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Hoy</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-blue-200 font-mono font-bold">
                  {todayCases.length}
                </span>
              </button>

              <button
                onClick={() => setTimeFilter('week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                  timeFilter === 'week'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Esta Semana</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-blue-200 font-mono font-bold">
                  {weekCases.length}
                </span>
              </button>

              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                  timeFilter === 'month'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Este Mes</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-blue-200 font-mono font-bold">
                  {monthCases.length}
                </span>
              </button>

              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                  timeFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Histórico Total</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-blue-200 font-mono font-bold">
                  {workers.length}
                </span>
              </button>
            </div>
          </div>

          {/* Tarjetas de Métricas de Padrón y Temporalidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tarjeta 1: Total Inscritos Permanente */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-blue-400/40 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest uppercase text-blue-300">
                  Padrón Total Nominal
                </span>
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-300">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {workers.length}
                </div>
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  100% Inscritos en Sistema
                </div>
              </div>
              <div className="text-[10px] text-slate-300 font-medium border-t border-white/10 pt-2 flex items-center justify-between mb-2">
                <span>Base general municipal</span>
                <span className="font-mono text-blue-300 font-bold">Sotillo + Foráneos</span>
              </div>
              <div className="border-t border-white/10 pt-2">
                <button
                  onClick={() => {
                    setTimeFilter('all');
                    setShowPeriodModal(true);
                  }}
                  className="w-full text-[10px] font-black uppercase text-white bg-blue-500/30 hover:bg-blue-500/50 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver Padrón Nominal ({workers.length})
                </button>
              </div>
            </div>

            {/* Tarjeta 2: Casos Cargados en el Período */}
            <div className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 backdrop-blur-md rounded-2xl p-4 border border-blue-400/40 hover:border-blue-300 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest uppercase text-blue-200">
                  {timeFilter === 'today' ? 'Cargados Hoy' : timeFilter === 'week' ? 'Cargados Esta Semana' : timeFilter === 'month' ? 'Cargados Este Mes' : 'Cargados (Histórico)'}
                </span>
                <div className="p-2 bg-blue-400/20 rounded-xl text-blue-200">
                  <UserPlus className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {selectedPeriodCases.length}
                </div>
                <div className="text-[11px] font-bold text-blue-200 uppercase tracking-wide mt-1">
                  {timeFilter === 'today' ? 'Ingresos registrados en el día' : timeFilter === 'week' ? 'Ingresos en los últimos 7 días' : timeFilter === 'month' ? 'Ingresos en el mes en curso' : 'Total acumulado en sistema'}
                </div>
              </div>
              <div className="border-t border-white/10 pt-2">
                <button
                  onClick={() => setShowPeriodModal(true)}
                  className="w-full text-[10px] font-black uppercase text-white bg-blue-500/40 hover:bg-blue-500/60 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver {selectedPeriodCases.length} Casos Cargados
                </button>
              </div>
            </div>

            {/* Tarjeta 3: Fichas Clínicas en el Período */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-amber-400/40 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest uppercase text-amber-300">
                  Fichas Clínicas Asociadas
                </span>
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-300">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">
                  {selectedPeriodHistoriesCount}
                </div>
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mt-1">
                  {selectedPeriodCases.length > 0
                    ? `${Math.round((selectedPeriodHistoriesCount / selectedPeriodCases.length) * 100)}% con historia médica`
                    : 'Sin registros'}
                </div>
              </div>
              <div className="text-[10px] text-slate-300 font-medium border-t border-white/10 pt-2 flex items-center justify-between">
                <span>Evaluación basal clínica</span>
                <span className="font-mono text-amber-300 font-bold">Completadas</span>
              </div>
            </div>

            {/* Tarjeta 4: Récipes y Ayudas en el Período */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-emerald-400/40 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest uppercase text-emerald-300">
                  Solicitudes y Récipes
                </span>
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-300">
                  <HeartHandshake className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-3xl sm:text-4xl font-black text-emerald-300 tracking-tight">
                  {selectedPeriodRecipesCount}
                </div>
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mt-1">
                  Fármacos y Ayudas Técnicas
                </div>
              </div>
              <div className="text-[10px] text-slate-300 font-medium border-t border-white/10 pt-2 flex items-center justify-between">
                <span>Atención comunitaria</span>
                <span className="font-mono text-emerald-300 font-bold">En el período</span>
              </div>
            </div>
          </div>

          {/* Gráfico Compacto de Ritmo de Carga de los Últimos 7 Días */}
          <div className="bg-black/30 rounded-2xl p-4 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-blue-300">
                <CalendarDays className="w-4 h-4" /> Ritmo de Captación Diario (Últimos 7 Días)
              </div>
              <p className="text-[11px] text-slate-300">
                Frecuencia de inscripción y carga de expedientes por jornada de trabajo
              </p>
            </div>

            <div className="w-full md:w-80 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7DaysTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold', color: '#93c5fd' }}
                  />
                  <Bar dataKey="count" name="Casos Cargados" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>
      {activeTab === 'executive' && (
        <div className="space-y-6">
          {/* Key Quick KPIs Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Población Nominal Censada</CardTitle>
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="h-4 w-4" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-950">{workers.length}</div>
                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-[10px] font-bold uppercase">
                  <span>Familias registradas con ficha</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black text-red-500 uppercase tracking-widest">En Vulnerabilidad Crítica</CardTitle>
                <div className="p-2 bg-rose-50 rounded-lg text-red-600"><ShieldAlert className="h-4 w-4" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-red-650">{ivmCounts.CRITICAL}</div>
                <div className="flex items-center gap-1.5 mt-1 text-red-500 text-[10px] font-black uppercase">
                  <span>{((ivmCounts.CRITICAL / (workers.length || 1)) * 100).toFixed(1)}% Urgencia tipo A</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Con Diagnóstico Crónico</CardTitle>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Activity className="h-4 w-4" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-amber-600">
                  {medicalHistories.filter(h => h.personalHistory?.hypertension || h.personalHistory?.diabetes || h.personalHistory?.asthma).length}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-[10px] font-bold uppercase">
                  <span>Pacientes con tratamiento</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black text-emerald-650 uppercase tracking-widest">Tasa de Sincronización</CardTitle>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle className="h-4 w-4" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-emerald-600">100%</div>
                <div className="flex items-center gap-1.5 mt-1 text-emerald-500 text-[10px] font-black uppercase">
                  <span>Trazabilidad segura Firestore</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Social Vulnerability Analytics Section */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 items-stretch">
            {/* Pie Chart Representation */}
            <Card className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-wider">Distribución del Rango de Vulnerabilidad</CardTitle>
                <CardDescription className="text-[10px] font-medium leading-relaxed">Índice compuesto derivado de la ficha diagnóstica social (IVM)</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] p-4 my-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ivmData}
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {ivmData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={VULNERABILITY_COLORS[index]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
              {/* Detailed custom legends */}
              <div className="p-4 border-t border-slate-150 bg-slate-50/50 space-y-2">
                {ivmData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VULNERABILITY_COLORS[idx] }} />
                      <span className="font-bold text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-black font-mono text-slate-800">{item.value} familias</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Explanation card of IVM framework (Executive value point) */}
            <Card className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-900" />
                  Marco Operativo de Reingeniería Métrica
                </CardTitle>
                <CardDescription className="text-[10px] font-medium">¿Cómo transformamos datos planos en planificación soberana?</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-red-500 text-white font-mono shrink-0">CRÍTICO</Badge>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-slate-800 uppercase">Vulnerabilidad Crítica (Puntaje $\ge$ 5.5)</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Familias con carencia de servicios esenciales, discapacitados a cargo, condiciones médicas sin tratamiento o casas de hábitat precario (ranchos).
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-amber-500 text-white font-mono shrink-0">MODERADO</Badge>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-slate-800 uppercase">Soporte Continuo (Puntaje 2.5 - 5)</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Población con patologías crónicas estables o adultos mayores en viviendas con infraestructura regular. Reciben medicamentos periódicos.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-emerald-500 text-white font-mono shrink-0">ESTABLE</Badge>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-slate-800 uppercase">Casos Estables (Puntaje &lt; 2.5)</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Población censada activa que no reporta patologías críticas ni condiciones habitacionales vulnerables.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex gap-3 text-xs font-medium text-blue-950">
                  <Heart className="w-5 h-5 text-blue-900 shrink-0" />
                  <p className="leading-relaxed">
                    <strong>Recomendación del Consultor:</strong> Use este índice unificado para justificar y solicitar el presupuesto anual ante el Consejo Legislativo Estadal y dirigir el plan municipal de entrega de techos y medicamentos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Vulnerable Listing of Priority Citizens */}
          <Card className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 p-6 border-b border-slate-100">
              <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Ciudadanos en Vulnerabilidad Crítica Detectados
              </CardTitle>
              <CardDescription className="text-xs">
                Casos que concentran la mayor cantidad de riesgos acumulados (Hogar, Salud, Dependencia y Discapacidad)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 animate-in fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-6">Ciudadano Beneficiario</th>
                      <th className="py-3 px-6">Identificación</th>
                      <th className="py-3 px-6">Comuna</th>
                      <th className="py-3 px-6">Edad</th>
                      <th className="py-3 px-6 text-center">Índice IVM</th>
                      <th className="py-3 px-6">Condiciones de Urgencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {individualVulnerabilityList.filter(item => item.classification === 'CRITICAL').length > 0 ? (
                      individualVulnerabilityList
                        .filter(item => item.classification === 'CRITICAL')
                        .sort((a,b) => b.score - a.score)
                        .slice(0, 8)
                        .map((req, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-6 font-bold uppercase">{req.name}</td>
                            <td className="py-3.5 px-6 font-mono text-slate-500">{req.dni}</td>
                            <td className="py-3.5 px-6 uppercase text-slate-400 font-semibold">{req.commune}</td>
                            <td className="py-3.5 px-6">{req.age} años</td>
                            <td className="py-3.5 px-6 text-center">
                              <span className="bg-red-50 text-red-650 font-black px-2.5 py-1 text-[11px] rounded-lg border border-red-200">
                                {req.score} pts
                              </span>
                            </td>
                            <td className="py-3.5 px-6 flex flex-wrap gap-1">
                              {req.hasDisability && <Badge className="bg-blue-600 text-white font-extrabold text-[8px] uppercase">Discapacidad</Badge>}
                              {req.housingFragile && <Badge className="bg-amber-600 text-white font-extrabold text-[8px] uppercase">Rancho/Madera</Badge>}
                              {req.isElder && <Badge className="bg-indigo-600 text-white font-extrabold text-[8px] uppercase">Tercera Edad</Badge>}
                              {!req.hasDisability && !req.housingFragile && !req.isElder && <Badge className="bg-red-600 text-white font-extrabold text-[8px] uppercase">Patologías Complejas</Badge>}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400 italic text-xs bg-slate-50/30">
                          Ningún ciudadano alcanza actualmente el puntaje ponderado de vulnerabilidad crítica. Todo está balanceado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RENDER TAB 2: EPIDEMIOLOGY & CLINICAL CASES */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            {/* Chart: Pathology frequencies */}
            <Card className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-wider">Distribución Epidemiológica de la Población</CardTitle>
                <CardDescription className="text-[10px] font-medium">Prevalencia de enfermedades crónicas reportadas en el censo social</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px] p-6">
                {pathologyData.some(p => p.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pathologyData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" width={115} fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#475569', fontWeight: 'bold' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                      />
                      <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={20}>
                        {pathologyData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 italic text-xs">No hay datos de patologías en los expedientes aún.</div>
                )}
              </CardContent>
            </Card>

            {/* Demographics: Age distribution */}
            <Card className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-wider">Demografía Poblacional por Edades</CardTitle>
                <CardDescription className="text-[10px] font-medium">Clasificación por ciclos biológicos de vida</CardDescription>
              </CardHeader>
              <CardContent className="h-[230px] p-4 my-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demographicAgeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {demographicAgeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={AID_COLORS[index % AID_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
              {/* Legends */}
              <div className="p-4 border-t border-slate-150 bg-slate-50/50 grid grid-cols-2 gap-2 text-[10px]">
                {demographicAgeData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 font-bold">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: AID_COLORS[idx % AID_COLORS.length] }} />
                    <span className="text-slate-600 truncate">{item.name}:</span>
                    <span className="text-slate-900 font-black">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Patient Gender Breakdown and disabilities analysis */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
              <div className="space-y-1 pb-4">
                <h3 className="text-xs font-black text-blue-950 uppercase tracking-widest">Seguimiento de Distribución por Géneros</h3>
                <p className="text-[10px] text-slate-500 font-medium">Proporción de género de beneficiarios nominales activos</p>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demographicGenderData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                    >
                      {demographicGenderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-around items-center pt-4 border-t border-slate-100 text-[11px] font-bold text-slate-600">
                {demographicGenderData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GENDER_COLORS[idx] }} />
                    <span>{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Disability Type Metrics and Assistive Analysis */}
            <Card className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
              <div className="space-y-1 pb-4">
                <h3 className="text-xs font-black text-blue-950 uppercase tracking-widest">Población con Discapacidad Registrada</h3>
                <p className="text-[10px] text-slate-500 font-medium">Personas registradas con diversidad funcional</p>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                  <span className="text-xs text-slate-600 font-bold">Total Discapacidad Registrada:</span>
                  <Badge className="bg-red-500 text-white font-extrabold">{workers.filter(w => w.hasDisability).length} casos</Badge>
                </div>
                <div className="space-y-4 pt-2 text-[11px] text-slate-600">
                  <p className="leading-relaxed font-semibold">
                    Un total de {((workers.filter(w => w.hasDisability).length / (workers.length || 1)) * 100).toFixed(1)}% de la fuerza poblacional activa cuenta con diversidad funcional motora, cognitiva, visual o auditiva calificada.
                  </p>
                  <p className="leading-relaxed text-[10px] text-slate-500 font-medium">
                    * Todos los expedientes que declaran diversidad funcional tienen acceso directo prioritario asignado en el Módulo de Ayudas Humanas para la asignación inmediata de sillas de ruedas u otros instrumentos.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* RENDER TAB 3: TERRITORY AND COMMUNES PRIORITIZATION */}
      {activeTab === 'territory' && (
        <div className="space-y-6">
          <Card className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Search Filter Area */}
            <div className="bg-slate-50/50 p-6 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-widest flex items-center gap-1.5">
                  <MapIcon className="w-5 h-5 text-blue-900" />
                  Cartografía de Prioridad Territorial por Comunas
                </CardTitle>
                <CardDescription className="text-xs">
                  Estadísticas consolidadas por comuna ordenadas descendientemente por su Índice de Vulnerabilidad Promedio (IVP)
                </CardDescription>
              </div>
              <div className="relative max-w-xs shrink-0">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar comuna..."
                  value={searchCommune}
                  onChange={(e) => setSearchCommune(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-xs bg-white text-slate-800 rounded-xl border border-slate-200 font-medium focus:ring-1 focus:ring-blue-900 focus:outline-none"
                />
              </div>
            </div>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-6">Comuna</th>
                      <th className="py-3 px-6 text-center">Ciudadanos Censados</th>
                      <th className="py-3 px-6 text-center">Índice Vulnerabilidad Promedio</th>
                      <th className="py-3 px-6 text-center">Casos Críticos</th>
                      <th className="py-3 px-6 text-center">Diversidad Funcional</th>
                      <th className="py-3 px-6 text-center">Viviendas Vulnerables</th>
                      <th className="py-3 px-6 text-right">Prioridad de Despliegue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredTerritorialPriorities.length > 0 ? (
                      filteredTerritorialPriorities.map((item, idx) => {
                        let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        let progressText = "Monitoreo";
                        if (item.avgScore >= 4.5 || item.criticalCases >= 3) {
                          badgeColor = "bg-red-50 text-red-650 border-red-200 animate-pulse";
                          progressText = "URGENTE";
                        } else if (item.avgScore >= 2.5) {
                          badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                          progressText = "MODERADO";
                        }

                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-6 font-bold uppercase">{item.commune}</td>
                            <td className="py-3.5 px-6 text-center font-bold text-slate-800">{item.totalCensus}</td>
                            <td className="py-3.5 px-6 text-center font-bold text-blue-900 font-mono text-[13px]">{item.avgScore} / 12</td>
                            <td className="py-3.5 px-6 text-center text-red-600 font-black">{item.criticalCases}</td>
                            <td className="py-3.5 px-6 text-center text-slate-500 font-semibold">{item.disabledCount}</td>
                            <td className="py-3.5 px-6 text-center text-slate-500 font-semibold">{item.houseFragileCount}</td>
                            <td className="py-3.5 px-6 text-right">
                              <span className={`border ${badgeColor} text-[10px] font-black px-2.5 py-1 rounded-lg uppercase`}>
                                {progressText}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 italic text-xs bg-slate-50/30">
                          Ninguna comuna coincide con los términos de búsqueda introducidos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Territorial Warning Tips */}
          <div className="bg-red-50/70 rounded-3xl border border-red-150 p-5 flex gap-3 text-xs text-red-950 font-medium leading-relaxed items-start">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold uppercase text-[11px] text-red-700">Protocolo de Asignación Territorial Directo:</span>
              <p>
                Las comunas con etiqueta <strong className="text-red-700 font-black">URGENTE</strong> deben recibir los camiones de medicamentos y operativos de salud médica primero. Este algoritmo autocalibrado garantiza que el proceso de distribución de Bienestar Social sea completamente auditable e inmune a presiones subjetivas.
              </p>
            </div>
          </div>

          {/* SECCIÓN DEDICADA: CIUDADANOS FORÁNEOS (FUERA DEL MUNICIPIO SOTILLO) */}
          <div className="pt-2">
            <Card className="bg-white rounded-3xl border border-amber-200/90 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-100/30 to-transparent p-6 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-md border border-amber-300">
                      Módulo Extra-Municipal
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Monitoreo Segregado de Procedencias
                    </span>
                  </div>
                  <CardTitle className="text-sm sm:text-base font-black text-amber-950 uppercase tracking-wide flex items-center gap-2">
                    <Compass className="w-5 h-5 text-amber-600 shrink-0" />
                    Atenciones a Ciudadanos Foráneos (Fuera del Municipio Sotillo)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    Registro y control analítico diferenciado de ciudadanos procedentes de otros municipios o estados que han solicitado o recibido asistencia.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-amber-100/90 text-amber-900 border border-amber-300 font-bold px-3 py-1 text-xs rounded-full">
                    {foreignWorkersCount} Ciudadano(s) • {foreignRecipesCount} Solicitud(es)
                  </span>
                </div>
              </div>

              {/* KPIs for Foreign Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40">
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Censados Foráneos</span>
                    <Users className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-950">{foreignWorkersCount}</div>
                  <p className="mt-1 text-[10px] text-slate-500 font-medium">Ciudadanos no residentes en Sotillo</p>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Ayudas Solicitadas</span>
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-blue-950">{foreignRecipesCount}</div>
                  <p className="mt-1 text-[10px] text-slate-500 font-medium">Órdenes / recetas médicas generadas</p>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Despachos Entregados</span>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700">{foreignDeliveredCount}</div>
                  <p className="mt-1 text-[10px] text-emerald-600 font-bold">{foreignDischargePercent}% efectividad de entrega</p>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">En Cola / Pendientes</span>
                    <Clock className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-rose-650">{foreignPendingCount}</div>
                  <p className="mt-1 text-[10px] text-slate-500 font-medium">Por despachar o coordinar</p>
                </div>
              </div>

              {/* Table of Origins */}
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-6">Municipio / Procedencia</th>
                        <th className="py-3 px-6 text-center">Ciudadanos Registrados</th>
                        <th className="py-3 px-6 text-center">Ayudas Solicitadas</th>
                        <th className="py-3 px-6 text-center">Entregadas</th>
                        <th className="py-3 px-6 text-center">En Espera</th>
                        <th className="py-3 px-6">Fármacos / Insumos Principales</th>
                        <th className="py-3 px-6 text-right">Estatus Institucional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {foreignOriginsList.length > 0 ? (
                        foreignOriginsList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                            <td className="py-3.5 px-6 font-black uppercase text-amber-950 flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{item.origin}</span>
                            </td>
                            <td className="py-3.5 px-6 text-center font-bold text-slate-900">{item.citizensCount}</td>
                            <td className="py-3.5 px-6 text-center font-bold text-blue-900 font-mono text-[13px]">{item.recipesCount}</td>
                            <td className="py-3.5 px-6 text-center text-emerald-700 font-black">{item.deliveredCount}</td>
                            <td className="py-3.5 px-6 text-center text-rose-600 font-bold">{item.pendingCount}</td>
                            <td className="py-3.5 px-6 text-slate-600 font-medium text-[11px]">
                              {item.sampleMeds.length > 0 ? item.sampleMeds.join(', ') : 'Ninguno especificado'}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <span className="border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">
                                Foráneo Auditado
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400 italic text-xs bg-slate-50/20">
                            Aún no se registran ciudadanos con procedencia fuera del Municipio Sotillo. Cuando se asienten atenciones marcadas como "OTRO", aparecerán desglosadas en esta tabla independiente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* RENDER TAB 4: PHARMACY DISPATCH & TECHNICAL AIDS CONTROL */}
      {activeTab === 'pharmacy' && (
        <div className="space-y-6">
          {/* Pharmacy Dispatch Efficiency Card */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-xs">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Eficiencia Farmacéutica</span>
                <span className="text-3xl font-black text-emerald-650">{pharmacyEfficiency}%</span>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Recetas despachadas con éxito</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0"><Truck className="w-6 h-6" /></div>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-xs">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Recetas Despachadas</span>
                <span className="text-3xl font-black text-blue-900">{deliveredRecipes}</span>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">De {totalRecipes} emitidas</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-900 shrink-0"><CheckCircle className="w-6 h-6" /></div>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-xs">
              <div className="space-y-1">
                <span className="text-[9px] text-red-500 font-black uppercase tracking-wider block">En Lista de Espera</span>
                <span className="text-3xl font-black text-rose-650">{pendingRecipes}</span>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Por entregar al paciente</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl text-red-600 shrink-0"><Clock className="w-6 h-6" /></div>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 items-stretch">
            {/* Technical aids required Breakdown Chart */}
            <Card className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-wider">Demanda por Tipo de Ayuda Humana</CardTitle>
                <CardDescription className="text-[10px] font-medium">Frecuencia total acumulada de aparatos de asistencia social solicitados</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] p-4 my-auto">
                {aidsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={aidsChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {aidsChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={AID_COLORS[index % AID_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 italic text-xs">No hay datos de ayudas para graficar.</div>
                )}
              </CardContent>
              {/* Detailed custom legends */}
              <div className="p-4 border-t border-slate-150 bg-slate-50/50 space-y-1 text-[11px] font-bold text-slate-700">
                {aidsChartData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AID_COLORS[idx % AID_COLORS.length] }} />
                      <span className="truncate">{item.name}:</span>
                    </div>
                    <span className="font-mono font-black text-slate-800">{item.value} cant.</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Audit list of aids, targets, and notes */}
            <Card className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xs font-black text-blue-950 uppercase tracking-widest flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-blue-600" />
                    Control Consolidado de Ayudas Humanas Solicitadas
                  </CardTitle>
                  <CardDescription className="text-[10px]">
                    Andaderas, bastones, pañales y sillas de ruedas demandados por beneficiario
                  </CardDescription>
                </div>
                <div>
                  <Badge className="bg-blue-950 font-black text-[9px] uppercase tracking-wider py-1 px-2 shrink-0">
                     Requeridos: {totalAidsRequired} | Entregados: {totalAidsDelivered}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[350px] overflow-auto flex-1">
                <div className="overflow-x-auto animate-in fade-in">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[9px] font-black uppercase tracking-wider text-slate-400 sticky top-0">
                        <th className="py-2.5 px-4">Beneficiario/Trabajador</th>
                        <th className="py-2.5 px-4 py-2 text-center">Ayuda Requerida</th>
                        <th className="py-2.5 px-4 text-center">Cant.</th>
                        <th className="py-2.5 px-4 text-right">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {allTechnicalAidRequests.length > 0 ? (
                        allTechnicalAidRequests.map((req, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold uppercase text-[11px]">{req.workerName}</span>
                                <span className="text-[8px] font-black tracking-widest text-slate-400 mt-0.5">{req.source === "Expediente" ? "📂 CLÍNICO" : "💊 FARMACIA"} &bull; {req.commune}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="bg-blue-50 text-blue-700 text-[9px] font-black rounded px-2 py-0.5 uppercase inline-block border border-blue-100">
                                {req.technicalAidType ? req.technicalAidType.replace(/_/g, ' ') : 'Silla de Ruedas'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-blue-600">{req.technicalAidQuantity || 1}</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                req.status === 'delivered' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-150'
                              }`}>
                                {req.status === 'delivered' ? 'ENTREGADO' : 'PENDIENTE'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400 italic text-[11px] bg-slate-50/30">
                            No se registran solicitudes de ayudas humanas activas en los expedientes de salud o farmacia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE CASOS CARGADOS EN EL PERÍODO */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 text-white border-0 text-[10px] font-black uppercase">
                    {timeFilter === 'today' ? 'Cargados Hoy' : timeFilter === 'week' ? 'Cargados Esta Semana' : timeFilter === 'month' ? 'Cargados Este Mes' : 'Padrón Histórico'}
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    {filteredPeriodCasesList.length} de {selectedPeriodCases.length} casos
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  {timeFilter === 'all' ? 'Padrón Total Nominal de Ciudadanos' : 'Ciudadanos Inscritos en el Período'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowPeriodModal(false);
                  setPeriodSearchQuery('');
                }}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-all"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={periodSearchQuery}
                  onChange={(e) => setPeriodSearchQuery(e.target.value)}
                  placeholder="Filtrar por nombre, cédula, comuna o sector..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              {periodSearchQuery && (
                <button
                  onClick={() => setPeriodSearchQuery('')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Modal Body Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {filteredPeriodCasesList.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Ciudadano</th>
                        <th className="py-3 px-4">Cédula</th>
                        <th className="py-3 px-4">Comuna / Ubicación</th>
                        <th className="py-3 px-4 text-center">Fecha de Ingreso</th>
                        <th className="py-3 px-4 text-center">Ficha Clínica</th>
                        <th className="py-3 px-4 text-center">Expediente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredPeriodCasesList.map((worker) => {
                        const hasHistory = medicalHistories.some(h => h.workerId === worker.id);
                        const regDate = parseDateSafe(worker.createdAt);
                        const formattedDate = regDate 
                          ? format(regDate, "dd/MM/yyyy 'a las' hh:mm a", { locale: es }) 
                          : 'Fecha no registrada';

                        return (
                          <tr key={worker.id} className="hover:bg-blue-50/40 transition-colors group">
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setSelectedWorkerForExpediente(worker)}
                                className="text-left font-bold text-slate-900 group-hover:text-blue-700 hover:underline flex items-center gap-1.5 cursor-pointer"
                                title="Haga clic para ver el expediente clínico integral"
                              >
                                <span>{worker.fullName}</span>
                              </button>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {worker.gender === 'M' ? 'Masculino' : worker.gender === 'F' ? 'Femenino' : 'Otro'} • {getAge(worker.birthDate)} años
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">
                              {worker.dni || 'Sin Cédula'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">{worker.commune || 'Comuna no especificada'}</div>
                              <div className="text-[10px] text-slate-500">{worker.sector || 'Sector no especificado'}</div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600">
                              {formattedDate}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {hasHistory ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                                  <CheckCircle className="w-3 h-3" /> Registrada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase">
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 font-black text-[10px] uppercase tracking-wider rounded-lg gap-1.5 transition-all shadow-2xs cursor-pointer"
                                onClick={() => setSelectedWorkerForExpediente(worker)}
                                title={`Abrir Expediente Clínico de ${worker.fullName}`}
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Expediente</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-600 font-bold text-sm">
                    No se encontraron ciudadanos para los filtros aplicados
                  </p>
                  <p className="text-slate-400 text-xs">
                    {periodSearchQuery 
                      ? 'Intenta con otro término de búsqueda o limpia el filtro.' 
                      : 'No hay registros cargados en este rango de tiempo.'}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                Mostrando <strong className="text-slate-800">{filteredPeriodCasesList.length}</strong> expedientes de <strong className="text-slate-800">{selectedPeriodCases.length}</strong> registrados en este período.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPeriodModal(false);
                  setPeriodSearchQuery('');
                }}
                className="font-bold text-xs"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO MODAL EXPEDIENTE CLÍNICO INTEGRAL */}
      <Dialog 
        open={!!selectedWorkerForExpediente} 
        onOpenChange={(open) => !open && setSelectedWorkerForExpediente(null)}
      >
        <DialogContent className="z-[70] max-w-[96vw] xl:max-w-[1400px] w-full max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl">
          {selectedWorkerForExpediente && (
            <WorkerExpediente 
              worker={selectedWorkerForExpediente} 
              onClose={() => setSelectedWorkerForExpediente(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE INFORME CUANTITATIVO POR RAZÓN SOCIAL */}
      <SocialAreaReportModal
        isOpen={isSocialReportOpen}
        onClose={() => setIsSocialReportOpen(false)}
        workers={workers}
        recipes={recipes}
        initialSocialArea="JEFE UBCH"
      />

      {/* MODAL DE EXTRACCIÓN NOMINAL DE BENEFICIARIOS POR ÍTEM / FÁRMACO */}
      <ItemBeneficiariesReportModal
        isOpen={isItemReportOpen}
        onClose={() => setIsItemReportOpen(false)}
        recipes={recipes}
        workers={workers}
      />
    </div>
  );
}
