// Central visual theme for Nemchyo — now scheme-aware (light + soft dark).
//
// Light values are unchanged from before, so light mode looks pixel-identical.
// Dark mode is additive. Screens read colors via `useColors()` / `useThemedStyles()`
// so they restyle live when the user flips the toggle (persisted in AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

export const lightColors = {
  primary: '#6359F2', // brand indigo-violet — buttons, my bubbles, accents
  primaryDark: '#4C42D4', // headers / pressed states
  primarySoft: '#ECEBFD', // tints, selected rows, reaction chips
  accent: '#9B6CF2',
  bg: '#F5F4FB', // app background
  chatBg: '#ECEAF6', // conversation "wallpaper"
  card: '#FFFFFF',
  sheet: '#FFFFFF', // bottom sheets / modals
  bubbleTheirs: '#FFFFFF',
  inputBg: '#F0F0F7', // chat composer field
  field: '#F4F4FA', // form inputs
  text: '#1E2233',
  textMuted: '#6B7280',
  textFaint: '#9AA1B2',
  onPrimary: '#FFFFFF', // text/icons on a primary fill
  border: '#E8E7F1',
  online: '#22C55E',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2', // recording pill, destructive backgrounds
} as const;

export type Colors = Record<keyof typeof lightColors, string>;

// Soft, warm dark theme — deep indigo-charcoal, never pure black, brand-tinted.
export const darkColors: Colors = {
  primary: '#6359F2',
  primaryDark: '#1B1925', // dark header
  primarySoft: '#2A2540',
  accent: '#A98BF5',
  bg: '#141320',
  chatBg: '#0E0D16',
  card: '#1E1C2B',
  sheet: '#1E1C2B',
  bubbleTheirs: '#262333',
  inputBg: '#252233',
  field: '#252233',
  text: '#ECEAF6',
  textMuted: '#A29EB5',
  textFaint: '#6E6A7E',
  onPrimary: '#FFFFFF',
  border: '#2A2740',
  online: '#34D27B',
  danger: '#F87171',
  dangerSoft: '#3A2230',
};

// Backward-compatible static export (light palette). Safe for module-level use
// of brand colors that are identical across schemes (e.g. `theme.primary`).
export const theme = lightColors;

// Soft, layered shadows tinted toward the brand so cards feel warm, not gray.
export const shadow = {
  sm: { shadowColor: '#2A1F6E', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  md: { shadowColor: '#2A1F6E', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  lg: { shadowColor: '#2A1F6E', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 9 },
} as const;

type Scheme = 'light' | 'dark';
const STORAGE_KEY = 'nemchyo_theme';

const Ctx = createContext<{ scheme: Scheme; colors: Colors; toggle: () => void; setScheme: (s: Scheme) => void }>({
  scheme: 'light',
  colors: lightColors,
  toggle: () => {},
  setScheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the device's scheme, then override with the saved choice (async).
  const [scheme, setS] = useState<Scheme>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark') setS(v);
      })
      .catch(() => {});
  }, []);

  const setScheme = (s: Scheme) => {
    setS(s);
    AsyncStorage.setItem(STORAGE_KEY, s).catch(() => {});
  };

  const value = useMemo(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      setScheme,
      toggle: () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [scheme]
  );

  return createElement(Ctx.Provider, { value }, children);
}

export function useTheme() {
  return useContext(Ctx);
}
export function useColors(): Colors {
  return useContext(Ctx).colors;
}
export function useThemedStyles<T>(factory: (c: Colors) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors]);
}
