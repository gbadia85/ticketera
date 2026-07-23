import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, LogIn, RotateCcw, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventSeats } from '@/hooks/useEventSeats';
import { useEventCheckins } from '@/hooks/useEventCheckins';
import SeatMap, { SeatMapLegend } from '@/components/SeatMap';
import { listAllFunciones } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

const LiveEntryBoard = () => {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');

  useEffect(() => {
    listAllFunciones().then((data) => setEvents(data.filter((e) => e.status === 'scheduled')));
  }, []);

  const { seats } = useEventSeats(eventId || null);
  const { reservations, reload: reloadCheckins } = useEventCheckins(eventId || null);

  const normalizedSeats = useMemo(
    () =>
      seats.map((es) => ({
        seatId: es.seat_id,
        row: es.seats?.pos_row ?? 0,
        col: es.seats?.pos_col ?? 0,
        rowLabel: es.seats?.row_label,
        seatNumber: es.seats?.seat_number,
        label: es.seats?.label,
        isActive: es.seats?.is_active,
        status: es.status,
        price: es.price,
        zoneName: es.seat_zones?.name,
        zoneColor: es.seat_zones?.color,
        heldByMe: false,
      })),
    [seats]
  );

  const zonesInEvent = useMemo(() => {
    const map = new Map();
    for (const s of normalizedSeats) {
      if (s.zoneName && !map.has(s.zoneName)) map.set(s.zoneName, { name: s.zoneName, color: s.zoneColor, price: s.price });
    }
    return Array.from(map.values()).sort((a, b) => a.price - b.price);
  }, [normalizedSeats]);

  const soldCount = normalizedSeats.filter((s) => s.status === 'sold').length;
  const insideCount = reservations.filter((r) => r.entry_status === 'inside').length;
  const everEnteredCount = reservations.filter((r) => r.entry_status === 'inside' || r.entry_status === 'outside').length;
  const ticketsCount = reservations.reduce((sum, r) => sum + (r.seatLabels?.length || 0), 0);

  const recentCheckins = reservations
    .filter((r) => r.checked_in_at)
    .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at));

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <Label>Evento</Label>
        <select
          className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="">Elegí un evento…</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.shows?.title} — {formatDateTime(e.event_date)}
            </option>
          ))}
        </select>
      </div>

      {!eventId && <p className="text-sm text-muted-foreground">Elegí un evento para ver la pantalla en vivo.</p>}

      {eventId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-8 w-8 text-gold" />
                <div>
                  <p className="text-2xl font-display">{soldCount}</p>
                  <p className="text-xs text-muted-foreground">butacas vendidas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <LogIn className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-display">
                    {insideCount} <span className="text-sm text-muted-foreground font-sans">/ {reservations.length}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">adentro ahora ({everEnteredCount} entraron en total)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-gold" />
                <div>
                  <p className="text-2xl font-display">{ticketsCount}</p>
                  <p className="text-xs text-muted-foreground">butacas en entradas vendidas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mapa de la sala</CardTitle>
                </CardHeader>
                <CardContent>
                  <SeatMap seats={normalizedSeats} readOnly />
                  <div className="mt-6">
                    <SeatMapLegend zones={zonesInEvent} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Últimos ingresos
                    </span>
                    <button
                      onClick={reloadCheckins}
                      className="text-muted-foreground hover:text-gold p-1"
                      title="Actualizar"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[32rem] overflow-y-auto">
                  {recentCheckins.length === 0 && (
                    <p className="text-sm text-muted-foreground">Todavía no ingresó nadie.</p>
                  )}
                  {recentCheckins.map((r) => (
                    <div key={r.id} className="flex items-start justify-between text-sm border-b border-border/60 pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{r.first_name} {r.last_name}</p>
                        <p className="text-xs text-muted-foreground">{r.seatLabels?.join(', ')}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs ${r.entry_status === 'inside' ? 'text-success' : 'text-muted-foreground'}`}>
                          {r.entry_status === 'inside' ? 'Adentro' : 'Salió'}
                        </span>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(r.checked_in_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveEntryBoard;
