// Wrapper fino sobre src/site.config.js para el mapa de butacas.
// Los valores en sí (qué hex usa cada estado, la paleta de zonas) viven
// TODOS en site.config.js — este archivo solo los expone con nombres
// cortos y agrega la lógica de "qué color le toca a esta butaca".
import { siteConfig } from '@/site.config';

export const SOLD_COLOR = siteConfig.colors.seatSold;
export const SELECTED_COLOR = siteConfig.colors.seatSelected;
export const HELD_OTHER_COLOR = siteConfig.colors.seatHeldByOther;
export const DISABLED_COLOR = siteConfig.colors.seatDisabled;
export const ZONE_COLOR_PALETTE = siteConfig.colors.zonePalette;

/**
 * Color de relleno de una butaca en el mapa interactivo, según su
 * estado. El color de zona SOLO se usa cuando está disponible: vendida
 * siempre es roja, seleccionada/retenida por vos siempre dorada,
 * retenida por otro comprador siempre gris — sin importar la zona.
 */
export function getSeatFill(seat, { isLocallySelected = false } = {}) {
  if (seat.isActive === false) return DISABLED_COLOR;
  if (isLocallySelected) return SELECTED_COLOR;
  if (seat.status === 'sold') return SOLD_COLOR;
  if (seat.status === 'held' && seat.heldByMe) return SELECTED_COLOR;
  if (seat.status === 'held' && !seat.heldByMe) return HELD_OTHER_COLOR;
  return seat.zoneColor || '#555555';
}

/**
 * Color de texto legible sobre el color de relleno de arriba: oscuro
 * sobre el dorado (claro), claro sobre el resto (todos son oscuros/
 * saturados).
 */
export function getSeatTextColor(fill) {
  return fill === SELECTED_COLOR ? '#1a1420' : '#F5EFE3';
}
