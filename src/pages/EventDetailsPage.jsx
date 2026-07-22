import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CalendarDays, Copy, MapPin, MessageCircle, Minus, Plus, Theater, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SeatMap, { SeatMapLegend } from '@/components/SeatMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useEventSeats } from '@/hooks/useEventSeats';
import { getShow, isFuncionSalesClosed } from '@/lib/api';
import { holdSeats, holdNextAvailableSeats } from '@/lib/booking';
import { getSessionId } from '@/lib/session';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { siteConfig } from '@/site.config';

const EventDetailsPage = () => {
  const { eventId: showId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const sessionId = getSessionId();
  const t = siteConfig.texts.eventDetails;

  const [show, setShow] = useState(null);
  const [selectedFuncionId, setSelectedFuncionId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [quantity, setQuantity] = useState(1);
  const [holding, setHolding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    getShow(showId)
      .then((data) => {
        setShow(data);
        // Preseleccionamos la primera función que todavía se puede
        // comprar; si no queda ninguna, la primera de todas (para que
        // igual se vea el motivo: agotada o pasada).
        const firstAvailable = data.funciones.find((f) => !isFuncionSalesClosed(f) && !f.sold_out_status?.is_sold_out);
        setSelectedFuncionId((firstAvailable ?? data.funciones[0])?.id ?? null);
      })
      .catch(() => {});
  }, [showId]);

  const selectedFuncion = show?.funciones.find((f) => f.id === selectedFuncionId) ?? null;

  const { seats, loading, error } = useEventSeats(selectedFuncionId);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({ title: 'No pudimos copiar el link', description: 'Copialo a mano desde la barra de direcciones.', variant: 'destructive' });
    }
  };

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
  const isGeneralAdmission = !!show?.venues?.general_admission;
  const availableCount = normalizedSeats.filter((s) => s.status === 'available').length;
  const generalPrice = normalizedSeats[0]?.price ?? 0;
  const total = isGeneralAdmission ? quantity * generalPrice : selectedSeats.reduce((sum, s) => sum + Number(s.price), 0);

  const handleSelectFuncion = (funcionId) => {
    setSelectedFuncionId(funcionId);
    setSelectedIds(new Set());
    setQuantity(1);
  };

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

  const ERROR_MESSAGES = {
    seat_unavailable: 'Una o más butacas seleccionadas ya no están disponibles. Elegí otras.',
    sales_closed: 'La venta de entradas para esta función ya cerró.',
    not_enough_seats: 'No quedan tantos lugares disponibles — probá con menos cantidad.',
  };

  const handleReserve = async () => {
    const hasSelection = isGeneralAdmission ? quantity > 0 : selectedSeats.length > 0;
    if (!hasSelection) return;
    setHolding(true);
    try {
      if (isGeneralAdmission) {
        await holdNextAvailableSeats(selectedFuncion.id, quantity, sessionId);
      } else {
        await holdSeats(selectedFuncion.id, selectedSeats.map((s) => s.seatId), sessionId);
      }
      navigate(`/checkout/${selectedFuncion.id}`);
    } catch (err) {
      toast({
        title: err.message === 'seat_unavailable' ? 'Alguien se te adelantó' : 'No pudimos reservar',
        description: ERROR_MESSAGES[err.message] ?? err.message,
        variant: 'destructive',
      });
      if (err.message === 'seat_unavailable') setSelectedIds(new Set());
    } finally {
      setHolding(false);
    }
  };

  if (!show || !selectedFuncion) return null;

  const eventImages = show.event_images ?? [];
  const eventSponsors = show.event_sponsors ?? [];
  const mainImage = eventImages[activeImage]?.url ?? eventImages[0]?.url;
  const isSoldOut = !!selectedFuncion.sold_out_status?.is_sold_out;
  const salesClosed = isFuncionSalesClosed(selectedFuncion);
  const purchasingDisabled = isSoldOut || salesClosed;

  const otherAvailableFuncion = purchasingDisabled
    ? show.funciones.find((f) => f.id !== selectedFuncion.id && !isFuncionSalesClosed(f) && !f.sold_out_status?.is_sold_out)
    : null;

  return (
    <>
      <Helmet>
        <title>{show.title} — Butaca</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

      <div className="container py-8 flex-1">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 -ml-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver a la cartelera
        </Button>

        {/* Hero: info del show a la izquierda (o arriba, en mobile), imágenes a la derecha */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row gap-8 mb-8"
        >
          <div className="lg:w-2/5 lg:order-1 order-1">
            <h1 className="font-display text-3xl md:text-4xl mb-2">{show.title}</h1>
            {show.description && (
              <p className="text-muted-foreground text-sm mb-4 whitespace-pre-line">{show.description}</p>
            )}
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {show.venues?.name}
                {show.venues?.address ? ` — ${show.venues.address}` : ''}
              </span>
              <Link to={`/salas/${show.venues?.id}`} className="text-xs text-gold hover:underline w-fit">
                {t.salaSeeMore} →
              </Link>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${show.title} — ${formatDateTime(selectedFuncion.event_date)}\n${window.location.href}`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-gold/60 hover:text-foreground transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Compartir
              </a>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-gold/60 hover:text-foreground transition-colors"
              >
                <Copy className="h-3.5 w-3.5" /> {linkCopied ? 'Copiado ✓' : 'Copiar link'}
              </button>
            </div>
          </div>

          {eventImages.length > 0 && (
            <div className="lg:w-3/5 order-2">
              <div className="aspect-video rounded-lg overflow-hidden border border-border relative">
                <img src={mainImage} alt={show.title} className="w-full h-full object-cover" />
              </div>
              {eventImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto mt-2">
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
        </motion.div>

        {/* Selector de función */}
        {show.funciones.length > 1 && (
          <div className="mb-8">
            <p className="text-sm font-medium mb-2">Elegí la función:</p>
            <div className="flex flex-wrap gap-2">
              {show.funciones.map((f) => {
                const fPast = isFuncionSalesClosed(f);
                const fSoldOut = f.sold_out_status?.is_sold_out;
                const active = f.id === selectedFuncion.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFuncion(f.id)}
                    className={`text-sm px-4 py-2 rounded-full border transition-colors flex items-center gap-2 ${
                      active ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted-foreground hover:border-gold/40'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDateTime(f.event_date)}
                    {(fPast || fSoldOut) && (
                      <span className="text-[10px] uppercase font-bold text-destructive">
                        {fPast ? 'Pasada' : 'Agotada'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {myHeldSeats.length > 0 && (
                <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 p-4 flex items-center justify-between gap-4">
                  <p className="text-sm">
                    Ya tenés {myHeldSeats.length} butaca{myHeldSeats.length > 1 ? 's' : ''} reservada
                    {myHeldSeats.length > 1 ? 's' : ''} temporalmente.
                  </p>
                  <Button asChild size="sm">
                    <Link to={`/checkout/${selectedFuncion.id}`}>Continuar compra</Link>
                  </Button>
                </div>
              )}

              {purchasingDisabled && (
                <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-center gap-3 flex-wrap">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <p className="text-sm flex-1">
                    {salesClosed ? 'Esta función ya pasó.' : 'Esta función está agotada.'}
                    {otherAvailableFuncion && (
                      <>
                        {' '}
                        Probá con la función del{' '}
                        <button
                          onClick={() => handleSelectFuncion(otherAvailableFuncion.id)}
                          className="text-gold hover:underline font-medium"
                        >
                          {formatDateTime(otherAvailableFuncion.event_date)}
                        </button>
                        .
                      </>
                    )}
                  </p>
                </div>
              )}

              {isGeneralAdmission ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" /> Entrada general
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loading && <p className="text-muted-foreground text-sm">Cargando disponibilidad…</p>}
                    {!loading && !purchasingDisabled && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Esta sala no tiene butacas numeradas — elegí cuántas entradas querés. Quedan {availableCount}{' '}
                          disponibles.
                        </p>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:border-gold/60"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-2xl font-display w-10 text-center">{quantity}</span>
                          <button
                            onClick={() => setQuantity((q) => Math.min(availableCount || 1, q + 1))}
                            className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:border-gold/60"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <span className="text-sm text-muted-foreground ml-2">
                            {formatCurrency(generalPrice)} c/u
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t.chooseSeatsTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading && <p className="text-muted-foreground text-sm">Cargando mapa de la sala…</p>}
                    {error && <p className="text-destructive text-sm">No pudimos cargar el mapa de butacas.</p>}
                    {!loading && !error && (
                      <>
                        <SeatMap
                          seats={normalizedSeats}
                          selectedIds={selectedIds}
                          onToggle={purchasingDisabled ? () => {} : handleToggle}
                          readOnly={purchasingDisabled}
                        />
                        <div className="mt-6">
                          <SeatMapLegend zones={zonesInEvent} />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sticky top-24 space-y-6">
              {!purchasingDisabled && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t.yourSelectionTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isGeneralAdmission ? (
                      <div className="flex justify-between items-center text-sm">
                        <span>{quantity} entrada{quantity > 1 ? 's' : ''}</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                    {(isGeneralAdmission ? quantity > 0 : selectedSeats.length > 0) && (
                      <div className="border-t border-border pt-4 flex justify-between items-center font-semibold">
                        <span>Total</span>
                        <span className="text-gold">{formatCurrency(total)}</span>
                      </div>
                    )}
                    <Button
                      onClick={handleReserve}
                      disabled={(isGeneralAdmission ? quantity < 1 : selectedSeats.length === 0) || holding}
                      className="w-full"
                      size="lg"
                    >
                      {holding ? t.reservingButton : t.reserveButton}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">{t.holdNotice}</p>
                  </CardContent>
                </Card>
              )}

              {!isGeneralAdmission && zonesInEvent.length > 0 && (
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

              {(show.venues?.venue_images?.length > 0 || show.venues?.description) && (
                <Card>
                  <CardContent className="p-4 flex gap-3 items-start">
                    {show.venues?.venue_images?.[0]?.url ? (
                      <img
                        src={show.venues.venue_images[0].url}
                        alt={show.venues?.name}
                        className="h-14 w-14 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-md shrink-0 flex items-center justify-center bg-gradient-to-br from-accent to-muted">
                        <Theater className="h-6 w-6 text-gold" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{show.venues?.name}</p>
                      {show.venues?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{show.venues.description}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </div>

        {eventSponsors.length > 0 && (
          <div className="mt-14 pt-8 border-t border-border/60 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
              {show.sponsors_label || 'Sponsors'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {eventSponsors.map((sponsor) => (
                <img
                  key={sponsor.id}
                  src={sponsor.url}
                  alt={show.sponsors_label || 'Sponsor'}
                  className="h-12 md:h-16 object-contain opacity-90 hover:opacity-100 transition-opacity"
                />
              ))}
            </div>
          </div>
        )}
      </div>

        <Footer />
      </div>
    </>
  );
};

export default EventDetailsPage;
