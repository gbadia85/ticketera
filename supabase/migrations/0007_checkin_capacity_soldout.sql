-- =====================================================================
-- BUTACA — Migración 0007
-- Agrega:
--   1) Check-in con estados: "adentro" / "afuera" / cancelar un ingreso
--      por error, con historial completo de movimientos.
--   2) Una sala no puede tener dos eventos (no cancelados) en la misma
--      fecha y hora exacta. La venta de entradas se corta 30 minutos
--      después de la hora de inicio de la función.
--   3) "Agotado": automático (no quedan butacas disponibles) o marcado
--      a mano por el admin.
--   4) Salas de entrada general (sin mapa de butacas): se venden
--      lugares por cantidad, hasta la capacidad de la sala.
-- =====================================================================
-- Corré este archivo completo en el SQL Editor de Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CHECK-IN: entrada / salida / cancelar, con historial
-- ---------------------------------------------------------------------

alter table reservations
  add column if not exists entry_status text not null default 'pending'
  check (entry_status in ('pending', 'inside', 'outside'));

create table if not exists checkin_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  action text not null check (action in ('in', 'out', 'cancel')),
  at timestamptz not null default now(),
  by text
);

create index if not exists idx_checkin_events_reservation on checkin_events(reservation_id);

alter table checkin_events enable row level security;
create policy "admin read checkin_events" on checkin_events for select using (auth.role() = 'authenticated');

-- Reemplaza a la versión de la migración 0006: ahora si la entrada ya
-- está "adentro", NO la vuelve a marcar — devuelve already_inside=true
-- para que la puerta decida (marcar salida, o cancelar el ingreso por
-- error) en vez de aceptarla de nuevo en silencio.
create or replace function check_in_reservation(p_reservation_id uuid, p_checked_in_by text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res reservations;
  v_seats text[];
begin
  select * into v_res from reservations where id = p_reservation_id;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_res.status <> 'approved' then
    return jsonb_build_object('valid', false, 'reason', 'not_paid', 'status', v_res.status);
  end if;

  select array_agg(s.label order by s.label) into v_seats
  from reservation_seats rs
  join event_seats es on es.id = rs.event_seat_id
  join seats s on s.id = es.seat_id
  where rs.reservation_id = p_reservation_id;

  if v_res.entry_status = 'inside' then
    return jsonb_build_object(
      'valid', true,
      'already_inside', true,
      'reservation_id', v_res.id,
      'first_name', v_res.first_name,
      'last_name', v_res.last_name,
      'seat_labels', coalesce(v_seats, array[]::text[]),
      'checked_in_at', v_res.checked_in_at
    );
  end if;

  update reservations
  set entry_status = 'inside', checked_in_at = now(), checked_in_by = p_checked_in_by
  where id = p_reservation_id
  returning checked_in_at into v_res.checked_in_at;

  insert into checkin_events (reservation_id, action, by) values (p_reservation_id, 'in', p_checked_in_by);

  return jsonb_build_object(
    'valid', true,
    'already_inside', false,
    'reservation_id', v_res.id,
    'first_name', v_res.first_name,
    'last_name', v_res.last_name,
    'seat_labels', coalesce(v_seats, array[]::text[]),
    'checked_in_at', v_res.checked_in_at
  );
end;
$$;

grant execute on function check_in_reservation(uuid, text) to authenticated;

-- La persona sale (por ejemplo, salió a fumar) — puede volver a
-- escanear su QR más tarde para reingresar.
create or replace function mark_reservation_exit(p_reservation_id uuid, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update reservations set entry_status = 'outside' where id = p_reservation_id and entry_status = 'inside';
  if not found then
    raise exception 'not_inside';
  end if;
  insert into checkin_events (reservation_id, action, by) values (p_reservation_id, 'out', p_by);
  return jsonb_build_object('ok', true, 'entry_status', 'outside');
end;
$$;

grant execute on function mark_reservation_exit(uuid, text) to authenticated;

-- El escaneo fue un error (QR equivocado, doble tap, etc.): deshace el
-- ingreso y la deja como si nunca hubiera entrado.
create or replace function cancel_reservation_checkin(p_reservation_id uuid, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update reservations
  set entry_status = 'pending', checked_in_at = null, checked_in_by = null
  where id = p_reservation_id and entry_status in ('inside', 'outside');
  if not found then
    raise exception 'not_checked_in';
  end if;
  insert into checkin_events (reservation_id, action, by) values (p_reservation_id, 'cancel', p_by);
  return jsonb_build_object('ok', true, 'entry_status', 'pending');
end;
$$;

grant execute on function cancel_reservation_checkin(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Una sala no puede tener dos eventos (no cancelados) en la misma
--    fecha y hora, y corte de venta 30 minutos después de empezada la
--    función.
-- ---------------------------------------------------------------------

create or replace function check_venue_datetime_conflict()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from events
    where venue_id = new.venue_id
      and event_date = new.event_date
      and status <> 'cancelled'
      and id <> new.id
  ) then
    raise exception 'venue_datetime_conflict';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_venue_datetime_conflict on events;
create trigger trg_check_venue_datetime_conflict
  before insert or update of venue_id, event_date on events
  for each row execute function check_venue_datetime_conflict();

-- Reemplaza la versión de 0001: agrega el corte de venta de 30 minutos
-- después de la hora de la función. El resto del comportamiento es
-- idéntico al original.
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
  v_event_date timestamptz;
begin
  select event_date into v_event_date from events where id = p_event_id;
  if v_event_date is null then
    raise exception 'event_not_found';
  end if;
  if now() > v_event_date + interval '30 minutes' then
    raise exception 'sales_closed';
  end if;

  if p_seat_ids is null or array_length(p_seat_ids, 1) is null then
    raise exception 'no_seats_requested';
  end if;

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

-- ---------------------------------------------------------------------
-- 4) Salas de entrada general (sin mapa de butacas)
-- ---------------------------------------------------------------------

alter table venues add column if not exists general_admission boolean not null default false;

-- Crea (la primera vez) o actualiza el precio de la "zona" y las
-- butacas virtuales de una sala de entrada general — tantas como la
-- capacidad de la sala. Se reutilizan entre distintos eventos de la
-- misma sala (cada evento igual arma su propio inventario disponible
-- en event_seats, así que no se pisan entre sí).
create or replace function ensure_general_admission_seats(p_venue_id uuid, p_price numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_existing_seats int;
begin
  select capacity into v_capacity from venues where id = p_venue_id;
  if v_capacity is null or v_capacity <= 0 then
    raise exception 'venue_capacity_required';
  end if;

  select count(*) into v_existing_seats from seats where venue_id = p_venue_id;

  if v_existing_seats = 0 then
    insert into seat_zones (venue_id, name, color, default_price)
    values (p_venue_id, 'General', '#C9A227', p_price);

    insert into seats (venue_id, zone_id, row_label, seat_number, pos_row, pos_col, label, is_active)
    select
      p_venue_id,
      (select id from seat_zones where venue_id = p_venue_id and name = 'General'),
      'G',
      gs,
      0,
      gs,
      'Entrada ' || gs,
      true
    from generate_series(1, v_capacity) as gs;
  else
    update seat_zones set default_price = p_price
    where venue_id = p_venue_id and name = 'General';
  end if;
end;
$$;

grant execute on function ensure_general_admission_seats(uuid, numeric) to authenticated;

-- Retiene automáticamente las próximas N butacas disponibles de un
-- evento (para salas de entrada general, donde el comprador no elige
-- una butaca puntual, solo una cantidad).
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
  v_held_until timestamptz := now() + (p_hold_minutes || ' minutes')::interval;
  v_picked uuid[];
begin
  select event_date into v_event_date from events where id = p_event_id;
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

  update event_seats
  set status = 'held', held_by = p_session_id, held_until = v_held_until, updated_at = now()
  where id = any(v_picked);

  return query
  select es.id, es.seat_id, es.held_until
  from event_seats es
  where es.id = any(v_picked);
end;
$$;

grant execute on function hold_next_available_seats(uuid, int, text, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) "Agotado": automático (no quedan butacas disponibles, contando
--    también las de entrada general) o marcado a mano.
-- ---------------------------------------------------------------------

alter table events add column if not exists manually_sold_out boolean not null default false;

create or replace view event_sold_out_status as
select
  e.id as event_id,
  e.manually_sold_out,
  count(es.id) as total_count,
  coalesce(count(es.id) filter (where es.status = 'available'), 0) as available_count,
  (
    e.manually_sold_out
    or (count(es.id) > 0 and count(es.id) filter (where es.status = 'available') = 0)
  ) as is_sold_out
from events e
left join event_seats es on es.event_id = e.id
group by e.id, e.manually_sold_out;

grant select on event_sold_out_status to anon, authenticated;
