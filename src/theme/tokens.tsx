import { createContext, useContext, useState, useMemo } from 'react';

/* ── colour presets ── */

export const THEME_PRESETS = {
  '融合·暖': { cream:'#FAF3E6', paper:'#FFFDF7', sand:'#F2E7D2', ink:'#3A332B', inkSoft:'#8B8175', line:'#ECE2D0' },
  '多邻国·亮': { cream:'#FFF6E5', paper:'#FFFFFF', sand:'#FCE7C4', ink:'#43382C', inkSoft:'#9C8F7C', line:'#F4E6CF' },
  '手绘·纸': { cream:'#F1E7D3', paper:'#FAF1E0', sand:'#E6D7BD', ink:'#3F3427', inkSoft:'#897D69', line:'#DFD2B9' },
};

export const DARK_PALETTE = {
  cream:'#1B1712', paper:'#251F18', sand:'#33291E', ink:'#F0E7D7', inkSoft:'#A89C8A', line:'#392F25',
};

export const COLORS = {
  orange: '#DE8C57',
  green:  '#5E7C61',
  pink:   '#D2929A',
};

export const TONE = {
  orange: { soft:'#F4D9BE', deep:'#DE8C57', ink:'#7A4A24' },
  green:  { soft:'#D6E0CE', deep:'#5E7C61', ink:'#395239' },
  pink:   { soft:'#F0D6D6', deep:'#D2929A', ink:'#7C4248' },
};

export const FONTS = {
  head: 'ZCOOLKuaiLe',
  body: 'NotoSerifSC',
  hand: 'MaShanZheng',
};

/* ── createTheme ── */

export function createTheme(presetName, isDark, accent) {
  const base = isDark
    ? DARK_PALETTE
    : (THEME_PRESETS[presetName] || THEME_PRESETS['融合·暖']);

  const accentTone = TONE[accent] || TONE.orange;
  const accentColor = COLORS[accent] || COLORS.orange;

  return {
    ...base,
    accent: accentColor,
    accentSoft: accentTone.soft,
    accentDeep: accentTone.deep,
    accentInk: accentTone.ink,
    danger: isDark ? '#E0867A' : '#C25B4E',
    fonts: FONTS,
    isDark: !!isDark,
    presetName: isDark ? 'dark' : presetName,
  };
}

/* ── ThemeContext ── */

const ThemeContext = createContext(null);

export function ThemeProvider({ children, initialPreset, initialDark = false, initialAccent }) {
  const [preset, setPreset] = useState(initialPreset || '融合·暖');
  const [isDark, setIsDark] = useState(!!initialDark);
  const [accent, setAccent] = useState(initialAccent || 'orange');

  const theme = useMemo(
    () => createTheme(preset, isDark, accent),
    [preset, isDark, accent],
  );

  const setTheme = useMemo(() => ({
    setPreset,
    setIsDark,
    setAccent,
  }), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export { ThemeContext };
