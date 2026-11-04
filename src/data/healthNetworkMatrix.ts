export interface HealthCenter {
  id: string;
  name: string;
  shortName: string;
  type: string;
  badgeColor?: string;
  isConvenio?: boolean;
}

export type ServiceAvailability = 'DISPONIBLE' | 'NO DISPONIBLE' | 'ESPECIALIZADO';

export interface ServiceMatrixItem {
  id: string;
  name: string;
  category: 'general' | 'specialty' | 'diagnostics' | 'emergency' | 'social_program';
  availability: Record<string, ServiceAvailability>;
}

export const HEALTH_CENTERS: HealthCenter[] = [
  {
    id: 'jesus_nazareth',
    name: 'Clínica Jesús de Nazareth',
    shortName: 'Jesús de Nazareth',
    type: 'Clínica Municipal Sotillo',
  },
  {
    id: 'ivss_guaraguao',
    name: 'IVSS Guaraguao',
    shortName: 'IVSS Guaraguao',
    type: 'Hospital del Seguro Social',
  },
  {
    id: 'ambulatorio_guanire',
    name: 'Ambulatorio Guanire Puerto La Cruz',
    shortName: 'Amb. Guanire PLC',
    type: 'Ambulatorio Urbano',
  },
  {
    id: 'clinica_municipal_sotillo',
    name: 'Clínica Municipal (Salud Sotillo)',
    shortName: 'Salud Sotillo',
    type: 'Clínica Municipal Sotillo',
  },
  {
    id: 'ivss_las_garzas',
    name: 'IVSS Las Garzas',
    shortName: 'IVSS Las Garzas',
    type: 'Centro Asistencial IVSS',
  },
  {
    id: 'hospital_razetti',
    name: 'Hospital Universitario Dr. Luis Razetti',
    shortName: 'Hospital Razetti',
    type: 'Hospital Universitario Tipo IV',
  },
  {
    id: 'asic_fogade',
    name: 'ASIC Fogade (CDI Fabricio Ojeda)',
    shortName: 'ASIC Fogade',
    type: 'Centro Comunal ASIC / CDI',
  },
  {
    id: 'asic_la_tecnica',
    name: 'ASIC La Técnica',
    shortName: 'ASIC La Técnica',
    type: 'Centro Comunal ASIC',
  },
  {
    id: 'asic_cueva_guanire',
    name: 'ASIC Cueva de Guanire',
    shortName: 'ASIC Cueva de Guanire',
    type: 'Centro Comunal ASIC',
  },
  {
    id: 'asic_paraiso',
    name: 'ASIC Paraíso',
    shortName: 'ASIC Paraíso',
    type: 'Centro Comunal ASIC',
  },
  {
    id: 'clinica_santa_ana',
    name: 'Clínica Santa Ana',
    shortName: 'Clínica Santa Ana',
    type: 'Clínica en Convenio Institucional',
    isConvenio: true,
  },
  {
    id: 'other_convenio',
    name: 'Otra Clínica / Centro en Convenio',
    shortName: 'Otro Convenio',
    type: 'Centro Asistencial en Convenio Externo',
    isConvenio: true,
  },
];

export const SERVICES_MATRIX: ServiceMatrixItem[] = [
  {
    id: 'medicina_general',
    name: 'Medicina General',
    category: 'general',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'medicina_interna',
    name: 'Medicina Interna',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'traumatologia',
    name: 'Traumatología',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'pediatria',
    name: 'Pediatría',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'cirugia_general',
    name: 'Cirugía General',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'ginecologia',
    name: 'Ginecología',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'emergencia_adultos',
    name: 'Emergencia Adultos / Triaje',
    category: 'emergency',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'emergencia_ninos',
    name: 'Emergencia Niños / Pediatría',
    category: 'emergency',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'laboratorio',
    name: 'Laboratorio',
    category: 'diagnostics',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'rayos_x',
    name: 'Rayos X (RX)',
    category: 'diagnostics',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'ecosonografia',
    name: 'Ecosonografía / Eco',
    category: 'diagnostics',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'hospitalizacion',
    name: 'Hospitalización',
    category: 'emergency',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'terapia_intensiva',
    name: 'Terapia Intensiva / Apoyo Vital',
    category: 'emergency',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'control_prenatal',
    name: 'Control Prenatal / Salud Familia',
    category: 'social_program',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'inmunizacion',
    name: 'Inmunización (Vacunas)',
    category: 'social_program',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'NO DISPONIBLE',
      other_convenio: 'NO DISPONIBLE',
    }
  },
  {
    id: 'fisiatria',
    name: 'Fisiatría / Rehabilitación (SRI)',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'fonoaudiologia',
    name: 'Fonoaudiología / Foniatría',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'oftalmologia',
    name: 'Oftalmología / Salud Visual',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'odontologia',
    name: 'Odontología / Salud Bucal',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'nutricion',
    name: 'Nutrición',
    category: 'social_program',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'salud_mental',
    name: 'Salud Mental / Psicopedagogía',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'its',
    name: 'ITS / VIH / SIDA',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'neurodesarrollo',
    name: 'Trastornos Neurodesarrollo',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'ESPECIALIZADO',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'ESPECIALIZADO',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'discapacidad_adulto',
    name: 'Discapacidad Adulto / DRSIPCD',
    category: 'social_program',
    availability: {
      jesus_nazareth: 'DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'DISPONIBLE',
      clinica_municipal_sotillo: 'DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'NO DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'neurocirugia',
    name: 'Neurocirugía',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'NO DISPONIBLE',
      asic_la_tecnica: 'NO DISPONIBLE',
      asic_cueva_guanire: 'NO DISPONIBLE',
      asic_paraiso: 'NO DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
  {
    id: 'oncologia',
    name: 'Oncología / Oncología Infantil',
    category: 'specialty',
    availability: {
      jesus_nazareth: 'NO DISPONIBLE',
      ivss_guaraguao: 'NO DISPONIBLE',
      ambulatorio_guanire: 'NO DISPONIBLE',
      clinica_municipal_sotillo: 'NO DISPONIBLE',
      ivss_las_garzas: 'NO DISPONIBLE',
      hospital_razetti: 'DISPONIBLE',
      asic_fogade: 'DISPONIBLE',
      asic_la_tecnica: 'DISPONIBLE',
      asic_cueva_guanire: 'DISPONIBLE',
      asic_paraiso: 'DISPONIBLE',
      clinica_santa_ana: 'DISPONIBLE',
      other_convenio: 'DISPONIBLE',
    }
  },
];

export function getCentersForService(serviceNameOrId: string) {
  const norm = (str: string) => str.toLowerCase().trim().replace(/[\(\)\/\-]/g, ' ');
  const target = norm(serviceNameOrId);

  const service = SERVICES_MATRIX.find(
    s => s.id === serviceNameOrId || norm(s.name) === target || norm(s.id) === target || s.name.toLowerCase().includes(serviceNameOrId.toLowerCase())
  );

  if (!service) return [];

  return HEALTH_CENTERS.map(center => {
    const status = service.availability[center.id] || 'NO DISPONIBLE';
    return {
      center,
      status,
      isAvailable: status === 'DISPONIBLE' || status === 'ESPECIALIZADO',
      isSpecialized: status === 'ESPECIALIZADO',
    };
  }).sort((a, b) => {
    // Sort available first, then specialized, then not available
    const score = (s: ServiceAvailability) => (s === 'DISPONIBLE' ? 2 : s === 'ESPECIALIZADO' ? 1 : 0);
    const scoreDiff = score(b.status) - score(a.status);
    if (scoreDiff !== 0) return scoreDiff;

    // Public / Municipal centers first if equal availability
    if (!a.center.isConvenio && b.center.isConvenio) return -1;
    if (a.center.isConvenio && !b.center.isConvenio) return 1;
    return 0;
  });
}
