import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertTriangle, Camera, CheckCircle2, DoorOpen, LogOut, Pencil, RotateCcw, ThumbsUp, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/components/ui/use-toast';
import { cancelReservationCheckin, confirmReservationCheckin, listAllFunciones, lookupReservationCheckin, markReservationExit } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

// Pantalla pensada para usarse en el celular, en la puerta: sin menús
// ni configuración arriba — solo la cámara y el resultado. Para
// habilitar qué eventos se pueden hacer pasar, ver la pestaña
// "Abrir puerta".
const QrScannerTab = () => {
  const { session } = useAdminAuth();
  const { toast } = useToast();
  const scannedBy = session?.user?.email ?? 'admin';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const pausedRef = useRef(false);

  const [enabledEvents, setEnabledEvents] = useState(null); // null = cargando
  const [doorEventId, setDoorEventId] = useState(null); // a qué evento está "fijado" este lector

  const [cameraError, setCameraError] = useState(null);
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    listAllFunciones().then((data) => {
      const enabled = data.filter((e) => e.status === 'scheduled' && e.checkin_enabled);
      setEnabledEvents(enabled);
      // Si hay uno solo habilitado, no hace falta preguntar nada.
      if (enabled.length === 1) setDoorEventId(enabled[0].id);
    });
  }, []);

  const doorEvent = enabledEvents?.find((e) => e.id === doorEventId) ?? null;

  const processCode = async (code) => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    try {
      const data = await lookupReservationCheckin(code.trim(), doorEventId);
      setResult({ ...data, reservation_id: data.reservation_id ?? code.trim(), confirmed: false });
    } catch (err) {
      setResult({ valid: false, reason: 'error', detail: err.message });
    }
  };

  const resumeScanning = () => {
    setResult(null);
    pausedRef.current = false;
  };

  useEffect(() => {
    if (manualMode || !doorEventId) return undefined;
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        setCameraError(err.message || 'No pudimos acceder a la cámara.');
      }
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          processCode(code.data);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [manualMode, doorEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processCode(manualCode.trim());
    setManualCode('');
  };

  const handleConfirmEntry = async () => {
    setConfirming(true);
    try {
      const data = await confirmReservationCheckin(result.reservation_id, scannedBy, doorEventId);
      setResult({ ...result, ...data, confirmed: true });
    } catch (err) {
      toast({ title: 'No pudimos confirmar el ingreso', description: err.message, variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };

  const handleMarkExit = async () => {
    setActionBusy(true);
    try {
      await markReservationExit(result.reservation_id, scannedBy);
      toast({ title: 'Salida registrada', description: 'Puede volver a escanear su QR para reingresar.' });
      resumeScanning();
    } catch (err) {
      toast({ title: 'No pudimos registrar la salida', description: err.message, variant: 'destructive' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelCheckin = async () => {
    if (!confirm('¿Cancelar este ingreso? Queda como si nunca hubiera entrado.')) return;
    setActionBusy(true);
    try {
      await cancelReservationCheckin(result.reservation_id, scannedBy);
      toast({ title: 'Ingreso cancelado' });
      resumeScanning();
    } catch (err) {
      toast({ title: 'No pudimos cancelar el ingreso', description: err.message, variant: 'destructive' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleExitScanner = () => {
    resumeScanning();
    setManualMode(false);
    setDoorEventId(null);
  };

  // --- Cargando ---
  if (enabledEvents === null) {
    return <p className="text-center text-sm text-muted-foreground">Cargando…</p>;
  }

  // --- Ningún evento habilitado ---
  if (enabledEvents.length === 0) {
    return (
      <div className="max-w-sm mx-auto text-center space-y-2 py-8">
        <AlertTriangle className="h-10 w-10 text-gold mx-auto" />
        <p className="text-sm text-muted-foreground">
          No hay ningún evento habilitado para el ingreso. Andá a la pestaña "Abrir puerta" y habilitá el evento
          correspondiente antes de escanear.
        </p>
      </div>
    );
  }

  // --- Hay más de uno habilitado y todavía no se eligió con cuál trabaja este lector ---
  if (!doorEventId) {
    return (
      <div className="max-w-sm mx-auto space-y-3">
        <p className="text-sm font-medium text-center">¿Para qué evento estás usando este lector?</p>
        {enabledEvents.map((e) => (
          <button
            key={e.id}
            onClick={() => setDoorEventId(e.id)}
            className="w-full text-left rounded-md border border-border p-3 hover:border-gold/60 transition-colors flex items-center gap-3"
          >
            <DoorOpen className="h-4 w-4 text-gold shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">{e.shows?.title}</span>
              <span className="block text-xs text-muted-foreground">
                {formatDateTime(e.event_date)} · {e.venues?.name}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-3">
      {!manualMode && (
        <Card className="overflow-hidden relative">
          <button
            onClick={() => { setManualMode(true); resumeScanning(); }}
            className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-gold"
            title="Ingresar código a mano"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <div className="relative aspect-square bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-8 border-2 border-gold/70 rounded-2xl pointer-events-none" />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
                <p className="text-xs text-muted-foreground">
                  Revisá los permisos de cámara, o tocá el lápiz para ingresar el código a mano.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {manualMode && !result && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            placeholder="Código de la reserva"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            autoFocus
          />
          <Button type="submit">Verificar</Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => setManualMode(false)} title="Usar cámara">
            <Camera className="h-4 w-4" />
          </Button>
        </form>
      )}

      {result && (
        <Card
          className={
            result.valid
              ? result.already_inside
                ? 'border-gold/60'
                : 'border-success/60'
              : 'border-destructive/60'
          }
        >
          <CardContent className="p-5 text-center space-y-3">
            {result.valid && !result.already_inside && !result.confirmed && (
              <>
                <ThumbsUp className="h-10 w-10 text-gold mx-auto" />
                <p className="font-display text-xl">{result.first_name} {result.last_name}</p>
                <p className="text-sm text-muted-foreground">Butacas: {result.seat_labels?.join(', ') || '—'}</p>
                <p className="text-xs text-muted-foreground">Confirmá el ingreso para que quede registrado.</p>
                <Button className="w-full" disabled={confirming} onClick={handleConfirmEntry}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> {confirming ? 'Confirmando…' : 'OK, dejar entrar'}
                </Button>
              </>
            )}

            {result.valid && !result.already_inside && result.confirmed && (
              <>
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <p className="font-display text-xl">{result.first_name} {result.last_name}</p>
                <p className="text-sm text-muted-foreground">Butacas: {result.seat_labels?.join(', ') || '—'}</p>
                <p className="text-xs text-success">Ingreso confirmado ✓</p>
              </>
            )}

            {result.valid && result.already_inside && (
              <>
                <AlertTriangle className="h-10 w-10 text-gold mx-auto" />
                <p className="font-display text-xl">{result.first_name} {result.last_name}</p>
                <p className="text-sm text-muted-foreground">Butacas: {result.seat_labels?.join(', ') || '—'}</p>
                <p className="text-xs text-gold">Esta entrada ya está adentro — ¿se volvió a leer por error?</p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="outline" disabled={actionBusy} onClick={handleMarkExit}>
                    <LogOut className="h-4 w-4 mr-2" /> Marcar salida
                  </Button>
                  <Button variant="destructive" disabled={actionBusy} onClick={handleCancelCheckin}>
                    <XCircle className="h-4 w-4 mr-2" /> Cancelar ingreso (fue un error)
                  </Button>
                </div>
              </>
            )}

            {!result.valid && (
              <>
                <XCircle className="h-10 w-10 text-destructive mx-auto" />
                <p className="font-display text-xl">Entrada no válida</p>
                <p className="text-xs text-muted-foreground">
                  {result.reason === 'not_found' && 'No encontramos esa reserva.'}
                  {result.reason === 'not_paid' && 'Esta reserva todavía no está pagada.'}
                  {result.reason === 'checkin_not_enabled' && 'El ingreso para el evento de esta entrada no está habilitado.'}
                  {result.reason === 'wrong_door' && `Esta entrada es de otro evento habilitado — no de "${doorEvent?.shows?.title}".`}
                  {result.reason === 'error' && (result.detail || 'Ocurrió un error al verificar.')}
                </p>
              </>
            )}

            <Button className="w-full mt-2" variant="outline" onClick={resumeScanning}>
              <RotateCcw className="h-4 w-4 mr-2" /> Siguiente
            </Button>
          </CardContent>
        </Card>
      )}

      {!result && !manualMode && (
        <p className="text-center text-xs text-muted-foreground">Apuntá la cámara al QR de la entrada.</p>
      )}

      <p className="text-center text-xs text-muted-foreground pt-2">
        Lector fijado a: <span className="text-foreground">{doorEvent?.shows?.title}</span>
      </p>
      <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleExitScanner}>
        <LogOut className="h-4 w-4 mr-2" /> Salir del lector
      </Button>
    </div>
  );
};

export default QrScannerTab;
