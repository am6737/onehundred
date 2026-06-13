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
import { File as FSFile } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE, COLORS } from '../theme/tokens';
import { useT } from '../i18n';
import { PERSPECTIVES, meName, NOW_YM, getMyFamilyId, sealDateFor } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, PhotoSlot } from '../components/Icons';
import { LayerHeader, PrimaryButton, SecondaryButton, Chip, Sheet } from '../components/common';
import SealDateSheet from '../components/SealDateSheet';
import { LivePhotoImage, LiveBadge, LiveDot } from '../components/LivePhotoImage';
import { supabase } from '../lib/supabase';

/* ── VoiceRecorder ── */

function VoiceRecorder({ active, done, theme, elapsedRef }) {
  const tr = useT();
  const [sec, setSec] = useState(0);
  const counting = active;

  // 每次重新开始录音，计时归零
  useEffect(() => {
    if (active) {
      setSec(0);
      if (elapsedRef) elapsedRef.current = 0;
    }
  }, [active]);

  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setSec(x => {
      const next = x + 1;
      if (elapsedRef) elapsedRef.current = next;
      return next;
    }), 1000);
    return () => clearInterval(id);
  }, [counting]);

  const mm = String(Math.floor(sec / 60)).padStart(1, '0');
  const ss = String(sec % 60).padStart(2, '0');

  const bars = [10, 22, 38, 18, 46, 28, 58, 34, 50, 24, 60, 26, 52, 30, 44, 20, 40, 16, 30, 14, 24];

  return (
    <View style={{ alignItems: 'center', paddingVertical: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 4 }}>
        {bars.map((base, i) => {
          const h = counting
            ? base * (0.55 + 0.45 * Math.abs(Math.sin((sec + i) * 0.9)))
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
        {active ? tr('record.recording') : done ? tr('record.recorded') : tr('record.ready')}
      </Text>
    </View>
  );
}

/* ── Storage upload helper ── */

async function uploadToStorage(uri, familyId, memoryId, filename) {
  try {
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'bin';
    const path = `${familyId}/${memoryId}/${filename}.${ext}`;
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

    // RN 的 fetch(file://).blob() 上传经常得到 0 字节文件，改为直接读字节
    const bytes = await new FSFile(uri).bytes();
    const { error } = await supabase.storage
      .from('memories')
      .upload(path, bytes, { contentType, upsert: true });
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
  const t = useT();
  const { kids, addMemory } = useData();
  // 'all' 是合法的 kid_id（全家），兜底用它，避免 kid_id 为空导致保存失败
  const kidId = (rawKidId && rawKidId !== 'all') ? rawKidId : (kids[0]?.id || 'all');
  const insets = useSafeAreaInsets();
  const tn = TONE[level.tone] || TONE.orange;

  const [step, setStep] = useState(0);
  const [type, setType] = useState(level.suggest || 'voice');

  // Voice
  const [recording, setRecording] = useState(false);
  const [recordingDone, setRecordingDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const soundRef = useRef<AudioPlayer | null>(null);
  const recordingUriRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const savedMemRef = useRef(null); // 保存成功后的 memory，庆祝页结束时跳详情用

  // 封存：date 类活动录完先选开启日，age18 类保存时按孩子生日自动算
  const [sealInfo, setSealInfo] = useState(null);     // { sealUntil, sealLabel }
  const [sealSheetVisible, setSealSheetVisible] = useState(false);

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
  const MAX_TEXT = 10000;   // 正文 / 语音转写
  const MAX_CAPTION = 300;  // 照片/视频的一句话
  const MAX_PLACE = 40;     // 地点

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
        Alert.alert(t('record.micPermTitle'), t('record.micPermBody'));
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
      Alert.alert(t('record.recordFailTitle'), t('record.recordFailBody'));
      return false;
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

  // 重录：丢弃当前这段，从头开始录
  const restartRecording = async () => {
    try {
      if (soundRef.current) {
        soundRef.current.release();
        soundRef.current = null;
      }
      setPlaying(false);
      setTranscript('');
      setTranscribing(false);
      recordingUriRef.current = null;
      elapsedRef.current = 0;
      setRecordingDone(false);
      const started = await startRealRecording();
      if (started) {
        setRecording(true);
      }
    } catch (e) {
      console.error('Re-record failed:', e);
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
  const TRANSCRIPT_SEED = t('record.transcriptSeed');

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
          Alert.alert(t('record.cameraPermTitle'), t('record.cameraPermBody'));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.length > 0) {
          // 相机拍的是普通照片，没有配对视频
          setPhotos(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri, livePhotoVideoUri: null }))].slice(0, MAX_SHOTS));
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('record.albumPermTitle'), t('record.albumPermBody'));
          return;
        }
        const remaining = MAX_SHOTS - photos.length;
        const result = await ImagePicker.launchImageLibraryAsync({
          // 'livePhotos' 让选到的实况照片返回未经压缩的原图 + 配对短视频（仅 iOS，其它平台忽略）
          mediaTypes: ['images', 'livePhotos'],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: remaining > 0 ? remaining : 1,
        });
        if (!result.canceled && result.assets?.length > 0) {
          setPhotos(prev => [
            ...prev,
            ...result.assets.map(a => ({
              uri: a.uri,
              // 实况照片：配对短视频，原图与视频都要原样保留（靠 metadata 配对，不能改动）
              livePhotoVideoUri: a.type === 'livePhoto' ? (a.pairedVideoAsset?.uri || null) : null,
            })),
          ].slice(0, MAX_SHOTS));
        }
      }
    } catch (e) {
      console.error('Photo pick failed:', e);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(t('record.addPhoto'), '', [
      { text: t('record.takePhoto'), onPress: () => addPhotos(true) },
      { text: t('record.chooseFromAlbum'), onPress: () => addPhotos(false) },
      { text: t('common.cancel'), style: 'cancel' },
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
          Alert.alert(t('record.cameraPermTitle'), t('record.cameraPermBody'));
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
          Alert.alert(t('record.albumPermTitle'), t('record.albumPermBody'));
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
    Alert.alert(t('record.addVideo'), '', [
      { text: t('record.shootVideo'), onPress: () => pickVideoMedia(true) },
      { text: t('record.chooseFromAlbum'), onPress: () => pickVideoMedia(false) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  /* ── Navigation & types ── */

  const types = [
    { k: 'voice', label: t('record.typeVoiceLabel'), sub: t('record.typeVoiceSub'), icon: Icon.mic },
    { k: 'photo', label: t('record.typePhotoLabel'), sub: t('record.typePhotoSub'), icon: Icon.camera },
    { k: 'video', label: t('record.typeVideoLabel'), sub: t('record.typeVideoSub'), icon: Icon.video },
    { k: 'text', label: t('record.typeTextLabel'), sub: t('record.typeTextSub'), icon: Icon.pen },
  ];

  const startCapture = (k) => {
    setType(k);
    animateStep(1);
  };

  // 进入语音页先停在准备态，用户点「开始录音」才真正开始
  const beginRecording = async () => {
    const started = await startRealRecording();
    if (started) {
      setRecording(true);
    }
  };

  const captureReady =
    type === 'voice' ? (recording || recordingDone)
    : type === 'photo' ? photos.length > 0
    : type === 'video' ? videoUri !== null
    : text.trim().length > 0;


  // 解析这条封存记录的到期日：date 类用选好的（或本次回传的 override），age18 类按孩子生日算
  const resolveSeal = (override) => {
    if (!level.sealed) return null;
    if (override) return override;
    if (level.sealKind === 'age18') return sealDateFor(level, kids.find(k => k.id === kidId));
    return sealInfo;
  };

  const finish = async (sealOverride) => {
    if (saving) return;
    setSaving(true);
    const seal = resolveSeal(sealOverride);
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
      const familyId = await getMyFamilyId();

      if (type === 'photo' && photos.length > 0) {
        photos.forEach((p, i) => {
          uploadToStorage(p.uri, familyId, memoryId, `photo_${i}`);
          // 实况照片：配对短视频存成 photo_i.live.<ext>，详情页按同名 still 重新合成实况
          if (p.livePhotoVideoUri) {
            uploadToStorage(p.livePhotoVideoUri, familyId, memoryId, `photo_${i}.live`);
          }
        });
      } else if (type === 'video' && videoUri) {
        uploadToStorage(videoUri, familyId, memoryId, 'video_0');
      } else if (type === 'voice' && recordingUriRef.current) {
        uploadToStorage(recordingUriRef.current, familyId, memoryId, 'audio_0');
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
            : note || t('record.captionFallback'),
        transcript: type === 'voice' ? transcript.trim() : undefined,
        tone: level.tone,
        ...(seal ? { sealed: true, sealUntil: seal.sealUntil, sealLabel: seal.sealLabel } : {}),
      });
      animateStep(2);
    } catch (e) {
      console.error('Failed to save memory:', e);
      Alert.alert(t('record.saveFailTitle'), t('record.saveFailBody'));
    } finally {
      setSaving(false);
    }
  };

  // 封存且是 date 类（时间胶囊）：先选开启日再保存；其余直接保存
  const handlePrimary = () => {
    if (level.sealed && level.sealKind === 'date' && !sealInfo) {
      setSealSheetVisible(true);
      return;
    }
    finish();
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
      setPlaying(false);
      recordingUriRef.current = null;
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

  const placeOptions = [
    t('record.placeHome'), t('record.placeDownstairs'), t('record.placePark'),
    t('record.placeKindergarten'), t('record.placeOnTheWay'),
  ];

  const sealedStarters = [
    t('record.sealedStarter1'),
    t('record.sealedStarter2'),
    t('record.sealedStarter3'),
  ];
  const normalStarters = [
    t('record.normalStarter1'),
    t('record.normalStarter2'),
    t('record.normalStarter3'),
    t('record.normalStarter4'),
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      {step < 2 && (
        <LayerHeader title={t('record.header')} onBack={handleBack} />
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
                    { backgroundColor: rec ? theme.accent : tn.soft },
                  ]}>
                    {ty.icon(rec ? '#FFFDF7' : tn.ink, 24)}
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
                    <View style={[styles.recBadge, { backgroundColor: tn.soft }]}>
                      <Text style={{
                        fontFamily: theme.fonts.head,
                        fontSize: 12,
                        color: theme.accent,
                      }}>
                        {t('record.recommended')}
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
                  <VoiceRecorder active={recording} done={recordingDone} theme={theme} elapsedRef={elapsedRef} />

                  {/* Start — 准备好了再开始 */}
                  {!recording && !recordingDone && (
                    <View style={{ alignItems: 'center', marginTop: 6 }}>
                      <TouchableOpacity
                        onPress={beginRecording}
                        activeOpacity={0.85}
                        style={[styles.recordBtn, { backgroundColor: theme.accent }]}
                      >
                        {Icon.mic('#FFFDF7', 32)}
                      </TouchableOpacity>
                      <Text style={{
                        fontFamily: theme.fonts.body,
                        fontSize: 12,
                        color: theme.inkSoft,
                        marginTop: 12,
                      }}>
                        {t('record.readyTapToRecord')}
                      </Text>
                    </View>
                  )}

                  {/* Record controls — 只有「结束录音」 */}
                  {recording && (
                    <View style={{ alignItems: 'center', marginTop: 6 }}>
                      <TouchableOpacity
                        onPress={stopRecordingAction}
                        activeOpacity={0.85}
                        style={[styles.recordBtn, { backgroundColor: theme.accent }]}
                      >
                        <View style={{
                          width: 26, height: 26, borderRadius: 5,
                          backgroundColor: '#FFFDF7',
                        }} />
                      </TouchableOpacity>
                      <Text style={{
                        fontFamily: theme.fonts.body,
                        fontSize: 12,
                        color: theme.inkSoft,
                        marginTop: 12,
                      }}>
                        {t('record.recordingTapToStop')}
                      </Text>
                    </View>
                  )}

                  {/* Done controls — 播放 / 重录 */}
                  {recordingDone && (
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        {/* 播放 / 暂停 */}
                        <TouchableOpacity
                          onPress={togglePlayback}
                          activeOpacity={0.85}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999,
                            backgroundColor: theme.accent,
                          }}
                        >
                          {playing ? (
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              <View style={{ width: 3.5, height: 15, borderRadius: 2, backgroundColor: '#FFFDF7' }} />
                              <View style={{ width: 3.5, height: 15, borderRadius: 2, backgroundColor: '#FFFDF7' }} />
                            </View>
                          ) : (
                            <View style={{
                              width: 0, height: 0, marginLeft: 2,
                              borderTopWidth: 8, borderTopColor: 'transparent',
                              borderBottomWidth: 8, borderBottomColor: 'transparent',
                              borderLeftWidth: 13, borderLeftColor: '#FFFDF7',
                            }} />
                          )}
                          <Text style={{
                            fontFamily: theme.fonts.head, fontSize: 15, color: '#FFFDF7',
                          }}>
                            {playing ? t('record.playingLabel') : t('record.playLabel')}
                          </Text>
                        </TouchableOpacity>

                        {/* 重录 */}
                        <TouchableOpacity
                          onPress={restartRecording}
                          activeOpacity={0.85}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 7,
                            paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999,
                            backgroundColor: theme.paper,
                            borderWidth: 1, borderColor: theme.line,
                          }}
                        >
                          {Icon.mic(theme.ink, 16)}
                          <Text style={{
                            fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink,
                          }}>
                            {t('record.rerecord')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{
                        fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft, marginTop: 10,
                      }}>
                        {t('record.listenHint')}
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
                          {t('record.voiceTextLabel')}
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
                              {t('record.transcribing')}
                            </Text>
                          </View>
                        ) : null}
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
                            placeholder={t('record.transcriptPlaceholder')}
                            placeholderTextColor={theme.inkSoft}
                            multiline
                            maxLength={MAX_TEXT}
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
                            {t('record.transcriptHint')}
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
                        striped={false}
                        style={{
                          height: 300,
                          aspectRatio: undefined,
                          borderWidth: 2,
                          borderStyle: 'dashed',
                          borderColor: 'rgba(58,51,43,0.18)',
                        }}
                      >
                        <View style={{ alignItems: 'center', gap: 10 }}>
                          {Icon.camera(theme.ink, 30)}
                          <Text style={{
                            fontFamily: theme.fonts.body,
                            fontSize: 16,
                            fontWeight: '600',
                            color: theme.ink,
                          }}>
                            {t('record.tapToAddPhoto')}
                          </Text>
                        </View>
                      </PhotoSlot>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      {/* Cover photo — real image */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onLongPress={() => {
                          Alert.alert(t('record.removeCoverPhoto'), '', [
                            { text: t('record.remove'), style: 'destructive', onPress: () => removePhoto(0) },
                            { text: t('common.cancel'), style: 'cancel' },
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
                          <LivePhotoImage
                            photoUri={photos[0].uri}
                            pairedVideoUri={photos[0].livePhotoVideoUri}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            badge={false}
                          />
                          {/* 封面已占左上角，实况角标放左下；有配对视频就标，不看能否播放 */}
                          {photos[0].livePhotoVideoUri && (
                            <LiveBadge placement="bottom-left" />
                          )}
                        </View>
                        <View style={{ position: 'absolute', top: 12, left: 12 }}>
                          <View style={[styles.coverBadge, { backgroundColor: theme.accent }]}>
                            <Text style={{
                              fontFamily: theme.fonts.head,
                              fontSize: 12,
                              color: '#FFFDF7',
                            }}>
                              {t('record.cover')}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Additional photo thumbnails + add button */}
                      <View style={styles.photoRow}>
                        {photos.slice(1).map((p, i) => (
                          <TouchableOpacity
                            key={i}
                            activeOpacity={0.85}
                            onLongPress={() => {
                              Alert.alert(t('record.removeThisPhoto'), '', [
                                { text: t('record.remove'), style: 'destructive', onPress: () => removePhoto(i + 1) },
                                { text: t('common.cancel'), style: 'cancel' },
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
                              source={{ uri: p.uri }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                            {p.livePhotoVideoUri && <LiveDot />}
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
                              {t('record.addMore')}
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
                          ? t('record.photoCountFull', { count: photos.length })
                          : t('record.photoCount', { count: photos.length, max: MAX_SHOTS })}
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
                              {Icon.play(tn.deep, 26)}
                            </View>
                            <View style={styles.videoLabel}>
                              <Text style={{
                                fontFamily: theme.fonts.body,
                                fontSize: 13.5,
                                color: theme.ink,
                              }}>
                                {t('record.videoChosen')}
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
                        }}>{t('record.reselect')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity activeOpacity={0.7} onPress={showVideoOptions}>
                      <PhotoSlot
                        tone={level.tone}
                        radius={24}
                        label=""
                        striped={false}
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
                            {Icon.video(tn.deep, 28)}
                          </View>
                          <View style={styles.videoLabel}>
                            <Text style={{
                              fontFamily: theme.fonts.body,
                              fontSize: 13.5,
                              color: theme.ink,
                            }}>
                              {t('record.tapToShootVideo')}
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
                    {videoUri ? t('record.videoHintChosen') : t('record.videoHintEmpty')}
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
                          ? t('record.textHintSealed')
                          : t('record.textHintNormal')}
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
                    maxLength={MAX_TEXT}
                    placeholder={
                      level.sealed
                        ? t('record.textPlaceholderSealed')
                        : t('record.textPlaceholderNormal')
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
                    color: text.length >= MAX_TEXT - 200 ? theme.accent : theme.inkSoft,
                    marginTop: 6,
                  }}>
                    {text.length >= MAX_TEXT - 200
                      ? t('record.charCountMax', { len: text.length, max: MAX_TEXT })
                      : t('record.charCount', { len: text.length })}
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
                      {t('record.captionLabel')}
                    </Text>
                  </View>
                  <TextInput
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    numberOfLines={2}
                    maxLength={MAX_CAPTION}
                    placeholder={
                      level.suggest === 'photo'
                        ? t('record.captionPlaceholderPhoto')
                        : t('record.captionPlaceholderVideo')
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
                    {t('record.placeLabel')}
                  </Text>
                </View>
                <TextInput
                  value={place}
                  onChangeText={setPlace}
                  placeholder={t('record.placePlaceholder')}
                  maxLength={MAX_PLACE}
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
                onPress={handlePrimary}
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
                    {level.sealed ? t('record.submitSealed') : t('record.submitNormal')}
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
                {t('record.addedToBook')}
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
              {level.sealed ? t('record.celebSealed') : t('record.celebNormal')}
            </Text>

            {level.sealed && (
              <Text style={{
                fontFamily: theme.fonts.hand,
                fontSize: 19,
                lineHeight: 34,
                color: theme.inkSoft,
                textAlign: 'center',
                marginTop: 10,
              }}>
                {t('record.celebSealedHint')}
              </Text>
            )}
          </Animated.View>
        )}
      </Animated.View>

      <SealDateSheet
        visible={sealSheetVisible}
        onClose={() => setSealSheetVisible(false)}
        onConfirm={(info) => { setSealSheetVisible(false); finish(info); }}
      />
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
