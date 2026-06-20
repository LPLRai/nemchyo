// Central visual theme for Nemchyo. Change these tokens and the whole app
// restyles consistently — colors, depth, spacing.
export const theme = {
  primary: '#6359F2', // brand indigo-violet — buttons, my bubbles, accents
  primaryDark: '#4C42D4', // headers / pressed states
  primarySoft: '#ECEBFD', // tints, selected rows, reaction chips
  accent: '#9B6CF2',
  bg: '#F5F4FB', // app background
  chatBg: '#ECEAF6', // conversation "wallpaper"
  card: '#FFFFFF',
  bubbleTheirs: '#FFFFFF',
  text: '#1E2233',
  textMuted: '#6B7280',
  textFaint: '#9AA1B2',
  border: '#E8E7F1',
  online: '#22C55E',
  danger: '#EF4444',
} as const;

// Soft, layered shadows tinted toward the brand so cards feel warm, not gray.
export const shadow = {
  sm: { shadowColor: '#2A1F6E', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  md: { shadowColor: '#2A1F6E', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  lg: { shadowColor: '#2A1F6E', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 9 },
} as const;
