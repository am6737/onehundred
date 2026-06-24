/* spritesheet 引擎：空壳占位。
   素材（spritesheet.webp + pet.json）已在 assets.ts 注册，待补全逐帧实现：
   方案 A rn-sprite-sheet，或方案 B @shopify/react-native-skia Atlas，
   参见 docs/pet-system-spritesheet-plan.md 五节。保持 PetViewProps 接口不变。 */

import { PetPlaceholder } from './PetPlaceholder';
import type { PetViewProps } from './types';

export function SpriteSheetPetRenderer(props: PetViewProps) {
  return <PetPlaceholder {...props} label="spritesheet · soon" />;
}
