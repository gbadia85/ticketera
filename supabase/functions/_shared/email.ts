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
  siteName: string;
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
    siteName,
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
      <p style="color:#C9A227; font-size:13px; letter-spacing:0.1em; text-transform:uppercase; margin:0 0 4px;">${siteName}</p>
      <h1 style="color:#C9A227; font-size:22px; margin-top:0;">¡Reserva confirmada!</h1>
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
      <p style="color:#5a5266; font-size:11px; margin-top:24px; border-top:1px solid #2a2433; padding-top:12px;">${siteName}</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: withSenderName(emailFrom, siteName),
      to: [to],
      subject: `${siteName} — Confirmación de compra: ${eventTitle}`,
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

// Si EMAIL_FROM es "Entradas <algo@dominio.com>", reemplaza el nombre
// de por delante ("Entradas") por el nombre del sitio configurado,
// conservando la dirección de mail tal cual — así el remitente que ve
// el comprador coincide con el nombre del sitio, sin tener que tocar
// el secret cada vez que cambia la personalización.
function withSenderName(emailFrom: string, siteName: string): string {
  const match = emailFrom.match(/<(.+)>/);
  if (match) {
    return `${siteName} <${match[1]}>`;
  }
  return emailFrom; // no tiene formato "Nombre <mail>", lo dejamos como está
}
