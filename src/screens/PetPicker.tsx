/* 宠物选择页（设置页"更换宠物"入口）：3 选 1，写入种类（按 kidId 持久化）。
   首次选宠物已并入 Onboarding 步骤，不再走这里。 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayerHeader } from '../components/common';
import { PetCarousel } from '../components/PetCarousel';
import type { Species } from '../components/pet-renderers/types';
import { useT } from '../i18n';
import { useTheme } from '../theme/tokens';
import { useData } from '../data/DataProvider';

export default function PetPicker({ navigation, route }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { getMascot, setSpecies } = useData();

  const kidId: string = route?.params?.kidId ?? 'all';
  const [selected, setSelected] = useState<Species>(
    (getMascot(kidId)?.species as Species) ?? 'bear',
  );
  const [saving, setSaving] = useState(false);

  const selectedName = t(`petPicker.${selected}.name`);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setSpecies(kidId, selected);
      navigation.goBack();
    } catch (e) {
      console.warn('[PetPicker] save species failed', e);
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('petPicker.changeTitle')} onBack={() => navigation.goBack()} />

      <View style={{ paddingTop: 12, paddingHorizontal: 22 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink, textAlign: 'center' }}>
          {t('petPicker.title')}
        </Text>
        <Text style={{ marginTop: 8, fontFamily: theme.fonts.hand, fontSize: 16, color: theme.inkSoft, textAlign: 'center' }}>
          {t('petPicker.subtitle')}
        </Text>
      </View>

      <PetCarousel value={selected} onChange={setSelected} />

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
