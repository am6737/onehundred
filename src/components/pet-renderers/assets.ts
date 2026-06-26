/* 宠物素材注册表。
   只 require 真实存在的文件——bear 已就绪，dog/cat 暂为 null，
   渲染器据此回退到 <PetPlaceholder />。素材到位后把对应项填上即可。 */

import type { Species } from './types';

export const PET_ICONS: Record<Species, number | null> = {
  bear: require('../../../assets/pets/bear/icon.png'),
  dog: null,
  cat: null,
};
