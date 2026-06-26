/* 对外统一宠物组件。
   按 PET_RENDERER（或 renderer prop 覆盖）选择渲染引擎，各引擎对外
   prop 接口完全一致：species / emotion / size / onTap。
   迁移/切换引擎时调用方代码无需改动。 */

import { PET_RENDERER } from '../data';
import { IconPetRenderer } from './pet-renderers/IconPetRenderer';
import { RivePetRenderer } from './pet-renderers/RivePetRenderer';
import type { PetRenderer, PetViewProps } from './pet-renderers/types';

export type {
  Emotion,
  PetRenderer,
  PetViewProps,
  Species,
} from './pet-renderers/types';
export { EMOTIONS } from './pet-renderers/types';

export function PetView({
  renderer,
  ...props
}: PetViewProps & { renderer?: PetRenderer }) {
  const engine = renderer ?? PET_RENDERER;

  switch (engine) {
    case 'icon':
      return <IconPetRenderer {...props} />;
    case 'rive':
      return <RivePetRenderer {...props} />;
    default:
      return <IconPetRenderer {...props} />;
  }
}
