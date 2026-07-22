import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertTriangle, Camera, CheckCircle2, LogOut, Pencil, RotateCcw, ThumbsUp, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/components/ui/use-toast';
import { cancelReservationCheckin, confirmReservationCheckin, lookupReservationCheckin, markReservationExit } from '@/lib/api';

// Pantalla pensada para usarse en el celular, en la puerta: sin menús
// ni configuración arriba — solo la cámara y el resultado. El panel
// para habilitar el ingreso de cada evento vive en "Venta en puerta".
const QrScannerTab = () => {
  const { session } = useAdminAuth();
  const { toast } = useToast();
  const scannedBy = session?.user?.email ?? 'admin';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const pausedRef = useRef(false);

  const [cameraError, setCameraError] = useState(null);
  const [result, setResult] = useState(null); // { valid, already_inside, confirmed, first_name, last_name, seat_labels, reason }
  const [confirming, setConfirming] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Pausamos el escaneo mientras haya un resultado en pantalla — así la
  // persona de la puerta tiene todo el tiempo que necesite para leerlo
  // y decidir, y solo se retoma cuando ella misma toca "Siguiente".
  const processCode = async (code) => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    try {
      const data = await lookupReservationCheckin(code.trim());
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
    if (manualMode) return undefined;
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
  }, [manualMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processCode(manualCode.trim());
    setManualCode('');
  };

  const handleConfirmEntry = async () => {
    setConfirming(true);
    try {
      const data = await confirmReservationCheckin(result.reservation_id, scannedBy);
      // Ojo: no volvemos a pausar/despausar nada acá — result.confirmed
      // pasa a true y el botón de "OK" desaparece, así no se puede
      // volver a tocar por error. Recién con "Siguiente" se habilita
      // otra lectura.
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
                  {result.reason === 'checkin_not_enabled' &&
                    'El ingreso para el evento de esta entrada no está habilitado. Activalo desde "Venta en puerta".'}
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
    </div>
  );
};

export default QrScannerTab;
