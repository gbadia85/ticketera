# Manual del proyecto — para qué sirve cada archivo

Guía rápida de referencia. Si necesitás tocar algo puntual, buscá acá
qué archivo es, en vez de andar abriendo todo el proyecto a ciegas.

Para la puesta en marcha (cuentas, secrets, deploy) ver **`SETUP.md`**.
Para la arquitectura general del sistema ver **`README.md`**.
Para cambiar colores, textos, nombre o logo del sitio, ver
**`src/site.config.js`** — es el único archivo pensado para editarse
seguido; el resto de esta guía es más para cuando hay que tocar
funcionalidad.

---

## 🎨 El archivo que más vas a tocar

| Archivo | Para qué sirve |
|---|---|
| **`src/site.config.js`** | Nombre del sitio, logo, título de pestaña, TODOS los textos de las pantallas principales, y TODA la paleta de colores (fondo, dorado, colores de butacas, paleta de zonas). Cambiar acá se refleja automáticamente en toda la app — no hace falta tocar ningún componente. |

---

## Raíz del proyecto (configuración)

| Archivo | Para qué sirve |
|---|---|
| `package.json` | Lista de dependencias y scripts (`npm run dev`, `npm run build`). |
| `vite.config.js` | Configuración de Vite (el empaquetador). Define el alias `@/` → `src/`. |
| `tailwind.config.js` | Genera los colores/tipografía de Tailwind **a partir de** `src/site.config.js`. No se edita casi nunca — si querés cambiar un color, andá a `site.config.js`, no acá. |
| `postcss.config.js` | Plomería de Tailwind, no hace falta tocarlo. |
| `index.html` | HTML base. Tiene el `<title>` y meta-descripción "de respaldo" (los que ve un buscador antes de que cargue React) — mantenerlo sincronizado a mano con `site.config.js` si cambiás el nombre del sitio. |
| `jsconfig.json` | Le dice al editor que `@/algo` significa `src/algo` (autocompletado). |
| `eslint.config.mjs` | Reglas de linting (`npm run lint`). |
| `.env.example` | Plantilla de variables de entorno. Copiar a `.env` y completar (ver `SETUP.md`). |
| `.gitignore` | Qué carpetas/archivos no subir a git (`node_modules`, `.env`, etc). |

---

## `src/` — Frontend (React)

### Entrada de la app

| Archivo | Para qué sirve |
|---|---|
| `src/main.jsx` | Punto de entrada: monta React en el `<div id="root">` de `index.html`. |
| `src/App.jsx` | Define las rutas (URLs) de la app: `/`, `/evento/:id`, `/checkout/:id`, `/pago/resultado`, `/salas`, `/salas/:id`, `/admin`. |
| `src/index.css` | Estilos globales: fondo con degradé, tipografía, la clase `.ticket-stub` (bordes perforados de las tarjetas de evento). Las variables de color se inyectan desde `tailwind.config.js`/`site.config.js`, no viven acá. |

### Páginas (`src/pages/`) — una por cada URL

| Archivo | Para qué sirve |
|---|---|
| `HomePage.jsx` | La cartelera pública (`/`): lista de eventos, con filtro por sala. Muestra la imagen de portada del evento si tiene alguna cargada. |
| `EventDetailsPage.jsx` | Detalle de un evento (`/evento/:id`): galería de imágenes del evento, apartado "Sala" (imágenes + descripción de la sala), mapa de butacas interactivo, selección, precios de referencia, botón "Reservar". |
| `CheckoutPage.jsx` | Checkout (`/checkout/:id`): cuenta regresiva del hold, formulario del comprador, botón de pago que redirige a Mercado Pago. |
| `PaymentResultPage.jsx` | Pantalla de vuelta de Mercado Pago (`/pago/resultado`): consulta el estado de la reserva hasta confirmar. |
| `VenuesPage.jsx` | Listado público de salas (`/salas`): tarjetas con imagen de portada, dirección y capacidad. |
| `VenueDetailsPage.jsx` | Detalle público de una sala (`/salas/:id`): galería de imágenes, descripción, y próximas funciones en esa sala. |
| `AdminDashboard.jsx` | Panel de administración (`/admin`): login + pestañas (Salas, Eventos, Reservas, Peligro). |

### Componentes (`src/components/`)

| Archivo | Para qué sirve |
|---|---|
| `Navbar.jsx` | Barra superior con el logo/nombre (desde `site.config.js`) y navegación (Cartelera, Salas, Admin). |
| `Footer.jsx` | Pie de página en todas las páginas públicas: texto, contacto (teléfono/email/dirección) y redes sociales — todo configurable desde `site.config.js` (sección `footer`). |
| `SeatMap.jsx` | El mapa de butacas interactivo en SVG (usado en `EventDetailsPage`). Pinta cada butaca con `fill` según su estado (disponible = color de zona, seleccionada = dorado, vendida = rojo, ocupada = gris). Incluye también `SeatMapLegend`. |

#### `src/components/admin/` — Panel de administración

| Archivo | Para qué sirve |
|---|---|
| `AdminLogin.jsx` | Formulario de login (usa Supabase Auth). |
| `VenuesTab.jsx` | Lista de salas: crear, eliminar, entrar al editor de cada una. |
| `VenueEditor.jsx` | El editor de una sala: datos básicos, **descripción**, **imágenes de la sala**, zonas de precio (con paleta de colores acotada), y la grilla de butacas (generar, pintar por zona, marcar pasillos, **mover butacas** para armar formas en U/herradura). |
| `EventsTab.jsx` | Lista de eventos: crear, **editar** (título/descripción/fecha, y sala si es borrador), **gestionar imágenes** (hasta 5, con portada y reorden), configurar precios por zona, publicar, cancelar, eliminar borradores. |
| `ImageManager.jsx` | Componente reutilizable de subida/borrado/reorden de imágenes, usado tanto por `EventsTab` como por `VenueEditor`. |
| `ReservationsTab.jsx` | Lista de reservas (quién compró qué, para qué evento, estado del pago). |
| `DangerZoneTab.jsx` | Pestaña "Peligro": borrar todos los eventos / todas las salas / resetear la base completa, con confirmación escrita. |

#### `src/components/ui/`

Componentes de interfaz genéricos y reutilizables (botones, tarjetas,
diálogos, tabs, etc.), basados en shadcn/ui. Rara vez hace falta
tocarlos; si un botón o modal se ve raro en todos lados a la vez,
probablemente el problema esté en uno de estos archivos.

### Lógica de datos (`src/lib/`)

| Archivo | Para qué sirve |
|---|---|
| `supabaseClient.js` | Crea el cliente de Supabase usando las variables de `.env`. |
| `api.js` | Todas las consultas a la base de datos: salas, zonas, butacas, eventos, reservas, **imágenes (subida/borrado/reorden de eventos y salas)**, y las acciones de la Zona de Peligro. Si necesitás agregar una consulta nueva a Supabase, va acá. |
| `booking.js` | El flujo de compra: retener butacas (`holdSeats`), crear la reserva pendiente, pedir la preferencia de pago a la Edge Function, consultar el estado del pago. |
| `session.js` | Genera y guarda un ID anónimo por navegador (para saber qué butacas retuvo cada comprador sin necesidad de login). |
| `seatColors.js` | Traduce el estado de una butaca (disponible/seleccionada/vendida/etc.) al color que le corresponde. Los colores en sí vienen de `site.config.js` — este archivo solo tiene la lógica de "qué color según qué estado". |
| `utils.js` | Funciones chicas de formato: `cn` (combinar clases de Tailwind), `formatCurrency`, `formatDateTime`, `formatDateShort`. |

### Hooks (`src/hooks/`)

| Archivo | Para qué sirve |
|---|---|
| `useEventSeats.js` | Carga las butacas de un evento y se suscribe a Supabase Realtime: si otro comprador retiene/compra algo, el mapa se actualiza solo. |
| `useCountdown.js` | Cuenta regresiva del hold de 10 minutos en el checkout. |
| `useAdminAuth.js` | Maneja la sesión de Supabase Auth del panel de administración (login/logout). |

---

## `supabase/` — Backend

| Archivo/carpeta | Para qué sirve |
|---|---|
| `config.toml` | Configuración de la Supabase CLI (qué Edge Functions no requieren JWT). |
| `seed_demo.sql` | Datos de ejemplo opcionales (una sala + evento de prueba), para probar el flujo sin cargar todo a mano. |

### `supabase/migrations/` — Esquema de la base de datos (correr en orden)

| Archivo | Para qué sirve |
|---|---|
| `0001_init.sql` | Esquema inicial completo: tablas (`venues`, `seat_zones`, `seats`, `events`, `event_seats`, `reservations`, etc.), permisos (RLS), y las funciones de negocio (`hold_seats`, `publish_event`, etc.). |
| `0002_fixes_and_admin_tools.sql` | Corrige el error de ambigüedad en `hold_seats`, permite borrar una zona en uso, y agrega las funciones que usa la pestaña "Peligro". |
| `0003_fix_hold_seats_for_update.sql` | Corrige "FOR UPDATE is not allowed with aggregate functions" al reservar butacas. |
| `0004_swap_seat_positions.sql` | Agrega la función que permite "mover" butacas de lugar en el editor de sala. |
| `0005_images_and_venue_description.sql` | Agrega imágenes de evento y de sala (tablas `event_images`/`venue_images` + buckets de Storage), y la descripción de sala. |

### `supabase/functions/` — Edge Functions (código de servidor)

| Archivo | Para qué sirve |
|---|---|
| `_shared/cors.ts` | Código compartido entre funciones: headers CORS, y `getServiceRoleKey()` (obtiene la clave de servidor sin importar si tu proyecto usa el sistema de claves viejo o nuevo de Supabase). |
| `create-payment-preference/index.ts` | Arma la preferencia de pago en Mercado Pago para una reserva y devuelve el link de pago. |
| `mp-webhook/index.ts` | Recibe la confirmación de pago de Mercado Pago. Es el ÚNICO lugar donde una butaca pasa a "vendida" de verdad, y donde se dispara el email de confirmación. |
| `get-reservation-status/index.ts` | Consulta el estado de una reserva (la usa la pantalla de resultado del pago). |
| `release-expired-holds/index.ts` | Libera butacas cuyo hold de 10 minutos venció. Alternativa a `pg_cron` si tu plan de Supabase no lo soporta. |

---

## ¿Dónde toco esto...?

- **"Quiero cambiar el nombre del sitio / el logo / los colores"** → `src/site.config.js`
- **"Quiero cambiar un texto que ve el comprador"** → `src/site.config.js` (sección `texts`); si el texto no está ahí todavía, buscalo en la página correspondiente dentro de `src/pages/`
- **"El mapa de butacas se ve raro"** → `src/components/SeatMap.jsx` (mapa del comprador) o `src/components/admin/VenueEditor.jsx` (editor del admin)
- **"Quiero agregar un dato al formulario de compra"** → `src/pages/CheckoutPage.jsx` + `create_pending_reservation` en `0001_init.sql` (para guardarlo) + `create-payment-preference/index.ts` (si tiene que viajar a Mercado Pago)
- **"Un botón del admin no hace lo que debería"** → buscá el componente en `src/components/admin/`
- **"Quiero cambiar el footer (redes sociales, teléfono, email)"** → `src/site.config.js` (sección `footer`) — no hace falta tocar `Footer.jsx`
- **"Las imágenes de un evento o sala no se ven"** → revisá que corriste `0005_images_and_venue_description.sql` y que los buckets `event-images`/`venue-images` existan en Supabase → Storage
- **"Cambié algo y ahora la base de datos se queja"** → revisá las migraciones en `supabase/migrations/`, capaz falta correr alguna
- **"El pago no anda / el webhook no confirma"** → `supabase/functions/create-payment-preference/` y `supabase/functions/mp-webhook/`, y los secrets configurados (ver `SETUP.md`)
