# Butaca — Venta de entradas y mapa de asientos

Sistema de venta de entradas y reserva de butacas para teatros/salas, con
mapa interactivo, retención temporal de asientos, pago con Mercado Pago y
confirmación por email.

**Antes de tocar código, leé `SETUP.md`.** Ahí está la guía paso a paso
para crear tu cuenta de Supabase y de Mercado Pago, y dejar todo
funcionando. Sin eso, el proyecto no puede hacer nada real (no hay
backend "hardcodeado": todo vive en tu propio proyecto de Supabase).

**¿Buscás qué archivo toca para hacer un cambio puntual?** Mirá
`MANUAL.md` — resume para qué sirve cada archivo del proyecto.

**¿Querés cambiar el nombre del sitio, el logo, los textos o los
colores?** Todo eso vive en un solo archivo: `src/site.config.js`. No
hace falta tocar ningún componente.

## ¿Por qué Supabase y no un backend propio?

Vender entradas con retención de butacas y pago real necesita, sí o sí:
un lugar donde todos los compradores vean el mismo estado de las
butacas (no cada uno en su navegador), una operación atómica que evite
que dos personas compren la misma butaca, y un servidor que reciba la
confirmación de pago de Mercado Pago de forma privada (con tu Access
Token, que nunca debe viajar al navegador del comprador).

Supabase te da todo eso sin que tengas que administrar un servidor:
- **Postgres** como base de datos compartida.
- **Realtime**: el mapa de butacas se actualiza solo en todas las
  pantallas abiertas cuando alguien reserva o compra.
- **Edge Functions**: código de servidor (Deno/TypeScript) para hablar
  con la API de Mercado Pago y con Resend (email) sin exponer ninguna
  clave secreta al navegador.
- **Row Level Security (RLS)**: reglas a nivel de base de datos que
  impiden que alguien manipule precios o estados de butacas desde la
  consola del navegador.

## Arquitectura en una imagen

```
Comprador (React + Vite)
   │  lee butacas en tiempo real (Supabase Realtime)
   │  retiene butacas -> RPC hold_seats()          [Postgres, atómico]
   │  crea reserva    -> RPC create_pending_reservation()
   │  pide preferencia de pago -> Edge Function create-payment-preference
   ▼
Mercado Pago (Checkout Pro)
   │  el comprador paga ahí, no en tu sitio
   ▼
Edge Function mp-webhook  (única fuente de verdad del pago)
   │  confirma o rechaza -> marca butacas 'sold' o las libera
   │  envía email de confirmación (Resend)
   ▼
Comprador vuelve a /pago/resultado -> consulta Edge Function
get-reservation-status hasta ver el resultado final
```

Ninguna butaca pasa a "vendida" por una acción del navegador: solo el
webhook de Mercado Pago, después de verificar el pago contra la propia
API de Mercado Pago, puede hacerlo.

## Estructura del proyecto

```
src/
  components/         Navbar, Footer, SeatMap (mapa interactivo), ui/ (shadcn)
  components/admin/    Editor de salas, eventos, imágenes, reservas
  pages/               Rutas: cartelera, evento, checkout, resultado, salas, admin
  lib/                 supabaseClient, api (CRUD + imágenes), booking (holds/pago), session
  hooks/               useEventSeats (realtime), useCountdown, useAdminAuth

supabase/
  migrations/
    0001_init.sql              Esquema completo: tablas, RLS, funciones
    0002_fixes_and_admin_tools.sql  Fixes + herramientas de borrado masivo
    0005_images_and_venue_description.sql  Imágenes de evento/sala + buckets de Storage
  seed_demo.sql              Datos de ejemplo opcionales
  functions/
    create-payment-preference/   Crea la preferencia de pago en MP
    mp-webhook/                   Confirma el pago (única fuente de verdad)
    get-reservation-status/       Para la pantalla de resultado
    release-expired-holds/        Respaldo si no usás pg_cron
```

`src/lib/seatColors.js` centraliza la paleta de colores de zonas (15
colores fijos, sin rojo ni dorado) y los colores reservados de estado
(vendida = rojo, seleccionada = dorado, no disponible = negro), para
que el mapa de butacas del cliente y el editor del admin usen siempre
los mismos criterios.

## Instalación local

```bash
npm install
cp .env.example .env   # completá con tus datos de Supabase (ver SETUP.md)
npm run dev
```

Abrí `http://localhost:3000`. `/admin` es el panel de administración
(necesita el usuario que crees en Supabase Auth, ver `SETUP.md`).

## Límites conocidos / próximos pasos

- El admin no tiene roles (cualquier cuenta de Supabase Auth que crees
  es administradora). Si vas a sumar más de una persona al equipo,
  conviene agregar una tabla `admin_users` y ajustar las policies.
- Un evento usa el layout de butacas de su sala en el momento en que
  lo publicás. Si después rediseñás el mapa de la sala, los eventos ya
  publicados no cambian (a propósito, para no romper compras hechas).
- Mercado Pago es el único medio de pago integrado. La arquitectura
  (Edge Function separada por proveedor + `external_reference` para
  identificar la reserva) está pensada para poder sumar otro medio de
  pago más adelante sin tocar el resto del sistema.
