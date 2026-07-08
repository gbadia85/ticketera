import { useEffect, useState } from 'react';

/**
 * Cuenta regresiva hasta `targetIso` (timestamp ISO devuelto por el
 * servidor al retener las butacas). Se basa en la hora del propio
 * dispositivo, así que es aproximada, pero quien manda es siempre el
 * `held_until` que vive en la base de datos: si el usuario llega a pagar
 * después de que expiró, el backend igual va a rechazar la operación.
 */
export function useCountdown(targetIso, onExpire) {
  const [secondsLeft, setSecondsLeft] = useState(() => computeSeconds(targetIso));

  useEffect(() => {
    if (!targetIso) return;
    setSecondsLeft(computeSeconds(targetIso));

    const interval = setInterval(() => {
      const remaining = computeSeconds(targetIso);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetIso]); // eslint-disable-line react-hooks/exhaustive-deps

  return secondsLeft;
}

function computeSeconds(targetIso) {
  if (!targetIso) return 0;
  const diff = Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000);
  return Math.max(diff, 0);
}

export function formatMMSS(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
