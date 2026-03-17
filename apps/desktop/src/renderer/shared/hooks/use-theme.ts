import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('auria-theme');
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch (error) {
    console.error('[Theme] Failed to read stored theme:', error);
  }

  return 'system';
}

function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem('auria-theme', theme);
  } catch (error) {
    console.error('[Theme] Failed to persist theme:', error);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (t: Theme) => {
      root.classList.remove('light', 'dark');
      
      let effectiveTheme = t;
      if (t === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      root.classList.add(effectiveTheme);
      root.style.colorScheme = effectiveTheme;
      persistTheme(t);
    };

    applyTheme(theme);

    // Watch for system preference changes if in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  return { theme, setTheme };
}
