import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { PERSPECTIVES, sealedLockedFrom } from '../data';
import { useData } from '../data/DataProvider';
import { Icon } from '../components/Icons';
import { LayerHeader } from '../components/common';

function SealedSeal({ size = 46, theme }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.accent,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: theme.accent + '99',
    }}>
      {Icon.lock('#FFFDF7', size * 0.46)}
    </View>
  );
}

function SealedCard({ mem, theme, onPress }) {
  const { getKid } = useData();
  const t = TONE[mem.tone] || TONE.orange;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderRadius: 24, padding: 20,
        backgroundColor: theme.paper,
        borderWidth: 1.5, borderColor: theme.line,
        borderStyle: 'dashed',
        marginBottom: 16,
      }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <SealedSeal theme={theme} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              {PERSPECTIVES[mem.perspective]?.long || ''}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
              backgroundColor: theme.sand,
            }}>
              {mem.kid === 'all' || !mem.kid ? Icon.users(theme.inkSoft, 12) : null}
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.inkSoft }}>
                {mem.kid === 'all' || !mem.kid ? '全家' : `给 ${getKid(mem.kid)?.name || '孩子'}`}
              </Text>
            </View>
          </View>
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 19, lineHeight: 28, color: theme.ink,
          }}>{mem.title}</Text>
        </View>
      </View>

      <Text style={{
        marginTop: 14, marginHorizontal: 2,
        fontFamily: theme.fonts.body, fontSize: 13.5, lineHeight: 23, color: theme.inkSoft,
      }}>封存中，到约定的那天才能打开 —— 连你自己也打不开。</Text>

      <View style={{
        marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.line,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {Icon.lock(theme.inkSoft, 14)}
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft }}>
            {mem.date} 封存
          </Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          backgroundColor: theme.sand,
        }}>
          {Icon.seed(theme.accent, 14)}
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: theme.accent }}>
            等{mem.sealLabel || '约定日期'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SealedPage({ navigation, route }) {
  const { theme } = useTheme();
  const { memories } = useData();
  const insets = useSafeAreaInsets();
  const kidId = route?.params?.kidId || 'all';
  const sealed = sealedLockedFrom(memories, kidId);

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title="封存中" onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 56 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, marginBottom: 26 }}>
          <SealedSeal size={68} theme={theme} />
          <Text style={{
            marginTop: 18, fontFamily: theme.fonts.head,
            fontSize: 25, lineHeight: 35, color: theme.ink, textAlign: 'center',
          }}>你们封起来的 {sealed.length} 样东西</Text>
          <Text style={{
            marginTop: 12, maxWidth: 280,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 26, color: theme.inkSoft,
            textAlign: 'center',
          }}>一旦封存，连你自己也打不开。{'\n'}时间到了，它会自己回来找你们。</Text>
        </View>

        {sealed.map((m) => (
          <SealedCard
            key={m.id}
            mem={m}
            theme={theme}
            onPress={() => navigation.navigate('Memory', { memory: m })}
          />
        ))}

        <Text style={{
          textAlign: 'center', marginTop: 30,
          fontFamily: theme.fonts.hand, fontSize: 18, color: theme.inkSoft, lineHeight: 32,
        }}>· 有些话，要等很久才舍得听 ·</Text>
      </ScrollView>
    </View>
  );
}
