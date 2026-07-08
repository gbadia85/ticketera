import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, MapPin, Theater, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVenuePublic, listPublicEvents } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { siteConfig } from '@/site.config';

const VenueDetailsPage = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const t = siteConfig.texts.venues;

  const [venue, setVenue] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setActiveImage(0);
    Promise.all([getVenuePublic(venueId), listPublicEvents()])
      .then(([venueData, allEvents]) => {
        setVenue(venueData);
        setEvents(allEvents.filter((e) => e.venues?.id === venueId));
      })
      .finally(() => setLoading(false));
  }, [venueId]);

  const images = venue?.venue_images ?? [];
  const mainImage = useMemo(() => images[activeImage]?.url ?? images[0]?.url, [images, activeImage]);

  if (loading) return null;

  if (!venue) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-16 text-center text-muted-foreground flex-1">No encontramos esta sala.</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>{venue.name} — {siteConfig.identity.siteName}</title>
      </Helmet>
      <Navbar />

      <div className="container py-8 flex-1">
        <Button variant="ghost" onClick={() => navigate('/salas')} className="mb-6 -ml-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> {t.backToVenues}
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {mainImage ? (
              <>
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <img src={mainImage} alt={venue.name} className="w-full h-full object-cover" />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((img, i) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImage(i)}
                        className={`h-16 w-24 shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                          i === activeImage ? 'border-gold' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-video rounded-lg border border-border flex items-center justify-center bg-gradient-to-br from-accent to-muted">
                <Theater className="h-12 w-12 text-gold" />
              </div>
            )}

            <div>
              <h1 className="font-display text-3xl md:text-4xl mb-2">{venue.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                {venue.address && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {venue.address}
                  </span>
                )}
                {venue.capacity && (
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> {venue.capacity} butacas
                  </span>
                )}
              </div>
              {venue.description && <p className="text-sm leading-relaxed">{venue.description}</p>}
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{t.upcomingEventsTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.length === 0 && <p className="text-sm text-muted-foreground">{t.noUpcomingEvents}</p>}
                {events.map((event) => (
                  <Link
                    key={event.id}
                    to={`/evento/${event.id}`}
                    className="block rounded-md border border-border p-3 hover:border-gold/60 transition-colors"
                  >
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {formatDateTime(event.event_date)}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default VenueDetailsPage;
