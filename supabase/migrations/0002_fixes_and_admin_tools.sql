-- =====================================================================
-- BUTACA — Migración 0002
-- Corrige bugs reportados y agrega herramientas de administración:
--   1) hold_seats: "column reference seat_id is ambiguous"
--   2) No se puede borrar una zona en uso (FK event_seats_zone_id_fkey)
--   3) Botones de admin para borrar eventos / salas / resetear todo
-- =====================================================================
-- Corré este archivo completo en el SQL Editor de Supabase (o con
-- `supabase db push` si usás la CLI). Es seguro re-ejecutarlo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- FIX 1: hold_seats tenía columnas sin calificar ("seat_id") que
-- chocaban con los nombres de las columnas de salida de la función
-- (RETURNS TABLE (... seat_id uuid ...)). Postgres no podía saber si
-- te referías a la variable de salida o a la columna de la tabla.
-- Se soluciona calificando cada referencia con el alias "es".
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
  v_count int;
begin
  if p_seat_ids is null or array_length(p_seat_ids, 1) is null then
    raise exception 'no_seats_requested';
  end if;

  select count(*) into v_count
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids)
  for update of es;

  if v_count <> array_length(p_seat_ids, 1) then
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

  update event_seats
  set status = 'held',
      held_by = p_session_id,
      held_until = now() + (p_hold_minutes || ' minutes')::interval,
      updated_at = now()
  where event_seats.event_id = p_event_id and event_seats.seat_id = any(p_seat_ids);

  return query
  select es.id, es.seat_id, es.held_until
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids);
end;
$$;

grant execute on function hold_seats(uuid, uuid[], text, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- FIX 2: no se podía borrar una zona de precio si alguna butaca de un
-- evento ya la referenciaba (event_seats.zone_id). Cambiamos esa FK a
-- ON DELETE SET NULL: al borrar la zona, las butacas de eventos ya
-- creados simplemente quedan sin zona asociada (el precio ya cobrado
-- no se toca, es un valor numérico ya guardado en event_seats.price).
-- ---------------------------------------------------------------------
alter table event_seats drop constraint if exists event_seats_zone_id_fkey;
alter table event_seats
  add constraint event_seats_zone_id_fkey
  foreign key (zone_id) references seat_zones(id) on delete set null;

-- ---------------------------------------------------------------------
-- HERRAMIENTAS DE ADMINISTRACIÓN (zona de peligro del panel admin)
-- Solo ejecutables por usuarios autenticados (= administradores).
-- ---------------------------------------------------------------------

-- Borra todos los eventos y todo lo que depende de ellos (butacas por
-- evento, precios por evento, reservas). Las salas, zonas y el layout
-- de butacas NO se tocan.
create or replace function admin_delete_all_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table reservation_seats, reservations, event_zone_prices, event_seats, events
  restart identity cascade;
end;
$$;

-- Borra todas las salas. Como una sala no puede existir sin sus
-- eventos huérfanos, esto también borra eventos, zonas, butacas y
-- reservas: es, en la práctica, un reseteo completo.
create or replace function admin_delete_all_venues()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    reservation_seats, reservations, event_zone_prices, event_seats,
    events, seats, seat_zones, venues
  restart identity cascade;
end;
$$;

-- Resetea la base de datos completa (equivalente a borrar todas las
-- salas). Se deja como función separada para que el botón del admin
-- tenga su propio nombre claro en los logs / auditoría.
create or replace function admin_reset_database()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    reservation_seats, reservations, event_zone_prices, event_seats,
    events, seats, seat_zones, venues
  restart identity cascade;
end;
$$;

grant execute on function admin_delete_all_events() to authenticated;
grant execute on function admin_delete_all_venues() to authenticated;
grant execute on function admin_reset_database() to authenticated;
