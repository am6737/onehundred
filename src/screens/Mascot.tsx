// screens/Mascot.js — MascotPage (pet/wardrobe) + UnlockMoment (celebration overlay)

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Animated, Modal,
  Dimensions, StyleSheet,
} from 'react-native';
import { useTheme, TONE } from '../theme/tokens';
import { PET_BODY } from '../data';
import { useData } from '../data/DataProvider';
import { Icon } from '../components/Icons';
import { Bear } from '../components/Bear';
import { LayerHeader, Section, PrimaryButton, Card } from '../components/common';

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════
   Heart particle — a small SVG heart used for pat feedback
   ═══════════════════════════════════════════════════════════════ */

function HeartParticle({ color, startX, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: true,
    }).start(() => onDone && onDone());
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -78],
  });
  const scale = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.5, 1, 1],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 30,
        left: startX,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
    >
      {Icon.seed(color, 18)}
      {/* Simple heart using text since Icon set has no heart; use accent-colored text */}
      <Text style={{ fontSize: 18, color }}>{'❤'}</Text>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UnlockMoment — celebration overlay
   ═══════════════════════════════════════════════════════════════ */

export function UnlockMoment({ visible, item, mascot, onClose }) {
  const { theme } = useTheme();
  const [showCard, setShowCard] = useState(false);

  // Ring animations
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  // Pop animation for bear
  const popAnim = useRef(new Animated.Value(0)).current;
  // Slide-up for text
  const textUp = useRef(new Animated.Value(0)).current;
  const btnUp = useRef(new Animated.Value(0)).current;
  // Scrim fade
  const scrimAnim = useRef(new Animated.Value(0)).current;
  // Card pop
  const cardPop = useRef(new Animated.Value(0)).current;
  const cardBtnUp = useRef(new Animated.Value(0)).current;

  // Floating motes
  const motes = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      left: 18 + Math.random() * 64,
      delay: Math.random() * 1100,
      dur: 1600 + Math.random() * 1200,
      size: 5 + Math.random() * 7,
      key: i,
      anim: new Animated.Value(0),
    })),
  []);

  useEffect(() => {
    if (visible) {
      setShowCard(false);
      // Reset
      ring1.setValue(0);
      ring2.setValue(0);
      popAnim.setValue(0);
      textUp.setValue(0);
      btnUp.setValue(0);
      scrimAnim.setValue(0);
      cardPop.setValue(0);
      cardBtnUp.setValue(0);

      // Scrim fade in
      Animated.timing(scrimAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Ring 1
      Animated.loop(
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(ring1, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ).start();

      // Ring 2
      Animated.loop(
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(ring2, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ).start();

      // Pop
      Animated.spring(popAnim, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
        delay: 0,
      }).start();

      // Text slide up
      Animated.timing(textUp, {
        toValue: 1,
        duration: 600,
        delay: 1000,
        useNativeDriver: true,
      }).start();

      // Buttons slide up
      Animated.timing(btnUp, {
        toValue: 1,
        duration: 600,
        delay: 1250,
        useNativeDriver: true,
      }).start();

      // Motes looping
      motes.forEach(m => {
        m.anim.setValue(0);
        const loop = () => {
          m.anim.setValue(0);
          Animated.sequence([
            Animated.delay(m.delay),
            Animated.timing(m.anim, {
              toValue: 1,
              duration: m.dur,
              useNativeDriver: true,
            }),
          ]).start(() => loop());
        };
        loop();
      });
    }
  }, [visible]);

  // Switch to card view animations
  useEffect(() => {
    if (showCard) {
      cardPop.setValue(0);
      cardBtnUp.setValue(0);
      Animated.spring(cardPop, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }).start();
      Animated.timing(cardBtnUp, {
        toValue: 1,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showCard]);

  if (!visible || !item || !mascot) return null;

  const accent = theme.accent;
  const petName = mascot.name || '团子';
  const kidName = mascot.kidName || '孩子';
  const tone = mascot.tone || 'orange';
  const wearing = mascot.wearing || [];
  const done = mascot.done || 0;

  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

  // Ring interpolations
  const ring1Scale = ring1.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.3, 0.8, 1.9],
  });
  const ring1Opacity = ring1.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.55, 0],
  });
  const ring2Scale = ring2.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.3, 0.8, 1.9],
  });
  const ring2Opacity = ring2.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.55, 0],
  });

  // Pop interpolation
  const popScale = popAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.4, 1.08, 1],
  });
  const popOpacity = popAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 1],
  });

  // Text up
  const textTranslateY = textUp.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const textOpacity = textUp;

  // Button up
  const btnTranslateY = btnUp.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const btnOpacity = btnUp;

  // Card pop
  const cardScale = cardPop.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.4, 1.08, 1],
  });
  const cardOpacity = cardPop.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 1],
  });
  const cardBtnTranslateY = cardBtnUp.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const cardBtnOpacity = cardBtnUp;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[unlockStyles.scrim, {
        backgroundColor: theme.cream,
        opacity: scrimAnim,
      }]}>
        <View style={unlockStyles.center}>
          {!showCard ? (
            <>
              {/* Ring + Bear area */}
              <View style={unlockStyles.heroArea}>
                {/* Ring 1 */}
                <Animated.View style={[unlockStyles.ring, {
                  borderColor: accent,
                  borderWidth: 3,
                  transform: [{ scale: ring1Scale }],
                  opacity: ring1Opacity,
                }]} />
                {/* Ring 2 */}
                <Animated.View style={[unlockStyles.ring, {
                  borderColor: accent,
                  borderWidth: 2,
                  transform: [{ scale: ring2Scale }],
                  opacity: ring2Opacity,
                }]} />

                {/* Floating motes */}
                {motes.map(m => {
                  const moteY = m.anim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0, 0, -90],
                  });
                  const moteScale = m.anim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0.6, 0.9, 1],
                  });
                  const moteOpacity = m.anim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0, 0.9, 0],
                  });
                  return (
                    <Animated.View
                      key={m.key}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: 64,
                        left: `${m.left}%`,
                        width: m.size,
                        height: m.size,
                        borderRadius: m.size / 2,
                        backgroundColor: accent,
                        transform: [{ translateY: moteY }, { scale: moteScale }],
                        opacity: moteOpacity,
                      }}
                    />
                  );
                })}

                {/* Bear pop */}
                <Animated.View style={{
                  transform: [{ scale: popScale }],
                  opacity: popOpacity,
                }}>
                  <Bear size={196} stage={PET_BODY} accessories={wearing} tone={tone} mood="celebrate" />
                </Animated.View>
              </View>

              {/* Text */}
              <Animated.View style={{
                alignItems: 'center',
                transform: [{ translateY: textTranslateY }],
                opacity: textOpacity,
              }}>
                <Text style={{
                  fontFamily: theme.fonts.hand,
                  fontSize: 18,
                  color: accent,
                  marginBottom: 6,
                }}>{'· 解锁新装扮 ·'}</Text>
                <Text style={{
                  fontFamily: theme.fonts.head,
                  fontSize: 30,
                  color: theme.ink,
                  textAlign: 'center',
                }}>{petName} 得到了「{item.name}」</Text>
                {item.line ? (
                  <Text style={{
                    marginTop: 12,
                    maxWidth: 300,
                    fontFamily: theme.fonts.body,
                    fontSize: 15.5,
                    lineHeight: 28,
                    color: theme.inkSoft,
                    textAlign: 'center',
                  }}>{item.line}</Text>
                ) : null}
                <View style={{
                  marginTop: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 15,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: theme.paper,
                  borderWidth: 1,
                  borderColor: theme.line,
                }}>
                  <Text style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: theme.inkSoft,
                  }}>
                    {'这是你们一起做的第 '}
                  </Text>
                  <Text style={{
                    color: accent,
                    fontFamily: theme.fonts.head,
                    fontSize: 15,
                    marginHorizontal: 3,
                  }}>{done}</Text>
                  <Text style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: theme.inkSoft,
                  }}>{' 件事换来的'}</Text>
                </View>
              </Animated.View>

              {/* Buttons */}
              <Animated.View style={{
                flexDirection: 'row',
                gap: 12,
                marginTop: 34,
                transform: [{ translateY: btnTranslateY }],
                opacity: btnOpacity,
              }}>
                <TouchableOpacity
                  onPress={() => setShowCard(true)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 22,
                    paddingVertical: 14,
                    borderRadius: 999,
                    backgroundColor: accent,
                    shadowColor: accent,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.45,
                    shadowRadius: 26,
                    elevation: 8,
                  }}
                >
                  {Icon.share('#FFFDF7', 19)}
                  <Text style={{
                    fontFamily: theme.fonts.head,
                    fontSize: 16,
                    color: '#FFFDF7',
                  }}>做成卡片</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 14,
                    borderRadius: 999,
                    backgroundColor: theme.paper,
                    borderWidth: 1,
                    borderColor: theme.line,
                  }}
                >
                  <Text style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    color: theme.inkSoft,
                  }}>好</Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          ) : (
            <>
              {/* Share card view */}
              <Animated.View style={{
                width: 316,
                borderRadius: 30,
                overflow: 'hidden',
                backgroundColor: theme.paper,
                borderWidth: 1,
                borderColor: theme.line,
                shadowColor: 'rgba(58,51,43,1)',
                shadowOffset: { width: 0, height: 30 },
                shadowOpacity: 0.3,
                shadowRadius: 60,
                elevation: 12,
                transform: [{ scale: cardScale }],
                opacity: cardOpacity,
              }}>
                <View style={{
                  paddingTop: 30,
                  paddingHorizontal: 26,
                  paddingBottom: 6,
                  alignItems: 'center',
                }}>
                  <Text style={{
                    fontFamily: theme.fonts.hand,
                    fontSize: 16,
                    color: accent,
                  }}>{today} · {petName}的新装扮</Text>
                  <View style={{ marginVertical: 6 }}>
                    <Bear size={176} stage={PET_BODY} accessories={wearing} tone={tone} />
                  </View>
                  <Text style={{
                    fontFamily: theme.fonts.head,
                    fontSize: 24,
                    color: theme.ink,
                    marginBottom: 4,
                  }}>「{item.name}」</Text>
                  {item.line ? (
                    <Text style={{
                      maxWidth: 240,
                      fontFamily: theme.fonts.body,
                      fontSize: 14,
                      lineHeight: 24.5,
                      color: theme.inkSoft,
                      textAlign: 'center',
                      marginBottom: 18,
                    }}>{item.line}</Text>
                  ) : (
                    <View style={{ height: 18 }} />
                  )}
                </View>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderStyle: 'dashed',
                  borderTopColor: theme.line,
                }}>
                  <View>
                    <Text style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 12,
                      color: theme.inkSoft,
                    }}>陪 {kidName} 一起做到了</Text>
                    <Text style={{
                      fontFamily: theme.fonts.head,
                      fontSize: 18,
                      color: theme.ink,
                    }}>{done} 件事</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{
                      fontFamily: theme.fonts.hand,
                      fontSize: 15,
                      color: accent,
                      lineHeight: 20,
                    }}>一百件事</Text>
                    <Text style={{
                      fontSize: 11,
                      color: theme.inkSoft,
                      fontFamily: theme.fonts.body,
                    }}>和孩子一起</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Card view buttons */}
              <Animated.View style={{
                flexDirection: 'row',
                gap: 12,
                marginTop: 26,
                transform: [{ translateY: cardBtnTranslateY }],
                opacity: cardBtnOpacity,
              }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 22,
                    paddingVertical: 14,
                    borderRadius: 999,
                    backgroundColor: accent,
                    shadowColor: accent,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.45,
                    shadowRadius: 26,
                    elevation: 8,
                  }}
                >
                  {Icon.download('#FFFDF7', 19)}
                  <Text style={{
                    fontFamily: theme.fonts.head,
                    fontSize: 16,
                    color: '#FFFDF7',
                  }}>保存图片</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 14,
                    borderRadius: 999,
                    backgroundColor: theme.paper,
                    borderWidth: 1,
                    borderColor: theme.line,
                  }}
                >
                  <Text style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 16,
                    color: theme.inkSoft,
                  }}>收起</Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const unlockStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArea: {
    position: 'relative',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
});


/* ═══════════════════════════════════════════════════════════════
   MascotPage — the pet / wardrobe screen
   ═══════════════════════════════════════════════════════════════ */

export default function MascotPage({ route, navigation }) {
  const { theme } = useTheme();
  const { kids, getKid, kidDone, getMascot, wardrobeState, nextUnlock, wardrobe, memoriesForKid } = useData();
  const kidId = route?.params?.kidId;

  const initial = (kidId && kidId !== 'all') ? kidId : kids[0]?.id;
  const [who, setWho] = useState(initial);
  const kid = getKid(who);
  const MAS = getMascot(who);
  const kidInfo = kid || { name: '孩子' };
  const petName = MAS ? MAS.name : '团子';
  const tone = kid ? kid.tone : 'orange';
  const since = kid && 'since' in kid ? (kid as any).since : '';

  // Demo boost — allows simulating "do one more thing"
  const [boost, setBoost] = useState({});
  const done = kidDone(who) + (boost[who] || 0);
  const wardrobeItems = wardrobeState(done);
  const unlocked = wardrobeItems.filter(w => w.got);
  const nuInfo = nextUnlock(done);
  const nu = nuInfo.next;
  const totalItems = nuInfo.total;
  const unlockedCount = nuInfo.unlocked;

  // Progress ratio toward next unlock
  const ratio = nuInfo.ratio;
  const remain = nuInfo.remain;

  // Worn items: which accessories the bear is currently wearing (toggle on/off)
  const [worn, setWorn] = useState(() => unlocked.map(w => w.id));
  const wornRef = useRef(who);
  useEffect(() => {
    if (wornRef.current !== who) {
      wornRef.current = who;
      setWorn(wardrobeState(kidDone(who) + (boost[who] || 0)).filter(w => w.got).map(w => w.id));
    }
  });
  const toggleWear = useCallback((id) => {
    setWorn(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id]);
  }, []);
  const wearing = worn.filter(id => unlocked.some(w => w.id === id));

  // Unlock overlay state
  const [unlock, setUnlock] = useState(null);

  // Squish animation on pat
  const squishAnim = useRef(new Animated.Value(1)).current;
  const squishScaleX = useRef(new Animated.Value(1)).current;
  const squishScaleY = useRef(new Animated.Value(1)).current;
  const [mood, setMood] = useState('happy');

  // Heart particles
  const [hearts, setHearts] = useState([]);

  // Bobbing animation
  const bobAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const bobTranslateY = bobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  // Pat handler
  const pat = useCallback(() => {
    // Squish
    setMood('celebrate');
    Animated.sequence([
      Animated.parallel([
        Animated.timing(squishScaleX, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.timing(squishScaleY, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(squishScaleX, { toValue: 0.96, duration: 150, useNativeDriver: true }),
        Animated.timing(squishScaleY, { toValue: 1.05, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(squishScaleX, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(squishScaleY, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
    ]).start(() => setMood('happy'));

    // Heart particle
    const id = Date.now() + Math.random();
    const left = 38 + Math.random() * 24;
    setHearts(h => [...h, { id, left }]);
    setTimeout(() => setHearts(h => h.filter(x => x.id !== id)), 1100);
  }, []);

  // Demo: add one more activity done
  const addOne = useCallback(() => {
    const newDone = done + 1;
    const justGot = wardrobe.find(w => w.at === newDone);
    setBoost(b => ({ ...b, [who]: (b[who] || 0) + 1 }));
    if (justGot) {
      setWorn(w => w.includes(justGot.id) ? w : [...w, justGot.id]);
      const wearingAfter = [...new Set([...wearing, justGot.id])];
      setUnlock({
        item: justGot,
        mascot: {
          name: petName,
          kidName: kidInfo.name,
          tone,
          wearing: wearingAfter,
          done: newDone,
        },
      });
    }
  }, [done, who, wearing, petName, kidInfo.name, tone]);

  // Growth diary — build from memories
  const memories = memoriesForKid(who);
  const diaryLog = useMemo(() => {
    return memories.slice(0, 6).map(m => ({
      text: m.title + (m.caption ? ` — ${m.caption}` : ''),
      from: m.date,
    }));
  }, [who, memories.length]);

  // Wardrobe grid column count
  const gridColumns = 3;
  const gridGap = 12;
  const gridPadding = 24;
  const itemWidth = (SCREEN_W - gridPadding * 2 - gridGap * (gridColumns - 1)) / gridColumns;

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader
        title={petName}
        onBack={() => navigation?.goBack?.()}
        right={
          <TouchableOpacity
            onPress={() => navigation?.navigate?.('Settings')}
            style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            {Icon.gear(theme.ink, 21)}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Kid switcher (only when multiple kids) ── */}
        {kids.length > 1 && (
          <View style={{
            flexDirection: 'row',
            gap: 10,
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingTop: 2,
            paddingBottom: 10,
          }}>
            {kids.map(k => {
              const on = who === k.id;
              const m = getMascot(k.id);
              const ww = wardrobeState(kidDone(k.id) + (boost[k.id] || 0))
                .filter(w => w.got).map(w => w.id);
              return (
                <TouchableOpacity
                  key={k.id}
                  onPress={() => setWho(k.id)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 7,
                    paddingRight: 15,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: on ? theme.accent : theme.paper,
                    borderWidth: 1,
                    borderColor: on ? theme.accent : theme.line,
                    ...(on ? {
                      shadowColor: theme.accent,
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.35,
                      shadowRadius: 18,
                      elevation: 6,
                    } : {}),
                  }}
                >
                  <View style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: on ? 'rgba(255,253,247,0.25)' : theme.cream,
                    justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden',
                  }}>
                    <Bear size={30} stage={PET_BODY} accessories={ww} tone={k.tone} />
                  </View>
                  <Text style={{
                    fontFamily: theme.fonts.head,
                    fontSize: 14.5,
                    color: on ? '#FFFDF7' : theme.ink,
                  }}>{m ? m.name : k.bear}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Hero — Bear in its habitat ── */}
        <View style={{
          position: 'relative',
          marginHorizontal: 20,
          borderRadius: 30,
          overflow: 'hidden',
          paddingTop: 24,
          paddingBottom: 22,
          backgroundColor: theme.sand,
          borderWidth: 1,
          borderColor: theme.line,
        }}>
          {/* Star dots when star accessory is worn */}
          {wearing.includes('star') && (
            [[40, 38], [200, 54], [260, 150], [58, 176], [150, 28], [120, 200]].map(([x, y], i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: x % (SCREEN_W - 40),
                  top: y,
                  width: i % 2 ? 5 : 7,
                  height: i % 2 ? 5 : 7,
                  borderRadius: 999,
                  backgroundColor: theme.accent,
                  opacity: 0.22,
                }}
              />
            ))
          )}

          <View style={{
            position: 'relative',
            alignItems: 'center',
            marginTop: 6,
          }}>
            {/* Hearts */}
            {hearts.map(h => (
              <HeartParticle
                key={h.id}
                color={theme.accent}
                startX={`${h.left}%`}
                onDone={() => {}}
              />
            ))}

            {/* Tappable bear with squish + bob */}
            <TouchableOpacity onPress={pat} activeOpacity={1}>
              <Animated.View style={{
                transform: [
                  { scaleX: squishScaleX },
                  { scaleY: squishScaleY },
                ],
              }}>
                <Animated.View style={{
                  transform: [{ translateY: bobTranslateY }],
                }}>
                  <Bear
                    size={196}
                    stage={PET_BODY}
                    accessories={wearing}
                    tone={tone}
                    mood={mood}
                  />
                </Animated.View>
              </Animated.View>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', marginTop: 4, paddingHorizontal: 26 }}>
            <Text style={{
              fontFamily: theme.fonts.hand,
              fontSize: 18,
              color: theme.inkSoft,
              lineHeight: 29,
            }}>摸摸它，它最喜欢你了。</Text>
            <Text style={{
              marginTop: 4,
              fontFamily: theme.fonts.body,
              fontSize: 12.5,
              color: theme.inkSoft,
              opacity: 0.8,
            }}>
              {kidInfo.name}的{petName}{since ? ` · 从 ${since} 起一起长大` : ''}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          {/* ── Next unlock progress ── */}
          <Card style={{ marginTop: 20, padding: 18 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <Text style={{
                fontFamily: theme.fonts.head,
                fontSize: 16,
                color: theme.ink,
              }}>
                {nu ? '离下一件新装扮' : '所有装扮都集齐啦'}
              </Text>
              <Text style={{
                fontFamily: theme.fonts.body,
                fontSize: 13,
                color: theme.inkSoft,
              }}>已陪{kidInfo.name}做 {done} 件事</Text>
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              <Bear size={38} stage={PET_BODY} accessories={wearing} tone={tone} />
              <View style={{
                flex: 1,
                height: 12,
                borderRadius: 999,
                backgroundColor: theme.sand,
                overflow: 'hidden',
              }}>
                <View style={{
                  width: `${Math.round(ratio * 100)}%`,
                  height: '100%',
                  borderRadius: 999,
                  backgroundColor: theme.accent,
                }} />
              </View>
              <View style={{ opacity: nu ? 0.4 : 1 }}>
                <Bear
                  size={40}
                  stage={PET_BODY}
                  accessories={nu ? [nu.id] : wearing}
                  tone={tone}
                />
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              {nu ? (
                <Text style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 13.5,
                  color: theme.inkSoft,
                }}>
                  {'再做 '}
                  <Text style={{ color: theme.accent, fontFamily: theme.fonts.head }}>{remain}</Text>
                  {' 件，就会解锁 '}
                  <Text style={{ color: theme.accent, fontFamily: theme.fonts.head }}>「{nu.name}」</Text>
                  {'。'}
                </Text>
              ) : (
                <Text style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 13.5,
                  color: theme.inkSoft,
                }}>{petName}的小衣橱满满当当。它会一直陪着你们。</Text>
              )}
            </View>

            {/* Demo button */}
            <TouchableOpacity
              onPress={addOne}
              activeOpacity={0.7}
              style={{
                marginTop: 14,
                width: '100%',
                paddingVertical: 11,
                borderRadius: 14,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.line,
                backgroundColor: 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              {Icon.play(theme.inkSoft, 15)}
              <Text style={{
                fontFamily: theme.fonts.body,
                fontSize: 13,
                color: theme.inkSoft,
              }}>演示：再做一件事，看看会解锁什么</Text>
            </TouchableOpacity>
          </Card>

          {/* ── Wardrobe grid ── */}
          <View style={{
            marginTop: 26,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <Text style={{
              fontFamily: theme.fonts.head,
              fontSize: 17,
              color: theme.ink,
            }}>{petName}的小衣橱</Text>
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 13,
              color: theme.inkSoft,
            }}>已解锁 {unlockedCount}/{totalItems}</Text>
          </View>
          <Text style={{
            fontFamily: theme.fonts.body,
            fontSize: 12.5,
            color: theme.inkSoft,
            marginBottom: 14,
          }}>点一下解锁的装扮，给{petName}穿上或取下。</Text>

          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: gridGap,
          }}>
            {wardrobeItems.map(w => {
              const on = wearing.includes(w.id);
              return (
                <TouchableOpacity
                  key={w.id}
                  disabled={!w.got}
                  onPress={() => w.got && toggleWear(w.id)}
                  activeOpacity={0.8}
                  style={{
                    width: itemWidth,
                    borderRadius: 18,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    backgroundColor: on ? theme.paper : (w.got ? theme.paper : 'rgba(255,253,247,0.5)'),
                    borderWidth: 1.5,
                    borderColor: on ? theme.accent : theme.line,
                    borderStyle: on ? 'solid' : (w.got ? 'solid' : 'dashed'),
                    ...(on ? {
                      shadowColor: theme.accent,
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.35,
                      shadowRadius: 22,
                      elevation: 6,
                    } : {}),
                  }}
                >
                  {/* Check badge */}
                  {w.got && (
                    <View style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: on ? theme.accent : theme.sand,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      {on ? Icon.check('#FFFDF7', 12) : null}
                    </View>
                  )}

                  {/* Bear preview */}
                  <View style={{
                    height: 62,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: w.got ? 1 : 0.32,
                  }}>
                    <Bear size={58} stage={PET_BODY} accessories={[w.id]} tone={tone} />
                  </View>

                  {/* Label */}
                  <Text style={{
                    marginTop: 4,
                    fontFamily: theme.fonts.head,
                    fontSize: 13.5,
                    color: w.got ? theme.ink : theme.inkSoft,
                    textAlign: 'center',
                  }}>
                    {w.got ? w.name : '？？？'}
                  </Text>

                  {/* Status */}
                  <View style={{
                    marginTop: 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {w.got ? (
                      on ? (
                        <Text style={{
                          fontFamily: theme.fonts.body,
                          fontSize: 11,
                          color: theme.accent,
                        }}>穿戴中</Text>
                      ) : (
                        <Text style={{
                          fontFamily: theme.fonts.body,
                          fontSize: 11,
                          color: theme.inkSoft,
                        }}>点一下穿上</Text>
                      )
                    ) : (
                      <>
                        {Icon.lock(theme.inkSoft, 11)}
                        <Text style={{
                          fontFamily: theme.fonts.body,
                          fontSize: 11,
                          color: theme.inkSoft,
                        }}>第 {w.at} 件解锁</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Growth diary ── */}
          {diaryLog.length > 0 && (
            <Section title="成长日记" style={{ marginTop: 30 }}>
              <View style={{ position: 'relative', paddingLeft: 22 }}>
                {/* Timeline line */}
                <View style={{
                  position: 'absolute',
                  left: 5,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  backgroundColor: theme.line,
                }} />

                {diaryLog.map((l, i) => (
                  <View key={i} style={{ position: 'relative', marginBottom: 18 }}>
                    {/* Timeline dot */}
                    <View style={{
                      position: 'absolute',
                      left: -22,
                      top: 4,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: theme.accent,
                      borderWidth: 2,
                      borderColor: theme.cream,
                    }} />
                    <Text style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 15,
                      color: theme.ink,
                      lineHeight: 22.5,
                    }}>{l.text}</Text>
                    <Text style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 12.5,
                      color: theme.inkSoft,
                      marginTop: 2,
                    }}>{l.from}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}
        </View>
      </ScrollView>

      {/* ── Unlock moment overlay ── */}
      <UnlockMoment
        visible={!!unlock}
        item={unlock?.item}
        mascot={unlock?.mascot}
        onClose={() => setUnlock(null)}
      />
    </View>
  );
}
