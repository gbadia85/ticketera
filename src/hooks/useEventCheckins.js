import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listEventReservations } from '@/lib/api';

/**
 * Carga las reservas aprobadas de un evento (con su estado de ingreso)
 * y se suscribe a cambios en tiempo real: cuando alguien escanea un QR
 * en la puerta, la pantalla en vivo se actualiza sola.
 */
export function useEventCheckins(eventId) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await listEventReservations(eventId);
      setReservations(data);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!eventId) return;

    // Los cambios de check-in son poco frecuentes comparado con el
    // detalle que necesitamos mostrar (nombre, butacas...), así que en
    // vez de parchear en memoria simplemente recargamos la lista
    // completa cada vez que algo cambia — es una sola consulta liviana.
    const channel = supabase
      .channel(`reservations:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `event_id=eq.${eventId}` },
        () => reload()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, reload]);

  return { reservations, loading, reload };
}
