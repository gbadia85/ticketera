import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, CreditCard, Fingerprint, Mail, Phone, User } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useCountdown, formatMMSS } from '@/hooks/useCountdown';
import { getEvent, listMyHeldSeats } from '@/lib/api';
import { createPendingReservation, createPaymentPreference } from '@/lib/booking';
import { getSessionId } from '@/lib/session';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { siteConfig } from '@/site.config';

const CheckoutPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const sessionId = getSessionId();
  const t = siteConfig.texts.checkout;

  const [event, setEvent] = useState(null);
  const [heldSeats, setHeldSeats] = useState(null); // null = cargando
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    confirmEmail: '',
    dni: '',
    phone: '',
  });

  const earliestHeldUntil = heldSeats?.length
    ? heldSeats.reduce((min, s) => (s.held_until < min ? s.held_until : min), heldSeats[0].held_until)
    : null;

  const handleExpire = () => {
    toast({
      title: 'Tiempo expirado',
      description: 'Tu reserva temporal venció. Volvé a seleccionar tus butacas.',
      variant: 'destructive',
    });
    navigate(`/evento/${eventId}`);
  };

  const secondsLeft = useCountdown(earliestHeldUntil, handleExpire);

  useEffect(() => {
    getEvent(eventId).then(setEvent).catch(() => {});
    listMyHeldSeats(eventId, sessionId)
      .then((seats) => {
        if (seats.length === 0) {
          navigate(`/evento/${eventId}`);
        } else {
          setHeldSeats(seats);
        }
      })
      .catch(() => setHeldSeats([]));
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = (heldSeats ?? []).reduce((sum, s) => sum + Number(s.price), 0);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePayment = async () => {
    const { firstName, lastName, email, confirmEmail, dni, phone } = formData;
    if (!firstName || !lastName || !email || !confirmEmail || !dni || !phone) {
      toast({ title: 'Campos incompletos', description: 'Completá todos los campos.', variant: 'destructive' });
      return;
    }
    if (email !== confirmEmail) {
      toast({ title: 'Los emails no coinciden', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const { reservation_id } = await createPendingReservation(eventId, sessionId, formData);
      const { init_point, sandbox_init_point } = await createPaymentPreference(reservation_id);
      window.location.href = init_point || sandbox_init_point;
    } catch (err) {
      if (err.message === 'hold_expired') {
        toast({
          title: 'Tiempo expirado',
          description: 'Tu reserva venció antes de completar el pago.',
          variant: 'destructive',
        });
        navigate(`/evento/${eventId}`);
      } else {
        toast({ title: 'No pudimos iniciar el pago', description: err.message, variant: 'destructive' });
      }
      setIsProcessing(false);
    }
  };

  if (!event || heldSeats === null) return null;

  return (
    <>
      <Helmet>
        <title>Checkout — {event.title}</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

      <div className="container py-8 flex-1">
        <Button variant="ghost" onClick={() => navigate(`/evento/${eventId}`)} className="mb-6 -ml-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl">{t.buyerDataTitle}</CardTitle>
                    <div className="flex items-center gap-2 text-gold font-mono">
                      <Clock className="h-5 w-5" />
                      {formatMMSS(secondsLeft)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field icon={User} id="firstName" label="Nombre" value={formData.firstName} onChange={handleChange} placeholder="Juan" />
                    <Field icon={User} id="lastName" label="Apellido" value={formData.lastName} onChange={handleChange} placeholder="Pérez" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field icon={Fingerprint} id="dni" label="DNI" value={formData.dni} onChange={handleChange} placeholder="12345678" />
                    <Field icon={Phone} id="phone" label="Celular" value={formData.phone} onChange={handleChange} placeholder="1122334455" type="tel" />
                  </div>
                  <Field icon={Mail} id="email" label="Email" value={formData.email} onChange={handleChange} placeholder="juan@ejemplo.com" type="email" />
                  <Field icon={Mail} id="confirmEmail" label="Confirmar email" value={formData.confirmEmail} onChange={handleChange} placeholder="juan@ejemplo.com" type="email" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CreditCard className="h-5 w-5" /> {t.paymentMethodTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t.paymentMethodDescription}
                  </p>
                  <Button onClick={handlePayment} disabled={isProcessing} className="w-full" size="lg">
                    {isProcessing ? t.payingButton : `${t.payButtonPrefix} ${formatCurrency(total)}`}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="sticky top-24">
              <Card>
                <CardHeader>
                  <CardTitle>{t.summaryTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold">{event.title}</h3>
                    <p className="text-sm text-muted-foreground">{event.venues?.name}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(event.event_date)}</p>
                  </div>
                  <div className="border-t border-border pt-4 space-y-2">
                    {heldSeats.map((seat) => (
                      <div key={seat.id} className="flex justify-between items-center text-sm">
                        <span>
                          {seat.seats?.label}
                          {seat.seat_zones?.name && <span className="ml-2 text-xs text-gold">{seat.seat_zones.name}</span>}
                        </span>
                        <span>{formatCurrency(seat.price)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-4 flex justify-between items-center text-xl font-bold">
                    <span>Total</span>
                    <span className="text-gold">{formatCurrency(total)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

        <Footer />
      </div>
    </>
  );
};

const Field = ({ icon: Icon, id, label, ...props }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>
      <Icon className="h-4 w-4 inline mr-2" />
      {label}
    </Label>
    <Input id={id} name={id} {...props} />
  </div>
);

export default CheckoutPage;
