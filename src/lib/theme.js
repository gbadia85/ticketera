import { hexToHsl } from '@/site.config';

// Solo estas variables están conectadas a Tailwind vía CSS custom
// properties (hsl(var(--x))), así que son las únicas que se pueden
// recolorear en tiempo real sin reconstruir el sitio. (primaryLight/
// primaryDark de site.config.js quedan "horneados" en el build de
// Tailwind — cambiarlos requiere editar ese archivo y redeployar.)
const CSS_VAR_MAP = {
  color_primary: ['--primary', '--ring'],
  color_primary_foreground: ['--primary-foreground'],
  color_secondary: ['--secondary'],
  color_secondary_foreground: ['--secondary-foreground'],
  color_background: ['--background'],
};

/** Aplica los colores guardados en site_settings sobre el documento actual. */
export function applySiteSettingsTheme(settings) {
  if (!settings || typeof document === 'undefined') return;
  const root = document.documentElement;

  for (const [field, cssVars] of Object.entries(CSS_VAR_MAP)) {
    const hex = settings[field];
    if (!hex) continue;
    try {
      const hsl = hexToHsl(hex);
      cssVars.forEach((v) => root.style.setProperty(v, hsl));
    } catch {
      // Valor guardado inválido (no debería pasar si se cargó desde el
      // selector de color) — lo ignoramos en vez de romper el sitio.
    }
  }
}
