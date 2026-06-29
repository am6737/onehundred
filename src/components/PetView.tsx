/* 对外统一宠物组件。统一用 Rive 状态机渲染（RivePetRenderer），
   对外 prop 接口：species / emotion / size / onTap，调用方无需关心引擎。
   物种 .riv 未就位时由 RivePetRenderer 内部回退到占位渲染。 */

import { RivePetRenderer } from './pet-renderers/RivePetRenderer';
import type { PetViewProps } from './pet-renderers/types';

export type {
  Emotion,
  PetViewProps,
  Species,
} from './pet-renderers/types';
export { EMOTIONS } from './pet-renderers/types';

export function PetView(props: PetViewProps) {
  return <RivePetRenderer {...props} />;
}
