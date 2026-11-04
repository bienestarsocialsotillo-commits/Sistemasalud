import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChronicProcurementItem } from "./chronicAlertsUtils";

export function generateProcurementOrderPdf(
  items: ChronicProcurementItem[],
  scope: 'immediate' | 'all' = 'immediate'
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Encabezado Institucional
  doc.setFillColor(15, 23, 42); // Navy 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("REPÚBLICA BOLIVARIANA DE VENEZUELA", pageWidth / 2, 7, { align: "center" });
  doc.setFontSize(8.5);
  doc.text("ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO", pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("DIRECCIÓN DE BIENESTAR SOCIAL • COORDINACIÓN GENERAL DE FARMACIA Y SALUD", pageWidth / 2, 16.5, { align: "center" });
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEN OFICIAL DE ADQUISICIÓN Y REPOSICIÓN DE FÁRMACOS CRÓNICOS", pageWidth / 2, 23, { align: "center" });

  // 2. Barra de Control y Metadatos
  const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  const timeStr = format(new Date(), "HH:mm");
  const orderCode = `ORD-CRON-${format(new Date(), "yyyyMMdd-HHmm")}`;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`FECHA DE EMISIÓN: ${dateStr.toUpperCase()} (${timeStr})`, 14, 34);
  doc.text(`CÓDIGO DE REQUERIMIENTO: ${orderCode}`, pageWidth - 14, 34, { align: "right" });

  // 3. Panel Informativo del Programa Municipal
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 38, pageWidth - 28, 22, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 38, pageWidth - 28, 22, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("GESTIÓN MUNICIPAL DE ATENCIÓN SOCIAL Y SALUD PÚBLICA", 18, 43.5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(
    "Autoridades: Prof. Jesús Marcano Tábata (Alcalde) • Ing. Yohana Estaba de Marcano (Primera Dama)",
    18,
    48.5
  );
  const scopeText = scope === 'immediate'
    ? "Alcance: Ventana Crítica de Atención Inmediata (Pacientes Vencidos ≥ 30 días y Próximos 25–29 días)"
    : "Alcance: Proyección Mensual Integral (100% de Pacientes Crónicos Monitoreados - Ciclo 30 Días)";
  doc.setFont("helvetica", "bold");
  doc.text(scopeText, 18, 54);

  // 4. Totales Consolidados
  const totalItemsCount = items.length;
  const totalBeneficiaries = items.reduce(
    (acc, it) => acc + (scope === 'immediate' ? it.criticalPatientsCount : it.totalPatientsCount),
    0
  );
  const totalRequiredUnits = items.reduce(
    (acc, it) => acc + (scope === 'immediate' ? it.immediateRequiredUnits : it.monthlyProjectedUnits),
    0
  );

  autoTable(doc, {
    startY: 64,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [
      [
        { content: "N°", styles: { halign: 'center', cellWidth: 10 } },
        { content: "FÁRMACO / PRINCIPIO ACTIVO", styles: { halign: 'left' } },
        { content: "PRESENTACIÓN", styles: { halign: 'left', cellWidth: 38 } },
        { content: "PATOLOGÍA BASE", styles: { halign: 'left', cellWidth: 32 } },
        { content: "PACIENTES", styles: { halign: 'center', cellWidth: 24 } },
        { content: "CANTIDAD A SOLICITAR", styles: { halign: 'right', cellWidth: 34 } }
      ]
    ],
    body: items.map((item, idx) => {
      const patientCount = scope === 'immediate' ? item.criticalPatientsCount : item.totalPatientsCount;
      const units = scope === 'immediate' ? item.immediateRequiredUnits : item.monthlyProjectedUnits;
      const patology = item.conditionType === 'hipertension' 
        ? 'Hipertensión' 
        : item.conditionType === 'diabetes' 
          ? 'Diabetes Mellitus' 
          : 'Uso Continuo';

      return [
        (idx + 1).toString(),
        item.medicationName.toUpperCase(),
        item.presentation.toUpperCase(),
        patology,
        `${patientCount} personas`,
        `${units.toLocaleString('es-VE')} un.`
      ];
    }),
    foot: [
      [
        { content: "TOTALES GENERALES REQUERIDOS", colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${totalBeneficiaries} pac.`, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: `${totalRequiredUnits.toLocaleString('es-VE')} unidades`, styles: { fontStyle: 'bold', halign: 'right', textColor: [225, 29, 72] } }
      ]
    ],
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
      valign: 'middle'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // 5. Cuadro de Firmas Institucionales al final
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  const signatureY = Math.min(Math.max(finalY + 22, 220), pageHeight - 45);

  const colWidth = (pageWidth - 28) / 3;

  // Firma 1: Coordinación de Farmacia
  doc.setDrawColor(148, 163, 184);
  doc.line(14, signatureY, 14 + colWidth - 8, signatureY);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("FARMACIA Y DISPENSACIÓN", 14 + (colWidth - 8) / 2, signatureY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Coordinación de Farmacia Sotillo", 14 + (colWidth - 8) / 2, signatureY + 8, { align: "center" });

  // Firma 2: Dirección de Bienestar Social
  doc.line(14 + colWidth + 4, signatureY, 14 + colWidth * 2 - 4, signatureY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("DIRECCIÓN DE BIENESTAR SOCIAL", 14 + colWidth + (colWidth - 8) / 2, signatureY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Revisado y Verificado", 14 + colWidth + (colWidth - 8) / 2, signatureY + 8, { align: "center" });

  // Firma 3: Aprobación del Despacho de Alcaldía
  doc.line(14 + colWidth * 2 + 8, signatureY, pageWidth - 14, signatureY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("DESPACHO DEL ALCALDE", 14 + colWidth * 2 + 8 + (colWidth - 8) / 2, signatureY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Prof. Jesús Marcano Tábata", 14 + colWidth * 2 + 8 + (colWidth - 8) / 2, signatureY + 8, { align: "center" });

  // 6. Pie de Página en Todas las Hojas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Alcaldía Bolivariana del Municipio Sotillo • Documento Oficial de Demanda Farmacéutica • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  // Descargar archivo
  const fileName = `Orden_Adquisicion_Farmacos_${scope}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(fileName);
}
