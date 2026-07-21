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
// Eventos
// ---------------------------------------------------------------------
export async function listPublicEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*, venues ( id, name, address ), event_images ( id, url, path, sort_order )')
    .eq('status', 'scheduled')
    .order('event_date');
  if (error) throw error;
  return data.map((e) => ({ ...e, event_images: sortImages(e.event_images) }));
}

export async function listEventsByVenue(venueId) {
  const { data, error } = await supabase.from('events').select('id, title, status').eq('venue_id', venueId);
  if (error) throw error;
  return data;
}

export async function listAllEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*, venues ( id, name, address ), event_images ( id, url, path, sort_order )')
    .order('event_date', { ascending: false });
  if (error) throw error;
  return data.map((e) => ({ ...e, event_images: sortImages(e.event_images) }));
}

export async function getEvent(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('*, venues ( *, venue_images ( id, url, path, sort_order ) ), event_images ( id, url, path, sort_order )')
    .eq('id', eventId)
    .single();
  if (error) throw error;
  return {
    ...data,
    event_images: sortImages(data.event_images),
    venues: data.venues ? { ...data.venues, venue_images: sortImages(data.venues.venue_images) } : data.venues,
  };
}

export async function createEvent(event) {
  const { data, error } = await supabase.from('events').insert(event).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id, patch) {
  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
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
export async function listReservations(eventId) {
  let query = supabase
    .from('reservations')
    .select('*, events ( title ), reservation_seats ( price, event_seats ( seats ( label ) ) )')
    .order('created_at', { ascending: false });
  if (eventId) query = query.eq('event_id', eventId);
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
export async function listEventImages(eventId) {
  const { data, error } = await supabase
    .from('event_images')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function addEventImage(eventId, file, nextSortOrder) {
  const { url, path } = await uploadImageFile('event-images', eventId, file);
  const { data, error } = await supabase
    .from('event_images')
    .insert({ event_id: eventId, url, path, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) {
    await deleteImageFile('event-images', path);
    throw error;
  }
  return data;
}

export async function deleteEventImage(image) {
  const { error } = await supabase.from('event_images').delete().eq('id', image.id);
  if (error) throw error;
  await deleteImageFile('event-images', image.path);
}

export async function reorderEventImage(imageA, imageB) {
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
    .select('id, first_name, last_name, total_amount, created_at')
    .eq('cash_shift_id', shiftId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Todas las reservas aprobadas de un evento, con su estado de ingreso. */
export async function listEventReservations(eventId) {
  const { data, error } = await supabase
    .from('reservations')
    .select(
      'id, first_name, last_name, payment_method, total_amount, checked_in_at, checked_in_by, created_at, reservation_seats ( event_seats ( seats ( label ) ) )'
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

/** Marca el ingreso de una reserva a partir del contenido escaneado del QR. */
export async function checkInReservation(reservationId, checkedInBy) {
  const { data, error } = await supabase.rpc('check_in_reservation', {
    p_reservation_id: reservationId,
    p_checked_in_by: checkedInBy,
  });
  if (error) throw error;
  return data; // { valid, reason?, first_name, last_name, seat_labels, already_checked_in, checked_in_at }
}
