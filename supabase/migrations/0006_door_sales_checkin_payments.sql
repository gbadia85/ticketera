-- =====================================================================
-- BUTACA — Migración 0006
-- Agrega:
--   1) Métodos de pago: además de "mercadopago", ahora una reserva
--      puede ser "efectivo" (venta en puerta) o "simulado" (modo de
--      prueba, ver mock-confirm-payment).
--   2) Caja por evento: apertura con monto inicial, cada venta en
--      efectivo queda asociada a la caja abierta, cierre con arqueo
--      (monto contado vs. esperado, y la diferencia).
--   3) Check-in: cada reserva (online o en puerta) tiene un QR que la
--      identifica. Al escanearlo en la puerta se marca checked_in_at.
-- =====================================================================
-- Corré este archivo completo en el SQL Editor de Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reservas: método de pago, caja asociada (si fue venta en puerta), y
-- estado de ingreso a la sala.
-- ---------------------------------------------------------------------
alter table reservations
  add column if not exists payment_method text not null default 'mercadopago'
  check (payment_method in ('mercadopago', 'efectivo', 'simulado'));

alter table reservations add column if not exists cash_shift_id uuid;
alter table reservations add column if not exists checked_in_at timestamptz;
alter table reservations add column if not exists checked_in_by text;

-- Las ventas en puerta no piden mail (el QR se muestra en pantalla ahí
-- mismo, no hace falta mandarlo).
alter table reservations alter column email drop not null;

-- ---------------------------------------------------------------------
-- Caja: un turno de caja por evento, con apertura y cierre con arqueo.
-- ---------------------------------------------------------------------
create table if not exists cash_shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  opened_by text not null,
  opened_at timestamptz not null default now(),
  opening_amount numeric(10,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by text,
  closed_at timestamptz,
  expected_amount numeric(10,2),
  counted_amount numeric(10,2),
  difference numeric(10,2),
  notes text
);

-- Solo puede haber una caja abierta por evento a la vez. Si dos
-- cajeros venden en la puerta del mismo evento, comparten esta misma
-- caja (no una por cajero) — así el arqueo del cierre suma todo junto.
create unique index if not exists uq_open_cash_shift_per_event
  on cash_shifts(event_id) where status = 'open';

alter table reservations
  add constraint reservations_cash_shift_fk
  foreign key (cash_shift_id) references cash_shifts(id);

create index if not exists idx_reservations_cash_shift on reservations(cash_shift_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table cash_shifts enable row level security;
create policy "admin read cash_shifts" on cash_shifts for select using (auth.role() = 'authenticated');
create policy "admin write cash_shifts" on cash_shifts for insert with check (auth.role() = 'authenticated');
create policy "admin update cash_shifts" on cash_shifts for update using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- REALTIME: la pantalla en vivo de check-in escucha cambios en
-- reservations (checked_in_at) además de event_seats (ya publicada).
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table reservations;

-- ---------------------------------------------------------------------
-- FUNCIONES
-- ---------------------------------------------------------------------

-- Marca una reserva pendiente como pagada (aprobada) y sus butacas como
-- vendidas. Es el único lugar donde esto pasa, sea cual sea el medio de
-- pago — la llaman las Edge Functions mp-webhook, mock-confirm-payment
-- y create-door-sale, siempre con la service role key (nunca desde el
-- navegador directamente).
create or replace function mark_reservation_paid(
  p_reservation_id uuid,
  p_payment_method text,
  p_mp_payment_id text default null,
  p_cash_shift_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update reservations
  set status = 'approved',
      payment_method = p_payment_method,
      mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
      cash_shift_id = coalesce(p_cash_shift_id, cash_shift_id),
      updated_at = now()
  where id = p_reservation_id and status = 'pending';

  if not found then
    raise exception 'reservation_not_pending';
  end if;

  update event_seats
  set status = 'sold', held_by = null, held_until = null, updated_at = now()
  where reservation_id = p_reservation_id;
end;
$$;

grant execute on function mark_reservation_paid(uuid, text, text, uuid) to service_role;

-- Registra el ingreso de una reserva al escanear su QR. Devuelve los
-- datos para mostrarle a la persona de la puerta (nombre + butacas).
-- Es "seguro" de llamar más de una vez con la misma reserva: si ya
-- había entrado, avisa "already_checked_in" en vez de pisar el dato.
create or replace function check_in_reservation(p_reservation_id uuid, p_checked_in_by text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res reservations;
  v_already boolean;
  v_seats text[];
begin
  select * into v_res from reservations where id = p_reservation_id;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_res.status <> 'approved' then
    return jsonb_build_object('valid', false, 'reason', 'not_paid', 'status', v_res.status);
  end if;

  v_already := v_res.checked_in_at is not null;

  if not v_already then
    update reservations
    set checked_in_at = now(), checked_in_by = p_checked_in_by
    where id = p_reservation_id
    returning checked_in_at into v_res.checked_in_at;
  end if;

  select array_agg(s.label order by s.label) into v_seats
  from reservation_seats rs
  join event_seats es on es.id = rs.event_seat_id
  join seats s on s.id = es.seat_id
  where rs.reservation_id = p_reservation_id;

  return jsonb_build_object(
    'valid', true,
    'reservation_id', v_res.id,
    'event_id', v_res.event_id,
    'first_name', v_res.first_name,
    'last_name', v_res.last_name,
    'seat_labels', coalesce(v_seats, array[]::text[]),
    'already_checked_in', v_already,
    'checked_in_at', v_res.checked_in_at
  );
end;
$$;

grant execute on function check_in_reservation(uuid, text) to authenticated;

-- Cierra una caja: calcula lo esperado (apertura + ventas en efectivo
-- de esa caja) y lo compara contra lo que el cajero contó a mano.
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
  where cash_shift_id = p_shift_id and status = 'approved' and payment_method = 'efectivo';

  v_expected := v_opening + v_sales;

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

grant execute on function close_cash_shift(uuid, numeric, text, text) to authenticated;
