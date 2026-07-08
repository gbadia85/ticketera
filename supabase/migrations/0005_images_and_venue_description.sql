-- =====================================================================
-- BUTACA — Migración 0005
-- Agrega:
--   1) Imágenes por evento (hasta 5 — el límite se controla desde la
--      UI de admin, no en la base). La primera (menor sort_order) es
--      la que se usa como portada en la cartelera.
--   2) Imágenes de la sala + descripción de la sala, para mostrarlas
--      en el apartado "Sala" al entrar a un evento y en la nueva
--      sección pública "Salas".
--   3) Dos buckets de Supabase Storage (públicos para lectura, solo
--      admin puede subir/borrar) donde viven los archivos de imagen.
-- =====================================================================
-- Corré este archivo completo en el SQL Editor de Supabase (o con
-- `supabase db push` si usás la CLI). Es seguro re-ejecutarlo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Descripción de la sala (para el apartado "Sala" y la página pública
-- de salas).
-- ---------------------------------------------------------------------
alter table venues add column if not exists description text;

-- ---------------------------------------------------------------------
-- Imágenes de evento
-- ---------------------------------------------------------------------
create table if not exists event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  url text not null,
  path text not null, -- ruta dentro del bucket, para poder borrar el archivo
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_images_event on event_images(event_id);

-- ---------------------------------------------------------------------
-- Imágenes de sala
-- ---------------------------------------------------------------------
create table if not exists venue_images (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  url text not null,
  path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_venue_images_venue on venue_images(venue_id);

-- ---------------------------------------------------------------------
-- RLS: lectura pública (son fotos de marketing, no datos sensibles),
-- escritura solo para admins (usuarios autenticados).
-- ---------------------------------------------------------------------
alter table event_images enable row level security;
alter table venue_images enable row level security;

create policy "public read event_images" on event_images for select using (true);
create policy "admin write event_images" on event_images for insert with check (auth.role() = 'authenticated');
create policy "admin update event_images" on event_images for update using (auth.role() = 'authenticated');
create policy "admin delete event_images" on event_images for delete using (auth.role() = 'authenticated');

create policy "public read venue_images" on venue_images for select using (true);
create policy "admin write venue_images" on venue_images for insert with check (auth.role() = 'authenticated');
create policy "admin update venue_images" on venue_images for update using (auth.role() = 'authenticated');
create policy "admin delete venue_images" on venue_images for delete using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- STORAGE: buckets públicos para las imágenes de eventos y salas.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('venue-images', 'venue-images', true)
on conflict (id) do nothing;

-- Lectura pública de los archivos (son imágenes de marketing público).
create policy "public read event-images bucket" on storage.objects
  for select using (bucket_id = 'event-images');

create policy "public read venue-images bucket" on storage.objects
  for select using (bucket_id = 'venue-images');

-- Solo admins pueden subir/actualizar/borrar archivos.
create policy "admin write event-images bucket" on storage.objects
  for insert with check (bucket_id = 'event-images' and auth.role() = 'authenticated');
create policy "admin update event-images bucket" on storage.objects
  for update using (bucket_id = 'event-images' and auth.role() = 'authenticated');
create policy "admin delete event-images bucket" on storage.objects
  for delete using (bucket_id = 'event-images' and auth.role() = 'authenticated');

create policy "admin write venue-images bucket" on storage.objects
  for insert with check (bucket_id = 'venue-images' and auth.role() = 'authenticated');
create policy "admin update venue-images bucket" on storage.objects
  for update using (bucket_id = 'venue-images' and auth.role() = 'authenticated');
create policy "admin delete venue-images bucket" on storage.objects
  for delete using (bucket_id = 'venue-images' and auth.role() = 'authenticated');
