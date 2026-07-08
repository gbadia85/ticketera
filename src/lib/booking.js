import { supabase } from '@/lib/supabaseClient';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Intenta retener butacas para esta sesión. Todo-o-nada: si alguna butaca
 * ya no está disponible, ninguna queda retenida y se lanza un error con
 * code = 'seat_unavailable'.
 */
export async function holdSeats(eventId, seatIds, sessionId, holdMinutes = 10) {
  const { data, error } = await supabase.rpc('hold_seats', {
    p_event_id: eventId,
    p_seat_ids: seatIds,
    p_session_id: sessionId,
    p_hold_minutes: holdMinutes,
  });
  if (error) {
    throw new Error(mapRpcError(error));
  }
  return data; // [{ event_seat_id, seat_id, held_until }]
}

export async function releaseSeats(eventId, sessionId) {
  const { error } = await supabase.rpc('release_seats', {
    p_event_id: eventId,
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function createPendingReservation(eventId, sessionId, customer) {
  const { data, error } = await supabase.rpc('create_pending_reservation', {
    p_event_id: eventId,
    p_session_id: sessionId,
    p_first_name: customer.firstName,
    p_last_name: customer.lastName,
    p_email: customer.email,
    p_dni: customer.dni,
    p_phone: customer.phone,
  });
  if (error) throw new Error(mapRpcError(error));
  return data; // { reservation_id, total, seat_count }
}

export async function createPaymentPreference(reservationId) {
  const res = await fetch(`${FUNCTIONS_URL}/create-payment-preference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ reservation_id: reservationId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? 'payment_preference_error');
  return data; // { init_point, sandbox_init_point }
}

export async function getReservationStatus(reservationId) {
  const res = await fetch(`${FUNCTIONS_URL}/get-reservation-status?reservation_id=${reservationId}`, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'reservation_status_error');
  return data;
}

function mapRpcError(error) {
  const msg = error.message || '';
  if (msg.includes('seat_unavailable')) return 'seat_unavailable';
  if (msg.includes('seat_not_found')) return 'seat_not_found';
  if (msg.includes('hold_expired')) return 'hold_expired';
  if (msg.includes('no_seats_requested')) return 'no_seats_requested';
  return msg || 'unknown_error';
}
