/* 对外统一宠物组件。
   Expo 56 / React Native 0.85 要求 NativeEventEmitter 必须绑定非空 native module；
   当前 rive-react-native@9.8.3 在模块加载时仍会调用无参 NativeEventEmitter，
   导致应用启动阶段崩溃。这里暂时不导入 RivePetRenderer，避免运行时加载
   rive-react-native；保持 PetViewProps 接口不变，先稳定回退到占位渲染。
   后续升级/修复 rive-react-native 后，可把实现切回 RivePetRenderer。 */

import { PetPlaceholder } from './pet-renderers/PetPlaceholder';
import type { PetViewProps } from './pet-renderers/types';

export type {
  Emotion,
  PetViewProps,
  Species,
} from './pet-renderers/types';
export { EMOTIONS } from './pet-renderers/types';

export function PetView({ species, emotion, size = 280, onTap }: PetViewProps) {
  return <PetPlaceholder species={species} emotion={emotion} size={size} onTap={onTap} label="rive" />;
}
