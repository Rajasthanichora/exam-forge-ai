// ExamForge AI - Theme System
// Supports Light & Dark modes matching HTML design specs

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'examforge_theme_mode';

// ─── Light Theme (from HTML: slate-50 bg, indigo-600 primary) ───
export const LightColors = {
  background: '#F8FAFC',
  foreground: '#0F172A',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  popover: '#FFFFFF',
  popoverForeground: '#0F172A',
  primary: '#4F46E5',
  primaryForeground: '#FFFFFF',
  secondary: '#F1F5F9',
  secondaryForeground: '#FAFAFA',
  muted: '#F1F5F9',
  mutedForeground: '#64748B',
  accent: '#3B82F6',
  accentForeground: '#0F172A',
  destructive: '#F43F5E',
  destructiveForeground: '#FFFFFF',
  success: '#10B981',
  successForeground: '#FFFFFF',
  warning: '#F59E0B',
  warningForeground: '#FFFFFF',
  border: '#E2E8F0',
  input: '#E2E8F0',
  ring: '#4F46E5',
  sidebar: '#FFFFFF',
  sidebarForeground: '#0F172A',
  sidebarBorder: '#E2E8F0',
  tertiary: '#10B981',
};

// ─── Dark Theme (from HTML: zinc-950 bg, indigo-500 primary) ───
export const DarkColors = {
  background: '#09090B',
  foreground: '#FAFAFA',
  card: '#18181B',
  cardForeground: '#FAFAFA',
  popover: '#18181B',
  popoverForeground: '#FAFAFA',
  primary: '#6366F1',
  primaryForeground: '#FFFFFF',
  secondary: '#27272A',
  secondaryForeground: '#FAFAFA',
  muted: '#27272A',
  mutedForeground: '#A1A1AA',
  accent: '#3B82F6',
  accentForeground: '#FAFAFA',
  destructive: '#F43F5E',
  destructiveForeground: '#FFFFFF',
  success: '#10B981',
  successForeground: '#FFFFFF',
  warning: '#F59E0B',
  warningForeground: '#FFFFFF',
  border: '#27272A',
  input: '#27272A',
  ring: '#6366F1',
  sidebar: '#111113',
  sidebarForeground: '#FAFAFA',
  sidebarBorder: '#27272A',
  tertiary: '#10B981',
};

// ─── Shared constants ───
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  title: 32,
  display: 40,
};

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  full: 999,
};

// ─── Theme Context ───
type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  isDark: boolean;
  mode: ThemeMode;
  colors: typeof LightColors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  FontSize: typeof FontSize;
  Spacing: typeof Spacing;
  BorderRadius: typeof BorderRadius;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  mode: 'dark',
  colors: DarkColors,
  toggleTheme: () => {},
  setThemeMode: () => {},
  FontSize,
  Spacing,
  BorderRadius,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setMode(stored);
        }
      } catch {}
    })();
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const setThemeMode = useCallback((m: ThemeMode) => {
    setMode(m);
    AsyncStorage.setItem(THEME_STORAGE_KEY, m).catch(() => {});
  }, []);

  const value: ThemeContextType = {
    isDark: mode === 'dark',
    mode,
    colors: mode === 'dark' ? DarkColors : LightColors,
    toggleTheme,
    setThemeMode,
    FontSize,
    Spacing,
    BorderRadius,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Backward-compatible default ───
// These match the original dark theme for components not yet updated.
// New components should use useTheme() instead.
export const Colors = DarkColors;
