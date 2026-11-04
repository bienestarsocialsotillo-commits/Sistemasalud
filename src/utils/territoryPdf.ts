import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Worker, MedicationRecipe } from "@/types";
import { COMMUNES, OTHER_COMMUNE_OPTION } from "@/constants";
import { getRecipeCategory } from "@/utils/categoryUtils";

// Set of official Sotillo communes normalized
const OFFICIAL_COMMUNES_SET = new Set(COMMUNES.map(c => c.trim().toUpperCase()));

// Helper to determine if a commune is foreign
export function isForeignerCommune(c?: string | null): boolean {
  if (!c) return false;
  const upper = c.trim().toUpperCase();
  if (
    upper === OTHER_COMMUNE_OPTION.toUpperCase() ||
    upper === "OTRO" ||
    upper.startsWith("OTRO") ||
    upper.includes("FUERA DEL MUNICIPIO") ||
    upper.includes("FORANEO") ||
    upper.includes("FORÁNEO")
  ) {
    return true;
  }
  // Any defined non-empty string that is not in the official 21 Sotillo communes is foreign
  if (upper !== "" && upper !== "SIN ESPECIFICAR" && upper !== "S.I." && upper !== "TODAS" && !OFFICIAL_COMMUNES_SET.has(upper)) {
    return true;
  }
  return false;
}

// Helper to check if a recipe is a technical aid or social support
export function isTechnicalAidRecipe(r: MedicationRecipe): boolean {
  return (
    r.category === "technical_aid" ||
    r.category === "medical_supply" ||
    !!r.requiresTechnicalAid ||
    !!r.technicalAidType ||
    !!r.socialAidType
  );
}

// Helper to check if a recipe is medication
export function isMedicationRecipe(r: MedicationRecipe): boolean {
  return !isTechnicalAidRecipe(r);
}

/**
 * Calculates physical units dispatched for a recipe across the 4 official categories:
 * 1. Fármaco - Medicamento
 * 2. Ayuda Humana
 * 3. Insumo Médico - Social
 * 4. Atención / Derivación Clínica
 */
export function getRecipeDeliveredAidUnits(r: MedicationRecipe): {
  medsUnits: number;
  aidsUnits: number;
  technicalAidUnits: number;
  medicalSupplyUnits: number;
  derivationUnits: number;
  totalUnits: number;
} {
  const cat = getRecipeCategory(r);
  let medsUnits = 0;
  let technicalAidUnits = 0;
  let medicalSupplyUnits = 0;
  let derivationUnits = 0;

  if (cat === "medication") {
    if (r.medications && r.medications.length > 0) {
      medsUnits = r.medications.reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);
    } else {
      medsUnits = Number(r.quantity) || 1;
    }
    medsUnits = Math.max(1, medsUnits);
  } else if (cat === "technical_aid") {
    if (r.technicalAidQuantity && Number(r.technicalAidQuantity) > 0) {
      technicalAidUnits = Number(r.technicalAidQuantity);
    } else {
      technicalAidUnits = Number(r.quantity) || 1;
    }
    technicalAidUnits = Math.max(1, technicalAidUnits);
  } else if (cat === "medical_supply") {
    if (r.foodBagsCount && Number(r.foodBagsCount) > 0) {
      medicalSupplyUnits = Number(r.foodBagsCount);
    } else if (r.medicalSupplies && r.medicalSupplies.length > 0) {
      medicalSupplyUnits = r.medicalSupplies.reduce((sum, s) => sum + (Number(s.quantity) || 1), 0);
    } else {
      medicalSupplyUnits = Number(r.quantity) || 1;
    }
    medicalSupplyUnits = Math.max(1, medicalSupplyUnits);
  } else {
    // medical_derivation (consultas, laboratorios, ecos, derivaciones clínicas)
    derivationUnits = Math.max(1, Number(r.quantity) || 1);
  }

  const aidsUnits = technicalAidUnits + medicalSupplyUnits + derivationUnits;
  const totalUnits = medsUnits + aidsUnits;

  return {
    medsUnits,
    aidsUnits,
    technicalAidUnits,
    medicalSupplyUnits,
    derivationUnits,
    totalUnits
  };
}

// Helper to calculate age safely
export function calculateAge(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  try {
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 && age < 130 ? age : null;
  } catch {
    return null;
  }
}

// Helper to format requirements for a citizen
function getCitizenRequirements(workerId: string, recipes?: MedicationRecipe[]): string {
  if (!recipes || recipes.length === 0) return "Sin requerimiento";
  const userRecipes = recipes.filter(r => r.workerId === workerId);
  if (userRecipes.length === 0) return "Sin requerimiento";
  
  return userRecipes
    .map(r => {
      const isAid = isTechnicalAidRecipe(r);
      const name = r.technicalAidType || r.medication || (isAid ? "Ayuda Humana" : "Medicamento");
      const { totalUnits } = getRecipeDeliveredAidUnits(r);
      const tag = isAid ? "[AYUDA]" : "[FÁRMACO]";
      return `${tag} ${name} (x${totalUnits})`;
    })
    .join(", ");
}

/**
 * Generates an official, high-resolution PDF report for a SINGLE commune or for foráneos.
 * Implements standard OFICIO (LEGAL: 355.6mm x 215.9mm) format with verified 15mm margins.
 */
export function exportCommunePdf(
  communeName: string,
  workers: Worker[],
  recipes?: MedicationRecipe[]
) {
  // PÁGINA OFICIO / LEGAL (8.5 x 14 in / 215.9 x 355.6 mm)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "legal"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 355.6 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 215.9 mm
  const currentDate = new Date().toLocaleDateString("es-VE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const isForeign = isForeignerCommune(communeName);
  const displayTitle = isForeign 
    ? "ATENCIÓN SOLIDARIA EXTRAMUNICIPAL (CASOS FORÁNEOS)" 
    : `COMUNA: ${communeName.toUpperCase()}`;

  // Metrics
  const totalPeople = workers.length;
  const elderly = workers.filter(w => {
    const age = calculateAge(w.birthDate);
    return age !== null && age >= 60;
  }).length;
  const disabilities = workers.filter(w => !!w.hasDisability).length;

  const userIds = new Set(workers.map(w => w.id));
  const communeRecipes = (recipes || []).filter(
    r => userIds.has(r.workerId) || (r.commune && r.commune.toUpperCase().trim() === communeName.toUpperCase().trim())
  );

  let medsUnitsTotal = 0;
  let aidsUnitsTotal = 0;
  communeRecipes.forEach(r => {
    const { medsUnits, aidsUnits } = getRecipeDeliveredAidUnits(r);
    medsUnitsTotal += medsUnits;
    aidsUnitsTotal += aidsUnits;
  });
  const totalDeliveredAids = medsUnitsTotal + aidsUnitsTotal;
  const avgAidsPerPerson = totalPeople > 0 ? (totalDeliveredAids / totalPeople).toFixed(1) : "0.0";

  // Header Banner - Exactly 28mm height across 355.6mm
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPÚBLICA BOLIVARIANA DE VENEZUELA • ALCALDÍA DEL MUNICIPIO BOLIVARIANO JUAN ANTONIO SOTILLO", pageWidth / 2, 8, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("DIRECCIÓN DE BIENESTAR SOCIAL • SISTEMA MUNICIPAL DE ATENCIÓN CIUDADANA", pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`INFORME DE GESTIÓN TERRITORIAL: ${displayTitle}`, pageWidth / 2, 22, { align: "center" });

  // Metadata Subheader Box - Verified 15mm margins
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(15, 32, pageWidth - 30, 18, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, 32, pageWidth - 30, 18, 2, 2, "S");

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`FECHA DE EMISIÓN: ${currentDate.toUpperCase()}`, 20, 38);
  doc.text(`JURISDICCIÓN: ${isForeign ? "ATENCIÓN SOLIDARIA EXTRAMUNICIPAL" : "MUNICIPIO BOLIVARIANO JUAN ANTONIO SOTILLO"}`, 20, 45);

  doc.text(`PERSONAS CARGADAS: ${totalPeople} Ciudadanos`, 130, 38);
  doc.text(`ADULTOS MAYORES (60+): ${elderly} | DISCAPACIDAD: ${disabilities}`, 130, 45);

  doc.setTextColor(15, 23, 42);
  doc.text(`AYUDAS ENTREGADAS TOTALES: ${totalDeliveredAids} Ayudas`, 235, 38);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.text(`(${medsUnitsTotal} Fármacos + ${aidsUnitsTotal} Ayudas Técn./Soc. • Prom: ${avgAidsPerPerson}/pers.)`, 235, 45);

  // Table Data Preparation
  const tableRows = workers.map((w, index) => {
    const age = calculateAge(w.birthDate);
    const ageStr = age !== null ? `${age}a` : "N/A";
    const reqStr = getCitizenRequirements(w.id, recipes);
    const locationStr = isForeign
      ? (w.originLocation ? `PROCEDENCIA: ${w.originLocation}` : (w.sector || w.address || "OTRO MUNICIPIO"))
      : (w.sector || w.address || "NO INDICA");
    
    return [
      (index + 1).toString(),
      w.dni || "S/D",
      (w.fullName || "SIN NOMBRE").toUpperCase(),
      `${ageStr} / ${w.gender || "-"}`,
      locationStr.toUpperCase(),
      w.phone || "NO REGISTRA",
      w.hasDisability ? "SÍ" : "NO",
      (w.socialArea || "GENERAL").replace(/_/g, " ").toUpperCase(),
      reqStr.toUpperCase()
    ];
  });

  // Total printable width: 355.6 - 30 = 325.6 mm
  autoTable(doc, {
    startY: 54,
    margin: { left: 15, right: 15, bottom: 15 },
    head: [[
      "N°",
      "CÉDULA",
      "NOMBRES Y APELLIDOS",
      "EDAD/SEXO",
      isForeign ? "MUNICIPIO DE ORIGEN / PROCEDENCIA" : "SECTOR / COMUNIDAD",
      "TELÉFONO",
      "DISCAP.",
      "ÁREA SOCIAL",
      "REQUERIMIENTOS Y AYUDAS ENTREGADAS"
    ]],
    body: tableRows.length > 0 ? tableRows : [["-", "-", "NO SE REGISTRAN CIUDADANOS EN ESTE TERRITORIO", "-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2.2
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    // Exact sum: 12 + 28 + 65 + 22 + 52 + 28 + 18 + 36 + 64.6 = 325.6 mm
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 28, fontStyle: "bold" },
      2: { cellWidth: 65, fontStyle: "bold" },
      3: { halign: "center", cellWidth: 22 },
      4: { cellWidth: 52 },
      5: { halign: "center", cellWidth: 28 },
      6: { halign: "center", cellWidth: 18 },
      7: { cellWidth: 36 },
      8: { cellWidth: 64.6 }
    }
  });

  // Two-pass verified footer with exact page count
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Alcaldía del Municipio Bolivariano Juan Antonio Sotillo • Dirección de Bienestar Social • Gestión Alcalde Prof. Jesús Marcano Tábata",
      15,
      pageHeight - 7
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - 15,
      pageHeight - 7,
      { align: "right" }
    );
  }

  const safeName = communeName.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `Informe_Ejecutivo_Oficio_Comuna_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Generates an executive, verified PDF report in PÁGINA OFICIO (LEGAL: 355.6mm x 215.9mm).
 * Level 1: Executive Consolidated Summary (Totals at Top + 21 Communes Matrix + Foreigners).
 * Level 2: Detailed territorial breakdown with individual commune sections.
 * 
 * Strict 15mm margins and verified page dimensions prevent any cutoff or distortion.
 */
export function exportAllCommunesSectionedPdf(
  workers: Worker[],
  recipes?: MedicationRecipe[]
) {
  // PÁGINA OFICIO / LEGAL EN HORIZONTAL (355.6 mm x 215.9 mm)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "legal"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 355.6 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 215.9 mm
  const currentDate = new Date().toLocaleDateString("es-VE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  // Separate Sotillo Municipal Workers (21 Communas) from Foreign Cases
  const sotilloWorkers = workers.filter(w => !isForeignerCommune(w.commune) && !w.isForeigner);
  const foreignWorkers = workers.filter(w => isForeignerCommune(w.commune) || !!w.isForeigner);

  // Group Sotillo Workers by the 21 official communes
  const communeMap = new Map<string, Worker[]>();
  COMMUNES.forEach(c => communeMap.set(c.toUpperCase().trim(), []));

  sotilloWorkers.forEach(w => {
    const rawCommune = (w.commune || "").toUpperCase().trim();
    if (communeMap.has(rawCommune)) {
      communeMap.get(rawCommune)!.push(w);
    } else {
      const found = COMMUNES.find(c => c.toUpperCase().trim() === rawCommune);
      if (found) {
        communeMap.get(found.toUpperCase().trim())!.push(w);
      }
    }
  });

  // Count active communes
  let activeSotilloCommunesCount = 0;
  COMMUNES.forEach(c => {
    if ((communeMap.get(c.toUpperCase().trim()) || []).length > 0) {
      activeSotilloCommunesCount++;
    }
  });
  const municipalCoveragePercent = ((activeSotilloCommunesCount / 21) * 100).toFixed(1);

  // Sotillo Population stats
  const sotilloElderly = sotilloWorkers.filter(w => {
    const a = calculateAge(w.birthDate);
    return a !== null && a >= 60;
  }).length;
  const sotilloDisabilities = sotilloWorkers.filter(w => !!w.hasDisability).length;

  const sotilloWorkerIds = new Set(sotilloWorkers.map(w => w.id));
  const workersMap = new Map(workers.map(w => [w.id, w]));

  // Partition DELIVERED recipes (r.status === 'delivered') into communes and categories
  // Harmonized 100% with Dashboard de Gestión
  const communeDeliveredMap = new Map<string, {
    total: number;
    meds: number;
    tech: number;
    supplies: number;
    derivations: number;
  }>();
  COMMUNES.forEach(c => communeDeliveredMap.set(c.trim().toUpperCase(), {
    total: 0,
    meds: 0,
    tech: 0,
    supplies: 0,
    derivations: 0,
  }));

  const foreignDelivered = {
    total: 0,
    meds: 0,
    tech: 0,
    supplies: 0,
    derivations: 0,
  };

  let totalPendingRecipes = 0;
  let totalDeliveredDispatches = 0;

  (recipes || []).forEach(r => {
    const isDelivered = r.status === 'delivered';
    if (!isDelivered) {
      totalPendingRecipes++;
      return; // Only delivered aids are counted in the deliveries report!
    }

    const cat = getRecipeCategory(r);

    let isForeign = isForeignerCommune(r.commune) || !!r.isForeigner;
    let targetCommune = (r.commune || "").trim().toUpperCase();

    if (!isForeign && !OFFICIAL_COMMUNES_SET.has(targetCommune) && r.workerId) {
      const w = workersMap.get(r.workerId);
      if (w) {
        if (isForeignerCommune(w.commune) || !!w.isForeigner) {
          isForeign = true;
        } else {
          const wCom = (w.commune || "").trim().toUpperCase();
          if (OFFICIAL_COMMUNES_SET.has(wCom)) {
            targetCommune = wCom;
          }
        }
      }
    }

    totalDeliveredDispatches++;
    const units = getRecipeDeliveredAidUnits(r);

    if (isForeign || !OFFICIAL_COMMUNES_SET.has(targetCommune)) {
      foreignDelivered.total += units.totalUnits;
      foreignDelivered.meds += units.medsUnits;
      foreignDelivered.tech += units.technicalAidUnits;
      foreignDelivered.supplies += units.medicalSupplyUnits;
      foreignDelivered.derivations += units.derivationUnits;
    } else {
      const stats = communeDeliveredMap.get(targetCommune);
      if (stats) {
        stats.total += units.totalUnits;
        stats.meds += units.medsUnits;
        stats.tech += units.technicalAidUnits;
        stats.supplies += units.medicalSupplyUnits;
        stats.derivations += units.derivationUnits;
      }
    }
  });

  let sotilloMedsUnits = 0;
  let sotilloTechUnits = 0;
  let sotilloSupplyUnits = 0;
  let sotilloDerivationUnits = 0;
  let sotilloTotalAidsDelivered = 0;

  communeDeliveredMap.forEach(stats => {
    sotilloTotalAidsDelivered += stats.total;
    sotilloMedsUnits += stats.meds;
    sotilloTechUnits += stats.tech;
    sotilloSupplyUnits += stats.supplies;
    sotilloDerivationUnits += stats.derivations;
  });

  const foreignTotalAidsDelivered = foreignDelivered.total;
  const foreignMedsUnits = foreignDelivered.meds;
  const foreignTechUnits = foreignDelivered.tech;
  const foreignSupplyUnits = foreignDelivered.supplies;
  const foreignDerivationUnits = foreignDelivered.derivations;

  // Global Grand Totals across the web app
  const grandTotalPeople = workers.length;
  const grandTotalAidsDelivered = sotilloTotalAidsDelivered + foreignTotalAidsDelivered;
  const grandTotalMeds = sotilloMedsUnits + foreignMedsUnits;
  const grandTotalTechAids = sotilloTechUnits + foreignTechUnits;
  const grandTotalSupplies = sotilloSupplyUnits + foreignSupplyUnits;
  const grandTotalDerivations = sotilloDerivationUnits + foreignDerivationUnits;

  // ==========================================
  // PÁGINA 1: CONSOLIDADO EJECUTIVO SUPERIOR (TOTALES ARRIBA)
  // ==========================================
  // Header Banner - Exactly 28mm height across full OFICIO width (355.6mm)
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPÚBLICA BOLIVARIANA DE VENEZUELA • ALCALDÍA DEL MUNICIPIO BOLIVARIANO JUAN ANTONIO SOTILLO", pageWidth / 2, 7.5, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("DIRECCIÓN DE BIENESTAR SOCIAL • SISTEMA DE GESTIÓN DE ATENCIÓN CIUDADANA", pageWidth / 2, 13.5, { align: "center" });

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("INFORME EJECUTIVO DE GESTIÓN TERRITORIAL", pageWidth / 2, 22, { align: "center" });

  // 4 Top Executive KPI Cards (Verified 15mm margins, printable width 325.6mm)
  const cardY = 32;
  const cardHeight = 18;
  const cardSpacing = 4;
  const totalWidthAvailable = pageWidth - 30; // 325.6 mm
  const cardWidth = (totalWidthAvailable - (cardSpacing * 3)) / 4; // 78.4 mm each

  // Card 1: Personas Cargadas
  const c1X = 15;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(c1X, cardY, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(c1X, cardY, cardWidth, cardHeight, 2, 2, "S");
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("PERSONAS CARGADAS (PADRÓN TOTAL)", c1X + 4, cardY + 5);
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(13);
  doc.text(`${grandTotalPeople} Ciudadanos`, c1X + 4, cardY + 12);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Sotillo: ${sotilloWorkers.length} | Foráneos: ${foreignWorkers.length}`, c1X + 4, cardY + 16);

  // Card 2: Ayudas Entregadas Totales
  const c2X = c1X + cardWidth + cardSpacing;
  doc.setFillColor(238, 242, 255); // Indigo 50
  doc.roundedRect(c2X, cardY, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(c2X, cardY, cardWidth, cardHeight, 2, 2, "S");
  doc.setTextColor(67, 56, 202);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("AYUDAS ENTREGADAS TOTALES", c2X + 4, cardY + 5);
  doc.setTextColor(49, 46, 129);
  doc.setFontSize(13);
  doc.text(`${grandTotalAidsDelivered} Unidades`, c2X + 4, cardY + 12);
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`En ${totalDeliveredDispatches} Despachos • ${activeSotilloCommunesCount}/21 Comunas`, c2X + 4, cardY + 16);

  // Card 3: Fármaco - Medicamento
  const c3X = c2X + cardWidth + cardSpacing;
  doc.setFillColor(240, 253, 244); // Green 50
  doc.roundedRect(c3X, cardY, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(c3X, cardY, cardWidth, cardHeight, 2, 2, "S");
  doc.setTextColor(21, 128, 61);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("FÁRMACOS - MEDICAMENTOS", c3X + 4, cardY + 5);
  doc.setTextColor(20, 83, 45);
  doc.setFontSize(13);
  doc.text(`${grandTotalMeds} Unidades`, c3X + 4, cardY + 12);
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Sotillo: ${sotilloMedsUnits} | Foráneos: ${foreignMedsUnits}`, c3X + 4, cardY + 16);

  // Card 4: Ayudas Humanas, Insumos y Atención
  const c4X = c3X + cardWidth + cardSpacing;
  doc.setFillColor(254, 243, 199); // Amber 50
  doc.roundedRect(c4X, cardY, cardWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(c4X, cardY, cardWidth, cardHeight, 2, 2, "S");
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("AYUDA HUMANA / INSUMOS / ATENCIÓN", c4X + 4, cardY + 5);
  doc.setTextColor(120, 53, 15);
  doc.setFontSize(13);
  doc.text(`${grandTotalTechAids + grandTotalSupplies + grandTotalDerivations} Unidades`, c4X + 4, cardY + 12);
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Hum: ${grandTotalTechAids} | Ins: ${grandTotalSupplies} | Deriv: ${grandTotalDerivations}`, c4X + 4, cardY + 16);

  // Matriz de las 21 Comunas + Foráneos
  const matrixRows: any[] = [];

  // Rows for the 21 Sotillo Communes
  COMMUNES.forEach((communeName, idx) => {
    const norm = communeName.trim().toUpperCase();
    const cWorkers = communeMap.get(norm) || [];
    const countPeople = cWorkers.length;
    const percent = grandTotalPeople > 0 ? ((countPeople / grandTotalPeople) * 100).toFixed(1) : "0.0";
    const cDelivered = communeDeliveredMap.get(norm) || { total: 0, meds: 0, tech: 0, supplies: 0, derivations: 0 };

    matrixRows.push([
      (idx + 1).toString(),
      communeName.toUpperCase(),
      countPeople.toString(),
      `${percent}%`,
      cDelivered.total.toString(),
      cDelivered.meds.toString(),
      cDelivered.tech.toString(),
      cDelivered.supplies.toString(),
      cDelivered.derivations.toString()
    ]);
  });

  // Row for Casos Foráneos
  matrixRows.push([
    "EXT",
    "CASOS FORÁNEOS (SOLIDARIDAD EXTRAMUNICIPAL)",
    foreignWorkers.length.toString(),
    grandTotalPeople > 0 ? `${((foreignWorkers.length / grandTotalPeople) * 100).toFixed(1)}%` : "0.0%",
    foreignTotalAidsDelivered.toString(),
    foreignMedsUnits.toString(),
    foreignTechUnits.toString(),
    foreignSupplyUnits.toString(),
    foreignDerivationUnits.toString()
  ]);

  // Grand Total Summary Row
  matrixRows.push([
    "Σ",
    "GRAN TOTAL CONSOLIDADO (SOTILLO + FORÁNEOS)",
    grandTotalPeople.toString(),
    "100.0%",
    grandTotalAidsDelivered.toString(),
    grandTotalMeds.toString(),
    grandTotalTechAids.toString(),
    grandTotalSupplies.toString(),
    grandTotalDerivations.toString()
  ]);

  // Table 1: Printable width 325.6mm on Oficio (Legal)
  autoTable(doc, {
    startY: 54,
    margin: { left: 15, right: 15, bottom: 15 },
    head: [[
      "N°",
      "COMUNA / TERRITORIO",
      "PERSONAS CARGADAS",
      "% PADRÓN",
      "AYUDAS ENTREGADAS TOTALES",
      "FÁRMACO - MEDICAMENTO",
      "AYUDA HUMANA",
      "INSUMO MÉDICO - SOCIAL",
      "ATENCIÓN / DERIVACIÓN CLÍNICA"
    ]],
    body: matrixRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2.2
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 1.8
    },
    // Exact column widths sum to 325.6mm: 12 + 73.6 + 28 + 20 + 36 + 39 + 38 + 39 + 40 = 325.6mm
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: 73.6, fontStyle: "bold" },
      2: { halign: "center", cellWidth: 28, fontStyle: "bold" },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "center", cellWidth: 36, fontStyle: "bold", textColor: [30, 58, 138] },
      5: { halign: "center", cellWidth: 39 },
      6: { halign: "center", cellWidth: 38 },
      7: { halign: "center", cellWidth: 39 },
      8: { halign: "center", cellWidth: 40 }
    },
    didParseCell: (data) => {
      // Highlight the Casos Foráneos row
      if (data.row.index === matrixRows.length - 2) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = "bold";
      }
      // Highlight the Grand Total Summary Row
      if (data.row.index === matrixRows.length - 1) {
        data.cell.styles.fillColor = [30, 58, 138];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 8.5;
      }
    }
  });

  // Institutional Signature Stamps & Footer on the Executive Page (Only numerical commune reference, no citizen lists)
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Alcaldía del Municipio Bolivariano Juan Antonio Sotillo • Dirección de Bienestar Social • Gestión Alcalde Prof. Jesús Marcano Tábata",
    15,
    pageHeight - 7
  );
  doc.text(
    "Página 1 de 1 • Consolidado Territorial y Balance Comunal",
    pageWidth - 15,
    pageHeight - 7,
    { align: "right" }
  );

  const fileName = `Informe_Ejecutivo_Gestion_Territorial_Sotillo_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Genera el Reporte Ejecutivo en PDF de Densidad de Pacientes y Atenciones por Comuna.
 * Presenta la tabla y análisis de atención por comuna con los totales de atención
 * y personas registradas en el sistema.
 */
export function exportCommuneDensityReportPdf(
  workers: Worker[],
  recipes?: MedicationRecipe[]
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter" // 279.4 mm x 215.9 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 279.4 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 215.9 mm
  const currentDate = new Date().toLocaleDateString("es-VE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  // Separación Sotillo y Foráneos
  const sotilloWorkers = workers.filter(w => !isForeignerCommune(w.commune) && !w.isForeigner);
  const foreignWorkers = workers.filter(w => isForeignerCommune(w.commune) || !!w.isForeigner);

  // Mapeo por comuna
  const communeMap = new Map<string, Worker[]>();
  COMMUNES.forEach(c => communeMap.set(c.toUpperCase().trim(), []));

  sotilloWorkers.forEach(w => {
    const raw = (w.commune || "").toUpperCase().trim();
    if (communeMap.has(raw)) {
      communeMap.get(raw)!.push(w);
    } else {
      const match = COMMUNES.find(c => c.toUpperCase().trim() === raw);
      if (match) {
        communeMap.get(match.toUpperCase().trim())!.push(w);
      }
    }
  });

  const workersMap = new Map(workers.map(w => [w.id, w]));

  const communeDeliveredMap = new Map<string, {
    total: number;
    meds: number;
    tech: number;
    supplies: number;
    derivations: number;
  }>();

  COMMUNES.forEach(c => communeDeliveredMap.set(c.trim().toUpperCase(), {
    total: 0,
    meds: 0,
    tech: 0,
    supplies: 0,
    derivations: 0
  }));

  const foreignDelivered = {
    total: 0,
    meds: 0,
    tech: 0,
    supplies: 0,
    derivations: 0
  };

  (recipes || []).forEach(r => {
    if (r.status !== 'delivered') return;

    let isForeign = isForeignerCommune(r.commune) || !!r.isForeigner;
    let targetCommune = (r.commune || "").trim().toUpperCase();

    if (!isForeign && !OFFICIAL_COMMUNES_SET.has(targetCommune) && r.workerId) {
      const w = workersMap.get(r.workerId);
      if (w) {
        if (isForeignerCommune(w.commune) || !!w.isForeigner) {
          isForeign = true;
        } else {
          const wCom = (w.commune || "").trim().toUpperCase();
          if (OFFICIAL_COMMUNES_SET.has(wCom)) {
            targetCommune = wCom;
          }
        }
      }
    }

    const units = getRecipeDeliveredAidUnits(r);

    if (isForeign || !OFFICIAL_COMMUNES_SET.has(targetCommune)) {
      foreignDelivered.total += units.totalUnits;
      foreignDelivered.meds += units.medsUnits;
      foreignDelivered.tech += units.technicalAidUnits;
      foreignDelivered.supplies += units.medicalSupplyUnits;
      foreignDelivered.derivations += units.derivationUnits;
    } else {
      const stats = communeDeliveredMap.get(targetCommune);
      if (stats) {
        stats.total += units.totalUnits;
        stats.meds += units.medsUnits;
        stats.tech += units.technicalAidUnits;
        stats.supplies += units.medicalSupplyUnits;
        stats.derivations += units.derivationUnits;
      }
    }
  });

  let sotilloMeds = 0;
  let sotilloTech = 0;
  let sotilloSupplies = 0;
  let sotilloDerivations = 0;
  let sotilloTotalDelivered = 0;

  communeDeliveredMap.forEach(stats => {
    sotilloTotalDelivered += stats.total;
    sotilloMeds += stats.meds;
    sotilloTech += stats.tech;
    sotilloSupplies += stats.supplies;
    sotilloDerivations += stats.derivations;
  });

  const grandTotalPeople = workers.length;
  const grandTotalDelivered = sotilloTotalDelivered + foreignDelivered.total;
  const grandTotalMeds = sotilloMeds + foreignDelivered.meds;
  const grandTotalTech = sotilloTech + foreignDelivered.tech;
  const grandTotalSupplies = sotilloSupplies + foreignDelivered.supplies;
  const grandTotalDerivations = sotilloDerivations + foreignDelivered.derivations;

  // Header Banner
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("REPÚBLICA BOLIVARIANA DE VENEZUELA • ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO", pageWidth / 2, 7, { align: "center" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("DIRECCIÓN DE BIENESTAR SOCIAL • GESTIÓN PROF. JESÚS MARCANO TÁBATA E ING. YOHANA ESTABA DE MARCANO", pageWidth / 2, 13, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DENSIDAD DE PACIENTES Y ATENCIONES POR COMUNA", pageWidth / 2, 21, { align: "center" });

  // 4 KPI Summary Cards
  const cardY = 30;
  const cardHeight = 16;
  const cardSpacing = 4;
  const totalW = pageWidth - 28; // Margins 14mm each side
  const cardW = (totalW - (cardSpacing * 3)) / 4;

  // Card 1: Personas en el Sistema
  const c1 = 14;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(c1, cardY, cardW, cardHeight, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(c1, cardY, cardW, cardHeight, 2, 2, "S");
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("PERSONAS EN EL SISTEMA", c1 + 4, cardY + 5);
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(12);
  doc.text(`${grandTotalPeople} Ciudadanos`, c1 + 4, cardY + 11.5);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Sotillo: ${sotilloWorkers.length} | Foráneos: ${foreignWorkers.length}`, c1 + 4, cardY + 15);

  // Card 2: Atenciones y Despachos
  const c2 = c1 + cardW + cardSpacing;
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(c2, cardY, cardW, cardHeight, 2, 2, "F");
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(c2, cardY, cardW, cardHeight, 2, 2, "S");
  doc.setTextColor(67, 56, 202);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("ATENCIONES TOTALES", c2 + 4, cardY + 5);
  doc.setTextColor(49, 46, 129);
  doc.setFontSize(12);
  doc.text(`${grandTotalDelivered} Despachos`, c2 + 4, cardY + 11.5);
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Promedio: ${grandTotalPeople > 0 ? (grandTotalDelivered / grandTotalPeople).toFixed(1) : 0} ay/persona`, c2 + 4, cardY + 15);

  // Card 3: Fármacos
  const c3 = c2 + cardW + cardSpacing;
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(c3, cardY, cardW, cardHeight, 2, 2, "F");
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(c3, cardY, cardW, cardHeight, 2, 2, "S");
  doc.setTextColor(4, 120, 87);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("FÁRMACOS DESPACHADOS", c3 + 4, cardY + 5);
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(12);
  doc.text(`${grandTotalMeds} Unidades`, c3 + 4, cardY + 11.5);
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Sotillo: ${sotilloMeds} | Foráneos: ${foreignDelivered.meds}`, c3 + 4, cardY + 15);

  // Card 4: Ayudas Técnicas e Insumos
  const c4 = c3 + cardW + cardSpacing;
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(c4, cardY, cardW, cardHeight, 2, 2, "F");
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(c4, cardY, cardW, cardHeight, 2, 2, "S");
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("AYUDAS TÉCNICAS E INSUMOS", c4 + 4, cardY + 5);
  doc.setTextColor(120, 53, 15);
  doc.setFontSize(12);
  doc.text(`${grandTotalTech + grandTotalSupplies + grandTotalDerivations} Unidades`, c4 + 4, cardY + 11.5);
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Técnicas: ${grandTotalTech} | Insumos: ${grandTotalSupplies}`, c4 + 4, cardY + 15);

  // Preparar Filas y Datos ordenados por mayor cantidad de personas
  interface CommuneRowData {
    name: string;
    people: number;
    percent: string;
    totalAids: number;
    meds: number;
    tech: number;
    supplies: number;
    derivations: number;
  }

  const rowsData: CommuneRowData[] = COMMUNES.map(c => {
    const norm = c.trim().toUpperCase();
    const people = (communeMap.get(norm) || []).length;
    const aids = communeDeliveredMap.get(norm) || { total: 0, meds: 0, tech: 0, supplies: 0, derivations: 0 };
    const pct = grandTotalPeople > 0 ? ((people / grandTotalPeople) * 100).toFixed(1) : "0.0";
    return {
      name: c,
      people,
      percent: `${pct}%`,
      totalAids: aids.total,
      meds: aids.meds,
      tech: aids.tech,
      supplies: aids.supplies,
      derivations: aids.derivations
    };
  }).sort((a, b) => b.people - a.people || b.totalAids - a.totalAids);

  const maxPeople = rowsData[0]?.people || 1;

  const tableRows = rowsData.map((r, idx) => {
    const barLength = Math.round((r.people / maxPeople) * 15);
    const barVisual = "█".repeat(Math.max(1, barLength));
    return [
      (idx + 1).toString(),
      r.name.toUpperCase(),
      r.people.toLocaleString(),
      r.percent,
      r.totalAids.toLocaleString(),
      r.meds.toLocaleString(),
      r.tech.toLocaleString(),
      (r.supplies + r.derivations).toLocaleString(),
      barVisual
    ];
  });

  // Fila de Casos Foráneos
  const foreignPct = grandTotalPeople > 0 ? ((foreignWorkers.length / grandTotalPeople) * 100).toFixed(1) : "0.0";
  tableRows.push([
    "EXT",
    "CASOS FORÁNEOS (SOLIDARIDAD EXTRAMUNICIPAL)",
    foreignWorkers.length.toLocaleString(),
    `${foreignPct}%`,
    foreignDelivered.total.toLocaleString(),
    foreignDelivered.meds.toLocaleString(),
    foreignDelivered.tech.toLocaleString(),
    (foreignDelivered.supplies + foreignDelivered.derivations).toLocaleString(),
    "—"
  ]);

  // Fila de Gran Total
  tableRows.push([
    "Σ",
    "GRAN TOTAL CONSOLIDADO (21 COMUNAS + FORÁNEOS)",
    grandTotalPeople.toLocaleString(),
    "100.0%",
    grandTotalDelivered.toLocaleString(),
    grandTotalMeds.toLocaleString(),
    grandTotalTech.toLocaleString(),
    (grandTotalSupplies + grandTotalDerivations).toLocaleString(),
    "100%"
  ]);

  // Subtítulo del gráfico
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("GRÁFICO COMPARATIVO DE BARRAS: DENSIDAD DEMOGRÁFICA Y ATENCIÓN POR COMUNA (BASE 21 OFICIALES)", 14, 50);

  // Leyenda en la parte superior derecha
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(30, 58, 138);
  doc.roundedRect(192, 47, 4.5, 3, 0.5, 0.5, "F");
  doc.setTextColor(51, 65, 85);
  doc.text("Top 3 Carga", 198, 49.5);

  doc.setFillColor(37, 99, 235);
  doc.roundedRect(220, 47, 4.5, 3, 0.5, 0.5, "F");
  doc.text("Comunas Sotillo", 226, 49.5);

  // DIBUJAR EL GRÁFICO VECTORIAL DE BARRAS HORIZONTALES (PÁGINA 1)
  const chartStartY = 54;
  const barRowHeight = 6.4;
  const trackWidth = 130;
  const trackStartX = 72;

  rowsData.forEach((r, idx) => {
    const rowY = chartStartY + (idx * barRowHeight);

    // Nombre de la comuna a la izquierda
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`${idx + 1}. ${r.name.toUpperCase()}`, 14, rowY + 3.1);

    // Pista de fondo de la barra
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(trackStartX, rowY, trackWidth, 4, 1, 1, "FD");

    // Barra coloreada proporcional
    const barW = Math.max(2.5, (r.people / maxPeople) * trackWidth);
    if (idx < 3) {
      doc.setFillColor(30, 58, 138); // Blue 900 para top 3
    } else {
      doc.setFillColor(37, 99, 235); // Blue 600
    }
    doc.roundedRect(trackStartX, rowY, barW, 4, 1, 1, "F");

    // Etiquetas numéricas a la derecha
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${r.people.toLocaleString()} pers. (${r.percent})  •  ${r.totalAids.toLocaleString()} atenc.`,
      trackStartX + trackWidth + 4,
      rowY + 3.1
    );
  });

  // Resumen Foráneos al pie del gráfico
  const foreignFootY = chartStartY + (rowsData.length * barRowHeight) + 2.5;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, foreignFootY, pageWidth - 28, 7, 1.5, 1.5, "FD");
  doc.setFontSize(6.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text(
    `ATENCIÓN SOLIDARIA EXTRAMUNICIPAL (FORÁNEOS): ${foreignWorkers.length.toLocaleString()} PERSONAS CENSADAS  |  ${foreignDelivered.total.toLocaleString()} ATENCIONES DESPACHADAS (${foreignDelivered.meds} FÁRMACOS + ${foreignDelivered.tech} AYUDAS TÉCNICAS)`,
    18,
    foreignFootY + 4.5
  );

  // ==========================================
  // PÁGINA 2: TABLA CONSOLIDADA MATRICIAL
  // ==========================================
  doc.addPage("letter", "landscape");

  // Header Banner Página 2
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("REPÚBLICA BOLIVARIANA DE VENEZUELA • ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO", pageWidth / 2, 6.5, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("DIRECCIÓN DE BIENESTAR SOCIAL • GESTIÓN PROF. JESÚS MARCANO TÁBATA E ING. YOHANA ESTABA DE MARCANO", pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TABLA CONSOLIDADA DE DENSIDAD DEMOGRÁFICA Y ATENCIÓN POR COMUNA", pageWidth / 2, 19, { align: "center" });

  autoTable(doc, {
    startY: 28,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [[
      "N°",
      "COMUNA / TERRITORIO",
      "PERSONAS (CENSO)",
      "% PADRÓN",
      "TOTAL ATENCIONES",
      "FÁRMACOS",
      "AYUDAS TÉCNICAS",
      "INSUMOS / DERIV.",
      "DENSIDAD RELATIVA"
    ]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 1.5
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 68, fontStyle: "bold" },
      2: { halign: "center", cellWidth: 26, fontStyle: "bold", textColor: [30, 58, 138] },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "center", cellWidth: 28, fontStyle: "bold", textColor: [15, 23, 42] },
      5: { halign: "center", cellWidth: 22 },
      6: { halign: "center", cellWidth: 24 },
      7: { halign: "center", cellWidth: 24 },
      8: { halign: "center", cellWidth: 31, textColor: [37, 99, 235], fontSize: 6.5 }
    },
    didParseCell: (data) => {
      if (data.row.index === tableRows.length - 2) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = "bold";
      }
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fillColor = [30, 58, 138];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  // Footer con firma institucional
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Alcaldía del Municipio Bolivariano Juan Antonio Sotillo • Dirección de Bienestar Social • Emisión: ${currentDate}`,
      14,
      pageHeight - 6
    );
    doc.text(
      `Página ${i} de ${pageCount} • Reporte Oficial de Densidad Territorial`,
      pageWidth - 14,
      pageHeight - 6,
      { align: "right" }
    );
  }

  const fileName = `Reporte_Densidad_Atencion_Comunas_Sotillo_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Generates an Excel spreadsheet structured in three sheets:
 * 1. Resumen 21 Comunas Sotillo (Personas Cargadas vs Ayudas Entregadas Totales)
 * 2. Resumen Casos Foráneos
 * 3. Nómina Completa Seccionada
 */
export function exportAllCommunesExcel(
  workers: Worker[],
  recipes?: MedicationRecipe[]
) {
  const wb = XLSX.utils.book_new();

  const sotilloWorkers = workers.filter(w => !isForeignerCommune(w.commune) && !w.isForeigner);
  const foreignWorkers = workers.filter(w => isForeignerCommune(w.commune) || !!w.isForeigner);

  const workersMap = new Map(workers.map(w => [w.id, w]));

  // Partition DELIVERED recipes (r.status === 'delivered') into communes and categories
  const communeDeliveredMap = new Map<string, {
    total: number;
    meds: number;
    tech: number;
    supplies: number;
    derivations: number;
  }>();
  COMMUNES.forEach(c => communeDeliveredMap.set(c.trim().toUpperCase(), {
    total: 0,
    meds: 0,
    tech: 0,
    supplies: 0,
    derivations: 0,
  }));

  const foreignDelivered = {
    total: 0,
    meds: 0,
    tech: 0,
    supplies: 0,
    derivations: 0,
  };

  (recipes || []).forEach(r => {
    if (r.status !== 'delivered') return;

    const cat = getRecipeCategory(r);
    let isForeign = isForeignerCommune(r.commune) || !!r.isForeigner;
    let targetCommune = (r.commune || "").trim().toUpperCase();

    if (!isForeign && !OFFICIAL_COMMUNES_SET.has(targetCommune) && r.workerId) {
      const w = workersMap.get(r.workerId);
      if (w) {
        if (isForeignerCommune(w.commune) || !!w.isForeigner) {
          isForeign = true;
        } else {
          const wCom = (w.commune || "").trim().toUpperCase();
          if (OFFICIAL_COMMUNES_SET.has(wCom)) {
            targetCommune = wCom;
          }
        }
      }
    }

    const units = getRecipeDeliveredAidUnits(r);

    if (isForeign || !OFFICIAL_COMMUNES_SET.has(targetCommune)) {
      foreignDelivered.total += units.totalUnits;
      foreignDelivered.meds += units.medsUnits;
      foreignDelivered.tech += units.technicalAidUnits;
      foreignDelivered.supplies += units.medicalSupplyUnits;
      foreignDelivered.derivations += units.derivationUnits;
    } else {
      const stats = communeDeliveredMap.get(targetCommune);
      if (stats) {
        stats.total += units.totalUnits;
        stats.meds += units.medsUnits;
        stats.tech += units.technicalAidUnits;
        stats.supplies += units.medicalSupplyUnits;
        stats.derivations += units.derivationUnits;
      }
    }
  });

  // Sheet 1: Resumen 21 Comunas Sotillo (Referencia Numérica)
  const sotilloSummary = COMMUNES.map(c => {
    const norm = c.trim().toUpperCase();
    const list = sotilloWorkers.filter(w => (w.commune || "").trim().toUpperCase() === norm);
    const countPeople = list.length;
    const cDelivered = communeDeliveredMap.get(norm) || { total: 0, meds: 0, tech: 0, supplies: 0, derivations: 0 };

    const disCount = list.filter(w => !!w.hasDisability).length;
    const elderly = list.filter(w => {
      const a = calculateAge(w.birthDate);
      return a !== null && a >= 60;
    }).length;

    return {
      "Comuna de Sotillo (Oficial)": c,
      "Personas Cargadas": countPeople,
      "% Padrón Sotillo": sotilloWorkers.length > 0 ? `${((countPeople / sotilloWorkers.length) * 100).toFixed(1)}%` : "0%",
      "Ayudas Entregadas Totales (Unidades)": cDelivered.total,
      "Fármaco - Medicamento": cDelivered.meds,
      "Ayuda Humana": cDelivered.tech,
      "Insumo Médico - Social": cDelivered.supplies,
      "Atención / Derivación Clínica": cDelivered.derivations,
      "Adultos Mayores (60+)": elderly,
      "Personas con Discapacidad": disCount
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(sotilloSummary);
  XLSX.utils.book_append_sheet(wb, ws1, "21 Comunas Sotillo");

  // Sheet 2: Resumen Casos Foráneos (Referencia Numérica)
  const foreignSummary = [{
    "Categoría": "Atención Solidaria Extramunicipal (Foráneos)",
    "Personas Cargadas Foráneas": foreignWorkers.length,
    "% Padrón Total": workers.length > 0 ? `${((foreignWorkers.length / workers.length) * 100).toFixed(1)}%` : "0%",
    "Ayudas Entregadas Totales (Unidades)": foreignDelivered.total,
    "Fármaco - Medicamento": foreignDelivered.meds,
    "Ayuda Humana": foreignDelivered.tech,
    "Insumo Médico - Social": foreignDelivered.supplies,
    "Atención / Derivación Clínica": foreignDelivered.derivations,
    "Nota": "Casos de municipios vecinos atendidos por Bienestar Social Sotillo"
  }];
  const ws2 = XLSX.utils.json_to_sheet(foreignSummary);
  XLSX.utils.book_append_sheet(wb, ws2, "Casos Foraneos");

  const fileName = `Informe_Ejecutivo_Territorial_Oficio_Sotillo_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
