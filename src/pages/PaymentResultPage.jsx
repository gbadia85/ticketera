import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Mail, XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getReservationStatus } from '@/lib/booking';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const MAX_POLLS = 20;
const POLL_INTERVAL_MS = 3000;

const PaymentResultPage = () => {
  const [searchParams] = useSearchParams();
  const reservationId = searchParams.get('reservation_id');

  const [result, setResult] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!reservationId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getReservationStatus(reservationId);
        if (cancelled) return;
        setResult(data);
        if (data.status === 'pending' && pollCount < MAX_POLLS) {
          timeoutRef.current = setTimeout(() => setPollCount((c) => c + 1), POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setResult({ status: 'not_found' });
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeoutRef.current);
    };
  }, [reservationId, pollCount]);

  return (
    <>
      <Helmet>
        <title>Resultado de tu compra — Butaca</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

      <div className="container py-16 max-w-lg flex-1">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-8 text-center">
              {!result && <p className="text-muted-foreground">Confirmando el resultado de tu pago…</p>}

              {result?.status === 'not_found' && (
                <>
                  <XCircle className="h-14 w-14 text-destructive mx-auto mb-4" />
                  <h1 className="font-display text-2xl mb-2">No encontramos tu reserva</h1>
                  <p className="text-muted-foreground text-sm mb-6">
                    Si el pago se debitó de tu cuenta, escribinos con tu comprobante y lo resolvemos.
                  </p>
                </>
              )}

              {result?.status === 'approved' && (
                <>
                  <CheckCircle2 className="h-14 w-14 text-success mx-auto mb-4" />
                  <h1 className="font-display text-2xl mb-2">¡Compra confirmada!</h1>
                  <p className="text-muted-foreground text-sm mb-6">
                    Te enviamos un email con los detalles de tu compra.
                  </p>
                  <div className="text-left bg-muted/40 rounded-lg p-4 space-y-2 mb-6">
                    <p className="font-semibold">{result.event?.title}</p>
                    <p className="text-sm text-muted-foreground">{result.event?.venue}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(result.event?.date)}</p>
                    <p className="text-sm">{result.seats?.join(', ')}</p>
                    <p className="font-semibold text-gold">{formatCurrency(result.total)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-6">
                    <Mail className="h-3.5 w-3.5" /> Revisá tu bandeja de entrada (y spam)
                  </p>
                </>
              )}

              {(result?.status === 'pending' && pollCount >= MAX_POLLS) && (
                <>
                  <Clock className="h-14 w-14 text-gold mx-auto mb-4" />
                  <h1 className="font-display text-2xl mb-2">Estamos confirmando tu pago</h1>
                  <p className="text-muted-foreground text-sm mb-6">
                    Puede demorar unos minutos. Te va a llegar un email en cuanto se confirme.
                  </p>
                </>
              )}

              {result?.status === 'pending' && pollCount < MAX_POLLS && (
                <>
                  <Clock className="h-14 w-14 text-gold mx-auto mb-4 animate-pulse" />
                  <h1 className="font-display text-2xl mb-2">Confirmando tu pago…</h1>
                  <p className="text-muted-foreground text-sm mb-6">No cierres esta ventana.</p>
                </>
              )}

              {(result?.status === 'rejected' || result?.status === 'expired') && (
                <>
                  <XCircle className="h-14 w-14 text-destructive mx-auto mb-4" />
                  <h1 className="font-display text-2xl mb-2">
                    {result.status === 'expired' ? 'La reserva expiró' : 'El pago no se pudo procesar'}
                  </h1>
                  <p className="text-muted-foreground text-sm mb-6">
                    Tus butacas fueron liberadas. Podés volver a intentarlo cuando quieras.
                  </p>
                </>
              )}

              <Button asChild>
                <Link to="/">Volver a la cartelera</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

        <Footer />
      </div>
    </>
  );
};

export default PaymentResultPage;
