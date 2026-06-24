/* 宠物选择页：3 选 1，写入种类（按 kidId 持久化）。
   入口：首次创建孩子时（onboarding）/ 设置页"更换宠物"。
   左右滑动切换宠物，居中用 <PetView emotion="waiting"> 展示当前宠物。 */

import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayerHeader } from '../components/common';
import { PetView } from '../components/PetView';
import type { Species } from '../components/pet-renderers/types';
import { useT } from '../i18n';
import { useTheme } from '../theme/tokens';
import { useData } from '../data/DataProvider';

const { width: SCREEN_W } = Dimensions.get('window');

const PETS: { species: Species }[] = [
  { species: 'bear' },
  { species: 'dog' },
  { species: 'cat' },
];

export default function PetPicker({ navigation, route }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { getMascot, setSpecies } = useData();

  const kidId: string = route?.params?.kidId ?? 'all';
  const onboarding: boolean = !!route?.params?.onboarding;

  const initialIndex = Math.max(
    0,
    PETS.findIndex(
      (p) => p.species === ((getMascot(kidId)?.species as Species) ?? 'bear'),
    ),
  );
  const [index, setIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const listRef = useRef<FlatList>(null);

  const selected = PETS[index].species;
  const selectedName = t(`petPicker.${selected}.name`);
  const petSize = Math.min(SCREEN_W * 0.62, 240);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setSpecies(kidId, selected);
      if (onboarding) navigation.replace('Home');
      else navigation.goBack();
    } catch (e) {
      console.warn('[PetPicker] save species failed', e);
      setSaving(false);
    }
  };

  const goTo = (i: number) => {
    listRef.current?.scrollToOffset({ offset: i * SCREEN_W, animated: true });
    setIndex(i);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      {onboarding ? null : (
        <LayerHeader title={t('petPicker.changeTitle')} onBack={() => navigation.goBack()} />
      )}

      <View style={{ paddingTop: onboarding ? insets.top + 24 : 12, paddingHorizontal: 22 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink, textAlign: 'center' }}>
          {t('petPicker.title')}
        </Text>
        <Text style={{ marginTop: 8, fontFamily: theme.fonts.hand, fontSize: 16, color: theme.inkSoft, textAlign: 'center' }}>
          {t('petPicker.subtitle')}
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={PETS}
        keyExtractor={(item) => item.species}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
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

      <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24 + insets.bottom }}>
        <TouchableOpacity
          onPress={confirm}
          disabled={saving}
          activeOpacity={0.85}
          style={{
            paddingVertical: 17,
            borderRadius: 999,
            alignItems: 'center',
            backgroundColor: saving ? theme.sand : theme.accent,
            shadowColor: saving ? 'transparent' : theme.accentShadow,
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: saving ? 0 : 0.3,
            shadowRadius: 28,
            elevation: saving ? 0 : 4,
          }}
        >
          {saving ? (
            <ActivityIndicator color={theme.inkSoft} />
          ) : (
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 17.5, color: '#FFFDF7', letterSpacing: 0.5 }}>
              {t('petPicker.confirm', { name: selectedName })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
