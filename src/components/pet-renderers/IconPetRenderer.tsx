/* icon 引擎：所有宠物统一用静态图 assets/pets/bear/icon.png 展示，
   不区分 species / emotion，保持 PetViewProps 接口不变。 */

import { Image } from 'react-native';
import { PET_ICONS } from './assets';
import { PetPlaceholder } from './PetPlaceholder';
import { TapBounce } from './TapBounce';
import type { PetViewProps } from './types';

export function IconPetRenderer({ size = 280, onTap }: PetViewProps) {
  const icon = PET_ICONS.bear;
  if (!icon) return <PetPlaceholder species="bear" emotion="waiting" size={size} onTap={onTap} label="icon" />;
  return (
    <TapBounce onTap={onTap}>
      <Image source={icon} style={{ width: size, height: size }} resizeMode="contain" />
    </TapBounce>
  );
}
