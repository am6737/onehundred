import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Ellipse, Line, G } from 'react-native-svg';

/* ── Icon library ─────────────────────────────────────────────── */

export const Icon = {
  mic: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M5 11a7 7 0 0 0 14 0" />
      <Path d="M12 18v3" />
    </Svg>
  ),

  camera: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </Svg>
  ),

  pen: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <Path d="M15 5l4 4" />
    </Svg>
  ),

  chevL: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  ),

  chevDown: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  ),

  share: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Path d="M16 6l-4-4-4 4" />
      <Path d="M12 2v13" />
    </Svg>
  ),

  book: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Svg>
  ),

  play: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
      <Path d="M6 3l15 9-15 9V3z" />
    </Svg>
  ),

  video: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={2} y={5} width={14} height={14} rx={2} />
      <Path d="M16 10l6-3v10l-6-3" />
    </Svg>
  ),

  plus: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </Svg>
  ),

  check: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  ),

  seed: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22V10" />
      <Path d="M6 14c0-4 3-7 6-8" />
      <Path d="M18 14c0-4-3-7-6-8" />
      <Path d="M12 10c-2-4-5-6-8-6 0 6 3 10 8 10z" />
      <Path d="M12 10c2-4 5-6 8-6 0 6-3 10-8 10z" />
    </Svg>
  ),

  lock: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={11} width={18} height={11} rx={2} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  ),

  gear: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  ),

  chevR: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  ),

  info: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={12} y1={16} x2={12} y2={12} />
      <Line x1={12} y1={8} x2={12.01} y2={8} />
    </Svg>
  ),

  bell: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  ),

  users: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),

  download: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Path d="M12 15V3" />
    </Svg>
  ),

  eye: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  ),

  menu: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1={3} y1={6} x2={21} y2={6} />
      <Line x1={3} y1={12} x2={21} y2={12} />
      <Line x1={3} y1={18} x2={21} y2={18} />
    </Svg>
  ),

  shuffle: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 3h5v5" />
      <Path d="M4 20L21 3" />
      <Path d="M21 16v5h-5" />
      <Path d="M15 15l6 6" />
      <Path d="M4 4l5 5" />
    </Svg>
  ),

  moon: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  ),

  pin: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  ),

  shieldCheck: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  ),

  phone: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={2} width={14} height={20} rx={2} />
      <Line x1={12} y1={18} x2={12.01} y2={18} />
    </Svg>
  ),

  logout: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Path d="M21 12H9" />
    </Svg>
  ),

  mail: (c = '#3A332B', s = 22) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
    </Svg>
  ),
};

/* ── Tone colour palettes ─────────────────────────────────────── */

const PHOTO_TONES = {
  orange: ['#F4D9BE', '#E9C49B'],
  green:  ['#D6E0CE', '#BFCDB3'],
  pink:   ['#F0D6D6', '#E3BEC0'],
};

const AVATAR_TONES = {
  orange: ['#F4D9BE', '#7A4A24'],
  green:  ['#D6E0CE', '#395239'],
  pink:   ['#F0D6D6', '#7C4248'],
};

/* ── PhotoSlot ────────────────────────────────────────────────── */

export function PhotoSlot({ tone = 'orange', label = '照片', radius = 22, style, children = null, striped = true }) {
  const colors = PHOTO_TONES[tone] || PHOTO_TONES.orange;
  const stripeCount = 12;

  return (
    <View
      style={[
        photoStyles.container,
        { borderRadius: radius, backgroundColor: colors[0], overflow: 'hidden' },
        style,
      ]}
    >
      {/* Alternating horizontal stripes（striped=false 时纯色底，文字更清楚） */}
      {striped && (
        <View style={StyleSheet.absoluteFill}>
          {Array.from({ length: stripeCount }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: i % 2 === 0 ? colors[0] : colors[1],
              }}
            />
          ))}
        </View>
      )}

      {/* Content or label */}
      {children || (
        <View style={photoStyles.labelWrap}>
          <Text style={[photoStyles.label, { color: colors[1] }]}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const photoStyles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 4 / 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelWrap: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.6,
  },
});

/* ── KidAvatar ────────────────────────────────────────────────── */

function kidInitial(name) {
  if (!name || name.length === 0) return '?';
  const first = name.charAt(0);
  // If starts with a letter (A-Z, a-z), uppercase it
  if (/[A-Za-z]/.test(first)) {
    return first.toUpperCase();
  }
  // If starts with 小/阿/大, use the second character
  if ('小阿大'.includes(first) && name.length > 1) {
    return name.charAt(1);
  }
  // Otherwise, first character
  return first;
}

export function KidAvatar({ name = '', tone = 'orange', size = 36, ring = false }) {
  const colors = AVATAR_TONES[tone] || AVATAR_TONES.orange;
  const bg = colors[0];
  const fg = colors[1];
  const initial = kidInitial(name);

  return (
    <View
      style={[
        avatarStyles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
        ring && {
          borderWidth: 2,
          borderColor: fg,
        },
      ]}
    >
      <Text
        style={[
          avatarStyles.initial,
          {
            color: fg,
            fontSize: size * 0.44,
            lineHeight: size,
          },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
