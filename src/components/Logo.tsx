import React, { useState } from 'react';
import { HeartHandshake } from 'lucide-react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'compact' | 'dual' | 'header';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'header' | 'sidebar';
  logoType?: 'gestion-social' | 'alcaldia' | 'auto';
  lightText?: boolean;
}

const GESTION_SOCIAL_CANDIDATES = [
  "/logos/logo-gestion-social.png",
  "/logo-gestion-social.png",
  "/Logo_Social.png",
  "/logo_social.png"
];

const ALCALDIA_CANDIDATES = [
  "/logos/logo-alcaldia.png",
  "/Logo-alcaldia.png",
  "/logos/Logo-alcaldia.png",
  "/logo-alcaldia.png",
  "/logo_sotillo_oficial.jpg"
];

export function Logo({ 
  className = "", 
  variant = 'full', 
  size, 
  logoType = 'auto',
  lightText = false 
}: LogoProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);

  // Determine candidates based on logoType or variant
  const activeCandidates = React.useMemo(() => {
    if (logoType === 'alcaldia' || (logoType === 'auto' && variant === 'header')) {
      return ALCALDIA_CANDIDATES;
    }
    return GESTION_SOCIAL_CANDIDATES;
  }, [logoType, variant]);

  const SocialIconBadge = ({ badgeSize = "md" }: { badgeSize?: "sm" | "md" | "lg" | "xl" | "header" | "sidebar" }) => {
    if (candidateIndex < activeCandidates.length) {
      const sizeClasses = {
        sm: "h-8 sm:h-9 w-8 sm:w-9 p-1 rounded-xl",
        sidebar: "h-16 sm:h-20 w-auto max-w-[180px] p-1.5 rounded-xl mx-auto",
        md: "h-10 sm:h-12 w-auto min-w-[40px] max-w-[180px] p-1.5 rounded-xl",
        header: "h-10 sm:h-12 md:h-13 w-auto max-w-[180px] sm:max-w-[240px] md:max-w-[280px] p-1 sm:p-1.5 rounded-xl",
        lg: "h-14 sm:h-16 w-auto min-w-[56px] max-w-[200px] p-1.5 rounded-xl",
        xl: "h-16 sm:h-20 w-auto min-w-[64px] max-w-[240px] p-2 rounded-xl"
      };
      return (
        <img 
          src={activeCandidates[candidateIndex]} 
          alt={logoType === 'alcaldia' ? "Alcaldía Bolivariana de Sotillo" : "Sistema de Gestión Social"} 
          onError={() => setCandidateIndex(prev => prev + 1)}
          className={`${sizeClasses[badgeSize]} object-contain shrink-0 bg-white shadow-sm border border-slate-200 transition-transform duration-200 hover:scale-105`}
          referrerPolicy="no-referrer"
        />
      );
    }

    const iconSizes = {
      sm: "w-5 h-5",
      sidebar: "w-7 h-7 sm:w-8 sm:h-8",
      md: "w-6 h-6",
      header: "w-7 h-7 sm:w-8 sm:h-8",
      lg: "w-8 h-8",
      xl: "w-10 h-10"
    };

    const containerSizes = {
      sm: "h-9 sm:h-10 w-9 sm:w-10 rounded-xl",
      sidebar: "h-20 sm:h-24 w-auto max-w-[190px] rounded-2xl mx-auto",
      md: "h-12 w-12 rounded-xl",
      header: "h-13 sm:h-16 w-13 sm:w-16 rounded-xl sm:rounded-2xl",
      lg: "h-16 w-16 rounded-2xl",
      xl: "h-20 w-20 rounded-2xl"
    };

    return (
      <div className={`${containerSizes[badgeSize]} bg-gradient-to-br from-cyan-500 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-md border border-white/20`}>
        <HeartHandshake className={iconSizes[badgeSize]} />
      </div>
    );
  };

  if (variant === 'dual') {
    return (
      <div className={`flex items-center gap-3.5 ${className}`}>
        <SocialIconBadge badgeSize={size || "lg"} />
        <div className="flex flex-col border-l border-white/20 pl-3.5 justify-center">
          <span className="text-xs sm:text-sm md:text-base font-extrabold uppercase tracking-wide text-white leading-tight">
            Sistema de Gestión Social
          </span>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 mt-0.5">
            Alcaldía Bolivariana de Sotillo
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'icon') {
    return <SocialIconBadge badgeSize={size || "sm"} />;
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center ${className}`}>
        <SocialIconBadge badgeSize={size || "sm"} />
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center ${className}`}>
        <SocialIconBadge badgeSize={size || "header"} />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <SocialIconBadge badgeSize={size || "md"} />
    </div>
  );
}





