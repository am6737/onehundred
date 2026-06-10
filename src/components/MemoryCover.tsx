// MemoryCover — 回忆的封面图，统一替代各处的占位。
// 优先级：真实照片 > 视频首帧（hero）/ 深色播放占位（thumb）> PhotoSlot 色块占位。

import React from 'react';
import { View, Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { TONE } from '../theme/tokens';
import { Icon, PhotoSlot } from './Icons';
import { useMemoryMedia } from '../lib/media';

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
 * mode='thumb'：列表缩略图，视频用深色底 + 播放图标，开销小。
 */
export function MemoryCover({ memory, style, radius = 0, mode = 'thumb', label = '' }) {
  const media = useMemoryMedia(memory?.id);
  const image = media.find(x => x.kind === 'image');
  const video = media.find(x => x.kind === 'video');
  const t = TONE[memory?.tone] || TONE.orange;

  if (image) {
    return (
      <Image
        source={{ uri: image.url }}
        style={[{ borderRadius: radius }, style]}
        resizeMode="cover"
      />
    );
  }
  if (video && mode === 'hero') {
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
  return <PhotoSlot tone={memory?.tone} radius={radius} label={label} style={style} />;
}
