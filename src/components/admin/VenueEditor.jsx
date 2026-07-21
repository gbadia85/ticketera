import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Grid3x3, Image, Move, Palette, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import { DISABLED_COLOR, ZONE_COLOR_PALETTE } from '@/lib/seatColors';
import ImageManager from '@/components/admin/ImageManager';
import {
  addVenueImage,
  bulkCreateSeats,
  createZone,
  deleteSeatsByVenue,
  deleteVenueImage,
  deleteZone,
  listEventsByVenue,
  listSeats,
  listVenueImages,
  listVenues,
  listZones,
  reorderVenueImage,
  swapSeatPositions,
  updateSeat,
  updateVenue,
  updateZone,
} from '@/lib/api';

const SEAT_SIZE = 26;
const MAX_VENUE_IMAGES = 8;

const VenueEditor = ({ venueId }) => {
  const { toast } = useToast();
  const [venue, setVenue] = useState(null);
  const [zones, setZones] = useState([]);
  const [seats, setSeats] = useState([]);
  const [images, setImages] = useState([]);
  const [hasEvents, setHasEvents] = useState(false);
  const [loading, setLoading] = useState(true);

  const [rowsInput, setRowsInput] = useState(6);
  const [colsInput, setColsInput] = useState(10);
  const [newZone, setNewZone] = useState({ name: '', color: ZONE_COLOR_PALETTE[0].hex, default_price: '' });
  const [paintMode, setPaintMode] = useState('zone'); // 'zone' | 'aisle' | 'move'
  const [activeZoneId, setActiveZoneId] = useState(null);
  const [movingSeatId, setMovingSeatId] = useState(null);

  const reload = async () => {
    setLoading(true);
    const [venuesData, zonesData, seatsData, eventsData, imagesData] = await Promise.all([
      listVenues(),
      listZones(venueId),
      listSeats(venueId),
      listEventsByVenue(venueId),
      listVenueImages(venueId),
    ]);
    setVenue(venuesData.find((v) => v.id === venueId));
    setZones(zonesData);
    setSeats(seatsData);
    setHasEvents(eventsData.length > 0);
    setImages(imagesData);
    if (zonesData.length > 0 && !activeZoneId) setActiveZoneId(zonesData[0].id);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (seats.length > 0) {
      const maxRow = seats.reduce((m, s) => Math.max(m, s.pos_row), -1);
      const maxCol = seats.reduce((m, s) => Math.max(m, s.pos_col), -1);
      setRowsInput(maxRow + 1);
      setColsInput(maxCol + 1);
    }
  }, [seats]);

  const handleSaveVenueInfo = async (e) => {
    e.preventDefault();
    try {
      await updateVenue(venueId, {
        name: venue.name,
        address: venue.address,
        capacity: venue.capacity ? Number(venue.capacity) : null,
        description: venue.description || null,
        general_admission: venue.general_admission ?? false,
      });
      toast({ title: 'Datos de la sala guardados' });
    } catch (err) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    }
  };

  const handleUploadImage = async (file) => {
    const nextSortOrder = images.length > 0 ? Math.max(...images.map((i) => i.sort_order)) + 1 : 0;
    const created = await addVenueImage(venueId, file, nextSortOrder);
    setImages([...images, created]);
  };

  const handleDeleteImage = async (image) => {
    await deleteVenueImage(image);
    setImages(images.filter((i) => i.id !== image.id));
  };

  const handleReorderImage = async (imageA, imageB) => {
    await reorderVenueImage(imageA, imageB);
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

  const handleAddZone = async (e) => {
    e.preventDefault();
    if (!newZone.name || newZone.default_price === '') return;
    try {
      const zone = await createZone({
        venue_id: venueId,
        name: newZone.name,
        color: newZone.color,
        default_price: Number(newZone.default_price),
      });
      setZones([...zones, zone]);
      setNewZone({ name: '', color: ZONE_COLOR_PALETTE[0].hex, default_price: '' });
      if (!activeZoneId) setActiveZoneId(zone.id);
    } catch (err) {
      toast({ title: 'No pudimos crear la zona', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateZonePrice = async (zoneId, price) => {
    setZones(zones.map((z) => (z.id === zoneId ? { ...z, default_price: price } : z)));
  };

  const handleZonePriceBlur = async (zoneId, price) => {
    try {
      await updateZone(zoneId, { default_price: Number(price) });
    } catch (err) {
      toast({ title: 'No pudimos actualizar el precio', description: err.message, variant: 'destructive' });
    }
  };

  const handleZoneColorChange = async (zoneId, color) => {
    setZones(zones.map((z) => (z.id === zoneId ? { ...z, color } : z)));
    try {
      await updateZone(zoneId, { color });
    } catch (err) {
      toast({ title: 'No pudimos actualizar el color', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteZone = async (zoneId) => {
    if (!confirm('¿Eliminar esta zona? Las butacas que la usaban quedarán sin zona asignada.')) return;
    try {
      await deleteZone(zoneId);
      setZones(zones.filter((z) => z.id !== zoneId));
      reload();
    } catch (err) {
      toast({ title: 'No pudimos eliminar la zona', description: err.message, variant: 'destructive' });
    }
  };

  const handleGenerateGrid = async () => {
    if (zones.length === 0) {
      toast({ title: 'Creá al menos una zona antes de generar la grilla', variant: 'destructive' });
      return;
    }
    if (
      !confirm(
        seats.length > 0
          ? '¿Regenerar la grilla? Se borra el layout actual por completo. Esta sala no tiene eventos, así que es seguro.'
          : `¿Generar una grilla de ${rowsInput} filas x ${colsInput} butacas?`
      )
    )
      return;

    try {
      if (seats.length > 0) await deleteSeatsByVenue(venueId);

      const rows = Number(rowsInput);
      const cols = Number(colsInput);
      const defaultZoneId = zones[0].id;
      const newSeats = [];
      for (let r = 0; r < rows; r++) {
        const rowLabel = String.fromCharCode(65 + (r % 26));
        for (let c = 0; c < cols; c++) {
          newSeats.push({
            venue_id: venueId,
            zone_id: defaultZoneId,
            row_label: rowLabel,
            seat_number: c + 1,
            pos_row: r,
            pos_col: c,
            label: `Fila ${rowLabel}, Butaca ${c + 1}`,
            is_active: true,
          });
        }
      }
      await bulkCreateSeats(newSeats);
      toast({ title: 'Grilla generada', description: `${newSeats.length} butacas creadas.` });
      reload();
    } catch (err) {
      toast({ title: 'No pudimos generar la grilla', description: err.message, variant: 'destructive' });
    }
  };

  const handleSeatClick = async (seat) => {
    if (paintMode === 'move') {
      if (!movingSeatId) {
        setMovingSeatId(seat.id);
        return;
      }
      if (movingSeatId === seat.id) {
        setMovingSeatId(null);
        return;
      }
      const sourceId = movingSeatId;
      setMovingSeatId(null);
      try {
        await swapSeatPositions(sourceId, seat.id);
        reload();
      } catch (err) {
        toast({ title: 'No pudimos mover la butaca', description: err.message, variant: 'destructive' });
      }
      return;
    }

    try {
      if (paintMode === 'aisle') {
        const updated = await updateSeat(seat.id, { is_active: !seat.is_active });
        setSeats(seats.map((s) => (s.id === seat.id ? updated : s)));
      } else if (paintMode === 'zone' && activeZoneId) {
        const updated = await updateSeat(seat.id, { zone_id: activeZoneId });
        setSeats(seats.map((s) => (s.id === seat.id ? { ...updated, seat_zones: zones.find((z) => z.id === activeZoneId) } : s)));
      }
    } catch (err) {
      toast({ title: 'No pudimos actualizar la butaca', description: err.message, variant: 'destructive' });
    }
  };

  const { rows, cols } = useMemo(() => {
    const maxRow = seats.reduce((m, s) => Math.max(m, s.pos_row), -1);
    const maxCol = seats.reduce((m, s) => Math.max(m, s.pos_col), -1);
    return { rows: maxRow + 1, cols: maxCol + 1 };
  }, [seats]);

  const seatGrid = useMemo(() => {
    const map = new Map();
    for (const s of seats) map.set(`${s.pos_row}-${s.pos_col}`, s);
    return map;
  }, [seats]);

  if (loading || !venue) return <p className="text-muted-foreground text-sm">Cargando sala…</p>;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos de la sala</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveVenueInfo} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={venue.name} onChange={(e) => setVenue({ ...venue, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={venue.address ?? ''} onChange={(e) => setVenue({ ...venue, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Capacidad</Label>
              <Input
                type="number"
                value={venue.capacity ?? ''}
                onChange={(e) => setVenue({ ...venue, capacity: e.target.value })}
              />
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label>Descripción (se muestra en la página pública de la sala)</Label>
              <Textarea
                value={venue.description ?? ''}
                onChange={(e) => setVenue({ ...venue, description: e.target.value })}
                placeholder="Contale a la gente cómo es esta sala: ambientación, ubicación, accesos, etc."
                rows={3}
              />
            </div>
            <label className="md:col-span-3 flex items-start gap-2 text-sm rounded-md border border-border p-3">
              <input
                type="checkbox"
                checked={venue.general_admission ?? false}
                onChange={(e) => setVenue({ ...venue, general_admission: e.target.checked })}
                className="h-4 w-4 rounded border-input mt-0.5"
              />
              <span>
                <span className="block font-medium">Sala de entrada general (sin mapa de butacas)</span>
                <span className="block text-xs text-muted-foreground">
                  Se vende por cantidad de entradas en vez de elegir butacas puntuales. El límite de "agotado" es la
                  capacidad de arriba. Al activarlo, las zonas y el layout de butacas de abajo dejan de usarse.
                </span>
              </span>
            </label>
            <div className="md:col-span-3">
              <Button type="submit" size="sm">
                <Save className="h-4 w-4 mr-2" /> Guardar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image className="h-5 w-5" /> Imágenes de la sala
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Se muestran en el apartado "Sala" de cada evento y en la página pública de esta sala.
          </p>
          <ImageManager
            images={images}
            maxImages={MAX_VENUE_IMAGES}
            onUpload={handleUploadImage}
            onDelete={handleDeleteImage}
            onReorder={handleReorderImage}
            coverLabel="Principal"
          />
        </CardContent>
      </Card>

      {venue.general_admission ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            Esta sala está configurada como <strong className="text-foreground">entrada general</strong>: no usa
            zonas de precio ni mapa de butacas. El precio de la entrada se define al publicar cada evento.
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" /> Zonas de precio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center gap-3 bg-muted/30 rounded-md p-2">
                <ColorSwatchPicker value={zone.color} onChange={(color) => handleZoneColorChange(zone.id, color)} />
                <span className="flex-1 text-sm">{zone.name}</span>
                <Input
                  type="number"
                  className="w-28 h-8"
                  value={zone.default_price}
                  onChange={(e) => handleUpdateZonePrice(zone.id, e.target.value)}
                  onBlur={(e) => handleZonePriceBlur(zone.id, e.target.value)}
                />
                <button onClick={() => handleDeleteZone(zone.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddZone} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                className="w-40"
                placeholder="Ej: Platea, VIP"
                value={newZone.name}
                onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <ColorSwatchPicker value={newZone.color} onChange={(color) => setNewZone({ ...newZone, color })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio base</Label>
              <Input
                type="number"
                className="w-32"
                placeholder="8000"
                value={newZone.default_price}
                onChange={(e) => setNewZone({ ...newZone, default_price: e.target.value })}
              />
            </div>
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4 mr-2" /> Agregar zona
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            El rojo y el negro están reservados por el sistema para "vendida" y "no disponible" — por eso no
            aparecen en la paleta.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Grid3x3 className="h-5 w-5" /> Layout de butacas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasEvents && (
            <div className="flex items-start gap-2 text-sm bg-gold/10 border border-gold/30 rounded-md p-3">
              <AlertTriangle className="h-4 w-4 text-gold mt-0.5 shrink-0" />
              <p>
                Esta sala ya tiene eventos creados, así que no se puede regenerar la grilla (borraría sus butacas
                vendidas). Todavía podés repintar zonas y marcar pasillos sobre el layout existente.
              </p>
            </div>
          )}

          {(seats.length === 0 || !hasEvents) && (
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Filas</Label>
                <Input type="number" className="w-24" value={rowsInput} onChange={(e) => setRowsInput(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Butacas por fila</Label>
                <Input type="number" className="w-24" value={colsInput} onChange={(e) => setColsInput(e.target.value)} />
              </div>
              <Button onClick={handleGenerateGrid}>
                {seats.length === 0 ? 'Generar grilla' : 'Regenerar grilla desde cero'}
              </Button>
            </div>
          )}

          {seats.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground mr-2">Modo pincel:</span>
                {zones.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => {
                      setPaintMode('zone');
                      setActiveZoneId(zone.id);
                    }}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full border transition-colors',
                      paintMode === 'zone' && activeZoneId === zone.id
                        ? 'border-gold text-gold bg-gold/10'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full mr-1.5"
                      style={{ backgroundColor: zone.color }}
                    />
                    {zone.name} ({formatCurrency(zone.default_price)})
                  </button>
                ))}
                <button
                  onClick={() => setPaintMode('aisle')}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
                    paintMode === 'aisle' ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted-foreground'
                  )}
                >
                  Marcar pasillo / hueco
                </button>
                <button
                  onClick={() => {
                    setPaintMode('move');
                    setMovingSeatId(null);
                  }}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1',
                    paintMode === 'move' ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted-foreground'
                  )}
                >
                  <Move className="h-3 w-3" /> Mover butaca
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {paintMode === 'move'
                  ? movingSeatId
                    ? 'Ahora hacé clic en el lugar donde querés moverla (intercambia posición con lo que haya ahí, sea butaca o pasillo).'
                    : 'Hacé clic en la butaca que querés mover. Con esto podés armar formas en U, herradura, o cualquier layout no rectangular: llevá butacas activas a donde querés y dejá pasillos donde sobren.'
                  : 'Hacé clic sobre una butaca para pintarla con la zona seleccionada, o para marcarla/desmarcarla como pasillo.'}
              </p>

              <div className="overflow-x-auto">
                <div
                  className="text-center text-[10px] tracking-[0.3em] text-gold border-b border-gold/30 pb-2 mb-3"
                  style={{ minWidth: cols * SEAT_SIZE }}
                >
                  ESCENARIO
                </div>
                <div
                  className="inline-grid gap-1.5 p-4"
                  style={{ gridTemplateColumns: `repeat(${cols}, ${SEAT_SIZE}px)` }}
                >
                  {Array.from({ length: rows }).map((_, r) =>
                    Array.from({ length: cols }).map((_, c) => {
                      const seat = seatGrid.get(`${r}-${c}`);
                      if (!seat) return <div key={`${r}-${c}`} style={{ width: SEAT_SIZE, height: SEAT_SIZE }} />;
                      const zone = zones.find((z) => z.id === seat.zone_id);
                      const isPicked = paintMode === 'move' && movingSeatId === seat.id;
                      return (
                        <button
                          key={seat.id}
                          title={seat.label}
                          onClick={() => handleSeatClick(seat)}
                          style={{
                            width: SEAT_SIZE,
                            height: SEAT_SIZE,
                            backgroundColor: seat.is_active ? zone?.color ?? '#555555' : DISABLED_COLOR,
                            outline: isPicked ? '2px solid #F5EFE3' : 'none',
                            outlineOffset: isPicked ? '2px' : '0',
                          }}
                          className="rounded-[4px] text-[9px] font-mono flex items-center justify-center text-white/90 hover:scale-110 transition-transform"
                        >
                          {seat.is_active ? seat.seat_number : '✕'}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
};

const ColorSwatchPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5 max-w-[220px]">
    {ZONE_COLOR_PALETTE.map((c) => (
      <button
        key={c.hex}
        type="button"
        title={c.name}
        onClick={() => onChange(c.hex)}
        className={cn(
          'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
          value === c.hex ? 'border-white' : 'border-transparent'
        )}
        style={{ backgroundColor: c.hex }}
      />
    ))}
  </div>
);

export default VenueEditor;
