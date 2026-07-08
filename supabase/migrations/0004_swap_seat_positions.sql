-- =====================================================================
-- BUTACA — Migración 0004
-- Agrega la posibilidad de "mover" una butaca en el editor de sala,
-- intercambiando su posición con la de otra (por ejemplo, correr una
-- butaca activa al lugar de un pasillo para armar formas en U, en
-- herradura, etc. sin estar atado a una grilla rectangular rígida).
-- =====================================================================

-- La restricción de posición única debe ser DEFERRABLE: al intercambiar
-- dos butacas necesitamos, por un instante dentro de la misma
-- transacción, que ambas tengan temporalmente una posición "repetida"
-- mientras se actualiza la segunda. Con DEFERRABLE INITIALLY DEFERRED,
-- Postgres solo valida la restricción al final de la transacción (o
-- sea, cuando ya quedaron acomodadas), no en cada UPDATE individual.
alter table seats drop constraint if exists seats_venue_id_pos_row_pos_col_key;
alter table seats
  add constraint seats_venue_id_pos_row_pos_col_key
  unique (venue_id, pos_row, pos_col) deferrable initially deferred;

create or replace function swap_seat_positions(p_seat_id_a uuid, p_seat_id_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  b record;
begin
  select id, pos_row, pos_col into a from seats where id = p_seat_id_a for update;
  select id, pos_row, pos_col into b from seats where id = p_seat_id_b for update;

  if a.id is null or b.id is null then
    raise exception 'seat_not_found';
  end if;

  if a.id = b.id then
    return;
  end if;

  update seats
  set pos_row = b.pos_row,
      pos_col = b.pos_col,
      row_label = chr(65 + (b.pos_row % 26)),
      seat_number = b.pos_col + 1,
      label = 'Fila ' || chr(65 + (b.pos_row % 26)) || ', Butaca ' || (b.pos_col + 1)
  where id = a.id;

  update seats
  set pos_row = a.pos_row,
      pos_col = a.pos_col,
      row_label = chr(65 + (a.pos_row % 26)),
      seat_number = a.pos_col + 1,
      label = 'Fila ' || chr(65 + (a.pos_row % 26)) || ', Butaca ' || (a.pos_col + 1)
  where id = b.id;
end;
$$;

grant execute on function swap_seat_positions(uuid, uuid) to authenticated;
