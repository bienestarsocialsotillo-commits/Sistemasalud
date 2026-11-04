import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  Users, 
  PhoneCall, 
  PhoneOff, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronRight, 
  ChevronLeft, 
  SkipForward, 
  RotateCcw, 
  Building2, 
  Search, 
  X, 
  FileText, 
  Layers, 
  HeartHandshake, 
  Pill, 
  Package, 
  Accessibility, 
  ShieldCheck, 
  Smartphone, 
  User, 
  MapPin, 
  AlertCircle,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Worker, MedicationRecipe } from '@/types';
import { dataService } from '@/lib/dataService';
import { 
  formatVenezuelanPhoneForWhatsApp, 
  OFFICIAL_WHATSAPP_TEMPLATES, 
  interpolateWhatsAppMessage, 
  buildWhatsAppLink,
  WhatsAppTemplate
} from '@/utils/whatsappUtils';
import { getRecipeCategory } from '@/utils/categoryUtils';
import { toast } from 'sonner';

interface WhatsAppBroadcastProps {
  workers?: Worker[];
  recipes?: MedicationRecipe[];
  initialItemFilter?: string;
  onClose?: () => void;
}

export default function WhatsAppBroadcast({
  workers: propWorkers,
  recipes: propRecipes,
  initialItemFilter = "",
  onClose
}: WhatsAppBroadcastProps) {
  // Estado de datos
  const [workers, setWorkers] = useState<Worker[]>(propWorkers || []);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>(propRecipes || []);
  const [loading, setLoading] = useState<boolean>(!propWorkers);

  // Filtros de segmentación
  const [audienceScope, setAudienceScope] = useState<'beneficiaries_only' | 'all_census'>('beneficiaries_only');
  const [selectedItemQuery, setSelectedItemQuery] = useState<string>(initialItemFilter);
  const [communeFilter, setCommuneFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent'>('all');
  const [onlyValidPhones, setOnlyValidPhones] = useState<boolean>(true);
  const [searchTable, setSearchTable] = useState<string>('');

  // Plantillas y redacción de mensaje
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('notificacion_unificada_marcano');
  const [messageTemplateText, setMessageTemplateText] = useState<string>(
    OFFICIAL_WHATSAPP_TEMPLATES[0].content
  );
  const [copiedPreview, setCopiedPreview] = useState<boolean>(false);

  // Estado del lanzador en cadena semi-automático
  const [activeQueueIndex, setActiveQueueIndex] = useState<number>(0);
  const [isChainActive, setIsChainActive] = useState<boolean>(false);
  const [autoAdvanceDelay, setAutoAdvanceDelay] = useState<number>(2); // segundos de cortesía
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(2);

  // Registro local y en memoria de envíos recientes (para reflejo inmediato en UI)
  const [localContactedMap, setLocalContactedMap] = useState<Record<string, { timestamp: string; dateStr: string }>>(() => {
    try {
      const saved = localStorage.getItem('sotillo_whatsapp_sent_records');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Carga inicial de datos si no vinieron por props
  useEffect(() => {
    if (!propWorkers || !propRecipes) {
      const loadData = async () => {
        setLoading(true);
        try {
          const [loadedWorkers, loadedRecipes] = await Promise.all([
            dataService.getWorkers(),
            dataService.getMedicationRecipes()
          ]);
          setWorkers(loadedWorkers);
          setRecipes(loadedRecipes);
        } catch (error) {
          console.error("Error al cargar datos para difusión:", error);
          toast.error("No se pudieron cargar los datos de beneficiarios");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [propWorkers, propRecipes]);

  // Actualizar plantilla si cambia el selector
  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const found = OFFICIAL_WHATSAPP_TEMPLATES.find(t => t.id === tplId);
    if (found) {
      setMessageTemplateText(found.content);
    }
  };

  // Insertar variable en el cursor de la plantilla
  const handleInsertVariable = (variableTag: string) => {
    setMessageTemplateText(prev => prev + " " + variableTag);
  };

  // Mapear el beneficio principal recibido por cada ciudadano
  const workerBenefitMap = useMemo(() => {
    const map = new Map<string, {
      benefitName: string;
      quantity: number;
      dateStr: string;
      rawDate: any;
      category: string;
      representative?: string;
    }>();

    // Priorizar recetas entregadas (más recientes)
    const sortedRecipes = [...recipes].sort((a, b) => {
      const tA = a.deliveredAt?.seconds ? a.deliveredAt.seconds * 1000 : new Date(a.deliveredAt || a.createdAt || 0).getTime();
      const tB = b.deliveredAt?.seconds ? b.deliveredAt.seconds * 1000 : new Date(b.deliveredAt || b.createdAt || 0).getTime();
      return tB - tA;
    });

    sortedRecipes.forEach(r => {
      if (!map.has(r.workerId)) {
        let benefitName = "Ayuda Social";
        let qty = Number(r.quantity) || 1;
        const cat = getRecipeCategory(r);

        if (cat === 'technical_aid') {
          benefitName = (r.customTechnicalAid || r.technicalAidType || "Ayuda Humana / Técnica").trim();
          qty = Number(r.technicalAidQuantity) || qty;
        } else if (cat === 'medical_supply') {
          if (r.socialAidType === 'food_bag' || (Number(r.foodBagsCount) || 0) > 0) {
            benefitName = "Bolsa de Alimentación / Combo CLAP";
            qty = Number(r.foodBagsCount) || 1;
          } else if (r.socialAidType === 'economic_aid' || (Number(r.economicAmount) || 0) > 0) {
            benefitName = `Aporte Económico (${r.economicConcept || 'Ayuda Directa'})`;
            qty = 1;
          } else {
            benefitName = (r.supplyName || "Insumo Médico").trim();
          }
        } else if (cat === 'medical_derivation') {
          benefitName = (r.derivationService || r.medication || "Derivación Médica").trim();
          qty = 1;
        } else {
          benefitName = (r.medication || "Tratamiento Médico").trim();
        }

        const dateVal = r.deliveredAt || r.createdAt;
        let dateFormatted = "Reciente";
        try {
          if (dateVal) {
            const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
            if (!isNaN(d.getTime())) {
              dateFormatted = format(d, "dd/MM/yyyy", { locale: es });
            }
          }
        } catch {
          dateFormatted = "Reciente";
        }

        const rep = r.isDeliveredToRepresentative && r.representativeFullName
          ? `${r.representativeFullName} (${r.representativeRelationship || 'Familiar'})`
          : undefined;

        map.set(r.workerId, {
          benefitName,
          quantity: qty,
          dateStr: dateFormatted,
          rawDate: dateVal,
          category: cat,
          representative: rep
        });
      }
    });

    return map;
  }, [recipes]);

  // Lista de comunas disponibles
  const availableCommunes = useMemo(() => {
    const set = new Set<string>();
    workers.forEach(w => {
      if (w.commune && w.commune !== "NO ESPECIFICADA") {
        set.add(w.commune);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [workers]);

  // Población procesada y filtrada para la campaña de WhatsApp
  const targetBeneficiaries = useMemo(() => {
    const term = selectedItemQuery.toLowerCase().trim();

    return workers.filter(w => {
      const benefitInfo = workerBenefitMap.get(w.id);

      // A) Filtro de Alcance de Audiencia
      if (audienceScope === 'beneficiaries_only' && !benefitInfo) {
        return false;
      }

      // B) Filtro por Ítem o Beneficio específico
      if (term) {
        if (!benefitInfo) return false;
        const matchesName = benefitInfo.benefitName.toLowerCase().includes(term);
        if (!matchesName) return false;
      }

      // C) Filtro de Comuna
      if (communeFilter !== 'ALL' && w.commune !== communeFilter) {
        return false;
      }

      // D) Validación de Teléfono Celular
      const phoneValidation = formatVenezuelanPhoneForWhatsApp(w.phone);
      if (onlyValidPhones && !phoneValidation.isValid) {
        // Si el titular no tiene teléfono pero tiene apoderado con teléfono válido, lo aceptamos
        const repPhoneVal = formatVenezuelanPhoneForWhatsApp(w.defaultRepresentative?.phone);
        if (!repPhoneVal.isValid) {
          return false;
        }
      }

      // E) Filtro de Estado de Contacto (Ya enviado vs Pendiente)
      const isContacted = Boolean(w.lastWhatsappSentAt || localContactedMap[w.id]);
      if (statusFilter === 'pending' && isContacted) {
        return false;
      }
      if (statusFilter === 'sent' && !isContacted) {
        return false;
      }

      return true;
    });
  }, [workers, workerBenefitMap, audienceScope, selectedItemQuery, communeFilter, onlyValidPhones, statusFilter, localContactedMap]);

  // Conteo de métricas de la audiencia
  const metrics = useMemo(() => {
    let validCount = 0;
    let invalidCount = 0;
    let contactedCount = 0;

    targetBeneficiaries.forEach(w => {
      const pVal = formatVenezuelanPhoneForWhatsApp(w.phone);
      if (pVal.isValid) {
        validCount++;
      } else {
        const repVal = formatVenezuelanPhoneForWhatsApp(w.defaultRepresentative?.phone);
        if (repVal.isValid) validCount++;
        else invalidCount++;
      }

      if (w.lastWhatsappSentAt || localContactedMap[w.id]) {
        contactedCount++;
      }
    });

    return {
      total: targetBeneficiaries.length,
      valid: validCount,
      invalid: invalidCount,
      contacted: contactedCount,
      pending: targetBeneficiaries.length - contactedCount,
      progressPercentage: targetBeneficiaries.length > 0 
        ? Math.round((contactedCount / targetBeneficiaries.length) * 100) 
        : 0
    };
  }, [targetBeneficiaries, localContactedMap]);

  // Beneficiario actualmente enfocado en la cola de envío
  const currentBeneficiary = useMemo(() => {
    if (targetBeneficiaries.length === 0) return null;
    const safeIndex = Math.min(Math.max(activeQueueIndex, 0), targetBeneficiaries.length - 1);
    return targetBeneficiaries[safeIndex] || null;
  }, [targetBeneficiaries, activeQueueIndex]);

  // Asegurar índice seguro si cambia la lista
  useEffect(() => {
    if (activeQueueIndex >= targetBeneficiaries.length && targetBeneficiaries.length > 0) {
      setActiveQueueIndex(targetBeneficiaries.length - 1);
    }
  }, [targetBeneficiaries.length, activeQueueIndex]);

  // Generar mensaje personalizado para el beneficiario en foco
  const activeMessageText = useMemo(() => {
    if (!currentBeneficiary) return "";
    const benefitInfo = workerBenefitMap.get(currentBeneficiary.id);

    return interpolateWhatsAppMessage(messageTemplateText, {
      nombre: currentBeneficiary.fullName,
      cedula: currentBeneficiary.dni,
      beneficio: benefitInfo?.benefitName || "Beneficio Social Municipal",
      comuna: currentBeneficiary.commune,
      sector: currentBeneficiary.sector,
      fecha: benefitInfo?.dateStr || "el día asignado",
      representante: benefitInfo?.representative || currentBeneficiary.defaultRepresentative?.fullName || "Representante Autorizado",
      alcalde: "Prof. Jesús Marcano Tábata",
      primeraDama: "Ing. Yohana Estaba de Marcano"
    });
  }, [currentBeneficiary, messageTemplateText, workerBenefitMap]);

  // Teléfono formateado para el beneficiario en foco
  const currentPhoneData = useMemo(() => {
    if (!currentBeneficiary) return null;
    let res = formatVenezuelanPhoneForWhatsApp(currentBeneficiary.phone);
    if (!res.isValid && currentBeneficiary.defaultRepresentative?.phone) {
      res = formatVenezuelanPhoneForWhatsApp(currentBeneficiary.defaultRepresentative.phone);
    }
    return res;
  }, [currentBeneficiary]);

  // Enlace directo wa.me generado para el beneficiario actual
  const currentWhatsAppLink = useMemo(() => {
    if (!currentPhoneData || !currentPhoneData.isValid || !activeMessageText) return "";
    return buildWhatsAppLink(currentPhoneData.internationalPhone, activeMessageText);
  }, [currentPhoneData, activeMessageText]);

  // Acción de Enviar y Avanzar (El corazón del flujo semi-automático)
  const handleSendAndAdvance = async (targetWorker?: Worker) => {
    const workerToContact = targetWorker || currentBeneficiary;
    if (!workerToContact) return;

    const phoneData = formatVenezuelanPhoneForWhatsApp(workerToContact.phone);
    const targetPhone = phoneData.isValid 
      ? phoneData.internationalPhone 
      : formatVenezuelanPhoneForWhatsApp(workerToContact.defaultRepresentative?.phone).internationalPhone;

    if (!targetPhone) {
      toast.error(`No hay un número válido registrado para ${workerToContact.fullName}`);
      return;
    }

    const benefitInfo = workerBenefitMap.get(workerToContact.id);
    const textToSend = interpolateWhatsAppMessage(messageTemplateText, {
      nombre: workerToContact.fullName,
      cedula: workerToContact.dni,
      beneficio: benefitInfo?.benefitName || "Beneficio Social Municipal",
      comuna: workerToContact.commune,
      sector: workerToContact.sector,
      fecha: benefitInfo?.dateStr || "el día asignado",
      representante: benefitInfo?.representative || workerToContact.defaultRepresentative?.fullName,
      alcalde: "Prof. Jesús Marcano Tábata",
      primeraDama: "Ing. Yohana Estaba de Marcano"
    });

    const link = buildWhatsAppLink(targetPhone, textToSend);

    // 1. Abrir WhatsApp Web o App en una pestaña nueva
    window.open(link, '_blank', 'noopener,noreferrer');

    // 2. Registrar inmediatamente en estado local para feedback visual instantáneo
    const nowISO = new Date().toISOString();
    const nowFormatted = format(new Date(), "dd/MM/yyyy HH:mm");
    
    setLocalContactedMap(prev => {
      const updated = {
        ...prev,
        [workerToContact.id]: { timestamp: nowISO, dateStr: nowFormatted }
      };
      try {
        localStorage.setItem('sotillo_whatsapp_sent_records', JSON.stringify(updated));
      } catch (e) {
        console.error("Error saving local sent map:", e);
      }
      return updated;
    });

    // 3. Persistir en Firestore en segundo plano sin congelar la interfaz
    try {
      dataService.updateWorker(workerToContact.id, {
        lastWhatsappSentAt: nowISO,
        lastWhatsappRecipient: targetPhone,
        lastWhatsappTemplate: selectedTemplateId
      });
    } catch (e) {
      console.warn("Could not sync sent status to Firestore:", e);
    }

    toast.success(`WhatsApp preparado para ${workerToContact.fullName}`);

    // 4. Si estamos en modo de cola continua, avanzar al siguiente beneficiario
    if (activeQueueIndex < targetBeneficiaries.length - 1) {
      setActiveQueueIndex(prev => prev + 1);
    } else {
      toast.success("¡Ha llegado al final de la lista de beneficiarios!");
    }
  };

  // Copiar mensaje actual
  const handleCopyCurrentMessage = () => {
    if (!activeMessageText) return;
    navigator.clipboard.writeText(activeMessageText);
    setCopiedPreview(true);
    toast.success("Mensaje copiado al portapapeles");
    setTimeout(() => setCopiedPreview(false), 2500);
  };

  // Sugerencias rápidas de beneficios para filtrar
  const quickFilterItems = ['CANASTILLA', 'SILLA DE RUEDAS', 'LOSARTAN', 'PAÑALES', 'BOLSA CLAP', 'METFORMINA'];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* CABECERA INSTITUCIONAL */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                Centro de Notificaciones y Difusión WhatsApp
              </h2>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider">
                Semi-Automático Asistido
              </Badge>
            </div>
            <p className="text-slate-300 text-xs mt-1 font-medium">
              Alcaldía Bolivariana del Municipio Juan Antonio Sotillo &mdash; Dirección de Bienestar Social
            </p>
          </div>
        </div>

        {onClose && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
          >
            Cerrar Módulo
          </Button>
        )}
      </div>

      {/* TARJETAS DE MÉTRICAS CLAVE (KPIs DE DIFUSIÓN) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Población Objetivo</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{metrics.total.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">Personas en el filtro</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Con WhatsApp (+58)</p>
              <p className="text-2xl font-black text-emerald-950 mt-0.5">{metrics.valid.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-emerald-700 mt-0.5">Celulares contactables</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Mensajes Enviados</p>
              <p className="text-2xl font-black text-indigo-950 mt-0.5">{metrics.contacted.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-indigo-700 mt-0.5">{metrics.progressPercentage}% de cobertura</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Pendientes</p>
              <p className="text-2xl font-black text-amber-950 mt-0.5">{metrics.pending.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-amber-700 mt-0.5">Por contactar</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS OPERATIVOS DE SEGMENTACIÓN */}
      <Card className="border-slate-200 shadow-2xs bg-white">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-900" />
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800">
              Segmentación de Destinatarios
            </CardTitle>
          </div>
          <CardDescription className="text-[10px] uppercase font-bold text-slate-400">
            Filtre por insumo despachado (canastillas, fármacos, sillas), comuna o estatus de contacto
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* Alcance: Beneficiarios vs Todo el Censo */}
            <div className="md:col-span-3">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                Público Objetivo:
              </label>
              <Select value={audienceScope} onValueChange={(val: any) => setAudienceScope(val)}>
                <SelectTrigger className="h-9 text-xs font-bold border-slate-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beneficiaries_only" className="text-xs font-bold">
                    ✓ Solo Beneficiarios con Entregas
                  </SelectItem>
                  <SelectItem value="all_census" className="text-xs font-bold">
                    Todo el Censo Municipal
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buscador de Ítem / Beneficio */}
            <div className="md:col-span-4 relative">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                Filtrar por Beneficio / Ítem:
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="EJ: CANASTILLA, SILLA DE RUEDAS, LOSARTAN..."
                  className="pl-9 pr-7 h-9 text-xs font-bold border-slate-300 uppercase tracking-wide bg-slate-50/50"
                  value={selectedItemQuery}
                  onChange={(e) => setSelectedItemQuery(e.target.value)}
                />
                {selectedItemQuery && (
                  <button
                    type="button"
                    onClick={() => setSelectedItemQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Selector de Comuna */}
            <div className="md:col-span-3">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                Comuna / Territorio:
              </label>
              <Select value={communeFilter} onValueChange={setCommuneFilter}>
                <SelectTrigger className="h-9 text-xs font-bold border-slate-300 bg-white">
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

            {/* Filtro de Estatus de Mensaje */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                Estatus de Contacto:
              </label>
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="h-9 text-xs font-bold border-slate-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                  <SelectItem value="pending" className="text-xs font-bold text-amber-800">Solo Pendientes</SelectItem>
                  <SelectItem value="sent" className="text-xs font-bold text-emerald-800">Ya Enviados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sugerencias de filtros rápidos */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Sugerencias Rápidas:
            </span>
            {quickFilterItems.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedItemQuery(item)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors uppercase tracking-tight ${
                  selectedItemQuery.toUpperCase() === item 
                    ? 'bg-blue-900 text-white border-blue-950' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                {item}
              </button>
            ))}
            {selectedItemQuery && (
              <button
                type="button"
                onClick={() => setSelectedItemQuery("")}
                className="text-[10px] font-bold px-2 py-0.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 ml-auto uppercase"
              >
                Limpiar Filtro
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ÁREA CENTRAL: LANZADOR SEMI-AUTOMÁTICO EN CADENA + EDITOR DE MENSAJE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA (7 cols): EL DISPARADOR SEMI-AUTOMÁTICO EN CADENA */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-indigo-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
                    {metrics.total > 0 ? activeQueueIndex + 1 : 0}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-white">
                      Despachador en Cadena (Paso a Paso)
                    </CardTitle>
                    <CardDescription className="text-indigo-200 text-[10px] font-bold uppercase mt-0.5">
                      Envíe con 1 clic sin guardar contactos y con avance automático
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-xl text-white text-xs font-mono font-bold">
                  <span>{activeQueueIndex + 1}</span>
                  <span className="opacity-50">/</span>
                  <span>{targetBeneficiaries.length}</span>
                </div>
              </div>

              {/* Barra de Progreso Dinámica */}
              <div className="w-full bg-white/15 h-2 rounded-full overflow-hidden mt-3">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${metrics.progressPercentage}%` }}
                />
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-4">
              {currentBeneficiary ? (
                <>
                  {/* Tarjeta del Beneficiario en Turno */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Beneficiario en Turno:</span>
                        <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                          <span>{currentBeneficiary.fullName}</span>
                          <Badge variant="outline" className="text-[9px] font-mono font-bold border-slate-300">
                            C.I. {currentBeneficiary.dni}
                          </Badge>
                        </h3>
                      </div>

                      {/* Estado del Mensaje */}
                      {(currentBeneficiary.lastWhatsappSentAt || localContactedMap[currentBeneficiary.id]) ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-black uppercase tracking-tight flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Contactado {localContactedMap[currentBeneficiary.id]?.dateStr ? `(${localContactedMap[currentBeneficiary.id].dateStr})` : ''}</span>
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-black uppercase tracking-tight flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pendiente de Envío</span>
                        </Badge>
                      )}
                    </div>

                    {/* Detalles Territoriales y del Beneficio */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Territorio y Comunidad:</span>
                        <div className="font-bold text-slate-800 uppercase flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{currentBeneficiary.commune}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 uppercase ml-4.5">
                          Sector: {currentBeneficiary.sector}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Ayuda / Beneficio Asignado:</span>
                        <div className="font-black text-blue-950 uppercase flex items-center gap-1 mt-0.5">
                          <Package className="w-3.5 h-3.5 text-blue-700" />
                          <span>{workerBenefitMap.get(currentBeneficiary.id)?.benefitName || "Beneficio Social Municipal"}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold ml-4.5">
                          Fecha: {workerBenefitMap.get(currentBeneficiary.id)?.dateStr || "Reciente"}
                        </div>
                      </div>
                    </div>

                    {/* Validación del Teléfono */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          currentPhoneData?.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {currentPhoneData?.isValid ? <Smartphone className="w-4 h-4" /> : <PhoneOff className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-xs font-mono font-bold text-slate-900">
                            {currentPhoneData?.displayFormatted}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {currentPhoneData?.isValid 
                              ? `Número internacional verificado (+58)` 
                              : (currentPhoneData?.errorReason || 'No se puede contactar')}
                          </div>
                        </div>
                      </div>

                      {/* Notificación si se envía al Representante */}
                      {!formatVenezuelanPhoneForWhatsApp(currentBeneficiary.phone).isValid && currentBeneficiary.defaultRepresentative?.phone && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-bold uppercase">
                          Vía Apoderado: {currentBeneficiary.defaultRepresentative.fullName}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* BOTÓN GIGANTE PRINCIPAL DE ACCIÓN (DISPARADOR CON AVANCE) */}
                  <div className="space-y-2 pt-1">
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => handleSendAndAdvance()}
                      disabled={!currentPhoneData?.isValid}
                      className="w-full h-13 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-md gap-2.5 cursor-pointer disabled:opacity-50 transition-all hover:scale-[1.005]"
                      title="Abre WhatsApp con el mensaje ya redactado y marca el registro como contactado"
                    >
                      <Send className="w-5 h-5 text-white" />
                      <span>📲 Abrir WhatsApp y Pasar al Siguiente</span>
                    </Button>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveQueueIndex(prev => Math.max(prev - 1, 0))}
                        disabled={activeQueueIndex === 0}
                        className="text-xs font-bold text-slate-700 h-8 px-3 rounded-lg border-slate-300"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                        <span>Anterior</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyCurrentMessage}
                        className="text-xs font-bold text-slate-700 h-8 px-3 rounded-lg hover:bg-slate-100 gap-1"
                        title="Copiar texto al portapapeles"
                      >
                        {copiedPreview ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPreview ? "¡Copiado!" : "Copiar Texto"}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveQueueIndex(prev => Math.min(prev + 1, targetBeneficiaries.length - 1))}
                        disabled={activeQueueIndex >= targetBeneficiaries.length - 1}
                        className="text-xs font-bold text-slate-700 h-8 px-3 rounded-lg border-slate-300"
                      >
                        <span>Saltar / Siguiente</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Users className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    No hay beneficiarios en la cola con los filtros aplicados
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Ajuste los filtros de beneficio, comuna o estatus de contacto para cargar una lista de destinatarios.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA (5 cols): EDITOR DE PLANTILLAS Y VISTA PREVIA SIMULADOR WHATSAPP */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-700" />
                  <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Editor de Plantilla
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[9px] font-black uppercase text-indigo-700 border-indigo-200">
                  Variables Dinámicas
                </Badge>
              </div>

              {/* Selector de Plantilla Predefinida */}
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-8.5 text-xs font-bold border-slate-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICIAL_WHATSAPP_TEMPLATES.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs font-medium">
                      {tpl.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Chips de Variables Dinámicas para Insertar con 1 clic */}
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                  Clic para insertar variable en el texto:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { tag: '{NOMBRE}', label: 'Nombre' },
                    { tag: '{CEDULA}', label: 'Cédula' },
                    { tag: '{BENEFICIO}', label: 'Beneficio' },
                    { tag: '{FECHA}', label: 'Día de Retiro' },
                    { tag: '{COMUNA}', label: 'Comuna' },
                    { tag: '{SECTOR}', label: 'Sector' },
                    { tag: '{REPRESENTANTE}', label: 'Representante' },
                    { tag: '{ALCALDE}', label: 'Alcalde' },
                    { tag: '{PRIMERA_DAMA}', label: '1ra Dama' }
                  ].map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded transition-colors"
                      title={`Inserta la etiqueta ${v.tag}`}
                    >
                      +{v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caja de Texto Editable */}
              <Textarea
                rows={5}
                className="text-xs font-sans leading-relaxed border-slate-300 bg-white resize-y text-slate-800"
                value={messageTemplateText}
                onChange={(e) => setMessageTemplateText(e.target.value)}
              />

              {/* SIMULADOR VISUAL DE WHATSAPP (MÓVIL) */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Vista Previa en Celular del Ciudadano:</span>
                  <span className="text-[9px] text-emerald-700 font-bold">Simulación en vivo</span>
                </span>

                {/* Burbuja simulada estilo WhatsApp */}
                <div className="bg-[#e5ddd5] p-3 rounded-xl border border-slate-300 relative shadow-inner overflow-hidden max-h-56 overflow-y-auto">
                  <div className="bg-white rounded-lg p-3 shadow-xs border border-slate-200/80 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-w-[95%]">
                    {activeMessageText || "Seleccione o cargue un beneficiario para ver la vista previa del mensaje."}
                    <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-slate-400 font-mono">
                      <span>{format(new Date(), "HH:mm")}</span>
                      <span className="text-blue-500 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* TABLA NOMINAL DETALLADA DE LA AUDIENCIA (PADRÓN DE CONTACTOS) */}
      <Card className="border-slate-200 bg-white shadow-2xs overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
              <span>Listado Nominal de Destinatarios</span>
              <Badge variant="secondary" className="text-[10px] font-black bg-blue-100 text-blue-900">
                {targetBeneficiaries.length} Destinatarios
              </Badge>
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-400 font-medium mt-0.5">
              Haga clic en cualquier fila para enfocarla en el lanzador o envíe individualmente
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="BUSCAR POR NOMBRE, CÉDULA..."
              className="pl-8 pr-7 h-8 text-[11px] font-bold border-slate-300 uppercase tracking-wide bg-white"
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
            />
            {searchTable && (
              <button
                type="button"
                onClick={() => setSearchTable("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">N°</th>
                  <th className="py-2.5 px-3">Beneficiario / Paciente</th>
                  <th className="py-2.5 px-3 w-28">Cédula</th>
                  <th className="py-2.5 px-3 w-36">Teléfono WhatsApp</th>
                  <th className="py-2.5 px-3">Comuna / Sector</th>
                  <th className="py-2.5 px-3">Beneficio Asignado</th>
                  <th className="py-2.5 px-3 text-center">Estatus</th>
                  <th className="py-2.5 px-3 text-center w-28">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {targetBeneficiaries
                  .filter(w => {
                    if (!searchTable.trim()) return true;
                    const s = searchTable.toLowerCase().trim();
                    return w.fullName.toLowerCase().includes(s) || w.dni.toLowerCase().includes(s) || w.commune.toLowerCase().includes(s);
                  })
                  .map((w, idx) => {
                    const phoneData = formatVenezuelanPhoneForWhatsApp(w.phone);
                    const benefit = workerBenefitMap.get(w.id);
                    const isContacted = Boolean(w.lastWhatsappSentAt || localContactedMap[w.id]);
                    const isCurrent = currentBeneficiary?.id === w.id;

                    return (
                      <tr
                        key={w.id}
                        className={`transition-colors cursor-pointer ${
                          isCurrent 
                            ? 'bg-indigo-50/80 font-bold' 
                            : 'hover:bg-slate-50/80'
                        }`}
                        onClick={() => setActiveQueueIndex(idx)}
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 uppercase">
                          <div className="flex items-center gap-1.5">
                            <span>{w.fullName}</span>
                            {isCurrent && (
                              <Badge className="bg-indigo-600 text-white text-[8px] font-black uppercase px-1 py-0">
                                En Turno
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap text-[11px]">
                          {w.dni}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {phoneData.isValid ? (
                            <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                              {phoneData.displayFormatted}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">
                              {phoneData.errorReason || 'Sin número'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          <div className="font-bold text-slate-800 uppercase line-clamp-1">{w.commune}</div>
                          <div className="text-[10px] text-slate-500 uppercase line-clamp-1">{w.sector}</div>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          <div className="font-black text-blue-950 uppercase line-clamp-1">
                            {benefit?.benefitName || "Beneficio Social"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {benefit?.dateStr || "Reciente"}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isContacted ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] font-bold uppercase">
                              ✓ Enviado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-800 border-amber-300 text-[9px] font-bold uppercase">
                              Pendiente
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSendAndAdvance(w)}
                            disabled={!phoneData.isValid && !w.defaultRepresentative?.phone}
                            className="h-7 px-2.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1 disabled:opacity-40"
                            title="Abrir WhatsApp para este ciudadano"
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
