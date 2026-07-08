import React, { useState } from 'react';
import { AlertOctagon, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { adminDeleteAllEvents, adminDeleteAllVenues, adminResetDatabase } from '@/lib/api';

const ACTIONS = [
  {
    key: 'events',
    title: 'Borrar todos los eventos',
    description:
      'Borra todos los eventos, sus butacas por evento, precios por evento y TODAS las reservas (aprobadas o no). Las salas, zonas y el layout de butacas quedan intactos.',
    confirmWord: 'BORRAR EVENTOS',
    action: adminDeleteAllEvents,
  },
  {
    key: 'venues',
    title: 'Borrar todas las salas',
    description:
      'Borra todas las salas, sus zonas de precio y butacas. Como un evento no puede existir sin sala, esto borra también todos los eventos y reservas. No quedará nada cargado.',
    confirmWord: 'BORRAR SALAS',
    action: adminDeleteAllVenues,
  },
  {
    key: 'reset',
    title: 'Resetear toda la base de datos',
    description:
      'Vuelve el sistema al estado inicial: borra salas, zonas, butacas, eventos y reservas por completo. Usalo solo si querés arrancar de cero.',
    confirmWord: 'RESETEAR TODO',
    action: adminResetDatabase,
  },
];

const DangerZoneTab = () => {
  const { toast } = useToast();
  const [openKey, setOpenKey] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [loadingKey, setLoadingKey] = useState(null);

  const current = ACTIONS.find((a) => a.key === openKey);

  const handleConfirm = async () => {
    if (!current || confirmText !== current.confirmWord) return;
    setLoadingKey(current.key);
    try {
      await current.action();
      toast({ title: 'Listo', description: `${current.title}: hecho.` });
      setOpenKey(null);
      setConfirmText('');
    } catch (err) {
      toast({ title: 'No pudimos completar la acción', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm bg-destructive/10 border border-destructive/30 rounded-md p-3 mb-2">
        <AlertOctagon className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <p className="text-muted-foreground">
          Estas acciones son irreversibles. No hay forma de recuperar los datos borrados desde acá — solo un backup
          de tu base de datos en Supabase podría hacerlo.
        </p>
      </div>

      {ACTIONS.map((a) => (
        <Card key={a.key} className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" /> {a.title}
            </CardTitle>
            <CardDescription>{a.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setOpenKey(a.key);
                setConfirmText('');
              }}
            >
              {a.title}
            </Button>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!openKey} onOpenChange={(open) => !open && setOpenKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿{current?.title}?</AlertDialogTitle>
            <AlertDialogDescription>{current?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm">
              Escribí <span className="font-mono text-destructive">{current?.confirmWord}</span> para confirmar
            </Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== current?.confirmWord || loadingKey === current?.key}
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loadingKey === current?.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DangerZoneTab;
