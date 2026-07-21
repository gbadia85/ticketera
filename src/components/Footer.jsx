import React from 'react';
import { Facebook, Globe, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, Youtube } from 'lucide-react';
import { siteConfig } from '@/site.config';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';

// Mapeo de plataforma -> ícono. "x" y "tiktok" y "threads" no tienen un
// ícono de marca dedicado en esta versión de lucide-react, así que usan
// un ícono genérico (Globe) para no romper si no existen.
const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  x: Globe,
  youtube: Youtube,
  tiktok: Globe,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
  threads: Globe,
};

const whatsappUrl = (phone) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`;

const Footer = () => {
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || siteConfig.identity.siteName;
  const { text, copyright, contact, social } = siteConfig.footer;
  const activeSocial = (social ?? []).filter((s) => s.url || s.platform === 'whatsapp');
  const hasContact = contact?.phone || contact?.email || contact?.address;

  return (
    <footer className="border-t border-border/60 bg-background/70 backdrop-blur-md mt-16">
      <div className="container py-10 flex flex-col md:flex-row md:items-start md:justify-between gap-8">
        <div className="max-w-sm">
          <span className="font-display text-lg">{siteName}</span>
          {text && <p className="text-sm text-muted-foreground mt-2">{text}</p>}
        </div>

        {hasContact && (
          <div className="space-y-2 text-sm text-muted-foreground">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Phone className="h-4 w-4" /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" /> {contact.email}
              </a>
            )}
            {contact.address && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {contact.address}
              </p>
            )}
          </div>
        )}

        {activeSocial.length > 0 && (
          <div className="flex items-center gap-3">
            {activeSocial.map(({ platform, url }) => {
              const Icon = SOCIAL_ICONS[platform] ?? Globe;
              const href = platform === 'whatsapp' && !url && contact?.phone ? whatsappUrl(contact.phone) : url;
              if (!href) return null;
              return (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={platform}
                  className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-gold hover:border-gold/60 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        )}
      </div>

      {copyright && (
        <div className="border-t border-border/60">
          <p className="container py-4 text-xs text-muted-foreground text-center">
            {copyright.replace('{year}', String(new Date().getFullYear()))}
          </p>
        </div>
      )}
    </footer>
  );
};

export default Footer;
