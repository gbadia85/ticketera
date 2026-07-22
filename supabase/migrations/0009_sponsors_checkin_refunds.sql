-- =====================================================================
-- BUTACA — Migración 0009
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2) Sponsors / auspiciantes por evento (hasta 5 imágenes, etiqueta
--    editable por evento).
-- ---------------------------------------------------------------------

alter table events add column if not exists sponsors_label text;

create table if not exists event_sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  url text not null,
  path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_sponsors_event on event_sponsors(event_id);

alter table event_sponsors enable row level security;
create policy "public read event_sponsors" on event_sponsors for select using (true);
create policy "admin write event_sponsors" on event_sponsors for insert with check (auth.role() = 'authenticated');
create policy "admin update event_sponsors" on event_sponsors for update using (auth.role() = 'authenticated');
create policy "admin delete event_sponsors" on event_sponsors for delete using (auth.role() = 'authenticated');

-- Reutilizamos el bucket event-images (ya público para lectura, ya con
-- permisos de escritura para admin) — los sponsors se guardan bajo
-- "<event_id>/sponsors/<archivo>", así que no hace falta un bucket ni
-- políticas nuevas.

-- ---------------------------------------------------------------------
-- 5) "Habilitar ingreso al evento": solo se puede hacer check-in de
--    entradas de un evento si ese evento está habilitado — evita que
--    alguien entre con el QR de otra función.
-- ---------------------------------------------------------------------

alter table events add column if not exists checkin_enabled boolean not null default false;

-- ---------------------------------------------------------------------
-- 4) Check-in en dos pasos: primero se consulta (sin marcar nada),
--    después se confirma explícitamente con un botón ("dar el OK").
-- ---------------------------------------------------------------------

-- Paso 1: consulta de solo lectura — no marca nada todavía. La usa el
-- lector de QR apenas escanea, para mostrarle el dato a la persona de
-- la puerta antes de aceptar el ingreso.
create or replace function lookup_reservation_checkin(p_reservation_id uuid)
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

grant execute on function lookup_reservation_checkin(uuid) to authenticated;

-- Paso 2: confirma el ingreso de verdad (esto es lo que antes hacía
-- check_in_reservation en el mismo paso que la lectura). Vuelve a
-- validar todo del lado del servidor, no confía en lo que ya mostró el
-- paso 1.
create or replace function confirm_reservation_checkin(p_reservation_id uuid, p_checked_in_by text)
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

grant execute on function confirm_reservation_checkin(uuid, text) to authenticated;

-- check_in_reservation (0007) queda obsoleta, la reemplazan las dos de
-- arriba — la dejamos existiendo (no rompe nada) por si algo la llama
-- todavía, pero el frontend nuevo usa lookup/confirm.

-- ---------------------------------------------------------------------
-- 6) Devolución de entradas (venta en puerta)
-- ---------------------------------------------------------------------

alter table reservations drop constraint if exists reservations_status_check;
alter table reservations
  add constraint reservations_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded'));

alter table reservations add column if not exists refunded_at timestamptz;
alter table reservations add column if not exists refunded_amount numeric(10,2);
alter table reservations add column if not exists refunded_by text;
alter table reservations add column if not exists refund_cash_shift_id uuid references cash_shifts(id);

create or replace function refund_reservation(
  p_reservation_id uuid,
  p_refunded_amount numeric,
  p_by text,
  p_cash_shift_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res reservations;
begin
  select * into v_res from reservations where id = p_reservation_id;
  if not found then
    raise exception 'reservation_not_found';
  end if;
  if v_res.status <> 'approved' then
    raise exception 'not_refundable';
  end if;

  update reservations
  set status = 'refunded',
      refunded_at = now(),
      refunded_amount = p_refunded_amount,
      refunded_by = p_by,
      refund_cash_shift_id = p_cash_shift_id
  where id = p_reservation_id;

  update event_seats
  set status = 'available', reservation_id = null, held_by = null, held_until = null, updated_at = now()
  where reservation_id = p_reservation_id;

  return jsonb_build_object(
    'ok', true,
    'reservation_id', p_reservation_id,
    'original_amount', v_res.total_amount,
    'refunded_amount', p_refunded_amount
  );
end;
$$;

grant execute on function refund_reservation(uuid, numeric, text, uuid) to authenticated;

-- close_cash_shift: ahora resta las devoluciones hechas durante el
-- turno, y cuenta las ventas en efectivo del turno aunque después se
-- hayan devuelto (si no, el ingreso original de esa plata desaparece
-- del cálculo y queda todo descuadrado).
create or replace function close_cash_shift(
  p_shift_id uuid,
  p_counted_amount numeric,
  p_closed_by text,
  p_notes text default null
)
returns cash_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opening numeric(10,2);
  v_sales numeric(10,2);
  v_refunds numeric(10,2);
  v_expected numeric(10,2);
  v_shift cash_shifts;
begin
  select opening_amount into v_opening
  from cash_shifts where id = p_shift_id and status = 'open';

  if not found then
    raise exception 'shift_not_open';
  end if;

  select coalesce(sum(total_amount), 0) into v_sales
  from reservations
  where cash_shift_id = p_shift_id and payment_method = 'efectivo';

  select coalesce(sum(refunded_amount), 0) into v_refunds
  from reservations
  where refund_cash_shift_id = p_shift_id;

  v_expected := v_opening + v_sales - v_refunds;

  update cash_shifts
  set status = 'closed',
      closed_at = now(),
      closed_by = p_closed_by,
      expected_amount = v_expected,
      counted_amount = p_counted_amount,
      difference = p_counted_amount - v_expected,
      notes = p_notes
  where id = p_shift_id
  returning * into v_shift;

  return v_shift;
end;
$$;
