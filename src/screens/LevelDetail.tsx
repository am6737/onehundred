import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { PERSPECTIVES } from '../data';
import { useData } from '../data/DataProvider';
import { Icon } from '../components/Icons';
import { SceneSlot } from '../components/Motifs';
import { LayerHeader, PrimaryButton, SecondaryButton } from '../components/common';

const { height: SCREEN_H } = Dimensions.get('window');

export default function LevelDetail({ route, navigation }) {
  const { theme } = useTheme();
  const { customLevels } = useData();
  const insets = useSafeAreaInsets();
  const { level, kidId, me } = route.params;

  // 自定义事：始终用 context 里最新的一份——这样从编辑页返回能立刻反映改动；
  // 若它被删掉了（liveLevel 变 undefined），就自动退回上一页，避免停在已删除的内容上。
  const liveLevel = level.custom ? customLevels.find((l) => l.id === level.id) : level;
  useEffect(() => {
    if (level.custom && !liveLevel) navigation.goBack();
  }, [liveLevel, level.custom]);
  const L = liveLevel || level;

  const t = TONE[L.tone] || TONE.orange;
  const perspective = PERSPECTIVES[L.perspective];
  const sugMap = {
    voice: { label: '用语音录下来', icon: () => Icon.mic(t.ink, 22) },
    photo: { label: '拍一张照片', icon: () => Icon.camera(t.ink, 22) },
    video: { label: '录一段视频', icon: () => Icon.video(t.ink, 22) },
    text:  { label: '写下来', icon: () => Icon.pen(t.ink, 22) },
  };
  const sug = sugMap[L.suggest] || null;

  // 自定义事：右上角放编辑入口，让「改」在最自然的地方就能进
  const editButton = L.custom ? (
    <TouchableOpacity
      onPress={() => navigation.navigate('AddOwnLevel', { level: L })}
      activeOpacity={0.7}
      style={[styles.headerBtn, { backgroundColor: theme.paper, borderColor: theme.line }]}
    >
      {Icon.pen(theme.accent, 19)}
    </TouchableOpacity>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader
        title={perspective ? perspective.long : ''}
        onBack={() => navigation.goBack()}
        right={editButton}
      />

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero 封面 —— 与首页卡片同款：圆角 30、tone.soft 底、有插画铺满、无插画用 motif */}
        <View style={[styles.hero, { backgroundColor: t.soft, borderColor: theme.line }]}>
          <SceneSlot level={L} tone={L.tone} size={160} />
          {L.custom && (
            <View style={styles.heroBadge}>
              {Icon.seed(t.deep, 14)}
              <Text style={[styles.heroBadgeText, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                我们家自己的事
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.ink, fontFamily: theme.fonts.head }]}>
          {L.title}
        </Text>

        {/* Sealed notice */}
        {L.sealed && (
          <View style={[styles.sealedBox, { borderColor: theme.line }]}>
            <View style={styles.sealedIcon}>{Icon.lock(theme.inkSoft, 18)}</View>
            <Text style={[styles.sealedText, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
              这一封会被封存，直到约定的那天才打开
            </Text>
          </View>
        )}

        {/* 维度小节——空的就不渲染，避免出现只有标题、底下一片空白的区块 */}
        {!!(L.why && L.why.trim()) && (
          <SectionBlock kicker="为什么值得做" body={L.why} theme={theme} />
        )}
        {!!(L.how && L.how.trim()) && (
          <SectionBlock kicker="可以怎么做" body={L.how} theme={theme} />
        )}
        {!!(L.record && L.record.trim()) && (
          <SectionBlock kicker="记录些什么" body={L.record} theme={theme} />
        )}

        {/* Suggestion chip */}
        {sug && (
          <View style={[styles.suggestCard, { backgroundColor: theme.paper, borderColor: theme.line }]}>
            <View style={[styles.suggestIcon, { backgroundColor: t.soft }]}>{sug.icon()}</View>
            <View style={styles.suggestTextWrap}>
              <Text style={[styles.suggestLabel, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                这一关最适合
              </Text>
              <Text style={[styles.suggestValue, { color: theme.ink, fontFamily: theme.fonts.head }]}>
                {sug.label}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom bar，上沿用真实渐变把滚动内容柔和淡出 */}
      <View style={[styles.bottomBar, { backgroundColor: theme.cream, paddingBottom: insets.bottom + 16 }]}>
        <Svg width="100%" height={40} style={styles.bottomFade} pointerEvents="none">
          <Defs>
            <LinearGradient id="ldFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.cream} stopOpacity={0} />
              <Stop offset="1" stopColor={theme.cream} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#ldFade)" />
        </Svg>
        <View style={styles.bottomButtons}>
          <SecondaryButton
            label="以后再说"
            onPress={() => navigation.goBack()}
            style={styles.laterBtn}
          />
          <PrimaryButton
            label="做完了，记录一下"
            onPress={() => navigation.navigate('Record', { level: L, kidId, me })}
            style={styles.recordBtn}
          />
        </View>
      </View>
    </View>
  );
}

/* ── SectionBlock — custom section with accent kicker dot ── */

function SectionBlock({ kicker, body, theme }) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.kickerRow}>
        <View style={[styles.kickerDot, { backgroundColor: theme.accent }]} />
        <Text style={[styles.kickerText, { color: theme.accent, fontFamily: theme.fonts.head }]}>
          {kicker}
        </Text>
      </View>
      <Text style={[styles.sectionBody, { color: theme.ink, fontFamily: theme.fonts.body }]}>
        {body}
      </Text>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroller: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 6,
    paddingBottom: 132,
  },

  headerBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Hero 封面 */
  hero: {
    width: '100%',
    height: SCREEN_H * 0.34,
    minHeight: 210,
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3A332B',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroBadge: {
    position: 'absolute', left: 14, top: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: 'rgba(255,253,247,0.86)',
  },
  heroBadgeText: { fontSize: 12 },

  /* Title */
  title: {
    fontSize: 30,
    lineHeight: 42,
    marginTop: 20,
  },

  /* Sealed */
  sealedBox: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,253,247,0.6)',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sealedIcon: { marginRight: 8 },
  sealedText: { flex: 1, fontSize: 13.5 },

  /* Section block */
  sectionBlock: { marginTop: 28 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  kickerDot: { width: 7, height: 7, borderRadius: 999, marginRight: 10 },
  kickerText: { fontSize: 15, letterSpacing: 0.5 },
  sectionBody: { fontSize: 17, lineHeight: 34 },

  /* Suggest card */
  suggestCard: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestIcon: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  suggestTextWrap: { marginLeft: 12, flex: 1 },
  suggestLabel: { fontSize: 13 },
  suggestValue: { fontSize: 17, marginTop: 2 },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    zIndex: 6,
  },
  bottomFade: {
    position: 'absolute',
    left: 0, right: 0, top: -40,
  },
  bottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 6,
    gap: 12,
  },
  laterBtn: { paddingHorizontal: 18, paddingVertical: 15 },
  recordBtn: { flex: 1, paddingVertical: 15 },
});
