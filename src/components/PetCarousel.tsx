/* 宠物滑动选择器：左右滑动切换，居中用 <PetView emotion="waiting"> 展示，底部圆点指示。
   受控组件——选中的 species 由父级持有。PetPicker（更换宠物）与 Onboarding（首次选宠物）共用。 */

import { useRef } from 'react';
import {
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { PetView } from './PetView';
import type { Species } from './pet-renderers/types';
import { useT } from '../i18n';
import { useTheme } from '../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');

export const PETS: { species: Species }[] = [
  { species: 'bear' },
  { species: 'dog' },
  { species: 'cat' },
];

export function PetCarousel({
  value,
  onChange,
  size,
}: {
  value: Species;
  onChange: (s: Species) => void;
  size?: number;
}) {
  const { theme } = useTheme();
  const t = useT();
  const listRef = useRef<FlatList>(null);
  const index = Math.max(0, PETS.findIndex((p) => p.species === value));
  const petSize = size ?? Math.min(SCREEN_W * 0.62, 240);

  const goTo = (i: number) => {
    listRef.current?.scrollToOffset({ offset: i * SCREEN_W, animated: true });
    onChange(PETS[i].species);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (PETS[i] && PETS[i].species !== value) onChange(PETS[i].species);
  };

  return (
    <>
      <FlatList
        ref={listRef}
        data={PETS}
        keyExtractor={(item) => item.species}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_W, height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
            <PetView species={item.species} emotion="waiting" size={petSize} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26 }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 24, color: theme.ink }}>
                {t(`petPicker.${item.species}.name`)}
              </Text>
              <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.accent }}>
                <Text style={{ fontSize: 13, color: '#FFFDF7' }}>
                  {t(`petPicker.${item.species}.trait`)}
                </Text>
              </View>
            </View>

            <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 24, color: theme.inkSoft, textAlign: 'center' }}>
              {t(`petPicker.${item.species}.desc`)}
            </Text>
          </View>
        )}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        {PETS.map((p, i) => {
          const on = i === index;
          return (
            <TouchableOpacity
              key={p.species}
              onPress={() => goTo(i)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={{
                width: on ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: on ? theme.accent : theme.line,
              }}
            />
          );
        })}
      </View>
    </>
  );
}
