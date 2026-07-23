import React, { useEffect, useState } from 'react';
import { DoorOpen, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { listAllFunciones, updateFuncion } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

// Separado de "Venta en puerta" a propósito: quien controla el acceso
// en la puerta no siempre es la misma persona que vende entradas, y
// puede haber más de un evento habilitado a la vez (por ejemplo dos
// funciones en dos salas distintas, a la misma hora).
const OpenDoorTab = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listAllFunciones()
      .then((data) => setEvents(data.filter((e) => e.status === 'scheduled')))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleToggle = async (event) => {
    try {
      await updateFuncion(event.id, { checkin_enabled: !event.checkin_enabled });
      reload();
    } catch (err) {
      toast({ title: 'No pudimos actualizar el evento', description: err.message, variant: 'destructive' });
    }
  };

  const enabledCount = events.filter((e) => e.checkin_enabled).length;

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Solo se puede escanear y confirmar el ingreso de entradas de eventos habilitados acá — así nadie entra con
        el QR de otra función. Podés habilitar más de uno a la vez si hay varias funciones en simultáneo.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-gold" />
            {enabledCount === 0 ? 'Ningún evento habilitado' : `${enabledCount} evento${enabledCount > 1 ? 's' : ''} habilitado${enabledCount > 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {loading && <p className="text-sm text-muted-foreground">Cargando eventos…</p>}
          {!loading && events.length === 0 && <p className="text-sm text-muted-foreground">No hay eventos publicados.</p>}
          {events.map((e) => (
            <label
              key={e.id}
              className={`flex items-center justify-between gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                e.checkin_enabled ? 'border-gold/60 bg-gold/10' : 'border-border'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{e.shows?.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(e.event_date)} · {e.venues?.name}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {e.checkin_enabled && <Power className="h-4 w-4 text-gold" />}
                <input
                  type="checkbox"
                  checked={!!e.checkin_enabled}
                  onChange={() => handleToggle(e)}
                  className="h-4 w-4 rounded border-input"
                />
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default OpenDoorTab;
