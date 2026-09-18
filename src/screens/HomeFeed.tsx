// HomeFeed.js — main screen: full-screen vertical snap-scrolling feed of activity cards.
// One activity per screen, swipe down for next, tap to start.

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Dimensions,
  StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { meName, suitsNow } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, PhotoSlot } from '../components/Icons';
import { SceneSlot, motifForLevel, illustrationUrl } from '../components/Motifs';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SPRING_CONFIG = { damping: 20, stiffness: 300, overshootClamping: true };
const SWIPE_VELOCITY = 500;
const SWIPE_THRESHOLD_RATIO = 0.12;

// 抖音式下拉刷新（仅第一条生效）
const TOP_OVERSCROLL = 0.5;     // 第一条下拉时跟手比例（比普通回弹更软）
const REFRESH_TRIGGER = 64;     // 下拉位移超过它即触发刷新
const REFRESH_HOLD = 64;        // 刷新中刷新头停留的位移

/* ════════════════════════════════════════════════════════════
   TopBar — menu
   ════════════════════════════════════════════════════════════ */

function TopBar({ onMore }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      position: 'absolute', top: insets.top + 6, left: 0, right: 0, zIndex: 20,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    }}>
      {/* Menu button */}
      <TouchableOpacity
        onPress={onMore}
        accessibilityLabel={t('home.more')}
        style={{
          width: 44, height: 44, flexShrink: 0,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {Icon.menu(theme.ink, 24)}
      </TouchableOpacity>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   LevelCard — full-screen card for a single activity
   ════════════════════════════════════════════════════════════ */

// 整张卡的骨架占位：插画未就绪时铺在内容之上，整体做呼吸式 loading
function LevelCardSkeleton({ theme, tone }: any) {
  const t = TONE[tone] || TONE.orange;
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 820, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
    return () => cancelAnimation(pulse);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const Bar = ({ w, h, mt = 0, r = 8, bg = theme.sand }) => (
    <View style={{ width: w, height: h, marginTop: mt, borderRadius: r, backgroundColor: bg }} />
  );
  return (
    <Animated.View style={[{ flex: 1 }, pulseStyle]}>
      {/* 插画占位 */}
      <View style={{
        width: '100%', height: '40%', minHeight: 208,
        borderRadius: 30, borderWidth: 1, borderColor: theme.line,
        backgroundColor: t.soft,
      }} />
      {/* 文字占位 */}
      <View style={{ marginTop: 20, flex: 1, minHeight: 0 }}>
        <Bar w={110} h={14} r={999} />
        <Bar w={'74%'} h={26} mt={14} r={10} />
        <Bar w={'46%'} h={26} mt={9} r={10} />
        <Bar w={'92%'} h={14} mt={18} />
        <Bar w={'86%'} h={14} mt={11} />
        <Bar w={'58%'} h={14} mt={11} />
        <Bar w={150} h={34} mt={18} r={999} />
        <View style={{ marginTop: 'auto', paddingTop: 18, flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 74, height: 62, borderRadius: 24, backgroundColor: theme.sand }} />
          <View style={{ flex: 1, height: 56, borderRadius: 999, backgroundColor: t.soft }} />
        </View>
      </View>
    </Animated.View>
  );
}

function LevelCard({ level, onOpen, onSkip, kidId, meLabel, cardHeight }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { getKid } = useData();
  const tn = TONE[level.tone] || TONE.orange;
  const suits = suitsNow(level);
  const kidName = getKid(kidId).name;
  const relationshipLabel = level.perspective === 'parent'
    ? t('home.parentForChild', { me: meLabel, name: kidName })
    : level.perspective === 'child'
      ? t('home.childForParent', { me: meLabel, name: kidName })
      : t('home.togetherWith', { me: meLabel, name: kidName });

  // 插画与文字同时出现：有插画时先等它加载完，整张卡在此之前都是 loading
  const illoUrl = illustrationUrl(level);
  const [imgReady, setImgReady] = useState(!illoUrl);
  const reveal = useSharedValue(illoUrl ? 0 : 1);

  // 切换到另一件事时重置加载态
  useEffect(() => {
    if (illoUrl) {
      setImgReady(false);
      reveal.value = 0;
    } else {
      setImgReady(true);
      reveal.value = 1;
    }
  }, [illoUrl]);

  // 插画就绪 → 插画+文字一起淡入
  useEffect(() => {
    if (imgReady) reveal.value = withTiming(1, { duration: 280 });
  }, [imgReady]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <View style={{
      height: cardHeight,
      paddingTop: Math.max(92, insets.top + 64), paddingBottom: 36, paddingHorizontal: 22,
    }}>
      <View style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, contentStyle]}>
      {/* Scene illustration area */}
      <View style={{
        width: '100%', height: '40%', minHeight: 208,
        borderRadius: 30, overflow: 'hidden',
        borderWidth: 1, borderColor: theme.line,
        backgroundColor: tn.soft,
        shadowColor: theme.shadow, shadowOpacity: 0.2, shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 }, elevation: 8,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <SceneSlot
          level={level}
          tone={level.tone}
          size={160}
          onLoad={() => setImgReady(true)}
          onError={() => setImgReady(true)}
        />

        {/* Overlay badges */}
        {level.custom && (
          <View style={{
            position: 'absolute', left: 14, top: 14,
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
            backgroundColor: 'rgba(255,253,247,0.86)',
          }}>
            {Icon.seed(tn.deep, 14)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              {t('home.badgeCustom')}
            </Text>
          </View>
        )}
        {!level.custom && level.seasonal && (
          <View style={{
            position: 'absolute', left: 14, top: 14,
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
            backgroundColor: 'rgba(255,253,247,0.86)',
          }}>
            {Icon.seed(tn.deep, 14)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              {t('home.badgeSeasonal')}
            </Text>
          </View>
        )}
        {!level.custom && !level.seasonal && level.sealed && (
          <View style={{
            position: 'absolute', left: 14, top: 14,
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
            backgroundColor: 'rgba(255,253,247,0.86)',
          }}>
            {Icon.lock(tn.deep, 13)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              {t('home.badgeSealed')}
            </Text>
          </View>
        )}
      </View>

      {/* Activity details */}
      <View style={{ marginTop: 20, flex: 1, minHeight: 0 }}>
        {/* Relationship label + context chip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
            {relationshipLabel}
          </Text>
          {!theme.isDark && suits && typeof suits === 'string' && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999,
              backgroundColor: tn.soft,
            }}>
              {Icon.seed(tn.ink, 12)}
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: tn.ink }}>
                {suits}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink,
        }}>
          {level.title}
        </Text>

        {/* Why / description */}
        <Text style={{
          marginTop: 14,
          fontFamily: theme.fonts.body, fontSize: 15.5, lineHeight: 27.5,
          color: theme.inkSoft,
        }}>
          {level.why}
        </Text>

        {/* Action buttons */}
        <View style={{
          marginTop: 'auto', paddingTop: 18,
          flexDirection: 'row', alignItems: 'stretch', gap: 12,
        }}>
          {/* Skip / next button */}
          <TouchableOpacity
            onPress={onSkip}
            accessibilityLabel={t('home.swapNext')}
            style={{
              flexShrink: 0, width: 74, borderRadius: 24,
              backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              alignItems: 'center', justifyContent: 'center', gap: 3,
              paddingBottom: 10,
            }}
          >
            {Icon.chevDown(theme.accent, 20)}
            <Text numberOfLines={1} style={{
              fontFamily: theme.fonts.head, fontSize: 13, color: theme.inkSoft,
            }}>{t('home.swapOne')}</Text>
          </TouchableOpacity>

          {/* Do this! primary button */}
          <TouchableOpacity
            onPress={() => onOpen(level)}
            activeOpacity={0.8}
            style={{
              flex: 1, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 999,
              backgroundColor: theme.accent,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Text numberOfLines={1} style={{
              fontFamily: theme.fonts.head, fontSize: 17, color: '#FFFDF7',
            }}>{t('home.doThis')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      </Animated.View>

      {/* 插画未就绪：整张卡（插画+文字）显示 loading */}
      {!imgReady && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LevelCardSkeleton theme={theme} tone={level.tone} />
        </View>
      )}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   EndCard — shown at end of feed
   ════════════════════════════════════════════════════════════ */

function EndCard({ onBook, onReshuffle, onAddOwn, cardHeight, allDone }: any) {
  const { theme } = useTheme();
  const t = useT();

  return (
    <View style={{
      height: cardHeight,
      justifyContent: 'center', alignItems: 'center',
      paddingTop: 120, paddingBottom: 70, paddingHorizontal: 36,
    }}>
      <Text style={{
        fontFamily: theme.fonts.hand, fontSize: 21, lineHeight: 38,
        color: theme.ink, textAlign: 'center',
      }}>
        {allDone ? t('home.endAllDone') : t('home.endDaily')}
      </Text>

      <View style={{ marginTop: 24, width: '100%', maxWidth: 300, gap: 12 }}>
        {/* Reshuffle — 全做完时池子为空，重洗无意义，隐藏 */}
        {!allDone && onReshuffle && (
          <TouchableOpacity
            onPress={onReshuffle}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999,
              backgroundColor: theme.accent,
            }}
          >
            <Text numberOfLines={1} style={{
              fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7',
            }}>{t('home.reshuffle')}</Text>
          </TouchableOpacity>
        )}

        {/* Add own */}
        <TouchableOpacity
          onPress={onAddOwn}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999,
            backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line,
          }}
        >
          <Text numberOfLines={1} style={{
            fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink,
          }}>{t('home.addOwn')}</Text>
        </TouchableOpacity>

        {/* Open book */}
        <TouchableOpacity
          onPress={onBook}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999,
          }}
        >
          <Text numberOfLines={1} style={{
            fontFamily: theme.fonts.head, fontSize: 15, color: theme.inkSoft,
          }}>{t('home.openBook')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   HomeFeed — main component
   ════════════════════════════════════════════════════════════ */

export default function HomeFeed({ navigation, onOpenDrawer, me }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const {
    kids, kidDone, memoriesForKid, customLevels, recommendedLevelsForKid,
    loadRecommendations, markRecommendationFeedback, weightedShuffle, refresh,
  } = useData();

  const cardHeight = SCREEN_H;
  const meLabel = meName(me);

  const [shuffleKey, setShuffleKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [readyToRefresh, setReadyToRefresh] = useState(false);
  const refreshingRef = useRef(false);

  const kidIds = useMemo(() => kids.map((kid) => kid.id), [kids]);
  const kidKey = kidIds.join('|');
  const loadAllRecommendations = useCallback(
    () => Promise.all(kidIds.map((id) => loadRecommendations(id))),
    [kidIds, loadRecommendations],
  );

  useEffect(() => {
    loadAllRecommendations().catch(() => {});
  }, [loadAllRecommendations]);

  const activeData = useMemo(() => {
    // 每个孩子独立按年龄和场景排序，再轮流抽取。不同 seed 避免相同事项总被第一个孩子领走。
    const queues = kids.map((kid, kidIndex) => {
      const done = new Set(memoriesForKid(kid.id).map((memory) => memory.levelNum));
      const pool = [...customLevels, ...recommendedLevelsForKid(kid.id)];
      return weightedShuffle(pool, kid.id, (shuffleKey + 1) * 1009 + kidIndex)
        .filter((level) => !done.has(level.num))
        .map((level) => ({ level, kidId: kid.id }));
    });

    const items: any[] = [];
    const cursors = queues.map(() => 0);
    const seenLevels = new Set();
    const startKid = queues.length ? shuffleKey % queues.length : 0;

    // 首页每天仍只展示 10 件；跨孩子轮换，并避免同一事项在一批里重复出现。
    while (items.length < 10 && queues.length) {
      let addedThisRound = false;
      for (let offset = 0; offset < queues.length && items.length < 10; offset += 1) {
        const queueIndex = (startKid + offset) % queues.length;
        const queue = queues[queueIndex];
        while (cursors[queueIndex] < queue.length) {
          const candidate = queue[cursors[queueIndex]];
          cursors[queueIndex] += 1;
          if (seenLevels.has(candidate.level.num)) continue;
          seenLevels.add(candidate.level.num);
          items.push({
            type: 'level',
            key: `${candidate.kidId}-${candidate.level.num}-${shuffleKey}`,
            level: candidate.level,
            kidId: candidate.kidId,
          });
          addedThisRound = true;
          break;
        }
      }
      if (!addedThisRound) break;
    }

    const allDone = kids.length > 0 && kids.every((kid) => kidDone(kid.id) >= 100);
    items.push({ type: 'end', key: 'end', allDone });
    return items;
  }, [shuffleKey, kids, memoriesForKid, customLevels, recommendedLevelsForKid, weightedShuffle, kidDone]);

  /* ── 纵向 feed 状态 ── */
  const translateY = useSharedValue(0);
  const gestureCtx = useSharedValue(0);
  const pageIndex = useSharedValue(0);
  const dataLenSV = useSharedValue(activeData.length);
  // onUpdate 期间记录最后一次速度：Fabric 下 onEnd 的 event 常回 0，判定改读这些跟手存下的值。
  const dragVelY = useSharedValue(0);
  const pullReady = useSharedValue(0);   // 第一条下拉是否已过刷新阈值（去抖用）
  const [visiblePage, setVisiblePage] = useState(0);

  useEffect(() => {
    dataLenSV.value = activeData.length;
    if (pageIndex.value >= activeData.length) {
      const clamped = Math.max(0, activeData.length - 1);
      pageIndex.value = clamped;
      translateY.value = -clamped * cardHeight;
      setVisiblePage(clamped);
    }
  }, [activeData.length, cardHeight]);

  const goToPage = useCallback((target, animated = true) => {
    const page = Math.max(0, Math.min(activeData.length - 1, target));
    pageIndex.value = page;
    translateY.value = animated
      ? withSpring(-page * cardHeight, SPRING_CONFIG)
      : -page * cardHeight;
    setVisiblePage(page);
  }, [activeData.length, cardHeight]);

  const goNext = useCallback(() => {
    goToPage(pageIndex.value + 1);
  }, [goToPage]);

  /* ── 抖音式下拉刷新：第一条下拉触发，重拉数据 + 换一批 ── */
  const triggerRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setReadyToRefresh(false);
    setRefreshing(true);
    pageIndex.value = 0;
    translateY.value = withSpring(REFRESH_HOLD, SPRING_CONFIG);   // 停在刷新头位置
    try {
      // 重拉服务端数据；同时保底 650ms，避免刷新头一闪而过
      await Promise.all([
        Promise.resolve(refresh && refresh()).catch(() => {}),
        Promise.resolve(loadAllRecommendations()).catch(() => {}),
        new Promise((res) => setTimeout(res, 650)),
      ]);
    } finally {
      setShuffleKey((k) => k + 1);   // 换一批；reset effect 会把 translateY/page 归零，收起刷新头
      setVisiblePage(0);
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [refresh, loadAllRecommendations]);

  const feedGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetY([-12, 12])
      .failOffsetX([-24, 24])
      .onStart(() => {
        'worklet';
        gestureCtx.value = translateY.value;
        dragVelY.value = 0;
      })
      .onUpdate((event) => {
        'worklet';
        // 纵向 feed
        dragVelY.value = event.velocityY;
        const raw = gestureCtx.value + event.translationY;
        const maxT = -(dataLenSV.value - 1) * cardHeight;
        if (raw > 0) {
          // 第一条之上的下拉区：跟手稍软，给抖音式刷新头留出空间
          translateY.value = raw * TOP_OVERSCROLL;
        } else if (raw < maxT) {
          translateY.value = maxT + (raw - maxT) * 0.25;
        } else {
          translateY.value = raw;
        }
        // 第一条下拉过阈值 → 「松开刷新」反馈（去抖，只在跨越时通知 JS）
        if (pageIndex.value === 0) {
          const ready = translateY.value > REFRESH_TRIGGER ? 1 : 0;
          if (ready !== pullReady.value) {
            pullReady.value = ready;
            runOnJS(setReadyToRefresh)(ready === 1);
          }
        }
      })
      .onEnd(() => {
        'worklet';
        // ── 纵向：抖音式下拉刷新 / 翻页 ──
        if (pageIndex.value === 0 && translateY.value > REFRESH_TRIGGER) {
          pullReady.value = 0;
          runOnJS(triggerRefresh)();
          return;
        }
        pullReady.value = 0;
        runOnJS(setReadyToRefresh)(false);

        let target = pageIndex.value;
        const threshold = cardHeight * SWIPE_THRESHOLD_RATIO;
        // 不读 onEnd 的 event（Fabric 下常回 0），改用跟手时已写进 SharedValue 的实际拖动量与速度
        const startY = -pageIndex.value * cardHeight;
        const draggedBy = translateY.value - startY;   // 负 = 上滑（去下一张）
        const velY = dragVelY.value;

        if (Math.abs(velY) > SWIPE_VELOCITY) {
          target += velY < 0 ? 1 : -1;
        } else if (Math.abs(draggedBy) > threshold) {
          target += draggedBy < 0 ? 1 : -1;
        }

        target = Math.max(0, Math.min(dataLenSV.value - 1, target));
        pageIndex.value = target;
        translateY.value = withSpring(-target * cardHeight, SPRING_CONFIG);
        runOnJS(setVisiblePage)(target);
      }),
    [cardHeight, triggerRefresh],
  );

  const feedStyle = useAnimatedStyle(() => ({
    width: SCREEN_W,
    transform: [{ translateY: translateY.value }],
  }));

  // 刷新提示：跟着第一条的下拉量从 0 渐显到 1，并轻微下滑入场
  const refreshHeaderStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (translateY.value - 10) / (REFRESH_TRIGGER - 10)));
    return { opacity: t, transform: [{ translateY: (1 - t) * -8 }] };
  });

  /* ── 推荐批次变化时复位到第一条 ── */
  useEffect(() => {
    pageIndex.value = 0;
    translateY.value = 0;
    setVisiblePage(0);
  }, [kidKey, shuffleKey]);

  /* ── actions ── */
  const handleOpenLevel = useCallback((level, targetKidId) => {
    if (!level.custom) markRecommendationFeedback(targetKidId, level.num, 'chosen').catch(() => {});
    if (navigation) navigation.navigate('LevelDetail', { level, kidId: targetKidId, me });
  }, [navigation, me, markRecommendationFeedback]);

  const handleSkipLevel = useCallback((level, targetKidId) => {
    if (!level.custom) markRecommendationFeedback(targetKidId, level.num, 'skipped').catch(() => {});
    goNext();
  }, [markRecommendationFeedback, goNext]);

  const handleOpenBook = useCallback(() => {
    if (navigation) navigation.navigate('MemoryBook', { kidId: 'all' });
  }, [navigation]);

  const handleCreated = useCallback(() => {
    setShuffleKey(k => k + 1);
  }, []);

  const handleAddOwn = useCallback(() => {
    if (navigation) navigation.navigate('AddOwnLevel', { me, onCreated: handleCreated });
  }, [navigation, me, handleCreated]);

  /* ── render card content ── */
  const renderCard = useCallback((item) => {
    if (item.type === 'end') {
      return (
        <EndCard
          onBook={handleOpenBook}
          onReshuffle={null}
          onAddOwn={handleAddOwn}
          cardHeight={cardHeight}
          allDone={item.allDone}
        />
      );
    }
    return (
      <LevelCard
        level={item.level}
        onOpen={() => handleOpenLevel(item.level, item.kidId)}
        onSkip={() => handleSkipLevel(item.level, item.kidId)}
        kidId={item.kidId}
        meLabel={meLabel}
        cardHeight={cardHeight}
      />
    );
  }, [cardHeight, meLabel, handleSkipLevel, handleOpenLevel, handleOpenBook, handleAddOwn]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <GestureDetector gesture={feedGesture}>
        <Animated.View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View style={feedStyle}>
            {activeData.map((item, index) => (
              <View key={item.key} style={{ height: cardHeight, width: SCREEN_W }}>
                {Math.abs(index - visiblePage) <= 1 ? renderCard(item) : null}
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* 下拉刷新提示固定在顶部导航下方，随第一条下拉渐显。 */}
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute', top: insets.top + 52, left: 0, right: 0,
          alignItems: 'center', gap: 6, zIndex: 15,
        }, refreshHeaderStyle]}
      >
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft }}>
          {refreshing ? t('home.refreshing') : (readyToRefresh ? t('home.releaseToRefresh') : t('home.pullToRefresh'))}
        </Text>
      </Animated.View>

      <TopBar onMore={onOpenDrawer} />
    </View>
  );
}
