import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { useData } from '../data/DataProvider';
import { Icon } from '../components/Icons';
import { MemoryCover } from '../components/MemoryCover';
import { LayerHeader, PrimaryButton, SecondaryButton } from '../components/common';

const { width: SW, height: SH } = Dimensions.get('window');
const PAGE_W = SW - 40;
const PAGE_H = PAGE_W * 1.4;

const BOOK_TEMPLATES = [
  { id: 'warm', nameKey: 'tplWarm', bg: '#FAF3E6', accent: '#DE8C57', ornament: 'dots' },
  { id: 'green', nameKey: 'tplGreen', bg: '#EFF5EC', accent: '#5E7C61', ornament: 'leaves' },
  { id: 'pink', nameKey: 'tplPink', bg: '#FDF0F0', accent: '#D2929A', ornament: 'hearts' },
  { id: 'classic', nameKey: 'tplClassic', bg: '#F5F0E8', accent: '#8B7D6B', ornament: 'lines' },
];

function BookLeaf({ type, content, template, theme, index, total }) {
  const tpl = template;
  const t = useT();

  if (type === 'cover') {
    return (
      <View style={{
        width: PAGE_W, height: PAGE_H, backgroundColor: tpl.bg,
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        padding: 30, borderWidth: 1, borderColor: theme.line,
      }}>
        <Text style={{
          fontFamily: theme.fonts.hand, fontSize: 14, color: tpl.accent, letterSpacing: 2,
        }}>{t('onboarding.brand')}</Text>
        <Text style={{
          marginTop: 16, fontFamily: theme.fonts.head, fontSize: 28, color: theme.ink,
          textAlign: 'center', lineHeight: 40,
        }}>{content.title || t('bookPreview.defaultTitle')}</Text>
        <Text style={{
          marginTop: 12, fontFamily: theme.fonts.body, fontSize: 14,
          color: theme.inkSoft, textAlign: 'center',
        }}>{content.subtitle || t('bookPreview.subtitle')}</Text>
        <View style={{
          marginTop: 30, width: 60, height: 2,
          backgroundColor: tpl.accent, borderRadius: 1,
        }} />
      </View>
    );
  }

  if (type === 'title') {
    return (
      <View style={{
        width: PAGE_W, height: PAGE_H, backgroundColor: tpl.bg,
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        padding: 30, borderWidth: 1, borderColor: theme.line,
      }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
        }}>{t('bookPreview.dedicateTo')}</Text>
        <Text style={{
          marginTop: 10, fontFamily: theme.fonts.head, fontSize: 24,
          color: theme.ink, textAlign: 'center',
        }}>{content.dedication || t('bookPreview.defaultDedication')}</Text>
        <Text style={{
          marginTop: 20, fontFamily: theme.fonts.body, fontSize: 14,
          color: theme.inkSoft, textAlign: 'center', lineHeight: 24,
        }}>{content.preface || t('bookPreview.preface')}</Text>
      </View>
    );
  }

  if (type === 'memory') {
    const m = content;
    const tone = TONE[m.tone] || TONE.orange;
    return (
      <View style={{
        width: PAGE_W, height: PAGE_H, backgroundColor: tpl.bg,
        borderRadius: 16, padding: 24, borderWidth: 1, borderColor: theme.line,
      }}>
        <MemoryCover memory={m} mode="hero" radius={12} label={t('common.photo')} style={{ width: '100%', height: PAGE_H * 0.4, aspectRatio: undefined }} />
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              backgroundColor: tone.soft,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 11, color: tone.ink }}>
                {t('records.nthThing', { n: parseInt(m.levelNum, 10) || index })}
              </Text>
            </View>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              {m.date}
            </Text>
          </View>
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink,
            lineHeight: 28, marginBottom: 8,
          }}>{m.title}</Text>
          <Text style={{
            fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft,
            lineHeight: 22,
          }} numberOfLines={4}>{m.caption}</Text>
          {m.place && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
              {Icon.pin(theme.inkSoft, 12)}
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>{m.place}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (type === 'closing') {
    return (
      <View style={{
        width: PAGE_W, height: PAGE_H, backgroundColor: tpl.bg,
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        padding: 30, borderWidth: 1, borderColor: theme.line,
      }}>
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
          textAlign: 'center', lineHeight: 34,
        }}>{t('bookPreview.closingTitle')}</Text>
        <View style={{
          marginTop: 24, width: 40, height: 2,
          backgroundColor: tpl.accent, borderRadius: 1,
        }} />
        <Text style={{
          marginTop: 20, fontFamily: theme.fonts.hand, fontSize: 16,
          color: theme.inkSoft,
        }}>{t('onboarding.brand')}</Text>
      </View>
    );
  }

  return null;
}

function buildBookPages(memories, kidNames, t) {
  const pages = [];
  pages.push({ type: 'cover', content: {
    title: kidNames ? t('bookPreview.storyWith', { names: kidNames }) : t('bookPreview.defaultTitle'),
    subtitle: t('bookPreview.subtitle'),
  }});
  pages.push({ type: 'title', content: {
    dedication: kidNames || t('bookPreview.defaultDedication'),
    preface: t('bookPreview.preface'),
  }});
  memories.forEach((m, i) => {
    pages.push({ type: 'memory', content: m, index: i + 1 });
  });
  pages.push({ type: 'closing', content: {} });
  return pages;
}

export function BookFlip({ navigation, route }) {
  const { theme } = useTheme();
  const t = useT();
  const { memories: allMemories, kids, getKid, memoriesForKid } = useData();
  const insets = useSafeAreaInsets();
  const kidId = route?.params?.kidId || 'all';
  const memories = kidId === 'all' ? allMemories : memoriesForKid(kidId);
  const kidNames = kidId === 'all'
    ? kids.map(k => k.name).join(t('bookPreview.nameJoin'))
    : (getKid(kidId)?.name || t('drawer.child'));

  const [templateIdx, setTemplateIdx] = useState(0);
  const template = BOOK_TEMPLATES[templateIdx];
  const pages = buildBookPages(memories, kidNames, t);
  const [pageIndex, setPageIndex] = useState(0);
  const flatListRef = useRef(null);

  const goPage = (idx) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, idx));
    setPageIndex(clamped);
    flatListRef.current?.scrollToIndex({ index: clamped, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('bookPreview.flipTitle')} onBack={() => navigation.goBack()} />

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <FlatList
          ref={flatListRef}
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={PAGE_W + 20}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'center' }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (PAGE_W + 20));
            setPageIndex(idx);
          }}
          renderItem={({ item, index }) => (
            <View style={{ width: PAGE_W, marginRight: 20 }}>
              <BookLeaf
                type={item.type}
                content={item.content}
                template={template}
                theme={theme}
                index={item.index}
                total={pages.length}
              />
            </View>
          )}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, i) => ({
            length: PAGE_W + 20,
            offset: (PAGE_W + 20) * i,
            index: i,
          })}
        />
      </View>

      {/* Page indicator */}
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
        }}>{pageIndex + 1} / {pages.length}</Text>
      </View>

      {/* Template selector */}
      <View style={{
        flexDirection: 'row', justifyContent: 'center', gap: 10,
        paddingBottom: insets.bottom + 16, paddingHorizontal: 20,
      }}>
        {BOOK_TEMPLATES.map((tpl, i) => (
          <TouchableOpacity
            key={tpl.id}
            onPress={() => setTemplateIdx(i)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 14,
              backgroundColor: i === templateIdx ? theme.accent : theme.sand,
              alignItems: 'center',
            }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: tpl.accent, marginBottom: 4,
            }} />
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 12,
              color: i === templateIdx ? '#FFFDF7' : theme.ink,
            }}>{t('bookPreview.' + tpl.nameKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function PhotobookSheet({ navigation, route }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('bookPreview.makeTitle')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{
        padding: 22, paddingBottom: insets.bottom + 40,
        alignItems: 'center',
      }}>
        <View style={{
          width: 200, height: 280, borderRadius: 16,
          backgroundColor: BOOK_TEMPLATES[0].bg,
          borderWidth: 1, borderColor: theme.line,
          justifyContent: 'center', alignItems: 'center',
          padding: 20, marginBottom: 24,
        }}>
          <Text style={{ fontFamily: theme.fonts.hand, fontSize: 12, color: BOOK_TEMPLATES[0].accent }}>{t('onboarding.brand')}</Text>
          <Text style={{
            marginTop: 8, fontFamily: theme.fonts.head, fontSize: 18,
            color: theme.ink, textAlign: 'center',
          }}>{t('bookPreview.defaultTitle')}</Text>
        </View>

        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 24, color: theme.ink,
          textAlign: 'center', marginBottom: 8,
        }}>{t('bookPreview.holdTitle')}</Text>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 15, color: theme.inkSoft,
          textAlign: 'center', lineHeight: 24, marginBottom: 30, maxWidth: 280,
        }}>{t('bookPreview.holdBody')}</Text>

        <View style={{
          width: '100%', borderRadius: 22,
          backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line,
          padding: 20, gap: 14, marginBottom: 24,
        }}>
          {[
            { label: t('bookPreview.feat1Label'), desc: t('bookPreview.feat1Desc') },
            { label: t('bookPreview.feat2Label'), desc: t('bookPreview.feat2Desc') },
            { label: t('bookPreview.feat3Label'), desc: t('bookPreview.feat3Desc') },
          ].map(item => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {Icon.check(theme.accent, 18)}
              <View>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink }}>{item.label}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft }}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <PrimaryButton
          label={t('bookPreview.flipTitle')}
          icon={Icon.eye('#FFFDF7', 18)}
          onPress={() => navigation.navigate('BookFlip', route?.params)}
          style={{ width: '100%', marginBottom: 12 }}
        />
        <SecondaryButton
          label={t('levelDetail.later')}
          onPress={() => navigation.goBack()}
          style={{ width: '100%' }}
        />
      </ScrollView>
    </View>
  );
}
