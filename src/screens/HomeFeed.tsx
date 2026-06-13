// HomeFeed.js — main screen: full-screen vertical snap-scrolling feed of activity cards.
// One activity per screen, swipe down for next, tap to start.

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Dimensions,
  StyleSheet, TextInput, Pressable, Modal, ActivityIndicator,
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
import { PERSPECTIVES, meName, kidAge, suitsNow } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, PhotoSlot, KidAvatar } from '../components/Icons';
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
   KidFace — avatar badge used inside the KidSwitcher
   ════════════════════════════════════════════════════════════ */

function KidFace({ id, size = 30 }) {
  const { kids, getKid } = useData();
  if (id === 'all') {
    const a = getKid(kids[0]?.id);
    const b = getKid((kids[1] || kids[0])?.id);
    const s = size * 0.82;
    return (
      <View style={{ position: 'relative', width: size, height: size }}>
        <View style={{ position: 'absolute', left: -size * 0.2, top: 0 }}>
          <KidAvatar name={a.name} tone={a.tone} size={s} />
        </View>
        <View style={{ position: 'absolute', right: -size * 0.2, top: size * 0.08 }}>
          <KidAvatar name={b.name} tone={b.tone} size={s} ring />
        </View>
      </View>
    );
  }
  const k = getKid(id);
  if (!k) return null;
  return <KidAvatar name={k.name} tone={k.tone} size={size} />;
}

/* ════════════════════════════════════════════════════════════
   KidSwitcher — dropdown to switch between kids or "all"
   ════════════════════════════════════════════════════════════ */

function KidSwitcher({ kidId, onSelect }) {
  const { theme } = useTheme();
  const { kids, getKid } = useData();
  const [open, setOpen] = useState(false);
  const rows = [...kids.map(k => k.id), 'all'];

  return (
    <View style={{ position: 'relative', width: 44, flexShrink: 0 }}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        accessibilityLabel="切换孩子"
        style={{
          width: 44, height: 44,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <KidFace id={kidId} size={kidId === 'all' ? 32 : 36} />
      </TouchableOpacity>

      {open && (
        <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
            <View style={{
              position: 'absolute', top: 100, right: 18, width: 188,
              backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              borderRadius: 20, padding: 6,
              shadowColor: '#3A332B', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 12 },
              elevation: 12,
            }}>
              <Text style={{
                paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
                fontFamily: theme.fonts.body, fontSize: 12,
                color: theme.inkSoft, letterSpacing: 0.5,
              }}>
                在陪谁长大？
              </Text>

              {rows.map(id => {
                const on = kidId === id;
                const k = getKid(id);
                const age = k ? kidAge(k) : null;
                const sub = id === 'all' ? '爸爸妈妈和孩子们' : (age != null ? `${age} 岁` : '');
                const label = id === 'all' ? '全家' : (k ? k.name : '');

                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => { onSelect(id); setOpen(false); }}
                    style={{
                      width: '100%', flexDirection: 'row', alignItems: 'center',
                      gap: 11, paddingVertical: 9, paddingHorizontal: 10,
                      borderRadius: 14,
                      backgroundColor: on ? theme.sand : 'transparent',
                    }}
                  >
                    <View style={{
                      width: 36, height: 36, flexShrink: 0, borderRadius: 999,
                      backgroundColor: theme.cream,
                      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      <KidFace id={id} size={id === 'all' ? 24 : 30} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{
                        fontFamily: theme.fonts.head, fontSize: 15.5, color: theme.ink,
                      }}>{label}</Text>
                      <Text style={{
                        fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.inkSoft,
                      }}>{sub}</Text>
                    </View>
                    {on && <View style={{ flexShrink: 0 }}>{Icon.check(theme.accent, 16)}</View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   TopBar — perspective tabs + menu + kid switcher
   ════════════════════════════════════════════════════════════ */

function TopBar({ perspective, setPerspective, onMore, kidId, onSelectKid }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const ps = ['parent', 'child', 'together'];
  const isAll = kidId === 'all';

  return (
    <View style={{
      position: 'absolute', top: insets.top + 6, left: 0, right: 0, zIndex: 20,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
    }}>
      {/* Menu button */}
      <TouchableOpacity
        onPress={onMore}
        accessibilityLabel="更多"
        style={{
          width: 44, height: 44, flexShrink: 0, marginLeft: -6,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {Icon.menu(theme.ink, 24)}
      </TouchableOpacity>

      {/* Perspective tabs */}
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22,
      }}>
        {ps.map(p => {
          const on = perspective === p;
          const disabled = isAll && p !== 'together';
          return (
            <TouchableOpacity
              key={p}
              disabled={disabled}
              onPress={() => !disabled && setPerspective(p)}
              style={{ position: 'relative', paddingVertical: 4, paddingHorizontal: 2 }}
            >
              <Text style={{
                fontFamily: theme.fonts.head,
                fontSize: on ? 18 : 16,
                color: on ? theme.ink : theme.inkSoft,
                opacity: disabled ? 0.28 : (on ? 1 : 0.6),
                letterSpacing: 0.5,
              }}>
                {PERSPECTIVES[p].label}
              </Text>
              <View style={{
                position: 'absolute', left: '50%', bottom: -7,
                transform: [{ translateX: -8 }],
                width: on ? 16 : 0, height: 3, borderRadius: 999,
                backgroundColor: theme.accent,
              }} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Kid switcher */}
      <KidSwitcher kidId={kidId} onSelect={onSelectKid} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   SuggestChip — small hint about best recording method
   ════════════════════════════════════════════════════════════ */

function SuggestChip({ suggest, theme }) {
  const map = {
    voice: { ic: Icon.mic, txt: '适合录一段语音' },
    photo: { ic: Icon.camera, txt: '适合拍一张照片' },
    video: { ic: Icon.video, txt: '适合录一段视频' },
    text:  { ic: Icon.pen, txt: '适合写几句话' },
  };
  const s = map[suggest] || map.voice;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      gap: 7, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999,
      backgroundColor: 'rgba(255,253,247,0.7)',
      borderWidth: 1, borderColor: theme.line,
    }}>
      {s.ic(theme.accent, 16)}
      <Text style={{
        fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
      }}>{s.txt}</Text>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   LevelCard — full-screen card for a single activity
   ════════════════════════════════════════════════════════════ */

// 整张卡的骨架占位：插画未就绪时铺在内容之上，整体做呼吸式 loading
function LevelCardSkeleton({ theme, tone }) {
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

function LevelCard({ level, onOpen, onSkip, kidId, meLabel, cardHeight }) {
  const { theme } = useTheme();
  const { frameLabel } = useData();
  const t = TONE[level.tone] || TONE.orange;
  const suits = suitsNow(level);

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
      paddingTop: 114, paddingBottom: 36, paddingHorizontal: 22,
    }}>
      <View style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, contentStyle]}>
      {/* Scene illustration area */}
      <View style={{
        width: '100%', height: '40%', minHeight: 208,
        borderRadius: 30, overflow: 'hidden',
        borderWidth: 1, borderColor: theme.line,
        backgroundColor: t.soft,
        shadowColor: '#3A332B', shadowOpacity: 0.2, shadowRadius: 20,
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
            {Icon.seed(t.deep, 14)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              我们家自己的事
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
            {Icon.seed(t.deep, 14)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              季节限定
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
            {Icon.lock(t.deep, 13)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
              会被封存
            </Text>
          </View>
        )}
      </View>

      {/* Activity details */}
      <View style={{ marginTop: 20, flex: 1, minHeight: 0 }}>
        {/* Perspective label + context chip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
            {frameLabel(level.perspective, kidId, meLabel)}
          </Text>
          {suits && typeof suits === 'string' && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999,
              backgroundColor: t.soft,
            }}>
              {Icon.seed(t.ink, 12)}
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: t.ink }}>
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

        {/* Suggest chip */}
        <View style={{ marginTop: 16 }}>
          <SuggestChip suggest={level.suggest} theme={theme} />
        </View>

        {/* Action buttons */}
        <View style={{
          marginTop: 'auto', paddingTop: 18,
          flexDirection: 'row', alignItems: 'stretch', gap: 12,
        }}>
          {/* Skip / next button */}
          <TouchableOpacity
            onPress={onSkip}
            accessibilityLabel="换一件事"
            style={{
              flexShrink: 0, width: 74, borderRadius: 24,
              backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              alignItems: 'center', justifyContent: 'center', gap: 3,
              paddingBottom: 10,
              shadowColor: '#3A332B', shadowOpacity: 0.15, shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 }, elevation: 4,
            }}
          >
            {Icon.chevDown(theme.accent, 20)}
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 13, color: theme.inkSoft,
            }}>换一件</Text>
          </TouchableOpacity>

          {/* Do this! primary button */}
          <TouchableOpacity
            onPress={() => onOpen(level)}
            activeOpacity={0.8}
            style={{
              flex: 1, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 999,
              backgroundColor: theme.accent,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 13,
              shadowOffset: { width: 0, height: 6 }, elevation: 6,
            }}
          >
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 17, color: '#FFFDF7',
            }}>做这件事</Text>
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

function EndCard({ onBook, onReshuffle, onAddOwn, cardHeight, allDone }) {
  const { theme } = useTheme();

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
        {allDone
          ? '这里的事，你们都做完啦。\n翻翻回忆册，或者加一件你们家自己的事。'
          : '这一轮先到这。\n换一批，也许会遇见刚好想做的那件。'}
      </Text>

      <View style={{ marginTop: 24, width: '100%', maxWidth: 300, gap: 12 }}>
        {/* Reshuffle — 全做完时池子为空，重洗无意义，隐藏 */}
        {!allDone && (
          <TouchableOpacity
            onPress={onReshuffle}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999,
              backgroundColor: theme.accent,
              shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 }, elevation: 6,
            }}
          >
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7',
            }}>换一批，继续翻</Text>
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
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink,
          }}>加一件我们家自己的事</Text>
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
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 15, color: theme.inkSoft,
          }}>翻翻已经做过的</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   HomeFeed — main component
   ════════════════════════════════════════════════════════════ */

export default function HomeFeed({ navigation, onOpenDrawer, perspective, setPerspective, kidId, setKidId, me }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { kidDone, memoriesForKid, allLevels, weightedShuffle, refresh } = useData();

  const cardHeight = SCREEN_H;
  const meLabel = meName(me);

  const empty = kidDone(kidId) === 0 && memoriesForKid(kidId).length === 0;

  const [shuffleKey, setShuffleKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [readyToRefresh, setReadyToRefresh] = useState(false);
  const refreshingRef = useRef(false);

  const doneSet = useMemo(
    () => new Set(memoriesForKid(kidId).map(m => `${m.perspective}|${m.levelNum}`)),
    [memoriesForKid, kidId]
  );

  // 横向分页：每个视角一个 tab；kid='all' 时只有「一起」一页
  const psOrder = kidId === 'all' ? ['together'] : ['parent', 'child', 'together'];
  const psKey = psOrder.join(',');
  const activeIdx = Math.max(0, psOrder.indexOf(perspective));

  // 每个视角各自预构建一份 feed（横滑要能预览相邻视角，故全部构建；不依赖 perspective，切 tab 不重排）
  const columns = useMemo(() => {
    return psOrder.map((p) => {
      let pool = allLevels().filter((l) => l.perspective === p);
      if (!pool.length) pool = allLevels();
      // 用 shuffleKey 当 seed：refresh 静默重载不会重排，只有「换一批」才换顺序
      const shuf = weightedShuffle(pool, kidId, shuffleKey + 1);
      // 当前孩子做过的活动不再出现（kid='all' 的记录对每个孩子都算做过）
      const lv = shuf.filter((l) => !doneSet.has(`${l.perspective}|${l.num}`));
      const items = [];
      lv.forEach((l, i) => {
        items.push({ type: 'level', key: `${l.num}-${p}-${shuffleKey}`, level: l, index: i });
      });
      items.push({ type: 'end', key: `end-${p}`, allDone: !empty && lv.length === 0 });
      return { perspective: p, data: items };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psKey, shuffleKey, kidId, doneSet, empty, allLevels, weightedShuffle]);

  const activeData = columns[activeIdx]?.data || columns[0]?.data || [];

  /* ── 纵向 feed 状态（只作用于当前视角列）── */
  const translateY = useSharedValue(0);
  const gestureCtx = useSharedValue(0);
  const pageIndex = useSharedValue(0);
  const dataLenSV = useSharedValue(activeData.length);
  // onUpdate 期间记录最后一次速度：Fabric 下 onEnd 的 event 常回 0，判定改读这些跟手存下的值。
  const dragVelY = useSharedValue(0);
  const pullReady = useSharedValue(0);   // 第一条下拉是否已过刷新阈值（去抖用）
  const [visiblePage, setVisiblePage] = useState(0);

  /* ── 横向分页状态（视角之间）── */
  const pagerX = useSharedValue(-activeIdx * SCREEN_W);   // 横向位移：第 i 页停在 -i*屏宽
  const pagerCtx = useSharedValue(0);                     // 手势开始时的 pagerX
  const hPage = useSharedValue(activeIdx);                // 已提交的横向页；横滑途中保持不变，纵向归属用它避免跨页跳变
  const nPagesSV = useSharedValue(psOrder.length);
  const dragX = useSharedValue(0);
  const dragVelX = useSharedValue(0);
  const axis = useSharedValue(0);                         // 本次手势锁定的轴：0 未定 / 1 横向 / 2 纵向

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
        new Promise((res) => setTimeout(res, 650)),
      ]);
    } finally {
      setShuffleKey((k) => k + 1);   // 换一批；reset effect 会把 translateY/page 归零，收起刷新头
      setVisiblePage(0);
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [refresh]);

  /* ── 横滑提交：落到目标视角页 ──
     纵向状态（translateY/pageIndex/visiblePage）是「当前列」共用的，切列时必须与
     setPerspective 同批同步归零，否则新列会沿用旧列的滚动量而显示空白。 */
  const commitPager = useCallback((target) => {
    const order = kidId === 'all' ? ['together'] : ['parent', 'child', 'together'];
    const p = order[target];
    if (!p) return;
    hPage.value = target;
    translateY.value = 0;
    pageIndex.value = 0;
    setVisiblePage(0);
    if (p !== perspective) setPerspective(p);
  }, [kidId, perspective, setPerspective]);

  /* ── 单一手势：先锁轴，横向→分页切视角，纵向→翻 feed/下拉刷新 ──
     合成一个 Pan 而不是两个 Race，避免 Fabric 下嵌套手势仲裁不稳。 */
  const pagerGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-14, 14])
      .activeOffsetY([-12, 12])
      .onStart(() => {
        'worklet';
        axis.value = 0;
        gestureCtx.value = translateY.value;
        pagerCtx.value = pagerX.value;
        dragVelY.value = 0;
        dragVelX.value = 0;
        dragX.value = 0;
      })
      .onUpdate((event) => {
        'worklet';
        // 锁轴：哪个方向位移大就归哪个轴，本次手势不再改
        if (axis.value === 0) {
          const ax = Math.abs(event.translationX);
          const ay = Math.abs(event.translationY);
          if (ax < 6 && ay < 6) return;
          axis.value = ax > ay ? 1 : 2;
        }

        if (axis.value === 1) {
          // 横向分页：跟手，越界回弹阻尼
          dragX.value = event.translationX;
          dragVelX.value = event.velocityX;
          const minX = -(nPagesSV.value - 1) * SCREEN_W;
          let raw = pagerCtx.value + event.translationX;
          if (raw > 0) raw = raw * 0.3;
          else if (raw < minX) raw = minX + (raw - minX) * 0.3;
          pagerX.value = raw;
          return;
        }

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
        // ── 横向：吸附到目标视角页 ──
        if (axis.value === 1) {
          const startPage = hPage.value;
          const draggedBy = dragX.value;   // 负 = 左滑（去下一页）
          const velX = dragVelX.value;
          let target = startPage;
          const threshold = SCREEN_W * 0.18;
          if (Math.abs(velX) > SWIPE_VELOCITY) target += velX < 0 ? 1 : -1;
          else if (Math.abs(draggedBy) > threshold) target += draggedBy < 0 ? 1 : -1;
          target = Math.max(0, Math.min(nPagesSV.value - 1, target));
          pagerX.value = withSpring(-target * SCREEN_W, SPRING_CONFIG);
          if (target !== startPage) runOnJS(commitPager)(target);
          return;
        }

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
    [cardHeight, triggerRefresh, commitPager],
  );

  // 横向整行的位移
  const pagerRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pagerX.value }],
  }));

  // 各视角列各自的纵向位移：只有「当前提交页」那一列跟着 translateY 滚动，其余固定在顶部
  const vSlot0 = useAnimatedStyle(() => ({ width: SCREEN_W, transform: [{ translateY: hPage.value === 0 ? translateY.value : 0 }] }));
  const vSlot1 = useAnimatedStyle(() => ({ width: SCREEN_W, transform: [{ translateY: hPage.value === 1 ? translateY.value : 0 }] }));
  const vSlot2 = useAnimatedStyle(() => ({ width: SCREEN_W, transform: [{ translateY: hPage.value === 2 ? translateY.value : 0 }] }));
  const vSlotStyles = [vSlot0, vSlot1, vSlot2];

  // 刷新提示：跟着第一条的下拉量从 0 渐显到 1，并轻微下滑入场
  const refreshHeaderStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (translateY.value - 10) / (REFRESH_TRIGGER - 10)));
    return { opacity: t, transform: [{ translateY: (1 - t) * -8 }] };
  });

  /* ── 视角 / 孩子 / 换一批 变化时复位 ── */
  // 横向：把整行吸附到当前视角页（tab 点选、横滑提交、换孩子都走这里）；
  // 纵向：当前视角列回到顶部（切视角即回到第一条，符合预期）。
  useEffect(() => {
    const order = kidId === 'all' ? ['together'] : ['parent', 'child', 'together'];
    nPagesSV.value = order.length;
    const idx = Math.max(0, order.indexOf(perspective));
    hPage.value = idx;
    pagerX.value = withSpring(-idx * SCREEN_W, SPRING_CONFIG);
    pageIndex.value = 0;
    translateY.value = 0;
    setVisiblePage(0);
  }, [perspective, kidId, shuffleKey]);

  /* ── actions ── */
  const reshuffle = useCallback(() => {
    setShuffleKey(k => k + 1);
  }, []);

  const handleOpenLevel = useCallback((level) => {
    if (navigation) navigation.navigate('LevelDetail', { level, kidId, me });
  }, [navigation, kidId, me]);

  const handleOpenBook = useCallback(() => {
    if (navigation) navigation.navigate('MemoryBook', { kidId });
  }, [navigation, kidId]);

  const handleCreated = useCallback(() => {
    setShuffleKey(k => k + 1);
  }, []);

  const handleAddOwn = useCallback(() => {
    if (navigation) navigation.navigate('AddOwnLevel', { kidId, me, onCreated: handleCreated });
  }, [navigation, kidId, me, handleCreated]);

  /* ── render card content ── */
  const renderCard = useCallback((item) => {
    if (item.type === 'end') {
      return (
        <EndCard
          onBook={handleOpenBook}
          onReshuffle={reshuffle}
          onAddOwn={handleAddOwn}
          cardHeight={cardHeight}
          allDone={item.allDone}
        />
      );
    }
    return (
      <LevelCard
        level={item.level}
        onOpen={handleOpenLevel}
        onSkip={goNext}
        kidId={kidId}
        meLabel={meLabel}
        cardHeight={cardHeight}
      />
    );
  }, [kidId, empty, cardHeight, meLabel, goNext, handleOpenLevel, handleOpenBook, reshuffle, handleAddOwn]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <GestureDetector gesture={pagerGesture}>
        <Animated.View style={{ flex: 1, overflow: 'hidden' }}>
          {/* 横向整行：N 个视角列并排，跟着 pagerX 左右滑 */}
          <Animated.View
            style={[
              { flexDirection: 'row', width: psOrder.length * SCREEN_W, height: SCREEN_H },
              pagerRowStyle,
            ]}
          >
            {columns.map((col, pi) => {
              const isActive = pi === activeIdx;
              const vp = isActive ? visiblePage : 0;
              // 非当前列固定在顶部，只渲染头两条够横滑预览即可；成为当前列时再渲染整叠
              const items = isActive ? col.data : col.data.slice(0, 2);
              return (
                <View key={col.perspective} style={{ width: SCREEN_W, height: SCREEN_H, overflow: 'hidden' }}>
                  <Animated.View style={vSlotStyles[pi]}>
                    {items.map((item, index) => (
                      <View key={item.key} style={{ height: cardHeight, width: SCREEN_W }}>
                        {Math.abs(index - vp) <= 1 ? renderCard(item) : null}
                      </View>
                    ))}
                  </Animated.View>
                </View>
              );
            })}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* 抖音式刷新提示：固定在视角标签（为你/为我/一起）下方，随第一条下拉渐显 */}
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute', top: insets.top + 52, left: 0, right: 0,
          alignItems: 'center', gap: 6, zIndex: 15,
        }, refreshHeaderStyle]}
      >
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft }}>
          {refreshing ? '正在为你换一批…' : (readyToRefresh ? '松开刷新' : '下拉刷新')}
        </Text>
      </Animated.View>

      <TopBar
        perspective={perspective}
        setPerspective={setPerspective}
        onMore={onOpenDrawer}
        kidId={kidId}
        onSelectKid={setKidId}
      />
    </View>
  );
}
