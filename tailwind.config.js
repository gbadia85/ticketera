import { siteConfig, hexToHsl } from './src/site.config.js';

const c = siteConfig.colors;

/**
 * Este archivo NO define colores "a mano": los toma todos de
 * src/site.config.js. Si querés cambiar la paleta del sitio, editá ese
 * archivo — no este.
 *
 * Los tokens de tema (background, foreground, card, border, etc.) se
 * inyectan como variables CSS (`:root { --background: ...; }`) vía el
 * plugin `addBase` de más abajo, y Tailwind los consume como
 * `hsl(var(--background))`. Esto permite además soportar temas claros/
 * oscuros a futuro sin tocar los componentes.
 */
const cssVars = {
  background: hexToHsl(c.background),
  foreground: hexToHsl(c.foreground),
  card: hexToHsl(c.card),
  'card-foreground': hexToHsl(c.foreground),
  popover: hexToHsl(c.card),
  'popover-foreground': hexToHsl(c.foreground),
  primary: hexToHsl(c.primary),
  'primary-foreground': hexToHsl(c.primaryForeground),
  secondary: hexToHsl(c.secondary),
  'secondary-foreground': hexToHsl(c.secondaryForeground),
  muted: hexToHsl(c.muted),
  'muted-foreground': hexToHsl(c.mutedForeground),
  accent: hexToHsl(c.accent),
  'accent-foreground': hexToHsl(c.foreground),
  destructive: hexToHsl(c.destructive),
  'destructive-foreground': hexToHsl(c.destructiveForeground),
  border: hexToHsl(c.border),
  input: hexToHsl(c.border),
  ring: hexToHsl(c.primary),
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      fontFamily: {
        display: [siteConfig.fonts.display],
        sans: [siteConfig.fonts.sans],
        mono: [siteConfig.fonts.mono],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: c.success,
        gold: {
          DEFAULT: c.primary,
          light: c.primaryLight,
          dark: c.primaryDark,
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: 0 }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: 0 } },
        'curtain-rise': { '0%': { transform: 'scaleY(1)' }, '100%': { transform: 'scaleY(0)' } },
        'marquee-glow': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
        'drift-1': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(5%, 8%) scale(1.15)' },
        },
        'drift-2': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-6%, 4%) scale(1.1)' },
        },
        'drift-3': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(4%, -6%) scale(1.08)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'marquee-glow': 'marquee-glow 2.4s ease-in-out infinite',
        'drift-1': 'drift-1 18s ease-in-out infinite',
        'drift-2': 'drift-2 22s ease-in-out infinite',
        'drift-3': 'drift-3 26s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    ({ addBase }) => {
      addBase({
        ':root': {
          '--radius': '0.6rem',
          ...Object.fromEntries(Object.entries(cssVars).map(([k, v]) => [`--${k}`, v])),
        },
      });
    },
  ],
};
