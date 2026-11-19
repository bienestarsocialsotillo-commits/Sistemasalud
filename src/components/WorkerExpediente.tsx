import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  History, 
  ClipboardCheck, 
  Pill, 
  User, 
  MapPin, 
  Calendar,
  Download,
  AlertCircle,
  Stethoscope,
  PlusCircle,
  Activity,
  Users,
  Paperclip,
  FileText
} from "lucide-react";
import { dataService } from '@/lib/dataService';
import { Worker, MedicalHistory, Evaluation, MedicationRecipe } from '@/types';
import MedicalHistoryDetail from './MedicalHistoryDetail';
import MedicalHistoryForm from './MedicalHistoryForm';
import EvaluationList from './EvaluationList';
import RecipeForm from './RecipeForm';
import { generateDerivationPdf } from '@/utils/derivationPdf';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateSafe, parseDateSafe } from '@/utils/dateUtils';
import { getRecipeCategory, isClinicalDerivationItem, CHRONIC_MEDICATION_REGEX } from '@/utils/categoryUtils';
import { 
  formatVenezuelanPhoneForWhatsApp, 
  OFFICIAL_WHATSAPP_TEMPLATES, 
  interpolateWhatsAppMessage, 
  buildWhatsAppLink 
} from '@/utils/whatsappUtils';
import { toast } from 'sonner';

interface WorkerExpedienteProps {
  worker: Worker;
  onClose?: () => void;
  autoOpenRecipe?: boolean;
}

export default function WorkerExpediente({ worker, onClose, autoOpenRecipe = false }: WorkerExpedienteProps) {
  const [history, setHistory] = useState<MedicalHistory | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(autoOpenRecipe);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyDialogMode, setHistoryDialogMode] = useState<boolean>(false);
  const [selectedRecipeForView, setSelectedRecipeForView] = useState<MedicationRecipe | null>(null);

  const fetchWorkerData = async () => {
    setLoading(true);
    const [historyData, evalsData, workerRecipes] = await Promise.all([
      dataService.getMedicalHistory(worker.id),
      dataService.getEvaluations(worker.id),
      dataService.getMedicationRecipesByWorker(worker.id)
    ]);
    
    setHistory(historyData);
    setEvaluations(evalsData);
    setRecipes(workerRecipes);
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkerData();
  }, [worker.id]);

  // Cálculo de alerta de reposición mensual para tratamientos crónicos (ciclo de 30 días)
  const chronicAlertInfo = React.useMemo(() => {
    const hasHypertension = history?.personalHistory?.hypertension === true;
    const hasDiabetes = history?.personalHistory?.diabetes === true;
    const permanentMedsStr = history?.personalHistory?.permanentMeds || '';

    const deliveredMeds = recipes.filter(r => r.status === 'delivered' && getRecipeCategory(r) === 'medication');
    const chronicRecipes = deliveredMeds.filter(r => {
      const name = (r.medication || r.supplyName || '').toLowerCase();
      return CHRONIC_MEDICATION_REGEX.test(name) || (hasHypertension && name.length > 0);
    }).sort((a, b) => {
      const dA = parseDateSafe(a.deliveredAt || a.createdAt);
      const dB = parseDateSafe(b.deliveredAt || b.createdAt);
      return (dB?.getTime() || 0) - (dA?.getTime() || 0);
    });

    const latest = chronicRecipes[0];
    if (!latest && !hasHypertension && !hasDiabetes && !permanentMedsStr.trim()) {
      return null;
    }

    const now = new Date();
    let daysElapsed = 999;
    let lastDateFormatted = "Sin entrega registrada";
    if (latest) {
      const d = parseDateSafe(latest.deliveredAt || latest.createdAt);
      if (d) {
        daysElapsed = Math.max(0, differenceInDays(now, d));
        lastDateFormatted = format(d, "dd/MM/yyyy", { locale: es });
      }
    }

    const medName = latest?.medication || latest?.supplyName || permanentMedsStr || "Tratamiento Regular Antihipertensivo";
    const isOverdue = daysElapsed >= 30;
    const isExpiringSoon = daysElapsed >= 25 && daysElapsed < 30;
    const daysRemaining = Math.max(0, 30 - daysElapsed);

    return {
      isChronic: true,
      hasHypertension,
      hasDiabetes,
      medName,
      daysElapsed,
      daysRemaining,
      lastDateFormatted,
      isOverdue,
      isExpiringSoon,
      latestRecipe: latest
    };
  }, [history, recipes]);

  const handleSendChronicWhatsApp = () => {
    if (!chronicAlertInfo) return;
    const phoneVal = formatVenezuelanPhoneForWhatsApp(worker.phone || worker.defaultRepresentative?.phone);
    if (!phoneVal.isValid) {
      toast.error("El ciudadano no posee un número de WhatsApp registrado.");
      return;
    }
    const template = OFFICIAL_WHATSAPP_TEMPLATES.find(t => t.id === 'notificacion_reposicion_cronica') || OFFICIAL_WHATSAPP_TEMPLATES[0];
    const msg = interpolateWhatsAppMessage(template.content, {
      nombre: worker.fullName,
      cedula: worker.dni,
      beneficio: chronicAlertInfo.medName,
      comuna: worker.commune,
      sector: worker.sector,
      fecha: "Inmediata (Dosis Mensual)",
      alcalde: "Prof. Jesús Marcano Tábata",
      primeraDama: "Ing. Yohana Estaba de Marcano"
    });
    const link = buildWhatsAppLink(phoneVal.internationalPhone, msg);
    window.open(link, '_blank', 'noopener,noreferrer');
    toast.success(`WhatsApp preparado para ${worker.fullName}`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Helper for safe dates
    const safeFormatDate = (val: any) => {
      if (!val) return 'S/D';
      try {
        const d = val.toDate ? val.toDate() : new Date(val);
        if (isNaN(d.getTime())) return 'S/D';
        return format(d, 'dd/MM/yyyy');
      } catch {
        return 'S/D';
      }
    };

    // Helper to prevent orphan titles and broken page transitions
    const getNextSectionY = (neededSpace = 32) => {
      const prevY = (doc as any).lastAutoTable?.finalY || 100;
      if (prevY + neededSpace > 275) {
        doc.addPage();
        return 22;
      }
      return prevY + 6;
    };

    // 1. Institutional Executive Header
    doc.setFillColor(30, 58, 138); // Navy blue Sotillo
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setFillColor(2, 132, 199); // Accent line
    doc.rect(0, 31, pageWidth, 1.2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("REPÚBLICA BOLIVARIANA DE VENEZUELA", pageWidth / 2, 7, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ALCALDÍA DEL MUNICIPIO BOLIVARIANO JUAN ANTONIO SOTILLO", pageWidth / 2, 13, { align: "center" });
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("DIRECCIÓN DE BIENESTAR SOCIAL Y SALUD PÚBLICA", pageWidth / 2, 19, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("EXPEDIENTE EJECUTIVO DE CARACTERIZACIÓN Y ATENCIÓN DIRECTA", pageWidth / 2, 26, { align: "center" });

    // Metadata Sub-bar
    const todayStr = format(new Date(), 'dd/MM/yyyy');
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 34, pageWidth - 28, 6.5, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, 34, pageWidth - 28, 6.5, 'S');

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`FECHA DE EMISIÓN: ${todayStr}`, 18, 38.5);
    doc.text(`EXPEDIENTE N°: ${worker.dni}`, pageWidth / 2, 38.5, { align: "center" });
    doc.text(`ESTATUS: ${(worker.status || 'ACTIVO').toUpperCase()}`, pageWidth - 18, 38.5, { align: "right" });

    // 2. Citizen Identification & Territorial Location (Grid table to prevent text collisions)
    autoTable(doc, {
      startY: 43,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      head: [
        [
          {
            content: "1. DATOS DE IDENTIFICACIÓN Y UBICACIÓN TERRITORIAL",
            colSpan: 4,
            styles: {
              fillColor: [30, 58, 138],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8,
              halign: 'left',
              cellPadding: 2
            }
          }
        ]
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 45.5 },
        1: { cellWidth: 45.5 },
        2: { cellWidth: 45.5 },
        3: { cellWidth: 45.5 },
      },
      body: [
        [
          { content: `CIUDADANO(A):\n${worker.fullName.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
          { content: `CÉDULA DE IDENTIDAD:\n${worker.dni}`, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
          { content: `CONDICIÓN / ESTATUS:\n${(worker.status || 'ACTIVO').toUpperCase()}`, styles: { fontStyle: 'bold', halign: 'center', textColor: worker.status === 'active' ? [5, 150, 105] : [100, 116, 139] } },
        ],
        [
          { content: `FECHA DE NACIMIENTO:\n${worker.birthDate || "S/D"}` },
          { content: `GÉNERO / ESTADO CIVIL:\n${worker.gender === 'M' ? 'MASCULINO' : worker.gender === 'F' ? 'FEMENINO' : (worker.gender || 'S/D')} / ${worker.civilStatus || 'S/D'}` },
          { content: `TELÉFONO DE CONTACTO:\n${worker.phone || "NO REGISTRA"}` },
          { content: `CONTACTO DE EMERGENCIA:\n${worker.emergencyContact || "NO REGISTRA"}` },
        ],
        [
          { content: `COMUNA TERRITORIAL:\n${(worker.commune || "NO ASIGNADA").toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold' } },
          { content: `SECTOR DE RESIDENCIA:\n${(worker.sector || "NO REGISTRA").toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold' } },
        ],
        [
          { content: `ÁREA SOCIAL / DEPENDENCIA:\n${(worker.socialArea || "NO REGISTRA").toUpperCase()}${worker.workplaceDepartment ? ` • ${worker.workplaceDepartment.toUpperCase()}` : ""}`, colSpan: 2, styles: { fontStyle: 'bold', textColor: [30, 58, 138] } },
          { content: `CENTRO ELECTORAL / EJE:\n${(worker.votingCenter || "NO REGISTRA").toUpperCase()}`, colSpan: 2 },
        ],
        [
          { content: `NIVEL DE INSTRUCCIÓN:\n${(worker.academicLevel || "NO REGISTRA").toUpperCase()}`, colSpan: 2 },
          { content: `PROFESIÓN U OFICIO:\n${(worker.academicDegree || "NO REGISTRA").toUpperCase()}`, colSpan: 2 },
        ]
      ]
    });

    // 3. Medical History & Requirements
    const historyTitleY = getNextSectionY(28);
    const historyData = [
      ["Patología Principal", (history?.pathology || "NINGUNA REGISTRADA").toUpperCase()],
      ["Grado de Dependencia Funcional", (history?.dependency || "INDEPENDIENTE").toUpperCase()],
      ["Requiere Ayuda Humana / Insumo", history?.requiresTechnicalAid ? `SÍ (${history.technicalAidType || "N/A"}) — Cantidad: ${history.technicalAidQuantity || 1} und.` : "NO REGISTRA REQUERIMIENTO"],
      ["Patologías de Base Registradas", [
        `Hipertensión: ${history?.personalHistory?.hypertension ? 'SÍ' : 'NO'}`,
        `Diabetes: ${history?.personalHistory?.diabetes ? 'SÍ' : 'NO'}`,
        `Asma: ${history?.personalHistory?.asthma ? 'SÍ' : 'NO'}`
      ].join("   •   ")],
      ["Alergias Conocidas", (history?.personalHistory?.allergies || "NINGUNA REGISTRADA").toUpperCase()],
      ["Tratamiento / Medicamentos Base", (history?.personalHistory?.medicationsNeeded ? `${history.personalHistory.medicationsNeeded}${history.personalHistory.medicationFrequency ? ` (${history.personalHistory.medicationFrequency})` : ''}` : "NINGUNO REGISTRADO").toUpperCase()]
    ];

    autoTable(doc, {
      startY: historyTitleY,
      margin: { left: 14, right: 14 },
      head: [
        [
          {
            content: "2. CARACTERIZACIÓN MÉDICA Y ANTECEDENTES CLÍNICOS",
            colSpan: 2,
            styles: {
              fillColor: [30, 58, 138],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8,
              halign: 'left',
              cellPadding: 2
            }
          }
        ]
      ],
      body: historyData,
      theme: 'striped',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold', textColor: [51, 65, 85] },
        1: { cellWidth: 127 }
      }
    });

    // 4. Family Nucleus (if any)
    if (worker.familyMembers && worker.familyMembers.length > 0) {
      const familyTitleY = getNextSectionY(26);
      const familyDataForTable = worker.familyMembers.map(m => [
        m.fullName.toUpperCase(),
        m.dni || "S/D",
        (m.relationship || "CARGA").toUpperCase(),
        m.birthDate || "S/D",
        m.hasDisability ? `SÍ (${(m.disabilityType || "ESPECIFICAR").toUpperCase()})` : "NO"
      ]);

      autoTable(doc, {
        startY: familyTitleY,
        margin: { left: 14, right: 14 },
        head: [
          [
            {
              content: "3. NÚCLEO FAMILIAR DIRECTO (CARGA FAMILIAR)",
              colSpan: 5,
              styles: {
                fillColor: [30, 58, 138],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'left',
                cellPadding: 2
              }
            }
          ],
          ["NOMBRES Y APELLIDOS", "CÉDULA", "PARENTESCO", "F. NACIMIENTO", "¿DISCAPACIDAD?"]
        ],
        body: familyDataForTable,
        theme: 'grid',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.2,
          halign: 'center',
          cellPadding: 1.8
        },
        styles: {
          fontSize: 7.2,
          cellPadding: 1.8,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 56, fontStyle: 'bold' },
          1: { cellWidth: 26, halign: 'center' },
          2: { cellWidth: 32, halign: 'center' },
          3: { cellWidth: 32, halign: 'center' },
          4: { cellWidth: 36, halign: 'center' },
        }
      });
    }

    // 5. Clinical Evaluations & Consultations
    if (evaluations.length > 0) {
      const evalTitleY = getNextSectionY(26);
      const evalsDataForTable = evaluations.map(e => [
        safeFormatDate(e.createdAt),
        e.type.toUpperCase(),
        (e.diagnosis || "SIN DIAGNÓSTICO ESPECÍFICO").toUpperCase(),
        (e.determination || "ATENCIÓN GENERAL").toUpperCase()
      ]);

      autoTable(doc, {
        startY: evalTitleY,
        margin: { left: 14, right: 14 },
        head: [
          [
            {
              content: "4. EVALUACIONES CLÍNICAS Y CONSULTAS MÉDICAS REALIZADAS",
              colSpan: 4,
              styles: {
                fillColor: [30, 58, 138],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'left',
                cellPadding: 2
              }
            }
          ],
          ["FECHA", "METODOLOGÍA / TIPO", "DIAGNÓSTICO MÉDICO", "DETERMINACIÓN ASISTENCIAL"]
        ],
        body: evalsDataForTable,
        theme: 'grid',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.2,
          halign: 'center',
          cellPadding: 1.8
        },
        styles: {
          fontSize: 7.2,
          cellPadding: 1.8,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 38 },
          2: { cellWidth: 62 },
          3: { cellWidth: 60 },
        }
      });
    }

    // 6. Executive History of Benefits, Prescriptions & Derivations
    const recipeSectionY = getNextSectionY(32);

    const sortedRecipes = [...recipes].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt as any) : new Date(0));
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt as any) : new Date(0));
      return dateB.getTime() - dateA.getTime();
    });

    // Helper to intelligently clean and summarize benefit / recipe items for executive PDF
    const formatExecutiveItem = (r: MedicationRecipe) => {
      const category = getRecipeCategory(r);

      // 1. DERIVACIÓN / ATENCIÓN CLÍNICA
      if (category === 'medical_derivation' || isClinicalDerivationItem(r) || r.derivationCenter || r.derivationService) {
        let rawMed = (r.medication || r.derivationService || 'Atención Médica').trim();
        rawMed = rawMed.replace(/\[FÁRMACO\s*\/\s*INSUMO\]/gi, '');
        rawMed = rawMed.replace(/\[AYUDA\s*HUMANA\]/gi, '');
        rawMed = rawMed.replace(/['’"”]/g, '');
        rawMed = rawMed.replace(/\(Derivación Directa\)/gi, '');
        rawMed = rawMed.replace(/OrO\s*\/\s*INSUMO\]/gi, '');
        rawMed = rawMed.trim();

        // Normalize Center
        let center = r.derivationCenter?.trim() || '';
        if (!center) {
          if (/cl[ií]nica\s+santa\s+ana/i.test(rawMed) || /cl[ií]nica\s+santa\s+ana/i.test(r.dosage || '')) {
            center = 'Clínica Santa Ana';
          } else if (/hospital/i.test(rawMed)) {
            center = 'Hospital Municipal';
          } else if (/cdi/i.test(rawMed)) {
            center = 'CDI Red Pública';
          } else {
            center = 'Red Asistencial Municipal';
          }
        }

        // Clean Service Name
        let service = r.derivationService?.trim() || '';
        if (!service) {
          if (/laboratorio/i.test(rawMed)) service = 'Laboratorio Clínico (Exámenes)';
          else if (/eco|ultrasonido/i.test(rawMed)) service = 'Estudio de Imagen / Ecografía';
          else if (/consulta/i.test(rawMed)) service = 'Consulta Médica Especializada';
          else if (/perfil/i.test(rawMed)) service = 'Perfil de Laboratorio';
          else service = rawMed.replace(/Clínica Santa Ana/gi, '').replace(/[-–—]/g, '').trim() || 'Servicio Asistencial';
        }

        const centerText = `Centro: ${center}`;
        const modalityText = r.derivationStatus ? `Modalidad: ${r.derivationStatus}` : 'Modalidad: Orden Asistencial';
        
        return {
          type: 'DERIVACIÓN MÉDICA',
          title: service.toUpperCase(),
          subtitle: `${centerText} • ${modalityText}`,
          quantity: `${r.quantity || 1} orden`,
          status: r.status === 'delivered' ? 'ATENDIDO' : 'DERIVADO'
        };
      }

      // 2. AYUDA TÉCNICA / HUMANA
      if (category === 'technical_aid' || r.requiresTechnicalAid) {
        const aidName = (r.technicalAidType || r.medication || 'Ayuda Técnica').toUpperCase();
        const obs = r.technicalAidNotes ? `Obs: ${r.technicalAidNotes}` : 'Asignación de Ayuda Humana';
        return {
          type: 'AYUDA TÉCNICA',
          title: aidName,
          subtitle: obs,
          quantity: `${r.technicalAidQuantity || r.quantity || 1} und.`,
          status: r.status === 'delivered' ? 'ENTREGADO' : 'EN TRÁMITE'
        };
      }

      // 3. APORTE ECONÓMICO
      if (r.socialAidType === 'economic_aid' || (r.economicAmount !== undefined && Number(r.economicAmount) > 0)) {
        const cur = r.economicCurrency === 'VES' ? 'Bs.' : '$';
        const numAmt = Number(r.economicAmount) || 0;
        const concept = r.economicConcept || r.medication || 'Apoyo Económico Social';
        return {
          type: 'APORTE SOCIAL',
          title: `APORTE ECONÓMICO: ${cur} ${numAmt.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
          subtitle: `Concepto: ${concept}`,
          quantity: '1 aporte',
          status: r.status === 'delivered' ? 'ENTREGADO' : 'EN TRÁMITE'
        };
      }

      // 4. DONATIVO DE ALIMENTOS
      if (r.socialAidType === 'food_bag' || (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0)) {
        const bags = Number(r.foodBagsCount || r.quantity) || 1;
        return {
          type: 'APORTE SOCIAL',
          title: `DONATIVO DE ALIMENTOS (${bags} BOLSA${bags > 1 ? 'S' : ''})`,
          subtitle: r.foodDonationNotes ? `Obs: ${r.foodDonationNotes}` : 'Programa de Seguridad Alimentaria',
          quantity: `${bags} bolsa(s)`,
          status: r.status === 'delivered' ? 'ENTREGADO' : 'EN TRÁMITE'
        };
      }

      // 5. MEDICAMENTOS (FÁRMACOS) E INSUMOS
      let medName = (r.medication || 'Medicamento').trim();
      medName = medName.replace(/\[FÁRMACO\s*\/\s*INSUMO\]/gi, '').replace(/['’"”]/g, '').trim();
      const pres = r.presentation && !medName.toLowerCase().includes(r.presentation.toLowerCase()) 
        ? ` (${r.presentation})` 
        : '';
      
      const isValidDosage = r.dosage && !/^(n\/?a|s\/?d|s\/?n|ningun[oa]?|no|cl[ií]nica|orden|hosp)/i.test(r.dosage.trim());
      const isValidFrequency = r.frequency && !/^(n\/?a|s\/?d|s\/?n|ningun[oa]?|no|fr$|orden|asistencial)/i.test(r.frequency.trim());
      
      const subParts: string[] = [];
      if (isValidDosage) subParts.push(`Dosis: ${r.dosage!.trim()}`);
      if (isValidFrequency) subParts.push(`Frecuencia: ${r.frequency!.trim()}`);
      
      return {
        type: category === 'medical_supply' ? 'INSUMO MÉDICO' : 'FÁRMACO',
        title: `${medName}${pres}`.toUpperCase(),
        subtitle: subParts.length > 0 ? subParts.join(' • ') : 'Tratamiento Ambulatorio / Dotación Directa',
        quantity: `${r.quantity || 1} und.`,
        status: r.status === 'delivered' ? 'ENTREGADO' : 'EN TRÁMITE'
      };
    };

    const recipesDataForTable = sortedRecipes.length > 0 
      ? sortedRecipes.map(r => {
          const item = formatExecutiveItem(r);
          return [
            safeFormatDate(r.createdAt || r.deliveredAt),
            item.type,
            `${item.title}\n${item.subtitle}`,
            item.quantity,
            item.status
          ];
        })
      : [["-", "-", "NO SE REGISTRAN ENTREGAS O REQUERIMIENTOS PREVIOS", "-", "-"]];

    autoTable(doc, {
      startY: recipeSectionY,
      margin: { left: 14, right: 14 },
      head: [
        [
          {
            content: "5. HISTORIAL DE BENEFICIOS, ATENCIONES Y SUMINISTRO ASISTENCIAL",
            colSpan: 5,
            styles: {
              fillColor: [30, 58, 138],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8,
              halign: 'left',
              cellPadding: 2
            }
          }
        ],
        ["FECHA", "CATEGORÍA", "DETALLE DEL BENEFICIO / ATENCIÓN ASISTENCIAL", "CANT.", "ESTATUS"]
      ],
      body: recipesDataForTable,
      theme: 'grid',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        halign: 'center',
        cellPadding: 1.8
      },
      styles: {
        fontSize: 7.2,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 94, halign: 'left' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          // Category badge styling
          if (data.column.index === 1) {
            const val = String(data.cell.raw);
            if (val === 'DERIVACIÓN MÉDICA') {
              data.cell.styles.textColor = [14, 116, 144];
            } else if (val === 'FÁRMACO') {
              data.cell.styles.textColor = [37, 99, 235];
            } else if (val === 'AYUDA TÉCNICA') {
              data.cell.styles.textColor = [124, 58, 237];
            } else if (val === 'APORTE SOCIAL') {
              data.cell.styles.textColor = [217, 119, 6];
            }
          }
          // Status badge styling
          if (data.column.index === 4) {
            const val = String(data.cell.raw);
            if (val === 'ENTREGADO' || val === 'ATENDIDO') {
              data.cell.styles.textColor = [5, 150, 105];
            } else if (val === 'DERIVADO') {
              data.cell.styles.textColor = [14, 116, 144];
            } else if (val === 'EN TRÁMITE') {
              data.cell.styles.textColor = [217, 119, 6];
            }
          }
        }
      }
    });

    // 7. Formal Institutional Signatures
    const lastY = (doc as any).lastAutoTable?.finalY || 200;
    let sigY = lastY + 14;
    if (sigY + 28 > 275) {
      doc.addPage();
      sigY = 30;
    }

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    
    // Left signature: Dirección de Bienestar Social
    doc.line(20, sigY + 12, 85, sigY + 12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("DIRECCIÓN DE BIENESTAR SOCIAL", 52.5, sigY + 16, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Firma Autorizada y Sello Institucional", 52.5, sigY + 20, { align: "center" });

    // Right signature: Beneficiario / Representante
    doc.line(pageWidth - 85, sigY + 12, pageWidth - 20, sigY + 12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(worker.fullName.toUpperCase(), pageWidth - 52.5, sigY + 16, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`C.I. ${worker.dni} • Beneficiario(a) / Representante`, pageWidth - 52.5, sigY + 20, { align: "center" });

    // 8. Headers and Footers on every page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Top banner on continuation pages
      if (i > 1) {
        doc.setFillColor(30, 58, 138);
        doc.rect(0, 0, pageWidth, 11, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text(`ALCALDÍA DEL MUNICIPIO JUAN ANTONIO SOTILLO • EXPEDIENTE DE ${worker.fullName.toUpperCase()} (C.I. ${worker.dni})`, pageWidth / 2, 7.5, { align: "center" });
      }

      // Bottom footer
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Alcaldía del Municipio Bolivariano Juan Antonio Sotillo • Dirección de Bienestar Social • Página ${i} de ${totalPages}`,
        pageWidth / 2,
        290,
        { align: "center" }
      );
    }

    doc.save(`Ficha_Ejecutiva_${worker.fullName.replace(/\s+/g, '_')}_CI_${worker.dni}.pdf`);
  };

  const exportToExcel = () => {
    const rows = [
      ["REGISTRO CLÍNICO - BIENESTAR SOCIAL SOTILLO", ""],
      ["", ""],
      ["CÉDULA DE IDENTIDAD", worker.dni],
      ["NOMBRE COMPLETO", worker.fullName.toUpperCase()],
      ["FECHA DE NACIMIENTO", worker.birthDate],
      ["GÉNERO", worker.gender],
      ["ESTADO CIVIL", worker.civilStatus],
      ["COMUNA", worker.commune],
      ["SECTOR", worker.sector],
      ["DIRECCIÓN", worker.address || "NO ESPECIFICADA"],
      ["TELÉFONO", worker.phone],
      ["CONTACTO DE EMERGENCIA", worker.emergencyContact || "N/A"],
      ["ÁREA SOCIAL", `${worker.socialArea || "NO APLICA"}${worker.workplaceDepartment ? ` - ${worker.workplaceDepartment}` : ""}`],
      ["EJE / CENTRO VOTACIÓN", worker.votingCenter || "NO REGISTRADO"],
      ["NIVEL DE INSTRUCCIÓN", worker.academicLevel || "NO REGISTRADO"],
      ["PROFESIÓN / TÍTULO", worker.academicDegree || "NO REGISTRADO"],
      ["", ""],
      ["HISTORIA CLÍNICA Y DE APOYO", ""],
      ["PATOLOGÍA PRINCIPAL", history?.pathology || "NINGUNA REGISTRADA"],
      ["GRADO DE DEPENDENCIA CLÍNICA", history?.dependency || "INDEPENDIENTE"],
      ["PRESENTA DISCAPACIDAD", history?.hasDisability ? "SÍ" : "NO"],
      ["TIPO DE DISCAPACIDAD", history?.hasDisability ? history?.disabilityType || "N/A" : "N/A"],
      ["REQUIERE AYUDA HUMANA", history?.requiresTechnicalAid ? "SÍ" : "NO"],
      ["TIPO DE AYUDA HUMANA REQUERIDA", history?.requiresTechnicalAid ? history?.technicalAidType || "N/A" : "NINGUNA"],
      ["CANTIDAD AYUDA HUMANA", history?.requiresTechnicalAid ? history?.technicalAidQuantity || 0 : 0],
      ["NOTAS ADICIONALES AYUDA HUMANA", history?.technicalAidNotes || "NINGUNA"],
      ["MEDICAMENTO BASE REQUERIDO", history?.personalHistory.medicationsNeeded || "NINGUNO"],
      ["FRECUENCIA DE TOMA", history?.personalHistory.medicationFrequency || "N/A"],
      ["ALERGIAS REGISTRADAS", history?.personalHistory.allergies || "NINGUNA"],
      ["CIRUGÍAS PREVIAS", history?.personalHistory.surgeries || "NINGUNA"],
      ["", ""],
      ["HISTORIAL DE HISTORIAS Y CONSULTAS", ""],
      ["FECHA", "TIPO", "DIAGNÓSTICO", "DETERMINACIÓN"]
    ];

    // Add evaluations in sheet rows
    evaluations.forEach(e => {
      const dateStr = formatDateSafe(e.createdAt, 'dd/MM/yyyy', 'S/D');
      rows.push([dateStr, e.type.toUpperCase(), e.diagnosis, e.determination.toUpperCase()]);
    });

    rows.push(["", ""]);
    rows.push(["HISTORIAL DE REPOSTAJES DE FÁRMACOS", ""]);
    rows.push(["FECHA", "MEDICAMENTO Y TRATAMIENTO", "CANTIDAD ENTREGADA"]);
    
    // Add recipes
    recipes.forEach(r => {
      const dateStr = formatDateSafe(r.createdAt, 'dd/MM/yyyy', 'S/D');
      rows.push([dateStr, r.medication, String(r.quantity)]);
    });

    // Generate CSV UTF-8 with BOM for Excel Spanish and global locale compatibility
    const csvContent = "\uFEFF" + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.className = "hidden";
    link.setAttribute("href", url);
    link.setAttribute("download", `Ficha_Clasificacion_${worker.fullName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Patient Header Card */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-none ring-1 ring-slate-200 rounded-none md:rounded-xl">
        <div className="bg-blue-900 px-6 py-8 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Stethoscope className="w-32 h-32" />
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 border-4 border-blue-800 shadow-xl">
              <span className="text-3xl font-bold">{worker.fullName.charAt(0)}</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight uppercase">{worker.fullName}</h2>
              <div className="flex flex-wrap gap-4 text-sm opacity-80">
                <span className="flex items-center gap-1.5 font-bold"><User className="w-4 h-4" /> {worker.dni}</span>
                <span className="flex items-center gap-1.5 font-bold"><MapPin className="w-4 h-4" /> {worker.commune}</span>
                <span className="flex items-center gap-1.5 font-bold"><Calendar className="w-4 h-4" /> {worker.birthDate}</span>
              </div>
            </div>
            <div className="md:ml-auto flex flex-wrap gap-2 pt-4 md:pt-0 items-center">
               <Button
                 onClick={() => setIsRecipeDialogOpen(true)}
                 className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold uppercase text-[10px] tracking-wider h-9 px-3.5 shadow-lg shadow-emerald-950/20 flex items-center gap-1.5"
               >
                 <Pill className="w-4 h-4" />
                 + Cargar Requerimiento
               </Button>
               <Button
                 onClick={() => {
                   setHistoryDialogMode(true);
                   setIsHistoryDialogOpen(true);
                 }}
                 variant="secondary"
                 className="bg-blue-800 hover:bg-blue-700 text-white font-bold uppercase text-[10px] tracking-wider h-9 px-3 border border-blue-600/50 flex items-center gap-1.5"
               >
                 <History className="w-3.5 h-3.5" />
                 {history ? "Actualizar Ficha Médica" : "+ Ficha Médica"}
               </Button>
               <Button
                 onClick={exportToPDF}
                 variant="outline"
                 className="bg-white/15 hover:bg-white/25 text-white border-white/30 font-black uppercase text-[10px] tracking-wider h-9 px-3 flex items-center gap-1.5 shadow-sm transition-all"
                 title="Descargar Ficha Ejecutiva PDF"
               >
                 <Download className="w-3.5 h-3.5" />
                 Ficha PDF
               </Button>
               <Badge className={worker.status === 'active' ? 'bg-emerald-500 text-white font-black ml-1' : 'bg-slate-400 text-white font-black ml-1'}>
                 {worker.status.toUpperCase()}
               </Badge>
            </div>
          </div>
        </div>
        {/* BANNER DE ALERTA DE REPOSICIÓN MENSUAL (TRATAMIENTOS CRÓNICOS / HIPERTENSIÓN - CICLO 30 DÍAS) */}
        {chronicAlertInfo && (
          <div className={`px-6 py-3.5 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            chronicAlertInfo.isOverdue
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : chronicAlertInfo.isExpiringSoon
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                chronicAlertInfo.isOverdue
                  ? 'bg-rose-600 text-white'
                  : chronicAlertInfo.isExpiringSoon
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}>
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[9px] font-black uppercase ${
                    chronicAlertInfo.isOverdue
                      ? 'bg-rose-600 text-white'
                      : chronicAlertInfo.isExpiringSoon
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-700 text-white'
                  }`}>
                    {chronicAlertInfo.isOverdue
                      ? `🔴 REPOSICIÓN MENSUAL VENCIDA (DÍA ${chronicAlertInfo.daysElapsed} / 30)`
                      : chronicAlertInfo.isExpiringSoon
                      ? `🟡 PRÓXIMO A VENCER (QUEDAN ${chronicAlertInfo.daysRemaining} DÍAS)`
                      : `🟢 TRATAMIENTO AL DÍA (QUEDAN ${chronicAlertInfo.daysRemaining} DÍAS)`}
                  </Badge>
                  <span className="text-xs font-black uppercase tracking-tight">
                    {chronicAlertInfo.medName}
                  </span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Última entrega registrada: <strong>{chronicAlertInfo.lastDateFormatted}</strong> ({chronicAlertInfo.daysElapsed === 999 ? 'Sin registro previo' : `Hace ${chronicAlertInfo.daysElapsed} días`}) &bull; Ciclo estándar de cobertura médica: 30 días.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                onClick={handleSendChronicWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold h-8 px-3 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>📲 Convocatoria WhatsApp</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsRecipeDialogOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold h-8 px-3 rounded-lg border-slate-300 shadow-xs cursor-pointer"
              >
                + Despachar Nuevo Ciclo
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cédula</p>
              <p className="font-semibold text-slate-700">{worker.dni}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sector</p>
              <p className="font-semibold text-slate-700">{worker.sector}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">Razón / Área Social</p>
              {(() => {
                const list = (worker.socialAreas && worker.socialAreas.length > 0)
                  ? worker.socialAreas
                  : (worker.socialArea && worker.socialArea !== 'NO_APLICA' ? worker.socialArea.split(' / ') : []);
                return (
                  <div className="space-y-1">
                    {list.length > 1 ? (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {list.map((area, idx) => (
                          <span key={idx} className="font-bold text-blue-950 bg-blue-100/90 border border-blue-200 px-1.5 py-0.5 rounded-md text-[10px] uppercase tracking-tight">
                            {area}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="font-bold text-blue-900 text-xs sm:text-sm uppercase tracking-tight">{worker.socialArea || "No registrada"}</p>
                    )}
                    {worker.workplaceDepartment && (
                      <span className="inline-flex items-center gap-1 font-black text-blue-900 bg-blue-100/80 border border-blue-300 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-tight">
                        🏢 {worker.workplaceDepartment}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-1">C. Electoral</p>
              <p className="font-bold text-emerald-950 text-xs sm:text-sm uppercase tracking-tight">{worker.votingCenter || "No registrado"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Impacto Municipal</p>
              <p className="font-semibold text-slate-700 navigation-badge">{evaluations.length + recipes.length} Atenciones</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banner de Acción Inmediata: Sugerencia de Requerimiento si no posee solicitudes previas */}
      {recipes.length === 0 && !loading && (
        <div className="bg-emerald-50/90 border border-emerald-300/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-700/20">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                  Acción Rápida
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  Expediente sin requerimientos cargados
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-0.5">
                Carga Inmediata de Medicamento, Pañales o Ayuda Humana
              </h4>
              <p className="text-xs text-slate-600">
                Inicie la asignación de requerimientos para <span className="font-bold text-slate-900">{worker.fullName}</span> con los datos del paciente listos.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsRecipeDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest h-10 px-5 shrink-0 shadow-md shadow-emerald-700/20 w-full sm:w-auto"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Cargar Requerimiento Ahora →
          </Button>
        </div>
      )}

      <Tabs defaultValue="ficha" className="w-full">
        <TabsList className="bg-slate-100/50 p-1 border border-slate-200 w-full md:w-auto">
          <TabsTrigger value="ficha" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ClipboardCheck className="w-4 h-4" /> FICHA INTEGRAL
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <History className="w-4 h-4" /> ANTECEDENTES
          </TabsTrigger>
          <TabsTrigger value="medications" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Pill className="w-4 h-4" /> REQUERIMIENTOS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ficha" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-200 shadow-sm">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-black text-blue-900 uppercase tracking-widest">Ficha Detallada de Diagnóstico Social</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Datos críticos de apoyo para el equipo de Bienestar Social</CardDescription>
                      </div>
                   </CardHeader>
                   <CardContent className="p-6 space-y-6 text-slate-700">
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                       <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                         <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Identificación Geográfica</h4>
                         <p className="text-xs font-semibold mb-1"><span className="text-slate-400 font-bold">Comuna:</span> {worker.commune}</p>
                         <p className="text-xs font-semibold mb-1"><span className="text-slate-400 font-bold">Sector:</span> {worker.sector}</p>
                         <p className="text-xs font-semibold"><span className="text-slate-400 font-bold">Dirección:</span> {worker.address || "No especificada"}</p>
                       </div>

                       <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                         <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 mb-2">Área Social</h4>
                         <p className="text-xs font-semibold mb-1"><span className="text-slate-400 font-bold">Clasificación:</span> <span className="font-bold text-blue-800 uppercase">{worker.socialArea || "No especificado"}</span></p>
                         <p className="text-xs font-semibold"><span className="text-slate-400 font-bold">Eje de Votación:</span> <span className="font-bold text-emerald-800 uppercase">{worker.votingCenter || "No registrado"}</span></p>
                        </div>

                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                          <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 mb-2">Formación Académica</h4>
                          <p className="text-xs font-semibold mb-1"><span className="text-slate-400 font-bold">Nivel:</span> <span className="font-bold text-indigo-900 uppercase">{worker.academicLevel || "No registrado"}</span></p>
                          <p className="text-xs font-semibold"><span className="text-slate-400 font-bold">Título / Oficio:</span> <span className="font-bold text-slate-800 uppercase">{worker.academicDegree || "N/A"}</span></p>
                        </div>

                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-950 mb-2">Dependencia Funcional</h4>
                            <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[9px] uppercase px-2 py-0.5">
                              {history?.dependency || "INDEPENDIENTE"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Estatus de Dependencia de Salud</p>
                       </div>

                       <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                         <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Diversidad Funcional (Discapacidad)</h4>
                         {worker.hasDisability ? (
                           <div>
                             <Badge className="bg-blue-100 text-blue-800 border-none font-bold uppercase text-[9px] mb-2">POSEE DISCAPACIDAD</Badge>
                             <p className="text-xs font-semibold"><span className="text-slate-400 font-bold">Tipo:</span> {worker.disabilityType || "No especificado"}</p>
                           </div>
                         ) : (
                           <p className="text-xs italic text-slate-400">No registra discapacidad permanente</p>
                         )}
                       </div>
                     </div>

                     <div className="border-t border-slate-100 pt-6">
                       <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-3">Patologías Detectadas y Antecedentes Médicos</h3>
                       {history ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Patologías Crónicas</p>
                             <div className="flex flex-wrap gap-1.5">
                               {history.personalHistory.hypertension && <Badge className="bg-red-50 text-red-700 border-red-105/50 font-black text-[9px] uppercase">Hipertensión</Badge>}
                               {history.personalHistory.diabetes && <Badge className="bg-amber-50 text-amber-700 border-amber-105/50 font-black text-[9px] uppercase">Diabetes</Badge>}
                               {history.personalHistory.asthma && <Badge className="bg-blue-50 text-blue-700 border-blue-105/50 font-black text-[9px] uppercase">Asma</Badge>}
                               {!history.personalHistory.hypertension && !history.personalHistory.diabetes && !history.personalHistory.asthma && <span className="text-xs italic text-slate-400">Sin condiciones de base</span>}
                             </div>
                             {(history.pathology || history.personalHistory.chronicDiseases) && (
                               <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                 <p className="text-[10px] text-slate-500 font-bold uppercase">Detalle de Patología:</p>
                                 <p className="text-xs font-semibold text-slate-800">{history.pathology || history.personalHistory.chronicDiseases}</p>
                               </div>
                             )}
                           </div>

                           <div className="space-y-2">
                             <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alergias y Tratamientos de Base</p>
                             <p className="text-xs font-semibold mb-1"><span className="text-slate-400">Alergias:</span> {history.personalHistory.allergies || "Ninguna registrada"}</p>
                             <p className="text-xs font-semibold"><span className="text-slate-400">Tratamiento de base:</span> {history.personalHistory.permanentMeds || history.personalHistory.medicationsNeeded || "Ninguno"}</p>
                             {history.personalHistory.medicationFrequency && (
                               <p className="text-[11px] text-slate-500 italic">Frecuencia: {history.personalHistory.medicationFrequency}</p>
                             )}
                           </div>
                         </div>
                       ) : (
                         <div className="p-4 bg-amber-50/20 rounded-xl border border-dashed border-amber-200 text-center">
                           <p className="text-xs text-amber-800 font-bold uppercase mb-1">Historia Médica Incompleta</p>
                           <p className="text-[10px] text-slate-400 leading-normal">
                             Debe registrar la historia clínica de base en la pestaña "ANTECEDENTES" para agregar información detallada sobre de patologías crónicas.
                           </p>
                         </div>
                       )}
                     </div>

                     <div className="border-t border-slate-100 pt-6">
                       <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-3">Suministros y Solicitudes de Apoyo Solicitados</h3>
                       <div className="space-y-4">
                         {/* Technical Aids */}
                         <div>
                           <p className="text-[10px] font-black uppercase text-blue-900 tracking-wider mb-2">♿ Requerimientos de Ayudas Humanas</p>
                            
                            {/* Clinical History Baseline Requirement if any */}
                            {history?.requiresTechnicalAid && (
                              <div className="mb-3 flex justify-between items-center bg-blue-100/40 border border-blue-200 p-3 rounded-xl animate-in fade-in duration-300">
                                <div className="space-y-0.5">
                                  <Badge className="bg-blue-600 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded-md border-none shadow-sm">
                                    REQUERIMIENTO BASE (FICHA CLÍNICA)
                                  </Badge>
                                  <p className="text-xs font-bold uppercase text-blue-950">{history.technicalAidType || "Silla de Ruedas"}</p>
                                  {history.technicalAidNotes && (
                                    <p className="text-[10px] font-medium text-blue-800 italic">Obs: {history.technicalAidNotes}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-black text-blue-750 bg-blue-200/50 px-2.5 py-1 rounded-lg border border-blue-300">
                                    Cant: {history.technicalAidQuantity || 1}
                                  </span>
                                </div>
                              </div>
                            )}
                           {recipes.filter(r => r.requiresTechnicalAid || r.category === 'technical_aid').length === 0 ? (
                             <p className="text-xs italic text-slate-400 pl-2">No se registran solicitudes de ayudas humanas (andaderas, muletas, sillas de ruedas, etc.)</p>
                           ) : (
                             <div className="space-y-2">
                               {recipes.filter(r => r.requiresTechnicalAid || r.category === 'technical_aid').map((item, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-blue-50/20 border border-blue-105/30 p-3 rounded-xl">
                                   <div>
                                     <p className="text-xs font-bold uppercase text-blue-950 flex items-center gap-2 flex-wrap"><span>{item.technicalAidType || item.medication}</span>{item.recipeFileUrl && <button onClick={() => setSelectedRecipeForView(item)} className="cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-700 font-extrabold text-[8px] uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-blue-205 transition-colors"><Paperclip className="w-2.5 h-2.5 text-blue-600" /> Soporte</button>}</p>
                                     <p className="text-[10px] font-bold text-slate-500">Obs: {item.technicalAidNotes || "Sin observaciones específicas"}</p>
                                   </div>
                                   <div className="flex items-center gap-3">
                                     <span className="text-xs font-black text-blue-700">Cant: {item.technicalAidQuantity || item.quantity}</span>
                                     <Badge className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                       item.status === 'delivered' 
                                         ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                         : 'bg-amber-50 text-amber-700 border border-amber-200'
                                     }`}>
                                       {item.status === 'delivered' ? 'Entregado' : 'Pendiente'}
                                     </Badge>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>

                         {/* Medications/Other requirements */}
                         <div className="pt-2">
                           <p className="text-[10px] font-black uppercase text-slate-650 tracking-wider mb-2">💊 Solicitudes de Medicamentos y Medicinas</p>
                            
                            {/* Clinical History Baseline Requirement if any */}
                            {history?.personalHistory.medicationsNeeded && (
                              <div className="mb-3 flex justify-between items-center bg-indigo-50 border border-indigo-100 p-3 rounded-xl animate-in fade-in duration-300">
                                <div className="space-y-0.5">
                                  <Badge className="bg-indigo-600 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded-md border-none shadow-sm">
                                    TRATAMIENTO DE BASE (FICHA CLÍNICA)
                                  </Badge>
                                  <p className="text-xs font-bold uppercase text-indigo-950">{history.personalHistory.medicationsNeeded}</p>
                                  {history.personalHistory.medicationFrequency && (
                                    <p className="text-[10px] font-bold text-indigo-600 leading-none mt-1">Frecuencia: {history.personalHistory.medicationFrequency}</p>
                                  )}
                                </div>
                              </div>
                            )}
                           {recipes.filter(r => !r.requiresTechnicalAid && r.category !== 'technical_aid').length === 0 ? (
                             <p className="text-xs italic text-slate-400 pl-2">No se registran solicitudes de medicamentos base.</p>
                           ) : (
                             <div className="space-y-2">
                               {recipes.filter(r => !r.requiresTechnicalAid && r.category !== 'technical_aid').map((item, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl hover:bg-slate-100/30 transition-all">
                                   <div>
                                     <p className="text-xs font-bold uppercase text-slate-800 flex items-center gap-2 flex-wrap"><span>{item.medication}</span>{item.recipeFileUrl && <button onClick={() => setSelectedRecipeForView(item)} className="cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-[8px] uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-emerald-200 transition-colors"><Paperclip className="w-2.5 h-2.5 text-emerald-600" /> Récipe</button>}</p>
                                     <p className="text-[10px] font-bold text-slate-550 leading-none mt-1">Dosificación: {item.dosage} / {item.frequency}</p>
                                     {item.isDeliveredToRepresentative && (
                                       <p className="text-[9px] font-bold text-blue-900 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 mt-1 w-fit">
                                         👤 Retiró Representante: {item.representativeFullName} (C.I. {item.representativeDni} - {item.representativeRelationship})
                                       </p>
                                     )}
                                   </div>
                                   <div className="flex items-center gap-3">
                                     <span className="text-xs font-black text-slate-700">x{item.quantity}</span>
                                     <Badge className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                       item.status === 'delivered' 
                                         ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                                         : 'bg-amber-50 text-amber-730 border border-amber-250'
                                     }`}>
                                       {item.status === 'delivered' ? 'Entregado' : 'Pendiente'}
                                     </Badge>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       </div>
                     </div>
                   </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Historial Cronológico de Abordajes</CardTitle>
                      </div>
                   </CardHeader>
                </Card>

                {/* 👪 CARGA FAMILIAR / NÚCLEO FAMILIAR VIEW */}
                <Card className="border-slate-200 shadow-sm my-6">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          Carga Familiar (Núcleo Familiar)
                        </CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Parientes convivientes registrados del ciudadano</CardDescription>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 border-none font-black text-[10px] uppercase px-2.5 py-0.5 rounded-md">
                        {worker.familyMembers?.length || 0} Integrantes
                      </Badge>
                   </CardHeader>
                   <CardContent className="p-0">
                      {!worker.familyMembers || worker.familyMembers.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 font-sans">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                          <p className="text-xs font-bold uppercase tracking-wider">No se ha registrado carga familiar</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-sans">Puede añadir integrantes del núcleo familiar editando la ficha base de este ciudadano.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-slate-50/60">
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[9px] font-black text-slate-500 uppercase tracking-wider px-6 py-3">Nombre Completo</TableHead>
                                <TableHead className="text-[9px] font-black text-slate-500 uppercase tracking-wider px-6 py-3">Cédula</TableHead>
                                <TableHead className="text-[9px] font-black text-slate-500 uppercase tracking-wider px-6 py-3">Parentesco</TableHead>
                                <TableHead className="text-[9px] font-black text-slate-500 uppercase tracking-wider px-6 py-3">Información Adicional</TableHead>
                                <TableHead className="text-[9px] font-black text-slate-500 uppercase tracking-wider px-6 py-3">Condición de Discapacidad</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {worker.familyMembers.map((member, idx) => {
                                let ageStr = "N/A";
                                if (member.birthDate) {
                                  try {
                                    const birth = new Date(member.birthDate);
                                    const diff = Date.now() - birth.getTime();
                                    const ageDate = new Date(diff);
                                    const years = Math.abs(ageDate.getUTCFullYear() - 1970);
                                    ageStr = isNaN(years) ? "N/A" : `${years} años`;
                                  } catch (e) {
                                    ageStr = "N/A";
                                  }
                                }
                                return (
                                  <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                                    <TableCell className="font-bold text-slate-800 text-xs uppercase px-6 py-3">{member.fullName || "Sin registrar nombre"}</TableCell>
                                    <TableCell className="font-mono text-xs text-slate-600 px-6 py-3 font-bold">{member.dni || "S/D"}</TableCell>
                                    <TableCell className="text-xs font-bold uppercase text-blue-700 px-6 py-3">
                                      <Badge className="bg-blue-50 text-blue-700 font-extrabold border-none text-[8.5px] uppercase">{member.relationship || "CORRELA"}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600 px-6 py-3 font-medium">
                                      {ageStr} <span className="text-[10px] text-slate-400 font-mono">({member.birthDate})</span>
                                    </TableCell>
                                    <TableCell className="text-xs font-medium px-6 py-3">
                                      {member.hasDisability ? (
                                        <Badge variant="outline" className="text-[8px] font-black bg-red-50 text-red-700 border-red-200 uppercase px-2 py-0.5 rounded-md text-center">
                                          DISC: {member.disabilityType || "SÍ RECOGE"}
                                        </Badge>
                                      ) : (
                                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">No aplica</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                   </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Historial Cronológico de Abordajes</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400 font-sans">Seguimiento de visitas médicas y sociales</CardDescription>
                      </div>
                   </CardHeader>
                   <CardContent className="p-0">
                      <div className="divide-y divide-slate-100">
                         {evaluations.length === 0 && recipes.length === 0 ? (
                           <div className="p-12 text-center text-slate-400 italic text-sm">No se registran atenciones previas en el sistema.</div>
                         ) : (
                           [...evaluations.map(e => ({ type: 'eval', date: e.createdAt, data: e })), 
                            ...recipes.map(r => ({ type: 'rec', date: r.createdAt, data: r }))]
                            .sort((a, b) => {
                              const dateA = a.date?.toDate ? a.date.toDate() : new Date();
                              const dateB = b.date?.toDate ? b.date.toDate() : new Date();
                              return dateB.getTime() - dateA.getTime();
                            })
                            .map((item, idx) => (
                              <div key={idx} className="p-5 hover:bg-slate-50/50 transition-colors flex gap-4">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'eval' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {item.type === 'eval' ? <Stethoscope className="w-5 h-5" /> : <Pill className="w-5 h-5" />}
                                 </div>
                                 <div className="space-y-1 flex-1">
                                    <div className="flex justify-between items-start">
                                       <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                          {item.type === 'eval' ? `Evaluación Médica: ${(item.data as Evaluation).type.toUpperCase()}` : `Solicitud/Entrega: ${(item.data as MedicationRecipe).medication}`}
                                       </h5>
                                       <span className="text-[10px] font-bold text-slate-400">
                                          {item.date?.toDate ? format(item.date.toDate(), 'dd/MM/yyyy HH:mm') : 'Hoy'}
                                       </span>
                                    </div>
                                    {item.type === 'eval' ? (
                                      <div className="space-y-1.5 pt-1">
                                         <p className="text-[11px] text-slate-600 leading-relaxed">
                                            <span className="font-bold text-slate-900">Diagnóstico:</span> {(item.data as Evaluation).diagnosis}
                                         </p>
                                         {(item.data as Evaluation).medicationsNeeded && (
                                             <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                                <p className="text-[10px] font-black text-blue-900 uppercase">Medicinas Sugeridas:</p>
                                                <p className="text-[10px] text-blue-700 font-bold">{(item.data as Evaluation).medicationsNeeded} - {(item.data as Evaluation).medicationFrequency}</p>
                                             </div>
                                         )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3 pt-1">
                                         <Badge variant="outline" className="text-[10px] font-black bg-white border-emerald-110 text-emerald-700 uppercase">
                                            {(item.data as MedicationRecipe).quantity} Unidades
                                         </Badge>
                                         <span className="text-[10px] text-slate-500 italic">{(item.data as MedicationRecipe).commune}</span>
                                      </div>
                                    )}
                                 </div>
                              </div>
                            ))
                         )}
                      </div>
                   </CardContent>
                </Card>
             </div>

             <div className="space-y-6">
                <Card className="border-slate-200 shadow-sm h-fit">
                   <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                      <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest">Resumen Clínico</CardTitle>
                   </CardHeader>
                   <CardContent className="p-5 space-y-4">
                      {history ? (
                        <div className="space-y-4">
                           <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condiciones Detectadas</p>
                              <div className="flex flex-wrap gap-1.5">
                                 {history.personalHistory.hypertension && <Badge className="bg-red-50 text-red-700 border-red-100 font-black text-[9px] uppercase">Hipertensión</Badge>}
                                 {history.personalHistory.diabetes && <Badge className="bg-amber-50 text-amber-700 border-amber-100 font-black text-[9px] uppercase">Diabetes</Badge>}
                                 {history.personalHistory.asthma && <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-black text-[9px] uppercase">Asma</Badge>}
                                 {!history.personalHistory.hypertension && !history.personalHistory.diabetes && !history.personalHistory.asthma && <span className="text-xs italic text-slate-400">Sin condiciones crónicas</span>}
                              </div>
                           </div>
                           <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alergias</p>
                              <p className="text-xs font-bold text-slate-700 uppercase">{history.personalHistory.allergies || "Ninguna registrada"}</p>
                           </div>
                           <div className="pt-4 border-t border-slate-100">
                             <p className="text-[10px] font-black text-blue-900 uppercase mb-2">Tratamiento de Base</p>
                             <div className="bg-blue-50 p-3 rounded-xl">
                                <p className="text-[10px] text-blue-800 font-bold leading-tight">{history.personalHistory.medicationsNeeded || "No especificado"}</p>
                                <p className="text-[9px] text-blue-600 italic mt-1">{history.personalHistory.medicationFrequency}</p>
                             </div>
                           </div>
                        </div>
                      ) : (
                        <p className="text-xs italic text-slate-400 text-center py-4">Ficha médica incompleta</p>
                      )}
                      <div className="pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            onClick={exportToPDF}
                            className="bg-blue-900 hover:bg-blue-950 text-white font-black h-10 uppercase text-[9px] tracking-wider rounded-xl flex items-center justify-center gap-1.5"
                          >
                             <Download className="w-3.5 h-3.5" /> Ficha PDF
                          </Button>
                          <Button 
                            onClick={exportToExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 uppercase text-[9px] tracking-wider rounded-xl flex items-center justify-center gap-1.5"
                          >
                             <Download className="w-3.5 h-3.5" /> Ficha Excel
                          </Button>
                        </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </div>

        </TabsContent>

        <TabsContent value="history" className="mt-6">
           {history ? (
             <div className="space-y-4">
               <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-sm">
                 <div className="space-y-1">
                   <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Gestión del Expediente Clínico</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase text-left">Actualice o anexe más información médica y triage de jornada para este ciudadano</p>
                 </div>
                 <div className="flex gap-2.5">
                   <Button 
                     onClick={() => {
                       setHistoryDialogMode(true);
                       setIsHistoryDialogOpen(true);
                     }}
                     className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-9 text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                   >
                     <Activity className="w-3.5 h-3.5" /> Antecedentes + Examen Físico
                   </Button>
                   <Button 
                     onClick={() => {
                       setHistoryDialogMode(false);
                       setIsHistoryDialogOpen(true);
                     }}
                     className="bg-blue-900 hover:bg-blue-950 text-white font-black h-9 text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                   >
                     <History className="w-3.5 h-3.5" /> Solo Antecedentes
                   </Button>
                 </div>
               </div>
               <MedicalHistoryDetail history={history} recipes={recipes} evaluations={evaluations} />
             </div>
           ) : (
             <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto my-4">
               <AlertCircle className="w-12 h-12 text-slate-350 mx-auto mb-4 animate-bounce" />
               <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">No se ha registrado una historia médica base</h4>
               <p className="text-slate-500 font-bold text-xs mt-1.5 max-w-md mx-auto leading-relaxed">
                 Para habilitar la ficha de antecedentes y el reporte de triage de jornadas, debe registrar la información médica del ciudadano. Puede elegir uno de los siguientes métodos de registro:
               </p>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-lg mx-auto">
                 <button
                   type="button"
                   onClick={() => {
                     setHistoryDialogMode(true);
                     setIsHistoryDialogOpen(true);
                   }}
                   className="flex items-start gap-4 p-4 rounded-xl border border-emerald-250 bg-[#f4fbf7]/80 hover:bg-[#ebfaf1] text-left transition-all hover:border-emerald-400 shadow-sm cursor-pointer group"
                 >
                   <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-750 shrink-0 group-hover:scale-105 transition-transform duration-250">
                     <Activity className="w-5 h-5 animate-pulse" />
                   </div>
                   <div className="leading-tight">
                     <span className="block font-black text-xs text-slate-900 uppercase tracking-tight">1. Antecedentes + Examen</span>
                     <span className="block text-[9.5px] text-emerald-800 font-bold mt-1 uppercase">Carga dual/Triage</span>
                     <span className="block text-[10px] text-slate-500 font-semibold mt-1">Registra patologías crónicas, alergias y también signos vitales junto con su diagnóstico clínico</span>
                   </div>
                 </button>

                 <button
                   type="button"
                   onClick={() => {
                     setHistoryDialogMode(false);
                     setIsHistoryDialogOpen(true);
                   }}
                   className="flex items-start gap-4 p-4 rounded-xl border border-blue-200 bg-blue-50/20 hover:bg-blue-50/50 text-left transition-all hover:border-blue-300 shadow-sm cursor-pointer group"
                 >
                   <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 shrink-0 group-hover:scale-105 transition-transform duration-250">
                     <History className="w-5 h-5" />
                   </div>
                   <div className="leading-tight">
                     <span className="block font-black text-xs text-slate-900 uppercase tracking-tight">2. Solo Antecedentes</span>
                     <span className="block text-[9.5px] text-blue-800 font-bold mt-1 uppercase">Ficha Clínica Base</span>
                     <span className="block text-[10px] text-slate-500 font-semibold mt-1">Carga patologías del ciudadano, medicamentos permanentes y requirimiento de ayudas humanas</span>
                   </div>
                 </button>
               </div>
             </div>
           )}
        </TabsContent>

        <TabsContent value="medications" className="mt-6 space-y-4">
           <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest px-2 underline decoration-blue-500 decoration-2 underline-offset-4">Control de Suministros</h3>
              <Button 
                onClick={() => setIsRecipeDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 uppercase text-[10px] tracking-widest rounded-xl"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-2" /> Registrar Suministro
              </Button>
           </div>
           <Card className="border-slate-200 overflow-hidden shadow-sm">
             <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-sm font-black text-blue-900 uppercase">Medicamentos Entregados al Ciudadano</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                   <TableHeader>
                      <TableRow className="bg-slate-50/30">
                        <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500">Insumo</TableHead>
                        <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500">Cantidad</TableHead>
                        <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500">Fecha y Estado</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                     {recipes.map(recipe => (
                        <TableRow key={recipe.id} className="hover:bg-slate-50/50">
                           <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {recipe.socialAidType === 'economic_aid' || (recipe.economicAmount !== undefined && Number(recipe.economicAmount) > 0) ? (
                                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-black text-[9px] uppercase px-1.5 py-0.5">
                                    💵 Aporte ({recipe.economicCurrency === 'VES' ? 'Bs.' : '$'})
                                  </Badge>
                                ) : recipe.socialAidType === 'food_bag' || (recipe.foodBagsCount !== undefined && Number(recipe.foodBagsCount) > 0) ? (
                                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-black text-[9px] uppercase px-1.5 py-0.5">
                                    🥫 Bolsa de Comida
                                  </Badge>
                                ) : null}
                                <p className="font-bold text-slate-800 uppercase text-xs">{recipe.medication}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 font-semibold">{recipe.presentation}</p>
                           </TableCell>
                           <TableCell className="px-6 py-4">
                              <Badge className="bg-blue-100 text-blue-700 font-black border-none uppercase text-[9px]">
                                {recipe.socialAidType === 'economic_aid' || (recipe.economicAmount !== undefined && Number(recipe.economicAmount) > 0)
                                  ? (recipe.economicCurrency === 'VES' ? `Bs. ${Number(recipe.economicAmount).toLocaleString('es-VE')}` : `$ ${Number(recipe.economicAmount).toLocaleString('es-VE')}`)
                                  : recipe.socialAidType === 'food_bag'
                                  ? `${recipe.foodBagsCount || recipe.quantity} Bolsa(s)`
                                  : `${recipe.quantity} Unid.`}
                              </Badge>
                           </TableCell>
                           <TableCell className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-tight">
                              <div className="flex flex-col gap-1">
                                 <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                                    {recipe.createdAt?.toDate ? format(recipe.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'Hoy'}
                                 </span>
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                   <Badge className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full w-fit inline-block ${
                                     recipe.status === 'delivered' 
                                       ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                                       : 'bg-amber-50 text-amber-730 border border-amber-250'
                                   }`}>
                                     {recipe.status === 'delivered' ? 'Entregado' : 'Pendiente / Solicitado'}
                                   </Badge>
                                   {recipe.isUrgent && (
                                     <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md" title={recipe.urgencyReason}>
                                       Salto de Urgencia
                                     </Badge>
                                   )}
                                 </div>
                                 {recipe.isUrgent && recipe.urgencyReason && (
                                   <span className="text-[9px] text-rose-600 font-medium italic lowercase line-clamp-1">
                                     Motivo: {recipe.urgencyReason}
                                   </span>
                                 )}
                               </div>
                           </TableCell>
                        </TableRow>
                     ))}
                     {recipes.length === 0 && (
                        <TableRow>
                           <TableCell colSpan={3} className="text-center py-20 text-slate-400 italic text-xs uppercase font-bold">Sin registros de farmacia.</TableCell>
                        </TableRow>
                     )}
                   </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="w-[96vw] sm:w-[92vw] max-w-[96vw] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[93dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 pr-12 bg-slate-50 border-b border-slate-200">
            <DialogTitle className="uppercase font-black text-blue-900 tracking-tight text-base sm:text-xl text-left">Registrar Entrega de Fármacos</DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-8 lg:p-10">
            <RecipeForm 
              workerId={worker.id} 
              workerName={worker.fullName} 
              commune={worker.commune}
              hasDisability={worker.hasDisability}
              workers={[worker]}
              existingRecipes={recipes}
              onSuccess={() => {
                setIsRecipeDialogOpen(false);
                fetchWorkerData();
              }} 
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="w-[96vw] sm:w-[92vw] max-w-[96vw] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[93dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 pr-12 bg-slate-50 border-b border-slate-200">
            <DialogTitle className="uppercase font-black text-blue-900 tracking-tight text-base sm:text-xl text-left">
              {history ? "Actualizar Expediente Médico" : "Registrar Expediente Médico"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-8 lg:p-10">
            <MedicalHistoryForm 
              workerId={worker.id} 
              defaultIncludePhysicalExam={historyDialogMode}
              onSuccess={() => {
                setIsHistoryDialogOpen(false);
                fetchWorkerData();
              }} 
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRecipeForView} onOpenChange={(open) => { if (!open) setSelectedRecipeForView(null); }}>
        <DialogContent className="w-[95vw] sm:w-[90vw] max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 pr-12 bg-slate-50 border-b border-slate-200">
            <DialogTitle className="uppercase font-black text-blue-900 text-sm sm:text-lg flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-blue-600 shrink-0" />
              Soporte Digital de Solicitud de Paciente
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6 space-y-4">
            {selectedRecipeForView && (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs border border-slate-100 bg-slate-50/50 p-4 rounded-xl">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 font-sans">Paciente</p>
                    <p className="font-bold text-slate-800 uppercase mt-0.5">{worker.fullName}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 font-sans">Cédula de Identidad</p>
                    <p className="font-bold text-slate-800 uppercase mt-0.5">{worker.dni}</p>
                  </div>
                  <div className="col-span-2 border-t border-slate-100 pt-2 mt-1">
                    <p className="text-[9px] uppercase font-bold text-slate-400 font-sans">Detalle del Requerimiento</p>
                    <p className="font-bold text-blue-900 mt-0.5 uppercase">
                      {(selectedRecipeForView.requiresTechnicalAid || selectedRecipeForView.category === 'technical_aid')
                        ? `${selectedRecipeForView.technicalAidType || selectedRecipeForView.medication || "Ayuda Humana"}` 
                        : `${selectedRecipeForView.medication} - ${selectedRecipeForView.presentation}`}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 font-sans">
                      Cantidad: {(selectedRecipeForView.requiresTechnicalAid || selectedRecipeForView.category === 'technical_aid') ? (selectedRecipeForView.technicalAidQuantity || selectedRecipeForView.quantity) : selectedRecipeForView.quantity} unidades
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-3 sm:p-4 border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
                  {selectedRecipeForView.recipeFileUrl?.startsWith("data:image/") ? (
                    <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-100 p-1 bg-slate-50">
                      <img 
                        src={selectedRecipeForView.recipeFileUrl} 
                        alt="Soporte Médico Digitalizado" 
                        referrerPolicy="no-referrer"
                        className="max-w-full h-auto object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="py-12 w-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
                      <FileText className="w-16 h-16 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600 mt-3 uppercase tracking-wider">Documento PDF Incorporado</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest break-all px-4 text-center">{selectedRecipeForView.recipeFileName || "documento.pdf"}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-150">
                  {selectedRecipeForView.recipeFileUrl && (
                    <Button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = selectedRecipeForView.recipeFileUrl!;
                        link.download = selectedRecipeForView.recipeFileName || "recipe_soporte";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] h-10 px-5 rounded-xl flex items-center gap-1.5"
                    >
                      Descargar Archivo
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRecipeForView(null)}
                    className="border-slate-200 uppercase font-black tracking-widest text-[9px] h-10 px-5 rounded-xl"
                  >
                    Cerrar Vista
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
  );
}
