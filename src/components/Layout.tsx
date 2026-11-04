import React from 'react';
import { 
  BarChart3, 
  Users, 
  Pill, 
  Settings,
  LogOut,
  LayoutDashboard,
  Search,
  RefreshCw,
  MessageSquare,
  HeartPulse
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
  SidebarProvider,
  useSidebar
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Logo } from './Logo';

export function AppSidebar() {
  const { user, logout, isAdmin, isEditor, isSuperAdmin } = useAuth();
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();

  const menuItems = [
    { title: "Dashboard Gestión", icon: LayoutDashboard, path: "/", adminOnly: true },
    { title: "Expediente de Salud", icon: Users, path: "/workers" },
    { title: "Farmacia", icon: Pill, path: "/medications", editorAllowed: true },
    { title: "Semáforo y Reposición", icon: HeartPulse, path: "/chronic-alerts", editorAllowed: true },
    { title: "Difusión WhatsApp", icon: MessageSquare, path: "/whatsapp-broadcast", editorAllowed: true },
    { title: "Métricas e Impacto Territorial", icon: BarChart3, path: "/stats", adminOnly: true },
    { title: "Gestión de Usuarios", icon: Settings, path: "/users", adminOnly: true },
  ];

  const filteredItems = menuItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.editorAllowed) return isEditor;
    return true;
  });

  return (
    <Sidebar variant="none" collapsible="icon" className="bg-gradient-to-b from-blue-950 via-slate-900 to-indigo-950 border-r border-blue-500/20 shadow-2xl text-slate-100">
      <SidebarHeader className="p-4 sm:p-5 border-b border-blue-400/20">
        <div className="flex items-center justify-center group-data-[collapsible=icon]:justify-center w-full">
          <Logo variant="full" size="sidebar" logoType="gestion-social" className="group-data-[collapsible=icon]:hidden w-full flex justify-center" />
          <div className="hidden group-data-[collapsible=icon]:block">
            <Logo variant="icon" size="sm" logoType="gestion-social" />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-3 sm:p-4">
        <SidebarMenu className="gap-1.5">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/stats' && location.pathname === '/territories');
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  render={
                    <Link 
                      to={item.path} 
                      className="flex items-center gap-3"
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-cyan-400"}`} />
                      <span className="text-sm font-semibold tracking-wide">{item.title}</span>
                    </Link>
                  }
                  isActive={isActive}
                  tooltip={item.title}
                  className={`py-5 transition-all rounded-xl ${
                    isActive 
                      ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30" 
                      : "text-blue-100/80 hover:bg-blue-900/60 hover:text-white"
                  }`}
                />
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-0">
        <div className="p-4 sm:p-5 border-t border-blue-400/20 bg-blue-950/90">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="gap-3 group-data-[collapsible=icon]:justify-center hover:bg-transparent">
                <Avatar className="w-9 h-9 rounded-full border border-blue-400/30 shadow-sm">
                  <AvatarImage src={user?.photoURL} />
                  <AvatarFallback className="bg-blue-600 text-white font-bold">{user?.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                  <span className="text-xs font-bold text-white">{user?.fullName || "Usuario"}</span>
                  {isSuperAdmin ? (
                    <span className="text-[10px] text-amber-300 font-black tracking-wide uppercase flex items-center gap-1">
                      ★ SUPER ADMIN
                    </span>
                  ) : user?.role === 'admin' ? (
                    <span className="text-[10px] text-cyan-300 font-semibold uppercase">Administrador</span>
                  ) : (
                    <span className="text-[10px] text-emerald-300 font-semibold uppercase">Editor</span>
                  )}
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className="mt-2">
              <SidebarMenuButton onClick={logout} className="text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 rounded-xl transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Cerrar Sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isRefreshing, refreshData } = useData();

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-slate-50 w-full overflow-hidden text-slate-800 font-sans">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-14 sm:h-16 bg-white/95 backdrop-blur-md border-b border-blue-100 flex items-center justify-between px-3 sm:px-5 md:px-6 shadow-xs shrink-0 z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger className="text-slate-600 hover:bg-blue-50 hover:text-blue-700 h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-lg transition-colors" />
              <Logo variant="header" size="header" logoType="alcaldia" className="shrink-0" />
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
              <div className="relative hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar Cédula o Nombre..."
                  className="bg-slate-100 border-slate-300 rounded-md py-1.5 pl-9 pr-3 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 border h-8"
                />
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => refreshData(true)}
                disabled={isRefreshing}
                title="Sincronizar datos con la base de datos"
                className="h-8 text-xs font-semibold text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-1.5 rounded-lg px-2.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </Button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-slate-50 p-2.5 sm:p-4 md:p-5 space-y-3.5 sm:space-y-4">
            <div className="max-w-[1400px] w-full mx-auto space-y-3.5 sm:space-y-4 pb-8">
              {children}
            </div>
          </div>

          {/* Footer */}
          <footer className="bg-slate-100 border-t border-slate-200 h-8 flex items-center px-4 sm:px-6 justify-between text-[10px] text-slate-400 font-medium italic shrink-0">
            <span className="truncate">Alcaldía Bolivariana de Sotillo &copy; 2026 - Sistema de Gestión Social</span>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
