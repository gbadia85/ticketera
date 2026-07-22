-- =====================================================================
-- BUTACA — Migración 0010
-- =====================================================================
-- Hasta ahora un "evento" era una sola fecha/hora. Esta migración
-- separa el concepto en dos:
--
--   shows  -> el espectáculo en sí: título, descripción, imágenes,
--             sponsors, sala. No tiene fecha.
--   events -> cada FUNCIÓN puntual de un show: fecha/hora, estado,
--             agotado manual, check-in habilitado. Sigue siendo la
--             unidad de venta (butacas, precios, reservas, caja,
--             check-in) — no cambia nada de esa parte.
--
-- Un show puede tener una o varias funciones (mismo espectáculo, en
-- distintos días u horarios). Esta migración convierte cada evento
-- existente en un show con una única función, así que no se pierde
-- nada de lo que ya tenías cargado.
-- =====================================================================
-- Corré este archivo completo en el SQL Editor de Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabla shows
-- ---------------------------------------------------------------------
create table if not exists shows (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete restrict,
  title text not null,
  description text,
  sponsors_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shows enable row level security;
create policy "public read shows" on shows for select using (true);
create policy "admin write shows" on shows for insert with check (auth.role() = 'authenticated');
create policy "admin update shows" on shows for update using (auth.role() = 'authenticated');
create policy "admin delete shows" on shows for delete using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- 2) events pasa a ser "funciones": agregamos el vínculo al show.
-- ---------------------------------------------------------------------
alter table events add column if not exists show_id uuid references shows(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 3) Migración de datos: cada evento existente se convierte en su
--    propio show con una única función (la que ya tenía).
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_show_id uuid;
begin
  for r in select * from events where show_id is null loop
    insert into shows (title, description, venue_id, sponsors_label, created_at)
    values (r.title, r.description, r.venue_id, r.sponsors_label, r.created_at)
    returning id into v_show_id;

    update events set show_id = v_show_id where id = r.id;
  end loop;
end $$;

alter table events alter column show_id set not null;
create index if not exists idx_events_show on events(show_id);

-- ---------------------------------------------------------------------
-- 4) Imágenes y sponsors pasan a pertenecer al show (se comparten
--    entre todas las funciones), no a una función puntual.
-- ---------------------------------------------------------------------
alter table event_images add column if not exists show_id uuid references shows(id) on delete cascade;
alter table event_sponsors add column if not exists show_id uuid references shows(id) on delete cascade;

update event_images ei set show_id = e.show_id
from events e where ei.event_id = e.id and ei.show_id is null;

update event_sponsors es set show_id = e.show_id
from events e where es.event_id = e.id and es.show_id is null;

alter table event_images alter column show_id set not null;
alter table event_sponsors alter column show_id set not null;
alter table event_images drop column if exists event_id;
alter table event_sponsors drop column if exists event_id;

create index if not exists idx_event_images_show on event_images(show_id);
create index if not exists idx_event_sponsors_show on event_sponsors(show_id);

-- ---------------------------------------------------------------------
-- 5) events ya no necesita título/descripción/etiqueta de sponsors —
--    eso ahora vive en el show.
-- ---------------------------------------------------------------------
alter table events drop column if exists title;
alter table events drop column if exists description;
alter table events drop column if exists sponsors_label;

-- ---------------------------------------------------------------------
-- 6) Zona de Peligro: "Borrar eventos" / "Borrar salas" / "Resetear
--    todo" tienen que arrastrar también los shows (si no, quedan shows
--    huérfanos sin ninguna función, con sus imágenes y sponsors).
-- ---------------------------------------------------------------------
create or replace function admin_delete_all_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    reservation_seats, checkin_events, cash_shifts, reservations,
    event_zone_prices, event_seats, event_images, event_sponsors,
    events, shows
  restart identity cascade;
end;
$$;

create or replace function admin_delete_all_venues()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    reservation_seats, checkin_events, cash_shifts, reservations,
    event_zone_prices, event_seats, event_images, event_sponsors,
    events, shows, seats, seat_zones, venues
  restart identity cascade;
end;
$$;

create or replace function admin_reset_database()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    reservation_seats, checkin_events, cash_shifts, reservations,
    event_zone_prices, event_seats, event_images, event_sponsors,
    events, shows, seats, seat_zones, venues
  restart identity cascade;
end;
$$;
