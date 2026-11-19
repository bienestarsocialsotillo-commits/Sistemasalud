import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  PackageSearch, 
  Pill, 
  Package, 
  Accessibility, 
  Users, 
  Calendar, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  Search, 
  Building2, 
  CheckCircle2, 
  TrendingUp, 
  FileSpreadsheet, 
  X, 
  Sparkles, 
  Layers, 
  MapPin, 
  Phone, 
  UserCheck, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  FileText,
  Filter,
  Stethoscope,
  MessageSquare
} from "lucide-react";
import { format, isSameDay, isAfter, isBefore, subDays, startOfMonth, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Worker, MedicationRecipe } from '@/types';
import { getRecipeCategory, isClinicalDerivationItem } from '@/utils/categoryUtils';
import WorkerExpediente from './WorkerExpediente';
import WhatsAppBroadcastModal from './WhatsAppBroadcastModal';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ItemBeneficiariesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: MedicationRecipe[];
  workers: Worker[];
  initialItemQuery?: string;
}

interface ExtractedItemRecord {
  recordId: string;
  recipeId: string;
  rawName: string;
  normalizedName: string;
  presentation: string;
  quantity: number;
  category: 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation';
  deliveryDate: Date | null;
  dateStr: string;
  status: 'pending' | 'delivered';
  recipe: MedicationRecipe;
  worker?: Worker;
  workerId: string;
  workerName: string;
  workerDni: string;
  workerPhone: string;
  commune: string;
  sector: string;
  socialArea: string;
  workplaceDepartment: string;
  recipientType: 'TITULAR' | 'REPRESENTANTE';
  representativeInfo?: string;
}

const parseDateSafe = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (val?.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Normalizar texto eliminando acentos, caracteres especiales y espacios redundantes
const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

export default function ItemBeneficiariesReportModal({
  isOpen,
  onClose,
  recipes,
  workers,
  initialItemQuery = ""
}: ItemBeneficiariesReportModalProps) {
  // Filtros principales
  const [selectedItemQuery, setSelectedItemQuery] = useState<string>(initialItemQuery);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'medication' | 'medical_supply' | 'technical_aid' | 'medical_derivation'>('all');
  const [statusFilter, setStatusFilter] = useState<'delivered' | 'all'>('delivered');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [communeFilter, setCommuneFilter] = useState<string>("ALL");
  
  // Filtro de búsqueda nominal secundaria dentro de la tabla
  const [nominalSearch, setNominalSearch] = useState<string>("");
  
  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Estado para visualización de expediente clínico
  const [selectedWorkerForExpediente, setSelectedWorkerForExpediente] = useState<Worker | null>(null);
  const [isWhatsAppBroadcastOpen, setIsWhatsAppBroadcastOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Sincronizar initialItemQuery si cambia
  React.useEffect(() => {
    if (initialItemQuery) {
      setSelectedItemQuery(initialItemQuery);
    }
  }, [initialItemQuery]);

  // Mapa de trabajadores por ID y por Cédula para búsqueda ultra-rápida y confiable
  const { workersById, workersByDni } = useMemo(() => {
    const byId = new Map<string, Worker>();
    const byDni = new Map<string, Worker>();
    workers.forEach(w => {
      byId.set(w.id, w);
      if (w.dni) {
        const clean = w.dni.replace(/[^0-9]/g, '');
        if (clean) byDni.set(clean, w);
      }
    });
    return { workersById: byId, workersByDni: byDni };
  }, [workers]);

  // 1. Extraer TODOS los ítems individuales presentes en las recetas (desagregando multi-ítems si existen)
  const allExtractedRecords: ExtractedItemRecord[] = useMemo(() => {
    const records: ExtractedItemRecord[] = [];

    recipes.forEach((r, rIdx) => {
      const deliveryDate = parseDateSafe(r.deliveredAt || r.createdAt);
      const dateStr = deliveryDate ? format(deliveryDate, "dd/MM/yyyy", { locale: es }) : "S/F";
      const status = r.status === 'delivered' ? 'delivered' : 'pending';

      // Buscar paciente correspondiente
      let worker = r.workerId ? workersById.get(r.workerId) : undefined;
      if (!worker && r.workerDni) {
        const clean = r.workerDni.replace(/[^0-9]/g, '');
        worker = workersByDni.get(clean);
      }

      const workerName = worker?.fullName || r.workerFullName || "Paciente Sin Nombre";
      const workerDni = worker?.dni || r.workerDni || "S/C";
      const workerPhone = worker?.phone || "S/T";
      const commune = r.commune || worker?.commune || "NO ESPECIFICADA";
      const sector = worker?.sector || "Casco Central / No def.";
      
      const primarySocialArea = (worker?.socialAreas && worker.socialAreas.length > 0)
        ? worker.socialAreas[0]
        : (worker?.socialArea || "COMUNIDAD GENERAL");
      
      const workplaceDepartment = worker?.workplaceDepartment || "";

      // Datos de recepción
      const isRep = !!(r.isDeliveredToRepresentative && (r.representativeFullName || r.representativeDni));
      const recipientType: 'TITULAR' | 'REPRESENTANTE' = isRep ? 'REPRESENTANTE' : 'TITULAR';
      const representativeInfo = isRep 
        ? `${r.representativeFullName || ''} (${r.representativeRelationship || 'Familiar'} - C.I. ${r.representativeDni || 'S/C'})`.trim()
        : undefined;

      // Determinar ítems entregados en la receta
      const cat = getRecipeCategory(r);

      // A) Multi-medicamentos
      if (Array.isArray(r.medications) && r.medications.length > 0) {
        r.medications.forEach((m, mIdx) => {
          if (m && m.medication && m.medication.trim()) {
            const rawName = m.medication.trim();
            records.push({
              recordId: `${r.id || rIdx}-med-${mIdx}`,
              recipeId: r.id,
              rawName,
              normalizedName: normalizeText(rawName),
              presentation: m.presentation?.trim() || r.presentation?.trim() || "",
              quantity: Number(m.quantity) || 1,
              category: 'medication',
              deliveryDate,
              dateStr,
              status,
              recipe: r,
              worker,
              workerId: r.workerId || worker?.id || `anon-${rIdx}`,
              workerName,
              workerDni,
              workerPhone,
              commune,
              sector,
              socialArea: primarySocialArea,
              workplaceDepartment,
              recipientType,
              representativeInfo
            });
          }
        });
      }

      // B) Multi-insumos
      if (Array.isArray(r.medicalSupplies) && r.medicalSupplies.length > 0) {
        r.medicalSupplies.forEach((s, sIdx) => {
          if (s && s.supplyName && s.supplyName.trim()) {
            const rawName = s.supplyName.trim();
            records.push({
              recordId: `${r.id || rIdx}-sup-${sIdx}`,
              recipeId: r.id,
              rawName,
              normalizedName: normalizeText(rawName),
              presentation: s.presentation?.trim() || "",
              quantity: Number(s.quantity) || 1,
              category: 'medical_supply',
              deliveryDate,
              dateStr,
              status,
              recipe: r,
              worker,
              workerId: r.workerId || worker?.id || `anon-${rIdx}`,
              workerName,
              workerDni,
              workerPhone,
              commune,
              sector,
              socialArea: primarySocialArea,
              workplaceDepartment,
              recipientType,
              representativeInfo
            });
          }
        });
      }

      // C) Ayuda Humana / Técnica
      if (r.technicalAidType || r.customTechnicalAid || cat === 'technical_aid') {
        const rawName = (r.customTechnicalAid || r.technicalAidType || "Ayuda Técnica").trim();
        const qty = Number(r.technicalAidQuantity) || Number(r.quantity) || 1;
        records.push({
          recordId: `${r.id || rIdx}-tech`,
          recipeId: r.id,
          rawName,
          normalizedName: normalizeText(rawName),
          presentation: r.technicalAidSpecs?.trim() || "Unidad",
          quantity: qty,
          category: 'technical_aid',
          deliveryDate,
          dateStr,
          status,
          recipe: r,
          worker,
          workerId: r.workerId || worker?.id || `anon-${rIdx}`,
          workerName,
          workerDni,
          workerPhone,
          commune,
          sector,
          socialArea: primarySocialArea,
          workplaceDepartment,
          recipientType,
          representativeInfo
        });
      }

      // D) Ayudas Sociales Específicas (Bolsas Clap / Aportes Económicos)
      if (r.socialAidType === 'food_bag' || (Number(r.foodBagsCount) || 0) > 0) {
        const qty = Number(r.foodBagsCount) || 1;
        records.push({
          recordId: `${r.id || rIdx}-food`,
          recipeId: r.id,
          rawName: "Bolsa de Alimentación / Combo Clap",
          normalizedName: normalizeText("Bolsa de Alimentación Combo Clap alimentos"),
          presentation: "Combo Alimentario",
          quantity: qty,
          category: 'medical_supply',
          deliveryDate,
          dateStr,
          status,
          recipe: r,
          worker,
          workerId: r.workerId || worker?.id || `anon-${rIdx}`,
          workerName,
          workerDni,
          workerPhone,
          commune,
          sector,
          socialArea: primarySocialArea,
          workplaceDepartment,
          recipientType,
          representativeInfo
        });
      }

      if (r.socialAidType === 'economic_aid' || (Number(r.economicAmount) || 0) > 0) {
        const concept = r.economicConcept || "Ayuda Económica Directa";
        records.push({
          recordId: `${r.id || rIdx}-eco`,
          recipeId: r.id,
          rawName: `Aporte Económico: ${concept} (${r.economicAmount || 0} ${r.economicCurrency || 'USD'})`,
          normalizedName: normalizeText(`Aporte Economico ${concept}`),
          presentation: "Aporte Monetario",
          quantity: 1,
          category: 'medical_supply',
          deliveryDate,
          dateStr,
          status,
          recipe: r,
          worker,
          workerId: r.workerId || worker?.id || `anon-${rIdx}`,
          workerName,
          workerDni,
          workerPhone,
          commune,
          sector,
          socialArea: primarySocialArea,
          workplaceDepartment,
          recipientType,
          representativeInfo
        });
      }

      // E) Atenciones y Derivaciones (Ecos, laboratorios, consultas clínicas)
      if (cat === 'medical_derivation' || isClinicalDerivationItem(r)) {
        const rawName = (r.derivationService || r.medication || r.supplyName || "Derivación Médica").trim();
        records.push({
          recordId: `${r.id || rIdx}-deriv`,
          recipeId: r.id,
          rawName,
          normalizedName: normalizeText(rawName),
          presentation: r.derivationCenter ? `Centro: ${r.derivationCenter}` : "Orden Asistencial",
          quantity: 1,
          category: 'medical_derivation',
          deliveryDate,
          dateStr,
          status,
          recipe: r,
          worker,
          workerId: r.workerId || worker?.id || `anon-${rIdx}`,
          workerName,
          workerDni,
          workerPhone,
          commune,
          sector,
          socialArea: primarySocialArea,
          workplaceDepartment,
          recipientType,
          representativeInfo
        });
      }

      // F) Registro directo simple de Insumo (cuando no se usó multi-insumo)
      if (
        (!Array.isArray(r.medicalSupplies) || r.medicalSupplies.length === 0) &&
        r.supplyName &&
        r.supplyName.trim() &&
        cat !== 'technical_aid' &&
        !isClinicalDerivationItem(r)
      ) {
        const rawName = r.supplyName.trim();
        records.push({
          recordId: `${r.id || rIdx}-single-sup`,
          recipeId: r.id,
          rawName,
          normalizedName: normalizeText(rawName),
          presentation: r.supplyPresentation?.trim() || r.presentation?.trim() || "",
          quantity: Number(r.quantity) || 1,
          category: 'medical_supply',
          deliveryDate,
          dateStr,
          status,
          recipe: r,
          worker,
          workerId: r.workerId || worker?.id || `anon-${rIdx}`,
          workerName,
          workerDni,
          workerPhone,
          commune,
          sector,
          socialArea: primarySocialArea,
          workplaceDepartment,
          recipientType,
          representativeInfo
        });
      }

      // G) Registro directo simple de Fármaco (cuando no se usó multi-medicamentos)
      if (
        (!Array.isArray(r.medications) || r.medications.length === 0) &&
        r.medication &&
        r.medication.trim() &&
        cat === 'medication' &&
        !r.technicalAidType &&
        !r.customTechnicalAid &&
        !isClinicalDerivationItem(r)
      ) {
        const rawName = r.medication.trim();
        records.push({
          recordId: `${r.id || rIdx}-single-med`,
          recipeId: r.id,
          rawName,
          normalizedName: normalizeText(rawName),
          presentation: r.presentation?.trim() || "",
          quantity: Number(r.quantity) || 1,
          category: 'medication',
          deliveryDate,
          dateStr,
          status,
          recipe: r,
          worker,
          workerId: r.workerId || worker?.id || `anon-${rIdx}`,
          workerName,
          workerDni,
          workerPhone,
          commune,
          sector,
          socialArea: primarySocialArea,
          workplaceDepartment,
          recipientType,
          representativeInfo
        });
      }
    });

    return records;
  }, [recipes, workersById, workersByDni]);

  // 2. Catálogo Dinámico de Ítems Únicos con Conteo de Entregas y Unidades
  const itemCatalog = useMemo(() => {
    const map = new Map<string, {
      displayName: string;
      category: 'medication' | 'technical_aid' | 'medical_supply' | 'medical_derivation';
      totalActs: number;
      totalUnits: number;
      uniqueBeneficiaries: Set<string>;
    }>();

    allExtractedRecords.forEach(rec => {
      // Tomamos solo entregados para el catálogo base a menos que queramos ver todo
      if (statusFilter === 'delivered' && rec.status !== 'delivered') return;

      const key = rec.normalizedName;
      if (!key) return;

      const existing = map.get(key);
      const cleanBeneficiaryKey = rec.workerDni && rec.workerDni !== 'S/C' 
        ? rec.workerDni.replace(/[^0-9]/g, '') 
        : rec.workerId;

      if (!existing) {
        map.set(key, {
          displayName: rec.rawName.toUpperCase(),
          category: rec.category,
          totalActs: 1,
          totalUnits: rec.quantity,
          uniqueBeneficiaries: new Set([cleanBeneficiaryKey])
        });
      } else {
        existing.totalActs += 1;
        existing.totalUnits += rec.quantity;
        existing.uniqueBeneficiaries.add(cleanBeneficiaryKey);
      }
    });

    return Array.from(map.entries())
      .map(([key, data]) => ({
        key,
        name: data.displayName,
        category: data.category,
        totalActs: data.totalActs,
        totalUnits: data.totalUnits,
        uniqueBeneficiariesCount: data.uniqueBeneficiaries.size
      }))
      .sort((a, b) => b.totalActs - a.totalActs);
  }, [allExtractedRecords, statusFilter]);

  // Lista de comunas presentes en los registros para el selector
  const availableCommunes = useMemo(() => {
    const set = new Set<string>();
    allExtractedRecords.forEach(r => {
      if (r.commune && r.commune !== "NO ESPECIFICADA") {
        set.add(r.commune);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allExtractedRecords]);

  // 3. Filtrado reactivo de registros según los criterios del usuario
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = subDays(todayStart, 6);
    const monthStart = startOfMonth(now);
    const yearStart = startOfYear(now);

    const targetTerm = normalizeText(selectedItemQuery);

    return allExtractedRecords.filter(rec => {
      // A) Filtro de Estatus (Entregados vs Todos)
      if (statusFilter === 'delivered' && rec.status !== 'delivered') {
        return false;
      }

      // B) Filtro de Categoría de Farmacia
      if (categoryFilter !== 'all' && rec.category !== categoryFilter) {
        return false;
      }

      // C) Filtro de Ítem (Texto o Búsqueda Normalizada)
      if (targetTerm) {
        // Coincidencia con nombre del ítem o presentación
        const matchesName = rec.normalizedName.includes(targetTerm);
        const matchesPres = normalizeText(rec.presentation).includes(targetTerm);
        if (!matchesName && !matchesPres) {
          return false;
        }
      }

      // D) Filtro Temporal
      if (timeFilter !== 'all') {
        const d = rec.deliveryDate;
        if (!d) return false;

        if (timeFilter === 'today' && !isSameDay(d, now)) return false;
        if (timeFilter === 'week' && !(isAfter(d, weekStart) || isSameDay(d, weekStart))) return false;
        if (timeFilter === 'month' && !(isAfter(d, monthStart) || isSameDay(d, monthStart))) return false;
        if (timeFilter === 'year' && !(isAfter(d, yearStart) || isSameDay(d, yearStart))) return false;
        if (timeFilter === 'custom') {
          if (startDate) {
            const startD = new Date(startDate + "T00:00:00");
            if (isBefore(d, startD)) return false;
          }
          if (endDate) {
            const endD = new Date(endDate + "T23:59:59");
            if (isAfter(d, endD)) return false;
          }
        }
      }

      // E) Filtro de Comuna
      if (communeFilter !== 'ALL' && rec.commune !== communeFilter) {
        return false;
      }

      // F) Búsqueda nominal secundaria dentro del resultado
      if (nominalSearch.trim()) {
        const s = normalizeText(nominalSearch);
        const matchesWorker = 
          normalizeText(rec.workerName).includes(s) ||
          normalizeText(rec.workerDni).includes(s) ||
          normalizeText(rec.sector).includes(s) ||
          normalizeText(rec.socialArea).includes(s) ||
          normalizeText(rec.workplaceDepartment).includes(s) ||
          (rec.representativeInfo && normalizeText(rec.representativeInfo).includes(s));

        if (!matchesWorker) return false;
      }

      return true;
    });
  }, [allExtractedRecords, selectedItemQuery, categoryFilter, statusFilter, timeFilter, startDate, endDate, communeFilter, nominalSearch]);

  // 4. Métricas Clave Ejecutivas Calculadas
  const metrics = useMemo(() => {
    const uniqueBeneficiariesSet = new Set<string>();
    let totalPhysicalUnits = 0;
    const communeCountMap: Record<string, number> = {};

    filteredRecords.forEach(rec => {
      // Clave única de persona: cédula limpia o ID
      const personKey = rec.workerDni && rec.workerDni !== 'S/C'
        ? rec.workerDni.replace(/[^0-9]/g, '')
        : rec.workerId;
      
      uniqueBeneficiariesSet.add(personKey);
      totalPhysicalUnits += rec.quantity;

      if (rec.commune && rec.commune !== "NO ESPECIFICADA") {
        communeCountMap[rec.commune] = (communeCountMap[rec.commune] || 0) + 1;
      }
    });

    // Top comuna
    let topCommune = "Sin datos";
    let topCommuneCount = 0;
    Object.entries(communeCountMap).forEach(([commune, count]) => {
      if (count > topCommuneCount) {
        topCommuneCount = count;
        topCommune = commune;
      }
    });

    return {
      totalActs: filteredRecords.length,
      totalUnits: totalPhysicalUnits,
      uniqueBeneficiariesCount: uniqueBeneficiariesSet.size,
      topCommune: topCommuneCount > 0 ? `${topCommune} (${topCommuneCount})` : "General"
    };
  }, [filteredRecords]);

  // Registros ordenados cronológicamente (más recientes primero)
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const timeA = a.deliveryDate ? a.deliveryDate.getTime() : 0;
      const timeB = b.deliveryDate ? b.deliveryDate.getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredRecords]);

  // Paginación reactiva
  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Reiniciar página al cambiar filtros
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedItemQuery, categoryFilter, statusFilter, timeFilter, startDate, endDate, communeFilter, nominalSearch]);

  // 5. Copiar Resumen Ejecutivo al Portapapeles
  const handleCopySummary = () => {
    const itemLabel = selectedItemQuery.trim() ? selectedItemQuery.toUpperCase() : "TODOS LOS RUBROS";
    const dateFormatted = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    
    const summaryText = `📋 ALCALDÍA DEL MUNICIPIO BOLIVARIANO JUAN ANTONIO SOTILLO
DIRECCIÓN DE BIENESTAR SOCIAL · PUERTO LA CRUZ
REPORTE DE BENEFICIARIOS POR ÍTEM / FÁRMACO / AYUDA SOCIAL

🔍 Ítem Consultado: ${itemLabel}
📅 Fecha de Generación: ${dateFormatted}
⏱️ Período Auditado: ${timeFilter === 'all' ? 'Histórico General' : timeFilter === 'month' ? 'Mes en Curso' : timeFilter === 'today' ? 'Hoy' : timeFilter === 'week' ? 'Últimos 7 días' : timeFilter === 'year' ? 'Año en Curso' : 'Rango Personalizado'}
📍 Comuna Filtro: ${communeFilter === 'ALL' ? 'Todas las Comunas' : communeFilter}

📊 CONSOLIDADO CUANTITATIVO:
• 👥 Personas Beneficiadas (Beneficiarios Únicos): ${metrics.uniqueBeneficiariesCount} personas
• 📦 Total Unidades Físicas Entregadas: ${metrics.totalUnits} unidades
• 📑 Total Actas / Despachos Procesados: ${metrics.totalActs} entregas
• 📍 Comuna con Mayor Impacto: ${metrics.topCommune}

Padrón Nominal extraído formalmente del Sistema de Gestión y Bienestar Social Sotillo.`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    toast.success("Resumen ejecutivo copiado al portapapeles. Listo para enviar por WhatsApp o correo.");
    setTimeout(() => setCopied(false), 3000);
  };

  // 6. Exportar a Excel (.xlsx) con Formato Completo
  const handleExportExcel = () => {
    if (sortedRecords.length === 0) {
      toast.error("No hay registros que coincidan con los filtros seleccionados");
      return;
    }

    const itemLabel = selectedItemQuery.trim() ? selectedItemQuery.replace(/[^a-zA-Z0-9]/g, '_') : "TODOS_LOS_RUBROS";
    const workbook = XLSX.utils.book_new();

    // Hoja 1: Resumen y Parámetros
    const summaryData = [
      { "PARÁMETRO / INDICADOR": "Ítem / Fármaco Consultado", "VALOR": selectedItemQuery.trim() || "TODOS LOS RUBROS" },
      { "PARÁMETRO / INDICADOR": "Categoría de Farmacia", "VALOR": categoryFilter.toUpperCase() },
      { "PARÁMETRO / INDICADOR": "Estatus de Entrega", "VALOR": statusFilter === 'delivered' ? "Solo Entregados" : "Todos (Incluye Pendientes)" },
      { "PARÁMETRO / INDICADOR": "Período Temporal", "VALOR": timeFilter.toUpperCase() },
      { "PARÁMETRO / INDICADOR": "Comuna Filtrada", "VALOR": communeFilter === 'ALL' ? "Todas" : communeFilter },
      { "PARÁMETRO / INDICADOR": "Fecha de Emisión", "VALOR": format(new Date(), "yyyy-MM-dd HH:mm") },
      { "PARÁMETRO / INDICADOR": "", "VALOR": "" },
      { "PARÁMETRO / INDICADOR": "BENEFICIARIOS ÚNICOS (PERSONAS REALES)", "VALOR": metrics.uniqueBeneficiariesCount },
      { "PARÁMETRO / INDICADOR": "TOTAL UNIDADES FÍSICAS ENTREGADAS", "VALOR": metrics.totalUnits },
      { "PARÁMETRO / INDICADOR": "TOTAL ACTAS / ENTREGAS PROCESADAS", "VALOR": metrics.totalActs },
      { "PARÁMETRO / INDICADOR": "COMUNA CON MAYOR IMPACTO", "VALOR": metrics.topCommune }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, wsSummary, "Resumen");

    // Hoja 2: Padrón Nominal Detallado
    const nominalData = sortedRecords.map((r, i) => ({
      "N°": i + 1,
      "FECHA DE ENTREGA": r.dateStr,
      "CÉDULA / DNI": r.workerDni,
      "BENEFICIARIO (NOMBRE COMPLETO)": r.workerName,
      "TELÉFONO": r.workerPhone,
      "COMUNA": r.commune,
      "SECTOR": r.sector,
      "ÁREA SOCIAL / ESTRUCTURA": r.socialArea,
      "DEPENDENCIA / ENTE": r.workplaceDepartment || "Comunidad General",
      "CATEGORÍA": r.category === 'medication' ? 'Fármaco' : r.category === 'technical_aid' ? 'Ayuda Humana' : r.category === 'medical_supply' ? 'Insumo/Ayuda Social' : 'Derivación',
      "ÍTEM DESPACHADO": r.rawName,
      "PRESENTACIÓN / ESPECIFICACIÓN": r.presentation,
      "CANTIDAD": r.quantity,
      "MODALIDAD DE ENTREGA": r.recipientType,
      "DATOS DEL REPRESENTANTE": r.representativeInfo || "Retiro Titular",
      "ESTATUS": r.status === 'delivered' ? 'ENTREGADO' : 'PENDIENTE'
    }));
    const wsNominal = XLSX.utils.json_to_sheet(nominalData);
    XLSX.utils.book_append_sheet(workbook, wsNominal, "Padrón Nominal");

    const fileName = `Reporte_Beneficiarios_${itemLabel}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`Reporte Excel exportado exitosamente (${sortedRecords.length} registros).`);
  };

  // 7. Generar Informe Institucional Oficial en PDF con Alcaldía de Sotillo
  const handleExportPdf = () => {
    if (sortedRecords.length === 0) {
      toast.error("No hay registros disponibles para exportar a PDF");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter"
    });

    const itemLabel = selectedItemQuery.trim() ? selectedItemQuery.toUpperCase() : "TODOS LOS RUBROS";
    const dateFormatted = format(new Date(), "dd/MM/yyyy HH:mm");
    const periodLabel = timeFilter === 'all' 
      ? 'Histórico General' 
      : timeFilter === 'month' 
        ? 'Mes en Curso' 
        : timeFilter === 'today' 
          ? 'Hoy' 
          : timeFilter === 'week' 
            ? 'Últimos 7 días' 
            : timeFilter === 'year'
              ? 'Año en Curso'
              : `Personalizado (${startDate || 'Inicio'} al ${endDate || 'Fin'})`;

    // Encabezado Oficial Institucional
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 216, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("ALCALDÍA DEL MUNICIPIO BOLIVARIANO JUAN ANTONIO SOTILLO", 108, 8, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("DIRECCIÓN DE BIENESTAR SOCIAL · PUERTO LA CRUZ, ESTADO ANZOÁTEGUI", 108, 14, { align: "center" });
    doc.setFontSize(7.5);
    doc.text("SISTEMA DE AUDITORÍA NOMINAL Y ASIGNACIÓN DE BENEFICIOS", 108, 19.5, { align: "center" });

    // Título Principal
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("INFORME DE BENEFICIARIOS POR ÍTEM / FÁRMACO / AYUDA SOCIAL", 14, 32);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); // blue-900
    doc.text(`ÍTEM AUDITADO: ${itemLabel}`, 14, 37.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha de Emisión: ${dateFormatted}   |   Período: ${periodLabel}   |   Comuna: ${communeFilter === 'ALL' ? 'Todas las Comunas' : communeFilter}`, 14, 42.5);

    // Tabla Resumen de Métricas Ejecutivas
    autoTable(doc, {
      startY: 46,
      head: [["BENEFICIARIOS ÚNICOS", "TOTAL UNIDADES FÍSICAS", "TOTAL ACTAS / ENTREGAS", "COMUNA DE MAYOR IMPACTO"]],
      body: [
        [
          `${metrics.uniqueBeneficiariesCount} personas`,
          `${metrics.totalUnits} un.`,
          `${metrics.totalActs} entregas`,
          metrics.topCommune
        ]
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7.5 },
      bodyStyles: { halign: "center", fontStyle: "bold", textColor: [15, 23, 42], fontSize: 8.5 },
      margin: { left: 14, right: 14 }
    });

    // Padrón Nominal Detallado
    const tableBody = sortedRecords.map((r, i) => {
      const repText = r.recipientType === 'REPRESENTANTE' && r.representativeInfo 
        ? ` (Rep: ${r.representativeInfo})`
        : '';

      return [
        (i + 1).toString(),
        r.dateStr,
        r.workerDni,
        r.workerName,
        r.workerPhone,
        `${r.commune} - ${r.sector}`,
        `${r.rawName} (${r.quantity} un.)`,
        `${r.socialArea}${repText}`
      ];
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      head: [["N°", "FECHA", "CÉDULA", "BENEFICIARIO", "TELÉFONO", "COMUNA / SECTOR", "ÍTEM Y CANTIDAD", "ESTRUCTURA / RECEPTOR"]],
      body: tableBody,
      theme: "striped",
      styles: { fontSize: 6.8, cellPadding: 1.8, overflow: "linebreak", textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7 },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "center", cellWidth: 16 },
        2: { halign: "center", cellWidth: 18, fontStyle: "bold" },
        3: { cellWidth: 38, fontStyle: "bold" },
        4: { halign: "center", cellWidth: 18 },
        5: { cellWidth: 34 },
        6: { cellWidth: 34, fontStyle: "bold" },
        7: { cellWidth: 22 }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Pie de página institucional
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Dirección de Bienestar Social · Alcaldía de Sotillo · Sistema de Auditoría Social", 14, doc.internal.pageSize.height - 8);
        doc.text(str, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: "right" });
      }
    });

    const fileName = `Informe_Beneficiarios_${itemLabel}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(fileName);
    toast.success("Documento PDF oficial generado y descargado correctamente.");
  };

  // Top 6 sugerencias rápidas de ítems más entregados
  const topSuggestedItems = useMemo(() => {
    return itemCatalog.slice(0, 8);
  }, [itemCatalog]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[96vw] sm:w-[95vw] max-w-[96vw] lg:max-w-6xl xl:max-w-[1340px] h-[94dvh] sm:h-[92dvh] max-h-[94dvh] overflow-hidden flex flex-col p-0 rounded-xl sm:rounded-2xl border-slate-200 shadow-2xl bg-slate-50">
          
          {/* ENCABEZADO INSTITUCIONAL */}
          <DialogHeader className="bg-slate-900 text-white p-4 sm:p-5 pr-14 shrink-0 border-b border-slate-800">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                  <PackageSearch className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black tracking-tight uppercase flex items-center gap-2">
                    <span>Extracción de Beneficiarios por Ítem / Fármaco</span>
                    <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/40 text-[9px] font-bold uppercase tracking-wider">
                      Auditoría Nominal
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-slate-300 text-xs mt-0.5 font-medium">
                    Consulte exactamente qué personas y cuántas han sido beneficiadas con canastillas, medicamentos, sillas de ruedas o insumos específicos.
                  </DialogDescription>
                </div>
              </div>

              {/* Acciones de Exportación y Notificación */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsWhatsAppBroadcastOpen(true)}
                  disabled={sortedRecords.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl h-8 px-3 gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Abrir Centro de Difusión WhatsApp para enviar mensaje personalizado a este grupo"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Notificar WhatsApp</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 text-[11px] font-bold rounded-xl h-8 px-3 gap-1.5 cursor-pointer shadow-xs"
                  title="Copiar resumen ejecutivo para WhatsApp"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "¡Copiado!" : "Copiar Resumen"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={sortedRecords.length === 0}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-600 text-[11px] font-bold rounded-xl h-8 px-3 gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Exportar base completa a Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar Excel</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={sortedRecords.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl h-8 px-3.5 gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Descargar informe institucional en PDF para firma y despacho"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Informe PDF</span>
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* PANEL DE CONTROL: BUSCADOR INTELIGENTE Y FILTROS */}
          <div className="p-4 sm:p-5 bg-white border-b border-slate-200 shrink-0 space-y-3">
            {/* Fila 1: Selector / Buscador del Ítem + Categoría */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              
              {/* Buscador de Ítem con Autocompletado */}
              <div className="md:col-span-6 relative">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Ítem, Fármaco o Ayuda a Extraer:
                </label>
                <div className="relative">
                  <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600" />
                  <Input
                    list="itemSuggestions"
                    placeholder="EJ: CANASTILLA, LOSARTAN, SILLA DE RUEDAS, PAÑAL..."
                    className="pl-9 pr-8 h-9 text-xs font-bold border-slate-300 uppercase tracking-wide text-slate-900 bg-slate-50/60 focus:bg-white"
                    value={selectedItemQuery}
                    onChange={(e) => setSelectedItemQuery(e.target.value)}
                  />
                  {selectedItemQuery && (
                    <button
                      type="button"
                      onClick={() => setSelectedItemQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Datalist con nombres populares extraídos */}
                  <datalist id="itemSuggestions">
                    {itemCatalog.slice(0, 40).map((it) => (
                      <option key={it.key} value={it.name}>
                        {it.name} ({it.totalActs} entregas / {it.uniqueBeneficiariesCount} personas)
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Categoría de Farmacia */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Rubro / Categoría:
                </label>
                <Select 
                  value={categoryFilter} 
                  onValueChange={(val: any) => setCategoryFilter(val)}
                >
                  <SelectTrigger className="h-9 text-xs font-bold border-slate-300 bg-white">
                    <SelectValue placeholder="Todas las Categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold">Todos los Rubros</SelectItem>
                    <SelectItem value="medication" className="text-xs font-bold">💊 Fármacos y Medicamentos</SelectItem>
                    <SelectItem value="medical_supply" className="text-xs font-bold">📦 Insumos y Ayudas Sociales</SelectItem>
                    <SelectItem value="technical_aid" className="text-xs font-bold">♿ Ayudas Humanas y Técnicas</SelectItem>
                    <SelectItem value="medical_derivation" className="text-xs font-bold">🩺 Atenciones y Derivaciones</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Estatus de Entrega */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Estatus de Despacho:
                </label>
                <Select 
                  value={statusFilter} 
                  onValueChange={(val: any) => setStatusFilter(val)}
                >
                  <SelectTrigger className="h-9 text-xs font-bold border-slate-300 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivered" className="text-xs font-bold text-emerald-800">
                      ✓ Solo Entregados (Efectivos)
                    </SelectItem>
                    <SelectItem value="all" className="text-xs font-bold text-slate-700">
                      Todos (Incluye Pendientes)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fila 2: Sugerencias Rápidas de Ítems Populares */}
            {topSuggestedItems.length > 0 && !selectedItemQuery && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Más Solicitados:
                </span>
                {topSuggestedItems.map(it => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setSelectedItemQuery(it.name)}
                    className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-md border border-slate-200 transition-colors uppercase tracking-tight"
                  >
                    {it.name} <span className="text-slate-400 font-normal">({it.uniqueBeneficiariesCount} pers.)</span>
                  </button>
                ))}
              </div>
            )}

            {/* Fila 3: Filtro Temporal y Territorial (Comuna) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
              {/* Botones de Rango Rápido */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                {(['all', 'today', 'week', 'month', 'year', 'custom'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTimeFilter(tab)}
                    className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-all ${
                      timeFilter === tab 
                        ? 'bg-blue-900 text-white shadow-2xs' 
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab === 'all' ? 'Histórico' : tab === 'today' ? 'Hoy' : tab === 'week' ? '7 Días' : tab === 'month' ? 'Mes' : tab === 'year' ? 'Año' : 'Rango'}
                  </button>
                ))}
              </div>

              {/* Rango Personalizado */}
              {timeFilter === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <Input
                    type="date"
                    className="h-7 text-[11px] w-32 bg-white"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-slate-400 text-xs">-</span>
                  <Input
                    type="date"
                    className="h-7 text-[11px] w-32 bg-white"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}

              {/* Selector de Comuna */}
              <div className="flex items-center gap-1.5 ml-auto">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <Select value={communeFilter} onValueChange={setCommuneFilter}>
                  <SelectTrigger className="h-8 text-xs font-bold border-slate-300 w-52 bg-white">
                    <SelectValue placeholder="Todas las Comunas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs font-bold">Todas las Comunas</SelectItem>
                    {availableCommunes.map(c => (
                      <SelectItem key={c} value={c} className="text-xs font-medium">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* CUADRO DE MÉTRICAS CLAVE (KPIs EJECUTIVOS) */}
          <div className="p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-100/70 border-b border-slate-200 shrink-0">
            {/* Card 1: Beneficiarios Únicos */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Beneficiarios Únicos</span>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {metrics.uniqueBeneficiariesCount.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                Personas reales atendidas
              </p>
            </div>

            {/* Card 2: Unidades Físicas Despachadas */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Unidades</span>
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {metrics.totalUnits.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                Unidades físicas entregadas
              </p>
            </div>

            {/* Card 3: Total Actas / Despachos */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Actas / Sesiones</span>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {metrics.totalActs.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                Despachos en libro de actas
              </p>
            </div>

            {/* Card 4: Comuna con Mayor Impacto */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Mayor Impacto</span>
                <Building2 className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-sm font-black text-slate-900 tracking-tight truncate" title={metrics.topCommune}>
                {metrics.topCommune}
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                Territorio con mayor cobertura
              </p>
            </div>
          </div>

          {/* TABLA NOMINAL DETALLADA DE PERSONAS BENEFICIADAS */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {/* Cabecera de la lista con buscador interno */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Padrón Nominal de Personas Beneficiadas</span>
                  <Badge variant="secondary" className="text-[10px] font-black bg-blue-100 text-blue-900">
                    {sortedRecords.length} Registros
                  </Badge>
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">
                  {selectedItemQuery ? `Filtrando personas que recibieron: "${selectedItemQuery.toUpperCase()}"` : 'Mostrando todas las atenciones registradas'}
                </p>
              </div>

              {/* Búsqueda nominal rápida en tabla */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="FILTRAR POR NOMBRE, CÉDULA, SECTOR..."
                  className="pl-8 pr-7 h-8 text-[11px] font-bold border-slate-300 uppercase tracking-wide bg-white"
                  value={nominalSearch}
                  onChange={(e) => setNominalSearch(e.target.value)}
                />
                {nominalSearch && (
                  <button
                    type="button"
                    onClick={() => setNominalSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Contenedor de la Tabla */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
                      <th className="py-2.5 px-3 text-center w-12">N°</th>
                      <th className="py-2.5 px-3 w-24">Fecha</th>
                      <th className="py-2.5 px-3 w-28">Cédula</th>
                      <th className="py-2.5 px-3">Beneficiario / Paciente</th>
                      <th className="py-2.5 px-3 w-28">Teléfono</th>
                      <th className="py-2.5 px-3">Comuna / Sector</th>
                      <th className="py-2.5 px-3">Estructura Social</th>
                      <th className="py-2.5 px-3">Ítem & Cantidad</th>
                      <th className="py-2.5 px-3">Modalidad</th>
                      <th className="py-2.5 px-3 text-center w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          <PackageSearch className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                            No se encontraron personas beneficiadas con los filtros actuales
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Verifique el término de búsqueda o seleccione otro rango de tiempo / comuna.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedRecords.map((rec, index) => {
                        const globalIndex = (currentPage - 1) * pageSize + index + 1;
                        return (
                          <tr 
                            key={rec.recordId} 
                            className="hover:bg-indigo-50/40 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-center font-bold text-slate-400 text-[11px]">
                              {globalIndex}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap text-[11px]">
                              {rec.dateStr}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">
                              {rec.workerDni}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 uppercase">
                              <div className="flex items-center gap-1.5">
                                <span>{rec.workerName}</span>
                                {rec.worker && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-200 text-slate-500 font-bold uppercase">
                                    {rec.worker.gender === 'F' ? 'Fem' : rec.worker.gender === 'M' ? 'Masc' : ''}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {rec.workerPhone && rec.workerPhone !== 'S/T' ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {rec.workerPhone}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Sin teléfono</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              <div className="font-bold text-slate-800 uppercase line-clamp-1" title={rec.commune}>
                                {rec.commune}
                              </div>
                              <div className="text-[10px] text-slate-500 uppercase line-clamp-1" title={rec.sector}>
                                {rec.sector}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 text-[9px] font-bold uppercase tracking-tight">
                                {rec.socialArea}
                              </Badge>
                              {rec.workplaceDepartment && (
                                <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 line-clamp-1">
                                  {rec.workplaceDepartment}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              <div className="font-black text-indigo-950 uppercase">
                                {rec.rawName}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                  Cant: {rec.quantity} un.
                                </span>
                                {rec.presentation && (
                                  <span className="truncate max-w-[140px] text-slate-500 font-medium" title={rec.presentation}>
                                    · {rec.presentation}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[10px]">
                              {rec.recipientType === 'REPRESENTANTE' ? (
                                <div className="text-amber-800 bg-amber-50 p-1 rounded border border-amber-200" title={rec.representativeInfo}>
                                  <span className="font-bold block">Retiro Apoderado</span>
                                  <span className="text-[9px] line-clamp-1">{rec.representativeInfo}</span>
                                </div>
                              ) : (
                                <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                                  Titular Directo
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {rec.worker ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedWorkerForExpediente(rec.worker!)}
                                  className="h-7 px-2 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 gap-1 rounded-md"
                                  title="Ver expediente clínico e historial completo del paciente"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Expediente</span>
                                </Button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold">N/D</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginador */}
              {sortedRecords.length > pageSize && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 text-[11px] font-medium">
                    Mostrando <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> al <strong className="text-slate-800">{Math.min(currentPage * pageSize, sortedRecords.length)}</strong> de <strong className="text-slate-800">{sortedRecords.length}</strong> entregas registradas.
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-lg"
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
                    </Button>
                    <span className="text-[11px] font-bold text-slate-700 px-2">
                      Pág. {currentPage} de {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-lg"
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PIE DE PÁGINA DEL MODAL */}
          <div className="p-3.5 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span className="font-bold text-slate-700 uppercase">Dirección de Bienestar Social:</span>
              <span>Total de beneficiarios únicos identificados: <strong className="text-indigo-900 font-bold">{metrics.uniqueBeneficiariesCount}</strong> personas</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold text-slate-700 hover:bg-slate-200 h-8 px-4 rounded-xl"
            >
              Cerrar
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      {/* MODAL SECUNDARIO: EXPEDIENTE COMPLETO DEL PACIENTE */}
      <Dialog 
        open={!!selectedWorkerForExpediente} 
        onOpenChange={(open) => !open && setSelectedWorkerForExpediente(null)}
      >
        <DialogContent className="z-[80] w-[96vw] sm:w-[95vw] max-w-[96vw] lg:max-w-6xl xl:max-w-[1440px] h-[94dvh] sm:h-[92dvh] max-h-[94dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
          {selectedWorkerForExpediente && (
            <WorkerExpediente 
              worker={selectedWorkerForExpediente} 
              onClose={() => setSelectedWorkerForExpediente(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE DIFUSIÓN WHATSAPP PARA EL GRUPO FILTRADO */}
      <WhatsAppBroadcastModal
        isOpen={isWhatsAppBroadcastOpen}
        onClose={() => setIsWhatsAppBroadcastOpen(false)}
        workers={workers}
        recipes={recipes}
        initialItemFilter={selectedItemQuery}
      />
    </>
  );
}
