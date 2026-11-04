import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardCheck, 
  FileText, 
  Activity, 
  Calendar,
  Stethoscope,
  HeartPulse
} from "lucide-react";
import { Evaluation, Worker } from "@/types";
import { dataService } from '@/lib/dataService';
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateSafe } from "@/utils/dateUtils";

interface EvaluationListProps {
  evaluations: Evaluation[];
}

export default function EvaluationList({ evaluations: propsEvaluations }: { evaluations?: Evaluation[] }) {
  const [evaluations, setEvaluations] = React.useState<Evaluation[]>(propsEvaluations || []);
  const [loading, setLoading] = React.useState(!propsEvaluations);
  const [workersMap, setWorkersMap] = React.useState<Record<string, Worker>>({});

  React.useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const workers = await dataService.getWorkers();
        const map: Record<string, Worker> = {};
        workers.forEach(w => { map[w.id] = w; });
        setWorkersMap(map);

        if (!propsEvaluations) {
          const allEvals = await dataService.getAllEvaluations(150);
          setEvaluations(allEvals);
        } else {
          setEvaluations(propsEvaluations);
        }
      } catch (err) {
        console.error("Error loading evaluations", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [propsEvaluations]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const getDeterminationBadge = (det: string) => {
    switch (det) {
      case 'fit':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-3 font-black text-[9px] uppercase tracking-widest">APTO</Badge>;
      case 'fit-with-restrictions':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-3 font-black text-[9px] uppercase tracking-widest">APTO C/R</Badge>;
      case 'unfit':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-3 font-black text-[9px] uppercase tracking-widest">NO APTO</Badge>;
      default:
        return <Badge variant="secondary">---</Badge>;
    }
  };

  const getEvaluationType = (type: string) => {
    const types: Record<string, string> = {
      'pre-employment': 'Pre-Empleo',
      'entry': 'Ingreso',
      'periodic': 'Periódico',
      'exit': 'Egreso',
      'special': 'Especial'
    };
    return types[type] || type;
  };

  const exportEvaluationPdf = (evaluation: Evaluation) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const worker = workersMap[evaluation.workerId];

    // Official Banner
    doc.setFillColor(30, 58, 138); // Blue 900
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ALCALDÍA MUNICIPIO JUAN ANTONIO SOTILLO", pageWidth / 2, 12, { align: "center" });
    doc.setFontSize(10);
    doc.text("DIRECCIÓN DE BIENESTAR SOCIAL • CONSTANCIA DE EVALUACIÓN CLÍNICA", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("SISTEMA MUNICIPAL DE ATENCIÓN Y CENSO EN SALUD", pageWidth / 2, 27, { align: "center" });

    // Date & Citizen info
    const evalDate = formatDateSafe(evaluation.createdAt, 'dd/MM/yyyy', 'S/D');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`FECHA DE EVALUACIÓN: ${evalDate}`, 14, 42);
    doc.text(`TIPO DE PROTOCOLO: ${getEvaluationType(evaluation.type).toUpperCase()}`, 120, 42);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 47, pageWidth - 28, 22, 2, 2, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 47, pageWidth - 28, 22, 2, 2, "S");

    doc.setFontSize(8.5);
    doc.text(`PACIENTE: ${(worker?.fullName || "CIUDADANO REGISTRADO").toUpperCase()}`, 18, 54);
    doc.setFont("helvetica", "normal");
    doc.text(`CÉDULA: ${worker?.dni || "NO REGISTRA"}`, 18, 62);
    doc.text(`COMUNA: ${worker?.commune || "SOTILLO"}`, 90, 62);
    doc.text(`TELÉFONO: ${worker?.phone || "NO REGISTRA"}`, 150, 62);

    // Vital Signs Table
    const physical = evaluation.physical || {
      bloodPressure: '---',
      heartRate: 0,
      temperature: 0,
      weight: 0,
      height: 0,
      bmi: 0,
      oxygenSaturation: 0
    };

    const vitalsData = [
      ["Presión Arterial", `${physical.bloodPressure || 'N/R'} mmHg`, "Frecuencia Cardíaca", `${physical.heartRate || 0} lpm`],
      ["Temperatura Corporal", `${physical.temperature || 0} °C`, "Saturación Oxígeno", `${physical.oxygenSaturation || 0}% SpO2`],
      ["Peso Corporal", `${physical.weight || 0} kg`, "Estatura / Talla", `${physical.height || 0} m`],
      ["Índice Masa Corporal (IMC)", `${(physical.bmi || 0).toFixed(1)} kg/m²`, "Evaluador Oficial", evaluation.evaluatorId || "Médico Sotillo"]
    ];

    autoTable(doc, {
      startY: 75,
      head: [["Signo Vital", "Registro", "Parámetro Físico / Evaluador", "Registro"]],
      body: vitalsData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 }
    });

    // Clinical Findings & Diagnostics
    const finalY = (doc as any).lastAutoTable?.finalY || 125;

    const clinicalData = [
      ["Diagnóstico Clínico Principal", evaluation.diagnosis || "SIN DIAGNÓSTICO ESPECIFICADO"],
      ["Determinación de Apoyo", evaluation.determination ? evaluation.determination.toUpperCase() : "ATENCIÓN GENERAL"],
      ["Recomendaciones Médicas", evaluation.recommendations || "SIN RECOMENDACIONES REGISTRADAS"],
      ["Medicamentos Requeridos", evaluation.medicationsNeeded ? `${evaluation.medicationsNeeded}${evaluation.medicationFrequency ? ` (Frecuencia: ${evaluation.medicationFrequency})` : ''}` : "NO REQUIERE / NO REGISTRADO"],
      ["Resultados de Laboratorio", evaluation.labs?.results || "NINGUNO ADJUNTO"]
    ];

    autoTable(doc, {
      startY: finalY + 8,
      head: [["Concepto Clínico", "Detalle de la Valoración"]],
      body: clinicalData,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } }
    });

    // Institutional Signatures
    const signY = 240;
    doc.setDrawColor(148, 163, 184);
    doc.line(25, signY, 85, signY);
    doc.line(125, signY, 185, signY);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("MÉDICO / EVALUADOR TRATANTE", 55, signY + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Firma y Sello Oficial", 55, signY + 9, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text("DIRECCIÓN DE BIENESTAR SOCIAL", 155, signY + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Alcaldía Municipio Sotillo", 155, signY + 9, { align: "center" });

    doc.save(`Evaluacion_${(worker?.fullName || "Paciente").replace(/\s+/g, '_')}_${evalDate.replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {!propsEvaluations && (
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black text-blue-950 tracking-tight uppercase">Histórico de Evaluaciones</h2>
          <p className="text-slate-500 font-medium tracking-tight">Alcaldía Municipio Juan Antonio Sotillo</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="bg-white border-slate-200">
           <CardContent className="p-4 flex items-center gap-4">
             <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
               <ClipboardCheck className="w-5 h-5" />
             </div>
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Totales</p>
               <h4 className="text-xl font-black text-slate-800">{evaluations.length}</h4>
             </div>
           </CardContent>
         </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
           <CardTitle className="text-sm font-black text-blue-900 uppercase tracking-widest">Histórico de Evaluaciones Físicas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/20 border-b border-slate-100">
                  <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fecha</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Protocolo / Tipo</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Constantes Vitales</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Determinación</TableHead>
                  <TableHead className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Informe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((e) => (
                  <TableRow key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-6 py-4">
                       <div className="flex items-center gap-2 text-slate-600">
                         <Calendar className="w-3.5 h-3.5" />
                         <span className="text-xs font-bold">{formatDateSafe(e.createdAt, 'dd/MM/yyyy', '---')}</span>
                       </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{getEvaluationType(e.type)}</span>
                         <span className="text-[10px] text-slate-400 font-medium italic">Protocolo Sotillo-H1</span>
                       </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                             <HeartPulse className="w-3 h-3 text-red-400" />
                             <span className="text-[10px] font-bold text-slate-600">{e.physical.bloodPressure} mmHg / {e.physical.heartRate} lpm</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="w-3 h-3 text-blue-400" />
                            <span className="text-[10px] font-bold text-slate-600">IMC {e.physical.bmi.toFixed(1)} / {e.physical.oxygenSaturation}% O2</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {getDeterminationBadge(e.determination)}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Button 
                        onClick={() => exportEvaluationPdf(e)}
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-blue-600 font-bold hover:bg-blue-50 border border-blue-100 hover:border-blue-300 px-2 rounded-lg cursor-pointer"
                        title="Descargar Boleta de Evaluación Médica en PDF"
                      >
                        <FileText className="w-3 h-3 mr-1.5" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {evaluations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic text-xs uppercase font-bold">
                       No se registran evaluaciones clínicas previas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
