import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { PERSPECTIVES, sealedAllFrom, isMemoryUnsealed } from '../data';
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
  const t = useT();
  const tn = TONE[mem.tone] || TONE.orange;
  const openable = isMemoryUnsealed(mem);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderRadius: 24, padding: 20,
        backgroundColor: theme.paper,
        borderWidth: 1.5, borderColor: openable ? tn.deep : theme.line,
        borderStyle: openable ? 'solid' : 'dashed',
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
                {mem.kid === 'all' || !mem.kid ? t('family.all') : t('sealedPage.forKid', { name: getKid(mem.kid)?.name || t('drawer.child') })}
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
        fontFamily: theme.fonts.body, fontSize: 13.5, lineHeight: 23,
        color: openable ? tn.deep : theme.inkSoft,
      }}>{openable
        ? t('sealedPage.openableHint')
        : t('sealedPage.lockedHint')}</Text>

      <View style={{
        marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.line,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {Icon.lock(theme.inkSoft, 14)}
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft }}>
            {t('sealedPage.sealedOn', { date: mem.date })}
          </Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          backgroundColor: openable ? tn.deep : theme.sand,
        }}>
          {openable ? Icon.lock('#FFFDF7', 14) : Icon.seed(theme.accent, 14)}
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 13,
            color: openable ? '#FFFDF7' : theme.accent,
          }}>
            {openable ? t('sealedPage.canOpen') : t('sealedPage.waitFor', { label: mem.sealLabel || t('sealedPage.waitDefault') })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SealedPage({ navigation, route }) {
  const { theme } = useTheme();
  const t = useT();
  const { memories } = useData();
  const insets = useSafeAreaInsets();
  const kidId = route?.params?.kidId || 'all';
  const sealed = sealedAllFrom(memories, kidId);

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('drawer.sealed')} onBack={() => navigation.goBack()} />
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
          }}>{t('sealedPage.countTitle', { count: sealed.length })}</Text>
          <Text style={{
            marginTop: 12, maxWidth: 280,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 26, color: theme.inkSoft,
            textAlign: 'center',
          }}>{t('sealedPage.desc')}</Text>
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
        }}>{t('sealedPage.footer')}</Text>
      </ScrollView>
    </View>
  );
}
