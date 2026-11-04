/**
 * Utilidades para formateo telefónico venezolano, plantillas institucionales
 * y generación de enlaces de WhatsApp (wa.me) para la Alcaldía de Sotillo.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  rawDigits: string;
  internationalPhone: string;
  displayFormatted: string;
  errorReason?: string;
}

export interface WhatsAppTemplate {
  id: string;
  title: string;
  description: string;
  category: 'delivery' | 'social_thought' | 'audit' | 'representative' | 'custom';
  content: string;
}

/**
 * Normaliza un número telefónico venezolano al formato internacional de WhatsApp (+58).
 * Admite formatos como: 0414-123.4567, 04121234567, 4161234567, +584241234567, etc.
 */
export function formatVenezuelanPhoneForWhatsApp(phone?: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      rawDigits: '',
      internationalPhone: '',
      displayFormatted: 'Sin número registrado',
      errorReason: 'No posee número en la ficha'
    };
  }

  const upper = phone.toUpperCase().trim();
  if (
    upper === 'NO POSEE' || 
    upper === 'S/T' || 
    upper === 'N/A' || 
    upper === 'NINGUNO' || 
    upper === 'NO TIENE' ||
    upper === '0' ||
    upper === 'SIN NUMERO'
  ) {
    return {
      isValid: false,
      rawDigits: '',
      internationalPhone: '',
      displayFormatted: 'No posee teléfono',
      errorReason: 'Marcado expresamente como sin teléfono'
    };
  }

  // Extraer exclusivamente los dígitos
  let digits = phone.replace(/\D/g, '');

  if (!digits || digits.length < 7) {
    return {
      isValid: false,
      rawDigits: digits,
      internationalPhone: '',
      displayFormatted: phone,
      errorReason: 'Número con formato incompleto'
    };
  }

  // Si ya tiene prefijo 58
  if (digits.startsWith('58')) {
    if (digits.length === 12) {
      const code = digits.slice(2, 5);
      return {
        isValid: true,
        rawDigits: digits,
        internationalPhone: digits,
        displayFormatted: `+58 (${code}) ${digits.slice(5, 8)}-${digits.slice(8)}`
      };
    }
  }

  // Si comienza con 0 (ej: 04141234567 -> 11 dígitos)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // 10 dígitos (ej: 4141234567, 412..., 424..., 416..., 426...)
  if (digits.length === 10) {
    const international = `58${digits}`;
    const code = digits.slice(0, 3);
    return {
      isValid: true,
      rawDigits: international,
      internationalPhone: international,
      displayFormatted: `+58 (${code}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    };
  }

  // Línea fija local de Puerto La Cruz (7 dígitos -> código 281)
  if (digits.length === 7) {
    return {
      isValid: false,
      rawDigits: `58281${digits}`,
      internationalPhone: `58281${digits}`,
      displayFormatted: `0281-${digits.slice(0, 3)}-${digits.slice(3)} (Línea Fija)`,
      errorReason: 'Línea fija local sin soporte para WhatsApp móvil'
    };
  }

  // Otros números internacionales o no estándar
  if (digits.length > 10 && digits.length <= 15) {
    const international = digits.startsWith('58') ? digits : `58${digits}`;
    return {
      isValid: true,
      rawDigits: international,
      internationalPhone: international,
      displayFormatted: `+${international}`
    };
  }

  return {
    isValid: false,
    rawDigits: digits,
    internationalPhone: '',
    displayFormatted: phone,
    errorReason: 'Longitud de dígitos telefónicos no estándar'
  };
}

/**
 * Plantillas oficiales preconfiguradas para la gestión social municipal
 * en nombre del Alcalde Prof. Jesús Marcano Tábata y la Primera Dama Ing. Yohana Estaba de Marcano.
 */
export const OFFICIAL_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'notificacion_unificada_marcano',
    title: 'Convocatoria Oficial a Retiro de Beneficio (Recomendado)',
    description: 'Convocatoria institucional formal indicando el beneficio asignado, día, horario, lugar y requisitos en nombre del Alcalde Prof. Jesús Marcano Tábata y la Primera Dama Ing. Yohana Estaba de Marcano.',
    category: 'delivery',
    content: `🏛️ *ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO*
*Dirección de Bienestar Social • Puerto La Cruz*

¡Dios le bendiga y un fraternal saludo, estimado(a) *{NOMBRE}*!

En nombre de nuestro Alcalde, el *Prof. Jesús Marcano Tábata*, y de nuestra Primera Dama, la *Ing. Yohana Estaba de Marcano*, nos complace informarle que su solicitud social ha sido *APROBADA* y se encuentra programada para su entrega:

📦 *Beneficio Asignado:* {BENEFICIO}
🏘️ *Comuna / Sector:* {COMUNA} (Sector: {SECTOR})

📋 *DATOS DE LA CONVOCATORIA:*
🗓️ *Día de Retiro:* {FECHA}
⏰ *Horario de Atención:* 8:00 AM a 2:00 PM
📍 *Lugar:* Dirección de Bienestar Social (Edificio Municipal de la Alcaldía de Sotillo, Puerto La Cruz)

📑 *REQUISITOS A PRESENTAR:*
• Fotocopia legible de la Cédula de Identidad del beneficiario (C.I. {CEDULA}).
• En caso de medicamentos o insumos: Recipe o informe médico original.

Nuestra misión es estar siempre al lado de nuestro pueblo, gobernando con amor, vocación de servicio y llevando bienestar a cada hogar de Puerto La Cruz.

¡Le esperamos con la mayor calidez y afecto!

*Prof. Jesús Marcano Tábata* — Alcalde
*Ing. Yohana Estaba de Marcano* — Primera Dama
*¡Sotillo Bonito, Humano y Solidario!* 🇻🇪❤️`
  },
  {
    id: 'notificacion_apoderado_marcano',
    title: 'Convocatoria a Retiro para Familiar / Representante',
    description: 'Notifica al familiar o apoderado autorizado para retirar la ayuda social asignada al beneficiario titular.',
    category: 'representative',
    content: `🏛️ *ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO*
*Dirección de Bienestar Social • Puerto La Cruz*

¡Dios le bendiga y un cordial saludo, estimado(a) *{REPRESENTANTE}*!

Por instrucciones de nuestro Alcalde, el *Prof. Jesús Marcano Tábata*, y de nuestra Primera Dama, la *Ing. Yohana Estaba de Marcano*, le escribimos desde la Dirección de Bienestar Social de la Alcaldía de Sotillo.

Le informamos que se encuentra listo para su entrega el beneficio social asignado a su familiar:

👤 *Beneficiario Titular:* {NOMBRE} (C.I. {CEDULA})
📦 *Ayuda Asignada:* {BENEFICIO}
🏘️ *Comuna / Sector:* {COMUNA} (Sector: {SECTOR})

📋 *COORDINACIÓN DE ENTREGA:*
🗓️ *Día de Retiro:* {FECHA}
⏰ *Horario de Atención:* 8:00 AM a 2:00 PM
📍 *Lugar:* Dirección de Bienestar Social (Sede de la Alcaldía del Municipio Sotillo)

📑 *REQUISITOS OBLIGATORIOS:*
• Cédula de identidad original y copia de quien retira ({REPRESENTANTE}).
• Copia de la Cédula de Identidad del titular ({NOMBRE}).
• Carta de autorización simple o documento que acredite el parentesco.

Agradecemos su valiosa labor y apoyo para hacer llegar esta ayuda a tiempo. ¡Seguimos trabajando de corazón por las familias sotillenses!

*Prof. Jesús Marcano Tábata* — Alcalde
*Ing. Yohana Estaba de Marcano* — Primera Dama
*¡Compromiso y Amor por Sotillo!* 🇻🇪🤝`
  },
  {
    id: 'confirmacion_entrega_marcano',
    title: 'Confirmación de Entrega Asentada en Libro Oficial',
    description: 'Confirma formalmente la entrega registrada en el libro oficial de la institución con el saludo de las autoridades.',
    category: 'social_thought',
    content: `🏛️ *ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO*
*Dirección de Bienestar Social • Puerto La Cruz*

¡Bendiciones y un afectuoso saludo, estimado(a) *{NOMBRE}*!

Desde la Alcaldía Bolivariana de Sotillo, en nombre de nuestro Alcalde *Prof. Jesús Marcano Tábata* y de la Primera Dama *Ing. Yohana Estaba de Marcano*, le enviamos un sincero mensaje de cercanía y respaldo.

Le confirmamos que ha quedado asentada en nuestro *Libro Oficial de Control y Despacho* la entrega satisfactoria de su beneficio:

✅ *Beneficio Recibido:* {BENEFICIO}
🗓️ *Fecha Asentada:* {FECHA}
🏘️ *Comuna / Sector:* {COMUNA} — {SECTOR}
📄 *Titular:* C.I. {CEDULA}

Para nuestra gestión, la salud, la dignidad y el bienestar social de cada familia de Puerto La Cruz son sagradas. Continuamos trabajando sin descanso con hechos reales y atención directa.

*Prof. Jesús Marcano Tábata* — Alcalde
*Ing. Yohana Estaba de Marcano* — Primera Dama
*¡Unidos siempre por Sotillo!* 🇻🇪❤️`
  },
  {
    id: 'contraloria_calidad_marcano',
    title: 'Contraloría Social & Calidad Humana de Atención',
    description: 'Consulta de verificación y contraloría social para asegurar transparencia, respeto y trato humano digno.',
    category: 'audit',
    content: `🏛️ *ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO*
*Dirección de Bienestar Social • Contraloría Social*

Estimado(a) *{NOMBRE}* (C.I. {CEDULA}), reciba un saludo fraterno y cordial.

En nombre de nuestro Alcalde, el *Prof. Jesús Marcano Tábata*, y de la Primera Dama, la *Ing. Yohana Estaba de Marcano*, nos comunicamos para corroborar que haya recibido oportunamente su beneficio de: *{BENEFICIO}*, y constatar que la atención prestada por nuestro equipo haya sido digna, humana y de máxima calidez.

En nuestra gestión, la transparencia y el trato respetuoso a nuestro pueblo son principios fundamentales. Si tiene alguna observación, duda o requerimiento adicional, por favor respóndanos a través de este chat.

¡Estamos para servirle con entrega total y amor por Puerto La Cruz!

*Prof. Jesús Marcano Tábata* — Alcalde
*Ing. Yohana Estaba de Marcano* — Primera Dama 🇻🇪🙏`
  },
  {
    id: 'notificacion_reposicion_cronica',
    title: 'Convocatoria a Reposición Mensual (Pacientes Crónicos / Hipertensión)',
    description: 'Aviso directo al cumplirse el ciclo de 30 días para retirar la nueva dotación del tratamiento regular continuo.',
    category: 'delivery',
    content: `🏛️ *ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO*
*Dirección de Bienestar Social • Coordinación de Farmacia y Salud*

¡Dios le bendiga y un fraternal saludo, estimado(a) *{NOMBRE}*!

En nombre de nuestro Alcalde *Prof. Jesús Marcano Tábata* y de nuestra Primera Dama *Ing. Yohana Estaba de Marcano*, nos comunicamos para informarle que ha culminado su ciclo mensual de 30 días para su tratamiento regular continuo:

💊 *Tratamiento Regular:* {BENEFICIO}
🏘️ *Comuna / Sector:* {COMUNA} (Sector: {SECTOR})

📋 *CONVOCATORIA PARA RETIRO DE REPOSICIÓN:*
🗓️ *Día de Retiro:* {FECHA}
⏰ *Horario de Atención:* 8:00 AM a 2:00 PM
📍 *Lugar:* Dirección de Bienestar Social (Edificio Municipal de la Alcaldía de Sotillo, Puerto La Cruz)

📑 *REQUISITO:* Presentar copia de su Cédula de Identidad (C.I. {CEDULA}).

Garantizar la continuidad de su tratamiento médico es nuestra prioridad y compromiso social. ¡Le esperamos con la mayor calidez y vocación de servicio!

*Prof. Jesús Marcano Tábata* — Alcalde
*Ing. Yohana Estaba de Marcano* — Primera Dama
*¡Sotillo Bonito, Humano y Solidario!* 🇻🇪❤️`
  },
  {
    id: 'personalizado_marcano',
    title: 'Mensaje Institucional Directo / Personalizado',
    description: 'Plantilla estructurada lista para ajustar manteniendo los membretes y autoridades municipales.',
    category: 'custom',
    content: `🏛️ *ALCALDÍA BOLIVARIANA DEL MUNICIPIO JUAN ANTONIO SOTILLO*
*Dirección de Bienestar Social • Puerto La Cruz*

Estimado(a) *{NOMBRE}* (C.I. {CEDULA}):

En nombre de nuestro Alcalde *Prof. Jesús Marcano Tábata* y de la Primera Dama *Ing. Yohana Estaba de Marcano*, le informamos sobre la asignación de su beneficio: *{BENEFICIO}*.

🗓️ *Día de Retiro:* {FECHA}
⏰ *Horario:* 8:00 AM a 2:00 PM
📍 *Lugar:* Dirección de Bienestar Social (Alcaldía del Municipio Sotillo, Puerto La Cruz)
📄 *Requisito:* Presentar fotocopia de la Cédula de Identidad.

*Prof. Jesús Marcano Tábata* — Alcalde
*Ing. Yohana Estaba de Marcano* — Primera Dama`
  }
];

/**
 * Sustituye los marcadores de posición dinámicos en la plantilla con los datos del ciudadano.
 */
export function interpolateWhatsAppMessage(
  template: string,
  data: {
    nombre?: string;
    cedula?: string;
    beneficio?: string;
    comuna?: string;
    sector?: string;
    fecha?: string;
    representante?: string;
    alcalde?: string;
    primeraDama?: string;
    primeraCombatiente?: string;
  }
): string {
  let result = template;
  
  const alcalde = data.alcalde || 'Prof. Jesús Marcano Tábata';
  const primeraDama = data.primeraDama || data.primeraCombatiente || 'Ing. Yohana Estaba de Marcano';

  result = result.replace(/\{NOMBRE\}/gi, data.nombre || 'Ciudadano(a)');
  result = result.replace(/\{CEDULA\}/gi, data.cedula || 'S/C');
  result = result.replace(/\{BENEFICIO\}/gi, data.beneficio || 'Ayuda Social / Insumo');
  result = result.replace(/\{COMUNA\}/gi, data.comuna || 'Municipio Sotillo');
  result = result.replace(/\{SECTOR\}/gi, data.sector || 'Casco Central');
  result = result.replace(/\{FECHA\}/gi, data.fecha || 'el día asignado');
  result = result.replace(/\{DIA_RETIRO\}/gi, data.fecha || 'el día asignado');
  result = result.replace(/\{REPRESENTANTE\}/gi, data.representante || 'Familiar Autorizado');
  result = result.replace(/\{ALCALDE\}/gi, alcalde);
  result = result.replace(/\{PRIMERA_DAMA\}/gi, primeraDama);
  result = result.replace(/\{PRIMERA_COMBATIENTE\}/gi, primeraDama);

  return result.trim();
}

/**
 * Genera el enlace oficial Click-to-Chat de WhatsApp (wa.me) con texto codificado en URL.
 */
export function buildWhatsAppLink(internationalPhone: string, message: string): string {
  const cleanPhone = internationalPhone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
