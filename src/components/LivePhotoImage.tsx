// LivePhotoImage — 实况照片展示。
// iOS 上长按播放配对短视频；其它平台 / 没有配对视频 / 原生模块还没装进二进制时，
// 自动退化为静态图，不会崩。
//
// 注意：原生 PHLivePhoto 只认本地资源文件（withResourceFileURLs），
// 远端签名 URL 必须先下载到本地缓存再交给它（见 RemoteLivePhotoImage）。
// 记录页 picker 拿到的本来就是本地文件，直接用 LivePhotoImage 即可。

import React, { useEffect, useState } from 'react';
import { View, Image, Text, Platform, StyleSheet } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';

// 懒加载：dev client 还没重建（原生没链接）时 require 不抛，退化为静态图。
let LivePhotoView: any = null;
try {
  LivePhotoView = require('expo-live-photo').LivePhotoView;
} catch {
  LivePhotoView = null;
}

// LivePhotoView.isAvailable() 只看 EXPO_OS，不校验原生是否真链接进来；
// 再用 requireOptionalNativeModule 确认模块在二进制里（没重建时它为 null），避免渲染空白。
export const livePhotoSupported: boolean =
  Platform.OS === 'ios' &&
  !!LivePhotoView &&
  !!requireOptionalNativeModule('ExpoLivePhoto') &&
  (() => {
    try {
      return !!LivePhotoView.isAvailable?.();
    } catch {
      return false;
    }
  })();

export function LiveBadge({ placement = 'top-left' }: { placement?: 'top-left' | 'bottom-left' }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.badge, placement === 'bottom-left' ? styles.badgeBottom : styles.badgeTop]}
    >
      <View style={styles.ring}>
        <View style={styles.dot} />
      </View>
      <Text style={styles.badgeText}>实况</Text>
    </View>
  );
}

// 小尺寸「实况」标记（一个白色圆环），用于列表封面 / 缩略图等放不下整枚药丸的地方。
export function LiveDot({ size = 13, placement = 'top-left' }: { size?: number; placement?: 'top-left' | 'top-right' }) {
  const inner = Math.max(3, Math.round(size * 0.3));
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 6,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        placement === 'top-right' ? { right: 6 } : { left: 6 },
      ]}
    >
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: '#FFFFFF' }} />
    </View>
  );
}

type CommonProps = {
  style?: any;
  contentFit?: 'cover' | 'contain';
  badge?: boolean;
};

/** 本地 URI 版（picker 直接给本地文件 / 详情页下载后调用）。 */
export function LivePhotoImage({
  photoUri,
  pairedVideoUri,
  style,
  contentFit = 'cover',
  badge = true,
}: CommonProps & { photoUri: string; pairedVideoUri?: string | null }) {
  const canLive = livePhotoSupported && !!pairedVideoUri;
  return (
    <View style={style}>
      {canLive ? (
        <LivePhotoView
          source={{ photoUri, pairedVideoUri }}
          contentFit={contentFit}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode={contentFit} />
      )}
      {/* 角标只表示「这是实况照片」，与能否播放无关 */}
      {badge && !!pairedVideoUri && <LiveBadge />}
    </View>
  );
}

function extFromUrl(url: string, fallback: string): string {
  const clean = url.split('?')[0];
  const e = clean.split('.').pop()?.toLowerCase();
  return e && e.length >= 2 && e.length <= 4 ? e : fallback;
}

/** 把远端 still + 配对视频下到本地缓存，返回本地 file:// URI（PHLivePhoto 只认本地资源文件）。 */
export function useLocalLivePhoto(cacheKey?: string, photoUrl?: string, videoUrl?: string) {
  const [asset, setAsset] = useState<{ photoUri: string; pairedVideoUri: string } | null>(null);
  useEffect(() => {
    if (!livePhotoSupported || !cacheKey || !photoUrl || !videoUrl) {
      setAsset(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const safe = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
        const photoFile = new File(Paths.cache, `lp_${safe}.${extFromUrl(photoUrl, 'jpg')}`);
        const videoFile = new File(Paths.cache, `lp_${safe}.${extFromUrl(videoUrl, 'mov')}`);
        if (!photoFile.exists) await File.downloadFileAsync(photoUrl, photoFile);
        if (!videoFile.exists) await File.downloadFileAsync(videoUrl, videoFile);
        if (alive) setAsset({ photoUri: photoFile.uri, pairedVideoUri: videoFile.uri });
      } catch {
        if (alive) setAsset(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cacheKey, photoUrl, videoUrl]);
  return asset;
}

/** 远端 URL 版：先下载到本地再用实况展示；下载中 / 不支持时显示远端静态图（仍带「实况」角标）。 */
export function RemoteLivePhotoImage({
  cacheKey,
  photoUrl,
  pairedVideoUrl,
  style,
  contentFit = 'cover',
  badge = true,
}: CommonProps & { cacheKey: string; photoUrl: string; pairedVideoUrl?: string | null }) {
  const canLive = livePhotoSupported && !!pairedVideoUrl;
  const local = useLocalLivePhoto(canLive ? cacheKey : undefined, photoUrl, pairedVideoUrl || undefined);
  if (local) {
    return (
      <LivePhotoImage
        photoUri={local.photoUri}
        pairedVideoUri={local.pairedVideoUri}
        style={style}
        contentFit={contentFit}
        badge={badge}
      />
    );
  }
  // 下载中 / 不支持：先显示远端静态图
  return (
    <View style={style}>
      <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode={contentFit} />
      {/* 即使本机不能播放（如未重建 / 非 iOS），有配对视频就标出「实况」 */}
      {badge && !!pairedVideoUrl && <LiveBadge />}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  badgeTop: { top: 12 },
  badgeBottom: { bottom: 12 },
  ring: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 3.5, height: 3.5, borderRadius: 1.75, backgroundColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
});
