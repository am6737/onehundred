/* 宠物素材注册表。
   只 require 真实存在的文件——bear 已就绪，dog/cat 暂为 null，
   渲染器据此回退到 <PetPlaceholder />。素材到位后把对应项填上即可。 */

import type { Emotion, Species } from './types';

type VideoMap = Record<Emotion, number>;

export interface PetMeta {
  species: string;
  displayName: string;
  icon: string;
  sprite: {
    file: string;
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    fps: number;
    frameCount: number;
  };
  states: { name: string; row: number; frames: number }[];
}

export const PET_VIDEOS: Record<Species, VideoMap | null> = {
  bear: {
    happy: require('../../../assets/pets/bear/videos/happy.mp4'),
    waiting: require('../../../assets/pets/bear/videos/waiting.mp4'),
    sad: require('../../../assets/pets/bear/videos/sad.mp4'),
    celebrate: require('../../../assets/pets/bear/videos/celebrate.mp4'),
    sleepy: require('../../../assets/pets/bear/videos/sleepy.mp4'),
    anxious: require('../../../assets/pets/bear/videos/anxious.mp4'),
    expecting: require('../../../assets/pets/bear/videos/expecting.mp4'),
    surprised: require('../../../assets/pets/bear/videos/surprised.mp4'),
    clingy: require('../../../assets/pets/bear/videos/clingy.mp4'),
  },
  dog: null,
  cat: null,
};

export const PET_SHEETS: Record<Species, number | null> = {
  bear: require('../../../assets/pets/bear/spritesheet.webp'),
  dog: null,
  cat: null,
};

export const PET_META: Record<Species, PetMeta | null> = {
  bear: require('../../../assets/pets/bear/pet.json'),
  dog: null,
  cat: null,
};

export const PET_ICONS: Record<Species, number | null> = {
  bear: require('../../../assets/pets/bear/icon.png'),
  dog: null,
  cat: null,
};
