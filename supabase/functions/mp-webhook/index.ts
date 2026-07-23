// Edge Function: mp-webhook
//
// Recibe las notificaciones de pago de Mercado Pago. Esta es la ÚNICA
// forma en la que una butaca pasa a estado 'sold' por un pago online:
// nunca se marca como vendida desde el frontend.
//
// Secrets necesarios:
//   MP_ACCESS_TOKEN     -> para consultar el detalle del pago en la API de MP
//   MP_WEBHOOK_SECRET   -> "Clave secreta" que Mercado Pago genera al
//                          configurar la URL de notificaciones (para
//                          validar que la notificación es genuina)
//   RESEND_API_KEY      -> API key de Resend, para el mail de confirmación
//   EMAIL_FROM          -> remitente del mail, ej: "Entradas <onboarding@resend.dev>"

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, getServiceRoleKey } from '../_shared/cors.ts';
import { sendTicketConfirmationEmail } from '../_shared/email.ts';

async function verifySignature(
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !requestId || !dataId) return false;

  let ts = '';
  let hash = '';
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');
    if (key?.trim() === 'ts') ts = value?.trim() ?? '';
    if (key?.trim() === 'v1') hash = value?.trim() ?? '';
  }
  if (!ts || !hash) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(manifest));
  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHash === hash;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Mercado Pago espera una respuesta rápida (2xx). Cualquier error interno
  // nuestro no debería hacer que MP reintente infinitamente notificaciones
  // que ya no puede reprocesar, así que respondemos 200 siempre que hayamos
  // podido leer la notificación, y logueamos los errores de negocio.
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') ?? url.searchParams.get('topic');
    const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');

    let bodyJson: any = null;
    try {
      bodyJson = await req.json();
    } catch {
      // algunas notificaciones no traen body, solo query params
    }
    const effectiveType = type ?? bodyJson?.type;
    const effectiveDataId = dataId ?? bodyJson?.data?.id;

    if (effectiveType !== 'payment' || !effectiveDataId) {
      // Notificación de un tópico que no nos interesa (ej. merchant_order)
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!;
    const mpWebhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');

    if (mpWebhookSecret) {
      const signatureHeader = req.headers.get('x-signature');
      const requestId = req.headers.get('x-request-id');
      const valid = await verifySignature(signatureHeader, requestId, effectiveDataId, mpWebhookSecret);
      if (!valid) {
        console.error('Firma de webhook inválida, se descarta la notificación.');
        return new Response('invalid signature', { status: 200, headers: corsHeaders });
      }
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${effectiveDataId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    if (!paymentRes.ok) {
      console.error('No se pudo consultar el pago en Mercado Pago', await paymentRes.text());
      return new Response('ok', { status: 200, headers: corsHeaders });
    }
    const payment = await paymentRes.json();
    const reservationId = payment.external_reference;
    const paymentStatus = payment.status; // approved | rejected | pending | in_process | cancelled

    if (!reservationId) {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      getServiceRoleKey()
    );

    const { data: reservation } = await supabase
      .from('reservations')
      .select('id, status, first_name, email, total_amount, event_id')
      .eq('id', reservationId)
      .single();

    if (!reservation) {
      console.error('Reserva no encontrada para external_reference', reservationId);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Notificación repetida sobre una reserva ya procesada: no hacer nada más.
    if (reservation.status !== 'pending') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    if (paymentStatus === 'approved') {
      const { error: markError } = await supabase.rpc('mark_reservation_paid', {
        p_reservation_id: reservationId,
        p_payment_method: 'mercadopago',
        p_mp_payment_id: String(effectiveDataId),
        p_cash_shift_id: null,
      });
      if (markError) {
        console.error('Error marcando la reserva como pagada:', markError);
        return new Response('ok', { status: 200, headers: corsHeaders });
      }

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const emailFrom = Deno.env.get('EMAIL_FROM');
      if (resendApiKey && emailFrom && reservation.email) {
        const { data: event } = await supabase
          .from('events')
          .select('event_date, venues ( name ), shows ( title )')
          .eq('id', reservation.event_id)
          .single();

        const { data: seatRows } = await supabase
          .from('reservation_seats')
          .select('event_seats ( seats ( label ) )')
          .eq('reservation_id', reservationId);

        const seatLabels = (seatRows ?? []).map((r: any) => r.event_seats?.seats?.label).filter(Boolean);

        const { data: siteSettings } = await supabase
          .from('site_settings')
          .select('site_name')
          .eq('id', true)
          .maybeSingle();

        await sendTicketConfirmationEmail({
          resendApiKey,
          emailFrom,
          to: reservation.email,
          firstName: reservation.first_name,
          siteName: siteSettings?.site_name || 'Butaca',
          eventTitle: (event as any)?.shows?.title ?? 'Evento',
          venueName: (event as any)?.venues?.name ?? '',
          eventDate: event?.event_date ?? new Date().toISOString(),
          seatLabels,
          total: Number(reservation.total_amount),
          reservationId,
        });
      }
    } else if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
      await supabase
        .from('reservations')
        .update({ status: 'rejected', mp_payment_id: String(effectiveDataId), updated_at: new Date().toISOString() })
        .eq('id', reservationId);

      await supabase
        .from('event_seats')
        .update({ status: 'available', held_by: null, held_until: null, reservation_id: null, updated_at: new Date().toISOString() })
        .eq('reservation_id', reservationId);
    }
    // pending / in_process: no tocamos nada, esperamos la próxima notificación.

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('Error procesando webhook de Mercado Pago:', err);
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
});
