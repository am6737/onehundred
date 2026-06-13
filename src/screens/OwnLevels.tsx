import React, { useState } from 'react';
import {
  View, Text, Image,
  StyleSheet, Alert, ActivityIndicator,
  TouchableOpacity as RNTouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// 卡片用 RNGH 自己的 ScrollView / TouchableOpacity：它们和 ReanimatedSwipeable 的滑动手势
// 在同一套手势系统里协作，左滑时点击会让位给滑动，而不是误触发跳转（RN 原生触摸在 Fabric 下不会让位）。
// 但左滑露出的删除按钮是滑开后才点，没有手势冲突，仍用 RN 原生的——它能在动作容器里撑满整行高度，
// RNGH 的 touchable 这里不会被拉伸到满高。
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme, TONE } from '../theme/tokens';
import { useData } from '../data/DataProvider';
import { PERSPECTIVES } from '../data';
import { Icon } from '../components/Icons';
import { SceneSlot, illustrationUrl } from '../components/Motifs';
import { LayerHeader } from '../components/common';

const SUGGEST_LABEL = { photo: '拍照', video: '视频', voice: '语音', text: '文字' };

/* 「我们家自己的事」管理：看全部、加（右上角 +）、改（点卡片）、删（左滑 / 长按）。
   卡片样式对齐回忆册时间线里的那种条目。 */
export default function OwnLevels({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { customLevels, removeCustomLevel } = useData();
  const [deletingId, setDeletingId] = useState(null);

  const goAdd = () => navigation.navigate('AddOwnLevel', {});
  const goEdit = (l) => navigation.navigate('AddOwnLevel', { level: l });

  const confirmDelete = (l) => {
    Alert.alert(
      '删掉这件事？',
      `「${l.title}」会从你们家自己的事里移除。已经记下的回忆还在。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(l.id);
            try {
              await removeCustomLevel(l.id, l.illustrationPath);
            } catch (e) {
              Alert.alert('删除失败', '没能删掉，稍后再试一次。');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const addButton = (
    <TouchableOpacity
      onPress={goAdd}
      activeOpacity={0.7}
      style={[styles.headerBtn, { backgroundColor: theme.paper, borderColor: theme.line }]}
    >
      {Icon.plus(theme.accent, 22)}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader title="我们家自己的事" onBack={() => navigation.goBack()} right={addButton} />

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {customLevels.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.ink, fontFamily: theme.fonts.head }]}>
              还没有你们家自己的事
            </Text>
            <Text style={[styles.emptyHint, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
              一百件事之外，加一件只属于你们家的——它会一起出现在首页里。
            </Text>
            <TouchableOpacity
              onPress={goAdd}
              activeOpacity={0.85}
              style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7' }}>
                加一件我们家自己的事
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── 顶部统计（对齐回忆册） ── */}
            <View style={styles.statBlock}>
              <Text style={[styles.statLead, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                只属于你们家的事
              </Text>
              <View style={styles.statNumRow}>
                <Text style={[styles.statBig, { color: theme.accent, fontFamily: theme.fonts.head }]}>
                  {customLevels.length}
                </Text>
                <Text style={[styles.statUnit, { color: theme.ink, fontFamily: theme.fonts.head }]}>件</Text>
              </View>
            </View>

            {customLevels.map((l) => {
              const t = TONE[l.tone] || TONE.orange;
              const illo = illustrationUrl(l);
              const persp = PERSPECTIVES[l.perspective]?.label || '一起';
              const sug = SUGGEST_LABEL[l.suggest] || '记录';
              const desc = l.why || l.record || '记下来，就不会忘。';
              const busy = deletingId === l.id;
              return (
                <View key={l.id} style={[styles.cardShadow, { backgroundColor: theme.paper }]}>
                  <ReanimatedSwipeable
                    friction={2}
                    rightThreshold={36}
                    overshootRight={false}
                    enabled={!busy}
                    containerStyle={[styles.swipeContainer, { borderColor: theme.line }]}
                    renderRightActions={(_p, _t, methods) => (
                      <RNTouchableOpacity
                        style={[styles.swipeDelete, { backgroundColor: theme.danger }]}
                        activeOpacity={0.85}
                        onPress={() => { methods.close(); confirmDelete(l); }}
                      >
                        {busy
                          ? <ActivityIndicator color="#FFFDF7" />
                          : Icon.trash('#FFFDF7', 22)}
                        <Text style={[styles.swipeDeleteText, { fontFamily: theme.fonts.head }]}>删除</Text>
                      </RNTouchableOpacity>
                    )}
                  >
                    {/* 卡片主体：点进去改，长按删 */}
                    <TouchableOpacity
                      style={[styles.card, {
                        backgroundColor: theme.paper,
                        opacity: busy ? 0.5 : 1,
                      }]}
                      activeOpacity={0.8}
                      disabled={busy}
                      onPress={() => goEdit(l)}
                      onLongPress={() => confirmDelete(l)}
                      delayLongPress={300}
                    >
                      {/* 封面缩略图 */}
                      <View style={[styles.cover, { backgroundColor: t.soft }]}>
                        {illo ? (
                          <View style={styles.coverFill}>
                            <Image source={{ uri: illo }} style={styles.coverImg} resizeMode="cover" />
                          </View>
                        ) : (
                          <SceneSlot level={l} tone={l.tone} size={46} />
                        )}
                      </View>

                      {/* 文字内容 */}
                      <View style={styles.cardText}>
                        <View style={styles.pillRow}>
                          <View style={[styles.pill, { backgroundColor: t.soft }]}>
                            <Text style={[styles.pillStrong, { color: t.ink, fontFamily: theme.fonts.head }]}>
                              {l.num}
                            </Text>
                          </View>
                          <View style={[styles.pill, { backgroundColor: theme.sand }]}>
                            <Text style={[styles.pillSoft, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                              {persp}
                            </Text>
                          </View>
                          <View style={[styles.pill, { backgroundColor: theme.sand }]}>
                            <Text style={[styles.pillSoft, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                              {sug}
                            </Text>
                          </View>
                        </View>
                        <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.ink, fontFamily: theme.fonts.head }]}>
                          {l.title}
                        </Text>
                        <Text numberOfLines={2} style={[styles.cardDesc, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                          {desc}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </ReanimatedSwipeable>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroller: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 6 },

  headerBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },

  /* ── 顶部统计 ── */
  statBlock: { marginHorizontal: 2, marginTop: 2, marginBottom: 20 },
  statLead: { fontSize: 13, letterSpacing: 1 },
  statNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 8 },
  statBig: { fontSize: 54, lineHeight: 54 },
  statUnit: { fontSize: 20 },

  /* ── 卡片（仿回忆册条目） ── */
  // 阴影放在外层（Swipeable 容器是 overflow:hidden，会裁掉阴影）
  cardShadow: {
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: '#3A332B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  // 圆角 + 描边都放在 Swipeable 容器上（它会裁剪），卡片本身右边保持直角，
  // 这样左滑露出删除按钮时，接缝是一条竖直的直边，而不是带圆角的缺口。
  swipeContainer: { borderRadius: 18, borderWidth: 1 },
  card: {
    flexDirection: 'row',
  },
  cover: {
    width: 80,
    minHeight: 92,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverFill: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  cardText: { flex: 1, padding: 11, paddingHorizontal: 13 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillStrong: { fontSize: 11 },
  pillSoft: { fontSize: 10.5 },
  cardTitle: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  cardDesc: { marginTop: 4, fontSize: 12.5, lineHeight: 19 },

  /* ── 左滑删除按钮 ── */
  swipeDelete: {
    width: 92,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeDeleteText: { color: '#FFFDF7', fontSize: 12.5 },

  /* ── 空状态 ── */
  empty: { marginTop: 80, alignItems: 'center', paddingHorizontal: 16 },
  emptyTitle: { fontSize: 19, marginBottom: 12 },
  emptyHint: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  emptyBtn: { paddingVertical: 14, paddingHorizontal: 26, borderRadius: 999 },
});
