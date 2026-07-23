-- =====================================================================
-- BUTACA — Migración 0014
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fix de Realtime: por default, Postgres solo manda la clave primaria
-- en el "antes" de un UPDATE/DELETE por replicación lógica. Cuando la
-- suscripción de Realtime tiene un filtro (ej. "event_id=eq...", que
-- usamos en la pantalla en vivo y en el mapa de butacas), a veces no
-- alcanza esa info para evaluar el filtro de forma confiable y el
-- evento no llega. REPLICA IDENTITY FULL manda la fila completa,
-- eliminando ese problema — es la causa más probable de que la
-- pantalla en vivo no reflejara bien cuando alguien entraba y volvía a
-- salir.
-- ---------------------------------------------------------------------
alter table reservations replica identity full;
alter table event_seats replica identity full;

-- ---------------------------------------------------------------------
-- Venta "de pie" (sin butaca asignada) para salas CON mapa de butacas
-- — solo desde la venta en puerta (requiere estar logueado como
-- admin), nunca desde la compra online. El cajero decide la cantidad y
-- el precio, avisado de que no tiene butaca asignada.
-- ---------------------------------------------------------------------
create or replace function create_standing_tickets(
  p_event_id uuid,
  p_quantity int,
  p_session_id text,
  p_price numeric,
  p_hold_minutes int default 3
)
returns table (event_seat_id uuid, seat_id uuid, held_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date timestamptz;
  v_venue_id uuid;
  v_zone_id uuid;
  v_held_until timestamptz := now() + (p_hold_minutes || ' minutes')::interval;
  v_max_seat_number int;
  v_new_seat_ids uuid[];
begin
  select e.event_date, e.venue_id into v_event_date, v_venue_id from events e where e.id = p_event_id;
  if v_event_date is null then
    raise exception 'event_not_found';
  end if;
  if now() > v_event_date + interval '30 minutes' then
    raise exception 'sales_closed';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'invalid_price';
  end if;

  select id into v_zone_id from seat_zones where venue_id = v_venue_id and name = 'De pie' limit 1;
  if v_zone_id is null then
    insert into seat_zones (venue_id, name, color, default_price)
    values (v_venue_id, 'De pie', '#9333EA', p_price)
    returning id into v_zone_id;
  end if;

  select coalesce(max(seat_number), 0) into v_max_seat_number from seats where venue_id = v_venue_id;

  with new_seats as (
    insert into seats (venue_id, zone_id, row_label, seat_number, pos_row, pos_col, label, is_active)
    select
      v_venue_id, v_zone_id, 'P', v_max_seat_number + gs, 0, v_max_seat_number + gs,
      'De pie ' || gs, true
    from generate_series(1, p_quantity) as gs
    returning id
  )
  select array_agg(id) into v_new_seat_ids from new_seats;

  insert into event_seats (event_id, seat_id, zone_id, price, status, held_by, held_until)
  select p_event_id, ns_id, v_zone_id, p_price, 'held', p_session_id, v_held_until
  from unnest(v_new_seat_ids) as ns_id;

  return query
  select es.id, es.seat_id, es.held_until
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(v_new_seat_ids);
end;
$$;

-- Ojo: a propósito NO se le da permiso a "anon" — la venta de pie es
-- exclusiva del admin logueado desde la venta en puerta.
grant execute on function create_standing_tickets(uuid, int, text, numeric, int) to authenticated;
