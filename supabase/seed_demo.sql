-- =====================================================================
-- DATOS DE EJEMPLO (opcional)
-- Corré este script en el SQL Editor de Supabase si querés tener una
-- sala, zonas y un evento de prueba ya cargados para probar el flujo
-- completo antes de meterte a cargar tus salas reales desde el admin.
-- =====================================================================

do $$
declare
  v_venue_id uuid;
  v_zone_platea uuid;
  v_zone_vip uuid;
  v_zone_palco uuid;
  v_event_id uuid;
  r int;
  c int;
  v_zone uuid;
  v_row_label text;
begin
  insert into venues (name, address, capacity)
  values ('Teatro Ejemplo', 'Av. Corrientes 1234, CABA', 50)
  returning id into v_venue_id;

  insert into seat_zones (venue_id, name, color, default_price)
  values (v_venue_id, 'Platea', '#2F8F5B', 8000)
  returning id into v_zone_platea;

  insert into seat_zones (venue_id, name, color, default_price)
  values (v_venue_id, 'Palco', '#C9A227', 15000)
  returning id into v_zone_palco;

  insert into seat_zones (venue_id, name, color, default_price)
  values (v_venue_id, 'VIP', '#7A1F3D', 20000)
  returning id into v_zone_vip;

  -- 5 filas (A-E) x 10 butacas. Fila E = VIP, Fila D = Palco, resto Platea.
  for r in 0..4 loop
    v_row_label := chr(65 + r); -- A, B, C, D, E
    if v_row_label = 'E' then
      v_zone := v_zone_vip;
    elsif v_row_label = 'D' then
      v_zone := v_zone_palco;
    else
      v_zone := v_zone_platea;
    end if;

    for c in 0..9 loop
      insert into seats (venue_id, zone_id, row_label, seat_number, pos_row, pos_col, label, is_active)
      values (
        v_venue_id, v_zone, v_row_label, c + 1, r, c,
        'Fila ' || v_row_label || ', Butaca ' || (c + 1),
        true
      );
    end loop;
  end loop;

  insert into events (venue_id, title, description, event_date, status)
  values (
    v_venue_id,
    'Función de prueba',
    'Evento de ejemplo para probar el flujo de compra de punta a punta.',
    now() + interval '14 days',
    'draft'
  )
  returning id into v_event_id;

  perform publish_event(v_event_id);

  raise notice 'Sala creada: %, Evento creado: %', v_venue_id, v_event_id;
end $$;
