import React from 'react';
import { Link } from 'react-router-dom';
import { Theater, Ticket, Drama, Sparkles, Star, Music, Clapperboard } from 'lucide-react';
import { siteConfig } from '@/site.config';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';

// Íconos disponibles para usar como logo desde site.config.js
// (logo.iconName). Agregá más acá si querés otra opción — el nombre
// tiene que coincidir con el de https://lucide.dev/icons.
const ICONS = { Theater, Ticket, Drama, Sparkles, Star, Music, Clapperboard };

const Navbar = () => {
  const { settings } = useSiteSettings();
  const { logo, siteName: defaultSiteName } = siteConfig.identity;
  const { cartelera, salas, admin } = siteConfig.texts.navbar;

  const siteName = settings?.site_name || defaultSiteName;
  const logoUrl = settings?.logo_url;
  const LogoIcon = logo.type === 'icon' ? ICONS[logo.iconName] ?? Theater : null;

  return (
    <header className="border-b border-border/60 bg-background/70 backdrop-blur-md sticky top-0 z-40">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 group">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-7 w-7 object-contain rounded" />
          ) : logo.type === 'image' ? (
            <img src={logo.src} alt={logo.alt ?? siteName} className="h-7 w-7 object-contain" />
          ) : (
            <LogoIcon className="h-6 w-6 text-gold group-hover:animate-marquee-glow" />
          )}
          <span className="font-display text-xl tracking-wide">{siteName}</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            {cartelera}
          </Link>
          <Link to="/salas" className="hover:text-foreground transition-colors">
            {salas}
          </Link>
          <Link to="/admin" className="hover:text-foreground transition-colors">
            {admin}
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
