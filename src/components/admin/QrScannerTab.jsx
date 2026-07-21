import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertTriangle, Camera, CheckCircle2, Pencil, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { checkInReservation } from '@/lib/api';

// Después de un escaneo (válido o no), esperamos un rato antes de
// volver a intentar leer, para no procesar el mismo QR 10 veces
// mientras la persona todavía lo tiene frente a la cámara.
const RESULT_DISPLAY_MS = 3000;

const QrScannerTab = () => {
  const { session } = useAdminAuth();
  const scannedBy = session?.user?.email ?? 'admin';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const pausedRef = useRef(false);

  const [cameraError, setCameraError] = useState(null);
  const [result, setResult] = useState(null); // { valid, first_name, last_name, seat_labels, already_checked_in, reason }
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);

  const processCode = async (code) => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    try {
      const data = await checkInReservation(code.trim(), scannedBy);
      setResult(data);
    } catch (err) {
      setResult({ valid: false, reason: 'error', detail: err.message });
    }
    setTimeout(() => {
      pausedRef.current = false;
      setResult(null);
    }, RESULT_DISPLAY_MS);
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

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Lector de QR</h2>
        <Button variant="outline" size="sm" onClick={() => setManualMode((m) => !m)}>
          {manualMode ? <Camera className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
          {manualMode ? 'Usar cámara' : 'Ingresar código a mano'}
        </Button>
      </div>

      {!manualMode && (
        <Card className="overflow-hidden">
          <div className="relative aspect-square bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-8 border-2 border-gold/70 rounded-2xl pointer-events-none" />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
                <p className="text-xs text-muted-foreground">
                  Revisá los permisos de cámara del navegador, o usá "Ingresar código a mano".
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {manualMode && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            placeholder="Pegá o escribí el código de la reserva"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <Button type="submit">Verificar</Button>
        </form>
      )}

      {result && (
        <Card
          className={
            result.valid
              ? result.already_checked_in
                ? 'border-gold/60'
                : 'border-success/60'
              : 'border-destructive/60'
          }
        >
          <CardContent className="p-5 text-center space-y-2">
            {result.valid && !result.already_checked_in && (
              <>
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <p className="font-display text-xl">
                  {result.first_name} {result.last_name}
                </p>
                <p className="text-sm text-muted-foreground">Butacas: {result.seat_labels?.join(', ') || '—'}</p>
                <p className="text-xs text-success">Ingreso registrado ✓</p>
              </>
            )}
            {result.valid && result.already_checked_in && (
              <>
                <RotateCcw className="h-10 w-10 text-gold mx-auto" />
                <p className="font-display text-xl">
                  {result.first_name} {result.last_name}
                </p>
                <p className="text-sm text-muted-foreground">Butacas: {result.seat_labels?.join(', ') || '—'}</p>
                <p className="text-xs text-gold">Esta entrada ya había ingresado antes.</p>
              </>
            )}
            {!result.valid && (
              <>
                <XCircle className="h-10 w-10 text-destructive mx-auto" />
                <p className="font-display text-xl">Entrada no válida</p>
                <p className="text-xs text-muted-foreground">
                  {result.reason === 'not_found' && 'No encontramos esa reserva.'}
                  {result.reason === 'not_paid' && 'Esta reserva todavía no está pagada.'}
                  {result.reason === 'error' && (result.detail || 'Ocurrió un error al verificar.')}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!result && (
        <p className="text-center text-xs text-muted-foreground">
          {manualMode ? 'Escribí el código y tocá "Verificar".' : 'Apuntá la cámara al QR de la entrada.'}
        </p>
      )}
    </div>
  );
};

export default QrScannerTab;
