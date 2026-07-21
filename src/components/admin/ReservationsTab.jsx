import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { listReservations } from '@/lib/api';
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

const ReservationsTab = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listReservations()
      .then(setReservations)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {loading && <p className="text-muted-foreground text-sm">Cargando reservas…</p>}
      {!loading && reservations.length === 0 && (
        <p className="text-muted-foreground text-sm">Todavía no hay reservas.</p>
      )}
      {reservations.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {r.first_name} {r.last_name}
                </span>
                <Badge variant={STATUS_LABELS[r.status]?.variant}>{STATUS_LABELS[r.status]?.label}</Badge>
                {r.payment_method && (
                  <Badge variant="outline">{PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method}</Badge>
                )}
                {r.status === 'approved' && (
                  <Badge variant={r.checked_in_at ? 'default' : 'secondary'}>
                    {r.checked_in_at ? 'Ingresó' : 'No ingresó'}
                  </Badge>
                )}
              </div>
              {r.email && <p className="text-sm text-muted-foreground">{r.email}</p>}
              <p className="text-sm text-muted-foreground">{r.events?.title}</p>
              <p className="text-xs text-muted-foreground">
                {(r.reservation_seats ?? []).map((rs) => rs.event_seats?.seats?.label).filter(Boolean).join(', ')}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
            </div>
            <div className="text-xl font-semibold text-gold">{formatCurrency(r.total_amount)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ReservationsTab;
