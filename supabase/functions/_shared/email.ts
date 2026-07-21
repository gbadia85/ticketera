// Helper compartido: arma y envía el mail de confirmación de compra,
// con el QR de ingreso adjunto e incrustado en el cuerpo del mail.
// Lo usan mp-webhook (pago real) y mock-confirm-payment (pago simulado)
// — la venta en puerta (create-door-sale) NO manda mail: el QR se
// muestra directo en pantalla, ahí mismo en la boletería.

import { generateTicketQrBase64 } from './qr.ts';

export async function sendTicketConfirmationEmail(params: {
  resendApiKey: string;
  emailFrom: string;
  to: string;
  firstName: string;
  eventTitle: string;
  venueName: string;
  eventDate: string;
  seatLabels: string[];
  total: number;
  reservationId: string;
}) {
  const {
    resendApiKey,
    emailFrom,
    to,
    firstName,
    eventTitle,
    venueName,
    eventDate,
    seatLabels,
    total,
    reservationId,
  } = params;

  const formattedDate = new Date(eventDate).toLocaleString('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const formattedTotal = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(total);

  const qrBase64 = await generateTicketQrBase64(reservationId);

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
      <div style="text-align:center; margin: 24px 0;">
        <img src="cid:ticket-qr" alt="Código QR de tu entrada" width="220" height="220" style="border-radius:8px;" />
        <p style="color:#B4A9BE; font-size:12px; margin-top:8px;">Mostrá este código en la puerta el día del evento.</p>
      </div>
      <p style="color:#B4A9BE; font-size:13px;">Si no ves la imagen del QR, la vas a encontrar también adjunta a este mail.</p>
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
      attachments: [
        {
          filename: 'entrada-qr.png',
          content: qrBase64,
          content_id: 'ticket-qr',
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('Error enviando email con Resend:', detail);
  }
}
