import React, { useEffect, useState } from 'react';
import { Image, Palette, RotateCcw, Save, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { updateSiteSettings, uploadSiteLogo } from '@/lib/api';
import { siteConfig } from '@/site.config';

const COLOR_FIELDS = [
  { key: 'color_primary', label: 'Color principal', fallback: siteConfig.colors.primary },
  { key: 'color_primary_foreground', label: 'Texto sobre el color principal', fallback: siteConfig.colors.primaryForeground },
  { key: 'color_secondary', label: 'Color secundario', fallback: siteConfig.colors.secondary },
  { key: 'color_secondary_foreground', label: 'Texto sobre el color secundario', fallback: siteConfig.colors.secondaryForeground },
  { key: 'color_background', label: 'Fondo general del sitio', fallback: siteConfig.colors.background },
];

const SiteSettingsTab = () => {
  const { toast } = useToast();
  const { settings, loading, reload } = useSiteSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (loading || !form) {
    return <p className="text-sm text-muted-foreground">Cargando personalización…</p>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSiteSettings({
        site_name: form.site_name || null,
        logo_url: form.logo_url || null,
        color_primary: form.color_primary || null,
        color_primary_foreground: form.color_primary_foreground || null,
        color_secondary: form.color_secondary || null,
        color_secondary_foreground: form.color_secondary_foreground || null,
        color_background: form.color_background || null,
      });
      await reload(); // aplica los colores nuevos al toque, en toda la app
      toast({ title: 'Personalización guardada' });
    } catch (err) {
      toast({ title: 'No pudimos guardar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Ese archivo no es una imagen', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadSiteLogo(file);
      setForm({ ...form, logo_url: url });
    } catch (err) {
      toast({ title: 'No pudimos subir el logo', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleResetColors = () => {
    setForm({
      ...form,
      color_primary: null,
      color_primary_foreground: null,
      color_secondary: null,
      color_secondary_foreground: null,
      color_background: null,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Type className="h-5 w-5" /> Nombre e identidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del sitio</Label>
            <Input
              value={form.site_name ?? ''}
              onChange={(e) => setForm({ ...form, site_name: e.target.value })}
              placeholder={siteConfig.identity.siteName}
            />
            <p className="text-xs text-muted-foreground">Si lo dejás vacío, se usa "{siteConfig.identity.siteName}".</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image className="h-5 w-5" /> Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg border border-border flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground text-center px-1">Sin logo</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-block">
                <span className="text-sm rounded-md border border-input px-4 py-2 cursor-pointer hover:bg-accent inline-block">
                  {uploadingLogo ? 'Subiendo…' : 'Subir logo'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
              {form.logo_url && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, logo_url: null })}
                  className="block text-xs text-muted-foreground hover:text-destructive"
                >
                  Quitar logo (usar el ícono por defecto)
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Recomendado: imagen cuadrada, fondo transparente (PNG), al menos 128×128px.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" /> Colores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se aplican en todo el sitio al instante al guardar (botones, acentos, brillos de fondo). Dejar un color
            vacío usa el valor por defecto de <code className="text-xs">site.config.js</code>.
          </p>
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <input
                type="color"
                value={form[field.key] || field.fallback}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="h-9 w-9 rounded border border-border cursor-pointer bg-transparent shrink-0"
              />
              <span className="flex-1 text-sm">{field.label}</span>
              <Input
                value={form[field.key] ?? ''}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value || null })}
                placeholder={field.fallback}
                className="w-28 h-9 font-mono text-xs"
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={handleResetColors}>
            <RotateCcw className="h-4 w-4 mr-2" /> Restablecer colores por defecto
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        <Save className="h-4 w-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </div>
  );
};

export default SiteSettingsTab;
