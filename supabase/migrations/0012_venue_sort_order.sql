-- =====================================================================
-- BUTACA — Migración 0012
-- Agrega un orden manual para las salas, para poder elegir cuál
-- aparece primero en "Salas" y en los filtros — antes siempre se
-- ordenaban alfabéticamente.
-- =====================================================================

alter table venues add column if not exists sort_order int not null default 0;

-- A las salas que ya tenías cargadas les asignamos un orden inicial
-- según el alfabético de siempre, para no cambiarte nada de golpe —
-- de acá en más lo movés vos desde el admin.
with ordered as (
  select id, row_number() over (order by name) as rn
  from venues
)
update venues v
set sort_order = ordered.rn
from ordered
where v.id = ordered.id and v.sort_order = 0;
