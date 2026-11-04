import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Map as MapIcon, TrendingUp, Sparkles, Building2 } from 'lucide-react';
import Stats from './Stats';
import Territories from './Territories';

interface UnifiedAnalyticsProps {
  defaultTab?: 'metrics' | 'territories';
}

export default function UnifiedAnalytics({ defaultTab = 'metrics' }: UnifiedAnalyticsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<'metrics' | 'territories'>(
    tabParam === 'territories' || defaultTab === 'territories' ? 'territories' : 'metrics'
  );

  const handleTabChange = (tab: 'metrics' | 'territories') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Unified Master Header & Navigation */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-md uppercase">
                Consola Gerencial Unificada
              </span>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Alcaldía de Sotillo • Bienestar Social
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight uppercase">
              Métricas e Impacto Territorial
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Vigilancia epidemiológica, vulnerabilidad social, trazabilidad de farmacia y cobertura en las 21 comunas del Municipio Sotillo
            </p>
          </div>

          {/* Master View Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-xl self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('metrics')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'metrics'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-cyan-300" />
              <span>1. Métricas y Análisis Clínico</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('territories')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'territories'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <MapIcon className="w-4 h-4 text-emerald-300" />
              <span>2. Impacto Territorial (21 Comunas)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Rendering */}
      <div>
        {activeTab === 'metrics' ? (
          <Stats />
        ) : (
          <Territories />
        )}
      </div>
    </div>
  );
}
