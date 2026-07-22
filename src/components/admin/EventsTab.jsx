import React, { useEffect, useState } from 'react';
import { CalendarDays, Image, Briefcase, MapPin, Pencil, Plus, Rocket, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import ImageManager from '@/components/admin/ImageManager';
import {
  addEventImage,
  addEventSponsor,
  createEvent,
  deleteEvent,
  deleteEventImage,
  deleteEventSponsor,
  ensureGeneralAdmissionSeats,
  getEventZonePrices,
  listAllEvents,
  listEventImages,
  listEventSponsors,
  listVenues,
  listZones,
  publishEvent,
  reorderEventImage,
  reorderEventSponsor,
  setEventZonePrices,
  updateEvent,
} from '@/lib/api';

const MAX_EVENT_IMAGES = 5;

// Convierte un timestamp ISO (UTC) al formato que necesita un input
// datetime-local (hora local del navegador, sin zona horaria).
const toDatetimeLocalValue = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_LABELS = {
  draft: { label: 'Borrador', variant: 'secondary' },
  scheduled: { label: 'Publicado', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  completed: { label: 'Finalizado', variant: 'secondary' },
};

const friendlyEventError = (err) => {
  if (err.message?.includes('venue_datetime_conflict')) {
    return 'Esa sala ya tiene otro evento programado exactamente en esa misma fecha y hora.';
  }
  return err.message;
};

const EventsTab = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', venue_id: '', event_date: '', sponsors_label: '' });
  const [pricingEventId, setPricingEventId] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [imagesEvent, setImagesEvent] = useState(null);
  const [sponsorsEvent, setSponsorsEvent] = useState(null);

  const reload = () => {
    setLoading(true);
    Promise.all([listAllEvents(), listVenues()])
      .then(([e, v]) => {
        setEvents(e);
        setVenues(v);
      })
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const event = await createEvent({
        title: form.title,
        description: form.description || null,
        venue_id: form.venue_id,
        event_date: new Date(form.event_date).toISOString(),
        sponsors_label: form.sponsors_label || null,
        status: 'draft',
      });
      setDialogOpen(false);
      setForm({ title: '', description: '', venue_id: '', event_date: '', sponsors_label: '' });
      reload();
      setPricingEventId(event.id);
    } catch (err) {
      toast({ title: 'No pudimos crear el evento', description: friendlyEventError(err), variant: 'destructive' });
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar este evento? Ya no será visible al público.')) return;
    await updateEvent(id, { status: 'cancelled' });
    reload();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este borrador de evento?')) return;
    try {
      await deleteEvent(id);
      reload();
    } catch (err) {
      toast({ title: 'No pudimos eliminar el evento', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-muted-foreground text-sm">Creá funciones, asignales una sala y publicalas para venderlas.</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Nuevo evento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Título de la obra / evento</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sala</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.venue_id}
                  onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    Elegir sala…
                  </option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora</Label>
                <Input
                  type="datetime-local"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Etiqueta de sponsors (opcional)</Label>
                <Input
                  value={form.sponsors_label}
                  onChange={(e) => setForm({ ...form, sponsors_label: e.target.value })}
                  placeholder='Ej: "Sponsors", "Auspiciantes", "Con el apoyo de"'
                />
                <p className="text-xs text-muted-foreground">
                  Las imágenes de sponsors se cargan después de crear el evento, desde su fila en la lista.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit">Crear evento</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Cargando eventos…</p>}

      <div className="space-y-4">
        {events.map((event) => (
          <Card key={event.id}>
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg">{event.title}</h3>
                  <Badge variant={STATUS_LABELS[event.status]?.variant}>{STATUS_LABELS[event.status]?.label}</Badge>
                  {event.sold_out_status?.is_sold_out && <Badge variant="destructive">Agotado</Badge>}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDateTime(event.event_date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {event.venues?.name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setImagesEvent(event)} className="text-muted-foreground hover:text-gold p-2" title="Imágenes">
                  <Image className="h-4 w-4" />
                </button>
                <button onClick={() => setSponsorsEvent(event)} className="text-muted-foreground hover:text-gold p-2" title="Sponsors">
                  <Briefcase className="h-4 w-4" />
                </button>
                <button onClick={() => setEditingEvent(event)} className="text-muted-foreground hover:text-gold p-2" title="Editar">
                  <Pencil className="h-4 w-4" />
                </button>
                {event.status === 'draft' && (
                  <>
                    <Button size="sm" onClick={() => setPricingEventId(event.id)}>
                      <Rocket className="h-4 w-4 mr-2" /> Configurar precios y publicar
                    </Button>
                    <button onClick={() => handleDelete(event.id)} className="text-muted-foreground hover:text-destructive p-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                {event.status === 'scheduled' && (
                  <Button size="sm" variant="outline" onClick={() => handleCancel(event.id)}>
                    <XCircle className="h-4 w-4 mr-2" /> Cancelar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pricingEventId && (
        <EventPricingDialog
          eventId={pricingEventId}
          onClose={() => {
            setPricingEventId(null);
            reload();
          }}
        />
      )}

      {editingEvent && (
        <EditEventDialog
          event={editingEvent}
          venues={venues}
          onClose={() => setEditingEvent(null)}
          onSaved={() => {
            setEditingEvent(null);
            reload();
          }}
        />
      )}

      {imagesEvent && <EventImagesDialog event={imagesEvent} onClose={() => setImagesEvent(null)} />}
      {sponsorsEvent && <EventSponsorsDialog event={sponsorsEvent} onClose={() => setSponsorsEvent(null)} />}
    </div>
  );
};

const EventImagesDialog = ({ event, onClose }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    listEventImages(event.id)
      .then(setImages)
      .finally(() => setLoading(false));
  };

  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (file) => {
    const nextSortOrder = images.length > 0 ? Math.max(...images.map((i) => i.sort_order)) + 1 : 0;
    const created = await addEventImage(event.id, file, nextSortOrder);
    setImages([...images, created]);
  };

  const handleDelete = async (image) => {
    await deleteEventImage(image);
    setImages(images.filter((i) => i.id !== image.id));
  };

  const handleReorder = async (imageA, imageB) => {
    await reorderEventImage(imageA, imageB);
    setImages(
      images
        .map((i) => {
          if (i.id === imageA.id) return { ...i, sort_order: imageB.sort_order };
          if (i.id === imageB.id) return { ...i, sort_order: imageA.sort_order };
          return i;
        })
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Imágenes de "{event.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          La primera imagen es la que se muestra como portada en la cartelera. Si no subís ninguna, se muestra el
          ícono por defecto.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando imágenes…</p>
        ) : (
          <ImageManager
            images={images}
            maxImages={MAX_EVENT_IMAGES}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MAX_EVENT_SPONSORS = 5;

const EventSponsorsDialog = ({ event, onClose }) => {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    listEventSponsors(event.id)
      .then(setSponsors)
      .finally(() => setLoading(false));
  };

  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (file) => {
    const nextSortOrder = sponsors.length > 0 ? Math.max(...sponsors.map((s) => s.sort_order)) + 1 : 0;
    const created = await addEventSponsor(event.id, file, nextSortOrder);
    setSponsors([...sponsors, created]);
  };

  const handleDelete = async (sponsor) => {
    await deleteEventSponsor(sponsor);
    setSponsors(sponsors.filter((s) => s.id !== sponsor.id));
  };

  const handleReorder = async (a, b) => {
    await reorderEventSponsor(a, b);
    setSponsors(
      sponsors
        .map((s) => {
          if (s.id === a.id) return { ...s, sort_order: b.sort_order };
          if (s.id === b.id) return { ...s, sort_order: a.sort_order };
          return s;
        })
        .sort((x, y) => x.sort_order - y.sort_order)
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sponsors de "{event.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Se muestran en una sección aparte al entrar al evento, bajo la etiqueta "
          {event.sponsors_label || 'Sponsors'}" (editable desde "Editar evento").
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <ImageManager
            images={sponsors}
            maxImages={MAX_EVENT_SPONSORS}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onReorder={handleReorder}
            coverLabel="Primero"
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EventPricingDialog = ({ eventId, onClose }) => {
  const { toast } = useToast();
  const [venue, setVenue] = useState(null);
  const [zones, setZones] = useState([]);
  const [prices, setPrices] = useState({});
  const [generalPrice, setGeneralPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    (async () => {
      const [allEvents, allVenues] = await Promise.all([listAllEvents(), listVenues()]);
      const current = allEvents.find((e) => e.id === eventId);
      if (!current) return;
      const currentVenue = allVenues.find((v) => v.id === current.venue_id);
      setVenue(currentVenue);

      if (!currentVenue?.general_admission) {
        const [zonesData, overrides] = await Promise.all([listZones(current.venue_id), getEventZonePrices(eventId)]);
        setZones(zonesData);
        const priceMap = {};
        zonesData.forEach((z) => {
          const override = overrides.find((o) => o.zone_id === z.id);
          priceMap[z.id] = override ? override.price : z.default_price;
        });
        setPrices(priceMap);
      }
      setLoading(false);
    })();
  }, [eventId]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      if (venue?.general_admission) {
        await ensureGeneralAdmissionSeats(venue.id, Number(generalPrice) || 0);
      } else {
        await setEventZonePrices(
          eventId,
          Object.entries(prices).map(([zone_id, price]) => ({ zone_id, price: Number(price) }))
        );
      }
      await publishEvent(eventId);
      toast({ title: 'Evento publicado', description: 'Ya está visible en la cartelera.' });
      onClose();
    } catch (err) {
      toast({ title: 'No pudimos publicar el evento', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = venue?.general_admission ? Number(generalPrice) >= 0 && generalPrice !== '' : zones.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{venue?.general_admission ? 'Precio de entrada general' : 'Precios por zona'}</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Cargando datos de la sala…</p>}

        {!loading && venue?.general_admission && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta sala es de entrada general (sin mapa de butacas). Se vende por cantidad, hasta la capacidad de la
              sala ({venue.capacity ?? 0} lugares).
            </p>
            <div className="space-y-2">
              <Label>Precio de la entrada</Label>
              <Input type="number" min="0" value={generalPrice} onChange={(e) => setGeneralPrice(e.target.value)} />
            </div>
          </div>
        )}

        {!loading && venue && !venue.general_admission && zones.length === 0 && (
          <p className="text-sm text-destructive">Esta sala no tiene zonas ni butacas configuradas todavía.</p>
        )}
        {!loading && venue && !venue.general_admission && zones.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Podés dejar el precio por defecto de cada zona o ajustarlo especialmente para esta función.
            </p>
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: zone.color }} />
                <span className="flex-1 text-sm">{zone.name}</span>
                <Input
                  type="number"
                  className="w-32"
                  value={prices[zone.id] ?? ''}
                  onChange={(e) => setPrices({ ...prices, [zone.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={handlePublish} disabled={loading || publishing || !canPublish}>
            {publishing ? 'Publicando…' : 'Publicar evento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditEventDialog = ({ event, venues, onClose, onSaved }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: event.title,
    description: event.description ?? '',
    venue_id: event.venue_id,
    event_date: toDatetimeLocalValue(event.event_date),
    manually_sold_out: event.manually_sold_out ?? false,
    sponsors_label: event.sponsors_label ?? '',
  });
  const [saving, setSaving] = useState(false);

  const canChangeVenue = event.status === 'draft';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const patch = {
        title: form.title,
        description: form.description || null,
        event_date: new Date(form.event_date).toISOString(),
        manually_sold_out: form.manually_sold_out,
        sponsors_label: form.sponsors_label || null,
      };
      if (canChangeVenue) patch.venue_id = form.venue_id;
      await updateEvent(event.id, patch);
      toast({ title: 'Evento actualizado' });
      onSaved();
    } catch (err) {
      toast({ title: 'No pudimos guardar los cambios', description: friendlyEventError(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título de la obra / evento</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Sala</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={form.venue_id}
              onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
              disabled={!canChangeVenue}
              required
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {!canChangeVenue && (
              <p className="text-xs text-muted-foreground">
                Este evento ya está publicado, así que su mapa de butacas ya se generó a partir de esta sala. Para
                cambiarlo de sala, creá un evento nuevo.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Fecha y hora</Label>
            <Input
              type="datetime-local"
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              La venta de entradas se corta automáticamente 30 minutos después de esta hora.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.manually_sold_out}
              onChange={(e) => setForm({ ...form, manually_sold_out: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Marcar como agotado manualmente
          </label>
          <div className="space-y-2">
            <Label>Etiqueta de sponsors (opcional)</Label>
            <Input
              value={form.sponsors_label}
              onChange={(e) => setForm({ ...form, sponsors_label: e.target.value })}
              placeholder='Ej: "Sponsors", "Auspiciantes"'
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventsTab;
