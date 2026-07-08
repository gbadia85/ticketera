-- =====================================================================
-- BUTACA — Migración 0003
-- Corrige: "FOR UPDATE is not allowed with aggregate functions"
--
-- hold_seats hacía `select count(*) ... for update`, y Postgres no
-- permite combinar FOR UPDATE con funciones de agregación (count, sum,
-- etc.) en la misma consulta, sin importar el resto de la sintaxis.
-- Se separa en dos pasos: primero se bloquean las filas (sin agregar),
-- después se cuentan en una consulta aparte.
-- =====================================================================

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

  -- Paso 1: bloqueamos las filas involucradas (consulta sin agregar,
  -- FOR UPDATE es válido acá) para evitar carreras entre dos
  -- compradores seleccionando la misma butaca al mismo tiempo.
  perform 1
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids)
  for update of es;

  -- Paso 2: ahora sí contamos, en una consulta separada (sin FOR UPDATE,
  -- las filas ya están bloqueadas por el paso anterior dentro de esta
  -- misma transacción).
  select count(*) into v_count
  from event_seats es
  where es.event_id = p_event_id and es.seat_id = any(p_seat_ids);

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
