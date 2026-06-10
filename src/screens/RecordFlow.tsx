// RecordFlow — multi-step recording flow: choose modality, capture, celebrate.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Animated, StyleSheet, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE, COLORS } from '../theme/tokens';
import { PERSPECTIVES, meName, NOW_YM } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, PhotoSlot } from '../components/Icons';
import { LayerHeader, PrimaryButton, SecondaryButton, Chip, Sheet } from '../components/common';
import { supabase } from '../lib/supabase';

/* ── VoiceRecorder ── */

function VoiceRecorder({ active, paused, theme, elapsedRef }) {
  const [t, setT] = useState(0);
  const counting = active && !paused;

  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setT(x => {
      const next = x + 1;
      if (elapsedRef) elapsedRef.current = next;
      return next;
    }), 1000);
    return () => clearInterval(id);
  }, [counting]);

  const mm = String(Math.floor(t / 60)).padStart(1, '0');
  const ss = String(t % 60).padStart(2, '0');

  const bars = [10, 22, 38, 18, 46, 28, 58, 34, 50, 24, 60, 26, 52, 30, 44, 20, 40, 16, 30, 14, 24];

  return (
    <View style={{ alignItems: 'center', paddingVertical: 30 }}>
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

      <Text style={{
        fontFamily: 'monospace',
        fontSize: 30,
        color: theme.ink,
        marginTop: 26,
      }}>
        {mm}:{ss}
      </Text>

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

/* ── Storage upload helper ── */

async function uploadToStorage(uri, userId, memoryId, filename) {
  try {
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'bin';
    const path = `${userId}/${memoryId}/${filename}.${ext}`;
    const contentType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'heic' ? 'image/heic' :
      ext === 'mp4' ? 'video/mp4' :
      ext === 'mov' ? 'video/quicktime' :
      ext === 'm4a' ? 'audio/m4a' :
      ext === 'caf' ? 'audio/x-caf' :
      ext === 'wav' ? 'audio/wav' :
      'application/octet-stream';

    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from('memories')
      .upload(path, blob, { contentType, upsert: true });
    if (error) console.warn('Storage upload:', error.message);
    return path;
  } catch (e) {
    console.warn('Upload failed:', e);
    return null;
  }
}

/* ── Main RecordFlow screen ── */

export default function RecordFlow({ route, navigation }) {
  const { level, kidId: rawKidId, me } = route.params;
  const { theme } = useTheme();
  const { kids, addMemory } = useData();
  // 'all' 是合法的 kid_id（全家），兜底用它，避免 kid_id 为空导致保存失败
  const kidId = (rawKidId && rawKidId !== 'all') ? rawKidId : (kids[0]?.id || 'all');
  const insets = useSafeAreaInsets();
  const t = TONE[level.tone] || TONE.orange;

  const [step, setStep] = useState(0);
  const [type, setType] = useState(level.suggest || 'voice');

  // Voice
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordingDone, setRecordingDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const soundRef = useRef<AudioPlayer | null>(null);
  const recordingUriRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const savedMemRef = useRef(null); // 保存成功后的 memory，庆祝页结束时跳详情用

  // Photo — array of real URIs
  const [photos, setPhotos] = useState([]);

  // Video — real URI + duration
  const [videoUri, setVideoUri] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoPlayer = useVideoPlayer(null);
  const { isPlaying } = useEvent(videoPlayer, 'playingChange', { isPlaying: videoPlayer.playing });
  useEventListener(videoPlayer, 'playToEnd', () => {
    // 播完回到首帧，方便再看一遍
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
  });
  useEffect(() => {
    if (videoUri) videoPlayer.replaceAsync(videoUri).catch(() => {});
  }, [videoUri]);

  // Text
  const [text, setText] = useState('');

  // Common
  const [place, setPlace] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
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

  // Celebration animation
  const celebScale = useRef(new Animated.Value(0.6)).current;
  const celebOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 2) {
      Animated.parallel([
        Animated.spring(celebScale, {
          toValue: 1, damping: 12, stiffness: 150, useNativeDriver: true,
        }),
        Animated.timing(celebOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
      ]).start();
    } else {
      celebScale.setValue(0.6);
      celebOpacity.setValue(0);
    }
  }, [step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.release();
        soundRef.current = null;
      }
    };
  }, []);

  // Auto-close celebration → 进入这条回忆的详情页（封存的信除外）
  useEffect(() => {
    if (step !== 2) return;
    const id = setTimeout(() => {
      const mem = savedMemRef.current;
      if (mem && !level.sealed) {
        navigation.replace('Memory', { memory: mem });
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, 2200);
    return () => clearTimeout(id);
  }, [step]);

  /* ── Voice recording ── */

  const startRealRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('需要麦克风权限', '请在设置中允许访问麦克风');
        return false;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      return true;
    } catch (e) {
      console.error('Recording start failed:', e);
      Alert.alert('录音失败', '请检查麦克风权限');
      return false;
    }
  };

  const togglePauseRecording = async () => {
    try {
      if (paused) {
        audioRecorder.record();
        setPaused(false);
      } else {
        audioRecorder.pause();
        setPaused(true);
      }
    } catch (e) {
      console.error('Pause/resume failed:', e);
    }
  };

  const stopRecordingAction = async () => {
    try {
      await audioRecorder.stop();
      recordingUriRef.current = audioRecorder.uri;
      setRecording(false);
      setRecordingDone(true);
      await setAudioModeAsync({ allowsRecording: false });
    } catch (e) {
      console.error('Stop recording failed:', e);
    }
  };

  const togglePlayback = async () => {
    const uri = recordingUriRef.current;
    if (!uri) return;
    try {
      if (soundRef.current) {
        if (soundRef.current.playing) {
          soundRef.current.pause();
          setPlaying(false);
        } else {
          soundRef.current.seekTo(0);
          soundRef.current.play();
          setPlaying(true);
        }
        return;
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer(uri);
      soundRef.current = player;
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.didJustFinish) setPlaying(false);
      });
      player.play();
      setPlaying(true);
    } catch (e) {
      console.error('Playback failed:', e);
    }
  };

  // Simulated transcription (real transcription needs an external ASR service)
  const TRANSCRIPT_SEED =
    '（自动转写）今天我们一起做了这件事，我想把当时说的话留下来……这一段，等很久以后再听，一定还是热的。';

  useEffect(() => {
    if (step !== 1 || type !== 'voice') return;
    if (transcript) return;
    if (recording) return;
    if (!recordingDone) return;
    setTranscribing(true);
    const id = setTimeout(() => {
      setTranscript(TRANSCRIPT_SEED);
      setTranscribing(false);
    }, 1700);
    return () => clearTimeout(id);
  }, [step, type, recording, recordingDone]);

  /* ── Photo capture ── */

  const addPhotos = async (fromCamera) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('需要相机权限', '请在设置中允许访问相机');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.length > 0) {
          setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, MAX_SHOTS));
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('需要相册权限', '请在设置中允许访问相册');
          return;
        }
        const remaining = MAX_SHOTS - photos.length;
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: remaining > 0 ? remaining : 1,
        });
        if (!result.canceled && result.assets?.length > 0) {
          setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, MAX_SHOTS));
        }
      }
    } catch (e) {
      console.error('Photo pick failed:', e);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('添加照片', '', [
      { text: '拍照', onPress: () => addPhotos(true) },
      { text: '从相册选择', onPress: () => addPhotos(false) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  /* ── Video capture ── */

  const pickVideoMedia = async (fromCamera) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('需要相机权限', '请在设置中允许访问相机');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['videos'],
          videoMaxDuration: 60,
        });
        if (!result.canceled && result.assets?.length > 0) {
          const asset = result.assets[0];
          setVideoUri(asset.uri);
          setVideoDuration(Math.round((asset.duration || 0) / 1000));
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('需要相册权限', '请在设置中允许访问相册');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
        });
        if (!result.canceled && result.assets?.length > 0) {
          const asset = result.assets[0];
          setVideoUri(asset.uri);
          setVideoDuration(Math.round((asset.duration || 0) / 1000));
        }
      }
    } catch (e) {
      console.error('Video pick failed:', e);
    }
  };

  const showVideoOptions = () => {
    Alert.alert('添加视频', '', [
      { text: '拍摄视频', onPress: () => pickVideoMedia(true) },
      { text: '从相册选择', onPress: () => pickVideoMedia(false) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  /* ── Navigation & types ── */

  const types = [
    { k: 'voice', label: '录一段语音', sub: '最省事，最珍贵', icon: Icon.mic },
    { k: 'photo', label: '拍/选一张照片', sub: '留住此刻的样子', icon: Icon.camera },
    { k: 'video', label: '拍/选一段视频', sub: '连声音和动作一起留住', icon: Icon.video },
    { k: 'text', label: '写几句话', sub: '安静地写下来', icon: Icon.pen },
  ];

  const startCapture = async (k) => {
    setType(k);
    animateStep(1);
    if (k === 'voice') {
      const started = await startRealRecording();
      if (started) {
        setRecording(true);
        setPaused(false);
      }
    }
  };

  const captureReady =
    type === 'voice' ? (recording || recordingDone)
    : type === 'photo' ? photos.length > 0
    : type === 'video' ? videoUri !== null
    : text.trim().length > 0;


  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (type === 'voice' && recording) {
        await stopRecordingAction();
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const memoryId = `m${Date.now()}`;
      const note = caption.trim();

      let dur;
      if (type === 'voice') {
        const secs = elapsedRef.current;
        dur = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      } else if (type === 'video' && videoDuration > 0) {
        dur = `${Math.floor(videoDuration / 60)}:${String(videoDuration % 60).padStart(2, '0')}`;
      }

      // Upload media files (fire-and-forget, don't block save)
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'anon';

      if (type === 'photo' && photos.length > 0) {
        photos.forEach((uri, i) => {
          uploadToStorage(uri, userId, memoryId, `photo_${i}`);
        });
      } else if (type === 'video' && videoUri) {
        uploadToStorage(videoUri, userId, memoryId, 'video_0');
      } else if (type === 'voice' && recordingUriRef.current) {
        uploadToStorage(recordingUriRef.current, userId, memoryId, 'audio_0');
      }

      savedMemRef.current = await addMemory({
        id: memoryId, // 与媒体文件的存储路径保持同一个 id
        kid: kidId,
        levelNum: level.num,
        perspective: level.perspective,
        type,
        dur,
        shots: type === 'photo' ? photos.length : undefined,
        date: dateStr,
        place: place.trim() || null,
        title: level.title,
        caption:
          type === 'text' && text.trim()
            ? text.trim()
            : note || '这一刻，被记下来了。',
        transcript: type === 'voice' ? transcript.trim() : undefined,
        tone: level.tone,
      });
      animateStep(2);
    } catch (e) {
      console.error('Failed to save memory:', e);
      Alert.alert('没保存成功', '这条记录还没存上，请检查网络后再试一次。');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      if (navigation.canGoBack()) navigation.goBack();
    } else {
      if (recording) {
        audioRecorder.stop().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.release();
        soundRef.current = null;
      }
      setRecording(false);
      setRecordingDone(false);
      setPhotos([]);
      videoPlayer.pause();
      setVideoUri(null);
      setText('');
      setTranscript('');
      animateStep(0);
    }
  };

  const placeOptions = ['家里', '奶奶家', '小区楼下', '公园', '幼儿园', '路上'];

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
      {step < 2 && (
        <LayerHeader title="记录一下" onBack={handleBack} />
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
            <Text style={{
              fontFamily: theme.fonts.head,
              fontSize: 22,
              color: theme.ink,
              marginBottom: 6,
              marginHorizontal: 4,
            }}>
              {level.title}
            </Text>

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
                  <View style={[
                    styles.modalityIcon,
                    { backgroundColor: rec ? theme.accent : t.soft },
                  ]}>
                    {ty.icon(rec ? '#FFFDF7' : t.ink, 24)}
                  </View>

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
                  <VoiceRecorder active={recording} paused={paused} theme={theme} elapsedRef={elapsedRef} />

                  {/* Record controls */}
                  {recording && (
                    <View style={{ alignItems: 'center', marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                        {/* Pause / Resume */}
                        <TouchableOpacity
                          onPress={togglePauseRecording}
                          activeOpacity={0.8}
                          style={[styles.recordBtn, { backgroundColor: theme.accent }]}
                        >
                          {paused ? (
                            <View style={{
                              width: 0, height: 0, marginLeft: 4,
                              borderTopWidth: 13, borderTopColor: 'transparent',
                              borderBottomWidth: 13, borderBottomColor: 'transparent',
                              borderLeftWidth: 20, borderLeftColor: '#FFFDF7',
                            }} />
                          ) : (
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <View style={styles.pauseBar} />
                              <View style={styles.pauseBar} />
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Stop */}
                        <TouchableOpacity
                          onPress={stopRecordingAction}
                          activeOpacity={0.8}
                          style={{
                            width: 52, height: 52, borderRadius: 26,
                            backgroundColor: theme.sand,
                            justifyContent: 'center', alignItems: 'center',
                          }}
                        >
                          <View style={{
                            width: 20, height: 20, borderRadius: 3,
                            backgroundColor: theme.ink,
                          }} />
                        </TouchableOpacity>
                      </View>
                      <Text style={{
                        fontFamily: theme.fonts.body,
                        fontSize: 12,
                        color: theme.inkSoft,
                        marginTop: 10,
                      }}>
                        {paused ? '轻点继续录音' : '轻点暂停'} · 按 ■ 完成录音
                      </Text>
                    </View>
                  )}

                  {/* Transcript section — after recording stops */}
                  {recordingDone && (
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
                        {transcribing ? (
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
                        ) : (
                          <TouchableOpacity
                            onPress={togglePlayback}
                            activeOpacity={0.7}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 5,
                              marginLeft: 'auto',
                              paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
                              backgroundColor: playing ? theme.accent : theme.sand,
                            }}
                          >
                            {playing ? (
                              <View style={{ flexDirection: 'row', gap: 3 }}>
                                <View style={{ width: 2.5, height: 11, borderRadius: 1.5, backgroundColor: '#FFFDF7' }} />
                                <View style={{ width: 2.5, height: 11, borderRadius: 1.5, backgroundColor: '#FFFDF7' }} />
                              </View>
                            ) : (
                              <View style={{
                                width: 0, height: 0, marginLeft: 1,
                                borderTopWidth: 5.5, borderTopColor: 'transparent',
                                borderBottomWidth: 5.5, borderBottomColor: 'transparent',
                                borderLeftWidth: 9, borderLeftColor: theme.accent,
                              }} />
                            )}
                            <Text style={{
                              fontFamily: theme.fonts.body,
                              fontSize: 12,
                              color: playing ? '#FFFDF7' : theme.accent,
                            }}>
                              {playing ? '播放中' : '听原声'}
                            </Text>
                          </TouchableOpacity>
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
                  )}
                </>
              )}

              {/* ── Photo capture ── */}
              {type === 'photo' && (
                <View style={{ marginTop: 8 }}>
                  {photos.length === 0 ? (
                    <TouchableOpacity activeOpacity={0.7} onPress={showPhotoOptions}>
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
                      {/* Cover photo — real image */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onLongPress={() => {
                          Alert.alert('移除封面照片？', '', [
                            { text: '移除', style: 'destructive', onPress: () => removePhoto(0) },
                            { text: '取消', style: 'cancel' },
                          ]);
                        }}
                        style={{ position: 'relative' }}
                      >
                        <View style={{
                          height: 268,
                          borderRadius: 24,
                          overflow: 'hidden',
                          borderWidth: 2,
                          borderColor: theme.accent,
                        }}>
                          <Image
                            source={{ uri: photos[0] }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        </View>
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
                      </TouchableOpacity>

                      {/* Additional photo thumbnails + add button */}
                      <View style={styles.photoRow}>
                        {photos.slice(1).map((uri, i) => (
                          <TouchableOpacity
                            key={i}
                            activeOpacity={0.85}
                            onLongPress={() => {
                              Alert.alert('移除这张照片？', '', [
                                { text: '移除', style: 'destructive', onPress: () => removePhoto(i + 1) },
                                { text: '取消', style: 'cancel' },
                              ]);
                            }}
                            style={{
                              width: 66, height: 66,
                              borderRadius: 14,
                              overflow: 'hidden',
                              borderWidth: 1,
                              borderColor: theme.line,
                            }}
                          >
                            <Image
                              source={{ uri }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ))}
                        {photos.length < MAX_SHOTS && (
                          <TouchableOpacity
                            onPress={showPhotoOptions}
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

                      <Text style={{
                        marginTop: 12,
                        marginHorizontal: 4,
                        fontFamily: theme.fonts.body,
                        fontSize: 12.5,
                        color: theme.inkSoft,
                        lineHeight: 20,
                      }}>
                        {photos.length >= MAX_SHOTS
                          ? `已选 ${photos.length} 张 · 第一张作封面`
                          : `已选 ${photos.length} 张 · 第一张作封面，最多 ${MAX_SHOTS} 张`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── Video capture ── */}
              {type === 'video' && (
                <View style={{ marginTop: 8 }}>
                  {videoUri ? (
                    <View style={{
                      height: 300,
                      borderRadius: 24,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: theme.accent,
                      backgroundColor: '#1a1a1a',
                    }}>
                      <VideoView
                        player={videoPlayer}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        nativeControls={false}
                      />
                      {/* 点画面播放/暂停；暂停时盖上播放按钮和时长 */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => (isPlaying ? videoPlayer.pause() : videoPlayer.play())}
                        style={[StyleSheet.absoluteFill as any, {
                          justifyContent: 'center',
                          alignItems: 'center',
                        }]}
                      >
                        {!isPlaying && (
                          <>
                            <View style={styles.videoIconCircle}>
                              {Icon.play(t.deep, 26)}
                            </View>
                            <View style={styles.videoLabel}>
                              <Text style={{
                                fontFamily: theme.fonts.body,
                                fontSize: 13.5,
                                color: theme.ink,
                              }}>
                                {'✓ 已选好视频 · '}
                                {Math.floor(videoDuration / 60)}:{String(videoDuration % 60).padStart(2, '0')}
                              </Text>
                            </View>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => { videoPlayer.pause(); showVideoOptions(); }}
                        style={{
                          position: 'absolute', top: 12, right: 12,
                          paddingHorizontal: 12, paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: 'rgba(255,253,247,0.92)',
                        }}
                      >
                        <Text style={{
                          fontFamily: theme.fonts.body,
                          fontSize: 12.5,
                          color: theme.ink,
                        }}>重选</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity activeOpacity={0.7} onPress={showVideoOptions}>
                      <PhotoSlot
                        tone={level.tone}
                        radius={24}
                        label=""
                        style={{
                          height: 300,
                          aspectRatio: undefined,
                          borderWidth: 2,
                          borderColor: 'rgba(58,51,43,0.18)',
                          borderStyle: 'dashed',
                        }}
                      >
                        <View style={{ alignItems: 'center' }}>
                          <View style={styles.videoIconCircle}>
                            {Icon.video(t.deep, 28)}
                          </View>
                          <View style={styles.videoLabel}>
                            <Text style={{
                              fontFamily: theme.fonts.body,
                              fontSize: 13.5,
                              color: theme.ink,
                            }}>
                              轻点拍摄或选择视频
                            </Text>
                          </View>
                        </View>
                      </PhotoSlot>
                    </TouchableOpacity>
                  )}
                  <Text style={{
                    marginTop: 12,
                    marginHorizontal: 4,
                    textAlign: 'center',
                    fontFamily: theme.fonts.body,
                    fontSize: 12.5,
                    color: theme.inkSoft,
                    lineHeight: 20,
                  }}>
                    {videoUri ? '轻点画面播放或暂停 · 右上角可重选' : '短短一小段就好，几十秒最耐看。'}
                  </Text>
                </View>
              )}

              {/* ── Text capture ── */}
              {type === 'text' && (
                <View style={{ marginTop: 8 }}>
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
                      配一句话
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
                    在哪儿？
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
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
              <View style={[StyleSheet.absoluteFill, {
                backgroundColor: theme.cream,
                opacity: 0.92,
              }]} />
              <TouchableOpacity
                disabled={!captureReady || saving}
                onPress={finish}
                activeOpacity={0.8}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: (captureReady && !saving) ? theme.accent : theme.sand,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFDF7" size="small" />
                ) : (
                  <Text style={{
                    fontFamily: theme.fonts.head,
                    fontSize: 17,
                    color: captureReady ? '#FFFDF7' : theme.inkSoft,
                  }}>
                    {level.sealed ? '封存这封信' : '就这样，收好它'}
                  </Text>
                )}
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

  captionInput: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 25,
    textAlignVertical: 'top',
  },

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
    minHeight: 52,
  },

  celebContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
});
