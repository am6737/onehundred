import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import {
  MEMORIES, getKid, MASCOTS, getMascot, PET_BODY,
  wardrobeState, memoriesForKid, yearReview,
} from '../data';
import { Icon } from '../components/Icons';
import { Bear } from '../components/Bear';

const { width: SW, height: SH } = Dimensions.get('window');

function yearReviewData(kidId) {
  return yearReview(kidId);
}

export default function YearReview({ navigation, route }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const kidId = route?.params?.kidId || 'all';
  const data = useMemo(() => yearReviewData(kidId), [kidId]);
  const who = kidId === 'all' ? '一家人' : (getKid(kidId)?.name || '孩子');
  const mascot = kidId === 'all' ? { name: '团子', tone: 'orange' } : (getMascot(kidId) || { name: '团子', tone: 'orange' });
  const acc = wardrobeState(data.total).filter(w => w.got);
  const [cardIndex, setCardIndex] = useState(0);

  const P_LABELS = [
    ['parent', '为你', '家长 → 孩子'],
    ['child', '为我', '孩子 → 家长'],
    ['together', '一起', '我们一起做'],
  ];
  const maxP = Math.max(1, ...P_LABELS.map(([k]) => data.byP[k] || 0));

  const cards = [];

  // Card 0: Cover
  cards.push(
    <View key="cover" style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: theme.fonts.hand, fontSize: 20, color: theme.accent, letterSpacing: 3 }}>2026</Text>
      <Text style={{
        marginTop: 16, fontFamily: theme.fonts.head, fontSize: 34, lineHeight: 48,
        color: theme.ink, textAlign: 'center',
      }}>{'这一程，\n回头看看'}</Text>
      <Text style={{
        marginTop: 18, maxWidth: 280, fontFamily: theme.fonts.body,
        fontSize: 16, lineHeight: 30, color: theme.inkSoft, textAlign: 'center',
      }}>{'你和' + who + '今年一起做到的事，\n一件一件，慢慢翻给你看。'}</Text>
      <View style={{ marginTop: 26 }}>
        <Bear size={120} stage={PET_BODY} accessories={acc.map(a => a.id)} tone={mascot.tone || 'orange'} mood="happy" />
      </View>
    </View>
  );

  // Card 1: Total
  cards.push(
    <View key="total" style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 16, color: theme.inkSoft, letterSpacing: 1 }}>
        今年，你们一起做到了
      </Text>
      <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 96, color: theme.accent }}>{data.total}</Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 26, color: theme.ink }}>件事</Text>
      </View>
      <Text style={{
        marginTop: 22, maxWidth: 290, fontFamily: theme.fonts.body,
        fontSize: 15.5, lineHeight: 29, color: theme.inkSoft, textAlign: 'center',
      }}>{'从「' + data.firstTitle + '」\n到「' + data.lastTitle + '」。\n每一件，都被好好收着了。'}</Text>
    </View>
  );

  // Card 2: Distribution
  cards.push(
    <View key="lines" style={{ width: '100%' }}>
      <Text style={{
        textAlign: 'center', fontFamily: theme.fonts.head,
        fontSize: 24, color: theme.ink,
      }}>三条线，都在生长</Text>
      <Text style={{
        textAlign: 'center', marginTop: 10, maxWidth: 280, alignSelf: 'center',
        fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
      }}>你为 TA 做的、TA 为你做的、你们一起做的。</Text>
      <View style={{ marginTop: 28, gap: 18 }}>
        {P_LABELS.map(([k, label, long]) => (
          <View key={k}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.ink }}>{label}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, marginLeft: 8 }}>{long}</Text>
              </View>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.accent }}>{data.byP[k] || 0}</Text>
            </View>
            <View style={{ height: 12, borderRadius: 999, backgroundColor: theme.sand, overflow: 'hidden' }}>
              <View style={{
                width: `${Math.round((data.byP[k] || 0) / maxP * 100)}%`,
                height: '100%', borderRadius: 999, backgroundColor: theme.accent,
              }} />
            </View>
          </View>
        ))}
      </View>
      {(data.byP.child || 0) > 0 && (
        <Text style={{
          marginTop: 24, maxWidth: 290, textAlign: 'center', alignSelf: 'center',
          fontFamily: theme.fonts.hand, fontSize: 17, lineHeight: 30, color: theme.inkSoft,
        }}>今年，TA 也开始主动为你做事了。</Text>
      )}
    </View>
  );

  // Card 3: Top place
  if (data.topPlace) {
    cards.push(
      <View key="place" style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.inkSoft, letterSpacing: 1 }}>
          你们最常一起待的地方
        </Text>
        <View style={{
          marginTop: 22, width: 96, height: 96, borderRadius: 30,
          backgroundColor: theme.sand, justifyContent: 'center', alignItems: 'center',
        }}>
          {Icon.pin(theme.accent, 44)}
        </View>
        <Text style={{
          marginTop: 22, fontFamily: theme.fonts.head, fontSize: 32, color: theme.ink,
        }}>{data.topPlace}</Text>
        <Text style={{
          marginTop: 16, maxWidth: 280, fontFamily: theme.fonts.body,
          fontSize: 15.5, lineHeight: 29, color: theme.inkSoft, textAlign: 'center',
        }}>最平常的角落，藏着最多的笑声。</Text>
      </View>
    );
  }

  // Card 4: Bear grew
  cards.push(
    <View key="bear" style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.inkSoft, letterSpacing: 1 }}>
        陪着你们的{mascot.name || '小熊'}
      </Text>
      <View style={{ marginTop: 18 }}>
        <Bear size={138} stage={PET_BODY} accessories={acc.map(a => a.id)} tone={mascot.tone || 'orange'} mood="celebrate" />
      </View>
      <Text style={{
        marginTop: 14, fontFamily: theme.fonts.head, fontSize: 26, color: theme.ink,
      }}>今年解锁了 {acc.length} 件装扮</Text>
      <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {acc.map(a => (
          <View key={a.id} style={{
            paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.sand,
          }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: theme.ink }}>{a.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Card 5: Ending
  cards.push(
    <View key="end" style={{ alignItems: 'center' }}>
      <Bear size={104} stage={PET_BODY} accessories={['scarf', 'hat']} tone={mascot.tone || 'orange'} mood="sleepy" />
      <Text style={{
        marginTop: 14, fontFamily: theme.fonts.head, fontSize: 28, lineHeight: 39,
        color: theme.ink, textAlign: 'center',
      }}>{'把这一年，\n捧在手里'}</Text>
      <Text style={{
        marginTop: 16, maxWidth: 280, fontFamily: theme.fonts.body,
        fontSize: 15.5, lineHeight: 29, color: theme.inkSoft, textAlign: 'center',
      }}>这 {data.total} 段回忆，可以印成一本真正的书，寄到你们家。</Text>
      <View style={{ marginTop: 26, width: '100%', maxWidth: 300, gap: 12 }}>
        <TouchableOpacity
          onPress={() => {}}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 16, borderRadius: 999, backgroundColor: theme.accent,
          }}
        >
          {Icon.book('#FFFDF7', 19)}
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: '#FFFDF7' }}>做成一本纸质书</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={{
            padding: 16, borderRadius: 999, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.ink }}>回到首页</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const total = cards.length;
  const go = (d) => setCardIndex(x => Math.min(total - 1, Math.max(0, x + d)));

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      {/* Progress bars */}
      <View style={{
        flexDirection: 'row', gap: 6,
        paddingTop: insets.top + 10, paddingHorizontal: 18,
      }}>
        {cards.map((_, k) => (
          <View key={k} style={{
            flex: 1, height: 4, borderRadius: 999,
            backgroundColor: theme.sand, overflow: 'hidden',
          }}>
            <View style={{
              height: '100%',
              width: k <= cardIndex ? '100%' : '0%',
              backgroundColor: theme.accent,
              opacity: k <= cardIndex ? 1 : 0,
            }} />
          </View>
        ))}
      </View>

      {/* Close button */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(255,253,247,0.7)',
            borderWidth: 1, borderColor: theme.line,
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 24, color: theme.inkSoft, transform: [{ rotate: '45deg' }] }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Card area with tap zones */}
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 30, paddingBottom: 30,
      }}>
        <View style={{ width: '100%', maxWidth: 340 }}>
          {cards[cardIndex]}
        </View>

        {/* Left tap zone */}
        <TouchableOpacity
          onPress={() => go(-1)}
          activeOpacity={1}
          style={{
            position: 'absolute', left: 0, top: 0,
            bottom: cardIndex === total - 1 ? '46%' : 0,
            width: '42%',
          }}
        />
        {/* Right tap zone */}
        <TouchableOpacity
          onPress={() => go(1)}
          activeOpacity={1}
          style={{
            position: 'absolute', right: 0, top: 0,
            bottom: cardIndex === total - 1 ? '46%' : 0,
            width: '42%',
          }}
        />
      </View>

      {/* Page hint */}
      {cardIndex < total - 1 && (
        <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 20 }}>
          <Text style={{
            fontFamily: theme.fonts.body, fontSize: 12.5,
            color: theme.inkSoft, opacity: 0.7,
          }}>轻点屏幕，继续翻</Text>
        </View>
      )}
    </View>
  );
}
