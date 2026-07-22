// =====================================================================
// site.config.js — TODO lo que define la identidad visual y los textos
// de la aplicación vive acá. Es el ÚNICO archivo que deberías necesitar
// tocar para:
//   - Cambiar el nombre del sitio, el logo, el título de la pestaña
//   - Cambiar los textos de la portada (cartelera)
//   - Cambiar la paleta de colores (marca, fondo, y los colores
//     reservados de las butacas: vendida/seleccionada/no disponible)
//
// Este archivo se usa desde DOS lugares:
//   1) tailwind.config.js (en la raíz del proyecto) lo lee para generar
//      las clases de color de Tailwind y las variables CSS del tema.
//   2) Los componentes React (Navbar, HomePage, etc.) lo importan para
//      mostrar los textos e identidad configurados acá.
//
// IMPORTANTE: este archivo es solo DATOS (strings, hex, números). No
// importa React ni ninguna librería de UI a propósito, para que
// tailwind.config.js lo pueda leer sin problemas al momento de compilar.
// =====================================================================

export const siteConfig = {
  // -------------------------------------------------------------------
  // IDENTIDAD: nombre, logo, título de pestaña del navegador
  // -------------------------------------------------------------------
  identity: {
    siteName: 'Aburridos Producciones',
    tagline: 'Venta de entradas y producción de Eventos',

    // Título y descripción que aparecen en la pestaña del navegador y
    // en resultados de búsqueda / al compartir el link.
    metaTitle: 'AP — Venta de entradas y producción de Eventos',
    metaDescription:
      'Comprá entradas y elegí tu butaca para las próximas funciones de teatro.',

    // Logo de la marca (se usa en el Navbar). Dos formas de configurarlo:
    //
    // A) Ícono (por defecto): cualquier nombre de ícono de lucide-react
    //    (https://lucide.dev/icons). El Navbar hace el mapeo del nombre
    //    al componente real.
    //      logo: { type: 'icon', iconName: 'Theater' }
    //
    // B) Imagen propia: poné tu archivo (logo.png / logo.svg) en la
    //    carpeta /public y apuntá acá. Recomendado: imagen cuadrada o
    //    con fondo transparente, ~64x64px o más.
    //      logo: { type: 'image', src: '/logo.png', alt: 'Mi teatro' }
    logo: {
      type: 'icon',
      iconName: 'Theater',
      // src: '/logo.png',
      // alt: 'Butaca',
    },
  },

  // -------------------------------------------------------------------
  // TEXTOS: todo lo que el usuario final lee en las pantallas
  // principales. Cambiá estos strings para adaptar el tono/idioma.
  // -------------------------------------------------------------------
  texts: {
    navbar: {
      cartelera: 'Cartelera',
      salas: 'Salas',
      admin: 'Admin',
    },
    home: {
      title: 'La cartelera de la semana',
      subtitle: 'Elegí tu función, mirá el mapa de la sala y reservá tu butaca en minutos.',
      allVenuesFilter: 'Todas las salas',
      venueFilterPrefix: 'Ver sala:',
      loading: 'Cargando funciones…',
      loadError: 'No pudimos cargar los eventos. Probá de nuevo más tarde.',
      emptyState: 'Todavía no hay funciones publicadas.',
      emptyStateFiltered: 'Esta sala no tiene funciones publicadas por ahora.',
    },
    eventDetails: {
      chooseSeatsTitle: 'Elegí tus butacas',
      yourSelectionTitle: 'Tu selección',
      emptySelection: 'Todavía no seleccionaste ninguna butaca.',
      reserveButton: 'Reservar butacas (10 min)',
      reservingButton: 'Reservando…',
      holdNotice: 'Al reservar, tenés 10 minutos para completar el pago antes de que se liberen.',
      priceReferenceTitle: 'Precios de referencia',
      salaSectionTitle: 'Sala',
      salaSeeMore: 'Ver sala completa',
    },
    venues: {
      title: 'Nuestras salas',
      subtitle: 'Conocé los espacios donde se hacen nuestras funciones.',
      loading: 'Cargando salas…',
      emptyState: 'Todavía no hay salas cargadas.',
      backToVenues: 'Volver a salas',
      upcomingEventsTitle: 'Próximas funciones en esta sala',
      noUpcomingEvents: 'Esta sala no tiene funciones publicadas por ahora.',
    },
    checkout: {
      buyerDataTitle: 'Datos del comprador',
      paymentMethodTitle: 'Método de pago',
      paymentMethodDescription:
        'Vas a completar el pago en Mercado Pago: tarjeta de crédito/débito, dinero en cuenta, Rapipago, Pago Fácil y otros medios habilitados para tu cuenta.',
      payButtonPrefix: 'Pagar',
      payingButton: 'Redirigiendo a Mercado Pago…',
      summaryTitle: 'Resumen de compra',
      mockModeNotice: 'Modo de prueba: este pago es simulado, no se cobra nada de verdad.',
      mockPaymentMethodDescription: 'Modo de prueba activo: al tocar "Pagar" se simula el pago y se confirma la compra al instante.',
      mockProcessingTitle: 'Procesando pago…',
      mockProcessingSubtitle: 'Esto es una simulación, no se está cobrando nada.',
    },
  },

  // -------------------------------------------------------------------
  // COLORES: la identidad visual del sitio. Todos son valores hex
  // (#RRGGBB). Cambiá cualquiera de estos y se propaga automáticamente
  // a toda la app (botones, fondos, mapa de butacas, etc.) — no hace
  // falta tocar ningún componente ni archivo CSS.
  // -------------------------------------------------------------------
  colors: {
    // Tema general (inspirado en telón de teatro + luces de marquesina)
    background: '#14111A', // fondo general de la app
    foreground: '#F5EFE3', // texto principal sobre el fondo
    card: '#1E1926', // fondo de tarjetas/paneles
    border: '#372C43', // bordes y separadores
    muted: '#241D2E', // fondos sutiles (inputs, filas alternadas)
    mutedForeground: '#B4A9BE', // texto secundario/apagado
    accent: '#2C2338', // hover / resaltados sutiles

    primary: '#C9A227', // dorado de marquesina: botones principales, acentos
    primaryLight: '#E4C664', // variante clara (hover, brillos)
    primaryDark: '#8A6D1B', // variante oscura
    primaryForeground: '#171221', // texto sobre fondo dorado (debe ser oscuro)

    secondary: '#7A1F3D', // borravino de telón: acentos secundarios
    secondaryForeground: '#F5EFE3',

    destructive: '#DD3C3C', // errores, acciones peligrosas
    destructiveForeground: '#FFFFFF',

    success: '#2F8F5B', // confirmaciones, pagos aprobados (no es un color de butaca)

    // Colores de estado de las butacas en el mapa interactivo.
    // IMPORTANTE: seatSold (rojo) y seatDisabled (negro/muy oscuro)
    // están "reservados" por el sistema para esos dos significados
    // específicos — evitá elegir un color de zona de precio (más abajo)
    // parecido a estos dos, para no confundir a los compradores.
    seatSold: '#B23A3A', // butaca vendida
    seatSelected: '#D9A62E', // butaca seleccionada / retenida por vos
    seatHeldByOther: '#6B6470', // retenida temporalmente por otro comprador
    seatDisabled: '#111111', // pasillo / butaca no disponible

    // Paleta de colores para zonas de precio (Platea, VIP, Palco, etc.).
    // A propósito son ≤15 colores curados, todos lejos del rojo y del
    // dorado de arriba para que nunca se confundan con "vendida" o
    // "seleccionada". Podés cambiar los hex libremente, pero si agregás
    // colores nuevos evitá tonos rojizos o dorados.
    zonePalette: [
      { name: 'Oliva', hex: '#9ca630' },
      { name: 'Lima oscuro', hex: '#77a630' },
      { name: 'Verde bosque', hex: '#50a630' },
      { name: 'Esmeralda', hex: '#30a636' },
      { name: 'Jade', hex: '#30a65b' },
      { name: 'Turquesa', hex: '#30a683' },
      { name: 'Cian petróleo', hex: '#30a4a6' },
      { name: 'Celeste', hex: '#307fa6' },
      { name: 'Azul acero', hex: '#3057a6' },
      { name: 'Azul real', hex: '#3032a6' },
      { name: 'Índigo', hex: '#5430a6' },
      { name: 'Violeta', hex: '#7930a6' },
      { name: 'Orquídea', hex: '#a030a6' },
      { name: 'Magenta ciruela', hex: '#a63087' },
      { name: 'Frambuesa', hex: '#a63061' },
    ],
  },

  // -------------------------------------------------------------------
  // FOOTER: pie de página que aparece en todas las páginas públicas.
  // Dejá una url vacía ('') en cualquier red social que no uses — el
  // ícono directamente no se muestra.
  //
  // Íconos de redes disponibles (campo "platform"): instagram, facebook,
  // x, youtube, tiktok, whatsapp, linkedin, threads.
  // whatsapp arma automáticamente el link de chat a partir del número
  // que pongas en contact.phone (sin espacios, con código de país).
  // -------------------------------------------------------------------
  footer: {
    text: 'Aburridos Producciones — Venta de entradas y producción de eventos.',
    copyright: '© {year} AP. Todos los derechos reservados.',
    contact: {
      phone: '+54 9 3462 123456', // ej: '+54 9 11 1234-5678'
      email: 'ventas@aburridosproducciones.com.ar', // ej: 'contacto@butaca.com'
      address: 'Murphy, Santa Fe, Argentina', // ej: 'Av. Corrientes 1234, CABA'
    },
    social: [
      { platform: 'instagram', url: 'xxx' },
      { platform: 'facebook', url: 'xxx' },
      { platform: 'x', url: '' },
      { platform: 'youtube', url: 'xxx' },
      { platform: 'tiktok', url: '' },
      { platform: 'whatsapp', url: 'xxx' },
    ],
  },

  // -------------------------------------------------------------------
  // TIPOGRAFÍA: familias de fuente. Si cambiás esto, actualizá también
  // los <link> de Google Fonts en index.html para que carguen la fuente
  // nueva (están comentados ahí mismo).
  // -------------------------------------------------------------------
  fonts: {
    display: '"Fraunces", serif', // títulos
    sans: '"Inter", sans-serif', // texto general
    mono: '"DM Mono", monospace', // precios, contador, números de butaca
  },
};

// =====================================================================
// Utilidad: convierte un color hex ("#RRGGBB") al formato "H S% L%"
// que usan las variables CSS del tema (ej: "260 21% 8%"), para que
// tailwind.config.js pueda generar `hsl(var(--nombre))` a partir de los
// hex de arriba. No hace falta tocar esto.
// =====================================================================
export function hexToHsl(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
