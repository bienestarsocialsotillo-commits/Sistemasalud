# Módulo Independiente: Semáforo de Alertas y Consolidado de Fármacos a Solicitar (Ciclo 30 Días)

Plan de arquitectura y diseño para separar el semáforo de reposición de la sección general de farmacia, estableciendo un nuevo módulo en la navegación principal con dos vistas ejecutivas: el **Consolidado de Fármacos y Cantidades a Solicitar** (orden de adquisición para pacientes vencidos y próximos) y el **Semáforo Nominal de Pacientes con Convocatoria por WhatsApp**.

## Decisiones Críticas Confirmadas

> [!IMPORTANT]
> Aprobado por el usuario en Turno 1:
> - **Ubicación Arquitectónica**: Módulo independiente en el menú de navegación principal (`/chronic-alerts`), separándolo de Farmacia y Requerimientos para garantizar máxima claridad visual y operativa.
> - **Estructura del Listado**: Vista dual que combina la **tabla consolidada de insumos a solicitar** con el desglose nominal de pacientes por fármaco y comuna.
> - **Criterio de Cálculo de Cantidades**: Totalización calculada para pacientes con ciclo vencido ($\ge 30$ días) o próximos a vencer (ventana de 25–29 días), con opción de alternar al 100% proyectado del censo.
> - **Institucionalidad**: Todas las órdenes de adquisición y plantillas de WhatsApp citan al **Prof. Jesús Marcano Tábata** (Alcalde) y a la **Ing. Yohana Estaba de Marcano** (Primera Dama).

---

## 1. Visión General del Producto y Valor

- **Problema**: El equipo de salud y bienestar social necesita saber con exactitud **cuántas cajas o unidades de cada medicamento deben comprar o gestionar ante entes gubernamentales** para dar respuesta inmediata a los pacientes hipertensos y crónicos sin quedarse sin inventario. Adicionalmente, el semáforo sobrecargaba la vista tradicional de Farmacia.
- **Solución**: 
  1. Crear una ruta y entrada independiente en la barra de navegación: `Semáforo y Reposición Crónica`.
  2. Incorporar el generador de **Lista de Requerimientos a Solicitar**: totaliza automáticamente los fármacos requeridos para atender a todos los pacientes con ciclo de 30 días cumplido o por vencer.
  3. Exportación formal de la **Orden de Suministro Mensual** en formato PDF institucional y Excel/CSV para entrega directa al Alcalde y directores de compras.
  4. Mantener el **Semáforo Nominal** interactivo con convocatoria directa vía WhatsApp y registro de despacho en un solo clic.

---

## 2. Experiencia de Usuario y Diseño Visual

### A. Estructura de Navegación y Acceso
- Entrada dedicada en la barra lateral (`AppSidebar` en `src/components/Layout.tsx`):
  - Etiqueta: **Semáforo y Reposición**
  - Icono: `HeartPulse` / `Timer` con distintivo visual en cyan/esmeralda.
  - Ruta: `/chronic-alerts` (accesible para editores y administradores).

### B. Arquitectura de Pantalla y Vistas
El módulo dispondrá de dos pestañas o submódulos claros:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  MÓDULO: CONTROL DE REPOSICIÓN CRÓNICA Y PLANIFICACIÓN DE FÁRMACOS (CICLO 30 DÍAS)    │
│  Gestión Social Sotillo · Prof. Jesús Marcano Tábata & Ing. Yohana Estaba de Marcano   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [🔴 Vencidos: 12]  [🟡 Próximos: 8]  [🟢 Al Día: 45]  [📦 Demanda Total: 640 un.]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [📋 1. Fármacos y Cantidades a Solicitar]   [🚦 2. Semáforo Nominal de Pacientes]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  FILTROS: [Ventana Inmediata (Vencidos + Próximos)] [Todo el Censo]  [Por Comuna ▼]    │
│                                                                                        │
│  TABLA: CONSOLIDADO DE COMPRA / SOLICITUD DE FÁRMACOS                                  │
│  Principio Activo    | Presentación | Pacientes en Espera | Cantidad a Solicitar | ... │
│  Losartán Potásico   | 50mg Tab     | 18 pacientes        | 540 comprimidos      | ... │
│  Amlodipino          | 10mg Tab     | 14 pacientes        | 420 comprimidos      | ... │
│  Metformina          | 850mg Tab    | 9 pacientes         | 270 comprimidos      | ... │
│                                                                                        │
│  ACCIONES: [📄 Descargar Orden PDF Oficial]  [📊 Exportar Requerimientos Excel]       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Pestaña 1: Fármacos y Cantidades a Solicitar (Plan de Abastecimiento)**:
   - Tabla agregada por medicamento y presentación.
   - Columnas: Principio Activo, Presentación farmacológica, Pacientes que lo requieren, Cantidad mensual unitaria recomendada, Cantidad total requerida a solicitar.
   - Desplegable o modal en cada fila: ver los nombres, cédulas, teléfonos y comunas de los pacientes que justifican esa cantidad.
   - Botón `[📄 Generar Orden de Suministro PDF]`: documento formal listo para imprimir y firmar, con membrete oficial del Municipio Sotillo.
   - Botón `[📊 Exportar Lista de Compras CSV]`: compatible con Excel para compras e inventario.

2. **Pestaña 2: Semáforo Nominal y Convocatoria WhatsApp**:
   - Monitoreo nominal paciente a paciente.
   - Filtros por estado del semáforo (🔴 Vencido $\ge 30$d, 🟡 Próximo 25–29d, 🟢 Al día $< 25$d).
   - Buscador universal (cédula, nombre, medicamento, sector, comuna).
   - Botón Click-to-Chat con la plantilla oficial de WhatsApp de reposición mensual.
   - Botón `[+ Despachar Mes]`: registra la nueva entrega y reinicia el ciclo a 0 días.

---

## 3. Arquitectura Técnica y Modelo de Datos

```
src/
├── components/
│   ├── ChronicAlertsModule.tsx      <-- Nuevo módulo independiente
│   ├── ChronicProcurementTable.tsx  <-- Tabla de fármacos y cantidades a solicitar
│   ├── Layout.tsx                   <-- Nueva opción en sidebar
│   ├── Medications.tsx              <-- Limpieza de pestañas redundantes / enlace de acceso
├── utils/
│   ├── chronicAlertsUtils.ts        <-- Funciones de agrupación de compras y cálculo de cantidades
│   ├── chronicProcurementPdf.ts     <-- Generador de PDF oficial de Orden de Suministro
│   ├── whatsappUtils.ts             <-- Plantillas institucionales ya implementadas
```

### Funciones de Cálculo Agregado:
- `calculateChronicProcurementList(alerts, mode: 'immediate' | 'all')`:
  - Agrupa las alertas activas por nombre de fármaco normalizado y presentación.
  - Suma la cantidad total a solicitar multiplicando la dosis mensual de cada paciente por el ciclo de 30 días.
  - Devuelve la lista ordenada por mayor demanda de pacientes y unidades requeridas.
- Generador de PDF `generateProcurementOrderPdf`:
  - Membrete oficial de la Alcaldía Bolivariana del Municipio Sotillo.
  - Título: *ORDEN INSTITUCIONAL DE ADQUISICIÓN Y REPOSICIÓN MENSUAL DE FÁRMACOS*.
  - Tabla de insumos requeridos con totales y cuadro de firmas de autorización.

---

## 4. Plan de Implementación Paso a Paso

1. **Creación del Generador de PDF de Adquisición** (`src/utils/chronicProcurementPdf.ts`):
   - Estructuración de documento jsPDF con membrete, tabla de fármacos, cantidades calculadas y firmas de entrega/aprobación.
2. **Ampliación de Utilidades de Alerta** (`src/utils/chronicAlertsUtils.ts`):
   - Agregar función de consolidación de compras `calculateChronicProcurementList`.
3. **Creación del Componente de Módulo Independiente** (`src/components/ChronicAlertsModule.tsx`):
   - Tarjetas KPI de control mensual.
   - Selector de vistas (Consolidado de Compras vs. Semáforo Nominal).
   - Tabla interactiva de fármacos a solicitar con desglose nominal de pacientes.
   - Semáforo de pacientes con disparador WhatsApp y despacho rápido.
4. **Actualización de Enrutamiento y Navegación** (`src/App.tsx` y `src/components/Layout.tsx`):
   - Agregar ruta `/chronic-alerts`.
   - Incorporar ítem en el menú lateral con insignia de alerta.
5. **Ajuste en `Medications.tsx`**:
   - Mantener acceso limpio hacia el nuevo módulo para evitar duplicidad o confusión visual.
6. **Compilación y Verificación**:
   - Ejecutar `lint_applet` y `compile_applet`.
