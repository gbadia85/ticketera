import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { createVenue, deleteVenue, listVenues, reorderVenue } from '@/lib/api';
import VenueEditor from '@/components/admin/VenueEditor';

const VenuesTab = () => {
  const { toast } = useToast();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', capacity: '' });

  const reload = () => {
    setLoading(true);
    listVenues()
      .then(setVenues)
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const venue = await createVenue({
        name: form.name,
        address: form.address || null,
        capacity: form.capacity ? Number(form.capacity) : null,
      });
      setDialogOpen(false);
      setForm({ name: '', address: '', capacity: '' });
      reload();
      setSelectedVenueId(venue.id);
    } catch (err) {
      toast({ title: 'No pudimos crear la sala', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta sala? Esto también borra su mapa de butacas. No se puede deshacer.')) return;
    try {
      await deleteVenue(id);
      reload();
    } catch (err) {
      toast({
        title: 'No pudimos eliminar la sala',
        description: 'Puede tener eventos asociados. ' + err.message,
        variant: 'destructive',
      });
    }
  };

  const handleMove = async (venue, direction) => {
    const index = venues.findIndex((v) => v.id === venue.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= venues.length) return;
    try {
      await reorderVenue(venue, venues[targetIndex]);
      reload();
    } catch (err) {
      toast({ title: 'No pudimos reordenar', description: err.message, variant: 'destructive' });
    }
  };

  if (selectedVenueId) {
    return (
      <div>
        <Button variant="ghost" onClick={() => { setSelectedVenueId(null); reload(); }} className="mb-4 -ml-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver a salas
        </Button>
        <VenueEditor venueId={selectedVenueId} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-muted-foreground text-sm">Creá tus salas y diseñá el mapa de butacas de cada una.</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Nueva sala
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva sala</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad (opcional)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="submit">Crear sala</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Cargando salas…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {venues.map((venue, index) => (
          <Card key={venue.id} className="hover:border-gold/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between gap-2">
                <span className="truncate">{venue.name}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleMove(venue, 'up')}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-gold disabled:opacity-30 p-1"
                    title="Subir"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(venue, 'down')}
                    disabled={index === venues.length - 1}
                    className="text-muted-foreground hover:text-gold disabled:opacity-30 p-1"
                    title="Bajar"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(venue.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {venue.address && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> {venue.address}
                </p>
              )}
              {venue.capacity && (
                <p className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> {venue.capacity} butacas
                </p>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setSelectedVenueId(venue.id)}>
                Editar sala
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VenuesTab;
