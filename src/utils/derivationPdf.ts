import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MedicationRecipe, Worker } from "@/types";

export function generateDerivationPdf(recipe: MedicationRecipe, worker?: Worker) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header background
  doc.setFillColor(30, 58, 138); // Navy blue
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Header texts
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("REPÚBLICA BOLIVARIANA DE VENEZUELA", pageWidth / 2, 8, { align: "center" });
  doc.setFontSize(9);
  doc.text("ALCALDÍA DEL MUNICIPIO JUAN ANTONIO SOTILLO", pageWidth / 2, 13, { align: "center" });
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("DIRECCIÓN DE SALUD Y BIENESTAR SOCIAL • RED PÚBLICA DE ATENCIÓN", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEN OFICIAL DE DERIVACIÓN Y ATENCIÓN MÉDICA", pageWidth / 2, 24, { align: "center" });

  // Reset text color
  doc.setTextColor(30, 41, 59);

  // Derivation Reference Code & Date
  const dateStr = recipe.createdAt?.toDate 
    ? recipe.createdAt.toDate().toLocaleDateString('es-VE') 
    : recipe.deliveredAt 
      ? new Date(recipe.deliveredAt).toLocaleDateString('es-VE') 
      : new Date().toLocaleDateString('es-VE');

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`FECHA DE EMISIÓN: ${dateStr}`, 14, 35);
  doc.text(`CÓDIGO DE DERIVACIÓN: DER-${(recipe.id || '00000').slice(0, 8).toUpperCase()}`, pageWidth - 14, 35, { align: "right" });

  // Section 1: Citizen Data
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 40, pageWidth - 28, 38, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 40, pageWidth - 28, 38, 2, 2, 'S');

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("1. DATOS DE IDENTIFICACIÓN DEL CIUDADANO", 18, 46);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`CIUDADANO(A): ${(worker?.fullName || "NO IDENTIFICADO").toUpperCase()}`, 18, 52);
  doc.text(`CÉDULA DE IDENTIDAD: ${worker?.dni || "N/A"}`, 18, 58);
  doc.text(`TELÉFONO DE CONTACTO: ${worker?.phone || "NO POSEE"}`, 18, 64);
  doc.text(`GÉNERO: ${worker?.gender === 'M' ? 'MASCULINO' : worker?.gender === 'F' ? 'FEMENINO' : 'OTRO'}`, 18, 70);

  doc.text(`COMUNA: ${(worker?.commune || recipe.commune || "NO ASIGNADA").toUpperCase()}`, 110, 52);
  doc.text(`SECTOR: ${(worker?.sector || "NO ASIGNADO").toUpperCase()}`, 110, 58);
  doc.text(`EDO. CIVIL: ${worker?.civilStatus || "N/A"}`, 110, 64);
  doc.text(`ÁREA SOCIAL: ${(worker?.socialArea || "GENERAL").toUpperCase()}`, 110, 70);

  // Section 2: Derivation Target and Specialty
  const serviceName = recipe.derivationService || recipe.medication || "SERVICIO MÉDICO";
  const centerName = recipe.derivationCenter || "CENTRO ASISTENCIAL DE LA RED PÚBLICA";
  const isSpecialized = recipe.derivationStatus === 'ESPECIALIZADO';

  doc.setFillColor(isSpecialized ? 238 : 240, isSpecialized ? 242 : 253, isSpecialized ? 255 : 244);
  doc.roundedRect(14, 83, pageWidth - 28, 48, 2, 2, 'F');
  doc.setDrawColor(isSpecialized ? 147 : 134, isSpecialized ? 197 : 239, isSpecialized ? 253 : 172);
  doc.roundedRect(14, 83, pageWidth - 28, 48, 2, 2, 'S');

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("2. DESTINO DE DERIVACIÓN Y SERVICIO ASISTENCIAL REQUERIDO", 18, 89);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text(`SERVICIO / ESPECIALIDAD: ${serviceName.toUpperCase()}`, 18, 97);

  doc.setFontSize(10);
  doc.text(`CENTRO ASISTENCIAL ASIGNADO: ${centerName.toUpperCase()}`, 18, 105);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(`MODALIDAD DE ATENCIÓN: ${isSpecialized ? "ATENCIÓN ESPECIALIZADA (PREVIA EVALUACIÓN)" : "DISPONIBILIDAD DIRECTA EN RED PÚBLICA"}`, 18, 113);
  doc.text(`ESTADO DE LA ORDEN: ${recipe.status === 'delivered' ? 'PROCESADA / EMITIDA DIRECTAMENTE' : 'ORDEN GENERADA EN TRÁMITE'}`, 18, 120);
  if (recipe.deliveryOfficer || recipe.deliveredBy) {
    doc.text(`FUNCIONARIO(A) ENLACE: ${(recipe.deliveryOfficer || recipe.deliveredBy || '').toUpperCase()}`, 18, 126);
  }

  // Section 3: Clinical Notes / Reason for referral
  const reasonText = recipe.derivationReason || recipe.deliveryNotes || recipe.technicalAidNotes || "Se remite ciudadano para evaluación, diagnóstico y atención médica oportuna en el servicio público correspondiente.";

  autoTable(doc, {
    startY: 136,
    head: [["3. MOTIVO CLÍNICO Y OBSERVACIONES DE LA DERIVACIÓN"]],
    body: [[reasonText]],
    theme: 'plain',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 4,
      fillColor: [248, 250, 252],
    },
    styles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 165;

  // Important Notice Box
  doc.setFillColor(254, 252, 232); // Amber light
  doc.roundedRect(14, finalY + 6, pageWidth - 28, 22, 2, 2, 'F');
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(14, finalY + 6, pageWidth - 28, 22, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  doc.text("IMPORTANTE PARA EL CIUDADANO:", 18, finalY + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("• Presentar este comprobante impreso y su Cédula de Identidad original en el centro asistencial o clínica en convenio asignado.", 18, finalY + 17);
  doc.text("• En caso de estudios de Laboratorio o Rayos X, acudir en horario matutino de atención de la institución correspondiente.", 18, finalY + 22);

  // Signatures Section
  const signY = pageHeight - 45;

  doc.setDrawColor(148, 163, 184);
  doc.line(20, signY, 85, signY);
  doc.line(pageWidth - 85, signY, pageWidth - 20, signY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("FIRMA Y SELLO DE EMISIÓN", 52.5, signY + 5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(recipe.deliveryOfficer || recipe.deliveredBy || "Dirección de Salud y Bienestar Social", 52.5, signY + 9, { align: "center" });
  doc.text("Alcaldía Juan Antonio Sotillo", 52.5, signY + 13, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("RECEPCIÓN EN CENTRO ASISTENCIAL", pageWidth - 52.5, signY + 5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Firma / Sello del Servicio Asistencial", pageWidth - 52.5, signY + 9, { align: "center" });
  doc.text("Fecha de Recepción: ____/____/202___", pageWidth - 52.5, signY + 13, { align: "center" });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Documento oficial expedido por el Sistema Integral de Salud y Gestión Social del Municipio Sotillo.", pageWidth / 2, pageHeight - 8, { align: "center" });

  // Save / Download PDF
  const filename = `Derivacion_${(worker?.fullName || "Ciudadano").replace(/\s+/g, '_')}_${(serviceName || "Servicio").replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}
