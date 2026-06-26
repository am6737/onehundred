/* 宠物素材注册表。
   只 require 真实存在的文件——bear 已就绪，dog/cat 暂为 null，
   渲染器据此回退到 <PetPlaceholder />。素材到位后把对应项填上即可。 */

import type { Species } from './types';

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
