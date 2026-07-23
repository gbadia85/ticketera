-- =====================================================================
-- BUTACA — Migración 0013
-- Permite que, en la venta en puerta, el cajero decida vender por
-- encima de la capacidad de una sala de entrada general (por ejemplo
-- si van a entrar parados) — el frontend avisa primero cuánto se está
-- sobrevendiendo, y solo si el cajero confirma se llama a esta función
-- con p_allow_oversell = true. Sin esa confirmación, se sigue
-- rechazando igual que antes.
-- =====================================================================

-- Sacamos la versión anterior (4 parámetros) antes de crear la nueva
-- de 5 — si no, "create or replace" con una firma distinta crea una
-- función nueva aparte en vez de reemplazar la vieja, y quedan las dos
-- coexistiendo (ambiguo a la hora de llamarla).
drop function if exists hold_next_available_seats(uuid, int, text, int);

create or replace function hold_next_available_seats(
  p_event_id uuid,
  p_quantity int,
  p_session_id text,
  p_hold_minutes int default 10,
  p_allow_oversell boolean default false
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
  v_zone_price numeric;
  v_held_until timestamptz := now() + (p_hold_minutes || ' minutes')::interval;
  v_picked uuid[];
  v_have int;
  v_shortfall int;
  v_max_seat_number int;
  v_new_seat_ids uuid[];
  v_new_event_seat_ids uuid[];
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

  v_have := coalesce(array_length(v_picked, 1), 0);
  v_shortfall := p_quantity - v_have;

  if v_shortfall > 0 then
    if not p_allow_oversell then
      raise exception 'not_enough_seats';
    end if;

    select id, default_price into v_zone_id, v_zone_price
    from seat_zones where venue_id = v_venue_id and name = 'General'
    limit 1;

    if v_zone_id is null then
      raise exception 'general_zone_not_found';
    end if;

    select coalesce(max(seat_number), 0) into v_max_seat_number from seats where venue_id = v_venue_id;

    -- Butacas "de sobreventa": quedan marcadas en el label para que se
    -- distingan si alguna vez hace falta revisar a mano.
    with new_seats as (
      insert into seats (venue_id, zone_id, row_label, seat_number, pos_row, pos_col, label, is_active)
      select
        v_venue_id, v_zone_id, 'G', v_max_seat_number + gs, 0, v_max_seat_number + gs,
        'Entrada ' || (v_max_seat_number + gs) || ' (sobreventa)', true
      from generate_series(1, v_shortfall) as gs
      returning id
    )
    select array_agg(id) into v_new_seat_ids from new_seats;

    insert into event_seats (event_id, seat_id, zone_id, price, status, held_by, held_until)
    select p_event_id, ns_id, v_zone_id, v_zone_price, 'held', p_session_id, v_held_until
    from unnest(v_new_seat_ids) as ns_id;

    select array_agg(es.id) into v_new_event_seat_ids
    from event_seats es
    where es.event_id = p_event_id and es.seat_id = any(v_new_seat_ids);

    v_picked := coalesce(v_picked, array[]::uuid[]) || v_new_event_seat_ids;
  end if;

  update event_seats
  set status = 'held', held_by = p_session_id, held_until = v_held_until, updated_at = now()
  where id = any(v_picked) and status = 'available';

  return query
  select es.id, es.seat_id, es.held_until
  from event_seats es
  where es.id = any(v_picked);
end;
$$;

grant execute on function hold_next_available_seats(uuid, int, text, int, boolean) to anon, authenticated;
