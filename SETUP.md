# Guía paso a paso: de cero a vendiendo entradas

Esta guía asume que nunca usaste Supabase ni Mercado Pago Developers.
Andá haciendo los pasos en orden; cada uno depende del anterior.
Calculá 1-2 horas la primera vez (la mayor parte es esperar a que se
creen cosas y copiar/pegar claves).

---

## Parte 1 — Crear tu proyecto de Supabase (la base de datos)

1. Andá a [supabase.com](https://supabase.com) y creá una cuenta
   (podés entrar con GitHub o Google).
2. Click en **New project**.
   - **Name**: por ejemplo `butaca-teatro`.
   - **Database Password**: generá una y **guardala en un lugar seguro**
     (un gestor de contraseñas). La vas a necesitar poco, pero si la
     perdés hay que resetearla.
   - **Region**: elegí la más cercana a tus usuarios. Para Argentina,
     `South America (São Paulo)` suele ser la mejor opción disponible.
   - Plan **Free** alcanza perfectamente para arrancar.
3. Esperá 1-2 minutos a que Supabase termine de aprovisionar el
   proyecto.

### 1.1 — Obtener las claves de API

Heads up: Supabase cambió su sistema de claves. Si tu proyecto lo creaste
**a partir de noviembre de 2025** (o sea, casi seguro el tuyo), en
**Project Settings → API Keys** NO vas a ver las clásicas `anon` /
`service_role` — vas a ver dos pestañas:

- **API Keys** (la que te va a abrir por defecto): acá están las claves
  nuevas — **Publishable key** (empieza con `sb_publishable_...`) y
  **Secret keys** (empiezan con `sb_secret_...`).
- **Legacy API Keys**: solo tiene contenido si tu proyecto es viejo (de
  antes de noviembre 2025). Si la abrís y no hay nada ahí, es normal:
  tu proyecto nació directamente con el sistema nuevo.

Este proyecto ya está preparado para funcionar con cualquiera de los
dos sistemas, así que no importa cuál te toque. Lo que necesitás copiar:

1. Andá a **Project Settings** (ícono de engranaje) → **API Keys**.
2. Copiá el **Project URL** (arriba de todo en esa misma pantalla, o
   en el botón verde **Connect** de la barra superior del proyecto) —
   es algo como `https://abcdefgh.supabase.co`.
3. En la pestaña **API Keys**, copiá el valor de **Publishable key**
   (`sb_publishable_...`). Si todavía no la generaste, vas a ver un
   botón **Create new API keys**: hacé clic, esto crea la Publishable
   key y una Secret key juntas, sin afectar nada más.
   - Si en cambio tu proyecto es viejo y tenés la pestaña **Legacy API
     Keys** con contenido, usá ahí la clave **anon public** en su
     lugar — funciona exactamente igual para este proyecto.
4. **No necesitás copiar la Secret key a ningún lado vos mismo.** Las
   Edge Functions la reciben automáticamente de Supabase (por eso el
   código busca primero `SUPABASE_SECRET_KEYS`/`SUPABASE_SERVICE_ROLE_KEY`
   como variables de entorno ya provistas, nunca hace falta pegarla en
   `.env` ni en ningún secret manual).
5. En la carpeta del proyecto (la carpeta descomprimida del zip, la que
   tiene `package.json` en la raíz), copiá `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
6. Completá `.env` con el Project URL y la Publishable key (o `anon
   public` si te tocó el sistema legacy) que copiaste en el paso 3:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_....
   ```
   (el nombre de la variable dice "ANON_KEY" por costumbre, pero
   funciona igual con la Publishable key nueva — es solo el nombre que
   usa este proyecto para "la clave pública del cliente")

> Esta clave es pública a propósito (viaja al navegador del comprador).
> Lo que la protege es Row Level Security, que ya viene configurado en
> la migración SQL. La **Secret key** (o `service_role`) nunca va en el
> frontend ni en `.env` — esa la usan únicamente las Edge Functions, de
> forma automática.

### 1.2 — Crear el esquema de la base de datos

La forma más simple, sin instalar nada:

1. En el dashboard de Supabase, andá a **SQL Editor** (ícono de rayo/
   consola en el menú lateral).
2. Click en **New query**.
3. Abrí el archivo `supabase/migrations/0001_init.sql` de este
   proyecto, copiá **todo** el contenido, y pegalo en el editor.
4. Click en **Run** (o Ctrl/Cmd+Enter).

Si todo salió bien, no debería haber errores. Si te da un error en el
bloque de `pg_cron` al final (parte "TAREA PROGRAMADA"), es porque tu
proyecto necesita que actives la extensión manualmente primero:
- Andá a **Database** → **Extensions**, buscá `pg_cron`, activala.
- Volvé al SQL Editor y corré de nuevo *solo* la última parte del
  archivo (desde `create extension if not exists pg_cron;` hasta el
  final).

Si preferís no usar `pg_cron` en absoluto, está bien: simplemente no
corras esa última parte, y usá en su lugar la Edge Function
`release-expired-holds` con un cron externo (ver Parte 5, al final).

### 1.2.1 — Aplicar la migración 0002 (correcciones y zona de peligro)

Si ya habías corrido `0001_init.sql` antes de esta actualización, andá
también al SQL Editor y corré **`supabase/migrations/0002_fixes_and_admin_tools.sql`**
completo. Corrige:
- El error "column reference seat_id is ambiguous" al reservar butacas.
- No poder borrar una zona de precio ya usada por algún evento.
- Agrega las funciones que usa la pestaña **Peligro** del admin (borrar
  todos los eventos / todas las salas / resetear la base completa).

Es seguro correrlo aunque ya hayas cargado datos: no borra nada por sí
solo, solo reemplaza funciones y ajusta una restricción de la base.

### 1.2.2 — Aplicar las migraciones 0003 y 0004

Dos correcciones más, también seguras de correr con datos ya cargados:

- **`0003_fix_hold_seats_for_update.sql`**: corrige "FOR UPDATE is not
  allowed with aggregate functions" al reservar butacas.
- **`0004_swap_seat_positions.sql`**: agrega la posibilidad de mover
  butacas de lugar en el editor de sala (para armar formas en U,
  herradura, etc.).

Corré cada una completa en el SQL Editor, en orden.

### 1.2.3 — Aplicar la migración 0005 (imágenes de eventos y salas)

Agrega la posibilidad de subir imágenes desde el panel de admin (hasta
5 por evento, y las que quieras por sala), la descripción de sala, y la
nueva sección pública "Salas".

Corré **`supabase/migrations/0005_images_and_venue_description.sql`**
completo en el SQL Editor. Esta migración además:

- Crea dos buckets de Storage (`event-images` y `venue-images`),
  públicos para lectura y con escritura restringida a usuarios
  autenticados (tu cuenta de admin).
- Si tu proyecto de Supabase tiene Storage deshabilitado o restringido
  por algún límite de tu plan, revisá en el Dashboard → Storage que los
  dos buckets se hayan creado correctamente antes de subir imágenes.

Es seguro correrla aunque ya tengas datos cargados.

### 1.2.4 — Aplicar la migración 0006 (caja, venta en puerta, check-in QR)

Agrega todo lo necesario para vender entradas en la puerta el día del
evento y controlar el ingreso con lector de QR: la tabla de caja
(`cash_shifts`, con apertura/cierre y arqueo), y las columnas y
funciones para marcar el check-in de cada entrada.

Corré **`supabase/migrations/0006_door_sales_checkin_payments.sql`**
completo en el SQL Editor.

### 1.2.5 — Aplicar la migración 0007 (check-in con salida/cancelar, agotado, entrada general)

Agrega:
- Check-in con estados "adentro" / "salió" / cancelar (con historial completo).
- Una sala no puede tener dos eventos en la misma fecha y hora.
- Corte de venta 30 minutos después de empezada la función.
- "Agotado" automático (no quedan lugares) o marcado a mano desde el admin.
- Salas de entrada general (sin mapa de butacas), con venta por cantidad
  hasta la capacidad de la sala.

Corré **`supabase/migrations/0007_checkin_capacity_soldout.sql`**
completo en el SQL Editor. Es seguro correrla aunque ya tengas datos cargados.

### 1.2.6 — Aplicar la migración 0008 (fix de reservas + pagos en puerta + personalización)

Esta corrige un bug importante: si probaste reservar butacas y te
apareció el error **"column reference seat_id is ambiguous"**, es por
esto — corré esta migración para arreglarlo.

Además agrega:
- Diferenciar en la venta en puerta: contado / transferencia / otro medio.
- Borrar reservas expiradas desde la Zona de Peligro (y que las demás
  acciones de esa pestaña también vacíen las imágenes de Storage, no
  solo las filas de la base).
- Que subir la capacidad de una sala de entrada general destrabe el
  "Agotado" automáticamente.
- La tabla `site_settings` para personalizar nombre, logo y colores
  desde el admin (pestaña "Personalizar sitio").

Corré **`supabase/migrations/0008_fixes_payments_settings.sql`**
completo en el SQL Editor.

### 1.3 — (Opcional) Cargar datos de ejemplo

Si querés una sala y un evento de prueba ya armados para no cargar todo
a mano la primera vez:

1. SQL Editor → New query.
2. Pegá el contenido de `supabase/seed_demo.sql` y ejecutalo.
3. Esto crea "Teatro Ejemplo" con 50 butacas en 3 zonas, y un evento de
   prueba ya publicado. Vas a verlo enseguida en la cartelera pública.

### 1.4 — Crear tu usuario administrador

El panel `/admin` de la app usa el login de Supabase Auth. Cualquier
cuenta que crees ahí es administradora del sistema.

1. Andá a **Authentication** → **Users**.
2. Click **Add user** → **Create new user**.
3. Cargá tu email y una contraseña. Dejá tildado **Auto Confirm User**
   (así no depende de que llegue un mail de verificación).
4. Guardá. Con ese email/contraseña vas a entrar en `/admin` en la app.

---

## Parte 2 — Desplegar las Edge Functions (el "backend")

Estas funciones son las que hablan con Mercado Pago y con el servicio
de email. Necesitás la Supabase CLI para subirlas.

### 2.1 — Instalar la CLI y conectarla a tu proyecto

```bash
npm install -g supabase
supabase login
```

Se abre el navegador para autorizar. Después, desde la carpeta del
proyecto:

```bash
supabase link --project-ref TU-PROJECT-REF
```

`TU-PROJECT-REF` es la parte de tu Project URL antes de `.supabase.co`
(ej: si tu URL es `https://abcdefgh.supabase.co`, el ref es `abcdefgh`).
Te va a pedir la Database Password que guardaste en la Parte 1.

### 2.2 — Desplegar las funciones

```bash
supabase functions deploy create-payment-preference
supabase functions deploy mp-webhook
supabase functions deploy get-reservation-status
supabase functions deploy release-expired-holds
supabase functions deploy mock-confirm-payment
supabase functions deploy create-door-sale
```

Anotá la URL base que te va a hacer falta más adelante:
`https://TU-PROJECT-REF.supabase.co/functions/v1/mp-webhook`

---

## Parte 2.5 — (Opcional) Pagos simulados, para probar sin Mercado Pago todavía

Si todavía no querés meterte con Mercado Pago y preferís probar primero
el resto del sistema (venta en puerta, mail con QR, check-in), podés
activar el modo de pago simulado: al comprador que toca "Pagar" se le
confirma la compra al instante, sin ir a ninguna pasarela real.

1. En tu `.env` local (y en las variables de entorno de Render cuando
   despliegues), agregá:
   ```
   VITE_PAYMENT_MODE=mock
   ```
2. En Supabase, seteá el secret que habilita esto también del lado del
   servidor (la función se niega a confirmar pagos si este secret no
   está, aunque alguien intente llamarla directo):
   ```bash
   supabase secrets set PAYMENT_MODE=mock
   ```

**Para volver a pagos reales más adelante**: sacá `VITE_PAYMENT_MODE`
del `.env` (o poné `VITE_PAYMENT_MODE=mercadopago`), y en Supabase
corré `supabase secrets unset PAYMENT_MODE` (o seteala en cualquier
valor que no sea `mock`). No hace falta tocar código en ningún lado.

---

## Parte 3 — Crear tu cuenta de Mercado Pago Developers

1. Andá a [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers/panel)
   e ingresá con tu cuenta de Mercado Pago (si no tenés, creá una).
2. En el panel, creá una aplicación nueva ("Crear aplicación"):
   - Nombre: el que quieras (ej: "Butaca Teatro").
   - Tipo de integración: elegí **Checkout Pro** (o "Pagos online" /
     "Pagos presenciales y online" según cómo lo presente el panel en
     el momento; lo que necesitás es una app con credenciales de
     Checkout Pro).
3. Dentro de tu aplicación, andá a **Credenciales de producción** y
   **Credenciales de prueba** (test). **Para probar todo el flujo sin
   plata real, arrancá con las de prueba.**
   - Vas a ver un **Access Token** y una **Public Key** para cada
     ambiente (prueba/producción). El que necesita este proyecto es el
     **Access Token**.

### 3.1 — Crear cuentas de prueba (comprador y vendedor)

Para probar una compra de punta a punta sin usar plata real, Mercado
Pago te deja crear "usuarios de prueba":

1. En tu aplicación → **Cuentas de prueba** (a veces aparece como
   "Usuarios de prueba" o dentro de "Prueba de integración").
2. Creá una cuenta de prueba **vendedora** y una **compradora**
   (podés usar el Access Token de la cuenta vendedora de prueba como tu
   `MP_ACCESS_TOKEN` para testear, y loguearte como la compradora al
   momento de pagar).
3. Documentación oficial con el paso a paso actualizado:
   https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integration-test/test-purchases

### 3.2 — Configurar el webhook de notificaciones

Este paso es el que le avisa a tu sistema que un pago se aprobó.

1. En tu aplicación → **Webhooks** → **Configurar notificaciones**.
2. Pestaña **Modo productivo** (las notificaciones de prueba usan la
   misma URL): pegá
   `https://TU-PROJECT-REF.supabase.co/functions/v1/mp-webhook`
3. Marcá el evento **Pagos** (payments).
4. Guardá. Mercado Pago te va a mostrar una **clave secreta** — copiala,
   es tu `MP_WEBHOOK_SECRET`.

### 3.3 — Guardar los secrets en Supabase

Estas claves nunca van en `.env` del frontend — solo las usan las Edge
Functions, del lado del servidor:

```bash
supabase secrets set MP_ACCESS_TOKEN=TEST-xxxxxxxx-xxxx-xxxx
supabase secrets set MP_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
supabase secrets set FRONTEND_URL=http://localhost:3000
```

(Vas a actualizar `FRONTEND_URL` más adelante cuando tengas tu dominio
real de producción — ver Parte 5).

---

## Parte 4 — Emails de confirmación con Resend

1. Creá una cuenta gratis en [resend.com](https://resend.com).
2. **API Keys** → **Create API Key**. Copiala.
3. Para probar YA, sin verificar un dominio propio, Resend te deja
   enviar desde `onboarding@resend.dev` (solo a tu propio email
   registrado en Resend, ideal para probar el flujo). Para enviar a
   cualquier comprador en producción vas a necesitar verificar tu
   propio dominio en **Domains** (agregar unos registros DNS — Resend
   te los muestra paso a paso).
4. Guardá los secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set EMAIL_FROM="Butaca <onboarding@resend.dev>"
   ```
   (cuando tengas dominio propio verificado, cambiá `EMAIL_FROM` a algo
   como `"Butaca <entradas@tudominio.com>"`)

---

## Parte 5 — Probar todo el flujo localmente

```bash
npm install
npm run dev
```

1. Abrí `http://localhost:3000/admin`, entrá con el usuario que creaste
   en 1.4.
2. Pestaña **Salas**: creá una sala, agregá zonas de precio, generá la
   grilla de butacas, pintá zonas.
3. Pestaña **Eventos**: creá un evento para esa sala, configurá precios
   por zona y publicalo.
4. Abrí `http://localhost:3000` en otra pestaña (o navegador
   incógnito), entrá al evento, seleccioná butacas, completá tus datos
   y pagá.
5. En la pantalla de Mercado Pago, si estás con credenciales de
   prueba, iniciá sesión con tu **cuenta de prueba compradora** y usá
   una tarjeta de prueba. Tarjetas y cómo simular distintos resultados
   (aprobado, rechazado, pendiente):
   https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integration-test/test-cards
6. Deberías volver a `/pago/resultado`, ver la confirmación, y recibir
   el email (revisá spam).
7. En el panel admin, pestaña **Reservas**, vas a ver la reserva con
   estado "Aprobada".

### Si no usás pg_cron para liberar holds vencidos

Programá un cron externo gratuito (ej. [cron-job.org](https://cron-job.org))
que llame cada 1 minuto a:
```
POST https://TU-PROJECT-REF.supabase.co/functions/v1/release-expired-holds
Header: Authorization: Bearer TU_ANON_KEY
```

---

## Parte 6 — Pasar a producción

1. **Desplegá el frontend.** Cualquier hosting de sitios estáticos
   sirve (Vercel, Netlify, Cloudflare Pages, o el hosting estático de
   Hostinger): el comando de build es `npm run build`, que genera una
   carpeta `dist/`. Configurá ahí las mismas variables de entorno
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) que en tu `.env`
   local.
2. Actualizá el secret `FRONTEND_URL` con tu dominio real:
   ```bash
   supabase secrets set FRONTEND_URL=https://tudominio.com
   ```
3. En Mercado Pago, activá tu cuenta para cobrar de verdad (Mercado
   Pago pide algunos datos de tu negocio/CBU la primera vez) y
   reemplazá el secret por tus credenciales de **producción**:
   ```bash
   supabase secrets set MP_ACCESS_TOKEN=APP_USR-xxxxxxxx
   ```
4. Verificá tu dominio en Resend y actualizá `EMAIL_FROM`.
5. Volvé a desplegar las Edge Functions si cambiaste algo de código:
   ```bash
   supabase functions deploy create-payment-preference
   supabase functions deploy mp-webhook
   ```

---

## Parte 7 — Deploy automático con `scripts/deploy.sh`

Una vez que todo funciona localmente, `scripts/deploy.sh` te deja subir
cualquier cambio futuro (código nuevo que te vaya pasando) a GitHub, a
Supabase (migraciones + Edge Functions) y a Render (que se despliega
solo al detectar el push) con un solo comando.

### 7.1 — Paso único antes de usarlo por primera vez

Hasta ahora corriste las migraciones (`0001` a `0006`) a mano, pegándolas
en el SQL Editor de Supabase. El script en cambio usa `supabase db push`,
que lleva un registro de qué migraciones ya se aplicaron — pero como
esas primeras las corriste vos a mano, la CLI todavía no sabe que ya
están aplicadas. Si no le avisás, va a intentar correrlas de nuevo y va
a fallar (con un error de "ya existe", sin romper nada — pero no vas a
poder seguir).

Así que, **una sola vez**, "bautizá" cada migración que ya corriste
como ya aplicada (ejecutá esto desde la carpeta del proyecto, con la
CLI ya logueada y linkeada — Parte 2.1):

```bash
supabase migration repair --status applied 0001
supabase migration repair --status applied 0002
supabase migration repair --status applied 0003
supabase migration repair --status applied 0004
supabase migration repair --status applied 0005
supabase migration repair --status applied 0006
supabase migration repair --status applied 0007
supabase migration repair --status applied 0008
```

Verificá que quedó todo sincronizado:

```bash
supabase migration list
```

Deberías ver las 6 migraciones marcadas como aplicadas tanto local
como remotamente. De acá en más, cualquier migración *nueva* que
agreguemos (`0007...`, `0008...`) se aplica sola con `supabase db push`
— no hace más falta pegar nada a mano en el SQL Editor.

### 7.2 — Usarlo de acá en adelante

Cada vez que te pase archivos nuevos (código y, si corresponde, una
migración `NNNN_algo.sql`), lo que tenés que hacer es:

1. Reemplazar/agregar esos archivos en tu carpeta del proyecto.
2. Correr:
   ```bash
   ./scripts/deploy.sh "lo que cambió, en una frase"
   ```

Eso sube el código a GitHub (Render lo despliega solo), aplica
cualquier migración nueva en Supabase, y redespliega todas las Edge
Functions. Si no le pasás un mensaje, usa la fecha y hora como mensaje
del commit.

Si en tu sistema el archivo no tiene permiso de ejecución (pasa a
veces al descomprimir un zip), corré una vez:
```bash
chmod +x scripts/deploy.sh
```

---

## Problemas comunes

- **El mapa de butacas no se actualiza en tiempo real entre dos
  pestañas**: revisá que la migración haya corrido bien la línea
  `alter publication supabase_realtime add table event_seats;` (SQL
  Editor → podés volver a correr solo esa línea, es segura de repetir).
- **"No pudimos reservar las butacas" todo el tiempo**: revisá en SQL
  Editor con `select * from event_seats where event_id = '...'` si las
  butacas quedaron en estado `held` de una prueba anterior con
  `held_until` en el pasado — si no tenés pg_cron activo, corré
  manualmente `select release_expired_holds();` en el SQL Editor.
- **El webhook nunca confirma el pago**: probá pegar la URL del
  webhook directamente en el navegador — debería responder algo (no
  un error 404/401). Revisá en Mercado Pago → tu aplicación → Webhooks
  si hay notificaciones con error. Revisá los logs de la función en
  Supabase Dashboard → Edge Functions → `mp-webhook` → Logs.
- **"No pudimos iniciar el pago" / mercadopago_error**: la causa más
  común es `FRONTEND_URL` apuntando a `http://localhost:3000` (u otra
  URL no-https) en desarrollo local. Mercado Pago exige que
  `back_url.success` sea una URL https válida para poder redirigir
  automáticamente al comprador tras un pago aprobado (`auto_return`).
  Ya lo resolvimos: si `FRONTEND_URL` no empieza con `https://`, la
  función omite `auto_return` automáticamente (el comprador solo tiene
  que tocar "Volver al sitio" a mano en la pantalla de Mercado Pago).
  Si el error persiste, mirá el mensaje completo: ahora la app muestra
  el detalle real que devuelve Mercado Pago (no un código genérico) —
  revisá los logs de la función en Supabase Dashboard → Edge Functions
  → `create-payment-preference` → Logs para ver el JSON completo.
- **Error de CORS en el frontend**: las Edge Functions ya devuelven
  headers CORS abiertos (`*`); si igual falla, revisá que estés
  llamando a la URL con `/functions/v1/` incluido.
- **Las Edge Functions tiran "No se encontró una service_role key ni
  una secret key"**: pasa si tu proyecto usa el sistema nuevo de claves
  pero por algún motivo la Secret key no está en las variables de
  entorno de la función. Andá a Supabase Dashboard → Edge Functions →
  Secrets y confirmá que exista `SUPABASE_SECRET_KEYS` (se genera solo
  al crear tus API keys en Project Settings → API Keys). No hace falta
  que lo crees vos a mano.
