/* 素材缺失（dog/cat）或引擎未就绪（rive）时的占位渲染，保证代码可跑通。 */

import { Text, View } from 'react-native';
import { TapBounce } from './TapBounce';
import type { PetViewProps, Species } from './types';

const SPECIES_EMOJI: Record<Species, string> = {
  bear: '🐻',
  dog: '🐶',
  cat: '🐱',
};

export function PetPlaceholder({
  species,
  emotion,
  size = 280,
  onTap,
  label,
}: PetViewProps & { label?: string }) {
  return (
    <TapBounce onTap={onTap}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 8,
          backgroundColor: '#F4E9DE',
          borderWidth: 2,
          borderColor: '#E0CBB5',
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size / 3 }}>{SPECIES_EMOJI[species] ?? '🐾'}</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: '#9A7B5A' }}>{emotion}</Text>
        {label ? (
          <Text style={{ marginTop: 2, fontSize: 11, color: '#B8A188' }}>{label}</Text>
        ) : null}
      </View>
    </TapBounce>
  );
}
