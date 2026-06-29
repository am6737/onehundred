/* 宠物 Rive 素材注册表。
   各物种 .riv 文件就位后，把对应项改成 require('../../../assets/pets/<species>/pet.riv')；
   未就绪保持 null —— RivePetRenderer 据此回退到 <PetPlaceholder />，代码照常跑通。
   （需要 metro.config.js 已把 'riv' 加入 assetExts。） */

import type { Emotion, Species } from './types';
import { EMOTIONS } from './types';

export const PET_RIVE: Record<Species, number | null> = {
  bear: null, // require('../../../assets/pets/bear/pet.riv'),
  dog: null,
  cat: null,
};

/* 与 .riv 设计稿里的命名保持一致——改 .riv 时这里也要同步。
   约定：状态机暴露一个 Number 输入 emotion（0-8，对应 EMOTIONS 顺序）+
   一个 Trigger 输入 tap（拍一拍时触发）。 */
export const RIVE_STATE_MACHINE = 'State Machine 1';
export const EMOTION_INPUT = 'emotion';
export const TAP_TRIGGER = 'tap';

/* 情绪 → 状态机 Number 值。用 EMOTIONS 下标，保证两边顺序唯一可对照。 */
export function emotionToNumber(emotion: Emotion): number {
  const i = EMOTIONS.indexOf(emotion);
  return i < 0 ? 0 : i;
}
