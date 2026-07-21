// Helper compartido: genera el QR de una reserva.
//
// El QR codifica directamente el reservation_id (UUID). No hace falta
// que sea secreto ni firmado: al escanearlo, check_in_reservation()
// solo devuelve nombre + butacas de ESA reserva puntual, y marcarla
// como "ingresada" no tiene valor para nadie que no sea la puerta del
// teatro el día del evento.

import QRCode from 'npm:qrcode@1.5.3';

/** Devuelve el PNG del QR como base64 (sin el prefijo data:image/...). */
export async function generateTicketQrBase64(reservationId: string): Promise<string> {
  const dataUrl: string = await QRCode.toDataURL(reservationId, {
    width: 480,
    margin: 2,
    color: { dark: '#14111A', light: '#FFFFFF' },
  });
  return dataUrl.split(',')[1];
}

/** Devuelve el PNG del QR como bytes crudos, para adjuntarlo al mail. */
export async function generateTicketQrBytes(reservationId: string): Promise<Uint8Array> {
  const base64 = await generateTicketQrBase64(reservationId);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
