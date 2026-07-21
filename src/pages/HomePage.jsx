import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin, Theater } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatDateTime } from '@/lib/utils';
import { listPublicEvents } from '@/lib/api';
import { siteConfig } from '@/site.config';

const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVenueId, setSelectedVenueId] = useState(null);

  const t = siteConfig.texts.home;

  useEffect(() => {
    listPublicEvents()
      .then(setEvents)
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  const venues = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (e.venues && !map.has(e.venues.id)) map.set(e.venues.id, e.venues);
    }
    return Array.from(map.values());
  }, [events]);

  const filteredEvents = selectedVenueId ? events.filter((e) => e.venues?.id === selectedVenueId) : events;

  return (
    <>
      <Helmet>
        <title>{siteConfig.identity.metaTitle}</title>
        <meta name="description" content={siteConfig.identity.metaDescription} />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <div className="container py-12 flex-1">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mb-10 text-center overflow-hidden rounded-2xl py-10">
            <img
              src="/images/hero-glow.jpg"
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen pointer-events-none select-none"
            />
            <div className="relative">
              <h1 className="font-display text-4xl md:text-5xl mb-3 marquee-text animate-marquee-glow">{t.title}</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">{t.subtitle}</p>
            </div>
          </motion.div>

          {venues.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              <button
                onClick={() => setSelectedVenueId(null)}
                className={cn(
                  'text-sm px-4 py-2 rounded-full border transition-colors',
                  selectedVenueId === null ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted-foreground'
                )}
              >
                {t.allVenuesFilter}
              </button>
              {venues.map((venue) => (
                <button
                  key={venue.id}
                  onClick={() => setSelectedVenueId(venue.id)}
                  className={cn(
                    'text-sm px-4 py-2 rounded-full border transition-colors flex items-center gap-1.5',
                    selectedVenueId === venue.id
                      ? 'border-gold text-gold bg-gold/10'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" /> {t.venueFilterPrefix} {venue.name}
                </button>
              ))}
            </div>
          )}

          {loading && <p className="text-center text-muted-foreground">{t.loading}</p>}
          {error && <p className="text-center text-destructive">{t.loadError}</p>}
          {!loading && !error && filteredEvents.length === 0 && (
            <p className="text-center text-muted-foreground">
              {selectedVenueId ? t.emptyStateFiltered : t.emptyState}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, i) => {
              const cover = event.event_images?.[0]?.url;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="will-change-transform"
                >
                  <Link to={`/evento/${event.id}`}>
                    <Card className="ticket-stub hover:border-gold/60 transition-colors h-full overflow-hidden relative">
                      {event.sold_out_status?.is_sold_out && (
                        <span className="absolute top-3 right-3 z-10 bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full rotate-3 shadow-lg">
                          AGOTADO
                        </span>
                      )}
                      {cover ? (
                        <div className="aspect-video w-full overflow-hidden">
                          <img src={cover} alt={event.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-video w-full flex items-center justify-center bg-gradient-to-br from-accent to-muted">
                          <Theater className="h-10 w-10 text-gold" />
                        </div>
                      )}
                      <CardContent className="p-6 flex flex-col gap-3">
                        <h3 className="font-display text-xl leading-snug">{event.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          {formatDateTime(event.event_date)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {event.venues?.name}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default HomePage;
