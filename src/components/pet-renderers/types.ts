/* 宠物渲染引擎的共享类型——各引擎对外接口完全一致。 */

export type Species = 'bear' | 'dog' | 'cat';

export const EMOTIONS = [
  'happy',
  'waiting',
  'sad',
  'celebrate',
  'sleepy',
  'anxious',
  'expecting',
  'surprised',
  'clingy',
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export type PetRenderer = 'spritesheet' | 'rive' | 'icon';

export interface PetViewProps {
  species: Species;
  emotion: Emotion;
  size?: number;
  onTap?: () => void;
}
