import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, MapPin, Theater } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SeatMap, { SeatMapLegend } from '@/components/SeatMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useEventSeats } from '@/hooks/useEventSeats';
import { getEvent } from '@/lib/api';
import { holdSeats } from '@/lib/booking';
import { getSessionId } from '@/lib/session';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { siteConfig } from '@/site.config';

const EventDetailsPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const sessionId = getSessionId();
  const t = siteConfig.texts.eventDetails;

  const [event, setEvent] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [holding, setHolding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const { seats, loading, error } = useEventSeats(eventId);

  useEffect(() => {
    getEvent(eventId).then(setEvent).catch(() => {});
  }, [eventId]);

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
        heldByMe: es.held_by === sessionId,
      })),
    [seats, sessionId]
  );

  const myHeldSeats = normalizedSeats.filter((s) => s.status === 'held' && s.heldByMe);

  const zonesInEvent = useMemo(() => {
    const map = new Map();
    for (const s of normalizedSeats) {
      if (s.zoneName && !map.has(s.zoneName)) {
        map.set(s.zoneName, { name: s.zoneName, color: s.zoneColor, price: s.price });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.price - b.price);
  }, [normalizedSeats]);

  const selectedSeats = normalizedSeats.filter((s) => selectedIds.has(s.seatId));
  const total = selectedSeats.reduce((sum, s) => sum + Number(s.price), 0);

  const handleToggle = (seat) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.seatId)) {
        next.delete(seat.seatId);
      } else {
        next.add(seat.seatId);
      }
      return next;
    });
  };

  const handleReserve = async () => {
    if (selectedSeats.length === 0) return;
    setHolding(true);
    try {
      await holdSeats(eventId, selectedSeats.map((s) => s.seatId), sessionId);
      navigate(`/checkout/${eventId}`);
    } catch (err) {
      if (err.message === 'seat_unavailable') {
        toast({
          title: 'Alguien se te adelantó',
          description: 'Una o más butacas seleccionadas ya no están disponibles. Elegí otras.',
          variant: 'destructive',
        });
        setSelectedIds(new Set());
      } else {
        toast({ title: 'No pudimos reservar las butacas', description: err.message, variant: 'destructive' });
      }
    } finally {
      setHolding(false);
    }
  };

  if (!event) return null;

  const eventImages = event.event_images ?? [];
  const venueImages = event.venues?.venue_images ?? [];
  const showGalleryRow = eventImages.length > 0 || venueImages.length > 0 || event.venues?.description;
  const mainImage = eventImages[activeImage]?.url ?? eventImages[0]?.url;

  return (
    <>
      <Helmet>
        <title>{event.title} — Butaca</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

      <div className="container py-8 flex-1">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 -ml-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver a la cartelera
        </Button>

        {showGalleryRow && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {eventImages.length > 0 && (
              <div className="space-y-2">
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <img src={mainImage} alt={event.title} className="w-full h-full object-cover" />
                </div>
                {eventImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {eventImages.map((img, i) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImage(i)}
                        className={`h-14 w-20 shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                          i === activeImage ? 'border-gold' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(venueImages.length > 0 || event.venues?.description) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{siteConfig.texts.eventDetails.salaSectionTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {venueImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {venueImages.slice(0, 3).map((img) => (
                        <div key={img.id} className="aspect-square rounded-md overflow-hidden">
                          <img src={img.url} alt={event.venues?.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video rounded-md flex items-center justify-center bg-gradient-to-br from-accent to-muted">
                      <Theater className="h-8 w-8 text-gold" />
                    </div>
                  )}
                  {event.venues?.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{event.venues.description}</p>
                  )}
                  <Link
                    to={`/salas/${event.venues?.id}`}
                    className="text-sm text-gold hover:underline inline-block"
                  >
                    {siteConfig.texts.eventDetails.salaSeeMore} →
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-3xl md:text-4xl mb-2">{event.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> {formatDateTime(event.event_date)}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {event.venues?.name}
                </span>
              </div>

              {myHeldSeats.length > 0 && (
                <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 p-4 flex items-center justify-between gap-4">
                  <p className="text-sm">
                    Ya tenés {myHeldSeats.length} butaca{myHeldSeats.length > 1 ? 's' : ''} reservada
                    {myHeldSeats.length > 1 ? 's' : ''} temporalmente.
                  </p>
                  <Button asChild size="sm">
                    <Link to={`/checkout/${eventId}`}>Continuar compra</Link>
                  </Button>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t.chooseSeatsTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading && <p className="text-muted-foreground text-sm">Cargando mapa de la sala…</p>}
                  {error && <p className="text-destructive text-sm">No pudimos cargar el mapa de butacas.</p>}
                  {!loading && !error && (
                    <>
                      <SeatMap seats={normalizedSeats} selectedIds={selectedIds} onToggle={handleToggle} />
                      <div className="mt-6">
                        <SeatMapLegend zones={zonesInEvent} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sticky top-24 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t.yourSelectionTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedSeats.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t.emptySelection}</p>
                  )}
                  {selectedSeats.map((seat) => (
                    <div key={seat.seatId} className="flex justify-between items-center text-sm">
                      <span>
                        {seat.label}
                        {seat.zoneName && <span className="ml-2 text-xs text-gold">{seat.zoneName}</span>}
                      </span>
                      <span>{formatCurrency(seat.price)}</span>
                    </div>
                  ))}
                  {selectedSeats.length > 0 && (
                    <div className="border-t border-border pt-4 flex justify-between items-center font-semibold">
                      <span>Total</span>
                      <span className="text-gold">{formatCurrency(total)}</span>
                    </div>
                  )}
                  <Button
                    onClick={handleReserve}
                    disabled={selectedSeats.length === 0 || holding}
                    className="w-full"
                    size="lg"
                  >
                    {holding ? t.reservingButton : t.reserveButton}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t.holdNotice}
                  </p>
                </CardContent>
              </Card>

              {zonesInEvent.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t.priceReferenceTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {zonesInEvent.map((zone) => (
                      <div key={zone.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm inline-block" style={{ backgroundColor: zone.color }} />
                          {zone.name}
                        </span>
                        <span className="text-muted-foreground">{formatCurrency(zone.price)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>

        <Footer />
      </div>
    </>
  );
};

export default EventDetailsPage;
