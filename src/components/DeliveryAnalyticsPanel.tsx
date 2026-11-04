import React, { useState, useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Pill, 
  Package, 
  CheckCircle, 
  Users, 
  Calendar, 
  TrendingUp, 
  MapPin, 
  UserX, 
  ArrowUpRight, 
  Sparkles,
  Accessibility,
  HeartHandshake,
  BarChart3
} from "lucide-react";
import { MedicationRecipe, Worker } from "@/types";
import { format, isSameDay, isAfter, subDays, startOfMonth } from "date-fns";

interface DeliveryAnalyticsPanelProps {
  deliveredRecipes: MedicationRecipe[];
  workers: Worker[];
  workersWithoutRequirementsCount: number;
  totalWorkersCount: number;
  onOpenNoReqModal: () => void;
}

const parseDateSafe = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (val?.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function DeliveryAnalyticsPanel({
  deliveredRecipes,
  workers,
  workersWithoutRequirementsCount,
  totalWorkersCount,
  onOpenNoReqModal
}: DeliveryAnalyticsPanelProps) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = subDays(todayStart, 6);
  const monthStart = startOfMonth(now);

  const filteredPeriodRecipes = useMemo(() => {
    if (period === 'all') return deliveredRecipes;
    return deliveredRecipes.filter(r => {
      const d = parseDateSafe(r.deliveredAt || r.createdAt);
      if (!d) return false;
      if (period === 'today') return isSameDay(d, now);
      if (period === 'week') return isAfter(d, weekStart) || isSameDay(d, weekStart);
      if (period === 'month') return isAfter(d, monthStart) || isSameDay(d, monthStart);
      return true;
    });
  }, [deliveredRecipes, period, weekStart, monthStart]);

  const periodPhysicalUnits = useMemo(() => {
    return filteredPeriodRecipes.reduce((acc, r) => {
      const qty = r.requiresTechnicalAid ? (Number(r.technicalAidQuantity) || 1) : (Number(r.quantity) || 1);
      return acc + qty;
    }, 0);
  }, [filteredPeriodRecipes]);

  const periodBeneficiaries = useMemo(() => {
    return new Set(filteredPeriodRecipes.map(r => r.workerId)).size;
  }, [filteredPeriodRecipes]);

  // Top 5 Medicamentos
  const topMeds = useMemo(() => {
    const map: Record<string, { units: number; count: number }> = {};
    filteredPeriodRecipes
      .filter(r => (r.category === 'medication' || (!r.category && !r.requiresTechnicalAid)) && r.medication)
      .forEach(r => {
        const key = `${r.medication} ${r.presentation ? `(${r.presentation})` : ''}`.trim();
        if (!map[key]) map[key] = { units: 0, count: 0 };
        map[key].count += 1;
        map[key].units += (Number(r.quantity) || 1);
      });
    return Object.entries(map)
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [filteredPeriodRecipes]);

  // Top 5 Ayudas Humanas e Insumos
  const topAids = useMemo(() => {
    const map: Record<string, { units: number; count: number }> = {};
    filteredPeriodRecipes
      .filter(r => r.category === 'technical_aid' || r.requiresTechnicalAid || r.category === 'medical_supply')
      .forEach(r => {
        const key = (r.technicalAidType || r.medication || "Ayuda Técnica").trim();
        const qty = r.requiresTechnicalAid ? (Number(r.technicalAidQuantity) || 1) : (Number(r.quantity) || 1);
        if (!map[key]) map[key] = { units: 0, count: 0 };
        map[key].count += 1;
        map[key].units += qty;
      });
    return Object.entries(map)
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [filteredPeriodRecipes]);

  // Top 4 Comunas con Mayor Despacho
  const topCommunes = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPeriodRecipes.forEach(r => {
      const w = workers.find(item => item.id === r.workerId);
      const commune = r.commune || w?.commune || "Sin Comuna";
      map[commune] = (map[commune] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([commune, count]) => ({ commune, count }));
  }, [filteredPeriodRecipes, workers]);

  const percentageWithoutReq = totalWorkersCount > 0 
    ? ((workersWithoutRequirementsCount / totalWorkersCount) * 100).toFixed(1) 
    : '0';

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl border border-blue-900/60 shadow-md overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-blue-800/40 bg-white/[0.02]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-sm font-black uppercase tracking-wider text-blue-100">
                Monitor Operativo de Despacho y Entregas Físicas
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-blue-200/70 font-medium mt-0.5">
              Consolidación en tiempo real del impacto en dependencias, ayudas técnicas entregadas y cobertura territorial.
            </CardDescription>
          </div>

          {/* Selector de Rango de Análisis */}
          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-blue-800/50">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                period === 'today' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-200 hover:text-white'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                period === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-200 hover:text-white'
              }`}
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                period === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-200 hover:text-white'
              }`}
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                period === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-200 hover:text-white'
              }`}
            >
              Histórico
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Fila de Micro-Métricas del Período */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-300 block">
              Volumen Físico Despachado
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{periodPhysicalUnits}</span>
              <span className="text-[10px] font-bold text-slate-300 uppercase">unidades</span>
            </div>
            <span className="text-[9px] text-blue-200/60 font-medium">
              Pastillas, cajas y ayudas técnicas
            </span>
          </div>

          <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-300 block">
              Beneficiarios Atendidos
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{periodBeneficiaries}</span>
              <span className="text-[10px] font-bold text-slate-300 uppercase">personas</span>
            </div>
            <span className="text-[9px] text-blue-200/60 font-medium">
              Con entrega efectiva en el período
            </span>
          </div>

          <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-300 block">
              Actas de Entrega Procesadas
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{filteredPeriodRecipes.length}</span>
              <span className="text-[10px] font-bold text-slate-300 uppercase">solicitudes</span>
            </div>
            <span className="text-[9px] text-blue-200/60 font-medium">
              Registradas con soporte en dependencias
            </span>
          </div>

          {/* Métrica de Personas Sin Requerimiento con Botón */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                  Censo Sin Requerimiento
                </span>
                <Badge className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0">
                  {percentageWithoutReq}%
                </Badge>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-amber-200">{workersWithoutRequirementsCount}</span>
                <span className="text-[10px] font-bold text-amber-300/80 uppercase">de {totalWorkersCount}</span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onOpenNoReqModal}
              className="mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase text-[9px] h-7 px-2.5 rounded-lg shadow-2xs gap-1 w-full"
            >
              <UserX className="w-3 h-3 text-slate-950" />
              <span>Ver Listado y Abordaje</span>
            </Button>
          </div>
        </div>

        {/* Paneles de Desglose: Fármacos, Ayudas y Territorios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Top Fármacos */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-blue-300">
              <Pill className="w-4 h-4 text-emerald-400" />
              <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Top 5 Fármacos Entregados</h4>
            </div>
            {topMeds.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Sin entregas de fármacos en este período</p>
            ) : (
              <div className="space-y-1.5">
                {topMeds.map((m, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-white/[0.04] p-2 rounded-lg">
                    <span className="text-slate-200 font-bold uppercase truncate max-w-[170px]" title={m.name}>
                      {idx + 1}. {m.name}
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-none font-black text-[10px] shrink-0">
                      {m.units} un.
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Ayudas Humanas e Insumos */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-blue-300">
              <Accessibility className="w-4 h-4 text-amber-400" />
              <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Top Ayudas e Insumos</h4>
            </div>
            {topAids.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Sin entregas de ayudas técnicas en este período</p>
            ) : (
              <div className="space-y-1.5">
                {topAids.map((a, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-white/[0.04] p-2 rounded-lg">
                    <span className="text-slate-200 font-bold uppercase truncate max-w-[170px]" title={a.name}>
                      {idx + 1}. {a.name}
                    </span>
                    <Badge className="bg-amber-500/20 text-amber-300 border-none font-black text-[10px] shrink-0">
                      {a.units} un.
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Despacho por Territorio */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-blue-300">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Comunas de Mayor Cobertura</h4>
            </div>
            {topCommunes.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Sin registros comunales en este período</p>
            ) : (
              <div className="space-y-1.5">
                {topCommunes.map((c, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-white/[0.04] p-2 rounded-lg">
                    <span className="text-slate-200 font-bold uppercase truncate max-w-[170px]" title={c.commune}>
                      {idx + 1}. {c.commune}
                    </span>
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-none font-black text-[10px] shrink-0">
                      {c.count} despachos
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
