import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type CRMTheme = 'future' | 'light' | 'dark' | 'transparent';

interface ThemePreferenceContextValue {
  theme: CRMTheme;
  setTheme: (theme: CRMTheme) => void;
  resetTheme: () => void;
  wallpaperUrl: string | null;
  wallpaperBusy: boolean;
  uploadWallpaper: (file: File) => Promise<void>;
  removeWallpaper: () => Promise<void>;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);
const THEMES: CRMTheme[] = ['future', 'light', 'dark', 'transparent'];
const BUCKET = 'user-wallpapers';
const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1440;

const applyTheme = (theme: CRMTheme) => {
  const root = document.documentElement;
  root.classList.remove('theme-future', 'theme-light', 'theme-dark', 'theme-transparent');
  root.classList.add(`theme-${theme}`);
  root.dataset.crmTheme = theme;
};

const setWallpaperStyle = (url: string | null) => {
  const root = document.documentElement;
  if (url) {
    root.style.setProperty('--crm-wallpaper-image', 'url(\"' + url.replace(/[\"\\\\\\n\\r]/g, '') + '\")');
    // Sample a grid of pixels to select readable text for the current wallpaper.
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        let luminanceTotal = 0;
        let count = 0;
        for (let y = 2; y < 32; y += 4) {
          for (let x = 2; x < 32; x += 4) {
            const index = (y * 32 + x) * 4;
            const linear = [pixels[index], pixels[index + 1], pixels[index + 2]].map((channel) => {
              const value = channel / 255;
              return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
            });
            luminanceTotal += 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
            count += 1;
          }
        }
        root.style.setProperty('--crm-wallpaper-nav-text', count && luminanceTotal / count < 0.42 ? '#ffffff' : '#17131d');
      } catch {
        root.style.setProperty('--crm-wallpaper-nav-text', '#17131d');
      }
    };
    image.onerror = () => root.style.setProperty('--crm-wallpaper-nav-text', '#17131d');
    image.src = url;
  } else {
    root.style.removeProperty('--crm-wallpaper-image');
    root.style.removeProperty('--crm-wallpaper-nav-text');
  }
};

const compressWallpaper = async (file: File): Promise<Blob> => {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    throw new Error('Use uma imagem JPG, PNG, WebP ou AVIF. SVG e GIF não são aceitos.');
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error('A imagem original deve ter até 50 MB.');

  let bitmap: ImageBitmap | null = null;
  let source: HTMLImageElement | null = null;
  let width = 0;
  let height = 0;
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

  if ('createImageBitmap' in window) {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      width = bitmap.width;
      height = bitmap.height;
      draw = (ctx, w, h) => ctx.drawImage(bitmap!, 0, 0, w, h);
    } catch {
      // Fallback for browser/format combinations that cannot decode through createImageBitmap.
    }
  }

  if (!bitmap) {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir esta imagem.')); };
      image.src = url;
    });
    width = source.naturalWidth;
    height = source.naturalHeight;
    draw = (ctx, w, h) => ctx.drawImage(source!, 0, 0, w, h);
  }

  if (!width || !height) {
    bitmap?.close();
    throw new Error('A imagem não possui dimensões válidas.');
  }

  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    bitmap?.close();
    throw new Error('Seu navegador não conseguiu preparar a imagem.');
  }
  context.fillStyle = '#f5f3f8';
  context.fillRect(0, 0, outputWidth, outputHeight);
  draw!(context, outputWidth, outputHeight);
  bitmap?.close();

  let quality = 0.84;
  let blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Falha ao converter imagem para WebP.')), 'image/webp', quality)
  );
  while (blob.size > MAX_OUTPUT_BYTES && quality > 0.5) {
    quality -= 0.1;
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Falha ao compactar imagem.')), 'image/webp', quality)
    );
  }
  canvas.width = 1;
  canvas.height = 1;
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error('Esta imagem continua muito grande após compactação. Escolha outra imagem.');
  return blob;
};

export const ThemePreferenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<CRMTheme>('future');
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [wallpaperBusy, setWallpaperBusy] = useState(false);

  const wallpaperKey = user?.id ? `future-vision-wallpaper:${user.id}` : null;
  const themeKey = user?.id ? `future-vision-theme:${user.id}` : null;

  useEffect(() => {
    let saved: CRMTheme = 'future';
    if (themeKey) {
      try {
        const candidate = window.localStorage.getItem(themeKey);
        if (candidate && THEMES.includes(candidate as CRMTheme)) saved = candidate as CRMTheme;
      } catch { /* armazenamento local indisponível */ }
    }
    setThemeState(saved);
    applyTheme(saved);
  }, [themeKey]);

  useEffect(() => {
    let cancelled = false;
    const loadWallpaper = async () => {
      setWallpaperUrl(null);
      setWallpaperStyle(null);
      if (!user?.id || !wallpaperKey) return;
      let path: string | null = null;
      try { path = window.localStorage.getItem(wallpaperKey); } catch { /* storage indisponível */ }
      if (!path || !path.startsWith(`${user.id}/`)) return;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
      if (cancelled || error || !data?.signedUrl) return;
      setWallpaperUrl(data.signedUrl);
      setWallpaperStyle(data.signedUrl);
    };
    void loadWallpaper();
    return () => { cancelled = true; };
  }, [user?.id, wallpaperKey]);

  const setTheme = useCallback((nextTheme: CRMTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    if (themeKey) {
      try { window.localStorage.setItem(themeKey, nextTheme); } catch { /* aplica na sessão mesmo sem storage */ }
    }
  }, [themeKey]);

  const resetTheme = useCallback(() => setTheme('future'), [setTheme]);

  const uploadWallpaper = useCallback(async (file: File) => {
    if (!user?.id || !wallpaperKey) throw new Error('Entre novamente na sua conta para personalizar o papel de parede.');
    setWallpaperBusy(true);
    try {
      const compressed = await compressWallpaper(file);
      const path = `${user.id}/wallpaper.webp`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
      if (signedError || !data?.signedUrl) throw signedError ?? new Error('Não foi possível preparar a visualização da imagem.');
      try { window.localStorage.setItem(wallpaperKey, path); } catch {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error('O navegador bloqueou o armazenamento local. Ative o armazenamento para salvar seu papel de parede.');
      }
      setWallpaperUrl(data.signedUrl);
      setWallpaperStyle(data.signedUrl);
      setTheme('transparent');
    } finally {
      setWallpaperBusy(false);
    }
  }, [user?.id, wallpaperKey, setTheme]);

  const removeWallpaper = useCallback(async () => {
    if (!user?.id || !wallpaperKey) return;
    let path: string | null = null;
    try { path = window.localStorage.getItem(wallpaperKey); } catch { /* storage indisponível */ }
    if (path && path.startsWith(`${user.id}/`)) {
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) throw error;
    }
    try { window.localStorage.removeItem(wallpaperKey); } catch { /* storage indisponível */ }
    setWallpaperUrl(null);
    setWallpaperStyle(null);
  }, [user?.id, wallpaperKey]);

  return (
    <ThemePreferenceContext.Provider value={{ theme, setTheme, resetTheme, wallpaperUrl, wallpaperBusy, uploadWallpaper, removeWallpaper }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
};

export const useThemePreference = () => {
  const context = useContext(ThemePreferenceContext);
  if (!context) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return context;
};
