import { supabase } from '@/lib/supabaseClient';

// Ordena in-place por sort_order un array de imágenes que puede venir
// undefined (cuando la relación no trajo filas).
const sortImages = (images) => (images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

// ---------------------------------------------------------------------
// Salas (venues)
// ---------------------------------------------------------------------
export async function listVenues() {
  const { data, error } = await supabase
    .from('venues')
    .select('*, venue_images ( id, url, path, sort_order )')
    .order('name');
  if (error) throw error;
  return data.map((v) => ({ ...v, venue_images: sortImages(v.venue_images) }));
}

export async function getVenuePublic(venueId) {
  const { data, error } = await supabase
    .from('venues')
    .select('*, venue_images ( id, url, path, sort_order )')
    .eq('id', venueId)
    .single();
  if (error) throw error;
  return { ...data, venue_images: sortImages(data.venue_images) };
}

export async function createVenue(venue) {
  const { data, error } = await supabase.from('venues').insert(venue).select().single();
  if (error) throw error;
  return data;
}

export async function updateVenue(id, patch) {
  const { data, error } = await supabase.from('venues').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVenue(id) {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Zonas de precio
// ---------------------------------------------------------------------
export async function listZones(venueId) {
  const { data, error } = await supabase.from('seat_zones').select('*').eq('venue_id', venueId).order('default_price');
  if (error) throw error;
  return data;
}

export async function createZone(zone) {
  const { data, error } = await supabase.from('seat_zones').insert(zone).select().single();
  if (error) throw error;
  return data;
}

export async function updateZone(id, patch) {
  const { data, error } = await supabase.from('seat_zones').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteZone(id) {
  const { error } = await supabase.from('seat_zones').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Butacas (layout de la sala)
// ---------------------------------------------------------------------
export async function listSeats(venueId) {
  const { data, error } = await supabase
    .from('seats')
    .select('*, seat_zones ( id, name, color, default_price )')
    .eq('venue_id', venueId)
    .order('pos_row')
    .order('pos_col');
  if (error) throw error;
  return data;
}

export async function bulkCreateSeats(seats) {
  const { data, error } = await supabase.from('seats').insert(seats).select();
  if (error) throw error;
  return data;
}

export async function updateSeat(id, patch) {
  const { data, error } = await supabase.from('seats').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function swapSeatPositions(seatIdA, seatIdB) {
  const { error } = await supabase.rpc('swap_seat_positions', { p_seat_id_a: seatIdA, p_seat_id_b: seatIdB });
  if (error) throw error;
}

export async function deleteSeatsByVenue(venueId) {
  const { error } = await supabase.from('seats').delete().eq('venue_id', venueId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Shows (el espectáculo: título, descripción, imágenes, sponsors) y
// funciones (cada fecha/hora puntual — es la unidad de venta: butacas,
// precios, reservas, caja y check-in siguen viviendo acá, sin cambios).
// ---------------------------------------------------------------------
async function attachSoldOutStatus(events) {
  if (events.length === 0) return events;
  const { data: statuses, error } = await supabase
    .from('event_sold_out_status')
    .select('*')
    .in(
      'event_id',
      events.map((e) => e.id)
    );
  if (error) throw error;
  const byId = new Map(statuses.map((s) => [s.event_id, s]));
  return events.map((e) => ({ ...e, sold_out_status: byId.get(e.id) ?? null }));
}

const SALES_CUTOFF_MS = 30 * 60 * 1000;
export const isFuncionSalesClosed = (funcion) => Date.now() > new Date(funcion.event_date).getTime() + SALES_CUTOFF_MS;

/** Cartelera pública: shows con al menos una función todavía visible
 * (no vencida hace más de 24hs), cada uno con sus funciones ordenadas
 * por fecha y su propio estado de disponibilidad. */
export async function listPublicShows() {
  const visibleSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('shows')
    .select(
      '*, venues ( id, name, address, capacity, general_admission ), event_images ( id, url, path, sort_order ), events!inner ( * )'
    )
    .eq('events.status', 'scheduled')
    .gte('events.event_date', visibleSince)
    .order('title');
  if (error) throw error;

  const allFunciones = await attachSoldOutStatus(data.flatMap((s) => s.events ?? []));
  const statusById = new Map(allFunciones.map((f) => [f.id, f.sold_out_status]));

  return data.map((show) => {
    const funciones = (show.events ?? [])
      .map((f) => ({ ...f, sold_out_status: statusById.get(f.id) ?? null }))
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    // Tarjeta de la cartelera: mostramos la primera función que todavía
    // no cerró venta; si ya cerraron todas (pero siguen en la ventana
    // de 24hs), mostramos la última, marcada como "pasada".
    const nextFuncion = funciones.find((f) => !isFuncionSalesClosed(f)) ?? funciones[funciones.length - 1];
    return {
      ...show,
      event_images: sortImages(show.event_images),
      funciones,
      nextFuncion,
      isPast: nextFuncion ? isFuncionSalesClosed(nextFuncion) : false,
      isSoldOut: funciones.every((f) => f.sold_out_status?.is_sold_out),
    };
  });
}

/** Una función puntual, con el título del show y la sala — para el checkout. */
export async function getFuncion(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('*, shows ( title, sponsors_label ), venues ( id, name, address, capacity, general_admission )')
    .eq('id', eventId)
    .single();
  if (error) throw error;
  return data;
}

/** Todas las funciones (para los selectores del admin: venta en
 * puerta, pantalla en vivo, filtro de reservas), con el título del
 * show ya incluido. */
export async function listAllFunciones() {
  const { data, error } = await supabase
    .from('events')
    .select('*, shows ( title, sponsors_label ), venues ( id, name, address, capacity, general_admission )')
    .order('event_date', { ascending: false });
  if (error) throw error;
  return attachSoldOutStatus(data);
}

/** Todos los shows con sus funciones, para el admin de eventos. */
export async function listShows() {
  const { data, error } = await supabase
    .from('shows')
    .select(
      '*, venues ( id, name, address, capacity, general_admission ), event_images ( id, url, path, sort_order ), event_sponsors ( id, url, path, sort_order ), events ( * )'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;

  const allFunciones = await attachSoldOutStatus(data.flatMap((s) => s.events ?? []));
  const statusById = new Map(allFunciones.map((f) => [f.id, f.sold_out_status]));

  return data.map((show) => ({
    ...show,
    event_images: sortImages(show.event_images),
    event_sponsors: sortImages(show.event_sponsors),
    events: (show.events ?? [])
      .map((f) => ({ ...f, sold_out_status: statusById.get(f.id) ?? null }))
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date)),
  }));
}

/** Un show puntual con todas sus funciones (para la página de compra). */
export async function getShow(showId) {
  const { data, error } = await supabase
    .from('shows')
    .select(
      '*, venues ( *, venue_images ( id, url, path, sort_order ) ), event_images ( id, url, path, sort_order ), event_sponsors ( id, url, path, sort_order ), events ( * )'
    )
    .eq('id', showId)
    .single();
  if (error) throw error;

  const funciones = (await attachSoldOutStatus(data.events ?? [])).sort(
    (a, b) => new Date(a.event_date) - new Date(b.event_date)
  );

  return {
    ...data,
    event_images: sortImages(data.event_images),
    event_sponsors: sortImages(data.event_sponsors),
    venues: data.venues ? { ...data.venues, venue_images: sortImages(data.venues.venue_images) } : data.venues,
    funciones,
  };
}

export async function createShow(show) {
  const { data, error } = await supabase.from('shows').insert(show).select().single();
  if (error) throw error;
  return data;
}

export async function updateShow(id, patch) {
  const { data, error } = await supabase.from('shows').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShow(id) {
  const { error } = await supabase.from('shows').delete().eq('id', id);
  if (error) throw error;
}

/** Agrega una función (fecha/hora) nueva a un show existente — la sala
 * es siempre la del show, el chequeo de "sala libre" corre solo (es un
 * trigger en la base). */
export async function createFuncion({ showId, venueId, eventDate }) {
  const { data, error } = await supabase
    .from('events')
    .insert({ show_id: showId, venue_id: venueId, event_date: eventDate, status: 'draft' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFuncion(id, patch) {
  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFuncion(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

export async function listEventsByVenue(venueId) {
  const { data, error } = await supabase.from('events').select('id, status').eq('venue_id', venueId);
  if (error) throw error;
  return data;
}

export async function setEventZonePrices(eventId, zonePrices) {
  // zonePrices: [{ zone_id, price }]
  const rows = zonePrices.map((zp) => ({ event_id: eventId, zone_id: zp.zone_id, price: zp.price }));
  const { error } = await supabase
    .from('event_zone_prices')
    .upsert(rows, { onConflict: 'event_id,zone_id' });
  if (error) throw error;
}

export async function getEventZonePrices(eventId) {
  const { data, error } = await supabase.from('event_zone_prices').select('*').eq('event_id', eventId);
  if (error) throw error;
  return data;
}

export async function publishEvent(eventId) {
  const { error } = await supabase.rpc('publish_event', { p_event_id: eventId });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Butacas de un evento (mapa interactivo)
// ---------------------------------------------------------------------
export async function listEventSeats(eventId) {
  const { data, error } = await supabase
    .from('event_seats')
    .select('*, seats ( row_label, seat_number, pos_row, pos_col, label, is_active ), seat_zones ( name, color )')
    .eq('event_id', eventId);
  if (error) throw error;
  return data;
}

export async function listMyHeldSeats(eventId, sessionId) {
  const { data, error } = await supabase
    .from('event_seats')
    .select('*, seats ( row_label, seat_number, label ), seat_zones ( name )')
    .eq('event_id', eventId)
    .eq('held_by', sessionId)
    .eq('status', 'held')
    .gt('held_until', new Date().toISOString());
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Reservas (panel de admin)
// ---------------------------------------------------------------------
export async function listReservations({ eventId, venueId } = {}) {
  let query = supabase
    .from('reservations')
    .select(
      '*, events!inner ( event_date, venue_id, shows ( title ), venues ( id, name ) ), reservation_seats ( price, event_seats ( seats ( label ) ) )'
    )
    .order('created_at', { ascending: false });
  if (eventId) query = query.eq('event_id', eventId);
  if (venueId) query = query.eq('events.venue_id', venueId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Zona de peligro (admin): borrado masivo
// ---------------------------------------------------------------------
export async function adminDeleteAllEvents() {
  const { error } = await supabase.rpc('admin_delete_all_events');
  if (error) throw error;
}

export async function adminDeleteAllVenues() {
  const { error } = await supabase.rpc('admin_delete_all_venues');
  if (error) throw error;
}

export async function adminResetDatabase() {
  const { error } = await supabase.rpc('admin_reset_database');
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Imágenes (eventos y salas)
// ---------------------------------------------------------------------
// Sube un archivo a un bucket de Storage y devuelve { url, path }.
// El nombre de archivo se genera con un id random para evitar colisiones
// y problemas con caracteres raros en el nombre original.
async function uploadImageFile(bucket, ownerId, file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

async function deleteImageFile(bucket, path) {
  // Si falla el borrado del archivo igual seguimos: es preferible tener
  // un archivo huérfano en Storage que una fila que no se puede borrar.
  await supabase.storage.from(bucket).remove([path]);
}

// --- Imágenes de evento (máx. 5, se recomienda controlarlo desde la UI) ---
export async function listShowImages(showId) {
  const { data, error } = await supabase
    .from('event_images')
    .select('*')
    .eq('show_id', showId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function addShowImage(showId, file, nextSortOrder) {
  const { url, path } = await uploadImageFile('event-images', showId, file);
  const { data, error } = await supabase
    .from('event_images')
    .insert({ show_id: showId, url, path, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) {
    await deleteImageFile('event-images', path);
    throw error;
  }
  return data;
}

export async function deleteShowImage(image) {
  const { error } = await supabase.from('event_images').delete().eq('id', image.id);
  if (error) throw error;
  await deleteImageFile('event-images', image.path);
}

export async function reorderShowImage(imageA, imageB) {
  // Intercambia el sort_order de dos imágenes (mover arriba/abajo).
  const { error: e1 } = await supabase
    .from('event_images')
    .update({ sort_order: imageB.sort_order })
    .eq('id', imageA.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from('event_images')
    .update({ sort_order: imageA.sort_order })
    .eq('id', imageB.id);
  if (e2) throw e2;
}

// --- Sponsors / auspiciantes de evento (máx. 5, misma mecánica que las
// imágenes de evento — se guardan en el mismo bucket, bajo una
// subcarpeta "sponsors") ---
export async function listShowSponsors(showId) {
  const { data, error } = await supabase
    .from('event_sponsors')
    .select('*')
    .eq('show_id', showId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function addShowSponsor(showId, file, nextSortOrder) {
  const { url, path } = await uploadImageFile('event-images', `${showId}/sponsors`, file);
  const { data, error } = await supabase
    .from('event_sponsors')
    .insert({ show_id: showId, url, path, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) {
    await deleteImageFile('event-images', path);
    throw error;
  }
  return data;
}

export async function deleteShowSponsor(sponsor) {
  const { error } = await supabase.from('event_sponsors').delete().eq('id', sponsor.id);
  if (error) throw error;
  await deleteImageFile('event-images', sponsor.path);
}

export async function reorderShowSponsor(a, b) {
  const { error: e1 } = await supabase.from('event_sponsors').update({ sort_order: b.sort_order }).eq('id', a.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('event_sponsors').update({ sort_order: a.sort_order }).eq('id', b.id);
  if (e2) throw e2;
}

// --- Imágenes de sala ---
export async function listVenueImages(venueId) {
  const { data, error } = await supabase
    .from('venue_images')
    .select('*')
    .eq('venue_id', venueId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function addVenueImage(venueId, file, nextSortOrder) {
  const { url, path } = await uploadImageFile('venue-images', venueId, file);
  const { data, error } = await supabase
    .from('venue_images')
    .insert({ venue_id: venueId, url, path, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) {
    await deleteImageFile('venue-images', path);
    throw error;
  }
  return data;
}

export async function deleteVenueImage(image) {
  const { error } = await supabase.from('venue_images').delete().eq('id', image.id);
  if (error) throw error;
  await deleteImageFile('venue-images', image.path);
}

export async function reorderVenueImage(imageA, imageB) {
  const { error: e1 } = await supabase
    .from('venue_images')
    .update({ sort_order: imageB.sort_order })
    .eq('id', imageA.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from('venue_images')
    .update({ sort_order: imageA.sort_order })
    .eq('id', imageB.id);
  if (e2) throw e2;
}

// ---------------------------------------------------------------------
// Caja (apertura/cierre por evento) y venta en puerta
// ---------------------------------------------------------------------

/** Caja actualmente abierta para un evento, o null si no hay ninguna. */
export async function getOpenCashShift(eventId) {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'open')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function openCashShift(eventId, openingAmount, openedBy) {
  const { data, error } = await supabase
    .from('cash_shifts')
    .insert({ event_id: eventId, opening_amount: openingAmount, opened_by: openedBy })
    .select()
    .single();
  if (error) {
    // Ya hay una caja abierta para este evento (índice único) — es una
    // condición esperada si dos personas la abren casi al mismo tiempo,
    // así que devolvemos la que ya está abierta en vez de fallar.
    if (error.code === '23505') {
      return getOpenCashShift(eventId);
    }
    throw error;
  }
  return data;
}

export async function closeCashShift(shiftId, countedAmount, closedBy, notes) {
  const { data, error } = await supabase.rpc('close_cash_shift', {
    p_shift_id: shiftId,
    p_counted_amount: countedAmount,
    p_closed_by: closedBy,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function listCashShiftHistory(eventId) {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('event_id', eventId)
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Ventas (reservas aprobadas) de una caja puntual — para el arqueo. */
export async function listCashShiftSales(shiftId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, first_name, last_name, total_amount, payment_method, status, created_at')
    .eq('cash_shift_id', shiftId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Todas las reservas aprobadas de un evento, con su estado de ingreso. */
export async function listEventReservations(eventId) {
  const { data, error } = await supabase
    .from('reservations')
    .select(
      'id, first_name, last_name, payment_method, total_amount, entry_status, checked_in_at, checked_in_by, created_at, reservation_seats ( event_seats ( seats ( label ) ) )'
    )
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .order('checked_in_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data.map((r) => ({
    ...r,
    seatLabels: (r.reservation_seats ?? []).map((rs) => rs.event_seats?.seats?.label).filter(Boolean),
  }));
}

/** Consulta una reserva para check-in SIN marcar nada todavía (paso 1: leer el QR). */
export async function lookupReservationCheckin(reservationId) {
  const { data, error } = await supabase.rpc('lookup_reservation_checkin', {
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data; // { valid, reason?, already_inside, first_name, last_name, seat_labels, checked_in_at }
}

/** Confirma el ingreso de verdad (paso 2: cuando la puerta le da el OK). */
export async function confirmReservationCheckin(reservationId, checkedInBy) {
  const { data, error } = await supabase.rpc('confirm_reservation_checkin', {
    p_reservation_id: reservationId,
    p_checked_in_by: checkedInBy,
  });
  if (error) throw error;
  return data;
}

/** La persona sale (puede volver a escanear su QR más tarde para reingresar). */
export async function markReservationExit(reservationId, by) {
  const { data, error } = await supabase.rpc('mark_reservation_exit', {
    p_reservation_id: reservationId,
    p_by: by,
  });
  if (error) throw error;
  return data;
}

/** El escaneo fue un error: deshace el ingreso, como si nunca hubiera entrado. */
export async function cancelReservationCheckin(reservationId, by) {
  const { data, error } = await supabase.rpc('cancel_reservation_checkin', {
    p_reservation_id: reservationId,
    p_by: by,
  });
  if (error) throw error;
  return data;
}

/** Crea (o actualiza el precio de) las butacas virtuales de una sala de entrada general. */
export async function ensureGeneralAdmissionSeats(venueId, price) {
  const { error } = await supabase.rpc('ensure_general_admission_seats', {
    p_venue_id: venueId,
    p_price: price,
  });
  if (error) throw error;
}

/** Si subió la capacidad de una sala de entrada general, genera las butacas
 * virtuales que faltan (y las suma a los eventos ya publicados de esa sala). */
export async function syncGeneralAdmissionCapacity(venueId) {
  const { error } = await supabase.rpc('sync_general_admission_capacity', { p_venue_id: venueId });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Reservas expiradas
// ---------------------------------------------------------------------

/** Borra todas las reservas con status='expired'. Devuelve cuántas borró. */
export async function deleteExpiredReservations() {
  const { data, error } = await supabase.rpc('delete_expired_reservations');
  if (error) throw error;
  return data; // cantidad borrada
}

// ---------------------------------------------------------------------
// Personalización del sitio (nombre, logo, colores) — editable desde
// el admin, con lectura pública para que el sitio la aplique.
// ---------------------------------------------------------------------

export async function getSiteSettings() {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSiteSettings(patch) {
  const { data, error } = await supabase
    .from('site_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadSiteLogo(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const path = `logo-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('site-assets').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------
// Vaciado de buckets de Storage (usado por la Zona de Peligro): borra
// los ARCHIVOS de verdad, no solo las filas de la base — evita que
// queden imágenes huérfanas ocupando espacio después de un reseteo.
// ---------------------------------------------------------------------
async function purgeBucket(bucket) {
  const { data: entries, error } = await supabase.storage.from(bucket).list('', { limit: 1000 });
  if (error) throw error;

  const paths = [];
  for (const entry of entries ?? []) {
    if (entry.id === null) {
      // Es una "carpeta" (nuestro esquema guarda cada imagen en
      // <event_id_o_venue_id>/<archivo>) — listamos adentro.
      const { data: files } = await supabase.storage.from(bucket).list(entry.name, { limit: 1000 });
      for (const file of files ?? []) {
        paths.push(`${entry.name}/${file.name}`);
      }
    } else {
      paths.push(entry.name);
    }
  }

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  }
  return paths.length;
}

export async function purgeEventImagesStorage() {
  return purgeBucket('event-images');
}

export async function purgeVenueImagesStorage() {
  return purgeBucket('venue-images');
}

export async function purgeAllUploadedImages() {
  const a = await purgeEventImagesStorage();
  const b = await purgeVenueImagesStorage();
  return a + b;
}

// ---------------------------------------------------------------------
// Devolución de entradas (venta en puerta)
// ---------------------------------------------------------------------

/** Devuelve una entrada: libera la butaca y la marca como reembolsada.
 * p_refunded_amount es lo que el cajero cargó que devolvió de verdad
 * (puede ser menor al total original, por ejemplo si hay un descuento). */
export async function refundReservation(reservationId, refundedAmount, by, cashShiftId) {
  const { data, error } = await supabase.rpc('refund_reservation', {
    p_reservation_id: reservationId,
    p_refunded_amount: refundedAmount,
    p_by: by,
    p_cash_shift_id: cashShiftId,
  });
  if (error) throw error;
  return data; // { ok, reservation_id, original_amount, refunded_amount }
}

/** Reservas aprobadas de un evento que se pueden devolver (para buscar en la venta en puerta). */
export async function searchRefundableReservations(eventId, query) {
  let q = supabase
    .from('reservations')
    .select(
      'id, first_name, last_name, total_amount, payment_method, created_at, reservation_seats ( event_seats ( seats ( label ) ) )'
    )
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20);
  if (query) {
    q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data.map((r) => ({
    ...r,
    seatLabels: (r.reservation_seats ?? []).map((rs) => rs.event_seats?.seats?.label).filter(Boolean),
  }));
}

/** Devoluciones procesadas durante una caja puntual (para el resumen del arqueo). */
export async function listCashShiftRefunds(shiftId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, first_name, last_name, refunded_amount, refunded_at')
    .eq('refund_cash_shift_id', shiftId)
    .order('refunded_at', { ascending: false });
  if (error) throw error;
  return data;
}
