// MemoryCover — 回忆的封面图，统一替代各处的占位。
// 优先级：真实照片 > 视频首帧（hero）/ 深色播放占位（thumb）> 这件事的插画（SceneSlot：插画图 → SVG motif）。

import React from 'react';
import { View, Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { TONE } from '../theme/tokens';
import { Icon } from './Icons';
import { useMemoryMedia } from '../lib/media';
import { useData } from '../data/DataProvider';
import { SceneSlot } from './Motifs';
import { LiveDot } from './LivePhotoImage';

function VideoFrame({ url, radius, style }) {
  const player = useVideoPlayer(url);
  return (
    <View pointerEvents="none" style={[{ backgroundColor: '#1a1a1a', borderRadius: radius, overflow: 'hidden' }, style]}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

/**
 * mode='hero'：大图区域，视频用真实首帧（会创建一个原生播放器，别用在长列表里）。
 * mode='thumb'：列表缩略图，默认视频用深色底 + 播放图标，开销小。
 * videoFrame：thumb 下也用视频真实首帧当封面（每个视频会建一个原生播放器，
 *   只在做了虚拟化的列表里开，比如回忆册 FlatList；非虚拟化的 ScrollView 别开）。
 */
export function MemoryCover({ memory, style, radius = 0, mode = 'thumb', label = '', videoFrame = false }) {
  const media = useMemoryMedia(memory?.id);
  const image = media.find(x => x.kind === 'image');
  const video = media.find(x => x.kind === 'video');
  const t = TONE[memory?.tone] || TONE.orange;
  const { allLevels } = useData();
  const level = memory ? allLevels().find(l => l.num === memory.levelNum) : null;

  if (image) {
    return (
      <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        <Image
          source={{ uri: image.url }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {image.livePhotoUrl && <LiveDot />}
      </View>
    );
  }
  if (video && (mode === 'hero' || videoFrame)) {
    return <VideoFrame url={video.url} radius={radius} style={style} />;
  }
  if (video) {
    return (
      <View style={[{
        borderRadius: radius, backgroundColor: '#2A2520',
        justifyContent: 'center', alignItems: 'center',
      }, style]}>
        <View style={{
          width: 26, height: 26, borderRadius: 13,
          backgroundColor: 'rgba(255,253,247,0.9)',
          justifyContent: 'center', alignItems: 'center',
        }}>
          {Icon.play(t.deep, 12)}
        </View>
      </View>
    );
  }
  // 无图无视频（纯文字 / 语音）：用这件事本身的插画兜底，不再是空占位卡片
  return (
    <SceneSlot
      level={level}
      tone={memory?.tone}
      size={mode === 'hero' ? 220 : 96}
      style={[{ borderRadius: radius }, style]}
    />
  );
}
