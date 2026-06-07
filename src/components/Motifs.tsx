import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path, Rect, Ellipse, Line, G } from 'react-native-svg';

const MOTIF_COLORS = {
  orange: { bg: '#F4D9BE', fg: '#DE8C57' },
  green:  { bg: '#D6E0CE', fg: '#5E7C61' },
  pink:   { bg: '#F0D6D6', fg: '#D2929A' },
};

function Envelope({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={8} y={16} width={48} height={32} rx={4} fill={color} opacity={0.3} />
      <Path d="M8 18l24 16 24-16" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Bowl({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M12 28c0 14 10 22 20 22s20-8 20-22z" fill={color} opacity={0.3} />
      <Path d="M8 28h48" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M24 18c0-4 2-6 2-10" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M32 18c0-4 2-6 2-10" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M40 18c0-4 2-6 2-10" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Camera({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={8} y={20} width={48} height={32} rx={6} fill={color} opacity={0.3} />
      <Circle cx={32} cy={36} r={10} stroke={color} strokeWidth={2.5} fill="none" />
      <Rect x={22} y={14} width={20} height={8} rx={3} fill={color} opacity={0.3} />
    </Svg>
  );
}

function Sun({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={12} fill={color} opacity={0.3} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => {
        const rad = (a * Math.PI) / 180;
        const x1 = 32 + Math.cos(rad) * 16;
        const y1 = 32 + Math.sin(rad) * 16;
        const x2 = 32 + Math.cos(rad) * 22;
        const y2 = 32 + Math.sin(rad) * 22;
        return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
      })}
    </Svg>
  );
}

function Sprout({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 54V30" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M32 30c-8-12-20-10-20-2s12 14 20 2z" fill={color} opacity={0.3} />
      <Path d="M32 36c8-12 20-10 20-2s-12 14-20 2z" fill={color} opacity={0.3} />
    </Svg>
  );
}

function Music({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={20} cy={46} r={8} fill={color} opacity={0.3} />
      <Circle cx={44} cy={42} r={8} fill={color} opacity={0.3} />
      <Line x1={28} y1={46} x2={28} y2={14} stroke={color} strokeWidth={2.5} />
      <Line x1={52} y1={42} x2={52} y2={10} stroke={color} strokeWidth={2.5} />
      <Path d="M28 14l24-4v8l-24 4z" fill={color} opacity={0.5} />
    </Svg>
  );
}

function Canvas({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={10} y={8} width={44} height={38} rx={3} fill={color} opacity={0.2} stroke={color} strokeWidth={2} />
      <Line x1={22} y1={56} x2={14} y2={46} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={42} y1={56} x2={50} y2={46} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={26} cy={24} r={5} fill={color} opacity={0.4} />
      <Path d="M10 36l14-10 10 8 10-6 10 8" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Pin({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 56s-16-12-16-24a16 16 0 0 1 32 0c0 12-16 24-16 24z" fill={color} opacity={0.3} />
      <Circle cx={32} cy={30} r={6} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function Rain({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M14 30a14 14 0 0 1 27-4 10 10 0 0 1 9 10H14z" fill={color} opacity={0.3} />
      {[20, 32, 44].map((x, i) => (
        <Line key={i} x1={x} y1={40} x2={x - 4} y2={52} stroke={color} strokeWidth={2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

function Cup({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M16 22h28v24c0 6-6 10-14 10s-14-4-14-10z" fill={color} opacity={0.3} />
      <Path d="M44 28c6 0 10 4 10 8s-4 8-10 8" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M24 14c0-4 2-6 4-8" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M32 14c0-4 2-6 4-8" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Star({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 8l7 14 16 2-12 11 3 16-14-7-14 7 3-16L9 24l16-2z" fill={color} opacity={0.3} stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

const MOTIF_MAP = {
  envelope: Envelope,
  bowl: Bowl,
  camera: Camera,
  sun: Sun,
  sprout: Sprout,
  music: Music,
  canvas: Canvas,
  pin: Pin,
  rain: Rain,
  cup: Cup,
  star: Star,
};

const MOTIF_RULES = [
  { keywords: ['早餐','做饭','厨房','菜','食'], motif: 'bowl' },
  { keywords: ['信','写','笔','封存','胶囊'], motif: 'envelope' },
  { keywords: ['拍','照片','摄影'], motif: 'camera' },
  { keywords: ['阳光','早晨','太阳','公园','户外'], motif: 'sun' },
  { keywords: ['种','植物','花','成长','身高','脚印'], motif: 'sprout' },
  { keywords: ['唱歌','音乐','歌'], motif: 'music' },
  { keywords: ['画','手工','折纸','创作','故事书'], motif: 'canvas' },
  { keywords: ['地图','地方','去','野餐','出去'], motif: 'pin' },
  { keywords: ['雨','水','踩水'], motif: 'rain' },
  { keywords: ['茶','咖啡','下午','星星','晚上','帐篷'], motif: 'cup' },
  { keywords: ['化妆','老师','决定','采访','工作'], motif: 'star' },
];

export function motifForLevel(level) {
  if (!level || !level.title) return 'star';
  for (const rule of MOTIF_RULES) {
    for (const kw of rule.keywords) {
      if (level.title.includes(kw) || (level.how && level.how.includes(kw))) {
        return rule.motif;
      }
    }
  }
  return 'star';
}

export function SceneSlot({ tone = 'orange', level, size = 120, style = undefined }) {
  const colors = MOTIF_COLORS[tone] || MOTIF_COLORS.orange;
  const motifKey = motifForLevel(level);
  const MotifComponent = MOTIF_MAP[motifKey] || Star;

  return (
    <View style={[{
      width: size,
      height: size,
      borderRadius: size * 0.2,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
    }, style]}>
      <MotifComponent size={size * 0.7} color={colors.fg} />
    </View>
  );
}

export { MOTIF_MAP };
