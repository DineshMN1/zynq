'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Determine the initial theme for the application.
 *
 * If running in a browser and localStorage contains a 'theme' value of `'light'` or `'dark'`,
 * that value is returned; otherwise `'dark'` is returned.
 *
 * @returns `'light'` or `'dark'` — the initial theme to use
 */
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return 'dark';
}

/**
 * Provides theme state and control functions to descendant components via ThemeContext.
 *
 * Synchronizes initial state with an inline DOM class if present, persists changes to localStorage,
 * and updates the document root's `dark` class when the theme changes.
 *
 * @param children - React nodes rendered inside the provider
 * @returns A ThemeContext.Provider element that supplies `{ theme, setTheme, toggleTheme }` to descendants
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // Sync with whatever the inline script already applied
    const isDark = document.documentElement.classList.contains('dark');
    setThemeState(isDark ? 'dark' : 'light');
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}