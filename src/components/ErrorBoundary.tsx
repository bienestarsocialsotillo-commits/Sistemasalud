import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[350px] w-full p-6 sm:p-8 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 shadow-sm my-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-black uppercase text-slate-800 tracking-tight">
                {this.props?.fallbackTitle || "Ocurrió una interrupción al cargar esta sección"}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                La aplicación protegió la sesión para evitar la pérdida de datos.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-left text-[11px] font-mono text-slate-600 max-h-28 overflow-y-auto">
                <span className="font-bold text-rose-600">{this.state.error.name}: </span>
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar Carga
              </Button>
              <Button
                variant="outline"
                onClick={this.handleReset}
                className="border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider h-10 rounded-xl gap-2 cursor-pointer hover:bg-slate-100"
              >
                <RefreshCw className="w-4 h-4 text-blue-700" />
                Recargar Sistema
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="text-slate-600 font-bold text-xs uppercase tracking-wider h-10 rounded-xl gap-2 cursor-pointer hover:bg-slate-100"
              >
                <Home className="w-4 h-4" />
                Ir al Inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props?.children;
  }
}

export default ErrorBoundary;
