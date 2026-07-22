import React, { useEffect, useState } from 'react';
import { CalendarDays, Image, Briefcase, MapPin, Pencil, Plus, Power, Rocket, Trash2, XCircle } from 'lucide-react';
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
  addShowImage,
  addShowSponsor,
  createFuncion,
  createShow,
  deleteFuncion,
  deleteShowImage,
  deleteShowSponsor,
  ensureGeneralAdmissionSeats,
  getEventZonePrices,
  listShowImages,
  listShows,
  listShowSponsors,
  listVenues,
  listZones,
  publishEvent,
  reorderShowImage,
  reorderShowSponsor,
  setEventZonePrices,
  updateFuncion,
  updateShow,
} from '@/lib/api';

const MAX_SHOW_IMAGES = 5;
const MAX_SHOW_SPONSORS = 5;

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
    return 'Esa sala ya tiene otra función programada exactamente en esa misma fecha y hora.';
  }
  return err.message;
};

const EventsTab = () => {
  const { toast } = useToast();
  const [shows, setShows] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', venue_id: '', event_date: '', sponsors_label: '' });

  const [pricingFuncion, setPricingFuncion] = useState(null); // { funcion, show }
  const [editingFuncion, setEditingFuncion] = useState(null);
  const [addingFuncionTo, setAddingFuncionTo] = useState(null); // show
  const [editingShow, setEditingShow] = useState(null);
  const [imagesShow, setImagesShow] = useState(null);
  const [sponsorsShow, setSponsorsShow] = useState(null);

  const reload = () => {
    setLoading(true);
    Promise.all([listShows(), listVenues()])
      .then(([s, v]) => {
        setShows(s);
        setVenues(v);
      })
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const show = await createShow({
        title: form.title,
        description: form.description || null,
        venue_id: form.venue_id,
        sponsors_label: form.sponsors_label || null,
      });
      const funcion = await createFuncion({
        showId: show.id,
        venueId: form.venue_id,
        eventDate: new Date(form.event_date).toISOString(),
      });
      setDialogOpen(false);
      setForm({ title: '', description: '', venue_id: '', event_date: '', sponsors_label: '' });
      reload();
      setPricingFuncion({ funcion, show });
    } catch (err) {
      toast({ title: 'No pudimos crear el evento', description: friendlyEventError(err), variant: 'destructive' });
    }
  };

  const handleCancelFuncion = async (id) => {
    if (!confirm('¿Cancelar esta función? Ya no será visible al público.')) return;
    await updateFuncion(id, { status: 'cancelled' });
    reload();
  };

  const handleDeleteFuncion = async (id) => {
    if (!confirm('¿Eliminar esta función?')) return;
    try {
      await deleteFuncion(id);
      reload();
    } catch (err) {
      toast({ title: 'No pudimos eliminar la función', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-muted-foreground text-sm">
          Creá un evento con su primera función, después podés agregarle más funciones (otros días u horarios).
        </p>
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
                <p className="text-xs text-muted-foreground">
                  La sala queda fija para este evento y todas sus funciones — si necesitás otra sala, creá un evento
                  nuevo.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora de la primera función</Label>
                <Input
                  type="datetime-local"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">Después podés agregarle más funciones desde su fila en la lista.</p>
              </div>
              <div className="space-y-2">
                <Label>Etiqueta de sponsors (opcional)</Label>
                <Input
                  value={form.sponsors_label}
                  onChange={(e) => setForm({ ...form, sponsors_label: e.target.value })}
                  placeholder='Ej: "Sponsors", "Auspiciantes", "Con el apoyo de"'
                />
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
        {shows.map((show) => (
          <Card key={show.id}>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg">{show.title}</h3>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {show.venues?.name}
                    </span>
                  </div>
                  {show.description && <p className="text-sm text-muted-foreground max-w-xl">{show.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setImagesShow(show)} className="text-muted-foreground hover:text-gold p-2" title="Imágenes">
                    <Image className="h-4 w-4" />
                  </button>
                  <button onClick={() => setSponsorsShow(show)} className="text-muted-foreground hover:text-gold p-2" title="Sponsors">
                    <Briefcase className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingShow(show)} className="text-muted-foreground hover:text-gold p-2" title="Editar evento">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 pl-1 border-l-2 border-border ml-1">
                {show.events.map((funcion) => (
                  <div key={funcion.id} className="flex flex-col md:flex-row md:items-center gap-2 justify-between pl-4 py-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateTime(funcion.event_date)}
                      <Badge variant={STATUS_LABELS[funcion.status]?.variant}>{STATUS_LABELS[funcion.status]?.label}</Badge>
                      {funcion.sold_out_status?.is_sold_out && <Badge variant="destructive">Agotado</Badge>}
                      {funcion.checkin_enabled && (
                        <span className="flex items-center gap-1 text-xs text-gold" title="Ingreso habilitado">
                          <Power className="h-3 w-3" /> Ingreso habilitado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingFuncion({ funcion, show })}
                        className="text-muted-foreground hover:text-gold p-2"
                        title="Editar función"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {funcion.status === 'draft' && (
                        <>
                          <Button size="sm" onClick={() => setPricingFuncion({ funcion, show })}>
                            <Rocket className="h-4 w-4 mr-2" /> Configurar precios y publicar
                          </Button>
                          <button onClick={() => handleDeleteFuncion(funcion.id)} className="text-muted-foreground hover:text-destructive p-2">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {funcion.status === 'scheduled' && (
                        <Button size="sm" variant="outline" onClick={() => handleCancelFuncion(funcion.id)}>
                          <XCircle className="h-4 w-4 mr-2" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setAddingFuncionTo(show)}
                  className="pl-4 text-xs text-gold hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Agregar función (otro día u horario)
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pricingFuncion && (
        <EventPricingDialog
          funcion={pricingFuncion.funcion}
          show={pricingFuncion.show}
          onClose={() => {
            setPricingFuncion(null);
            reload();
          }}
        />
      )}

      {editingFuncion && (
        <EditFuncionDialog
          funcion={editingFuncion.funcion}
          show={editingFuncion.show}
          onClose={() => setEditingFuncion(null)}
          onSaved={() => {
            setEditingFuncion(null);
            reload();
          }}
        />
      )}

      {addingFuncionTo && (
        <AddFuncionDialog
          show={addingFuncionTo}
          onClose={() => setAddingFuncionTo(null)}
          onCreated={(funcion) => {
            setAddingFuncionTo(null);
            reload();
            setPricingFuncion({ funcion, show: addingFuncionTo });
          }}
        />
      )}

      {editingShow && (
        <EditShowDialog
          show={editingShow}
          onClose={() => setEditingShow(null)}
          onSaved={() => {
            setEditingShow(null);
            reload();
          }}
        />
      )}

      {imagesShow && <ShowImagesDialog show={imagesShow} onClose={() => setImagesShow(null)} />}
      {sponsorsShow && <ShowSponsorsDialog show={sponsorsShow} onClose={() => setSponsorsShow(null)} />}
    </div>
  );
};

const AddFuncionDialog = ({ show, onClose, onCreated }) => {
  const { toast } = useToast();
  const [eventDate, setEventDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const funcion = await createFuncion({
        showId: show.id,
        venueId: show.venue_id,
        eventDate: new Date(eventDate).toISOString(),
      });
      toast({ title: 'Función agregada' });
      onCreated(funcion);
    } catch (err) {
      toast({ title: 'No pudimos agregar la función', description: friendlyEventError(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva función de "{show.title}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha y hora</Label>
            <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            <p className="text-xs text-muted-foreground">
              Se valida sola que la sala esté libre en ese horario.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Agregando…' : 'Agregar función'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EditFuncionDialog = ({ funcion, show, onClose, onSaved }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    event_date: toDatetimeLocalValue(funcion.event_date),
    manually_sold_out: funcion.manually_sold_out ?? false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFuncion(funcion.id, {
        event_date: new Date(form.event_date).toISOString(),
        manually_sold_out: form.manually_sold_out,
      });
      toast({ title: 'Función actualizada' });
      onSaved();
    } catch (err) {
      toast({ title: 'No pudimos guardar los cambios', description: friendlyEventError(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar función de "{show.title}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

const EditShowDialog = ({ show, onClose, onSaved }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: show.title,
    description: show.description ?? '',
    sponsors_label: show.sponsors_label ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateShow(show.id, {
        title: form.title,
        description: form.description || null,
        sponsors_label: form.sponsors_label || null,
      });
      toast({ title: 'Evento actualizado' });
      onSaved();
    } catch (err) {
      toast({ title: 'No pudimos guardar los cambios', description: err.message, variant: 'destructive' });
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
          <p className="text-xs text-muted-foreground">
            Sala: <strong className="text-foreground">{show.venues?.name}</strong> — para cambiarla, creá un evento
            nuevo.
          </p>
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

const ShowImagesDialog = ({ show, onClose }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    listShowImages(show.id)
      .then(setImages)
      .finally(() => setLoading(false));
  };

  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (file) => {
    const nextSortOrder = images.length > 0 ? Math.max(...images.map((i) => i.sort_order)) + 1 : 0;
    const created = await addShowImage(show.id, file, nextSortOrder);
    setImages([...images, created]);
  };

  const handleDelete = async (image) => {
    await deleteShowImage(image);
    setImages(images.filter((i) => i.id !== image.id));
  };

  const handleReorder = async (imageA, imageB) => {
    await reorderShowImage(imageA, imageB);
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
          <DialogTitle>Imágenes de "{show.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          La primera imagen es la que se muestra como portada en la cartelera. Si no subís ninguna, se muestra el
          ícono por defecto. Se comparten entre todas las funciones de este evento.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando imágenes…</p>
        ) : (
          <ImageManager
            images={images}
            maxImages={MAX_SHOW_IMAGES}
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

const ShowSponsorsDialog = ({ show, onClose }) => {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    listShowSponsors(show.id)
      .then(setSponsors)
      .finally(() => setLoading(false));
  };

  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (file) => {
    const nextSortOrder = sponsors.length > 0 ? Math.max(...sponsors.map((s) => s.sort_order)) + 1 : 0;
    const created = await addShowSponsor(show.id, file, nextSortOrder);
    setSponsors([...sponsors, created]);
  };

  const handleDelete = async (sponsor) => {
    await deleteShowSponsor(sponsor);
    setSponsors(sponsors.filter((s) => s.id !== sponsor.id));
  };

  const handleReorder = async (a, b) => {
    await reorderShowSponsor(a, b);
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
          <DialogTitle>Sponsors de "{show.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Se muestran en una sección aparte al entrar al evento, bajo la etiqueta "{show.sponsors_label || 'Sponsors'}"
          (editable desde "Editar evento").
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <ImageManager
            images={sponsors}
            maxImages={MAX_SHOW_SPONSORS}
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

const EventPricingDialog = ({ funcion, show, onClose }) => {
  const { toast } = useToast();
  const [zones, setZones] = useState([]);
  const [prices, setPrices] = useState({});
  const [generalPrice, setGeneralPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const venue = show.venues;

  useEffect(() => {
    (async () => {
      if (!venue?.general_admission) {
        const [zonesData, overrides] = await Promise.all([listZones(venue.id), getEventZonePrices(funcion.id)]);
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
  }, [funcion.id, venue]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      if (venue?.general_admission) {
        await ensureGeneralAdmissionSeats(venue.id, Number(generalPrice) || 0);
      } else {
        await setEventZonePrices(
          funcion.id,
          Object.entries(prices).map(([zone_id, price]) => ({ zone_id, price: Number(price) }))
        );
      }
      await publishEvent(funcion.id);
      toast({ title: 'Función publicada', description: 'Ya está visible en la cartelera.' });
      onClose();
    } catch (err) {
      toast({ title: 'No pudimos publicar la función', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = venue?.general_admission ? Number(generalPrice) >= 0 && generalPrice !== '' : zones.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {venue?.general_admission ? 'Precio de entrada general' : 'Precios por zona'} — {show.title} (
            {formatDateTime(funcion.event_date)})
          </DialogTitle>
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
            {publishing ? 'Publicando…' : 'Publicar función'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventsTab;
