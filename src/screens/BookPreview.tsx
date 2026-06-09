import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useData } from '../data/DataProvider';
import { Icon, PhotoSlot } from '../components/Icons';
import { LayerHeader, PrimaryButton, SecondaryButton } from '../components/common';

const { width: SW, height: SH } = Dimensions.get('window');
const PAGE_W = SW - 40;
const PAGE_H = PAGE_W * 1.4;

const BOOK_TEMPLATES = [
  { id: 'warm', name: '暖暖的', bg: '#FAF3E6', accent: '#DE8C57', ornament: 'dots' },
  { id: 'green', name: '清新的', bg: '#EFF5EC', accent: '#5E7C61', ornament: 'leaves' },
  { id: 'pink', name: '甜甜的', bg: '#FDF0F0', accent: '#D2929A', ornament: 'hearts' },
  { id: 'classic', name: '经典的', bg: '#F5F0E8', accent: '#8B7D6B', ornament: 'lines' },
];

function BookLeaf({ type, content, template, theme, index, total }) {
  const t = template;

  if (type === 'cover') {
    return (
      <View style={{
        width: PAGE_W, height: PAGE_H, backgroundColor: t.bg,
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        padding: 30, borderWidth: 1, borderColor: theme.line,
      }}>
        <Text style={{
          fontFamily: theme.fonts.hand, fontSize: 14, color: t.accent, letterSpacing: 2,
        }}>一百件事</Text>
        <Text style={{
          marginTop: 16, fontFamily: theme.fonts.head, fontSize: 28, color: theme.ink,
          textAlign: 'center', lineHeight: 40,
        }}>{content.title || '我们的故事'}</Text>
        <Text style={{
          marginTop: 12, fontFamily: theme.fonts.body, fontSize: 14,
          color: theme.inkSoft, textAlign: 'center',
        }}>{content.subtitle || '2024 — 2026'}</Text>
        <View style={{
          marginTop: 30, width: 60, height: 2,
          backgroundColor: t.accent, borderRadius: 1,
        }} />
      </View>
    );
  }

  if (type === 'title') {
    return (
      <View style={{
        width: PAGE_W, height: PAGE_H, backgroundColor: t.bg,
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        padding: 30, borderWidth: 1, borderColor: theme.line,
      }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
        }}>献给</Text>
        <Text style={{
          marginTop: 10, fontFamily: theme.fonts.head, fontSize: 24,
          color: theme.ink, textAlign: 'center',
        }}>{content.dedication || '我们的宝贝'}</Text>
        <Text style={{
          marginTop: 20, fontFamily: theme.fonts.body, fontSize: 14,
          color: theme.inkSoft, textAlign: 'center', lineHeight: 24,
        }}>{content.preface || '这些是我们一起做过的事，\n每一件都值得被记住。'}</Text>
      </View>
    );
  }

  if (type === 'memory') {
    const m = content;
    const tone = TONE[m.tone] || TONE.orange;
    return (
      <View style={{
        width: PAGE_W, height: PAGE_H, backgroundColor: t.bg,
        borderRadius: 16, padding: 24, borderWidth: 1, borderColor: theme.line,
      }}>
        <PhotoSlot tone={m.tone} radius={12} style={{ width: '100%', height: PAGE_H * 0.4 }} />
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              backgroundColor: tone.soft,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 11, color: tone.ink }}>
                第 {parseInt(m.levelNum, 10) || index} 件
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
        width: PAGE_W, height: PAGE_H, backgroundColor: t.bg,
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        padding: 30, borderWidth: 1, borderColor: theme.line,
      }}>
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
          textAlign: 'center', lineHeight: 34,
        }}>{'故事还没有结束，\n因为我们还在一起。'}</Text>
        <View style={{
          marginTop: 24, width: 40, height: 2,
          backgroundColor: t.accent, borderRadius: 1,
        }} />
        <Text style={{
          marginTop: 20, fontFamily: theme.fonts.hand, fontSize: 16,
          color: theme.inkSoft,
        }}>一百件事</Text>
      </View>
    );
  }

  return null;
}

function buildBookPages(memories, kidNames) {
  const pages = [];
  pages.push({ type: 'cover', content: {
    title: kidNames ? `和${kidNames}的故事` : '我们的故事',
    subtitle: '2024 — 2026',
  }});
  pages.push({ type: 'title', content: {
    dedication: kidNames || '我们的宝贝',
    preface: '这些是我们一起做过的事，\n每一件都值得被记住。',
  }});
  memories.forEach((m, i) => {
    pages.push({ type: 'memory', content: m, index: i + 1 });
  });
  pages.push({ type: 'closing', content: {} });
  return pages;
}

export function BookFlip({ navigation, route }) {
  const { theme } = useTheme();
  const { memories: allMemories, kids, getKid, memoriesForKid } = useData();
  const insets = useSafeAreaInsets();
  const kidId = route?.params?.kidId || 'all';
  const memories = kidId === 'all' ? allMemories : memoriesForKid(kidId);
  const kidNames = kidId === 'all'
    ? kids.map(k => k.name).join('和')
    : (getKid(kidId)?.name || '孩子');

  const [templateIdx, setTemplateIdx] = useState(0);
  const template = BOOK_TEMPLATES[templateIdx];
  const pages = buildBookPages(memories, kidNames);
  const [pageIndex, setPageIndex] = useState(0);
  const flatListRef = useRef(null);

  const goPage = (idx) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, idx));
    setPageIndex(clamped);
    flatListRef.current?.scrollToIndex({ index: clamped, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title="预览绘本" onBack={() => navigation.goBack()} />

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
        {BOOK_TEMPLATES.map((t, i) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTemplateIdx(i)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 14,
              backgroundColor: i === templateIdx ? theme.accent : theme.sand,
              alignItems: 'center',
            }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: t.accent, marginBottom: 4,
            }} />
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 12,
              color: i === templateIdx ? '#FFFDF7' : theme.ink,
            }}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function PhotobookSheet({ navigation, route }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title="做成纸质书" onBack={() => navigation.goBack()} />
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
          <Text style={{ fontFamily: theme.fonts.hand, fontSize: 12, color: BOOK_TEMPLATES[0].accent }}>一百件事</Text>
          <Text style={{
            marginTop: 8, fontFamily: theme.fonts.head, fontSize: 18,
            color: theme.ink, textAlign: 'center',
          }}>我们的故事</Text>
        </View>

        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 24, color: theme.ink,
          textAlign: 'center', marginBottom: 8,
        }}>把回忆捧在手里</Text>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 15, color: theme.inkSoft,
          textAlign: 'center', lineHeight: 24, marginBottom: 30, maxWidth: 280,
        }}>我们会把你的回忆印成一本精美的纸质书，寄到你家。</Text>

        <View style={{
          width: '100%', borderRadius: 22,
          backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line,
          padding: 20, gap: 14, marginBottom: 24,
        }}>
          {[
            { label: '精装硬壳', desc: '耐翻耐看，适合收藏' },
            { label: '铜版纸内页', desc: '色彩鲜艳，手感细腻' },
            { label: '约 30-50 页', desc: '根据回忆数量自动排版' },
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
          label="预览绘本"
          icon={Icon.eye('#FFFDF7', 18)}
          onPress={() => navigation.navigate('BookFlip', route?.params)}
          style={{ width: '100%', marginBottom: 12 }}
        />
        <SecondaryButton
          label="以后再说"
          onPress={() => navigation.goBack()}
          style={{ width: '100%' }}
        />
      </ScrollView>
    </View>
  );
}
