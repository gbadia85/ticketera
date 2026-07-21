// Edge Function: mock-confirm-payment
//
// Confirma una reserva "pending" como pagada, SIN pasar por Mercado
// Pago. Existe únicamente para poder probar todo el resto del flujo
// (mail con QR, check-in, etc.) sin depender de pagos reales mientras
// se termina de configurar/probar la integración con Mercado Pago.
//
// Seguridad: además del control del lado del frontend (el botón de
// "pagar" solo llama a esta función si VITE_PAYMENT_MODE=mock), esta
// función SIEMPRE revisa del lado del servidor que el secret
// PAYMENT_MODE esté en 'mock'. Si no está seteado así, se niega a
// confirmar cualquier pago — así nadie puede "comprar gratis" en
// producción aunque encuentre la URL de esta función.
//
// Secrets necesarios:
//   PAYMENT_MODE     -> tiene que valer exactamente "mock" para que esta
//                        función funcione. Sacalo (o ponelo en cualquier
//                        otro valor) cuando pases a pagos reales.
//   RESEND_API_KEY, EMAIL_FROM -> igual que en mp-webhook, para el mail
//                        de confirmación con el QR.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, getServiceRoleKey } from '../_shared/cors.ts';
import { sendTicketConfirmationEmail } from '../_shared/email.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const paymentMode = Deno.env.get('PAYMENT_MODE');
    if (paymentMode !== 'mock') {
      return jsonResponse(
        { error: 'mock_payments_disabled', detail: 'PAYMENT_MODE no está en "mock" en este proyecto de Supabase.' },
        403
      );
    }

    const { reservation_id } = await req.json();
    if (!reservation_id) {
      return jsonResponse({ error: 'missing_reservation_id' }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getServiceRoleKey());

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('id, status, first_name, email, total_amount, event_id')
      .eq('id', reservation_id)
      .single();

    if (resError || !reservation) {
      return jsonResponse({ error: 'reservation_not_found' }, 404);
    }
    if (reservation.status !== 'pending') {
      return jsonResponse({ error: 'reservation_not_pending', status: reservation.status }, 409);
    }

    const { error: markError } = await supabase.rpc('mark_reservation_paid', {
      p_reservation_id: reservation_id,
      p_payment_method: 'simulado',
      p_mp_payment_id: null,
      p_cash_shift_id: null,
    });
    if (markError) {
      return jsonResponse({ error: markError.message }, 400);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const emailFrom = Deno.env.get('EMAIL_FROM');
    if (resendApiKey && emailFrom && reservation.email) {
      const { data: event } = await supabase
        .from('events')
        .select('title, event_date, venues ( name )')
        .eq('id', reservation.event_id)
        .single();

      const { data: seatRows } = await supabase
        .from('reservation_seats')
        .select('event_seats ( seats ( label ) )')
        .eq('reservation_id', reservation_id);

      const seatLabels = (seatRows ?? []).map((r: any) => r.event_seats?.seats?.label).filter(Boolean);

      await sendTicketConfirmationEmail({
        resendApiKey,
        emailFrom,
        to: reservation.email,
        firstName: reservation.first_name,
        eventTitle: event?.title ?? 'Evento',
        venueName: (event as any)?.venues?.name ?? '',
        eventDate: event?.event_date ?? new Date().toISOString(),
        seatLabels,
        total: Number(reservation.total_amount),
        reservationId: reservation_id,
      });
    }

    return jsonResponse({ ok: true, reservation_id });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'internal_error', detail: String(err) }, 500);
  }
});
