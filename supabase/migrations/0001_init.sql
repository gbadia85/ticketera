-- =====================================================================
-- BUTACA — Esquema inicial
-- Sistema de venta de entradas y reserva de asientos para teatros
-- =====================================================================
-- Este archivo se ejecuta una sola vez para crear todo el esquema.
-- Ver SETUP.md para instrucciones de cómo aplicarlo en tu proyecto
-- Supabase (Dashboard > SQL Editor, o con la CLI: supabase db push).
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- TABLAS
-- =====================================================================

-- Salas / Teatros
create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  capacity int,
  created_at timestamptz not null default now()
);

-- Zonas de precio dentro de una sala (Ej: Platea, VIP, Palco)
create table if not exists seat_zones (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  color text not null default '#C9A227',
  default_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Butacas físicas de una sala (el layout gráfico)
create table if not exists seats (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  zone_id uuid references seat_zones(id) on delete set null,
  row_label text not null,
  seat_number int not null,
  pos_row int not null,
  pos_col int not null,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (venue_id, pos_row, pos_col)
);

-- Eventos (obra + sala + fecha)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete restrict,
  title text not null,
  description text,
  event_date timestamptz not null,
  status text not null default 'draft' check (status in ('draft','scheduled','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Override opcional de precio por zona para un evento puntual
create table if not exists event_zone_prices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  zone_id uuid not null references seat_zones(id) on delete cascade,
  price numeric(10,2) not null,
  unique (event_id, zone_id)
);

-- Estado de cada butaca PARA UN EVENTO PUNTUAL. Esta es la tabla
-- "fuente de verdad" que ve el mapa interactivo en tiempo real.
create table if not exists event_seats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  seat_id uuid not null references seats(id) on delete cascade,
  zone_id uuid references seat_zones(id),
  price numeric(10,2) not null default 0,
  status text not null default 'available' check (status in ('available','held','sold')),
  held_by text,
  held_until timestamptz,
  reservation_id uuid,
  updated_at timestamptz not null default now(),
  unique (event_id, seat_id)
);

-- Reservas (una compra, con uno o más butacas)
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  session_id text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  dni text,
  phone text,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired')),
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table event_seats
  add constraint event_seats_reservation_fk
  foreign key (reservation_id) references reservations(id) on delete set null;

-- Detalle de butacas dentro de una reserva (precio congelado al momento de reservar)
create table if not exists reservation_seats (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  event_seat_id uuid not null references event_seats(id),
  price numeric(10,2) not null
);

create index if not exists idx_seats_venue on seats(venue_id);
create index if not exists idx_event_seats_event on event_seats(event_id);
create index if not exists idx_event_seats_status on event_seats(event_id, status);
create index if not exists idx_events_venue on events(venue_id);
create index if not exists idx_reservations_event on reservations(event_id);

-- =====================================================================
-- REALTIME: el mapa de butacas se suscribe a cambios en event_seats
-- =====================================================================
alter publication supabase_realtime add table event_seats;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table venues enable row level security;
alter table seat_zones enable row level security;
alter table seats enable row level security;
alter table events enable row level security;
alter table event_zone_prices enable row level security;
alter table event_seats enable row level security;
alter table reservations enable row level security;
alter table reservation_seats enable row level security;

-- Lectura pública de catálogo (venues, zonas, butacas)
create policy "public read venues" on venues for select using (true);
create policy "public read seat_zones" on seat_zones for select using (true);
create policy "public read seats" on seats for select using (true);

-- Eventos: el público solo ve los publicados/finalizados; el admin ve todo
create policy "public read published events" on events
  for select using (status in ('scheduled','completed') or auth.role() = 'authenticated');

-- event_zone_prices: solo el admin necesita verlos (detalle interno de pricing)
create policy "admin read event_zone_prices" on event_zone_prices
  for select using (auth.role() = 'authenticated');

-- event_seats: lectura pública (es lo que pinta el mapa interactivo)
create policy "public read event_seats" on event_seats for select using (true);

-- Administración (venues, zonas, butacas, eventos, precios): solo usuarios
-- autenticados (= admins). Este proyecto asume que cualquier cuenta que
-- crees en Supabase Auth es un administrador del sistema: ver SETUP.md
-- para crear tu usuario admin.
create policy "admin write venues" on venues for insert with check (auth.role() = 'authenticated');
create policy "admin update venues" on venues for update using (auth.role() = 'authenticated');
create policy "admin delete venues" on venues for delete using (auth.role() = 'authenticated');

create policy "admin write seat_zones" on seat_zones for insert with check (auth.role() = 'authenticated');
create policy "admin update seat_zones" on seat_zones for update using (auth.role() = 'authenticated');
create policy "admin delete seat_zones" on seat_zones for delete using (auth.role() = 'authenticated');

create policy "admin write seats" on seats for insert with check (auth.role() = 'authenticated');
create policy "admin update seats" on seats for update using (auth.role() = 'authenticated');
create policy "admin delete seats" on seats for delete using (auth.role() = 'authenticated');

create policy "admin write events" on events for insert with check (auth.role() = 'authenticated');
create policy "admin update events" on events for update using (auth.role() = 'authenticated');
create policy "admin delete events" on events for delete using (auth.role() = 'authenticated');

create policy "admin write event_zone_prices" on event_zone_prices for insert with check (auth.role() = 'authenticated');
create policy "admin update event_zone_prices" on event_zone_prices for update using (auth.role() = 'authenticated');
create policy "admin delete event_zone_prices" on event_zone_prices for delete using (auth.role() = 'authenticated');

create policy "admin read reservations" on reservations for select using (auth.role() = 'authenticated');
create policy "admin read reservation_seats" on reservation_seats for select using (auth.role() = 'authenticated');

-- IMPORTANTE: event_seats, reservations y reservation_seats NO tienen
-- policies de insert/update/delete para anon ni authenticated. Todas las
-- escrituras pasan exclusivamente por las funciones SECURITY DEFINER de
-- abajo (que validan las reglas de negocio) o por las Edge Functions que
-- usan la service_role key (create-payment-preference, mp-webhook).

-- =====================================================================
-- FUNCIONES DE NEGOCIO (SECURITY DEFINER)
-- =====================================================================

-- Publica un evento: crea las filas de event_seats a partir del layout
-- de la sala y los precios (override de evento o precio default de zona).
-- Se puede volver a llamar de forma segura (idempotente) si se agregan
-- butacas nuevas a la sala antes de la primera venta.
create or replace function publish_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id from events where id = p_event_id;
  if v_venue_id is null then
    raise exception 'event_not_found';
  end if;

  insert into event_seats (event_id, seat_id, zone_id, price, status)
  select
    p_event_id,
    s.id,
    s.zone_id,
    coalesce(ezp.price, sz.default_price, 0),
    'available'
  from seats s
  left join seat_zones sz on sz.id = s.zone_id
  left join event_zone_prices ezp on ezp.event_id = p_event_id and ezp.zone_id = s.zone_id
  where s.venue_id = v_venue_id and s.is_active = true
  on conflict (event_id, seat_id) do nothing;

  update events set status = 'scheduled', updated_at = now() where id = p_event_id;
end;
$$;

-- Retiene butacas para un comprador anónimo (identificado por session_id)
-- durante p_hold_minutes. Es todo-o-nada: si una sola butaca no está
-- disponible, se aborta toda la operación (no quedan holds parciales).
create or replace function hold_seats(
  p_event_id uuid,
  p_seat_ids uuid[],
  p_session_id text,
  p_hold_minutes int default 10
)
returns table (event_seat_id uuid, seat_id uuid, held_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_seat_ids is null or array_length(p_seat_ids, 1) is null then
    raise exception 'no_seats_requested';
  end if;

  -- Bloqueamos las filas involucradas para evitar carreras entre dos
  -- compradores seleccionando la misma butaca al mismo tiempo.
  select count(*) into v_count
  from event_seats
  where event_id = p_event_id and seat_id = any(p_seat_ids)
  for update;

  if v_count <> array_length(p_seat_ids, 1) then
    raise exception 'seat_not_found';
  end if;

  if exists (
    select 1
    from event_seats
    where event_id = p_event_id
      and seat_id = any(p_seat_ids)
      and (
        status = 'sold'
        or (status = 'held' and held_by <> p_session_id and held_until > now())
      )
  ) then
    raise exception 'seat_unavailable';
  end if;

  update event_seats
  set status = 'held',
      held_by = p_session_id,
      held_until = now() + (p_hold_minutes || ' minutes')::interval,
      updated_at = now()
  where event_id = p_event_id and seat_id = any(p_seat_ids);

  return query
  select es.id, es.seat_id, es.held_until
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids);
end;
$$;

-- Libera las butacas retenidas por una sesión (el comprador se arrepiente
-- o vuelve para atrás antes de pagar).
create or replace function release_seats(p_event_id uuid, p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update event_seats
  set status = 'available', held_by = null, held_until = null, updated_at = now()
  where event_id = p_event_id and held_by = p_session_id and status = 'held';
end;
$$;

-- Crea la reserva "pending" con los datos del comprador, a partir de las
-- butacas que esa sesión tiene actualmente retenidas. Devuelve el id de
-- reserva y el total a cobrar, para pasar a crear la preferencia de pago.
create or replace function create_pending_reservation(
  p_event_id uuid,
  p_session_id text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_dni text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_total numeric(10,2);
  v_seat_count int;
begin
  select count(*), coalesce(sum(price), 0)
  into v_seat_count, v_total
  from event_seats
  where event_id = p_event_id
    and held_by = p_session_id
    and status = 'held'
    and held_until > now();

  if v_seat_count = 0 then
    raise exception 'hold_expired';
  end if;

  insert into reservations (
    event_id, session_id, first_name, last_name, email, dni, phone, total_amount, status
  ) values (
    p_event_id, p_session_id, p_first_name, p_last_name, p_email, p_dni, p_phone, v_total, 'pending'
  ) returning id into v_reservation_id;

  insert into reservation_seats (reservation_id, event_seat_id, price)
  select v_reservation_id, id, price
  from event_seats
  where event_id = p_event_id and held_by = p_session_id and status = 'held' and held_until > now();

  update event_seats
  set reservation_id = v_reservation_id, updated_at = now()
  where event_id = p_event_id and held_by = p_session_id and status = 'held' and held_until > now();

  return jsonb_build_object(
    'reservation_id', v_reservation_id,
    'total', v_total,
    'seat_count', v_seat_count
  );
end;
$$;

-- Limpieza periódica: libera butacas cuyo hold venció sin que se haya
-- confirmado el pago, y marca como 'expired' la reserva pendiente asociada.
create or replace function release_expired_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released int;
begin
  update reservations
  set status = 'expired', updated_at = now()
  where status = 'pending'
    and id in (
      select reservation_id from event_seats
      where status = 'held' and held_until < now() and reservation_id is not null
    );

  update event_seats
  set status = 'available', held_by = null, held_until = null, reservation_id = null, updated_at = now()
  where status = 'held' and held_until < now();

  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

grant execute on function hold_seats(uuid, uuid[], text, int) to anon, authenticated;
grant execute on function release_seats(uuid, text) to anon, authenticated;
grant execute on function create_pending_reservation(uuid, text, text, text, text, text, text) to anon, authenticated;
grant execute on function publish_event(uuid) to authenticated;
grant execute on function release_expired_holds() to service_role;

-- =====================================================================
-- TAREA PROGRAMADA (pg_cron): libera holds vencidos cada minuto.
-- Si tu plan de Supabase no tiene pg_cron disponible, comentá este
-- bloque y usá en su lugar la Edge Function `release-expired-holds`
-- invocada por un cron externo (ver SETUP.md).
-- =====================================================================
create extension if not exists pg_cron;

select
  cron.schedule(
    'release-expired-holds-every-minute',
    '* * * * *',
    $$select release_expired_holds();$$
  )
where not exists (
  select 1 from cron.job where jobname = 'release-expired-holds-every-minute'
);
