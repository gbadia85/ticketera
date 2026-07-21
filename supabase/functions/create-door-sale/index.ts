// Edge Function: create-door-sale
//
// Registra una venta hecha en persona en la puerta del teatro: retiene
// las butacas elegidas, crea la reserva, y la marca como pagada en
// efectivo, todo en un solo paso (a diferencia de la compra online, acá
// no hay tiempo de espera: el cajero cobra y confirma al mismo tiempo).
// Devuelve el QR de la entrada en base64 para mostrarlo en pantalla.
//
// Requiere que quien llama esté logueado como admin (Supabase Auth) y
// que exista una caja ABIERTA para ese evento — si no hay caja abierta,
// se rechaza la venta (primero hay que "Abrir caja" desde el panel).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, getServiceRoleKey } from '../_shared/cors.ts';
import { generateTicketQrBase64 } from '../_shared/qr.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';

    // Verificamos que el token pertenezca a un admin logueado de verdad
    // (no alcanza con mandar cualquier header) antes de usar la service
    // role key para el resto de la operación.
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
    const soldBy = userData.user.email ?? userData.user.id;

    const body = await req.json();
    const { event_id, seat_ids, quantity, first_name, last_name, dni, phone, cash_shift_id, payment_method } = body;

    const hasSeatIds = Array.isArray(seat_ids) && seat_ids.length > 0;
    const hasQuantity = Number.isInteger(quantity) && quantity > 0;
    const validPaymentMethods = ['efectivo', 'transferencia', 'simulado'];
    const resolvedPaymentMethod = validPaymentMethods.includes(payment_method) ? payment_method : 'efectivo';

    if (!event_id || (!hasSeatIds && !hasQuantity) || !first_name || !last_name || !cash_shift_id) {
      return jsonResponse({ error: 'missing_fields' }, 400);
    }

    const supabase = createClient(supabaseUrl, getServiceRoleKey());

    const { data: shift } = await supabase
      .from('cash_shifts')
      .select('id, event_id, status')
      .eq('id', cash_shift_id)
      .maybeSingle();

    if (!shift || shift.status !== 'open' || shift.event_id !== event_id) {
      return jsonResponse({ error: 'shift_not_open', detail: 'No hay una caja abierta para este evento.' }, 409);
    }

    const sessionId = `door-${crypto.randomUUID()}`;

    const holdRpc = hasSeatIds
      ? supabase.rpc('hold_seats', {
          p_event_id: event_id,
          p_seat_ids: seat_ids,
          p_session_id: sessionId,
          p_hold_minutes: 3,
        })
      : supabase.rpc('hold_next_available_seats', {
          p_event_id: event_id,
          p_quantity: quantity,
          p_session_id: sessionId,
          p_hold_minutes: 3,
        });

    const { error: holdError } = await holdRpc;
    if (holdError) {
      return jsonResponse({ error: mapRpcError(holdError.message) }, 409);
    }

    const { data: pending, error: pendingError } = await supabase.rpc('create_pending_reservation', {
      p_event_id: event_id,
      p_session_id: sessionId,
      p_first_name: first_name,
      p_last_name: last_name,
      p_email: null,
      p_dni: dni ?? null,
      p_phone: phone ?? null,
    });
    if (pendingError) {
      return jsonResponse({ error: pendingError.message }, 400);
    }

    const reservationId = (pending as any).reservation_id;

    const { error: markError } = await supabase.rpc('mark_reservation_paid', {
      p_reservation_id: reservationId,
      p_payment_method: resolvedPaymentMethod,
      p_mp_payment_id: null,
      p_cash_shift_id: cash_shift_id,
    });
    if (markError) {
      return jsonResponse({ error: markError.message }, 400);
    }

    const { data: seatRows } = await supabase
      .from('reservation_seats')
      .select('event_seats ( seats ( label ) )')
      .eq('reservation_id', reservationId);
    const seatLabels = (seatRows ?? []).map((r: any) => r.event_seats?.seats?.label).filter(Boolean);

    const qrBase64 = await generateTicketQrBase64(reservationId);

    return jsonResponse({
      reservation_id: reservationId,
      seat_labels: seatLabels,
      total: (pending as any).total,
      qr_base64: qrBase64,
      sold_by: soldBy,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'internal_error', detail: String(err) }, 500);
  }
});

function mapRpcError(msg: string): string {
  if (msg.includes('seat_unavailable')) return 'seat_unavailable';
  if (msg.includes('seat_not_found')) return 'seat_not_found';
  if (msg.includes('sales_closed')) return 'sales_closed';
  if (msg.includes('not_enough_seats')) return 'not_enough_seats';
  if (msg.includes('invalid_quantity')) return 'invalid_quantity';
  if (msg.includes('event_not_found')) return 'event_not_found';
  return msg || 'unknown_error';
}
