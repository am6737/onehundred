// media — list & sign storage files for a memory.
// 文件按 `${familyId}/${memoryId}/<name>.<ext>` 存在私有桶 memories 里，
// 这里列出目录并换成带签名的临时 URL 供 <Image>/<VideoView> 使用。

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getMyFamilyId } from '../data';

const VIDEO_EXT = ['mp4', 'mov', 'm4v', '3gp', 'webm'];
const AUDIO_EXT = ['m4a', 'caf', 'wav', 'mp3', 'aac', 'ogg'];

export type MemoryMediaItem = {
  name: string;
  kind: 'image' | 'video' | 'audio';
  url: string;
  livePhotoUrl?: string; // 实况照片：配对短视频的签名 URL（只有 image 可能带）
};

function kindOf(name: string): MemoryMediaItem['kind'] {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  return 'image';
}

// 实况照片的配对短视频按 `<base>.live.<ext>` 存（如 photo_0.live.mov），
// 它不是独立视频，要挂到同名静态图 photo_0.* 上，不单独列出。
function isLivePhotoVideo(name: string): boolean {
  return /\.live\.[^.]+$/i.test(name);
}
function baseKey(name: string): string {
  return name.replace(/\.live\.[^.]+$/i, '').replace(/\.[^.]+$/, '');
}

// 列表/书页会按行重复挂载，缓存避免每次都打 list+sign 两个请求。
// 只缓存非空结果：刚保存的记录上传可能还在路上，空结果下次要重查。
const mediaCache = new Map<string, MemoryMediaItem[]>();

export async function fetchMemoryMedia(memoryId: string): Promise<MemoryMediaItem[]> {
  const hit = mediaCache.get(memoryId);
  if (hit) return hit;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const familyId = await getMyFamilyId();
  if (!familyId) return [];
  const dir = `${familyId}/${memoryId}`;
  const { data: files, error } = await supabase.storage.from('memories').list(dir);
  if (error || !files || files.length === 0) return [];
  const paths = files.map(f => `${dir}/${f.name}`);
  const { data: signed, error: signErr } = await supabase.storage
    .from('memories')
    .createSignedUrls(paths, 60 * 60 * 24);
  if (signErr || !signed) return [];
  const all = signed
    .map((s, i) => ({ name: files[i].name, kind: kindOf(files[i].name), url: s.signedUrl }))
    .filter(item => !!item.url);
  const liveByBase = new Map<string, string>();
  for (const it of all) {
    if (isLivePhotoVideo(it.name)) liveByBase.set(baseKey(it.name), it.url);
  }
  const items = all
    .filter(it => !isLivePhotoVideo(it.name)) // 配对视频不单独列出
    .map(it =>
      it.kind === 'image' && liveByBase.has(baseKey(it.name))
        ? { ...it, livePhotoUrl: liveByBase.get(baseKey(it.name)) }
        : it
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  if (items.length > 0) mediaCache.set(memoryId, items);
  return items;
}

/** 给定 memory id，返回它的真实媒体文件（带签名 URL）；没有文件时为空数组。 */
export function useMemoryMedia(memoryId: string | undefined) {
  const [media, setMedia] = useState<MemoryMediaItem[]>([]);
  useEffect(() => {
    if (!memoryId) return;
    let alive = true;
    fetchMemoryMedia(memoryId)
      .then(items => { if (alive) setMedia(items); })
      .catch(() => {});
    return () => { alive = false; };
  }, [memoryId]);
  return media;
}
