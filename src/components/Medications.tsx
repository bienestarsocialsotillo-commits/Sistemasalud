import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Pill, 
  Search, 
  PlusCircle, 
  TrendingUp, 
  AlertCircle, 
  ShoppingCart, 
  Loader2,
  Package,
  Activity,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  AlertTriangle,
  User,
  Users,
  MapPin,
  FileText,
  Building2,
  Download,
  Stethoscope,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  X,
  XCircle,
  FileSpreadsheet,
  Filter,
  Printer,
  Accessibility,
  PackageSearch
} from "lucide-react";
import ItemBeneficiariesReportModal from "./ItemBeneficiariesReportModal";
import { normalizeItemKey, cleanItemDisplayName } from "@/constants";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dataService } from "@/lib/dataService";
import { MedicationRecipe, Worker, MedicalHistory } from "@/types";
import { useAuth } from "../contexts/AuthContext";
import RecipeForm from "./RecipeForm";
import ErrorBoundary from "./ErrorBoundary";
import HealthMatrixModal from "./HealthMatrixModal";
import { generateDerivationPdf } from "@/utils/derivationPdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateSafe } from "@/utils/dateUtils";
import { 
  CheckCircle, 
  Clock, 
  Trash2, 
  Paperclip, 
  Eye, 
  UserX, 
  CheckCircle2, 
  Pencil, 
  RotateCcw,
  MessageCircle,
  Calendar,
  HeartPulse,
  Send,
  Timer
} from "lucide-react";
import { toast } from "sonner";
import DeliveriesBook from "./DeliveriesBook";
import DeliveryAnalyticsPanel from "./DeliveryAnalyticsPanel";
import NoRequirementsModal from "./NoRequirementsModal";
import EditMedicationDialog from "./EditMedicationDialog";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { getRecipeCategory } from "@/utils/categoryUtils";
import { 
  calculateChronicPatientAlerts, 
  ChronicPatientAlert, 
  ChronicAlertsSummary 
} from "@/utils/chronicAlertsUtils";
import {
  formatVenezuelanPhoneForWhatsApp,
  OFFICIAL_WHATSAPP_TEMPLATES,
  interpolateWhatsAppMessage,
  buildWhatsAppLink
} from "@/utils/whatsappUtils";

// Función de generación de números dinámicos con elipsis (ej. 1, 2, 3 ... 12)
function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function Medications() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [medicalHistories, setMedicalHistories] = useState<MedicalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [selectedRecipeForView, setSelectedRecipeForView] = useState<MedicationRecipe | null>(null);
  const [search, setSearch] = useState("");
  const [requestsSearch, setRequestsSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'deliveries' | 'requests' | 'consolidated'>('deliveries');
  const [requestSubTab, setRequestSubTab] = useState<'all' | 'medications' | 'technical_aids' | 'medical_supplies' | 'derivations'>('all');
  const [isNoReqModalOpen, setIsNoReqModalOpen] = useState(false);
  const [preselectedWorkerForRecipe, setPreselectedWorkerForRecipe] = useState<Worker | null>(null);

  // Filtros Operativos Adicionales en Barra Superior
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered'>('all');
  const [onlyUrgent, setOnlyUrgent] = useState<boolean>(false);

  // Paginación Inteligente de Solicitudes (50 en 50 por defecto)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Paginación del Consolidado de Insumos Requeridos
  const [consolidatedPageSize, setConsolidatedPageSize] = useState<number>(25);
  const [consolidatedPage, setConsolidatedPage] = useState<number>(1);

  // Referencias para Scroll Suave al inicio de tabla
  const requestsTableTopRef = useRef<HTMLDivElement>(null);
  const consolidatedTableTopRef = useRef<HTMLDivElement>(null);

  // Modal de Extracción Nominal de Beneficiarios por Ítem
  const [isItemReportOpen, setIsItemReportOpen] = useState(false);
  const [reportItemQuery, setReportItemQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recipesData, workersData, historiesData] = await Promise.all([
        dataService.getMedicationRecipes(),
        dataService.getWorkers(),
        dataService.getAllMedicalHistories()
      ]);
      setRecipes(recipesData);
      setWorkers(workersData);
      setMedicalHistories(historiesData);
    } catch (error) {
      console.error("Error fetching medications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isAdmin && activeTab === 'consolidated') {
      setActiveTab('requests');
    }
  }, [isAdmin, activeTab]);

  const handleDeliver = async (recipeId: string) => {
    if (!isAdmin) {
      toast.error("Permiso denegado: Solo los administradores pueden autorizar o registrar la entrega.");
      return;
    }
    try {
      toast.loading("Registrando actualización...");
      await dataService.updateMedicationRecipeStatus(recipeId, 'delivered');
      toast.dismiss();
      toast.success("Estado actualizado correctamente");
      fetchData();
    } catch (error) {
      toast.dismiss();
      toast.error("Error al actualizar el estado");
    }
  };

  // Gestión de Edición (Solo Administrador)
  const [recipeToEdit, setRecipeToEdit] = useState<MedicationRecipe | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Gestión de Eliminación Segura In-App sin bloqueo de window.confirm (Solo Administrador)
  const [recipeToDelete, setRecipeToDelete] = useState<MedicationRecipe | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeleteRecipe = async () => {
    if (!isAdmin || !recipeToDelete) {
      toast.error("Permiso denegado: Solo los administradores pueden eliminar registros.");
      return;
    }
    setIsDeleting(true);
    try {
      await dataService.deleteMedicationRecipe(recipeToDelete.id);
      toast.success("Registro eliminado permanentemente de la base de datos.");
      setIsDeleteDialogOpen(false);
      setRecipeToDelete(null);
      await fetchData();
    } catch (error) {
      console.error("Error al eliminar registro:", error);
      toast.error("Error al eliminar el registro.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevertDelivery = async (recipe: MedicationRecipe) => {
    if (!isAdmin) {
      toast.error("Permiso denegado: Solo los administradores pueden revertir entregas.");
      return;
    }
    try {
      toast.loading("Revirtiendo entrega a estado pendiente...");
      await dataService.revertMedicationRecipeDelivery(recipe.id);
      toast.dismiss();
      toast.success("Entrega revertida. El requerimiento volvió a Solicitudes Pendientes.");
      await fetchData();
    } catch (error) {
      toast.dismiss();
      console.error("Error al revertir entrega:", error);
      toast.error("Error al revertir el estado de la entrega.");
    }
  };

  // Agrupación unificada y normalizada de requerimientos
  const requirementMap = useMemo(() => {
    const map = new Map<string, {
      key: string;
      medication: string;
      category: 'medication' | 'technical_aid' | 'medical_supply';
      presentation: string;
      totalRequested: number;
      totalDelivered: number;
      totalPending: number;
      count: number;
    }>();

    recipes
      .filter(r => getRecipeCategory(r) !== 'medical_derivation')
      .forEach(r => {
        const rawName = r.technicalAidType || r.medication || "Insumo";
        const cleanName = cleanItemDisplayName(rawName);
        const normKey = normalizeItemKey(cleanName);
        if (!normKey) return;

        const cat = getRecipeCategory(r) as 'medication' | 'technical_aid' | 'medical_supply';

        const qty = (cat === 'technical_aid' && r.technicalAidQuantity)
          ? Number(r.technicalAidQuantity)
          : (Number(r.quantity) || 1);

        const isDelivered = r.status === 'delivered';

        if (!map.has(normKey)) {
          map.set(normKey, {
            key: normKey,
            medication: cleanName,
            category: cat,
            presentation: r.presentation || (cat === 'technical_aid' ? 'Unidad' : 'Tabletas'),
            totalRequested: qty,
            totalDelivered: isDelivered ? qty : 0,
            totalPending: isDelivered ? 0 : qty,
            count: qty
          });
        } else {
          const existing = map.get(normKey)!;
          existing.totalRequested += qty;
          if (isDelivered) {
            existing.totalDelivered += qty;
          } else {
            existing.totalPending += qty;
          }
          existing.count = existing.totalRequested;
        }
      });

    return Array.from(map.values()).sort((a, b) => b.totalRequested - a.totalRequested);
  }, [recipes]);

  const [consolidatedCategoryFilter, setConsolidatedCategoryFilter] = useState<'all' | 'medication' | 'technical_aid' | 'medical_supply'>('all');

  const filteredRequirements = useMemo(() => {
    return requirementMap.filter(m => {
      if (consolidatedCategoryFilter !== 'all' && m.category !== consolidatedCategoryFilter) {
        return false;
      }
      if (search.trim()) {
        const term = search.toLowerCase().trim();
        return m.medication.toLowerCase().includes(term) || m.presentation.toLowerCase().includes(term);
      }
      return true;
    });
  }, [requirementMap, consolidatedCategoryFilter, search]);

  const totalPending = recipes.filter(r => r.status === 'pending' || !r.status).length;
  const totalDelivered = recipes.filter(r => r.status === 'delivered').length;
  const totalDerivations = recipes.filter(r => getRecipeCategory(r) === 'medical_derivation').length;

  const deliveredRecipes = useMemo(() => {
    return recipes.filter(r => r.status === 'delivered');
  }, [recipes]);

  const deliveredBeneficiariesCount = useMemo(() => {
    return new Set(deliveredRecipes.map(r => r.workerId)).size;
  }, [deliveredRecipes]);

  // Desglose nítido de entregas físicas por categoría
  const deliveredMedicationsCount = useMemo(() => {
    return deliveredRecipes
      .filter(r => getRecipeCategory(r) === 'medication')
      .reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
  }, [deliveredRecipes]);

  const deliveredTechnicalAidsCount = useMemo(() => {
    return deliveredRecipes
      .filter(r => getRecipeCategory(r) === 'technical_aid')
      .reduce((acc, r) => acc + (Number(r.technicalAidQuantity) || Number(r.quantity) || 1), 0);
  }, [deliveredRecipes]);

  const deliveredSuppliesCount = useMemo(() => {
    return deliveredRecipes
      .filter(r => getRecipeCategory(r) === 'medical_supply')
      .reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
  }, [deliveredRecipes]);

  const totalPhysicalDeliveredUnits = deliveredMedicationsCount + deliveredTechnicalAidsCount + deliveredSuppliesCount;

  const recipeWorkerIdSet = useMemo(() => {
    return new Set(recipes.map(r => r.workerId));
  }, [recipes]);

  const workersWithoutRequirements = useMemo(() => {
    return workers.filter(w => !recipeWorkerIdSet.has(w.id));
  }, [workers, recipeWorkerIdSet]);
  
  const medsDeliveredDispatches = useMemo(() => {
    return deliveredRecipes.filter(r => getRecipeCategory(r) === 'medication').length;
  }, [deliveredRecipes]);

  // Cálculo automatizado del ciclo de 30 días para alertas de reposición crónica
  const chronicAlertsSummary: ChronicAlertsSummary = useMemo(() => {
    return calculateChronicPatientAlerts(workers, recipes, medicalHistories);
  }, [workers, recipes, medicalHistories]);

  const stats = [
    { 
      title: "Fármacos Despachados", 
      value: `${deliveredMedicationsCount.toLocaleString()} un.`, 
      icon: Pill, 
      color: "text-emerald-700", 
      bg: "bg-emerald-50",
      badge: `${medsDeliveredDispatches.toLocaleString()} despachos`,
      onClick: () => setActiveTab('deliveries')
    },
    { 
      title: "Ayudas Técnicas Asignadas", 
      value: `${deliveredTechnicalAidsCount.toLocaleString()} equipos`, 
      icon: Accessibility, 
      color: "text-cyan-700", 
      bg: "bg-cyan-50",
      badge: "Movilidad / Social",
      onClick: () => setActiveTab('deliveries')
    },
    { 
      title: "Insumos Médicos Entregados", 
      value: `${deliveredSuppliesCount.toLocaleString()} paq./un.`, 
      icon: Package, 
      color: "text-indigo-700", 
      bg: "bg-indigo-50",
      badge: "Insumos / Pañales",
      onClick: () => setActiveTab('deliveries')
    },
    { 
      title: "Beneficiarios con Entrega", 
      value: `${deliveredBeneficiariesCount} personas`, 
      icon: CheckCircle2, 
      color: "text-blue-800", 
      bg: "bg-blue-50",
      badge: `${totalDelivered.toLocaleString()} despachos totales`,
      onClick: () => setActiveTab('deliveries')
    },
    { 
      title: "Censo Sin Requerimiento", 
      value: `${workersWithoutRequirements.length} ciudadanos`, 
      icon: UserX, 
      color: "text-amber-800", 
      bg: "bg-amber-50",
      badge: `${workers.length > 0 ? ((workersWithoutRequirements.length / workers.length) * 100).toFixed(1) : 0}% del censo`,
      onClick: () => setIsNoReqModalOpen(true)
    },
    { 
      title: "Alertas Reposición Crónica", 
      value: `${chronicAlertsSummary.overdueCount} por reponer`, 
      icon: AlertCircle, 
      color: chronicAlertsSummary.overdueCount > 0 ? "text-rose-700" : "text-emerald-700", 
      bg: chronicAlertsSummary.overdueCount > 0 ? "bg-rose-50" : "bg-emerald-50", 
      badge: "Módulo Dedicado",
      onClick: () => navigate('/chronic-alerts')
    },
    ...(isAdmin ? [
      { 
        title: "Solicitudes Pendientes", 
        value: totalPending, 
        icon: Clock, 
        color: "text-rose-700", 
        bg: "bg-rose-50",
        badge: "Por Atender",
        onClick: () => {
          setActiveTab('requests');
          setStatusFilter('pending');
        }
      },
    ] : [])
  ];

  const getWorker = (workerId: string) => {
    return workers.find(w => w.id === workerId);
  };

  const getWorkerName = (workerId: string) => {
    const w = getWorker(workerId);
    return w ? w.fullName : "Paciente Eliminado/No Registrado";
  };

  const getWorkerDni = (workerId: string) => {
    const w = getWorker(workerId);
    return w ? w.dni : "---";
  };

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      // Determine category
      const cat = getRecipeCategory(r);
      
      if (requestSubTab === 'medications' && cat !== 'medication') return false;
      if (requestSubTab === 'technical_aids' && cat !== 'technical_aid') return false;
      if (requestSubTab === 'medical_supplies' && cat !== 'medical_supply') return false;
      if (requestSubTab === 'derivations' && cat !== 'medical_derivation') return false;

      // Filtro por estado de entrega
      if (statusFilter === 'pending' && r.status === 'delivered') return false;
      if (statusFilter === 'delivered' && r.status !== 'delivered') return false;

      // Filtro de urgencia médica
      if (onlyUrgent && !r.isUrgent) return false;

      const term = (requestsSearch || "").trim().toLowerCase();
      if (!term) return true;

      const rawWorkerName = getWorkerName(r.workerId);
      const workerName = (rawWorkerName || "Paciente No Identificado").toLowerCase();
      
      const rawWorkerDni = getWorkerDni(r.workerId);
      const workerDni = (rawWorkerDni || "").toLowerCase();
      const workerDniDigits = workerDni.replace(/[^0-9]/g, '');
      const cleanTermDigits = term.replace(/[^0-9]/g, '');

      const medicationName = (r.medication || "").toLowerCase();
      const technicalAidName = (r.technicalAidType || "").toLowerCase();
      const derivationService = (r.derivationService || "").toLowerCase();
      const derivationCenter = (r.derivationCenter || "").toLowerCase();
      const commune = (r.commune || "").toLowerCase();
      const deliveryOfficer = (r.deliveryOfficer || r.deliveredBy || "").toLowerCase();
      const itemLabel = `${technicalAidName} ${medicationName} ${derivationService} ${derivationCenter} ${commune} ${deliveryOfficer}`.toLowerCase();

      // 1. Direct Name Match
      if (workerName.includes(term)) return true;

      // 2. Direct DNI match (with or without V-/E- prefix or dots)
      if (workerDni.includes(term)) return true;

      // 3. Numeric match for Cedula digits (e.g. typing 12345678 or partial 1234)
      if (cleanTermDigits.length > 0 && workerDniDigits.includes(cleanTermDigits)) return true;

      // 4. Match service, item or commune
      if (itemLabel.includes(term)) return true;

      // 5. Representative Legal / Caregiver match (name, DNI or phone)
      if (r.isDeliveredToRepresentative) {
        const repName = (r.representativeFullName || "").toLowerCase();
        const repDni = (r.representativeDni || "").toLowerCase();
        const cleanRepDigits = repDni.replace(/[^0-9]/g, '');
        if (repName.includes(term)) return true;
        if (repDni.includes(term)) return true;
        if (cleanTermDigits.length > 0 && cleanRepDigits.includes(cleanTermDigits)) return true;
      }

      return false;
    });
  }, [recipes, requestSubTab, statusFilter, onlyUrgent, requestsSearch, workers]);

  // Cálculos de Paginación de Solicitudes
  const totalRecipesCount = filteredRecipes.length;
  const totalPages = Math.max(1, Math.ceil(totalRecipesCount / pageSize));
  const paginatedRecipes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecipes.slice(start, start + pageSize);
  }, [filteredRecipes, currentPage, pageSize]);

  // Cálculos de Paginación de Consolidado de Insumos
  const totalConsolidatedCount = filteredRequirements.length;
  const totalConsolidatedPages = Math.max(1, Math.ceil(totalConsolidatedCount / consolidatedPageSize));
  const paginatedRequirements = useMemo(() => {
    const start = (consolidatedPage - 1) * consolidatedPageSize;
    return filteredRequirements.slice(start, start + consolidatedPageSize);
  }, [filteredRequirements, consolidatedPage, consolidatedPageSize]);

  // Reseteo automático de página al cambiar filtros o términos
  useEffect(() => {
    setCurrentPage(1);
  }, [requestsSearch, requestSubTab, statusFilter, onlyUrgent, pageSize]);

  useEffect(() => {
    setConsolidatedPage(1);
  }, [search, consolidatedPageSize]);

  // Scroll suave al inicio de la tabla al cambiar de página
  useEffect(() => {
    if (requestsTableTopRef.current) {
      requestsTableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  useEffect(() => {
    if (consolidatedTableTopRef.current) {
      consolidatedTableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [consolidatedPage]);

  // Exportación rápida de Solicitudes Filtradas a CSV compatible con Excel
  const handleExportRequestsCsv = () => {
    if (filteredRecipes.length === 0) {
      toast.error("No hay solicitudes para exportar con los filtros seleccionados");
      return;
    }

    const headers = [
      "ID",
      "Paciente",
      "Cédula",
      "Comuna",
      "Categoría",
      "Ítem / Medicamento / Servicio",
      "Cantidad",
      "Estado",
      "Urgencia Médica",
      "Motivo Urgencia",
      "Retirado Por",
      "Representante Legal",
      "Cédula Representante",
      "Teléfono Representante",
      "Fecha Registro"
    ];

    const rows = filteredRecipes.map(r => {
      const worker = getWorker(r.workerId);
      const cat = r.category || (r.requiresTechnicalAid ? 'technical_aid' : 'medication');
      const catLabel = cat === 'medication' ? 'Fármaco' : cat === 'technical_aid' ? 'Ayuda Humana' : cat === 'medical_supply' ? 'Insumo Médico' : 'Derivación Médica';
      const itemName = r.technicalAidType || r.medication || r.derivationService || "Requerimiento";
      const qty = r.requiresTechnicalAid ? (r.technicalAidQuantity || 1) : (r.quantity || 1);
      const statusLabel = r.status === 'delivered' ? 'Entregado / Emitida' : 'Pendiente';
      const urgentLabel = r.isUrgent ? 'SÍ (URGENTE)' : 'NO';
      const repLabel = r.isDeliveredToRepresentative ? 'Representante Legal' : 'Titular Directo';
      const repName = r.representativeFullName || '';
      const repDni = r.representativeDni || '';
      const repPhone = r.representativePhone || '';
      const dateStr = formatDateSafe(r.createdAt, "yyyy-MM-dd HH:mm", '');

      return [
        `"${r.id}"`,
        `"${(worker?.fullName || 'Paciente').replace(/"/g, '""')}"`,
        `"${worker?.dni || ''}"`,
        `"${(r.commune || worker?.commune || '').replace(/"/g, '""')}"`,
        `"${catLabel}"`,
        `"${itemName.replace(/"/g, '""')}"`,
        qty,
        `"${statusLabel}"`,
        `"${urgentLabel}"`,
        `"${(r.urgencyReason || '').replace(/"/g, '""')}"`,
        `"${repLabel}"`,
        `"${repName.replace(/"/g, '""')}"`,
        `"${repDni}"`,
        `"${repPhone}"`,
        `"${dateStr}"`
      ].join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Solicitudes_Farmacia_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exportadas ${filteredRecipes.length} solicitudes a CSV`);
  };

  // Exportación del Consolidado a CSV
  const handleExportConsolidatedCsv = () => {
    if (filteredRequirements.length === 0) {
      toast.error("No hay insumos en el consolidado para exportar");
      return;
    }

    const headers = [
      "Insumo / Principio Activo",
      "Categoría",
      "Presentación",
      "Total Solicitado (Demanda)",
      "Total Entregado (Despacho)",
      "Pendiente por Entregar",
      "% Cumplimiento"
    ];

    const rows = filteredRequirements.map(m => {
      const catLabel = m.category === 'technical_aid' 
        ? 'Ayuda Técnica' 
        : (m.category === 'medical_supply' ? 'Insumo Médico' : 'Fármaco');
      const fulfillment = m.totalRequested > 0 
        ? `${Math.round((m.totalDelivered / m.totalRequested) * 100)}%` 
        : '0%';
      return [
        `"${m.medication.replace(/"/g, '""')}"`,
        `"${catLabel}"`,
        `"${m.presentation.replace(/"/g, '""')}"`,
        m.totalRequested,
        m.totalDelivered,
        m.totalPending,
        `"${fulfillment}"`
      ].join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Consolidado_Insumos_Farmacia_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Consolidado de ${filteredRequirements.length} insumos exportado a CSV`);
  };

  return (
    <div className="space-y-6 pb-10">
      <HealthMatrixModal 
        open={isMatrixModalOpen}
        onOpenChange={setIsMatrixModalOpen}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-blue-950 tracking-tight uppercase">Farmacia</h2>
          <p className="text-slate-500 font-medium tracking-tight font-sans">Despacho de medicamentos, registro de entregas y control de solicitudes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline"
            className="border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-950 font-bold px-4 h-11 uppercase text-xs tracking-wider shrink-0 gap-2 shadow-2xs cursor-pointer" 
            onClick={() => navigate('/chronic-alerts')}
            title="Abrir módulo centralizado de Semáforo y Plan de Reposición de Fármacos Crónicos"
          >
            <HeartPulse className="w-4 h-4 text-rose-600" />
            <span>Semáforo y Reposición {chronicAlertsSummary.overdueCount > 0 ? `(${chronicAlertsSummary.overdueCount})` : ''}</span>
          </Button>

          <Button 
            variant="outline"
            className="border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-bold px-4 h-11 uppercase text-xs tracking-wider shrink-0 gap-2 shadow-2xs cursor-pointer" 
            onClick={() => {
              setReportItemQuery("");
              setIsItemReportOpen(true);
            }}
            title="Extraer nominalmente qué personas recibieron canastillas, sillas de ruedas o fármacos específicos"
          >
            <PackageSearch className="w-4 h-4 text-indigo-700" />
            <span>Beneficiarios por Ítem</span>
          </Button>

          <Button 
            className="bg-blue-900 hover:bg-blue-950 font-bold px-6 h-11 uppercase text-xs tracking-widest shrink-0 shadow-sm cursor-pointer" 
            onClick={() => {
              setPreselectedWorkerForRecipe(null);
              setIsDialogOpen(true);
            }}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            NUEVA SOLICITUD / ATENCIÓN
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setPreselectedWorkerForRecipe(null);
        }
      }}>
        <DialogContent className="w-[96vw] sm:w-[92vw] max-w-[96vw] md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[92dvh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl sm:rounded-2xl">
          <DialogHeader className="p-3.5 sm:p-5 pr-12 bg-slate-50 border-b border-slate-200">
            <DialogTitle className="uppercase font-black text-blue-900 text-sm sm:text-lg text-left">
              {preselectedWorkerForRecipe 
                ? `Registrar Solicitud / Entrega para: ${preselectedWorkerForRecipe.fullName}` 
                : "Registrar Solicitud, Entrega o Derivación Médica"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-3 sm:p-6 md:p-7">
            <ErrorBoundary fallbackTitle="Error al cargar el formulario de solicitud o suplementos">
              <div key={preselectedWorkerForRecipe?.id || 'standard-form'}>
                <RecipeForm 
                  workers={workers} 
                  workerId={preselectedWorkerForRecipe?.id}
                  workerName={preselectedWorkerForRecipe?.fullName}
                  commune={preselectedWorkerForRecipe?.commune}
                  hasDisability={preselectedWorkerForRecipe?.hasDisability}
                  existingRecipes={recipes}
                  onBatchSaved={() => {
                    fetchData();
                  }}
                  onWorkerCreated={(newWorker) => {
                    setWorkers(prev => [newWorker, ...prev]);
                  }}
                  onSuccess={() => { 
                    setIsDialogOpen(false); 
                    setPreselectedWorkerForRecipe(null);
                    fetchData(); 
                  }} 
                />
              </div>
            </ErrorBoundary>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tarjetas de Métricas Globales del Sistema (Solo Visibles para Administradores) */}
      {isAdmin && (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${stats.length} gap-4`}>
          {stats.map((stat, i) => (
            <Card 
              key={i} 
              onClick={stat.onClick}
              className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all ${
                stat.onClick ? 'cursor-pointer hover:border-blue-400' : ''
              }`}
            >
              <CardContent className="p-6">
                 <div className="flex justify-between items-start">
                   <div className={`${stat.bg} ${stat.color} p-2.5 rounded-xl`}>
                      <stat.icon className="w-5 h-5" />
                   </div>
                   {stat.badge ? (
                     <Badge variant="outline" className="text-[8px] font-bold text-slate-500 bg-slate-50 uppercase">
                       {stat.badge}
                     </Badge>
                   ) : (
                     <Badge variant="outline" className="text-[8px] font-bold text-slate-400">ACTUALIZADO</Badge>
                   )}
                 </div>
                 <div className="mt-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.title}</p>
                   <h3 className="text-2xl font-black text-slate-800 mt-1">{stat.value}</h3>
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Monitor de Despacho y Entregas Físicas (Solo Visible para Administradores) */}
      {isAdmin && (
        <DeliveryAnalyticsPanel
          deliveredRecipes={deliveredRecipes}
          workers={workers}
          workersWithoutRequirementsCount={workersWithoutRequirements.length}
          totalWorkersCount={workers.length}
          onOpenNoReqModal={() => setIsNoReqModalOpen(true)}
        />
      )}

      {/* Navegación por Pestañas Principales */}
      <div className="flex gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`px-4 py-2.5 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'deliveries'
              ? 'border-emerald-600 text-emerald-950 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>📦 Libro Digital de Entregas Realizadas</span>
          {isAdmin && (
            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[10px] font-black py-0 px-1.5">
              {deliveredRecipes.length}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'requests'
              ? 'border-blue-900 text-blue-900 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>📋 Control General de Solicitudes y Derivaciones</span>
          {isAdmin && (
            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px] font-bold py-0 px-1.5">
              {recipes.length}
            </Badge>
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('consolidated')}
            className={`px-4 py-2.5 font-black text-xs uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'consolidated'
                ? 'border-blue-900 text-blue-900 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span>📊 Consolidado de Insumos Requeridos</span>
            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px] font-bold py-0 px-1.5">
              {requirementMap.length}
            </Badge>
          </button>
        )}

        <button
          onClick={() => navigate('/chronic-alerts')}
          className="px-4 py-2.5 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent text-rose-700 hover:text-rose-950 transition-all flex items-center gap-2 shrink-0 ml-auto bg-rose-50/70 rounded-t-lg hover:bg-rose-100 cursor-pointer"
          title="Abrir módulo centralizado de Semáforo y Adquisición de Fármacos Crónicos"
        >
          <HeartPulse className="w-4 h-4 text-rose-600" />
          <span>Semáforo y Plan de Reposición ↗</span>
          {chronicAlertsSummary.overdueCount > 0 && (
            <Badge className="bg-rose-600 text-white font-black text-[10px] py-0 px-1.5 animate-pulse">
              {chronicAlertsSummary.overdueCount}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === 'deliveries' && (
        <DeliveriesBook
          recipes={recipes}
          workers={workers}
          isAdmin={isAdmin}
          onViewRecipe={(recipe) => setSelectedRecipeForView(recipe)}
          onEditRecipe={(recipe) => {
            setRecipeToEdit(recipe);
            setIsEditDialogOpen(true);
          }}
          onDeleteRecipe={(recipe) => {
            setRecipeToDelete(recipe);
            setIsDeleteDialogOpen(true);
          }}
          onRevertDelivery={handleRevertDelivery}
        />
      )}

      {activeTab === 'requests' && (
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-black text-blue-900 uppercase tracking-widest">
                  {requestSubTab === 'all' && "📋 Control General de Requerimientos, Entregas y Derivaciones"}
                  {requestSubTab === 'medications' && "💊 Control de Medicamentos y Fármacos"}
                  {requestSubTab === 'technical_aids' && "♿ Control de Ayudas Humanas y Equipos"}
                  {requestSubTab === 'medical_supplies' && "📦 Control de Insumos Médicos y Quirúrgicos"}
                  {requestSubTab === 'derivations' && "🏥 Control de Derivaciones y Enrutamiento a Red Pública"}
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                  {requestSubTab === 'all' && "Monitoreo integral de fármacos, ayudas humanas, insumos y derivaciones médicas"}
                  {requestSubTab === 'medications' && "Monitoreo y confirmación de fármacos solicitados y entregados"}
                  {requestSubTab === 'technical_aids' && "Monitoreo de sillas de ruedas, andaderas, bastones y soportes"}
                  {requestSubTab === 'medical_supplies' && "Monitoreo de pañales, gasas, soluciones, jeringas y material asistencial"}
                  {requestSubTab === 'derivations' && "Órdenes de atención y remisiones emitidas hacia centros asistenciales de la red pública"}
                </CardDescription>
              </div>

              {/* Botón Rápido de Exportación a CSV / Excel (Solo Administradores) */}
              {isAdmin && (
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportRequestsCsv}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 font-black text-[10px] uppercase tracking-wider h-9 px-3.5 rounded-xl shadow-2xs gap-1.5 shrink-0"
                    title="Exportar solicitudes filtradas a formato CSV / Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Exportar a Excel (CSV)</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Barra Operativa: Búsqueda, Filtro Estado, Filtro Urgencia y Tamaño de Lote */}
            <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center pt-1 border-t border-slate-200/60">
              {/* Campo de búsqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-900/60" />
                <Input
                  placeholder="BUSCAR POR CÉDULA (EJ. 12345678) O NOMBRE..."
                  className="pl-9 pr-8 h-9 bg-white text-[10px] font-bold border-slate-300 focus:border-blue-700 uppercase tracking-wider text-slate-800 shadow-2xs"
                  value={requestsSearch}
                  onChange={(e) => setRequestsSearch(e.target.value)}
                />
                {requestsSearch && (
                  <button
                    type="button"
                    onClick={() => setRequestsSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtros Operativos Rápidos */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro por Estado */}
                <div className="w-36 sm:w-44">
                  <Select
                    value={statusFilter}
                    onValueChange={(val: 'all' | 'pending' | 'delivered') => setStatusFilter(val)}
                  >
                    <SelectTrigger className="h-9 bg-white border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700">
                      <SelectValue placeholder="Estado de Entrega" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[11px] font-bold">📋 Todos los Estados</SelectItem>
                      <SelectItem value="pending" className="text-[11px] font-bold text-amber-800">⚡ Pendientes / Solicitados</SelectItem>
                      <SelectItem value="delivered" className="text-[11px] font-bold text-emerald-800">✓ Entregados / Emitidos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Urgencia Médica de Un Toque */}
                <Button
                  type="button"
                  variant={onlyUrgent ? "default" : "outline"}
                  onClick={() => setOnlyUrgent(!onlyUrgent)}
                  className={`h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all gap-1.5 shrink-0 ${
                    onlyUrgent 
                      ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm" 
                      : "bg-white text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                  }`}
                  title="Ver únicamente solicitudes marcadas con Urgencia Médica"
                >
                  <AlertCircle className={`w-3.5 h-3.5 ${onlyUrgent ? "text-white" : "text-rose-600"}`} />
                  <span>🚨 Solo Urgencias</span>
                </Button>

                {/* Selector de Agrupación por Lote (25, 50, 100) */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 h-9 shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lote:</span>
                  <Select 
                    value={String(pageSize)} 
                    onValueChange={(v) => setPageSize(Number(v))}
                  >
                    <SelectTrigger className="h-6 w-20 border-none bg-transparent shadow-none text-[10px] font-black p-0 focus:ring-0 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25" className="text-xs font-bold">25 en 25</SelectItem>
                      <SelectItem value="50" className="text-xs font-bold">50 en 50</SelectItem>
                      <SelectItem value="100" className="text-xs font-bold">100 en 100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requestsSearch && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-900 font-black text-[9px] uppercase tracking-wider px-2 py-1 shrink-0">
                    {filteredRecipes.length} {filteredRecipes.length === 1 ? 'coincidencia' : 'coincidencias'}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Sub-Tabs Selector inside Request Control */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 bg-slate-50/55 border-b border-slate-100 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setRequestSubTab('all')}
              className={`py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                requestSubTab === 'all'
                  ? 'bg-blue-900 text-white shadow-md rounded-xl font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 rounded-xl bg-transparent'
              }`}
            >
              📋 Todos
              <Badge className={`font-black text-[9px] border-none px-2 py-0.5 shadow-none rounded-md ${
                requestSubTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {recipes.length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setRequestSubTab('medications')}
              className={`py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                requestSubTab === 'medications'
                  ? 'bg-blue-900 text-white shadow-md rounded-xl font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 rounded-xl bg-transparent'
              }`}
            >
              💊 Fármacos
              <Badge className={`font-black text-[9px] border-none px-2 py-0.5 shadow-none rounded-md ${
                requestSubTab === 'medications' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
              }`}>
                {recipes.filter(r => getRecipeCategory(r) === 'medication').length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setRequestSubTab('technical_aids')}
              className={`py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                requestSubTab === 'technical_aids'
                  ? 'bg-blue-900 text-white shadow-md rounded-xl font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 rounded-xl bg-transparent'
              }`}
            >
              ♿ Ayudas Humanas
              <Badge className={`font-black text-[9px] border-none px-2 py-0.5 shadow-none rounded-md ${
                requestSubTab === 'technical_aids' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
              }`}>
                {recipes.filter(r => getRecipeCategory(r) === 'technical_aid').length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setRequestSubTab('medical_supplies')}
              className={`py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                requestSubTab === 'medical_supplies'
                  ? 'bg-blue-900 text-white shadow-md rounded-xl font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 rounded-xl bg-transparent'
              }`}
            >
              📦 Insumos
              <Badge className={`font-black text-[9px] border-none px-2 py-0.5 shadow-none rounded-md ${
                requestSubTab === 'medical_supplies' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-900'
              }`}>
                {recipes.filter(r => getRecipeCategory(r) === 'medical_supply').length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setRequestSubTab('derivations')}
              className={`py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                requestSubTab === 'derivations'
                  ? 'bg-blue-900 text-white shadow-md rounded-xl font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 rounded-xl bg-transparent'
              }`}
            >
              🏥 Derivaciones
              <Badge className={`font-black text-[9px] border-none px-2 py-0.5 shadow-none rounded-md ${
                requestSubTab === 'derivations' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-900'
              }`}>
                {recipes.filter(r => getRecipeCategory(r) === 'medical_derivation').length}
              </Badge>
            </button>
          </div>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50 text-blue-600" />
                <p className="text-[10px] font-bold uppercase tracking-widest italic">Cargando solicitudes...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div ref={requestsTableTopRef} />
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/20 border-b border-slate-100 italic">
                      <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400">Paciente</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400">
                        Categoría / Requerimiento / Derivación
                      </TableHead>
                      <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400">Comuna</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 text-center">Detalle / Destino</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400">Estado</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 text-right min-w-[210px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecipes.map((r) => {
                      const itemCategory = getRecipeCategory(r);
                      const itemName = r.technicalAidType || r.medication || "Requerimiento";
                      const worker = getWorker(r.workerId);
                      
                      return (
                      <TableRow key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="px-6 py-4">
                           <div className="flex flex-col">
                             <span className="font-bold text-slate-800 uppercase text-xs">{getWorkerName(r.workerId)}</span>
                             <span className="text-[9px] font-bold text-slate-400 mt-0.5">C.I. {getWorkerDni(r.workerId)}</span>
                             
                             {r.isDeliveredToRepresentative && (
                               <div className="mt-2 p-2 bg-blue-50/90 border border-blue-200 rounded-lg max-w-xs shadow-2xs">
                                 <div className="flex items-center gap-1 text-[9px] font-black text-blue-900 uppercase">
                                   <Users className="w-3 h-3 text-blue-700 shrink-0" />
                                   <span>Retiró Representante:</span>
                                 </div>
                                 <p className="text-[11px] font-black text-slate-900 uppercase mt-0.5 truncate">
                                   {r.representativeFullName || "Familiar / Apoderado"}
                                 </p>
                                 <div className="flex items-center gap-1.5 flex-wrap text-[9px] text-slate-600 font-bold mt-0.5">
                                   <span className="bg-white px-1.5 py-0.2 rounded border border-slate-200 text-blue-950">
                                     C.I. {r.representativeDni || "S/D"}
                                   </span>
                                   <span>• {r.representativeRelationship || "Apoderado"}</span>
                                   {r.representativePhone && (
                                     <span className="text-slate-500 font-medium">({r.representativePhone})</span>
                                   )}
                                 </div>
                               </div>
                             )}
                           </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                           <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-1.5 flex-wrap">
                               {itemCategory === 'medication' && (
                                 <span className="inline-flex items-center text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                   💊 FÁRMACO
                                 </span>
                               )}
                               {itemCategory === 'technical_aid' && (
                                 <span className="inline-flex items-center text-[9px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                   ♿ AYUDA HUMANA
                                 </span>
                               )}
                               {itemCategory === 'medical_supply' && (
                                 r.socialAidType === 'economic_aid' || (r.economicAmount !== undefined && Number(r.economicAmount) > 0) ? (
                                   <span className="inline-flex items-center text-[9px] font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                                     💵 APORTE ({r.economicCurrency === 'VES' ? 'Bs.' : '$'})
                                   </span>
                                 ) : r.socialAidType === 'food_bag' || (r.foodBagsCount !== undefined && Number(r.foodBagsCount) > 0) ? (
                                   <span className="inline-flex items-center text-[9px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                                     🥫 BOLSA DE COMIDA
                                   </span>
                                 ) : (
                                   <span className="inline-flex items-center text-[9px] font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                                     📦 INSUMO MÉDICO
                                   </span>
                                 )
                               )}
                               {itemCategory === 'medical_derivation' && (
                                 <span className="inline-flex items-center text-[9px] font-bold bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-200">
                                   🏥 DERIVACIÓN MÉDICA
                                 </span>
                               )}

                               <span className="font-bold text-slate-800 text-xs uppercase">{itemName}</span>

                               {r.isUrgent && (
                                 <span className="inline-flex items-center gap-1 text-[9px] font-black bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200" title={r.urgencyReason || "Salto de Urgencia"}>
                                   <ShieldAlert className="w-2.5 h-2.5 text-rose-600" /> URGENCIA
                                 </span>
                               )}

                               {r.recipeFileUrl && (
                                 <button 
                                   onClick={() => setSelectedRecipeForView(r)}
                                   className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-colors border border-blue-100 cursor-pointer"
                                   title="Ver soporte adjunto"
                                 >
                                   <Paperclip className="w-2.5 h-2.5 text-blue-600" /> Soporte
                                 </button>
                               )}
                             </div>
                             
                             {itemCategory === 'medication' && (
                               <span className="text-[9px] text-slate-400 font-medium">
                                 {r.presentation || "Unidad"} • {r.dosage || "Dosis N/A"} • {r.frequency || "Frecuencia N/A"}
                               </span>
                             )}
                             {itemCategory === 'medical_derivation' && (
                               <span className="text-[9px] text-indigo-700 font-bold uppercase">
                                 Centro: {r.derivationCenter || "Red Pública Municipal"} {r.derivationStatus === 'ESPECIALIZADO' ? '(Especializado)' : ''}
                               </span>
                             )}
                             {(itemCategory === 'technical_aid' || itemCategory === 'medical_supply') && (
                               <span className="text-[9px] text-slate-500 font-medium italic">
                                 {r.technicalAidNotes || r.deliveryNotes || "Sin especificaciones adicionales"}
                               </span>
                             )}
                             {r.isUrgent && r.urgencyReason && (
                               <span className="text-[9px] text-rose-700 font-semibold italic line-clamp-1">
                                 Motivo Urgencia: {r.urgencyReason}
                               </span>
                             )}
                           </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-700 uppercase">{r.commune}</span>
                            {(r.isForeigner || r.commune?.startsWith('OTRO') || r.commune?.includes('FUERA')) && (
                              <span className="text-[8px] font-black text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit">
                                📍 FORÁNEO {r.originLocation ? `(${r.originLocation})` : ''}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          {itemCategory === 'medical_derivation' ? (
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-800 uppercase">
                                {r.derivationService || "Servicio Médico"}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">
                                {r.derivationStatus === 'ESPECIALIZADO' ? 'Especializado' : 'Atención Directa'}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-800 text-sm">
                              x{r.quantity || r.technicalAidQuantity || 1}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <Badge className={`w-fit text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              r.status === 'delivered' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {itemCategory === 'medical_derivation' 
                                ? (r.status === 'delivered' ? '✓ Orden Emitida' : '⚡ Por Coordinar')
                                : (r.status === 'delivered' ? '✓ Entregado' : '⚡ Solicitado')}
                            </Badge>
                            {r.status === 'delivered' && (r.deliveryOfficer || r.deliveredBy) && (
                              <span className="text-[8px] font-bold text-slate-500">
                                Por: <span className="uppercase text-slate-700">{r.deliveryOfficer || r.deliveredBy}</span>
                              </span>
                            )}
                            {r.status === 'delivered' && r.deliveredAt && (
                              <span className="text-[8px] text-slate-400">
                                {new Date(r.deliveredAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right min-w-[210px] whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* Botón de Hoja de Derivación PDF */}
                            {itemCategory === 'medical_derivation' && (
                              <Button
                                onClick={() => generateDerivationPdf(r, worker)}
                                size="sm"
                                variant="outline"
                                className="border-indigo-300 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-950 font-black text-[10px] uppercase tracking-wider px-3 h-8.5 rounded-xl shadow-2xs gap-1.5 transition-all"
                                title="Imprimir u obtener Orden Oficial de Derivación en PDF"
                              >
                                <Printer className="w-3.5 h-3.5 text-indigo-700" />
                                Imprimir Orden PDF
                              </Button>
                            )}

                            {(r.status !== 'delivered') && (
                              isAdmin ? (
                                <Button 
                                  onClick={() => handleDeliver(r.id)}
                                  size="sm" 
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest px-3.5 h-8.5 rounded-xl shadow-2xs"
                                >
                                  {itemCategory === 'medical_derivation' ? 'Marcar Emitida' : 'Registrar Entrega'}
                                </Button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-black uppercase tracking-wider">Pendiente</span>
                              )
                            )}
                            
                            {isAdmin && (
                              <>
                                <Button 
                                  onClick={() => {
                                    setRecipeToEdit(r);
                                    setIsEditDialogOpen(true);
                                  }}
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8.5 w-8.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                  title="Corregir y editar requerimiento (Solo Administrador)"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  onClick={() => {
                                    setRecipeToDelete(r);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8.5 w-8.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                  title="Eliminar registro permanentemente (Solo Administrador)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                    {filteredRecipes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                          <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                              <Search className="w-6 h-6" />
                            </div>
                            {requestsSearch ? (
                              <>
                                <p className="text-xs font-black uppercase text-slate-700">
                                  No se encontraron registros para "{requestsSearch}"
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  Verifica que la cédula o el nombre del paciente estén correctamente escritos.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setRequestsSearch("")}
                                  className="text-[10px] font-black uppercase tracking-wider h-8 border-slate-300"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  Limpiar búsqueda
                                </Button>
                              </>
                            ) : (
                              <p className="text-xs uppercase font-bold italic text-slate-400">
                                No hay solicitudes o derivaciones registradas en esta categoría.
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Barra de Navegación de Páginas (Pagination Bar) */}
                {totalRecipesCount > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 bg-slate-50/60">
                    <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
                      Mostrando registros del <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> al <span className="font-bold text-slate-900">{Math.min(currentPage * pageSize, totalRecipesCount)}</span> de un total de <span className="font-bold text-slate-900">{totalRecipesCount}</span> solicitudes filtradas
                      {onlyUrgent && <span className="text-rose-600 font-bold ml-1.5">(🚨 Solo Urgencias)</span>}
                      {statusFilter !== 'all' && (
                        <span className="text-blue-700 font-bold ml-1.5">
                          ({statusFilter === 'pending' ? '⚡ Pendientes' : '✓ Entregados'})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl border-slate-200 hover:bg-white disabled:opacity-40"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        title="Primera página"
                      >
                        <ChevronsLeft className="h-4 w-4 text-slate-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl border-slate-200 hover:bg-white disabled:opacity-40"
                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        title="Página anterior"
                      >
                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                      </Button>

                      {/* Números dinámicos con elipsis (1, 2, 3 ... 12) */}
                      <div className="flex items-center gap-1">
                        {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                          if (p === '...') {
                            return (
                              <span key={`dots-${idx}`} className="px-1.5 text-slate-400 font-black text-xs select-none">
                                ...
                              </span>
                            );
                          }
                          const pageNum = p as number;
                          const isActive = currentPage === pageNum;
                          return (
                            <Button
                              key={`page-${pageNum}`}
                              variant={isActive ? "default" : "outline"}
                              size="sm"
                              className={`h-8 min-w-8 px-2.5 rounded-xl text-xs font-black transition-all ${
                                isActive
                                  ? "bg-blue-900 text-white hover:bg-blue-950 shadow-xs"
                                  : "border-slate-200 text-slate-700 hover:bg-white"
                              }`}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl border-slate-200 hover:bg-white disabled:opacity-40"
                        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        title="Página siguiente"
                      >
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl border-slate-200 hover:bg-white disabled:opacity-40"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        title="Última página"
                      >
                        <ChevronsRight className="h-4 w-4 text-slate-600" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'consolidated' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-sm font-black text-blue-900 uppercase tracking-widest">Matriz Consolidada de Demanda y Entregas</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Balance exacto entre lo solicitado y lo entregado físicamente</CardDescription>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="BUSCAR INSUMO..."
                      className="pl-9 pr-7 h-8 bg-white text-[10px] font-bold border-slate-200 uppercase tracking-widest"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Selector de lote para consolidado */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 h-8">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Lote:</span>
                    <Select 
                      value={String(consolidatedPageSize)} 
                      onValueChange={(v) => setConsolidatedPageSize(Number(v))}
                    >
                      <SelectTrigger className="h-6 w-16 border-none bg-transparent shadow-none text-[10px] font-black p-0 focus:ring-0 text-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25" className="text-xs font-bold">25</SelectItem>
                        <SelectItem value="50" className="text-xs font-bold">50</SelectItem>
                        <SelectItem value="100" className="text-xs font-bold">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportConsolidatedCsv}
                    className="h-8 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-black uppercase tracking-wider rounded-xl gap-1"
                    title="Exportar balance consolidado a CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CSV Balance</span>
                  </Button>
                </div>
              </div>

              {/* Filtros Rápidos de Categoría del Consolidado */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60">
                {[
                  { id: 'all', label: 'Todos los Insumos' },
                  { id: 'medication', label: '💊 Fármacos' },
                  { id: 'technical_aid', label: '♿ Ayudas Humanas' },
                  { id: 'medical_supply', label: '📦 Insumos Médicos' }
                ].map((catTab) => {
                  const isActive = consolidatedCategoryFilter === catTab.id;
                  return (
                    <button
                      key={catTab.id}
                      type="button"
                      onClick={() => {
                        setConsolidatedCategoryFilter(catTab.id as any);
                        setConsolidatedPage(1);
                      }}
                      className={`text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-lg border transition-all ${
                        isActive
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {catTab.label}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50 text-blue-600" />
                  <p className="text-[10px] font-bold uppercase tracking-widest italic">Consolidando datos...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div ref={consolidatedTableTopRef} />
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 border-b border-slate-100 italic">
                        <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500">Insumo / Principio Activo</TableHead>
                        <TableHead className="px-4 py-3.5 text-[10px] uppercase font-black text-slate-500">Presentación</TableHead>
                        <TableHead className="px-4 py-3.5 text-[10px] uppercase font-black text-blue-900 text-center">Solicitado</TableHead>
                        <TableHead className="px-4 py-3.5 text-[10px] uppercase font-black text-emerald-800 text-center">Entregado</TableHead>
                        <TableHead className="px-4 py-3.5 text-[10px] uppercase font-black text-amber-800 text-center">Pendiente</TableHead>
                        <TableHead className="px-5 py-3.5 text-[10px] uppercase font-black text-slate-500 text-right">Efectividad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRequirements.map((med, i) => {
                        const fulfillment = med.totalRequested > 0 
                          ? Math.round((med.totalDelivered / med.totalRequested) * 100) 
                          : 0;
                        const isAid = med.category === 'technical_aid';
                        const isSupply = med.category === 'medical_supply';

                        return (
                          <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                            <TableCell className="px-5 py-3.5">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${
                                    isAid ? 'bg-amber-500' : (isSupply ? 'bg-indigo-500' : 'bg-emerald-500')
                                  }`} />
                                  <span className="font-black text-slate-900 uppercase text-xs tracking-tight">
                                    {med.medication}
                                  </span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 ml-3.5">
                                  {isAid ? 'Ayuda Humana' : (isSupply ? 'Insumo Descartable' : 'Fármaco')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3.5">
                              <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-100/80 px-2 py-0.5 rounded">
                                {med.presentation}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-center">
                              <span className="font-black text-blue-900 text-xs">
                                {med.totalRequested.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-center">
                              {med.totalDelivered > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportItemQuery(med.medication);
                                    setIsItemReportOpen(true);
                                  }}
                                  className="font-black text-emerald-800 text-xs bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 transition-all cursor-pointer inline-flex items-center gap-1 group shadow-2xs"
                                  title={`Ver personas beneficiadas con ${med.medication}`}
                                >
                                  <span>{med.totalDelivered.toLocaleString()}</span>
                                  <ArrowUpRight className="w-3 h-3 text-emerald-600 opacity-60 group-hover:opacity-100" />
                                </button>
                              ) : (
                                <span className="font-black text-slate-400 text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  0
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-center">
                              <span className={`font-black text-xs px-2 py-0.5 rounded border ${
                                med.totalPending > 0 ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100'
                              }`}>
                                {med.totalPending.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`text-[10px] font-black ${
                                  fulfillment === 100 ? 'text-emerald-700' : (fulfillment > 0 ? 'text-blue-800' : 'text-slate-400')
                                }`}>
                                  {fulfillment}%
                                </span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                  <div 
                                    className={`h-full rounded-full ${
                                      fulfillment === 100 ? 'bg-emerald-500' : (fulfillment > 0 ? 'bg-blue-600' : 'bg-slate-300')
                                    }`}
                                    style={{ width: `${fulfillment}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredRequirements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic text-xs uppercase font-bold">
                            Sin insumos registrados con los filtros aplicados.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Paginación de Consolidado */}
                  {totalConsolidatedCount > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-slate-200 bg-slate-50/60">
                      <div className="text-[11px] text-slate-500 font-medium">
                        Mostrando <span className="font-bold text-slate-800">{(consolidatedPage - 1) * consolidatedPageSize + 1}</span> a <span className="font-bold text-slate-800">{Math.min(consolidatedPage * consolidatedPageSize, totalConsolidatedCount)}</span> de <span className="font-bold text-slate-800">{totalConsolidatedCount}</span> insumos
                      </div>

                      <div className="flex items-center space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-white disabled:opacity-40"
                          onClick={() => setConsolidatedPage(1)}
                          disabled={consolidatedPage === 1}
                          title="Primera página"
                        >
                          <ChevronsLeft className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-white disabled:opacity-40"
                          onClick={() => setConsolidatedPage(p => Math.max(p - 1, 1))}
                          disabled={consolidatedPage === 1}
                          title="Página anterior"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
                        </Button>

                        <div className="flex items-center gap-1">
                          {getPageNumbers(consolidatedPage, totalConsolidatedPages).map((p, idx) => {
                            if (p === '...') {
                              return (
                                <span key={`c-dots-${idx}`} className="px-1 text-slate-400 font-bold text-xs">
                                  ...
                                </span>
                              );
                            }
                            const pageNum = p as number;
                            const isActive = consolidatedPage === pageNum;
                            return (
                              <Button
                                key={`c-page-${pageNum}`}
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                className={`h-7 min-w-7 px-2 rounded-lg text-xs font-bold ${
                                  isActive
                                    ? "bg-blue-900 text-white hover:bg-blue-950"
                                    : "border-slate-200 text-slate-600 hover:bg-white"
                                }`}
                                onClick={() => setConsolidatedPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-white disabled:opacity-40"
                          onClick={() => setConsolidatedPage(p => Math.min(p + 1, totalConsolidatedPages))}
                          disabled={consolidatedPage === totalConsolidatedPages}
                          title="Página siguiente"
                        >
                          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-white disabled:opacity-40"
                          onClick={() => setConsolidatedPage(totalConsolidatedPages)}
                          disabled={consolidatedPage === totalConsolidatedPages}
                          title="Última página"
                        >
                          <ChevronsRight className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                  <Pill className="w-24 h-24" />
               </div>
               <div className="relative z-10 space-y-3">
                  <h4 className="font-black text-sm uppercase tracking-wider text-slate-400">Orden de Suministro</h4>
                  <p className="text-lg font-black leading-tight">¿Desea generar una Orden de Suministro consolidada para el próximo operativo?</p>
                  <p className="text-xs text-slate-300 leading-normal font-medium opacity-80">El sistema exportará un reporte unificado con todas las cantidades requeridas.</p>
                  <div className="pt-2">
                     <Button 
                       onClick={() => {
                         toast.success("Orden Generada", { description: "Se ha preparado el listado de requerimientos." });
                       }}
                       size="sm" 
                       className="bg-emerald-600 border border-emerald-500 hover:bg-emerald-750 text-white font-black uppercase text-[10px] px-6 h-9 rounded-xl shadow-lg"
                     >
                       Generar Orden de Suministro
                     </Button>
                  </div>
               </div>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900 to-indigo-950 border border-blue-800 text-white rounded-2xl p-6 relative overflow-hidden">
               <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-300" />
                    <h4 className="font-black text-sm uppercase tracking-wider text-blue-200">Red Pública de Salud</h4>
                  </div>
                  <p className="text-sm font-bold leading-snug">Consulte en tiempo real la matriz de 6 centros asistenciales y 20 especialidades médicas.</p>
                  <Button 
                    onClick={() => setIsMatrixModalOpen(true)}
                    size="sm"
                    className="bg-white hover:bg-blue-50 text-blue-950 font-black uppercase text-[10px] px-5 h-9 rounded-xl shadow-md gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Consultar Matriz de Derivación
                  </Button>
               </div>
            </Card>
          </div>
        </div>
      )}

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
                    <p className="text-[9px] uppercase font-bold text-slate-400">Paciente</p>
                    <p className="font-bold text-slate-800 uppercase mt-0.5">{getWorkerName(selectedRecipeForView.workerId)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Cédula de Identidad</p>
                    <p className="font-bold text-slate-800 uppercase mt-0.5">{getWorkerDni(selectedRecipeForView.workerId)}</p>
                  </div>
                  <div className="col-span-2 border-t border-slate-100 pt-2 mt-1">
                    <p className="text-[9px] uppercase font-bold text-slate-400">Detalle del Requerimiento</p>
                    <p className="font-bold text-blue-900 mt-0.5 uppercase">
                      {selectedRecipeForView.requiresTechnicalAid 
                        ? `${selectedRecipeForView.technicalAidType || "Ayuda Humana"}` 
                        : `${selectedRecipeForView.medication} - ${selectedRecipeForView.presentation}`}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">
                      Cantidad: {selectedRecipeForView.requiresTechnicalAid ? selectedRecipeForView.technicalAidQuantity : selectedRecipeForView.quantity} unidades
                    </p>
                  </div>

                  {selectedRecipeForView.isDeliveredToRepresentative && (
                    <div className="col-span-2 border-t border-slate-100 pt-2.5 mt-1 bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                      <p className="text-[9px] uppercase font-black text-blue-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-700" />
                        Retiro por Representante Legal / Familiar Autorizado
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5 text-slate-800">
                        <div>
                          <span className="text-[8px] uppercase font-bold text-slate-400 block">Nombre del Representante</span>
                          <span className="font-bold text-xs uppercase">{selectedRecipeForView.representativeFullName || "No indicado"}</span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase font-bold text-slate-400 block">Cédula de Identidad (C.I.)</span>
                          <span className="font-bold text-xs">{selectedRecipeForView.representativeDni || "S/D"}</span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase font-bold text-slate-400 block">Vínculo / Parentesco</span>
                          <span className="font-bold text-xs uppercase">{selectedRecipeForView.representativeRelationship || "Apoderado"}</span>
                        </div>
                        {selectedRecipeForView.representativePhone && (
                          <div className="col-span-2 sm:col-span-3 pt-1 border-t border-blue-200/50">
                            <span className="text-[8px] uppercase font-bold text-slate-400">Teléfono de Contacto: </span>
                            <span className="font-bold text-xs text-blue-950">{selectedRecipeForView.representativePhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

      {/* Modal de Ciudadanos en Censo Sin Requerimiento Registrado */}
      <NoRequirementsModal
        isOpen={isNoReqModalOpen}
        onOpenChange={setIsNoReqModalOpen}
        workersWithoutRequirements={workersWithoutRequirements}
        totalWorkersCount={workers.length}
        onSelectWorkerForRecipe={(worker) => {
          setPreselectedWorkerForRecipe(worker);
          setIsNoReqModalOpen(false);
          setIsDialogOpen(true);
        }}
      />

      {/* Modal de Edición y Corrección de Fármacos / Insumos (Solo Administrador) */}
      <EditMedicationDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setRecipeToEdit(null);
        }}
        recipe={recipeToEdit}
        workers={workers}
        isAdmin={isAdmin}
        onSaved={fetchData}
      />

      {/* Modal In-App de Confirmación de Eliminación (Sin window.confirm) */}
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setRecipeToDelete(null);
        }}
        onConfirm={confirmDeleteRecipe}
        isDeleting={isDeleting}
        title="¿Eliminar Solicitud o Fármaco?"
        description="Esta acción eliminará de forma permanente este requerimiento de la base de datos municipal y recalculará los indicadores del sistema."
        itemDetails={recipeToDelete ? [
          { label: "Beneficiario", value: workers.find(w => w.id === recipeToDelete.workerId)?.fullName || "Titular" },
          { label: "Cédula", value: workers.find(w => w.id === recipeToDelete.workerId)?.dni || "S/D" },
          { label: "Insumo / Fármaco", value: recipeToDelete.medication },
          { label: "Cantidad", value: `${recipeToDelete.quantity || recipeToDelete.technicalAidQuantity || 1} un.` },
          { label: "Estado Actual", value: recipeToDelete.status === 'delivered' ? "Entregado" : "Pendiente" }
        ] : []}
      />

      {/* Modal de Extracción Nominal de Beneficiarios por Ítem / Fármaco */}
      <ItemBeneficiariesReportModal
        isOpen={isItemReportOpen}
        onClose={() => setIsItemReportOpen(false)}
        recipes={recipes}
        workers={workers}
        initialItemQuery={reportItemQuery}
      />
    </div>
  );
}
