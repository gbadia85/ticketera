-- =====================================================================
-- BUTACA — Migración 0011
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3) La caja ya no está atada a un evento/función puntual — se abre
--    una sola vez y se puede vender para cualquier evento publicado
--    mientras esté abierta. Cada venta sigue guardando para qué
--    evento fue (reservations.event_id), eso no cambia.
-- ---------------------------------------------------------------------
drop index if exists uq_open_cash_shift_per_event;
alter table cash_shifts alter column event_id drop not null;

-- Solo puede haber UNA caja abierta a la vez (en todo el sistema, ya
-- no por evento).
create unique index if not exists uq_single_open_cash_shift
  on cash_shifts ((true)) where status = 'open';

-- ---------------------------------------------------------------------
-- 5) Lector de QR: si hay más de un evento habilitado para ingreso al
--    mismo tiempo (ej. dos funciones en dos salas distintas a la misma
--    hora), cada lector se puede "fijar" a un evento puntual — así una
--    entrada de OTRO evento habilitado no entra por la puerta
--    equivocada, aunque también esté habilitado.
-- ---------------------------------------------------------------------
create or replace function lookup_reservation_checkin(p_reservation_id uuid, p_expected_event_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res reservations;
  v_event events;
  v_seats text[];
begin
  select * into v_res from reservations where id = p_reservation_id;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_res.status <> 'approved' then
    return jsonb_build_object('valid', false, 'reason', 'not_paid', 'status', v_res.status);
  end if;

  select * into v_event from events where id = v_res.event_id;
  if not v_event.checkin_enabled then
    return jsonb_build_object('valid', false, 'reason', 'checkin_not_enabled');
  end if;

  if p_expected_event_id is not null and v_res.event_id <> p_expected_event_id then
    return jsonb_build_object('valid', false, 'reason', 'wrong_door');
  end if;

  select array_agg(s.label order by s.label) into v_seats
  from reservation_seats rs
  join event_seats es on es.id = rs.event_seat_id
  join seats s on s.id = es.seat_id
  where rs.reservation_id = p_reservation_id;

  return jsonb_build_object(
    'valid', true,
    'already_inside', v_res.entry_status = 'inside',
    'reservation_id', v_res.id,
    'first_name', v_res.first_name,
    'last_name', v_res.last_name,
    'seat_labels', coalesce(v_seats, array[]::text[]),
    'checked_in_at', v_res.checked_in_at
  );
end;
$$;

grant execute on function lookup_reservation_checkin(uuid, uuid) to authenticated;

create or replace function confirm_reservation_checkin(p_reservation_id uuid, p_checked_in_by text, p_expected_event_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res reservations;
  v_event events;
  v_seats text[];
begin
  select * into v_res from reservations where id = p_reservation_id;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if v_res.status <> 'approved' then
    return jsonb_build_object('valid', false, 'reason', 'not_paid', 'status', v_res.status);
  end if;

  select * into v_event from events where id = v_res.event_id;
  if not v_event.checkin_enabled then
    return jsonb_build_object('valid', false, 'reason', 'checkin_not_enabled');
  end if;

  if p_expected_event_id is not null and v_res.event_id <> p_expected_event_id then
    return jsonb_build_object('valid', false, 'reason', 'wrong_door');
  end if;

  select array_agg(s.label order by s.label) into v_seats
  from reservation_seats rs
  join event_seats es on es.id = rs.event_seat_id
  join seats s on s.id = es.seat_id
  where rs.reservation_id = p_reservation_id;

  if v_res.entry_status = 'inside' then
    return jsonb_build_object(
      'valid', true, 'already_inside', true,
      'reservation_id', v_res.id, 'first_name', v_res.first_name, 'last_name', v_res.last_name,
      'seat_labels', coalesce(v_seats, array[]::text[]), 'checked_in_at', v_res.checked_in_at
    );
  end if;

  update reservations
  set entry_status = 'inside', checked_in_at = now(), checked_in_by = p_checked_in_by
  where id = p_reservation_id
  returning checked_in_at into v_res.checked_in_at;

  insert into checkin_events (reservation_id, action, by) values (p_reservation_id, 'in', p_checked_in_by);

  return jsonb_build_object(
    'valid', true, 'already_inside', false,
    'reservation_id', v_res.id, 'first_name', v_res.first_name, 'last_name', v_res.last_name,
    'seat_labels', coalesce(v_seats, array[]::text[]), 'checked_in_at', v_res.checked_in_at
  );
end;
$$;

grant execute on function confirm_reservation_checkin(uuid, text, uuid) to authenticated;
