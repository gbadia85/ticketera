// Edge Function: get-reservation-status
//
// Devuelve el estado actual de una reserva (sin exponer datos sensibles
// del comprador) para que la pantalla de "resultado del pago" pueda
// consultar si el webhook de Mercado Pago ya la confirmó.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, getServiceRoleKey } from '../_shared/cors.ts';
import { generateTicketQrBase64 } from '../_shared/qr.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reservationId = url.searchParams.get('reservation_id');
    if (!reservationId) {
      return jsonResponse({ error: 'missing_reservation_id' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      getServiceRoleKey()
    );

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select(
        'id, status, total_amount, event_id, created_at, events ( event_date, venues ( name ), shows ( title ) )'
      )
      .eq('id', reservationId)
      .single();

    if (error || !reservation) {
      return jsonResponse({ error: 'reservation_not_found' }, 404);
    }

    const { data: seatRows } = await supabase
      .from('reservation_seats')
      .select('event_seats ( seats ( label ) )')
      .eq('reservation_id', reservationId);

    const seatLabels = (seatRows ?? []).map((r: any) => r.event_seats?.seats?.label).filter(Boolean);

    const qrBase64 = reservation.status === 'approved' ? await generateTicketQrBase64(reservationId) : null;

    return jsonResponse({
      status: reservation.status,
      total: reservation.total_amount,
      purchased_at: reservation.created_at,
      event: {
        title: (reservation as any).events?.shows?.title,
        date: (reservation as any).events?.event_date,
        venue: (reservation as any).events?.venues?.name,
      },
      seats: seatLabels,
      qr_base64: qrBase64,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'internal_error', detail: String(err) }, 500);
  }
});
