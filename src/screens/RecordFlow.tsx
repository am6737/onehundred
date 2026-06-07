// RecordFlow.js — multi-step recording flow: choose modality, capture, celebrate.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Animated, Dimensions, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE, COLORS } from '../theme/tokens';
import { PERSPECTIVES, getKid, kidLabel, meName, KIDS } from '../data';
import { Icon, PhotoSlot } from '../components/Icons';
import { LayerHeader, PrimaryButton, SecondaryButton, Chip, Sheet } from '../components/common';

/* ── VoiceRecorder ── */

function VoiceRecorder({ active, paused, theme }) {
  const [t, setT] = useState(0);
  const counting = active && !paused;

  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setT(x => x + 1), 1000);
    return () => clearInterval(id);
  }, [counting]);

  const mm = String(Math.floor(t / 60)).padStart(1, '0');
  const ss = String(t % 60).padStart(2, '0');

  const bars = [10, 22, 38, 18, 46, 28, 58, 34, 50, 24, 60, 26, 52, 30, 44, 20, 40, 16, 30, 14, 24];

  return (
    <View style={{ alignItems: 'center', paddingVertical: 30 }}>
      {/* Waveform bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 4 }}>
        {bars.map((base, i) => {
          const h = counting
            ? base * (0.55 + 0.45 * Math.abs(Math.sin((t + i) * 0.9)))
            : base * 0.5;
          return (
            <View
              key={i}
              style={{
                width: 4,
                height: h,
                borderRadius: 4,
                backgroundColor: theme.accent,
                opacity: counting ? 0.85 : 0.3,
              }}
            />
          );
        })}
      </View>

      {/* Timer */}
      <Text style={{
        fontFamily: 'monospace',
        fontSize: 30,
        color: theme.ink,
        marginTop: 26,
      }}>
        {mm}:{ss}
      </Text>

      {/* Status label */}
      <Text style={{
        fontFamily: theme.fonts.body,
        fontSize: 14,
        color: theme.inkSoft,
        marginTop: 8,
      }}>
        {!active ? '已录好这一段' : paused ? '已暂停 · 轻点继续' : '正在录音…'}
      </Text>
    </View>
  );
}

/* ── Main RecordFlow screen ── */

export default function RecordFlow({ route, navigation }) {
  const { level, kidId, me } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const t = TONE[level.tone] || TONE.orange;

  // Step: 0 = choose modality, 1 = capture, 2 = celebration
  const [step, setStep] = useState(0);
  const [type, setType] = useState(level.suggest || 'voice');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(0);
  const [video, setVideo] = useState(false);
  const [place, setPlace] = useState('');
  const [caption, setCaption] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const MAX_SHOTS = 6;

  // Step transition animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateStep = (nextStep) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(-30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  // Celebration scale animation
  const celebScale = useRef(new Animated.Value(0.6)).current;
  const celebOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 2) {
      Animated.parallel([
        Animated.spring(celebScale, {
          toValue: 1,
          damping: 12,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.timing(celebOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      celebScale.setValue(0.6);
      celebOpacity.setValue(0);
    }
  }, [step]);

  // Simulated voice transcription
  const TRANSCRIPT_SEED =
    '（自动转写）今天我们一起做了这件事，我想把当时说的话留下来……这一段，等很久以后再听，一定还是热的。';

  useEffect(() => {
    if (step !== 1 || type !== 'voice') return;
    if (transcript) return;
    setTranscribing(true);
    const id = setTimeout(() => {
      setTranscript(TRANSCRIPT_SEED);
      setTranscribing(false);
    }, 1700);
    return () => clearTimeout(id);
  }, [step, type]);

  // Auto-navigate away from celebration after 2.2s
  useEffect(() => {
    if (step !== 2) return;
    const id = setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, 2200);
    return () => clearTimeout(id);
  }, [step]);

  const types = [
    { k: 'voice', label: '录一段语音', sub: '最省事，最珍贵', icon: Icon.mic },
    { k: 'photo', label: '拍/选一张照片', sub: '留住此刻的样子', icon: Icon.camera },
    { k: 'video', label: '拍/选一段视频', sub: '连声音和动作一起留住', icon: Icon.video },
    { k: 'text', label: '写几句话', sub: '安静地写下来', icon: Icon.pen },
  ];

  const startCapture = (k) => {
    setType(k);
    animateStep(1);
    if (k === 'voice') {
      setRecording(true);
      setPaused(false);
    }
  };

  const captureReady =
    type === 'voice' ? true
    : type === 'photo' ? photo > 0
    : type === 'video' ? video
    : text.trim().length > 0;

  const finish = () => {
    // Build the memory record (simulated)
    const note = caption.trim();
    const mem = {
      id: 'new',
      levelNum: level.num,
      perspective: level.perspective,
      type,
      dur: type === 'voice' ? '0:37' : type === 'video' ? '0:24' : undefined,
      shots: type === 'photo' ? photo : undefined,
      date: '今天',
      place: place.trim() || '没有记地点',
      title: level.title,
      caption:
        type === 'text' && text.trim()
          ? text.trim()
          : note || '这一刻，被记下来了。',
      transcript: type === 'voice' ? transcript.trim() : undefined,
      tone: level.tone,
      fresh: true,
    };
    animateStep(2);
  };

  const handleBack = () => {
    if (step === 0) {
      if (navigation.canGoBack()) navigation.goBack();
    } else {
      animateStep(0);
    }
  };

  const placeOptions = ['家里', '奶奶家', '小区楼下', '公园', '幼儿园', '路上'];

  /* ── Text starters ── */
  const sealedStarters = [
    '亲爱的，等你看到这封信的时候…',
    '有件事我一直想对你说——',
    '今天的你还很小，可我已经想象…',
  ];
  const normalStarters = [
    '今天，我们一起',
    '我永远会记得那一刻——',
    'TA 听完之后，',
    '最让我心头一软的是',
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      {/* Header — hide on celebration step */}
      {step < 2 && (
        <LayerHeader
          title="记录一下"
          onBack={handleBack}
        />
      )}

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* ══════ STEP 0 — Choose modality ══════ */}
        {step === 0 && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 24, paddingTop: 8, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Activity title */}
            <Text style={{
              fontFamily: theme.fonts.head,
              fontSize: 22,
              color: theme.ink,
              marginBottom: 6,
              marginHorizontal: 4,
            }}>
              {level.title}
            </Text>

            {/* Record prompt */}
            <Text style={{
              fontFamily: theme.fonts.body,
              fontSize: 14.5,
              lineHeight: 24,
              color: theme.inkSoft,
              marginHorizontal: 4,
              marginBottom: 22,
            }}>
              {level.record}
            </Text>

            {/* Modality buttons */}
            {types.map((ty) => {
              const rec = ty.k === level.suggest;
              return (
                <TouchableOpacity
                  key={ty.k}
                  activeOpacity={0.7}
                  onPress={() => startCapture(ty.k)}
                  style={[
                    styles.modalityBtn,
                    {
                      backgroundColor: theme.paper,
                      borderColor: rec ? theme.accent : theme.line,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  {/* Icon circle */}
                  <View style={[
                    styles.modalityIcon,
                    { backgroundColor: rec ? theme.accent : t.soft },
                  ]}>
                    {ty.icon(rec ? '#FFFDF7' : t.ink, 24)}
                  </View>

                  {/* Labels */}
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: theme.fonts.head,
                      fontSize: 18,
                      color: theme.ink,
                    }}>
                      {ty.label}
                    </Text>
                    <Text style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 13,
                      color: theme.inkSoft,
                      marginTop: 2,
                    }}>
                      {ty.sub}
                    </Text>
                  </View>

                  {/* Recommended badge */}
                  {rec && (
                    <View style={[styles.recBadge, { backgroundColor: t.soft }]}>
                      <Text style={{
                        fontFamily: theme.fonts.head,
                        fontSize: 12,
                        color: theme.accent,
                      }}>
                        推荐
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ══════ STEP 1 — Capture ══════ */}
        {step === 1 && (
          <View style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: 24,
                paddingTop: 8,
                paddingBottom: 130,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Voice capture ── */}
              {type === 'voice' && (
                <>
                  <VoiceRecorder active={recording} paused={paused} theme={theme} />

                  {/* Record/pause button */}
                  {recording && (
                    <View style={{ alignItems: 'center', marginTop: 6 }}>
                      <TouchableOpacity
                        onPress={() => setPaused(p => !p)}
                        activeOpacity={0.8}
                        style={[styles.recordBtn, {
                          backgroundColor: theme.accent,
                        }]}
                      >
                        {paused ? (
                          // Play triangle
                          <View style={{
                            width: 0, height: 0, marginLeft: 4,
                            borderTopWidth: 13, borderTopColor: 'transparent',
                            borderBottomWidth: 13, borderBottomColor: 'transparent',
                            borderLeftWidth: 20, borderLeftColor: '#FFFDF7',
                          }} />
                        ) : (
                          // Pause bars
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <View style={styles.pauseBar} />
                            <View style={styles.pauseBar} />
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Transcript section */}
                  <View style={{ marginTop: 26 }}>
                    <View style={styles.sectionLabel}>
                      {Icon.pen(theme.accent, 15)}
                      <Text style={{
                        fontFamily: theme.fonts.body,
                        fontSize: 13,
                        color: theme.inkSoft,
                        marginLeft: 7,
                      }}>
                        语音文字 · 自动转写
                      </Text>
                      {transcribing && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
                          <View style={[styles.transcribeDot, { backgroundColor: theme.accent }]} />
                          <Text style={{
                            fontFamily: theme.fonts.body,
                            fontSize: 12,
                            color: theme.accent,
                            marginLeft: 6,
                          }}>
                            正在转文字…
                          </Text>
                        </View>
                      )}
                    </View>

                    {transcribing ? (
                      <View style={[styles.transcribeLoading, {
                        borderColor: theme.line,
                        backgroundColor: theme.paper,
                      }]}>
                        {[92, 76, 84].map((w, i) => (
                          <View
                            key={i}
                            style={{
                              height: 11,
                              width: `${w}%`,
                              borderRadius: 6,
                              backgroundColor: theme.sand,
                              marginBottom: i < 2 ? 12 : 0,
                            }}
                          />
                        ))}
                      </View>
                    ) : (
                      <>
                        <TextInput
                          value={transcript}
                          onChangeText={setTranscript}
                          placeholder="录音的文字会出现在这里，可以随手改…"
                          placeholderTextColor={theme.inkSoft}
                          multiline
                          style={[styles.transcriptInput, {
                            borderColor: theme.line,
                            backgroundColor: theme.paper,
                            color: theme.ink,
                            fontFamily: theme.fonts.body,
                          }]}
                        />
                        <Text style={{
                          marginTop: 7,
                          paddingLeft: 2,
                          fontFamily: theme.fonts.body,
                          fontSize: 12,
                          color: theme.inkSoft,
                          lineHeight: 19,
                        }}>
                          自动转写可能不准，改两个字就好。原声会一起留着。
                        </Text>
                      </>
                    )}
                  </View>
                </>
              )}

              {/* ── Photo capture ── */}
              {type === 'photo' && (
                <View style={{ marginTop: 8 }}>
                  {photo === 0 ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setPhoto(1)}
                    >
                      <PhotoSlot
                        tone={level.tone}
                        radius={24}
                        label="轻点添加照片"
                        style={{
                          height: 300,
                          aspectRatio: undefined,
                          borderWidth: 2,
                          borderStyle: 'dashed',
                          borderColor: 'rgba(58,51,43,0.18)',
                        }}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View>
                      {/* Cover photo */}
                      <View style={{ position: 'relative' }}>
                        <PhotoSlot
                          tone={level.tone}
                          radius={24}
                          label=""
                          style={{
                            height: 268,
                            aspectRatio: undefined,
                            borderWidth: 2,
                            borderColor: theme.accent,
                          }}
                        >
                          {/* Cover badge */}
                          <View style={{ position: 'absolute', top: 12, left: 12 }}>
                            <View style={[styles.coverBadge, { backgroundColor: theme.accent }]}>
                              <Text style={{
                                fontFamily: theme.fonts.head,
                                fontSize: 12,
                                color: '#FFFDF7',
                              }}>
                                封面
                              </Text>
                            </View>
                          </View>
                          {/* Check icon */}
                          <View style={styles.photoCheck}>
                            {Icon.check(t.deep, 22)}
                          </View>
                        </PhotoSlot>
                      </View>

                      {/* Additional photo slots + add button */}
                      <View style={styles.photoRow}>
                        {Array.from({ length: photo - 1 }).map((_, i) => (
                          <PhotoSlot
                            key={i}
                            tone={level.tone}
                            radius={14}
                            label=""
                            style={{
                              width: 66, height: 66,
                              aspectRatio: undefined,
                              borderWidth: 1,
                              borderColor: theme.line,
                            }}
                          />
                        ))}
                        {photo < MAX_SHOTS && (
                          <TouchableOpacity
                            onPress={() => setPhoto(p => p + 1)}
                            style={[styles.addPhotoBtn, {
                              borderColor: 'rgba(58,51,43,0.22)',
                              backgroundColor: theme.paper,
                            }]}
                          >
                            {Icon.plus(theme.inkSoft, 20)}
                            <Text style={{
                              fontFamily: theme.fonts.body,
                              fontSize: 10.5,
                              color: theme.inkSoft,
                            }}>
                              再加
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Photo count */}
                      <Text style={{
                        marginTop: 12,
                        marginHorizontal: 4,
                        fontFamily: theme.fonts.body,
                        fontSize: 12.5,
                        color: theme.inkSoft,
                        lineHeight: 20,
                      }}>
                        {photo >= MAX_SHOTS
                          ? `已选 ${photo} 张 · 第一张作封面`
                          : `已选 ${photo} 张 · 第一张作封面，最多 ${MAX_SHOTS} 张`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── Video capture ── */}
              {type === 'video' && (
                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setVideo(true)}
                  >
                    <PhotoSlot
                      tone={level.tone}
                      radius={24}
                      label=""
                      style={{
                        height: 300,
                        aspectRatio: undefined,
                        borderWidth: 2,
                        borderColor: video ? theme.accent : 'rgba(58,51,43,0.18)',
                        borderStyle: video ? 'solid' : 'dashed',
                      }}
                    >
                      <View style={{ alignItems: 'center' }}>
                        <View style={styles.videoIconCircle}>
                          {video ? Icon.play(t.deep, 26) : Icon.video(t.deep, 28)}
                        </View>
                        <View style={styles.videoLabel}>
                          <Text style={{
                            fontFamily: theme.fonts.body,
                            fontSize: 13.5,
                            color: theme.ink,
                          }}>
                            {video ? '✓ 已选好视频 · 0:24' : '轻点拍摄或选择视频'}
                          </Text>
                        </View>
                      </View>
                    </PhotoSlot>
                  </TouchableOpacity>
                  <Text style={{
                    marginTop: 12,
                    marginHorizontal: 4,
                    textAlign: 'center',
                    fontFamily: theme.fonts.body,
                    fontSize: 12.5,
                    color: theme.inkSoft,
                    lineHeight: 20,
                  }}>
                    短短一小段就好，几十秒最耐看。
                  </Text>
                </View>
              )}

              {/* ── Text capture ── */}
              {type === 'text' && (
                <View style={{ marginTop: 8 }}>
                  {/* Starter prompts */}
                  {text.trim().length === 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{
                        fontFamily: theme.fonts.body,
                        fontSize: 13,
                        color: theme.inkSoft,
                        marginBottom: 9,
                        paddingLeft: 2,
                      }}>
                        {level.sealed
                          ? '不知从哪写起？轻点一句开头'
                          : '不知从哪写起？轻点一句，帮你起个头'}
                      </Text>
                      <View style={styles.starterRow}>
                        {(level.sealed ? sealedStarters : normalStarters).map(s => (
                          <TouchableOpacity
                            key={s}
                            onPress={() => setText(s + (level.sealed ? '\n' : ''))}
                            style={[styles.starterChip, {
                              backgroundColor: theme.paper,
                              borderColor: theme.line,
                            }]}
                          >
                            <Text style={{
                              fontFamily: theme.fonts.body,
                              fontSize: 13.5,
                              color: theme.ink,
                              lineHeight: 18,
                            }}>
                              {s}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Text area */}
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    autoFocus
                    multiline
                    placeholder={
                      level.sealed
                        ? '亲爱的，等你看到这封信的时候…'
                        : '随便写写，几句话就够了…'
                    }
                    placeholderTextColor={theme.inkSoft}
                    style={[styles.textArea, {
                      borderColor: theme.line,
                      backgroundColor: theme.paper,
                      color: theme.ink,
                      fontFamily: level.sealed ? theme.fonts.hand : theme.fonts.body,
                      fontSize: level.sealed ? 20 : 16,
                    }]}
                  />

                  {/* Word count */}
                  <Text style={{
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: theme.inkSoft,
                    marginTop: 6,
                  }}>
                    {text.length} 字
                  </Text>
                </View>
              )}

              {/* ── Caption for photo/video ── */}
              {(type === 'photo' || type === 'video') && (
                <View style={{ marginTop: 24 }}>
                  <View style={styles.sectionLabel}>
                    {Icon.pen(theme.accent, 15)}
                    <Text style={{
                      fontFamily: theme.fonts.body,
                      fontSize: 13,
                      color: theme.inkSoft,
                      marginLeft: 7,
                    }}>
                      配一句话（想写就写，不写也行）
                    </Text>
                  </View>
                  <TextInput
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    numberOfLines={2}
                    placeholder={
                      level.suggest === 'photo'
                        ? '比如：咸得离谱的一盘，却是最热闹的一顿…'
                        : '比如：她回头喊「爸爸你松手啦」那一秒…'
                    }
                    placeholderTextColor={theme.inkSoft}
                    style={[styles.captionInput, {
                      borderColor: theme.line,
                      backgroundColor: theme.paper,
                      color: theme.ink,
                      fontFamily: theme.fonts.body,
                    }]}
                  />
                </View>
              )}

              {/* ── Place selection ── */}
              <View style={{ marginTop: 24 }}>
                <View style={styles.sectionLabel}>
                  {Icon.pin(theme.inkSoft, 15)}
                  <Text style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    color: theme.inkSoft,
                    marginLeft: 7,
                  }}>
                    在哪儿？（想记就记，不记也行）
                  </Text>
                </View>
                <TextInput
                  value={place}
                  onChangeText={setPlace}
                  placeholder="比如：奶奶家的院子、小区楼下…"
                  placeholderTextColor={theme.inkSoft}
                  style={[styles.placeInput, {
                    borderColor: theme.line,
                    backgroundColor: theme.paper,
                    color: theme.ink,
                    fontFamily: theme.fonts.body,
                  }]}
                />
                <View style={styles.placeChips}>
                  {placeOptions.map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setPlace(s)}
                      style={[
                        styles.placeChip,
                        {
                          backgroundColor: place === s ? theme.accent : theme.paper,
                          borderColor: place === s ? theme.accent : theme.line,
                        },
                      ]}
                    >
                      <Text style={{
                        fontFamily: theme.fonts.body,
                        fontSize: 13,
                        lineHeight: 16,
                        color: place === s ? '#FFFDF7' : theme.ink,
                      }}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* ── Bottom submit button ── */}
            <View style={[styles.bottomBar, {
              paddingBottom: insets.bottom + 16,
            }]}>
              {/* Gradient overlay simulated with a semi-transparent bg */}
              <View style={[StyleSheet.absoluteFill, {
                backgroundColor: theme.cream,
                opacity: 0.92,
              }]} />
              <TouchableOpacity
                disabled={!captureReady}
                onPress={finish}
                activeOpacity={0.8}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: captureReady ? theme.accent : theme.sand,
                  },
                ]}
              >
                <Text style={{
                  fontFamily: theme.fonts.head,
                  fontSize: 17,
                  color: captureReady ? '#FFFDF7' : theme.inkSoft,
                }}>
                  {level.sealed ? '封存这封信' : '就这样，收好它'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════ STEP 2 — Celebration ══════ */}
        {step === 2 && (
          <Animated.View
            style={[
              styles.celebContainer,
              {
                opacity: celebOpacity,
                transform: [{ scale: celebScale }],
              },
            ]}
          >
            {/* Checkmark + message */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {Icon.check(COLORS.green, 18)}
              <Text style={{
                fontFamily: theme.fonts.head,
                fontSize: 15,
                color: COLORS.green,
              }}>
                已加入你们的回忆册
              </Text>
            </View>

            <Text style={{
              fontFamily: theme.fonts.head,
              fontSize: 24,
              lineHeight: 36,
              color: theme.ink,
              textAlign: 'center',
              marginTop: 12,
            }}>
              {level.sealed ? '信，已经封好了' : '这件事，做到了'}
            </Text>

            <Text style={{
              fontFamily: theme.fonts.hand,
              fontSize: 19,
              lineHeight: 34,
              color: theme.inkSoft,
              textAlign: 'center',
              marginTop: 10,
            }}>
              {level.sealed
                ? '等约定的那天，它会自己出现。'
                : '团子又长大了一点点。'}
            </Text>

          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Step 0 — modality buttons */
  modalityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 22,
    marginBottom: 14,
  },
  modalityIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  recBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },

  /* Step 1 — capture */
  recordBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  pauseBar: {
    width: 7,
    height: 26,
    borderRadius: 2,
    backgroundColor: '#FFFDF7',
  },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 2,
  },
  transcribeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  transcribeLoading: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  transcriptInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    lineHeight: 28,
    textAlignVertical: 'top',
  },

  /* Photo */
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  coverBadge: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoCheck: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,253,247,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBtn: {
    width: 66,
    height: 66,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },

  /* Video */
  videoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,253,247,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: 'rgba(58,51,43,0.5)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  videoLabel: {
    marginTop: 14,
    backgroundColor: 'rgba(255,253,247,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  /* Text */
  starterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  starterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 200,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    lineHeight: 30,
    textAlignVertical: 'top',
  },

  /* Caption */
  captionInput: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 25,
    textAlignVertical: 'top',
  },

  /* Place */
  placeInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
  },
  placeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  placeChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  submitBtn: {
    width: '100%',
    padding: 15,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Step 2 — celebration */
  celebContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
});
