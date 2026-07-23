// Edge Function: create-payment-preference
//
// Recibe un reservation_id (ya creado por la RPC create_pending_reservation),
// arma una preferencia de pago en Mercado Pago (Checkout Pro) y devuelve la
// URL de pago (init_point) a la que el frontend debe redirigir al comprador.
//
// Secrets necesarios (ver SETUP.md para cómo configurarlos):
//   MP_ACCESS_TOKEN   -> Access Token de tu app en Mercado Pago Developers
//   FRONTEND_URL      -> URL pública de tu sitio (para las back_urls)
//
// Variables ya provistas automáticamente por Supabase:
//   SUPABASE_URL, y SUPABASE_SERVICE_ROLE_KEY (proyectos con claves clásicas)
//   o SUPABASE_SECRET_KEYS (proyectos nuevos) — ver getServiceRoleKey() en _shared/cors.ts

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, getServiceRoleKey } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reservation_id } = await req.json();
    if (!reservation_id) {
      return jsonResponse({ error: 'missing_reservation_id' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = getServiceRoleKey();
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const frontendUrl = Deno.env.get('FRONTEND_URL');

    if (!mpAccessToken || !frontendUrl) {
      return jsonResponse(
        { error: 'missing_secrets', detail: 'Configura MP_ACCESS_TOKEN y FRONTEND_URL con `supabase secrets set`.' },
        500
      );
    }

    if (!/^https?:\/\//.test(frontendUrl)) {
      return jsonResponse(
        {
          error: 'invalid_frontend_url',
          detail: `FRONTEND_URL="${frontendUrl}" no es una URL válida (tiene que empezar con http:// o https://). Revisá el secret con \`supabase secrets set FRONTEND_URL=...\`.`,
        },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('id, status, total_amount, first_name, last_name, email, event_id')
      .eq('id', reservation_id)
      .single();

    if (resError || !reservation) {
      return jsonResponse({ error: 'reservation_not_found' }, 404);
    }
    if (reservation.status !== 'pending') {
      return jsonResponse({ error: 'reservation_not_pending', status: reservation.status }, 409);
    }

    const { data: event } = await supabase
      .from('events')
      .select('event_date, venues ( name ), shows ( title )')
      .eq('id', reservation.event_id)
      .single();

    const { data: seatRows } = await supabase
      .from('reservation_seats')
      .select('price, event_seats ( seats ( label ) )')
      .eq('reservation_id', reservation_id);

    const items = (seatRows ?? []).map((row: any) => ({
      title: `${(event as any)?.shows?.title ?? 'Entrada'} — ${row.event_seats?.seats?.label ?? 'Butaca'}`,
      quantity: 1,
      unit_price: Number(row.price),
      currency_id: 'ARS',
    }));

    if (items.length === 0) {
      return jsonResponse({ error: 'no_seats_in_reservation' }, 409);
    }

    const preferenceBody: Record<string, unknown> = {
      items,
      payer: {
        name: reservation.first_name,
        surname: reservation.last_name,
        email: reservation.email,
      },
      external_reference: reservation.id,
      back_urls: {
        success: `${frontendUrl}/pago/resultado?reservation_id=${reservation.id}`,
        failure: `${frontendUrl}/pago/resultado?reservation_id=${reservation.id}`,
        pending: `${frontendUrl}/pago/resultado?reservation_id=${reservation.id}`,
      },
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: 'ENTRADAS TEATRO',
    };

    // auto_return (volver solo al sitio tras un pago aprobado) exige que
    // back_url.success sea una URL https públicamente válida — Mercado
    // Pago rechaza la preferencia entera con "auto_return invalid" si le
    // pasás algo como http://localhost:3000. En desarrollo local, mejor
    // omitirlo: el comprador solo tiene que tocar "Volver al sitio" a mano
    // en la pantalla de resultado de Mercado Pago.
    if (frontendUrl.startsWith('https://')) {
      preferenceBody.auto_return = 'approved';
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      // eslint-disable-next-line no-console
      console.error('Error de Mercado Pago:', mpData);
      const causeDetail = Array.isArray(mpData?.cause)
        ? mpData.cause.map((c: any) => c.description ?? c.code).filter(Boolean).join('; ')
        : null;
      const readableMessage = causeDetail || mpData?.message || 'Error desconocido de Mercado Pago';
      return jsonResponse({ error: 'mercadopago_error', message: readableMessage, detail: mpData }, 502);
    }

    await supabase
      .from('reservations')
      .update({ mp_preference_id: mpData.id, updated_at: new Date().toISOString() })
      .eq('id', reservation.id);

    return jsonResponse({
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      preference_id: mpData.id,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return jsonResponse({ error: 'internal_error', detail: String(err) }, 500);
  }
});
