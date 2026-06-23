import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const darkColors = {
  primary: '#8B5CF6',     // Vibrant Purple
  secondary: '#EC4899',   // Pink
  accent: '#10B981',      // Emerald Green
  background: '#030712',  // Deep Obsidian
  surface: '#111827',     // Dark Gray
  surfaceLight: '#1F2937', 
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  border: 'rgba(255, 255, 255, 0.08)',
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
};

export const lightColors = {
  primary: '#6D28D9',     // Slightly darker purple for contrast
  secondary: '#DB2777',   // Slightly darker pink
  accent: '#059669',      // Darker emerald green
  background: '#F3F4F6',  // Light Gray
  surface: '#FFFFFF',     // Clean White
  surfaceLight: '#E5E7EB', // Slightly darker light gray
  text: '#111827',        // Very dark gray text
  textSecondary: '#374151', // Dark gray text
  textMuted: '#6B7280',    // Gray text
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  border: 'rgba(0, 0, 0, 0.08)',
  glass: 'rgba(0, 0, 0, 0.02)',
  glassBorder: 'rgba(0, 0, 0, 0.08)',
};

// For backwards-compatibility in static contexts
export let colors = lightColors;

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  colors: typeof darkColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: lightColors,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeType>('light');
  const [currentColors, setCurrentColors] = useState(lightColors);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('appTheme');
        if (storedTheme === 'dark') {
          setTheme('dark');
          setCurrentColors(darkColors);
          colors = darkColors;
        } else {
          setTheme('light');
          setCurrentColors(lightColors);
          colors = lightColors;
        }
      } catch (e) {
        console.log('Failed to load theme settings', e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    const nextColors = nextTheme === 'light' ? lightColors : darkColors;
    setCurrentColors(nextColors);
    colors = nextColors;
    try {
      await AsyncStorage.setItem('appTheme', nextTheme);
    } catch (e) {
      console.log('Failed to save theme settings', e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: currentColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  s: 8,
  m: 12,
  l: 20,
  xl: 28,
  full: 999,
};

export const shadows = {
  premium: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  }
};
