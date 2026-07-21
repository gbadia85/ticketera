import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, DollarSign, Lock, Plus, Printer, Ticket, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useEventSeats } from '@/hooks/useEventSeats';
import SeatMap, { SeatMapLegend } from '@/components/SeatMap';
import {
  closeCashShift,
  getOpenCashShift,
  listAllEvents,
  listCashShiftSales,
  openCashShift,
} from '@/lib/api';
import { createDoorSale } from '@/lib/booking';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const DoorSalesTab = () => {
  const { toast } = useToast();
  const { session } = useAdminAuth();
  const adminEmail = session?.user?.email ?? 'admin';

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [shift, setShift] = useState(undefined); // undefined = cargando, null = no hay caja abierta
  const [sales, setSales] = useState([]);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [buyer, setBuyer] = useState({ firstName: '', lastName: '', dni: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null); // { seat_labels, total, qr_base64, ... }

  const [openingAmount, setOpeningAmount] = useState('0');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [countedAmount, setCountedAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closingResult, setClosingResult] = useState(null);

  const { seats } = useEventSeats(eventId || null);

  useEffect(() => {
    listAllEvents().then((data) => setEvents(data.filter((e) => e.status === 'scheduled')));
  }, []);

  const reloadShift = async (id) => {
    setShift(undefined);
    const openShift = await getOpenCashShift(id);
    setShift(openShift ?? null);
    if (openShift) {
      setSales(await listCashShiftSales(openShift.id));
    } else {
      setSales([]);
    }
  };

  useEffect(() => {
    if (!eventId) return;
    setSelectedIds(new Set());
    setLastSale(null);
    reloadShift(eventId);
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizedSeats = useMemo(
    () =>
      seats.map((es) => ({
        seatId: es.seat_id,
        eventSeatId: es.id,
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

  const selectedSeats = normalizedSeats.filter((s) => selectedIds.has(s.seatId));
  const total = selectedSeats.reduce((sum, s) => sum + Number(s.price), 0);

  const handleToggle = (seat) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.seatId)) next.delete(seat.seatId);
      else next.add(seat.seatId);
      return next;
    });
  };

  const handleOpenShift = async () => {
    try {
      const created = await openCashShift(eventId, Number(openingAmount) || 0, adminEmail);
      setShift(created);
      toast({ title: 'Caja abierta' });
    } catch (err) {
      toast({ title: 'No pudimos abrir la caja', description: err.message, variant: 'destructive' });
    }
  };

  const salesTotal = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const expectedInDrawer = Number(shift?.opening_amount ?? 0) + salesTotal;

  const handleCloseShift = async () => {
    try {
      const result = await closeCashShift(shift.id, Number(countedAmount) || 0, adminEmail, closeNotes || null);
      setClosingResult(result);
      setShift(null);
      setSales([]);
    } catch (err) {
      toast({ title: 'No pudimos cerrar la caja', description: err.message, variant: 'destructive' });
    }
  };

  const handleRegisterSale = async () => {
    if (!buyer.firstName || !buyer.lastName || selectedSeats.length === 0) {
      toast({ title: 'Faltan datos', description: 'Elegí butacas y completá nombre y apellido.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await createDoorSale({
        eventId,
        seatIds: selectedSeats.map((s) => s.seatId),
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        dni: buyer.dni || null,
        phone: buyer.phone || null,
        cashShiftId: shift.id,
      });
      setLastSale(result);
      setSelectedIds(new Set());
      setBuyer({ firstName: '', lastName: '', dni: '', phone: '' });
      setSales(await listCashShiftSales(shift.id));
    } catch (err) {
      const messages = {
        seat_unavailable: 'Una o más butacas elegidas ya no están disponibles.',
        shift_not_open: 'La caja se cerró — abrila de nuevo para seguir vendiendo.',
      };
      toast({
        title: 'No pudimos registrar la venta',
        description: messages[err.message] ?? err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

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
              {e.title} — {formatDateTime(e.event_date)}
            </option>
          ))}
        </select>
      </div>

      {!eventId && <p className="text-sm text-muted-foreground">Elegí un evento para empezar a vender en puerta.</p>}

      {eventId && shift === undefined && <p className="text-sm text-muted-foreground">Cargando caja…</p>}

      {eventId && shift === null && (
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5" /> Caja cerrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para vender en puerta primero abrí la caja de este evento con el monto inicial (para dar vuelto).
            </p>
            <div className="space-y-2">
              <Label>Monto inicial</Label>
              <Input type="number" min="0" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
            </div>
            <Button onClick={handleOpenShift} className="w-full">
              <Unlock className="h-4 w-4 mr-2" /> Abrir caja
            </Button>
          </CardContent>
        </Card>
      )}

      {eventId && shift && (
        <>
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-gold" />
                <span className="text-muted-foreground">Caja abierta por {shift.opened_by} —</span>
                <span className="font-semibold">{formatCurrency(expectedInDrawer)}</span>
                <span className="text-muted-foreground">
                  en cajón ({formatCurrency(shift.opening_amount)} inicial + {sales.length} venta{sales.length === 1 ? '' : 's'})
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCloseDialogOpen(true)}>
                <Lock className="h-4 w-4 mr-2" /> Cerrar caja
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Elegí las butacas</CardTitle>
                </CardHeader>
                <CardContent>
                  <SeatMap seats={normalizedSeats} selectedIds={selectedIds} onToggle={handleToggle} />
                  <div className="mt-6">
                    <SeatMapLegend zones={zonesInEvent} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ticket className="h-4 w-4" /> Datos del comprador
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Nombre" value={buyer.firstName} onChange={(e) => setBuyer({ ...buyer, firstName: e.target.value })} />
                    <Input placeholder="Apellido" value={buyer.lastName} onChange={(e) => setBuyer({ ...buyer, lastName: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="DNI (opcional)" value={buyer.dni} onChange={(e) => setBuyer({ ...buyer, dni: e.target.value })} />
                    <Input placeholder="Teléfono (opcional)" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} />
                  </div>

                  <div className="border-t border-border pt-3 space-y-1 text-sm">
                    {selectedSeats.length === 0 && <p className="text-muted-foreground">Ninguna butaca seleccionada.</p>}
                    {selectedSeats.map((s) => (
                      <div key={s.seatId} className="flex justify-between">
                        <span>{s.label}</span>
                        <span>{formatCurrency(s.price)}</span>
                      </div>
                    ))}
                    {selectedSeats.length > 0 && (
                      <div className="flex justify-between font-semibold pt-1">
                        <span>Total (efectivo)</span>
                        <span className="text-gold">{formatCurrency(total)}</span>
                      </div>
                    )}
                  </div>

                  <Button onClick={handleRegisterSale} disabled={submitting} className="w-full">
                    {submitting ? 'Registrando…' : 'Registrar venta'}
                  </Button>
                </CardContent>
              </Card>

              {sales.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Ventas de esta caja</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-56 overflow-y-auto">
                    {sales.map((s) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span>{s.first_name} {s.last_name}</span>
                        <span>{formatCurrency(s.total_amount)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* QR de la última venta registrada */}
      <Dialog open={!!lastSale} onOpenChange={(open) => !open && setLastSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Venta registrada
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="text-center space-y-3">
              <img
                src={`data:image/png;base64,${lastSale.qr_base64}`}
                alt="QR de la entrada"
                className="mx-auto rounded-lg border border-border w-56 h-56"
              />
              <p className="text-sm text-muted-foreground">
                Butacas: <span className="text-foreground">{lastSale.seat_labels?.join(', ')}</span>
              </p>
              <p className="font-semibold text-gold">{formatCurrency(lastSale.total)}</p>
              <p className="text-xs text-muted-foreground">Mostrale este QR a la persona para que ingrese con él.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>
            <Button onClick={() => setLastSale(null)}>
              <Plus className="h-4 w-4 mr-2" /> Nueva venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cierre de caja con arqueo */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Lo esperado en el cajón es <span className="text-foreground font-semibold">{formatCurrency(expectedInDrawer)}</span> (inicial +
              ventas en efectivo). Contá el efectivo real y anotá cuánto hay.
            </p>
            <div className="space-y-2">
              <Label>Monto contado</Label>
              <Input type="number" min="0" value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea rows={2} value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                await handleCloseShift();
                setCloseDialogOpen(false);
              }}
            >
              Confirmar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultado del arqueo, después de cerrar */}
      <Dialog open={!!closingResult} onOpenChange={(open) => !open && setClosingResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Caja cerrada</DialogTitle>
          </DialogHeader>
          {closingResult && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Esperado</span><span>{formatCurrency(closingResult.expected_amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Contado</span><span>{formatCurrency(closingResult.counted_amount)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span>{Number(closingResult.difference) === 0 ? 'Diferencia' : Number(closingResult.difference) > 0 ? 'Sobrante' : 'Faltante'}</span>
                <span className={Number(closingResult.difference) === 0 ? '' : Number(closingResult.difference) > 0 ? 'text-success' : 'text-destructive'}>
                  {formatCurrency(closingResult.difference)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setClosingResult(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoorSalesTab;
