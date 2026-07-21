-- =====================================================================
-- BUTACA — Migración 0008
-- =====================================================================

-- ---------------------------------------------------------------------
-- FIX: "column reference seat_id is ambiguous"
--
-- hold_seats() y hold_next_available_seats() declaran
-- `returns table (event_seat_id uuid, seat_id uuid, held_until ...)`.
-- Eso crea, adentro de la función, variables PL/pgSQL implícitas
-- llamadas "seat_id" y "held_until" — con el mismo nombre que las
-- columnas de event_seats. Cualquier referencia SIN alias a esas
-- columnas queda ambigua para Postgres (¿la variable o la columna?).
-- Reemplazamos ambas funciones calificando TODAS las columnas con el
-- alias de tabla, y de paso separamos el lock de filas (FOR UPDATE) de
-- la cuenta agregada (Postgres no permite combinar FOR UPDATE con
-- funciones de agregación como count()).
-- ---------------------------------------------------------------------

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
  v_locked_count int;
  v_event_date timestamptz;
begin
  select e.event_date into v_event_date from events e where e.id = p_event_id;
  if v_event_date is null then
    raise exception 'event_not_found';
  end if;
  if now() > v_event_date + interval '30 minutes' then
    raise exception 'sales_closed';
  end if;

  if p_seat_ids is null or array_length(p_seat_ids, 1) is null then
    raise exception 'no_seats_requested';
  end if;

  -- Bloqueamos las filas primero (sin agregación), contamos aparte.
  perform es.id
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids)
  for update of es;

  select count(*) into v_locked_count
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids);

  if v_locked_count <> array_length(p_seat_ids, 1) then
    raise exception 'seat_not_found';
  end if;

  if exists (
    select 1
    from event_seats es
    where es.event_id = p_event_id
      and es.seat_id = any(p_seat_ids)
      and (
        es.status = 'sold'
        or (es.status = 'held' and es.held_by <> p_session_id and es.held_until > now())
      )
  ) then
    raise exception 'seat_unavailable';
  end if;

  update event_seats es
  set status = 'held',
      held_by = p_session_id,
      held_until = now() + (p_hold_minutes || ' minutes')::interval,
      updated_at = now()
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids);

  return query
  select es.id, es.seat_id, es.held_until
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids);
end;
$$;

create or replace function hold_next_available_seats(
  p_event_id uuid,
  p_quantity int,
  p_session_id text,
  p_hold_minutes int default 10
)
returns table (event_seat_id uuid, seat_id uuid, held_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date timestamptz;
  v_locked_until timestamptz := now() + (p_hold_minutes || ' minutes')::interval;
  v_picked uuid[];
begin
  select e.event_date into v_event_date from events e where e.id = p_event_id;
  if v_event_date is null then
    raise exception 'event_not_found';
  end if;
  if now() > v_event_date + interval '30 minutes' then
    raise exception 'sales_closed';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  select array_agg(sub.id) into v_picked
  from (
    select es.id
    from event_seats es
    join seats s on s.id = es.seat_id
    where es.event_id = p_event_id and es.status = 'available'
    order by s.seat_number
    limit p_quantity
    for update of es skip locked
  ) sub;

  if v_picked is null or array_length(v_picked, 1) < p_quantity then
    raise exception 'not_enough_seats';
  end if;

  update event_seats es
  set status = 'held', held_by = p_session_id, held_until = v_locked_until, updated_at = now()
  where es.id = any(v_picked);

  return query
  select es.id, es.seat_id, es.held_until
  from event_seats es
  where es.id = any(v_picked);
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Venta en puerta: diferenciar contado / transferencia / otro medio
-- ---------------------------------------------------------------------

alter table reservations drop constraint if exists reservations_payment_method_check;
alter table reservations
  add constraint reservations_payment_method_check
  check (payment_method in ('mercadopago', 'efectivo', 'transferencia', 'simulado'));

-- ---------------------------------------------------------------------
-- 2) Reservas expiradas: borrado masivo desde la Zona de Peligro
-- ---------------------------------------------------------------------

create or replace function delete_expired_reservations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count from reservations where status = 'expired';
  delete from reservations where status = 'expired';
  return v_count;
end;
$$;

grant execute on function delete_expired_reservations() to authenticated;

-- ---------------------------------------------------------------------
-- 5) Si aumentás la capacidad de una sala de entrada general, hay que
--    generar más "butacas" virtuales (y sumarlas a los eventos ya
--    publicados de esa sala) para que Agotado se destrabe. Si la
--    capacidad baja, no borramos nada (podría haber entradas vendidas).
-- ---------------------------------------------------------------------

create or replace function sync_general_admission_capacity(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_zone_id uuid;
  v_existing_count int;
  v_price numeric;
begin
  select capacity into v_capacity from venues where id = p_venue_id and general_admission = true;
  if v_capacity is null then
    return; -- no es una sala de entrada general, no hacemos nada
  end if;

  select id, default_price into v_zone_id, v_price
  from seat_zones where venue_id = p_venue_id and name = 'General'
  limit 1;

  if v_zone_id is null then
    return; -- todavía no se publicó ningún evento de entrada general acá
  end if;

  select count(*) into v_existing_count from seats where venue_id = p_venue_id;

  if v_capacity > v_existing_count then
    -- Agrega las butacas virtuales que faltan.
    insert into seats (venue_id, zone_id, row_label, seat_number, pos_row, pos_col, label, is_active)
    select p_venue_id, v_zone_id, 'G', gs, 0, gs, 'Entrada ' || gs, true
    from generate_series(v_existing_count + 1, v_capacity) as gs;

    -- Y las suma también a cualquier evento de esta sala que ya esté
    -- publicado, para que se puedan vender ahora mismo.
    insert into event_seats (event_id, seat_id, zone_id, price, status)
    select e.id, s.id, s.zone_id, coalesce(ezp.price, v_price, 0), 'available'
    from events e
    join seats s on s.venue_id = e.venue_id and s.zone_id = v_zone_id
    left join event_zone_prices ezp on ezp.event_id = e.id and ezp.zone_id = s.zone_id
    where e.venue_id = p_venue_id and e.status = 'scheduled'
    on conflict (event_id, seat_id) do nothing;
  end if;
end;
$$;

grant execute on function sync_general_admission_capacity(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Personalización del sitio desde el admin (nombre, logo, colores)
-- ---------------------------------------------------------------------

create table if not exists site_settings (
  id boolean primary key default true, -- fila única, siempre id = true
  site_name text,
  logo_url text,
  color_primary text,
  color_primary_light text,
  color_primary_dark text,
  color_primary_foreground text,
  color_secondary text,
  color_secondary_foreground text,
  color_background text,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id = true)
);

insert into site_settings (id) values (true) on conflict (id) do nothing;

alter table site_settings enable row level security;
create policy "public read site_settings" on site_settings for select using (true);
create policy "admin update site_settings" on site_settings for update using (auth.role() = 'authenticated');

-- Bucket para el logo del sitio.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy "public read site-assets bucket" on storage.objects
  for select using (bucket_id = 'site-assets');
create policy "admin write site-assets bucket" on storage.objects
  for insert with check (bucket_id = 'site-assets' and auth.role() = 'authenticated');
create policy "admin update site-assets bucket" on storage.objects
  for update using (bucket_id = 'site-assets' and auth.role() = 'authenticated');
create policy "admin delete site-assets bucket" on storage.objects
  for delete using (bucket_id = 'site-assets' and auth.role() = 'authenticated');
