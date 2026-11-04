import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Pill, 
  MapPin, 
  ShieldCheck, 
  Users, 
  Building2, 
  CheckCircle2, 
  MessageSquare,
  Sparkles,
  Database,
  WifiOff,
  Lock,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const HEADER_LOGO_SOURCES = [
  "/logos/logo-alcaldia.png",
  "/Logo-alcaldia.png",
  "/logos/Logo-alcaldia.png",
  "/logo-alcaldia.png",
  "/logo_sotillo_oficial.jpg",
  "/Logo_Social.png"
];

const CARD_LOGO_SOURCES = [
  "/logos/logo-gestion-social.png",
  "/logo-gestion-social.png",
  "/Logo-alcaldia.png",
  "/logos/logo-alcaldia.png",
  "/Logo_Social.png",
  "/logo_social.png"
];

export default function LoginPage() {
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Índices de respaldo para logotipos
  const [headerLogoIdx, setHeaderLogoIdx] = useState(0);
  const [cardLogoIdx, setCardLogoIdx] = useState(0);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
    } catch {
      toast.error('No se pudo completar el inicio de sesión. Verifique su cuenta institucional.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between text-slate-100 font-sans selection:bg-blue-500 selection:text-white bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 overflow-x-hidden">
      
      {/* FONDO AMBIENTAL EJECUTIVO CON MALLA SUTIL Y RESPLANDOR CIAN */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <svg 
          className="absolute inset-0 w-full h-full object-cover opacity-20" 
          viewBox="0 0 1440 900" 
          preserveAspectRatio="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M 0,220 C 320,120 420,320 720,240 C 1020,160 1180,290 1440,210 L 1440,0 L 0,0 Z" 
            fill="#3B82F6" 
            opacity="0.3" 
          />
          <path 
            d="M 0,520 C 360,420 540,640 880,510 C 1140,410 1280,580 1440,490 L 1440,0 L 0,0 Z" 
            fill="#06B6D4" 
            opacity="0.2" 
          />
          <path 
            d="M 0,780 C 280,680 520,860 840,730 C 1160,610 1290,810 1440,720 L 1440,900 L 0,900 Z" 
            fill="#1D4ED8" 
            opacity="0.3" 
          />
        </svg>

        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-1/3 w-[36rem] h-[36rem] bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 1. BARRA SUPERIOR INSTITUCIONAL */}
      <header className="w-full bg-blue-950/85 backdrop-blur-lg border-b border-blue-400/20 px-4 sm:px-8 py-3.5 z-30 sticky top-0 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5 sm:gap-4 shrink-0">
            <div className="h-12 sm:h-14 md:h-16 w-auto min-w-[100px] sm:min-w-[140px] md:min-w-[170px] max-w-[240px] rounded-xl bg-white p-1.5 shadow-lg border border-white/40 flex items-center justify-center shrink-0 transition-transform hover:scale-105">
              <img 
                src={HEADER_LOGO_SOURCES[headerLogoIdx] || "/Logo_Social.png"} 
                alt="Alcaldía Bolivariana de Sotillo" 
                onError={() => setHeaderLogoIdx((prev) => (prev + 1 < HEADER_LOGO_SOURCES.length ? prev + 1 : prev))}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex flex-col justify-center border-l border-blue-400/30 pl-3 sm:pl-4">
              <h1 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-white leading-tight">
                Alcaldía Bolivariana del Municipio Juan Antonio Sotillo
              </h1>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-cyan-300 mt-0.5">
                <span>Dirección de Bienestar Social</span>
                <span aria-hidden="true" className="text-blue-400">·</span>
                <span>Puerto La Cruz, Estado Anzoátegui</span>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* 2. ÁREA PRINCIPAL: PANEL DIVIDIDO EN 12 COLUMNAS (SPLIT SCREEN) */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center my-auto">
        
        {/* PANEL IZQUIERDO (7 Columnas): IDENTIDAD INSTITUCIONAL, AUTORIDADES Y MÉTRICAS */}
        <div className="lg:col-span-7 flex flex-col gap-5 order-2 lg:order-1">
          
          {/* Tarjeta de Honor Institucional y Autoridades */}
          <div className="p-6 sm:p-7 rounded-3xl bg-blue-950/60 backdrop-blur-md border border-blue-400/25 shadow-2xl space-y-4">
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-300">
                <Building2 className="w-3.5 h-3.5" />
                <span>Gestión de Gobierno Municipal · Puerto La Cruz</span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-white leading-tight">
                Sistema Integral de Gestión y Protección Social
              </h2>
            </div>

            {/* Mención de Autoridades Oficiales */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/60 to-indigo-950/60 border border-blue-400/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider block">
                  Liderazgo y Conducción Municipal:
                </span>
                <p className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                  Prof. Jesús Marcano Tábata &bull; <span className="text-cyan-300 font-bold">Alcalde</span>
                </p>
                <p className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wide">
                  Ing. Yohana Estaba de Marcano &bull; <span className="text-indigo-300 font-bold">Primera Dama</span>
                </p>
              </div>

              <div className="hidden sm:flex flex-col items-end text-right border-l border-blue-400/20 pl-4 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  1x10 del Buen Gobierno
                </span>
                <span className="text-[11px] text-blue-200 font-medium">
                  Atención Directa al Pueblo
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Plataforma tecnológica oficial para el registro unificado de expedientes de salud,
              dispensación controlada de medicamentos, canalización de ayudas técnicas y convocatoria
              asistida a las familias de las 21 Comunas de Sotillo.
            </p>
          </div>

          {/* CUADRÍCULA DE INDICADORES CLAVE (4 BLOQUES EJECUTIVOS) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            <div className="p-3.5 rounded-2xl bg-blue-950/70 backdrop-blur-md border border-blue-400/20 flex flex-col justify-between shadow-lg hover:border-cyan-400/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-cyan-300">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono font-black text-cyan-300">100%</span>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-black text-white leading-none">21 Comunas</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mt-1">Cobertura Territorial</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-950/70 backdrop-blur-md border border-blue-400/20 flex flex-col justify-between shadow-lg hover:border-cyan-400/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono font-black text-emerald-400">Digital</span>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-black text-white leading-none">Expedientes</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mt-1">Salud y Familia</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-950/70 backdrop-blur-md border border-blue-400/20 flex flex-col justify-between shadow-lg hover:border-cyan-400/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300">
                  <Pill className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono font-black text-purple-300">Actas</span>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-black text-white leading-none">Farmacia</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mt-1">Despacho y Récipe</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-950/70 backdrop-blur-md border border-blue-400/20 flex flex-col justify-between shadow-lg hover:border-cyan-400/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-300">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono font-black text-emerald-300">+58</span>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-black text-white leading-none">WhatsApp</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mt-1">Convocatoria Directa</p>
              </div>
            </div>

          </div>

          {/* PILARES ESTRATÉGICOS DEL SISTEMA */}
          <div className="p-4 sm:p-5 rounded-2xl bg-blue-950/50 backdrop-blur-sm border border-blue-400/20 space-y-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Garantías de Operatividad Gubernamental:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Trazabilidad Total</span>
                  <span className="text-[11px] text-slate-400">Actas firmadas y Libro Oficial con Cédula.</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <WifiOff className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Operatividad Offline</span>
                  <span className="text-[11px] text-slate-400">Censo en comunidades sin conexión y sincronización.</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Database className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Resguardo en la Nube</span>
                  <span className="text-[11px] text-slate-400">Almacenamiento seguro en base de datos Firestore.</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* PANEL DERECHO (5 Columnas): AUTENTICACIÓN EXCLUSIVA POR CUENTA GOOGLE */}
        <div className="lg:col-span-5 w-full relative order-1 lg:order-2">
          
          <div className="relative z-10 w-full bg-white text-slate-900 rounded-3xl shadow-2xl shadow-blue-950/80 border border-slate-200 p-6 sm:p-8 space-y-6">
            
            {/* Logotipo del Sistema con Encabezado */}
            <div className="flex flex-col items-center text-center">
              <div className="h-20 sm:h-24 w-auto min-w-[120px] max-w-[240px] rounded-2xl bg-slate-50 p-2.5 shadow-sm border border-slate-200 flex items-center justify-center mb-3 transition-transform hover:scale-105">
                <img 
                  src={CARD_LOGO_SOURCES[cardLogoIdx] || "/Logo_Social.png"} 
                  alt="Sistema de Gestión Social" 
                  onError={() => setCardLogoIdx((prev) => (prev + 1 < CARD_LOGO_SOURCES.length ? prev + 1 : prev))}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                Portal de Acceso Seguro
              </h3>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mt-0.5">
                Dirección de Bienestar Social · Sotillo
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1 max-w-xs">
                Acceso restringido para personal institucional y operadores de salud autorizados
              </p>
            </div>

            {/* Cuadro de Información de Seguridad */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Autenticación Institucional Única</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                El acceso a la plataforma se realiza exclusivamente a través de <strong>Cuenta Google Oficial</strong> con verificación de identidad y asignación de roles de seguridad.
              </p>
            </div>

            {/* BOTÓN PRINCIPAL EXCLUSIVO: GOOGLE AUTH */}
            <div className="space-y-3">
              <Button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full h-13 sm:h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-sm tracking-wide uppercase rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
              >
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <span>{isLoggingIn ? 'Verificando con Google...' : 'Acceder con Cuenta Google'}</span>
              </Button>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                  Identidad Verificada
                </span>
                <span>Rol auditado en tiempo real</span>
              </div>
            </div>

            {/* Protocolo de Control de Acceso y Gestión de Privilegios */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px] text-slate-600">
              <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider block">
                Políticas de Seguridad Institucional:
              </span>
              <ul className="space-y-1 text-slate-500 text-[10px]">
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Super Administrador: <strong>direccioncondominiossotillo@gmail.com</strong></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>El acceso de nuevos usuarios es evaluado según su perfil asignado en el sistema.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Cuentas bloqueadas por administración no podrán visualizar datos ni expedientes.</span>
                </li>
              </ul>
            </div>

            {/* Pie de Seguridad y Auditoría */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-semibold text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Acceso protegido con cifrado SSL y registro digital de auditoría</span>
            </div>

          </div>

        </div>

      </main>

      {/* 3. PIE DE PÁGINA INSTITUCIONAL */}
      <footer className="w-full bg-blue-950/85 backdrop-blur-md border-t border-blue-400/20 py-3 px-4 text-center text-xs text-blue-200/80 z-20">
        <p className="font-semibold tracking-wide">
          Alcaldía del Municipio Bolivariano Juan Antonio Sotillo &bull; Dirección de Bienestar Social &bull; Puerto La Cruz, Estado Anzoátegui
        </p>
      </footer>

    </div>
  );
}
