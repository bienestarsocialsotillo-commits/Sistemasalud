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
  Award, 
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
  HeartHandshake
} from "lucide-react";
import { format, isSameDay, isAfter, subDays, startOfMonth, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Worker, MedicationRecipe } from '@/types';
import { SOCIAL_AREAS } from '@/constants';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SocialAreaReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  recipes: MedicationRecipe[];
  initialSocialArea?: string;
}

const parseDateSafe = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (val?.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function SocialAreaReportModal({
  isOpen,
  onClose,
  workers,
  recipes,
  initialSocialArea = "JEFE UBCH"
}: SocialAreaReportModalProps) {
  const [selectedSocialArea, setSelectedSocialArea] = useState<string>(initialSocialArea);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [nominalSearch, setNominalSearch] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Sincronizar si cambia initialSocialArea
  React.useEffect(() => {
    if (initialSocialArea) {
      setSelectedSocialArea(initialSocialArea);
    }
  }, [initialSocialArea]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = subDays(todayStart, 6);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  // 1. Filtrar ciudadanos por Razón Social y Dependencia
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      // Filtro de Razón Social
      if (selectedSocialArea !== 'ALL') {
        const targetUpper = selectedSocialArea.toUpperCase();
        const matchesArea = 
          (w.socialAreas && w.socialAreas.some(a => a.toUpperCase() === targetUpper || a.toUpperCase().includes(targetUpper))) ||
          (w.socialArea ? w.socialArea.toUpperCase().includes(targetUpper) : false);

        if (!matchesArea) return false;
      }

      // Filtro de Dependencia (si aplica para Trabajador de la Alcaldía)
      if (departmentFilter.trim()) {
        const depTerm = departmentFilter.trim().toUpperCase();
        const workerDep = (w.workplaceDepartment || "").toUpperCase();
        if (!workerDep.includes(depTerm)) return false;
      }

      return true;
    });
  }, [workers, selectedSocialArea, departmentFilter]);

  const workerMap = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach(w => map.set(w.id, w));
    return map;
  }, [workers]);

  const filteredWorkerIdsSet = useMemo(() => {
    return new Set(filteredWorkers.map(w => w.id));
  }, [filteredWorkers]);

  // 2. Filtrar entregas de esos ciudadanos en el período
  const filteredDeliveries = useMemo(() => {
    return recipes.filter(r => {
      if (r.status !== 'delivered') return false;
      if (!filteredWorkerIdsSet.has(r.workerId)) return false;

      // Filtro temporal
      if (timeFilter !== 'all') {
        const d = parseDateSafe(r.deliveredAt || r.createdAt);
        if (!d) return false;
        if (timeFilter === 'today' && !isSameDay(d, now)) return false;
        if (timeFilter === 'week' && !(isAfter(d, weekStart) || isSameDay(d, weekStart))) return false;
        if (timeFilter === 'month' && !(isAfter(d, monthStart) || isSameDay(d, monthStart))) return false;
        if (timeFilter === 'year' && !(isAfter(d, yearStart) || isSameDay(d, yearStart))) return false;
      }

      return true;
    });
  }, [recipes, filteredWorkerIdsSet, timeFilter, weekStart, monthStart, yearStart, now]);

  // 3. Cálculos Cuantitativos Exactos (Métricas en Números)
  const metrics = useMemo(() => {
    const totalCensus = filteredWorkers.length;
    const beneficiaryIds = new Set(filteredDeliveries.map(r => r.workerId));
    const totalBeneficiaries = beneficiaryIds.size;
    const coveragePercentage = totalCensus > 0 
      ? ((totalBeneficiaries / totalCensus) * 100).toFixed(1) 
      : "0.0";

    const totalOrders = filteredDeliveries.length;

    let totalPhysicalUnits = 0;
    let medUnits = 0;
    let techAidUnits = 0;
    let urnUnits = 0;
    let supplyUnits = 0;

    const itemCountsMap = new Map<string, { name: string; category: string; quantity: number }>();

    filteredDeliveries.forEach(r => {
      const cat = r.category || (r.requiresTechnicalAid ? 'technical_aid' : 'medication');

      // Detectar si es Urna Funeraria o Servicio Funerario
      const aidName = (r.technicalAidType || r.medication || "").toLowerCase();
      const isUrn = aidName.includes('urna') || aidName.includes('ataud') || aidName.includes('ataúd') || aidName.includes('funerari');

      // Caso 1: Array de medicamentos
      if (cat === 'medication' && Array.isArray(r.medications) && r.medications.length > 0) {
        r.medications.forEach(m => {
          const q = Number(m.quantity) || 1;
          const name = m.medication?.trim() || "Fármaco";
          totalPhysicalUnits += q;
          medUnits += q;

          const existing = itemCountsMap.get(name) || { name, category: 'Fármaco', quantity: 0 };
          existing.quantity += q;
          itemCountsMap.set(name, existing);
        });
      }
      // Caso 2: Array de insumos
      else if (cat === 'medical_supply' && Array.isArray(r.medicalSupplies) && r.medicalSupplies.length > 0) {
        r.medicalSupplies.forEach(s => {
          const q = Number(s.quantity) || 1;
          const name = s.supplyName?.trim() || "Insumo Médico";
          totalPhysicalUnits += q;
          supplyUnits += q;

          const existing = itemCountsMap.get(name) || { name, category: 'Insumo', quantity: 0 };
          existing.quantity += q;
          itemCountsMap.set(name, existing);
        });
      }
      // Caso 3: Registro individual
      else {
        const q = (cat === 'technical_aid' && r.technicalAidQuantity)
          ? Number(r.technicalAidQuantity)
          : (Number(r.quantity) || 1);

        totalPhysicalUnits += q;

        let itemCategoryLabel = 'Fármaco';
        if (isUrn) {
          urnUnits += q;
          itemCategoryLabel = 'Servicio Funerario / Urna';
        } else if (cat === 'technical_aid') {
          techAidUnits += q;
          itemCategoryLabel = 'Ayuda Humana';
        } else if (cat === 'medical_supply') {
          supplyUnits += q;
          itemCategoryLabel = 'Insumo';
        } else {
          medUnits += q;
          itemCategoryLabel = 'Fármaco';
        }

        const name = (r.technicalAidType || r.medication || "Insumo").trim();
        const existing = itemCountsMap.get(name) || { name, category: itemCategoryLabel, quantity: 0 };
        existing.quantity += q;
        itemCountsMap.set(name, existing);
      }
    });

    // Ordenar ranking de ítems de mayor a menor cantidad
    const topItems = Array.from(itemCountsMap.values())
      .sort((a, b) => b.quantity - a.quantity);

    return {
      totalCensus,
      totalBeneficiaries,
      coveragePercentage,
      totalOrders,
      totalPhysicalUnits,
      medUnits,
      techAidUnits,
      urnUnits,
      supplyUnits,
      topItems
    };
  }, [filteredWorkers, filteredDeliveries]);

  // 4. Lista nominal con filtro de búsqueda interno
  const searchedNominalList = useMemo(() => {
    if (!nominalSearch.trim()) return filteredDeliveries;
    const term = nominalSearch.trim().toLowerCase();

    return filteredDeliveries.filter(r => {
      const worker = workerMap.get(r.workerId);
      const name = (worker?.fullName || "").toLowerCase();
      const dni = (worker?.dni || "").toLowerCase();
      const item = (r.technicalAidType || r.medication || "").toLowerCase();
      const commune = (r.commune || worker?.commune || "").toLowerCase();
      const dep = (worker?.workplaceDepartment || "").toLowerCase();

      return name.includes(term) || dni.includes(term) || item.includes(term) || commune.includes(term) || dep.includes(term);
    });
  }, [filteredDeliveries, nominalSearch, workerMap]);

  // 5. Copiar Texto Redactado Oficial al Portapapeles
  const handleCopyReportText = () => {
    const areaTitle = selectedSocialArea === 'ALL' ? 'TODAS LAS ESTRUCTURAS SOCIALES' : selectedSocialArea;
    const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

    let topItemsText = "";
    metrics.topItems.slice(0, 10).forEach((item, idx) => {
      topItemsText += `   ${idx + 1}. ${item.name} (${item.category}): ${item.quantity} unidades\n`;
    });

    const reportText = `📋 INFORME EJECUTIVO DE GESTIÓN SOCIAL Y ENTREGAS
Alcaldía del Municipio Bolivariano Juan Antonio Sotillo
Dirección de Salud y Bienestar Social - Puerto La Cruz
Fecha de Emisión: ${dateStr}

────────────────────────────────────────────
OBJETIVO: RENDICIÓN DE CUENTAS - ESTRUCTURA SOCIAL
Sector Evaluado: ${areaTitle}${departmentFilter ? ` (Dependencia: ${departmentFilter.toUpperCase()})` : ''}
Período Auditado: ${timeFilter === 'all' ? 'Histórico General' : timeFilter === 'month' ? 'Mes en Curso' : timeFilter === 'year' ? 'Año en Curso' : 'Reciente'}

1. TOTALES CUANTITATIVOS EN NÚMEROS:
• Censo Total Registrado: ${metrics.totalCensus} personas
• Beneficiarios Atendidos con Ayudas: ${metrics.totalBeneficiaries} personas
• Cobertura Social Alcanzada: ${metrics.coveragePercentage}%
• Total de Órdenes / Despachos Procesados: ${metrics.totalOrders} entregas
• Total de Unidades Físicas Entregadas: ${metrics.totalPhysicalUnits} unidades

2. DESGLOSE NUMÉRICO POR TIPO DE AYUDA:
• 💊 Fármacos y Medicamentos: ${metrics.medUnits} unidades
• ♿ Ayudas Humanas y Técnicas: ${metrics.techAidUnits} unidades
• ⚰️ Donaciones de Urnas / Servicios Funerarios: ${metrics.urnUnits} unidades
• 📦 Insumos Médicos y Quirúrgicos: ${metrics.supplyUnits} unidades

3. PRINCIPALES INSUMOS Y FÁRMACOS ENTREGADOS (TOP):
${topItemsText || '   (Sin entregas registradas en el período seleccionado)'}
────────────────────────────────────────────
Reporte oficial emitido para control de gestión, contraloría social y supervisión municipal.`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    toast.success("¡Texto del informe copiado con éxito! Listo para pegar en Word, correo o WhatsApp.");
    setTimeout(() => setCopied(false), 3000);
  };

  // 6. Exportar a Excel con 2 Hojas (Resumen Cuantitativo + Detalle Nominal)
  const handleExportExcel = () => {
    if (filteredDeliveries.length === 0 && filteredWorkers.length === 0) {
      toast.error("No hay datos disponibles para exportar con los filtros seleccionados");
      return;
    }

    const areaTitle = selectedSocialArea === 'ALL' ? 'TODAS_LAS_ESTRUCTURAS' : selectedSocialArea.replace(/\s+/g, '_');
    const workbook = XLSX.utils.book_new();

    // Hoja 1: Resumen Cuantitativo y Ranking
    const summaryData = [
      { "MÉTRICA / INDICADOR": "Estructura Social Evaluada", "VALOR / TOTAL": selectedSocialArea },
      { "MÉTRICA / INDICADOR": "Dependencia / Ente Municipal", "VALOR / TOTAL": departmentFilter || "Todas" },
      { "MÉTRICA / INDICADOR": "Fecha de Generación", "VALOR / TOTAL": format(new Date(), "yyyy-MM-dd HH:mm") },
      { "MÉTRICA / INDICADOR": "Censo Total de Personas", "VALOR / TOTAL": metrics.totalCensus },
      { "MÉTRICA / INDICADOR": "Personas Beneficiadas con Ayudas", "VALOR / TOTAL": metrics.totalBeneficiaries },
      { "MÉTRICA / INDICADOR": "Porcentaje de Cobertura Social", "VALOR / TOTAL": `${metrics.coveragePercentage}%` },
      { "MÉTRICA / INDICADOR": "Total Órdenes Despachadas", "VALOR / TOTAL": metrics.totalOrders },
      { "MÉTRICA / INDICADOR": "TOTAL UNIDADES FÍSICAS ENTREGADAS", "VALOR / TOTAL": metrics.totalPhysicalUnits },
      { "MÉTRICA / INDICADOR": "— Fármacos Entregados (Unidades)", "VALOR / TOTAL": metrics.medUnits },
      { "MÉTRICA / INDICADOR": "— Ayudas Humanas / Técnicas (Unidades)", "VALOR / TOTAL": metrics.techAidUnits },
      { "MÉTRICA / INDICADOR": "— Urnas Funerarias Donadas (Unidades)", "VALOR / TOTAL": metrics.urnUnits },
      { "MÉTRICA / INDICADOR": "— Insumos Médicos (Unidades)", "VALOR / TOTAL": metrics.supplyUnits },
      { "MÉTRICA / INDICADOR": "", "VALOR / TOTAL": "" },
      { "MÉTRICA / INDICADOR": "=== TOP DE ÍTEMS Y FÁRMACOS ENTREGADOS ===", "VALOR / TOTAL": "UNIDADES" },
      ...metrics.topItems.map(item => ({
        "MÉTRICA / INDICADOR": `${item.name} (${item.category})`,
        "VALOR / TOTAL": item.quantity
      }))
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, wsSummary, "Resumen Cuantitativo");

    // Hoja 2: Detalle Nominal
    const detailData = filteredDeliveries.map(r => {
      const worker = workerMap.get(r.workerId);
      const deliveryDate = parseDateSafe(r.deliveredAt || r.createdAt);
      const cat = r.category || (r.requiresTechnicalAid ? 'technical_aid' : 'medication');
      const catLabel = cat === 'medication' ? 'Fármaco' : cat === 'technical_aid' ? 'Ayuda Humana' : cat === 'medical_supply' ? 'Insumo' : 'Derivación';
      const itemName = r.technicalAidType || r.medication || "Insumo";
      const qty = (cat === 'technical_aid' && r.technicalAidQuantity) ? Number(r.technicalAidQuantity) : (Number(r.quantity) || 1);

      return {
        "Fecha de Entrega": deliveryDate ? format(deliveryDate, "yyyy-MM-dd HH:mm") : "S/D",
        "Beneficiario": worker?.fullName || "No identificado",
        "Cédula": worker?.dni || "S/D",
        "Razón Social": worker?.socialArea || selectedSocialArea,
        "Dependencia / Ente": worker?.workplaceDepartment || "N/A",
        "Comuna": r.commune || worker?.commune || "S/D",
        "Sector": worker?.sector || "S/D",
        "Categoría": catLabel,
        "Insumo / Fármaco": itemName,
        "Cantidad": qty,
        "Modalidad": r.isDeliveredToRepresentative ? `Apoderado: ${r.representativeFullName}` : "Titular Directo",
        "Funcionario Responsable": r.deliveryOfficer || r.deliveredBy || "Alcaldía de Sotillo",
        "Observación": r.deliveryNotes || ""
      };
    });

    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(workbook, wsDetail, "Detalle Nominal de Entregas");

    XLSX.writeFile(workbook, `Informe_Ayudas_${areaTitle}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Archivo Excel exportado exitosamente con 2 hojas (Resumen + Detalle).");
  };

  // 7. Exportar Informe PDF Oficial Membretado
  const handleExportPdf = () => {
    if (filteredDeliveries.length === 0 && filteredWorkers.length === 0) {
      toast.error("No hay datos disponibles para generar el PDF");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter"
    });

    const areaTitle = selectedSocialArea === 'ALL' ? 'TODAS LAS ESTRUCTURAS SOCIALES' : selectedSocialArea;
    const dateFormatted = format(new Date(), "dd/MM/yyyy hh:mm a");
    const timeFilterLabel = timeFilter === 'all' 
      ? 'Histórico General' 
      : timeFilter === 'month' 
        ? 'Mes en Curso' 
        : timeFilter === 'today' 
          ? 'Hoy' 
          : timeFilter === 'week' 
            ? 'Últimos 7 días' 
            : 'Año en Curso';

    // Encabezado Institucional Oficial
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 216, 25, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ALCALDÍA DEL MUNICIPIO BOLIVARIANO JUAN ANTONIO SOTILLO", 108, 9, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("DIRECCIÓN DE BIENESTAR SOCIAL", 108, 15, { align: "center" });
    doc.setFontSize(7.5);
    doc.text("SISTEMA DE GESTIÓN Y AUDITORÍA DE ATENCIÓN Y AYUDAS SOCIALES · PUERTO LA CRUZ", 108, 20.5, { align: "center" });

    // Título Oficial del Informe y Razón Social
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("INFORME EJECUTIVO DE ATENCIÓN Y AYUDAS SOCIALES", 14, 33);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); // blue-900
    doc.text(`Razón Social: ${areaTitle}${departmentFilter ? ` · Dependencia / Ente: ${departmentFilter.toUpperCase()}` : ''}`, 14, 38.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha de Emisión: ${dateFormatted}   |   Período Auditado: ${timeFilterLabel}`, 14, 43.5);

    // 1. RESUMEN DE TOTALES (Consolidado Cuantitativo)
    autoTable(doc, {
      startY: 47,
      head: [["POBLACIÓN EN CENSO", "BENEFICIARIOS ATENDIDOS", "COBERTURA", "TOTAL ENTREGAS", "TOTAL UNIDADES FÍSICAS"]],
      body: [
        [
          `${metrics.totalCensus} personas`,
          `${metrics.totalBeneficiaries} atendidos`,
          `${metrics.coveragePercentage}%`,
          `${metrics.totalOrders} órdenes`,
          `${metrics.totalPhysicalUnits} unidades`
        ]
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7.5 },
      bodyStyles: { halign: "center", fontStyle: "bold", textColor: [15, 23, 42], fontSize: 8.5 },
      margin: { left: 14, right: 14 }
    });

    // Desglose por Rubro de Ayuda
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      head: [["FÁRMACOS Y MEDICAMENTOS", "AYUDAS HUMANAS / TÉCNICAS", "DONACIONES DE URNAS", "INSUMOS MÉDICOS"]],
      body: [
        [
          `${metrics.medUnits} un.`,
          `${metrics.techAidUnits} un.`,
          `${metrics.urnUnits} donaciones`,
          `${metrics.supplyUnits} un.`
        ]
      ],
      theme: "grid",
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7.5 },
      bodyStyles: { halign: "center", fontStyle: "bold", textColor: [30, 58, 138], fontSize: 8.5 },
      margin: { left: 14, right: 14 }
    });

    // 2. LISTADO DETALLADO COMPLETO DE PACIENTES Y ENTREGAS (Sin límite de corte / Sin slice)
    const nominalRows = filteredDeliveries.map((r, i) => {
      const worker = workerMap.get(r.workerId);
      const deliveryDate = parseDateSafe(r.deliveredAt || r.createdAt);
      const cat = r.category || (r.requiresTechnicalAid ? 'technical_aid' : 'medication');

      let itemName = "";
      let qty = 1;

      if (cat === 'medication' && Array.isArray(r.medications) && r.medications.length > 0) {
        itemName = r.medications.map(m => `${m.medication?.trim() || 'Fármaco'} (${m.quantity || 1})`).join(", ");
        qty = r.medications.reduce((acc, m) => acc + (Number(m.quantity) || 1), 0);
      } else if (cat === 'medical_supply' && Array.isArray(r.medicalSupplies) && r.medicalSupplies.length > 0) {
        itemName = r.medicalSupplies.map(s => `${s.supplyName?.trim() || 'Insumo'} (${s.quantity || 1})`).join(", ");
        qty = r.medicalSupplies.reduce((acc, s) => acc + (Number(s.quantity) || 1), 0);
      } else {
        itemName = (r.technicalAidType || r.medication || "Insumo").trim();
        qty = (cat === 'technical_aid' && r.technicalAidQuantity)
          ? Number(r.technicalAidQuantity)
          : (Number(r.quantity) || 1);
      }

      // Ubicación o Dependencia institucional
      const location = worker?.workplaceDepartment 
        ? worker.workplaceDepartment 
        : (worker?.commune || r.commune || worker?.sector || "S/D");

      return [
        i + 1,
        deliveryDate ? format(deliveryDate, "dd/MM/yyyy") : "S/D",
        worker?.dni || "S/D",
        worker?.fullName || "Beneficiario",
        location,
        itemName,
        qty
      ];
    });

    const currentY = (doc as any).lastAutoTable.finalY + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`LISTADO DETALLADO DE PACIENTES Y ENTREGAS REALIZADAS (${filteredDeliveries.length} registros auditados):`, 14, currentY);

    autoTable(doc, {
      startY: currentY + 3,
      head: [["#", "FECHA", "CÉDULA", "BENEFICIARIO (PACIENTE)", "DEPENDENCIA / COMUNA", "AYUDA / INSUMO ENTREGADO", "CANT."]],
      body: nominalRows.length > 0 ? nominalRows : [["-", "-", "-", "Sin entregas registradas en este grupo", "-", "-", "0"]],
      theme: "striped",
      showHead: 'everyPage',
      headStyles: { 
        fillColor: [30, 58, 138], 
        textColor: 255, 
        fontSize: 7, 
        fontStyle: "bold",
        halign: "left"
      },
      bodyStyles: { 
        fontSize: 6.8, 
        textColor: [15, 23, 42] 
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 17 },
        2: { halign: 'center', cellWidth: 20 },
        3: { fontStyle: 'bold', cellWidth: 42 },
        4: { cellWidth: 35 },
        5: { cellWidth: 54 },
        6: { halign: 'center', cellWidth: 12, fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 15 }
    });

    // NOTA: Se excluye el Bloque de Firmas y Aval Institucional según indicación expresa del usuario.
    // En su lugar, se inserta la numeración oficial en cada página del documento.
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Alcaldía del Municipio Bolivariano Juan Antonio Sotillo · Dirección de Bienestar Social · Página ${i} de ${pageCount} (Total entregas auditadas: ${filteredDeliveries.length})`,
        108,
        272,
        { align: "center" }
      );
    }

    doc.save(`Informe_Ejecutivo_${areaTitle.replace(/\s+/g, '_')}_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success(`Informe PDF generado con éxito (${filteredDeliveries.length} entregas incluidas sin truncar).`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:w-[94vw] max-w-[96vw] md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
        <DialogHeader className="p-3.5 sm:p-5 pr-14 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <span>Informe Cuantitativo de Ayudas por Razón Social</span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-300 font-medium mt-0.5">
                  Consolidado numérico, cobertura de entregas y auditoría nominal de insumos despachados
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={handleCopyReportText}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider h-8 rounded-lg gap-1.5 shadow-xs"
              title="Copiar texto formal redactado para pegar directo en Word o informe"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "¡Copiado!" : "Copiar Texto"}</span>
            </Button>

            <Button
              type="button"
              onClick={handleExportPdf}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider h-8 rounded-lg gap-1.5 shadow-xs"
              title="Descargar informe oficial en formato PDF listo para firmar"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Generar PDF</span>
            </Button>

            <Button
              type="button"
              onClick={handleExportExcel}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider h-8 rounded-lg gap-1.5 shadow-xs"
              title="Exportar archivo Excel con resumen cuantitativo y detalle"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="p-3 sm:p-5 space-y-4 sm:space-y-5 bg-slate-50/60">
          {/* PANEL DE SELECCIÓN DE RAZÓN SOCIAL Y FILTROS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Seleccione la Razón Social a Auditar:
                </span>
                <p className="text-[11px] text-slate-500">
                  Haga 1 clic sobre la estructura deseada para recalcular de inmediato todas las cifras numéricas:
                </p>
              </div>

              {/* Filtro Temporal */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Período:</span>
                <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                  <SelectTrigger className="h-8 w-36 bg-slate-50 border-slate-300 text-xs font-bold rounded-lg">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🏛️ Histórico Total</SelectItem>
                    <SelectItem value="today">📅 Entregados Hoy</SelectItem>
                    <SelectItem value="week">📆 Esta Semana</SelectItem>
                    <SelectItem value="month">🗓️ Este Mes</SelectItem>
                    <SelectItem value="year">📅 Este Año</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Botones de Selección Rápida */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedSocialArea("JEFE UBCH")}
                className={`text-xs font-black uppercase px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSocialArea === "JEFE UBCH"
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm scale-102'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                ⭐ Jefes de UBCH
              </button>

              <button
                type="button"
                onClick={() => setSelectedSocialArea("TRABAJADOR DE LA ALCALDIA")}
                className={`text-xs font-black uppercase px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSocialArea === "TRABAJADOR DE LA ALCALDIA"
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm scale-102'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                ⭐ Trabajadores Alcaldía
              </button>

              <button
                type="button"
                onClick={() => setSelectedSocialArea("LIDER DE CALLE")}
                className={`text-xs font-black uppercase px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSocialArea === "LIDER DE CALLE"
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm scale-102'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                Líderes de Calle
              </button>

              <button
                type="button"
                onClick={() => setSelectedSocialArea("VOCERO CONSEJO COMUNAL")}
                className={`text-xs font-black uppercase px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSocialArea === "VOCERO CONSEJO COMUNAL"
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm scale-102'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                Voceros Comunales
              </button>

              <button
                type="button"
                onClick={() => setSelectedSocialArea("ADULTO MAYOR")}
                className={`text-xs font-black uppercase px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSocialArea === "ADULTO MAYOR"
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm scale-102'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                Adulto Mayor
              </button>

              <button
                type="button"
                onClick={() => setSelectedSocialArea("EMBARAZADA")}
                className={`text-xs font-black uppercase px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSocialArea === "EMBARAZADA"
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm scale-102'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                Embarazadas
              </button>

              <button
                type="button"
                onClick={() => setSelectedSocialArea("ALL")}
                className={`text-xs font-black uppercase px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSocialArea === "ALL"
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                🏛️ Todos los Sectores
              </button>
            </div>

            {/* Selector de Dependencia Municipal (Si se selecciona Trabajador de la Alcaldía) */}
            {selectedSocialArea === "TRABAJADOR DE LA ALCALDIA" && (
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 animate-in fade-in">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" /> Filtrar por Dirección o Ente Municipal (Opcional):
                </span>
                <Input
                  placeholder="Ej. Salud, Polisotillo, Servicios Públicos, Talento Humano..."
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="h-8 text-xs font-bold bg-white border-blue-300 uppercase max-w-md"
                />
                {departmentFilter && (
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter("")}
                    className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Quitar filtro de dependencia
                  </button>
                )}
              </div>
            )}
          </div>

          {/* BLOQUE 1: TARJETAS DE CIFRAS CLAVE EN NÚMEROS (RESUMEN EJECUTIVO) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                1. Impacto Cuantitativo: {selectedSocialArea === 'ALL' ? 'Todas las Razones Sociales' : selectedSocialArea}
              </span>
              <Badge className="bg-blue-100 text-blue-900 border-blue-200 text-[10px] font-bold">
                Cifras Consolidadas
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Tarjeta 1: Censo Total */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Censo Total</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {metrics.totalCensus}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Personas registradas</p>
              </div>

              {/* Tarjeta 2: Beneficiarios Atendidos */}
              <div className="bg-emerald-50/70 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Beneficiados</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tight">
                  {metrics.totalBeneficiaries}
                </p>
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Personas atendidas</p>
              </div>

              {/* Tarjeta 3: Cobertura Social */}
              <div className="bg-blue-50/70 p-3.5 sm:p-4 rounded-2xl border border-blue-200 shadow-2xs">
                <div className="flex items-center justify-between text-blue-800 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Cobertura</span>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
                  {metrics.coveragePercentage}%
                </p>
                <p className="text-[10px] text-blue-700 font-semibold mt-0.5">Del padrón del sector</p>
              </div>

              {/* Tarjeta 4: Órdenes Despachadas */}
              <div className="bg-indigo-50/70 p-3.5 sm:p-4 rounded-2xl border border-indigo-200 shadow-2xs">
                <div className="flex items-center justify-between text-indigo-800 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Entregas</span>
                  <Layers className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight">
                  {metrics.totalOrders}
                </p>
                <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">Órdenes procesadas</p>
              </div>

              {/* Tarjeta 5: Unidades Físicas Totales */}
              <div className="bg-amber-50/80 p-3.5 sm:p-4 rounded-2xl border-2 border-amber-300 shadow-2xs col-span-2 md:col-span-1">
                <div className="flex items-center justify-between text-amber-900 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Unidades</span>
                  <Package className="w-4 h-4 text-amber-700" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-amber-950 tracking-tight">
                  {metrics.totalPhysicalUnits}
                </p>
                <p className="text-[10px] text-amber-800 font-semibold mt-0.5">Unidades entregadas</p>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: DESGLOSE NUMÉRICO POR CATEGORÍA DE AYUDA */}
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 block mb-2">
              2. Desglose en Cantidades Físicas Despachadas:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Fármacos</span>
                    <span className="text-lg font-black text-slate-900">{metrics.medUnits}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">unidades</span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center shrink-0">
                    <Accessibility className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Ayudas Humanas</span>
                    <span className="text-lg font-black text-slate-900">{metrics.techAidUnits}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">unidades</span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Urnas / Funerario</span>
                    <span className="text-lg font-black text-slate-900">{metrics.urnUnits}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">donaciones</span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Insumos Médicos</span>
                    <span className="text-lg font-black text-slate-900">{metrics.supplyUnits}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">unidades</span>
              </div>
            </div>
          </div>

          {/* BLOQUE 3: CONSOLIDADO DE ÍTEMS MÁS ENTREGADOS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" /> 3. Consolidado de Insumos y Fármacos Despachados:
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {metrics.topItems.length} tipo(s) de insumo(s) distintos
              </span>
            </div>

            {metrics.topItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs italic">
                No se registran despachos de ayudas para esta selección en el período indicado.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {metrics.topItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 text-xs truncate" title={item.name}>
                        {item.name}
                      </p>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                        {item.category}
                      </span>
                    </div>
                    <Badge className="bg-blue-900 text-white font-black text-xs px-2.5 py-0.5 rounded-lg shrink-0">
                      {item.quantity} un.
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BLOQUE 4: LISTADO NOMINAL DE BENEFICIARIOS (AUDITORÍA) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" /> 4. Relación Nominal de Beneficiarios Atendidos:
              </span>

              {/* Buscador dentro de la lista nominal */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar en la lista..."
                  value={nominalSearch}
                  onChange={(e) => setNominalSearch(e.target.value)}
                  className="h-8 pl-8 text-xs font-bold bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            {searchedNominalList.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs italic">
                Sin registros nominales que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[300px] border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Beneficiario</th>
                      <th className="px-3 py-2.5">Cédula</th>
                      <th className="px-3 py-2.5">Comuna / Sector</th>
                      <th className="px-3 py-2.5">Ayuda Despachada</th>
                      <th className="px-3 py-2.5 text-center">Cant.</th>
                      <th className="px-3 py-2.5">Funcionario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {searchedNominalList.map((r, i) => {
                      const worker = workerMap.get(r.workerId);
                      const d = parseDateSafe(r.deliveredAt || r.createdAt);
                      const itemName = r.technicalAidType || r.medication || "Insumo";
                      const cat = r.category || (r.requiresTechnicalAid ? 'technical_aid' : 'medication');
                      const qty = (cat === 'technical_aid' && r.technicalAidQuantity) ? Number(r.technicalAidQuantity) : (Number(r.quantity) || 1);

                      return (
                        <tr key={r.id || i} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {d ? format(d, "dd/MM/yyyy") : "S/D"}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">
                            {worker?.fullName || "No identificado"}
                            {worker?.workplaceDepartment && (
                              <span className="block text-[9px] font-semibold text-blue-700">
                                🏢 {worker.workplaceDepartment}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">
                            {worker?.dni || "S/D"}
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                            <span className="font-bold text-slate-800">{r.commune || worker?.commune || "S/D"}</span>
                            {worker?.sector && <span className="text-[10px] text-slate-400 block">{worker.sector}</span>}
                          </td>
                          <td className="px-3 py-2 font-bold text-blue-950 whitespace-nowrap">
                            {itemName}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <span className="bg-blue-100 text-blue-900 font-black px-2 py-0.5 rounded text-[11px]">
                              {qty}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 text-[11px] whitespace-nowrap">
                            {r.deliveryOfficer || r.deliveredBy || "Alcaldía"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
