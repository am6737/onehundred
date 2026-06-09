// HomeFeed.js — main screen: full-screen vertical snap-scrolling feed of activity cards.
// One activity per screen, swipe down for next, tap to start.

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Dimensions,
  StyleSheet, TextInput, Pressable, Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { PERSPECTIVES, meName, kidAge, suitsNow } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, PhotoSlot, KidAvatar } from '../components/Icons';
import { SceneSlot, motifForLevel } from '../components/Motifs';
import { Sheet, Chip, PrimaryButton, SecondaryButton } from '../components/common';
import { Bear } from '../components/Bear';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SPRING_CONFIG = { damping: 20, stiffness: 300, overshootClamping: true };
const SWIPE_VELOCITY = 500;
const SWIPE_THRESHOLD_RATIO = 0.12;

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
   WelcomeCard — cold-start opener or returning-user greeting
   ════════════════════════════════════════════════════════════ */

function WelcomeCard({ kidId, done, empty, onScrollHint, onOpenBook, cardHeight }) {
  const { theme } = useTheme();
  const { getKid } = useData();
  const isAll = kidId === 'all';
  const k = getKid(kidId);
  const who = isAll ? '孩子们' : (k ? k.name : '孩子');

  return (
    <View style={{
      height: cardHeight, justifyContent: 'center', alignItems: 'center',
      paddingTop: 120, paddingBottom: 70, paddingHorizontal: 30,
    }}>
      {/* Bear mascot */}
      <View>
        {isAll ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ marginRight: -20 }}>
              <Bear size={104} accessories={[]} tone="orange" />
            </View>
            <Bear size={118} accessories={[]} tone="green" />
          </View>
        ) : (
          <Bear size={130} accessories={[]} tone={k ? k.tone : 'orange'} />
        )}
      </View>

      {/* Subtitle */}
      <Text style={{
        marginTop: 18,
        fontFamily: theme.fonts.body, fontSize: 15,
        color: theme.inkSoft, letterSpacing: 1,
      }}>
        {empty ? '都准备好了' : '欢迎回来'}
      </Text>

      {/* Main title */}
      <Text style={{
        marginTop: 14,
        fontFamily: theme.fonts.head, fontSize: 30, lineHeight: 45,
        color: theme.ink, textAlign: 'center',
      }}>
        {empty
          ? '还没有任何回忆。\n从第一件事开始吧。'
          : `今天，想和${who}\n一起做点什么？`}
      </Text>

      {/* Description */}
      <Text style={{
        marginTop: 14,
        fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 25.5,
        color: theme.inkSoft, textAlign: 'center', maxWidth: 280,
      }}>
        {empty
          ? '一百件值得一起做的事，不用赶进度。挑一件此刻最想做的，做完随手记下来——它就是你们的第一段回忆。'
          : (isAll
            ? '一百件值得全家一起做的事，一件一件慢慢翻。挑一件此刻最想做的就好。'
            : '一百件值得一起做的事，一件一件慢慢翻。挑一件此刻最想做的就好。')}
      </Text>

      {/* Memory book button — only for returning users */}
      {!empty && (
        <TouchableOpacity
          onPress={onOpenBook}
          style={{
            marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999,
            backgroundColor: theme.sand,
          }}
        >
          {Icon.book(theme.accent, 17)}
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.accent,
          }}>
            {isAll ? `全家做到 ${done} 件` : `和${who}做到 ${done} 件`}，翻翻回忆册
          </Text>
        </TouchableOpacity>
      )}

      {/* Scroll hint at bottom */}
      <TouchableOpacity
        onPress={onScrollHint}
        style={{
          position: 'absolute', bottom: 46, alignSelf: 'center',
          alignItems: 'center', gap: 4,
        }}
      >
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
        }}>
          {empty ? '上滑，挑第一件想做的事' : '上滑，一件一件看'}
        </Text>
        {Icon.chevDown(theme.inkSoft, 22)}
      </TouchableOpacity>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   LevelCard — full-screen card for a single activity
   ════════════════════════════════════════════════════════════ */

function LevelCard({ level, onOpen, onSkip, kidId, meLabel, cardHeight }) {
  const { theme } = useTheme();
  const { frameLabel } = useData();
  const t = TONE[level.tone] || TONE.orange;
  const suits = suitsNow(level);

  return (
    <View style={{
      height: cardHeight,
      paddingTop: 100, paddingBottom: 36, paddingHorizontal: 22,
    }}>
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
        <SceneSlot level={level} tone={level.tone} size={160} />

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
              alignItems: 'center', justifyContent: 'center', gap: 5,
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
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   CustomLevelSheet — bottom sheet to add a custom activity
   ════════════════════════════════════════════════════════════ */

function CustomLevelSheet({ visible, onClose, onCreated }) {
  const { theme } = useTheme();
  const { addCustomLevel } = useData();
  const [title, setTitle] = useState('');
  const [persp, setPersp] = useState('together');
  const [suggest, setSuggest] = useState('photo');
  const toneByP = { parent: 'orange', child: 'green', together: 'pink' };
  const ready = title.trim().length > 0;

  const create = () => {
    if (!ready) return;
    const lv = addCustomLevel({
      title: title.trim(),
      perspective: persp,
      tone: toneByP[persp],
      suggest,
    });
    setTitle('');
    onCreated && onCreated(lv);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="加一件我们家自己的事">
      <View style={{ paddingHorizontal: 2 }}>
        <Text style={{
          marginBottom: 18,
          fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 24,
          color: theme.inkSoft,
        }}>
          每个家都有自己的传统。写下来，它就成了你们「一百件事」里的一件。
        </Text>

        <TextInput
          value={title}
          onChangeText={setTitle}
          autoFocus
          multiline
          numberOfLines={2}
          placeholder="比如：每年第一场雪，一起堆一个歪歪的雪人"
          placeholderTextColor={theme.inkSoft}
          style={{
            width: '100%', borderWidth: 1, borderColor: theme.line,
            borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
            fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 25.6,
            color: theme.ink, backgroundColor: theme.paper,
            textAlignVertical: 'top', minHeight: 80,
          }}
        />

        <Text style={{
          marginTop: 16, marginBottom: 8,
          fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft,
        }}>
          这是谁为谁做的？
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['parent', '为孩子做'], ['child', '孩子为你做'], ['together', '一起做']].map(([k, label]) => (
            <TouchableOpacity
              key={k}
              onPress={() => setPersp(k)}
              style={{
                flex: 1, paddingVertical: 10, paddingHorizontal: 6,
                borderRadius: 14, alignItems: 'center',
                backgroundColor: persp === k ? theme.accent : theme.paper,
                borderWidth: 1, borderColor: persp === k ? theme.accent : theme.line,
              }}
            >
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 14,
                color: persp === k ? '#FFFDF7' : theme.ink,
              }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          disabled={!ready}
          onPress={create}
          activeOpacity={0.8}
          style={{
            width: '100%', marginTop: 22, paddingVertical: 16,
            borderRadius: 999, alignItems: 'center',
            backgroundColor: ready ? theme.accent : theme.sand,
            shadowColor: ready ? theme.accent : 'transparent',
            shadowOpacity: ready ? 0.4 : 0,
            shadowRadius: 13, shadowOffset: { width: 0, height: 6 },
            elevation: ready ? 6 : 0,
          }}
        >
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 17,
            color: ready ? '#FFFDF7' : theme.inkSoft,
          }}>
            加进我们的一百件事
          </Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════
   EndCard — shown at end of feed
   ════════════════════════════════════════════════════════════ */

function EndCard({ onBook, onReshuffle, onAddOwn, cardHeight }) {
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
        {'这一轮先到这。\n换一批，也许会遇见刚好想做的那件。'}
      </Text>

      <View style={{ marginTop: 24, width: '100%', maxWidth: 300, gap: 12 }}>
        {/* Reshuffle */}
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
          {Icon.shuffle('#FFFDF7', 18)}
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7',
          }}>换一批，继续翻</Text>
        </TouchableOpacity>

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
          {Icon.seed(theme.accent, 18)}
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
          {Icon.book(theme.inkSoft, 18)}
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
  const { kidDone, memoriesForKid, allLevels, weightedShuffle } = useData();

  const cardHeight = SCREEN_H;
  const meLabel = meName(me);

  const empty = kidDone(kidId) === 0 && memoriesForKid(kidId).length === 0;
  const doneCount = empty ? 0 : kidDone(kidId);

  const [shuffleKey, setShuffleKey] = useState(0);
  const [addOwnVisible, setAddOwnVisible] = useState(false);

  const levels = useMemo(() => {
    let pool = allLevels().filter(l => l.perspective === perspective);
    if (!pool.length) pool = allLevels();
    return weightedShuffle(pool, kidId);
  }, [perspective, shuffleKey, kidId]);

  const data = useMemo(() => {
    const items = [];
    if (empty) {
      items.push({ type: 'welcome', key: 'welcome' });
    }
    levels.forEach((l, i) => {
      items.push({
        type: 'level',
        key: `${l.num}-${perspective}-${shuffleKey}`,
        level: l,
        index: i,
      });
    });
    items.push({ type: 'end', key: 'end' });
    return items;
  }, [levels, empty, perspective, shuffleKey]);

  /* ── pager state ── */
  const translateY = useSharedValue(0);
  const gestureCtx = useSharedValue(0);
  const pageIndex = useSharedValue(0);
  const dataLenSV = useSharedValue(data.length);
  const [visiblePage, setVisiblePage] = useState(0);

  useEffect(() => {
    dataLenSV.value = data.length;
    if (pageIndex.value >= data.length) {
      const clamped = Math.max(0, data.length - 1);
      pageIndex.value = clamped;
      translateY.value = -clamped * cardHeight;
      setVisiblePage(clamped);
    }
  }, [data.length, cardHeight]);

  const goToPage = useCallback((target, animated = true) => {
    const page = Math.max(0, Math.min(data.length - 1, target));
    pageIndex.value = page;
    translateY.value = animated
      ? withSpring(-page * cardHeight, SPRING_CONFIG)
      : -page * cardHeight;
    setVisiblePage(page);
  }, [data.length, cardHeight]);

  const goNext = useCallback(() => {
    goToPage(pageIndex.value + 1);
  }, [goToPage]);

  /* ── gesture ── */
  const panGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetY([-10, 10])
      .onStart(() => {
        'worklet';
        gestureCtx.value = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        const raw = gestureCtx.value + event.translationY;
        const maxT = -(dataLenSV.value - 1) * cardHeight;
        if (raw > 0) {
          translateY.value = raw * 0.25;
        } else if (raw < maxT) {
          translateY.value = maxT + (raw - maxT) * 0.25;
        } else {
          translateY.value = raw;
        }
      })
      .onEnd((event) => {
        'worklet';
        let target = pageIndex.value;
        const threshold = cardHeight * SWIPE_THRESHOLD_RATIO;

        if (Math.abs(event.velocityY) > SWIPE_VELOCITY) {
          target += event.velocityY < 0 ? 1 : -1;
        } else if (Math.abs(event.translationY) > threshold) {
          target += event.translationY < 0 ? 1 : -1;
        }

        target = Math.max(0, Math.min(dataLenSV.value - 1, target));
        pageIndex.value = target;
        translateY.value = withSpring(-target * cardHeight, SPRING_CONFIG);
        runOnJS(setVisiblePage)(target);
      }),
    [cardHeight],
  );

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  /* ── reset on context change ── */
  useEffect(() => {
    pageIndex.value = 0;
    translateY.value = 0;
    setVisiblePage(0);
  }, [perspective, kidId, shuffleKey]);

  /* ── actions ── */
  const reshuffle = useCallback(() => {
    setShuffleKey(k => k + 1);
  }, []);

  const handleOpenLevel = useCallback((level) => {
    if (navigation) navigation.navigate('LevelDetail', { level });
  }, [navigation]);

  const handleOpenBook = useCallback(() => {
    if (navigation) navigation.navigate('MemoryBook', { kidId });
  }, [navigation, kidId]);

  const handleCreated = useCallback(() => {
    setAddOwnVisible(false);
    setShuffleKey(k => k + 1);
  }, []);

  /* ── render card content ── */
  const renderCard = useCallback((item) => {
    if (item.type === 'welcome') {
      return (
        <WelcomeCard
          kidId={kidId}
          done={doneCount}
          empty={empty}
          onScrollHint={goNext}
          onOpenBook={handleOpenBook}
          cardHeight={cardHeight}
        />
      );
    }
    if (item.type === 'end') {
      return (
        <EndCard
          onBook={handleOpenBook}
          onReshuffle={reshuffle}
          onAddOwn={() => setAddOwnVisible(true)}
          cardHeight={cardHeight}
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
  }, [kidId, doneCount, empty, cardHeight, meLabel, goNext, handleOpenLevel, handleOpenBook, reshuffle]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View style={animatedContainerStyle}>
            {data.map((item, index) => (
              <View key={item.key} style={{ height: cardHeight, width: SCREEN_W }}>
                {Math.abs(index - visiblePage) <= 1 ? renderCard(item) : null}
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <TopBar
        perspective={perspective}
        setPerspective={setPerspective}
        onMore={onOpenDrawer}
        kidId={kidId}
        onSelectKid={setKidId}
      />

      <CustomLevelSheet
        visible={addOwnVisible}
        onClose={() => setAddOwnVisible(false)}
        onCreated={handleCreated}
      />
    </View>
  );
}
