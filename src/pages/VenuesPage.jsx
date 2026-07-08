import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Theater, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { listVenues } from '@/lib/api';
import { siteConfig } from '@/site.config';

const VenuesPage = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const t = siteConfig.texts.venues;

  useEffect(() => {
    listVenues()
      .then(setVenues)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>{t.title} — {siteConfig.identity.siteName}</title>
      </Helmet>
      <Navbar />

      <div className="container py-12 flex-1">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <h1 className="font-display text-4xl md:text-5xl mb-3 marquee-text animate-marquee-glow">{t.title}</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">{t.subtitle}</p>
        </motion.div>

        {loading && <p className="text-center text-muted-foreground">{t.loading}</p>}
        {!loading && venues.length === 0 && (
          <p className="text-center text-muted-foreground">{t.emptyState}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue, i) => {
            const cover = venue.venue_images?.[0]?.url;
            return (
              <motion.div
                key={venue.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="will-change-transform"
              >
                <Link to={`/salas/${venue.id}`}>
                  <Card className="ticket-stub hover:border-gold/60 transition-colors h-full overflow-hidden">
                    {cover ? (
                      <div className="aspect-video w-full overflow-hidden">
                        <img src={cover} alt={venue.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video w-full flex items-center justify-center bg-gradient-to-br from-accent to-muted">
                        <Theater className="h-10 w-10 text-gold" />
                      </div>
                    )}
                    <CardContent className="p-6 flex flex-col gap-2">
                      <h3 className="font-display text-xl leading-snug">{venue.name}</h3>
                      {venue.address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {venue.address}
                        </div>
                      )}
                      {venue.capacity && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {venue.capacity} butacas
                        </div>
                      )}
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
  );
};

export default VenuesPage;
