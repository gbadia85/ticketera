import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSiteSettings } from '@/lib/api';
import { applySiteSettingsTheme } from '@/lib/theme';

const SiteSettingsContext = createContext({ settings: null, loading: true, reload: () => {} });

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await getSiteSettings();
      setSettings(data);
      applySiteSettingsTheme(data);
      if (data?.logo_url) {
        const link = document.querySelector('link[rel="icon"]') || document.createElement('link');
        link.rel = 'icon';
        link.href = data.logo_url;
        document.head.appendChild(link);
      }
    } catch {
      // Si falla (ej: todavía no corriste la migración 0008), el sitio
      // sigue andando con los valores por defecto de site.config.js.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, reload }}>{children}</SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => useContext(SiteSettingsContext);
