import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

interface ThemeContextType {
  theme: 'light' | 'dark' | 'auto';
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  actualTheme: 'light' | 'dark'; // The actual computed theme after resolving 'auto'
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);

  // Function to get system preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Function to compute actual theme
  const computeActualTheme = (selectedTheme: 'light' | 'dark' | 'auto'): 'light' | 'dark' => {
    if (selectedTheme === 'auto') {
      return getSystemTheme();
    }
    return selectedTheme;
  };

  // Load theme from backend on component mount
  useEffect(() => {
    const loadThemeFromBackend = async () => {
      try {
        const { data } = await api.get('/user-preferences/display');
        const savedTheme = data.data.display?.theme || 'light';
        setTheme(savedTheme);
      } catch {
        // Error handled silently
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeFromBackend();
  }, []);

  // Update actual theme when theme changes or system preference changes
  useEffect(() => {
    const newActualTheme = computeActualTheme(theme);
    setActualTheme(newActualTheme);

    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newActualTheme);

    // Also set data attribute for CSS
    root.setAttribute('data-theme', newActualTheme);
  }, [theme]);

  // Listen for system theme changes when theme is set to 'auto'
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const newActualTheme = computeActualTheme(theme);
      setActualTheme(newActualTheme);

      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newActualTheme);
      root.setAttribute('data-theme', newActualTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const handleSetTheme = async (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);

    // Save to backend
    try {
      await api.put('/user-preferences/display', { theme: newTheme });
    } catch {
      // Error handled silently
    }
  };

  const value: ThemeContextType = {
    theme,
    setTheme: handleSetTheme,
    actualTheme,
    isLoading
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;