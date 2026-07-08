import React from 'react';

/**
 * Fondo decorativo fijo, detrás de todo el contenido: tres "luces"
 * difuminadas (dorado / borravino / dorado claro) que se mueven muy
 * lentamente, dando sensación de profundidad y movimiento sutil sin
 * distraer de la lectura. Usa las variables de color del tema
 * (--primary, --secondary, --primary-light vía site.config.js), así
 * que si cambiás la paleta en site.config.js, esto se actualiza solo.
 *
 * Se monta una sola vez en App.jsx, fuera de <Routes>, para que se vea
 * en todas las páginas sin duplicar nada.
 */
const GlowBackdrop = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
    <div
      className="absolute -top-32 -right-32 h-[32rem] w-[32rem] rounded-full blur-[110px] animate-drift-1"
      style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.28), transparent 70%)' }}
    />
    <div
      className="absolute top-1/3 -left-40 h-[28rem] w-[28rem] rounded-full blur-[110px] animate-drift-2"
      style={{ background: 'radial-gradient(circle, hsl(var(--secondary) / 0.24), transparent 70%)' }}
    />
    <div
      className="absolute bottom-0 right-1/4 h-[24rem] w-[24rem] rounded-full blur-[100px] animate-drift-3"
      style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.16), transparent 70%)' }}
    />
  </div>
);

export default GlowBackdrop;
