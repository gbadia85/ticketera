import React, { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { listReservations, listVenues, listAllEvents } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const STATUS_LABELS = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  approved: { label: 'Aprobada', variant: 'default' },
  rejected: { label: 'Rechazada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  expired: { label: 'Expirada', variant: 'secondary' },
};

const PAYMENT_METHOD_LABELS = {
  mercadopago: 'Mercado Pago',
  efectivo: 'Efectivo (puerta)',
  simulado: 'Simulado',
};

const ENTRY_LABELS = {
  pending: { label: 'No ingresó', variant: 'secondary' },
  inside: { label: 'Adentro', variant: 'default' },
  outside: { label: 'Salió', variant: 'outline' },
};

const ReservationsTab = () => {
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [eventId, setEventId] = useState('');
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listVenues(), listAllEvents()]).then(([v, e]) => {
      setVenues(v);
      setEvents(e);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    listReservations({ eventId: eventId || undefined, venueId: eventId ? undefined : venueId || undefined })
      .then(setReservations)
      .finally(() => setLoading(false));
  }, [venueId, eventId]);

  // Si elegís un evento puntual, el filtro de sala queda implícito en
  // ese evento (no tiene sentido combinarlos), así que lo reseteamos.
  const handleEventChange = (value) => {
    setEventId(value);
    if (value) setVenueId('');
  };

  const eventsForVenueFilter = useMemo(
    () => (venueId ? events.filter((e) => e.venue_id === venueId) : events),
    [events, venueId]
  );

  const totalAmount = reservations
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + Number(r.total_amount), 0);

  const filterLabel = eventId
    ? events.find((e) => e.id === eventId)?.title
    : venueId
      ? `Sala: ${venues.find((v) => v.id === venueId)?.name}`
      : 'Todas las reservas';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <div className="w-56">
          <Label>Filtrar por sala</Label>
          <select
            className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={venueId}
            onChange={(e) => {
              setVenueId(e.target.value);
              setEventId('');
            }}
          >
            <option value="">Todas las salas</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-64">
          <Label>Filtrar por evento</Label>
          <select
            className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={eventId}
            onChange={(e) => handleEventChange(e.target.value)}
          >
            <option value="">Todos los eventos{venueId ? ' de esta sala' : ''}</option>
            {eventsForVenueFilter.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
        >
          <Printer className="h-4 w-4" /> Imprimir planilla
        </button>
      </div>

      <div className="hidden print:block mb-4">
        <h2 className="font-display text-xl">Planilla de reservas — {filterLabel}</h2>
        <p className="text-sm text-muted-foreground">Impreso el {formatDateTime(new Date().toISOString())}</p>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Cargando reservas…</p>}
      {!loading && reservations.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay reservas para este filtro.</p>
      )}

      {!loading && reservations.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Comprador</th>
                <th className="p-3 font-medium">Evento</th>
                <th className="p-3 font-medium">Sala</th>
                <th className="p-3 font-medium">Butacas</th>
                <th className="p-3 font-medium">Pago</th>
                <th className="p-3 font-medium text-right">Total</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Ingreso</th>
                <th className="p-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="p-3">
                    <div className="font-medium">{r.first_name} {r.last_name}</div>
                    {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                  </td>
                  <td className="p-3">{r.events?.title}</td>
                  <td className="p-3">{r.events?.venues?.name}</td>
                  <td className="p-3">
                    {(r.reservation_seats ?? []).map((rs) => rs.event_seats?.seats?.label).filter(Boolean).join(', ')}
                  </td>
                  <td className="p-3">{PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(r.total_amount)}</td>
                  <td className="p-3">
                    <Badge variant={STATUS_LABELS[r.status]?.variant}>{STATUS_LABELS[r.status]?.label}</Badge>
                  </td>
                  <td className="p-3">
                    {r.status === 'approved' ? (
                      <Badge variant={ENTRY_LABELS[r.entry_status]?.variant}>{ENTRY_LABELS[r.entry_status]?.label}</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold bg-muted/30">
                <td className="p-3" colSpan={5}>
                  Total (reservas aprobadas)
                </td>
                <td className="p-3 text-right text-gold">{formatCurrency(totalAmount)}</td>
                <td className="p-3" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReservationsTab;
