// Edge Function: mp-webhook
//
// Recibe las notificaciones de pago de Mercado Pago. Esta es la ÚNICA
// forma en la que una butaca pasa a estado 'sold' de forma definitiva:
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

async function sendConfirmationEmail(params: {
  resendApiKey: string;
  emailFrom: string;
  to: string;
  firstName: string;
  eventTitle: string;
  venueName: string;
  eventDate: string;
  seatLabels: string[];
  total: number;
}) {
  const { resendApiKey, emailFrom, to, firstName, eventTitle, venueName, eventDate, seatLabels, total } = params;

  const formattedDate = new Date(eventDate).toLocaleString('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const formattedTotal = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(total);

  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: auto; padding: 24px; background:#14111A; color:#F5EFE3;">
      <h1 style="color:#C9A227; font-size:22px;">¡Reserva confirmada!</h1>
      <p>Hola ${firstName}, tu compra fue aprobada. Estos son los detalles:</p>
      <table style="width:100%; margin: 16px 0; border-collapse: collapse;">
        <tr><td style="padding:6px 0; color:#B4A9BE;">Evento</td><td style="text-align:right;">${eventTitle}</td></tr>
        <tr><td style="padding:6px 0; color:#B4A9BE;">Sala</td><td style="text-align:right;">${venueName}</td></tr>
        <tr><td style="padding:6px 0; color:#B4A9BE;">Fecha</td><td style="text-align:right;">${formattedDate}</td></tr>
        <tr><td style="padding:6px 0; color:#B4A9BE;">Butacas</td><td style="text-align:right;">${seatLabels.join(', ')}</td></tr>
        <tr><td style="padding:10px 0; font-weight:bold;">Total</td><td style="text-align:right; font-weight:bold; color:#C9A227;">${formattedTotal}</td></tr>
      </table>
      <p style="color:#B4A9BE; font-size:13px;">Presentá este mail o tu DNI en la boletería del teatro.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      subject: `Confirmación de compra — ${eventTitle}`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('Error enviando email con Resend:', detail);
  }
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
      await supabase
        .from('reservations')
        .update({ status: 'approved', mp_payment_id: String(effectiveDataId), updated_at: new Date().toISOString() })
        .eq('id', reservationId);

      await supabase
        .from('event_seats')
        .update({ status: 'sold', held_by: null, held_until: null, updated_at: new Date().toISOString() })
        .eq('reservation_id', reservationId);

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const emailFrom = Deno.env.get('EMAIL_FROM');
      if (resendApiKey && emailFrom) {
        const { data: event } = await supabase
          .from('events')
          .select('title, event_date, venues ( name )')
          .eq('id', reservation.event_id)
          .single();

        const { data: seatRows } = await supabase
          .from('reservation_seats')
          .select('event_seats ( seats ( label ) )')
          .eq('reservation_id', reservationId);

        const seatLabels = (seatRows ?? []).map((r: any) => r.event_seats?.seats?.label).filter(Boolean);

        await sendConfirmationEmail({
          resendApiKey,
          emailFrom,
          to: reservation.email,
          firstName: reservation.first_name,
          eventTitle: event?.title ?? 'Evento',
          venueName: (event as any)?.venues?.name ?? '',
          eventDate: event?.event_date ?? new Date().toISOString(),
          seatLabels,
          total: Number(reservation.total_amount),
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
