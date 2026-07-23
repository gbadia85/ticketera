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

## 🎭 Un concepto clave: "evento" vs. "función"

Desde la migración `0010`, lo que antes era "un evento" se separó en
dos cosas:

- **El evento** (tabla `shows` en la base, componente `EventsTab` /
  `EventDetailsPage` en el código): título, descripción, imágenes,
  sponsors, sala. Es "la obra" o "el espectáculo" — no tiene fecha
  propia.
- **Cada función** (sigue siendo la tabla `events`): una fecha/hora
  puntual de ese evento. Es la unidad de venta: cada función tiene su
  propio mapa de butacas, precios, reservas, caja y check-in.

Un evento puede tener una función sola (lo más común) o varias — por
ejemplo la misma obra un viernes y un sábado, cada una con su propio
mapa de butacas y su propia disponibilidad. En el código, vas a ver
`show` (o `showId`) para lo primero, y `funcion`/`event`/`eventId` para
lo segundo — si una variable tiene fecha, es una función.

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
| `src/App.jsx` | Define las rutas (URLs) de la app: `/`, `/evento/:id`, `/checkout/:id`, `/pago/resultado`, `/salas`, `/salas/:id`, `/admin`. También envuelve todo en `SiteSettingsProvider`. |
| `src/contexts/SiteSettingsContext.jsx` | Carga `site_settings` una vez al arrancar y lo deja disponible en toda la app (`useSiteSettings()`) — lo consumen `Navbar`, `Footer` y `SiteSettingsTab`. |
| `src/index.css` | Estilos globales: fondo con degradé, tipografía, la clase `.ticket-stub` (bordes perforados de las tarjetas de evento). Las variables de color se inyectan desde `tailwind.config.js`/`site.config.js`, no viven acá. |

### Páginas (`src/pages/`) — una por cada URL

| Archivo | Para qué sirve |
|---|---|
| `HomePage.jsx` | La cartelera pública (`/`): lista de eventos, con filtro por sala. Muestra la imagen de portada del evento si tiene alguna cargada. |
| `EventDetailsPage.jsx` | Detalle de un evento (`/evento/:showId`): título/descripción/sala a la izquierda (arriba en mobile) y galería de imágenes a la derecha; **selector de función** si tiene más de una; debajo, mapa de butacas interactivo (o selector de cantidad en salas de entrada general) para la función elegida, precios de referencia y sección de sponsors. Sello de "Agotado"/"Evento pasado", botones de compartir. |
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
| `VenuesTab.jsx` | Lista de salas: crear, eliminar, **reordenar** (flechas arriba/abajo — define el orden en la página pública "Salas"), entrar al editor de cada una. |
| `VenueEditor.jsx` | El editor de una sala: datos básicos, **descripción**, **imágenes**, el toggle de **entrada general** (sin mapa de butacas), zonas de precio (con paleta de colores acotada), y la grilla de butacas (generar, pintar por zona, marcar pasillos, **mover butacas**, con la **letra de fila** visible al costado). |
| `EventsTab.jsx` | Lista de eventos (shows), cada uno con sus funciones adentro: crear evento (con su primera función), **agregar más funciones** (otros días/horarios, valida que no choquen con otro evento de la misma sala), editar evento (título/descripción/sponsors) o función (fecha, **Agotado** manual), **gestionar imágenes y sponsors** (a nivel evento, se comparten entre funciones), configurar precios y publicar cada función. |
| `ImageManager.jsx` | Componente reutilizable de subida/borrado/reorden de imágenes, usado por `EventsTab` (imágenes y sponsors) y `VenueEditor`. |
| `ReservationsTab.jsx` | Planilla de reservas, filtrable por sala, evento y estado (las expiradas quedan ocultas por defecto), con botón para imprimir. |
| `DoorSalesTab.jsx` | Venta en puerta: abrís la caja una vez (ya no atada a un evento) y elegís para qué evento/función es cada venta en el momento — butacas en el mapa (o cantidad, en salas de entrada general, con **sobreventa opcional** avisando cuánto se supera la capacidad), método de pago (contado/transferencia/otro), y **devolver entradas** (busca por nombre en cualquier evento, libera la butaca, el cajero carga cuánto devolvió de verdad). Solo el contado cuenta para el arqueo. |
| `OpenDoorTab.jsx` | Pestaña "Abrir puerta": habilita (o deshabilita) el ingreso de uno o más eventos a la vez — separado de la venta, para que lo pueda operar otra persona. |
| `QrScannerTab.jsx` | Lector de QR por cámara (con `jsqr`), pantalla minimalista (solo cámara + botones + "Salir del lector"): al leer, muestra el dato **sin marcar el ingreso todavía** — hay que tocar "OK, dejar entrar". Si hay más de un evento habilitado a la vez, pregunta a cuál está fijado ese lector, y rechaza entradas de otro evento habilitado ("puerta equivocada"). Si el mismo QR se vuelve a leer, alerta y deja "Marcar salida" o "Cancelar ingreso". |
| `SiteSettingsTab.jsx` | Personalizar el sitio desde el admin: nombre, logo (subida de imagen) y colores — se aplican en todo el sitio al instante al guardar, sin tocar código ni redeployar. |
| `DangerZoneTab.jsx` | Pestaña "Peligro": eliminar reservas expiradas, vaciar imágenes subidas, borrar todos los eventos / todas las salas / resetear la base completa — todas con confirmación escrita, y las que corresponde también vacían los archivos de Storage (no solo las filas). |
| `LiveEntryBoard.jsx` | Pantalla en vivo para el día del evento: mapa de butacas vendidas + lista de ingresos en tiempo real, para la persona de boletería. |

#### `src/components/ui/`

Componentes de interfaz genéricos y reutilizables (botones, tarjetas,
diálogos, tabs, etc.), basados en shadcn/ui. Rara vez hace falta
tocarlos; si un botón o modal se ve raro en todos lados a la vez,
probablemente el problema esté en uno de estos archivos.

### Lógica de datos (`src/lib/`)

| Archivo | Para qué sirve |
|---|---|
| `supabaseClient.js` | Crea el cliente de Supabase usando las variables de `.env`. |
| `api.js` | Todas las consultas a la base de datos: salas, **shows y funciones** (`listShows`, `createFuncion`, etc.), butacas, reservas, **imágenes** (subida/borrado/reorden, y vaciado completo de Storage), **caja** (abrir/cerrar/arqueo, devoluciones), **check-in** de entradas, **personalización del sitio** (`site_settings`), y las acciones de la Zona de Peligro. Si necesitás agregar una consulta nueva a Supabase, va acá. |
| `booking.js` | El flujo de compra: retener butacas (`holdSeats`), crear la reserva pendiente, pedir la preferencia de pago a la Edge Function (o confirmarla al instante en modo simulado), consultar el estado del pago, y la venta en puerta (`createDoorSale`). |
| `session.js` | Genera y guarda un ID anónimo por navegador (para saber qué butacas retuvo cada comprador sin necesidad de login). |
| `theme.js` | Aplica los colores guardados en `site_settings` como variables CSS en tiempo real (sin rebuild) — lo usa `SiteSettingsContext`. |
| `seatColors.js` | Traduce el estado de una butaca (disponible/seleccionada/vendida/etc.) al color que le corresponde. Los colores en sí vienen de `site.config.js` — este archivo solo tiene la lógica de "qué color según qué estado". |
| `utils.js` | Funciones chicas de formato: `cn` (combinar clases de Tailwind), `formatCurrency`, `formatDateTime`, `formatDateShort`. |

### Hooks (`src/hooks/`)

| Archivo | Para qué sirve |
|---|---|
| `useEventSeats.js` | Carga las butacas de un evento y se suscribe a Supabase Realtime: si otro comprador retiene/compra algo, el mapa se actualiza solo. |
| `useEventCheckins.js` | Carga las reservas aprobadas de un evento (con su estado de ingreso) y se suscribe a Realtime — la usa la pantalla en vivo para actualizarse sola cuando alguien escanea un QR en la puerta. |
| `useCountdown.js` | Cuenta regresiva del hold de 10 minutos en el checkout. |
| `useAdminAuth.js` | Maneja la sesión de Supabase Auth del panel de administración (login/logout). |

---

## `supabase/` — Backend

| Archivo/carpeta | Para qué sirve |
|---|---|
| `config.toml` | Configuración de la Supabase CLI (qué Edge Functions no requieren JWT). |
| `seed_demo.sql` | Datos de ejemplo opcionales (una sala + evento de prueba), para probar el flujo sin cargar todo a mano. |
| `scripts/deploy.sh` | Un solo comando para publicar todo: sube el código a GitHub, aplica migraciones nuevas en Supabase y redespliega las Edge Functions (Render se dispara solo con el push). Ver SETUP.md, Parte 7. |

### `supabase/migrations/` — Esquema de la base de datos (correr en orden)

| Archivo | Para qué sirve |
|---|---|
| `0001_init.sql` | Esquema inicial completo: tablas (`venues`, `seat_zones`, `seats`, `events`, `event_seats`, `reservations`, etc.), permisos (RLS), y las funciones de negocio (`hold_seats`, `publish_event`, etc.). |
| `0002_fixes_and_admin_tools.sql` | Corrige el error de ambigüedad en `hold_seats`, permite borrar una zona en uso, y agrega las funciones que usa la pestaña "Peligro". |
| `0003_fix_hold_seats_for_update.sql` | Corrige "FOR UPDATE is not allowed with aggregate functions" al reservar butacas. |
| `0004_swap_seat_positions.sql` | Agrega la función que permite "mover" butacas de lugar en el editor de sala. |
| `0005_images_and_venue_description.sql` | Agrega imágenes de evento y de sala (tablas `event_images`/`venue_images` + buckets de Storage), y la descripción de sala. |
| `0006_door_sales_checkin_payments.sql` | Agrega la caja (`cash_shifts`, apertura/cierre con arqueo), el método de pago de cada reserva (Mercado Pago / efectivo / simulado), y el check-in por QR (`checked_in_at`, `check_in_reservation`). |
| `0007_checkin_capacity_soldout.sql` | Check-in con estados adentro/salió/cancelar (con historial); una sala no puede tener dos eventos en la misma fecha y hora; corte de venta 30 min después de empezada la función; "Agotado" automático o manual; salas de entrada general (sin mapa de butacas). |
| `0008_fixes_payments_settings.sql` | Fix del bug "seat_id is ambiguous" en `hold_seats`; método de pago "transferencia" en la venta en puerta; borrado de reservas expiradas; sync de capacidad para entrada general; tabla `site_settings` para personalizar el sitio desde el admin. |
| `0009_sponsors_checkin_refunds.sql` | Sponsors por evento (`event_sponsors`); check-in en dos pasos (`lookup_reservation_checkin` / `confirm_reservation_checkin`); `events.checkin_enabled` para habilitar el ingreso solo al evento correspondiente; devolución de entradas (`refund_reservation`, ajusta `close_cash_shift`). |
| `0010_shows_and_funciones.sql` | **La más grande.** Separa "el evento" (tabla nueva `shows`: título, descripción, imágenes, sponsors, sala) de "cada función" (`events`: fecha/hora puntual — sigue siendo la unidad de venta). Migra los eventos existentes a shows con una función cada uno, sin pérdida de datos. |
| `0011_shared_cash_shift_and_doors.sql` | La caja deja de estar atada a un evento puntual (se abre una vez, se vende para cualquier evento publicado). El lector de QR se puede "fijar" a un evento — si hay más de uno habilitado, rechaza entradas de otro evento habilitado que no sea el de ese lector ("puerta equivocada"). |
| `0012_venue_sort_order.sql` | Agrega `sort_order` a las salas, para poder elegir cuál aparece primero en "Salas" (antes era siempre alfabético). |
| `0013_general_admission_oversell.sql` | Permite sobreventa en salas de entrada general desde la venta en puerta — el cajero confirma explícitamente, avisado de cuánto se supera la capacidad. |

### `supabase/functions/` — Edge Functions (código de servidor)

| Archivo | Para qué sirve |
|---|---|
| `_shared/cors.ts` | Código compartido entre funciones: headers CORS, y `getServiceRoleKey()` (obtiene la clave de servidor sin importar si tu proyecto usa el sistema de claves viejo o nuevo de Supabase). |
| `create-payment-preference/index.ts` | Arma la preferencia de pago en Mercado Pago para una reserva y devuelve el link de pago. |
| `mp-webhook/index.ts` | Recibe la confirmación de pago de Mercado Pago. Es el ÚNICO lugar donde una butaca pasa a "vendida" por un pago online, y donde se dispara el email de confirmación (con el QR). |
| `mock-confirm-payment/index.ts` | Confirma una reserva al instante sin Mercado Pago — solo funciona si el secret `PAYMENT_MODE=mock` está seteado. Para probar el resto del flujo sin pagos reales. |
| `create-door-sale/index.ts` | Venta en puerta: retiene butacas, crea la reserva y la marca pagada en efectivo contra una caja abierta, todo en un paso. Devuelve el QR de la entrada. Requiere admin logueado. |
| `get-reservation-status/index.ts` | Consulta el estado de una reserva (la usa la pantalla de resultado del pago). |
| `release-expired-holds/index.ts` | Libera butacas cuyo hold de 10 minutos venció. Alternativa a `pg_cron` si tu plan de Supabase no lo soporta. |
| `_shared/qr.ts` | Genera el QR (PNG en base64) de una reserva — lo usan `mp-webhook`, `mock-confirm-payment` y `create-door-sale`. |
| `_shared/email.ts` | Arma y envía el mail de confirmación de compra, con el QR incrustado y adjunto. |

---

## ¿Dónde toco esto...?

- **"Quiero cambiar el nombre del sitio / el logo / los colores"** → `src/site.config.js`
- **"Quiero cambiar un texto que ve el comprador"** → `src/site.config.js` (sección `texts`); si el texto no está ahí todavía, buscalo en la página correspondiente dentro de `src/pages/`
- **"El mapa de butacas se ve raro"** → `src/components/SeatMap.jsx` (mapa del comprador) o `src/components/admin/VenueEditor.jsx` (editor del admin)
- **"Quiero vender entradas en la puerta el día del evento"** → pestaña "Venta en puerta" en el admin (`DoorSalesTab.jsx`) — primero hay que "Abrir caja"
- **"El lector de QR no reconoce la cámara"** → revisá que el sitio esté en HTTPS (los navegadores bloquean la cámara en HTTP) y los permisos de cámara del navegador; como respaldo está el modo "Ingresar código a mano" en `QrScannerTab.jsx`
- **"Quiero activar/desactivar los pagos simulados"** → `VITE_PAYMENT_MODE` en tu `.env` + el secret `PAYMENT_MODE` en Supabase (ver SETUP.md, Parte 2.5)
- **"¿Cómo publico un cambio nuevo?"** → `./scripts/deploy.sh "mensaje"` (ver SETUP.md, Parte 7) — sube a GitHub, aplica migraciones en Supabase y redespliega las Edge Functions; Render se despliega solo
- **"Quiero cambiar el nombre, el logo o los colores sin tocar código"** → Admin → pestaña "Personalizar sitio" — se aplica al instante, sin rebuild
- **"Quiero agregar sponsors/auspiciantes a un evento"** → botón con ícono de maletín en la fila del evento, en la pestaña "Eventos" del admin
- **"El lector de QR dice que el ingreso no está habilitado"** → activá el evento correspondiente en la pestaña "Abrir puerta"
- **"Necesito devolver una entrada vendida en puerta"** → pestaña "Venta en puerta" → botón "Devolver entrada" (busca por nombre, requiere caja abierta)
- **"Quiero que una sala aparezca primero que otra en 'Salas'"** → admin → pestaña "Salas" → flechas arriba/abajo en cada tarjeta
- **"La misma obra se hace varios días, ¿cómo cargo eso?"** → creá el evento una vez, y desde su fila en "Eventos" usá "Agregar función" para cada fecha/horario nuevo — comparten título, imágenes y sponsors, pero cada uno tiene su propio mapa de butacas y precios
- **"Quiero agregar un dato al formulario de compra"** → `src/pages/CheckoutPage.jsx` + `create_pending_reservation` en `0001_init.sql` (para guardarlo) + `create-payment-preference/index.ts` (si tiene que viajar a Mercado Pago)
- **"Un botón del admin no hace lo que debería"** → buscá el componente en `src/components/admin/`
- **"Quiero cambiar el footer (redes sociales, teléfono, email)"** → `src/site.config.js` (sección `footer`) — no hace falta tocar `Footer.jsx`
- **"Las imágenes de un evento o sala no se ven"** → revisá que corriste `0005_images_and_venue_description.sql` y que los buckets `event-images`/`venue-images` existan en Supabase → Storage
- **"Cambié algo y ahora la base de datos se queja"** → revisá las migraciones en `supabase/migrations/`, capaz falta correr alguna
- **"El pago no anda / el webhook no confirma"** → `supabase/functions/create-payment-preference/` y `supabase/functions/mp-webhook/`, y los secrets configurados (ver `SETUP.md`)
