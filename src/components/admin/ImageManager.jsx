import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Image, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

/**
 * Administrador genérico de imágenes: subida, miniaturas, reorden y
 * borrado. La primera imagen (más a la izquierda) es la "portada" —
 * la que se usa en la cartelera / listado público.
 *
 * Props:
 *   images: [{ id, url, sort_order }]
 *   maxImages: número máximo de imágenes permitidas
 *   onUpload(file): async -> sube una imagen nueva
 *   onDelete(image): async -> borra una imagen
 *   onReorder(imageA, imageB): async -> intercambia el orden de dos imágenes
 *   coverLabel: texto del badge de portada (por defecto "Portada")
 */
const ImageManager = ({ images, maxImages, onUpload, onDelete, onReorder, coverLabel = 'Portada' }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const canAddMore = images.length < maxImages;

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Ese archivo no es una imagen', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      toast({ title: 'No pudimos subir la imagen', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (image) => {
    if (!confirm('¿Eliminar esta imagen?')) return;
    setBusyId(image.id);
    try {
      await onDelete(image);
    } catch (err) {
      toast({ title: 'No pudimos eliminar la imagen', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (image, direction) => {
    const index = images.findIndex((i) => i.id === image.id);
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    setBusyId(image.id);
    try {
      await onReorder(image, images[targetIndex]);
    } catch (err) {
      toast({ title: 'No pudimos reordenar', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {images.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay imágenes cargadas.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={cn(
              'relative rounded-lg overflow-hidden border border-border aspect-square group',
              busyId === image.id && 'opacity-50'
            )}
          >
            <img src={image.url} alt="" className="w-full h-full object-cover" />
            {index === 0 && (
              <span className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-gold text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">
                <Star className="h-2.5 w-2.5 fill-current" /> {coverLabel}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 backdrop-blur-sm px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleMove(image, 'left')}
                disabled={index === 0 || busyId === image.id}
                className="text-white/90 hover:text-gold disabled:opacity-30 p-1"
                title="Mover antes"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(image)}
                disabled={busyId === image.id}
                className="text-white/90 hover:text-destructive p-1"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(image, 'right')}
                disabled={index === images.length - 1 || busyId === image.id}
                className="text-white/90 hover:text-gold disabled:opacity-30 p-1"
                title="Mover después"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-gold/60 text-muted-foreground hover:text-gold flex flex-col items-center justify-center gap-1.5 transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="relative">
                <Image className="h-5 w-5" />
                <Plus className="h-3 w-3 absolute -right-1.5 -bottom-1.5 bg-background rounded-full" />
              </span>
            )}
            <span className="text-xs">{uploading ? 'Subiendo…' : 'Agregar'}</span>
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />

      <p className="text-xs text-muted-foreground">
        {images.length}/{maxImages} imágenes. La marcada como "{coverLabel}" es la primera de la lista — usá las
        flechas para cambiar el orden.
      </p>
    </div>
  );
};

export default ImageManager;
