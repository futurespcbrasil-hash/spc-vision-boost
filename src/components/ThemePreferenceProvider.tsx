import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type CRMTheme = 'future' | 'light' | 'dark' | 'transparent';

interface ThemePreferenceContextValue {
  theme: CRMTheme;
  setTheme: (theme: CRMTheme) => void;
  resetTheme: () => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);
const THEMES: CRMTheme[] = ['future', 'light', 'dark', 'transparent'];

const applyTheme = (theme: CRMTheme) => {
  const root = document.documentElement;
  root.classList.remove('theme-future', 'theme-light', 'theme-dark', 'theme-transparent');
  root.classList.add(`theme-${theme}`);
  root.dataset.crmTheme = theme;
};

export const ThemePreferenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<CRMTheme>('future');

  useEffect(() => {
    let saved: CRMTheme = 'future';
    if (user?.id) {
      try {
        const candidate = window.localStorage.getItem(`future-vision-theme:${user.id}`);
        if (candidate && THEMES.includes(candidate as CRMTheme)) saved = candidate as CRMTheme;
      } catch {
        // Storage can be disabled by the browser; keep the default theme for this session.
      }
    }
    setThemeState(saved);
    applyTheme(saved);
  }, [user?.id]);

  const setTheme = useCallback((nextTheme: CRMTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    if (user?.id) {
      try {
        window.localStorage.setItem(`future-vision-theme:${user.id}`, nextTheme);
      } catch {
        // The selected theme still applies for the current session if storage is unavailable.
      }
    }
  }, [user?.id]);

  const resetTheme = useCallback(() => setTheme('future'), [setTheme]);

  return (
    <ThemePreferenceContext.Provider value={{ theme, setTheme, resetTheme }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
};

export const useThemePreference = () => {
  const context = useContext(ThemePreferenceContext);
  if (!context) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return context;
};
