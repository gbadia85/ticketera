import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listEventSeats } from '@/lib/api';

/**
 * Carga las butacas de un evento y se suscribe a los cambios en tiempo
 * real: si otro comprador retiene o compra una butaca, todos los mapas
 * abiertos se actualizan solos, sin recargar la página.
 */
export function useEventSeats(eventId) {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await listEventSeats(eventId);
      setSeats(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event_seats:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_seats', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Butaca nueva que no teníamos en memoria — puede pasar con
            // la sobreventa, que crea event_seats sobre la marcha (antes
            // esto no pasaba nunca, todas se creaban juntas al publicar
            // el evento). payload.new no trae los datos de seats/
            // seat_zones (no es un JOIN), así que recargamos todo para
            // no dejar cálculos de precio/zona/disponibilidad
            // desalineados.
            reload();
            return;
          }

          setSeats((prev) => {
            const id = payload.new?.id ?? payload.old?.id;
            const idx = prev.findIndex((s) => s.id === id);

            if (payload.eventType === 'DELETE') {
              if (idx === -1) return prev;
              const next = [...prev];
              next.splice(idx, 1);
              return next;
            }

            if (idx === -1) return prev;

            const next = [...prev];
            next[idx] = { ...next[idx], ...payload.new };
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, reload]);

  return { seats, loading, error, reload };
}
