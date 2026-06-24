/* video 引擎：expo-video 循环播放 MP4，情绪变化时切换视频源。 */

import { useEffect } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { PET_VIDEOS } from './assets';
import { PetPlaceholder } from './PetPlaceholder';
import { TapBounce } from './TapBounce';
import type { Emotion, PetViewProps } from './types';

export function VideoPetRenderer(props: PetViewProps) {
  const videos = PET_VIDEOS[props.species];
  // 素材未就绪（dog/cat）：回退占位，避免 require 不存在的文件。
  if (!videos) return <PetPlaceholder {...props} label="video" />;
  return <VideoPet {...props} videos={videos} />;
}

function VideoPet({
  species,
  emotion,
  size = 280,
  onTap,
  videos,
}: PetViewProps & { videos: Record<Emotion, number> }) {
  const source = videos[emotion] ?? videos.waiting;

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const next = videos[emotion] ?? videos.waiting;
    player.replace(next);
    player.loop = true;
    player.play();
  }, [emotion, species]);

  return (
    <TapBounce onTap={onTap}>
      <VideoView
        player={player}
        style={{ width: size, height: size }}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </TapBounce>
  );
}
