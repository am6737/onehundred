import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Dimensions, Image, Alert, Share, Modal, Pressable, Platform, ActivityIndicator,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useEvent, useEventListener } from 'expo';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
const MediaLibrary = Platform.OS !== 'web' ? require('expo-media-library') as typeof import('expo-media-library') : null;
import { useTheme, TONE } from '../theme/tokens';
import { useT, t, getLang } from '../i18n';
import { PERSPECTIVES, isMemoryLocked, isMemoryUnsealed, roleLabel } from '../data';
import { useData } from '../data/DataProvider';
import { useMemoryMedia } from '../lib/media';
import { MemoryCover } from '../components/MemoryCover';
import { RemoteLivePhotoImage, LiveDot } from '../components/LivePhotoImage';
import { SceneSlot } from '../components/Motifs';
import { Icon, PhotoSlot, KidAvatar } from '../components/Icons';
import { LayerHeader, Sheet, Chip, PrimaryButton } from '../components/common';

const { width: SCREEN_W } = Dimensions.get('window');

/* ════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════ */


const MEM_MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Pretty date for the share card — replace relative words with a full date. */
function shareDate(d) {
  if (d === '今天' || d === '刚刚' || !d) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1, day = now.getDate();
    return t('memory.shareDateFmt', { y, m, d: day, mon: MEM_MONTHS_EN[m - 1] });
  }
  return d;
}

/** Format a duration in seconds as m:ss (e.g. 75 → "1:15"). */
function fmtDur(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Number of photos in a memory (shots can be an array or a number). */
function shotCount(m) {
  if (Array.isArray(m.shots)) return m.shots.length;
  if (typeof m.shots === 'number') return m.shots;
  return 0;
}

/** Normalise type — the data layer may use 'audio' where the prototype expects 'voice'. */
function normalType(type) {
  if (type === 'audio') return 'voice';
  return type || 'photo';
}

/** Filter memories by kid id or show all. */
function bookFilter(memories, f) {
  const filtered = f === 'everything' ? memories : memories.filter(m => m.kid === f);
  return [...filtered].sort((a, b) =>
    b.date > a.date ? 1 : b.date < a.date ? -1
    : (b.createdAt || '') > (a.createdAt || '') ? 1 : (b.createdAt || '') < (a.createdAt || '') ? -1 : 0);
}

/** Label for who participated. */
function whoTag(kid, getKid) {
  return kid === 'all' ? t('family.all') : (getKid(kid)?.name || t('drawer.child'));
}

/* ════════════════════════════════════════════════════════════
   TypeBadge — pill overlay on hero photo (voice / video / photo)
   ════════════════════════════════════════════════════════════ */

function TypeBadge({ type = 'voice', dur }) {
  const { theme } = useTheme();
  const t = useT();
  const isVoice = type === 'voice';
  const isVideo = type === 'video';
  const icon = isVoice
    ? Icon.play('#FFFDF7', 11)
    : isVideo
      ? Icon.video('#FFFDF7', 13)
      : Icon.camera('#FFFDF7', 13);
  const label = isVoice
    ? (dur || t('ownLevels.sugVoice'))
    : isVideo
      ? (dur || t('ownLevels.sugVideo'))
      : t('common.photo');

  return (
    <View style={[badgeStyles.container, { shadowColor: theme.shadow }]}>
      <View style={[badgeStyles.iconWrap, { backgroundColor: theme.accent }]}>
        {icon}
      </View>
      <Text style={[badgeStyles.label, {
        fontFamily: theme.fonts.body,
        color: '#3A332B',
      }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,253,247,0.93)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
    elevation: 4,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
  },
});

/* ════════════════════════════════════════════════════════════
   MemoryVideo — inline video with first-frame preview & play
   ════════════════════════════════════════════════════════════ */

function MemoryVideo({ url, tone, dur }) {
  const t = useT();
  const tn = TONE[tone] || TONE.orange;
  const player = useVideoPlayer(url);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [secs, setSecs] = useState(0);
  // 真实时长来自播放器（sourceLoad 后才有），先用记录时存的 dur 兜底
  useEventListener(player, 'sourceLoad', ({ duration }) => setSecs(duration || 0));
  useEventListener(player, 'playToEnd', () => {
    player.pause();
    player.currentTime = 0;
  });

  const shownDur = secs > 0 ? fmtDur(secs) : (dur || '');

  return (
    <View style={{ height: 300, backgroundColor: '#1a1a1a' }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => (isPlaying ? player.pause() : player.play())}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? t('common.a11y.pause') : t('common.a11y.play')}
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}
      >
        {!isPlaying && (
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: 'rgba(255,253,247,0.93)',
          }}>
            {Icon.play(tn.deep, 26)}
          </View>
        )}
      </TouchableOpacity>
      {/* 左下角时长（播放中也保留，方便对照） */}
      {!!shownDur && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, bottom: 16 }}>
          <TypeBadge type="video" dur={shownDur} />
        </View>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   MemoryAudio — real playback of a saved voice memory
   ════════════════════════════════════════════════════════════ */

function MemoryAudio({ url, tone, level }) {
  const { theme } = useTheme();
  const t = useT();
  const tn = TONE[tone] || TONE.orange;
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);

  // 离开页面时释放播放器
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.release();
        playerRef.current = null;
      }
    };
  }, []);

  const toggle = async () => {
    try {
      if (!playerRef.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        const p = createAudioPlayer(url);
        playerRef.current = p;
        p.addListener('playbackStatusUpdate', (s) => {
          if (s?.didJustFinish) {
            setPlaying(false);
            try { p.seekTo(0); } catch {}
          }
        });
        p.play();
        setPlaying(true);
        return;
      }
      if (playerRef.current.playing) {
        playerRef.current.pause();
        setPlaying(false);
      } else {
        playerRef.current.seekTo(0);
        playerRef.current.play();
        setPlaying(true);
      }
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  };

  return (
    <View style={{ height: 300, backgroundColor: tn.soft, justifyContent: 'center', alignItems: 'center' }}>
      {/* 背景：这件事的插画（没插画时回退到居中 motif） */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <SceneSlot level={level} tone={tone} size={300} style={{ width: '100%', height: '100%' }} />
      </View>
      {/* 暖色柔和蒙版：压淡插画，保证播放键 / 文案可读（淡一点让插画更清楚） */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,253,247,0.32)' }]} />
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={playing ? t('common.a11y.pause') : t('common.a11y.play')}
        style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: tn.deep,
          justifyContent: 'center', alignItems: 'center',
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25, shadowRadius: 12, elevation: 5,
        }}
      >
        {playing ? (
          <View style={{ flexDirection: 'row', gap: 5 }}>
            <View style={{ width: 5, height: 24, borderRadius: 2, backgroundColor: '#FFFDF7' }} />
            <View style={{ width: 5, height: 24, borderRadius: 2, backgroundColor: '#FFFDF7' }} />
          </View>
        ) : (
          <View style={{
            width: 0, height: 0, marginLeft: 5,
            borderTopWidth: 14, borderTopColor: 'transparent',
            borderBottomWidth: 14, borderBottomColor: 'transparent',
            borderLeftWidth: 22, borderLeftColor: '#FFFDF7',
          }} />
        )}
      </TouchableOpacity>
      {/* 文案垫一层半透明药丸底，深色字落浅底上，插画再花也清楚 */}
      <View style={{
        marginTop: 16,
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
        backgroundColor: 'rgba(255,253,247,0.78)',
      }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 13, color: '#3A332B',
        }}>
          {playing ? t('memory.playing') : t('memory.tapToPlay')}
        </Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   ShareSheet — bottom sheet with share card preview
   ════════════════════════════════════════════════════════════ */

function ShareSheet({ m, visible, onClose }) {
  const { theme } = useTheme();
  const t = useT();
  const { getKid } = useData();
  const tn = TONE[m.tone] || TONE.orange;
  const perspective = PERSPECTIVES[m.perspective];
  const locked = isMemoryLocked(m);   // 封存中：分享只透出标题与到期，不泄露内容
  const cardRef = useRef(null);       // 指向上方的分享卡片，用来截图成图片
  const [busy, setBusy] = useState(false);

  // 把分享卡片截成一张 PNG（tmpfile，存活到 App 退出）
  const captureCard = async () =>
    captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });

  // 真实分享：把这一页截成图片，唤起系统分享面板（微信/相册/AirDrop 等由用户选）
  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureCard();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: t('memory.shareDialogTitle'),
        });
      } else {
        // 极少数平台不支持文件分享，退回纯文字
        const who = m.kid === 'all' ? t('memory.ourFamily') : t('memory.kidAndMe', { name: getKid(m.kid)?.name || t('drawer.child') });
        await Share.share({
          message: locked
            ? t('memory.shareLockedMsg', { title: m.title, label: m.sealLabel || t('drawer.theAppointedDay') })
            : t('memory.shareMsg', { caption: m.caption, who, date: shareDate(m.date) }),
        });
      }
    } catch (e) {
      // 用户取消分享不算错误，忽略
    } finally {
      setBusy(false);
    }
  };

  // 把这一页截成图片存进系统相册
  const onSaveToAlbum = async () => {
    if (!MediaLibrary || busy) return;
    setBusy(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true); // writeOnly：只要写入权限
      if (!perm.granted) {
        Alert.alert(t('memory.albumPermTitle'), t('memory.albumPermBody'));
        return;
      }
      const uri = await captureCard();
      await MediaLibrary.Asset.create(uri);
      Alert.alert(t('memory.savedTitle'), t('memory.savedBody'));
    } catch (e) {
      Alert.alert(t('memory.saveFailTitle'), t('memory.saveFailBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={locked ? t('memory.shareTitleLocked') : t('memory.shareTitle')}>
      {/* Share card preview — 包一层 ref，用来截图成图片分享/保存 */}
      <View ref={cardRef} collapsable={false} style={{ marginBottom: 18 }}>
      {locked ? (
        <View style={{
          borderRadius: 24, overflow: 'hidden',
          backgroundColor: theme.paper,
          borderWidth: 1.5, borderColor: theme.line, borderStyle: 'dashed',
          padding: 24, alignItems: 'center',
        }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28, backgroundColor: tn.soft,
            justifyContent: 'center', alignItems: 'center',
          }}>
            {Icon.lock(tn.deep, 26)}
          </View>
          <Text style={{
            marginTop: 14, fontFamily: theme.fonts.head, fontSize: 18, lineHeight: 26,
            color: theme.ink, textAlign: 'center',
          }}>{m.title}</Text>
          <View style={{
            marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.sand,
          }}>
            {Icon.seed(theme.accent, 14)}
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: theme.accent }}>
              {t('sealedPage.waitFor', { label: m.sealLabel || t('sealedPage.waitDefault') })}
            </Text>
          </View>
          <Text style={{
            marginTop: 14, maxWidth: 260, textAlign: 'center',
            fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 22, color: theme.inkSoft,
          }}>{t('memory.lockedShareHint')}</Text>
        </View>
      ) : (
      <View style={{
        borderRadius: 24, overflow: 'hidden',
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
        elevation: 6,
      }}>
        <MemoryCover memory={m} mode="hero" label={t('common.photo')} style={{ width: '100%', height: 200, aspectRatio: undefined }} />
        <View style={{ padding: 18, paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: tn.soft,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
          }}>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 12, color: tn.ink,
            }}>
              {perspective ? perspective.long : ''}
            </Text>
          </View>
          <Text style={{
            marginTop: 12,
            fontFamily: theme.fonts.hand, fontSize: 19, lineHeight: 34,
            color: theme.ink,
          }}>
            {t('memory.quoted', { text: m.caption })}
          </Text>
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft,
            }}>
              {m.kid === 'all' ? t('memory.ourFamily') : t('memory.kidAndMe', { name: getKid(m.kid)?.name || t('drawer.child') })}
              {' · '}{shareDate(m.date)}{t('memory.brandSuffix')}
            </Text>
          </View>
        </View>
      </View>
      )}
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {Platform.OS !== 'web' && (
        <TouchableOpacity
          onPress={onSaveToAlbum}
          disabled={busy}
          activeOpacity={0.8}
          style={{
            flex: 1, padding: 14, borderRadius: 999,
            backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text numberOfLines={1} style={{
            fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink,
          }}>{t('memory.saveToAlbum')}</Text>
        </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onShare}
          disabled={busy}
          activeOpacity={0.8}
          style={{
            flex: 1, padding: 14, borderRadius: 999,
            backgroundColor: theme.accent,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text numberOfLines={1} style={{
            fontFamily: theme.fonts.head, fontSize: 15, color: '#FFFDF7',
          }}>{t('memory.share')}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════
   MemoryPage — single memory detail view
   ════════════════════════════════════════════════════════════ */

export function MemoryPage({ route, navigation }) {
  const { theme } = useTheme();
  const t = useT();
  const { removeMemory, allLevels, memories, memoriesForLevel, family } = useData();
  const m = route?.params?.memory
    || (route?.params?.memoryId ? memories.find(x => x.id === route.params.memoryId) : null);
  const locked = isMemoryLocked(m);
  const tn = TONE[m?.tone] || TONE.orange;

  // 谁记录的：邀记用 invitedRole；自己录入的按 user_id 映射到家庭成员角色
  const recorderLabel = (() => {
    if (m?.invitedRole) return roleLabel(m.invitedRole);
    const member = family?.members?.find(mb => mb.userId === m?.userId);
    if (!member) return '';
    return member.role === '其他' ? (member.customRole || roleLabel('其他')) : roleLabel(member.role);
  })();
  const [shareVisible, setShareVisible] = useState(false);
  const [openText, setOpenText] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const media = useMemoryMedia(locked ? null : m?.id);
  const images = media.filter(x => x.kind === 'image');
  const heroImg = images.length > 0 ? images[Math.min(heroIndex, images.length - 1)] : null;
  const video = media.find(x => x.kind === 'video');
  const audio = media.find(x => x.kind === 'audio');
  const level = m ? allLevels().find(l => l.num === m.levelNum) : null;

  if (!m) return null;

  const confirmDelete = () => {
    Alert.alert(
      t('memory.deleteTitle'),
      t('memory.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await removeMemory(m.id);
              navigation.goBack();
            } catch (e) {
              setDeleting(false);
              Alert.alert(t('memory.deleteFailTitle'), t('memory.deleteFailBody'));
            }
          },
        },
      ],
    );
  };

  // 把单个媒体（签名 URL）下到缓存再写入相册。
  // MediaLibrary 只认本地文件、靠后缀判类型；target.name 自带正确后缀（如 photo_0.heic / clip.mp4），直接沿用。
  const downloadAndSave = async (target: { name: string; url: string }) => {
    if (!MediaLibrary) return;
    const safe = `${m.id}_${target.name}`.replace(/[^\w.-]/g, '_');
    const file = new File(Paths.cache, `dl_${safe}`);
    if (!file.exists) await File.downloadFileAsync(target.url, file);
    await MediaLibrary.Asset.create(file.uri);
  };

  // 实际执行保存：视频 / 单张 / 全部
  const runSave = async (mode: 'video' | 'one' | 'all') => {
    if (!MediaLibrary || savingMedia) return;
    setSavingMedia(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true); // writeOnly：只要写入权限
      if (!perm.granted) {
        Alert.alert(t('memory.albumPermTitle'), t('memory.albumPermBody'));
        return;
      }
      if (mode === 'video' && video) {
        await downloadAndSave(video);
        Alert.alert(t('memory.savedTitle'), t('memory.savedMediaBody'));
      } else if (mode === 'all') {
        for (const img of images) await downloadAndSave(img);
        Alert.alert(t('memory.savedTitle'), t('memory.savedAllBody', { n: images.length }));
      } else if (heroImg) {
        await downloadAndSave(heroImg);
        // 实况照片只能存下静态图（动态部分暂不支持），给个说明
        Alert.alert(t('memory.savedTitle'), heroImg.livePhotoUrl ? t('memory.savedLiveStillBody') : t('memory.savedMediaBody'));
      }
    } catch (e) {
      Alert.alert(t('memory.saveFailTitle'), t('memory.saveFailBody'));
    } finally {
      setSavingMedia(false);
    }
  };

  // 菜单入口：视频 / 单图直接存；多图先弹「保存这张 / 保存全部」让用户选
  const onSaveMedia = () => {
    if (!MediaLibrary || savingMedia) return;
    setMenuOpen(false);
    if (video) { runSave('video'); return; }
    if (images.length <= 1) { runSave('one'); return; }
    Alert.alert(t('memory.saveSheetTitle'), undefined, [
      { text: t('memory.saveThis'), onPress: () => runSave('one') },
      { text: t('memory.saveAll', { n: images.length }), onPress: () => runSave('all') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // 删除按钮：封存中 / 已解封都能用
  const [menuOpen, setMenuOpen] = useState(false);

  const sameLevelCount = memoriesForLevel(m.levelNum).length;

  // 历史回忆不应因为原活动未加载（或自定义活动已被删除）就失去「再做一次」。
  // 找不到完整活动时，用回忆里保存的快照构造一个可记录的最小活动。
  const repeatLevel = level || {
    num: m.levelNum,
    perspective: m.perspective,
    tone: m.tone,
    title: m.title,
    why: '',
    how: '',
    record: '',
    suggest: m.type === 'image' ? 'photo' : m.type,
  };

  const menuItems = [
    {
      label: t('memory.doAgain'),
      icon: (c: string) => Icon.redo(c, 16),
      onPress: () => { setMenuOpen(false); navigation.navigate('LevelDetail', { level: repeatLevel, kidId: m.kid, me: route.params?.me }); },
    },
    ...(sameLevelCount >= 2 ? [{
      label: t('memory.menuSeeAll'),
      icon: (c: string) => Icon.eye(c, 16),
      onPress: () => { setMenuOpen(false); navigation.navigate('LevelTimeline', { levelNum: m.levelNum, kidId: m.kid }); },
    }] : []),
    ...(MediaLibrary && !locked && (video || heroImg) ? [{
      label: video ? t('memory.saveVideo') : t('memory.savePhoto'),
      icon: (c: string) => Icon.download(c, 16),
      onPress: onSaveMedia,
    }] : []),
    {
      label: t('common.delete'),
      icon: (c: string) => Icon.trash(c, 16),
      danger: true,
      onPress: () => { setMenuOpen(false); confirmDelete(); },
    },
  ];

  const moreButton = (
    <View style={{ position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setMenuOpen(o => !o)}
        disabled={deleting}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('common.a11y.more')}
        style={{
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: theme.paper,
          borderWidth: 1, borderColor: theme.line,
          justifyContent: 'center', alignItems: 'center',
          opacity: deleting ? 0.4 : 1,
        }}
      >
        {Icon.moreH(theme.ink, 20)}
      </TouchableOpacity>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)}>
          <View style={{
            position: 'absolute', top: 100, right: 18, minWidth: 160,
            backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line,
            borderRadius: 16, padding: 6,
            shadowColor: theme.shadow, shadowOpacity: 0.2, shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 }, elevation: 10,
          }}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={item.onPress}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 12, paddingHorizontal: 14,
                  borderRadius: 12,
                }}
              >
                {item.icon(item.danger ? theme.danger : theme.ink)}
                <Text style={{
                  fontFamily: theme.fonts.head, fontSize: 15,
                  color: item.danger ? theme.danger : theme.ink,
                }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );

  // 封存中：内容锁住不渲染，但分享 / 删除照常可用
  if (locked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('drawer.sealed')} onBack={() => navigation.goBack()} right={moreButton} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 36, paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center' }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36, backgroundColor: tn.soft,
              justifyContent: 'center', alignItems: 'center',
            }}>
              {Icon.lock(tn.deep, 32)}
            </View>
            <Text style={{
              marginTop: 20, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink, textAlign: 'center',
            }}>{m.title}</Text>
            <Text style={{
              marginTop: 12, maxWidth: 280, textAlign: 'center',
              fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 26, color: theme.inkSoft,
            }}>
              {t('memory.lockedDetail', { label: m.sealLabel || t('drawer.theAppointedDay') })}
            </Text>

            <PrimaryButton
              label={t('memory.shareSealed')}
              icon={Icon.share('#FFFDF7', 18)}
              onPress={() => setShareVisible(true)}
              style={{
                marginTop: 32, alignSelf: 'stretch',
              }}
            />
          </View>
        </ScrollView>

        <ShareSheet m={m} visible={shareVisible} onClose={() => setShareVisible(false)} />
      </View>
    );
  }

  const type = normalType(m.type);
  const hasTranscript = (type === 'voice' || type === 'video') && m.transcript && m.transcript.trim();
  const longText = hasTranscript && m.transcript.trim().length > 56;
  const shots = shotCount(m);
  const perspective = PERSPECTIVES[m.perspective];

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader
        title={perspective ? perspective.long : ''}
        onBack={() => navigation.goBack()}
        right={moreButton}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero photo ── */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{
            borderRadius: 28, overflow: 'hidden',
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.22,
            shadowRadius: 22,
            elevation: 8,
          }}>
            {video ? (
              <MemoryVideo url={video.url} tone={m.tone} dur={m.dur} />
            ) : audio ? (
              <MemoryAudio url={audio.url} tone={m.tone} level={level} />
            ) : heroImg ? (
              heroImg.livePhotoUrl ? (
                <RemoteLivePhotoImage
                  cacheKey={`${m.id}-${heroImg.name}`}
                  photoUrl={heroImg.url}
                  pairedVideoUrl={heroImg.livePhotoUrl}
                  style={{ width: '100%', height: 300 }}
                  contentFit="cover"
                />
              ) : (
                <Image
                  source={{ uri: heroImg.url }}
                  style={{ width: '100%', height: 300 }}
                  resizeMode="cover"
                />
              )
            ) : (
              // 纯文字：用这件事本身的插画兜底，与回忆册列表保持一致
              <SceneSlot level={level} tone={m.tone} size={220} style={{ width: '100%', height: 300, borderRadius: 28 }} />
            )}
            {/* Type badge overlay（视频的时长角标已在 MemoryVideo 内部渲染，这里只管语音） */}
            {type === 'voice' && (
              <View pointerEvents="none" style={{ position: 'absolute', left: 16, bottom: 16 }}>
                <TypeBadge type={type} dur={m.dur} />
              </View>
            )}
          </View>

          {/* Thumbnail strip for multi-shot — 有真实图片时可点击切换大图 */}
          {images.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {images.map((img, i) => (
                <TouchableOpacity
                  key={img.name}
                  activeOpacity={0.8}
                  onPress={() => setHeroIndex(i)}
                  style={{ position: 'relative' }}
                >
                  <Image
                    source={{ uri: img.url }}
                    style={{
                      width: 66, height: 66, borderRadius: 13,
                      borderWidth: i === heroIndex ? 2 : 1,
                      borderColor: i === heroIndex ? theme.accent : theme.line,
                    }}
                  />
                  {i === 0 && (
                    <View style={{
                      position: 'absolute', bottom: 4, left: 4,
                      backgroundColor: theme.accent,
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                    }}>
                      <Text style={{
                        fontFamily: theme.fonts.head, fontSize: 9.5, color: '#FFFDF7',
                      }}>{t('record.cover')}</Text>
                    </View>
                  )}
                  {img.livePhotoUrl && <LiveDot />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : shots > 1 && images.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {Array.from({ length: shots }).map((_, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <PhotoSlot
                    tone={m.tone}
                    radius={13}
                    label=""
                    style={{
                      width: 66, height: 66, aspectRatio: undefined,
                      ...(i === 0
                        ? { shadowColor: theme.accentShadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 1, elevation: 2 }
                        : {}),
                      borderWidth: i === 0 ? 2 : 1,
                      borderColor: i === 0 ? theme.accent : theme.line,
                    }}
                  />
                  {i === 0 && (
                    <View style={{
                      position: 'absolute', bottom: 4, left: 4,
                      backgroundColor: theme.accent,
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                    }}>
                      <Text style={{
                        fontFamily: theme.fonts.head, fontSize: 9.5, color: '#FFFDF7',
                      }}>{t('record.cover')}</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* ── Page body ── */}
        <View style={{ paddingHorizontal: 28, paddingTop: 24 }}>
          {/* Sequence badge + done-N-times pill */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{
              backgroundColor: tn.soft, paddingHorizontal: 11, paddingVertical: 5,
              borderRadius: 999,
            }}>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 13, color: tn.ink,
              }}>{PERSPECTIVES[m.perspective]?.long || ''}</Text>
            </View>
            {memoriesForLevel(m.levelNum).length >= 2 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('LevelTimeline', { levelNum: m.levelNum, kidId: m.kid })}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: theme.sand, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                {Icon.eye(theme.inkSoft, 12)}
                <Text style={{
                  fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft,
                }}>{t('memory.doneNTimes', { count: memoriesForLevel(m.levelNum).length })}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Title */}
          <Text style={{
            marginTop: 16,
            fontFamily: theme.fonts.head, fontSize: 28, lineHeight: 39,
            color: theme.ink,
          }}>{m.title}</Text>

          {/* Decorative quote + handwritten caption */}
          <View style={{ position: 'relative', marginTop: 22, paddingTop: 8 }}>
            <Text style={{
              position: 'absolute', top: -14, left: -6,
              fontFamily: theme.fonts.head, fontSize: 64,
              color: tn.soft, lineHeight: 64,
            }}>{'“'}</Text>
            <Text style={{
              fontFamily: theme.fonts.hand, fontSize: 24, lineHeight: 47,
              color: theme.ink,
            }}>{m.caption}</Text>
          </View>

          {/* Date · place · 谁记录的 */}
          <View style={{
            marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            {[
              m.date,
              m.place,
              recorderLabel ? t('yaoji.recordedBy', { role: recorderLabel }) : null,
            ].filter(Boolean).map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft, opacity: 0.4,
                  }}>{'·'}</Text>
                )}
                <Text style={{
                  fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft,
                }}>{part}</Text>
              </React.Fragment>
            ))}
          </View>

          {/* ── Transcript accordion ── */}
          {hasTranscript && (
            <View style={{
              marginTop: 20, borderRadius: 20,
              backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
              }}>
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: tn.soft,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {Icon.pen(tn.ink, 14)}
                </View>
                <Text style={{
                  fontFamily: theme.fonts.head, fontSize: 14.5, color: theme.ink,
                }}>{t('memory.voiceText')}</Text>
                <Text style={{
                  marginLeft: 'auto',
                  fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.inkSoft,
                }}>{t('memory.autoTranscript')}</Text>
              </View>

              {/* Body */}
              <Text
                numberOfLines={longText && !openText ? 2 : undefined}
                style={{
                  paddingHorizontal: 16, paddingBottom: 16,
                  fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 27.5,
                  color: theme.inkSoft,
                }}
              >
                {m.transcript}
              </Text>

              {/* Expand/collapse toggle */}
              {longText && (
                <TouchableOpacity
                  onPress={() => setOpenText(o => !o)}
                  style={{
                    borderTopWidth: 1, borderTopColor: theme.line,
                    paddingVertical: 10,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 13, color: theme.accent,
                  }}>{openText ? t('mascot.collapse') : t('memory.readFull')}</Text>
                  <View style={{
                    transform: [{ rotate: openText ? '180deg' : '0deg' }],
                  }}>
                    {Icon.chevDown(theme.accent, 15)}
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Share button ── */}
          <PrimaryButton
            label={t('memory.makeCardBtn')}
            icon={Icon.share('#FFFDF7', 18)}
            onPress={() => setShareVisible(true)}
            style={{
              marginTop: 24,
            }}
          />

        </View>
      </ScrollView>

      {/* Share sheet */}
      <ShareSheet m={m} visible={shareVisible} onClose={() => setShareVisible(false)} />

      {/* 保存原图 / 原视频时的等待遮罩（视频下载可能要几秒） */}
      {savingMedia && (
        <View
          pointerEvents="auto"
          style={[StyleSheet.absoluteFill, {
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'center', alignItems: 'center',
          }]}
        >
          <View style={{
            paddingVertical: 22, paddingHorizontal: 28, borderRadius: 18,
            backgroundColor: theme.paper, alignItems: 'center', gap: 12,
          }}>
            <ActivityIndicator color={theme.accent} />
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.ink }}>
              {t('memory.savingMedia')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   KidFilterChips — filter row for the memory book
   ════════════════════════════════════════════════════════════ */

export function KidFilterChips({ value, onChange }) {
  const { theme } = useTheme();
  const t = useT();
  const { kids } = useData();
  const chips = [
    { k: 'everything', label: t('records.filterAll') },
    ...kids.map(k => ({ k: k.id, label: k.name })),
    { k: 'all', label: t('perspective.together.label') },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 3 }}
    >
      {chips.map(c => {
        const on = value === c.k;
        return (
          <TouchableOpacity
            key={c.k}
            onPress={() => onChange(c.k)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999,
              backgroundColor: on ? theme.accent : theme.paper,
              borderWidth: 1,
              borderColor: on ? theme.accent : theme.line,
            }}
          >
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 14,
              color: on ? '#FFFDF7' : theme.inkSoft,
            }}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ════════════════════════════════════════════════════════════
   MemoryThreadItem — one card on the timeline
   ════════════════════════════════════════════════════════════ */

function MemoryThreadItem({ m, onOpen, showWho, showDate = true }) {
  const { theme } = useTheme();
  const t = useT();
  const { getKid, memories } = useData();
  const tn = TONE[m.tone] || TONE.orange;
  const type = normalType(m.type);
  const shots = shotCount(m);
  const locked = isMemoryLocked(m);          // 封存中：内容打不开
  const justOpenable = isMemoryUnsealed(m);  // 已到期：可以打开了
  const sameLevelCount = memories.filter(x => x.levelNum === m.levelNum).length;

  return (
    <View style={{ position: 'relative', paddingLeft: 34, paddingBottom: 18 }}>
      {/* Vertical timeline line */}
      <View style={{
        position: 'absolute', left: 8, top: 9, bottom: 0, width: 2,
        backgroundColor: theme.line,
        opacity: 0.7,
      }} />

      {/* Timeline node dot */}
      <View style={{
        position: 'absolute', left: 0, top: 5,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: theme.cream,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <View style={{
          width: 11, height: 11, borderRadius: 5.5,
          backgroundColor: tn.deep,
          shadowColor: tn.soft,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 3,
          elevation: 2,
        }} />
      </View>

      {/* Date header — only shown for the first item of each date group */}
      {showDate && (
        <View style={{ marginBottom: 8 }}>
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink,
          }}>{m.date}</Text>
        </View>
      )}

      {/* Memory card */}
      <TouchableOpacity
        onPress={() => onOpen(m)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          borderRadius: 18, overflow: 'hidden',
          backgroundColor: theme.paper,
          borderWidth: 1, borderColor: justOpenable ? tn.deep : theme.line,
          borderStyle: locked ? 'dashed' : 'solid',
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        {/* Left photo thumbnail — absolute fill avoids PhotoSlot aspectRatio inflating height */}
        <View style={{ width: 80, minHeight: 92, position: 'relative' }}>
          {locked ? (
            // 封存中：不渲染真实封面，用封蜡占位避免内容泄露
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: tn.soft, justifyContent: 'center', alignItems: 'center',
            }}>
              {Icon.lock(tn.deep, 26)}
            </View>
          ) : (
            <>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
                <MemoryCover memory={m} videoFrame style={{ width: '100%', height: '100%', aspectRatio: undefined }} />
              </View>
              {(type === 'voice' || type === 'video') && (
                <View style={{
                  position: 'absolute', left: 6, bottom: 6,
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: 'rgba(255,253,247,0.92)',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {type === 'video' ? Icon.video(tn.deep, 11) : Icon.play(tn.deep, 10)}
                </View>
              )}
              {type === 'photo' && shots > 1 && (
                <View style={{
                  position: 'absolute', left: 6, bottom: 6,
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                  backgroundColor: 'rgba(255,253,247,0.92)',
                }}>
                  {Icon.camera(tn.deep, 10)}
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 10, color: tn.ink,
                  }}>{shots}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Right text content */}
        <View style={{ flex: 1, padding: 11, paddingHorizontal: 13 }}>
          {/* 徽章行固定单行高度：切换「全部/孩子」时孩子标识出现/消失不会撑大或坍塌卡片 */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            height: 20, overflow: 'hidden',
          }}>
            <View style={{
              backgroundColor: tn.soft,
              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
            }}>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 11, color: tn.ink,
              }}>{PERSPECTIVES[m.perspective]?.long || ''}</Text>
            </View>
            {sameLevelCount >= 2 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: theme.sand,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
              }}>
                {Icon.eye(theme.inkSoft, 10)}
                <Text style={{
                  fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.inkSoft,
                }}>{t('memory.doneNTimes', { count: sameLevelCount })}</Text>
              </View>
            )}
            {showWho && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: theme.sand,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
              }}>
                {m.kid === 'all' ? Icon.users(theme.inkSoft, 11) : null}
                <Text style={{
                  fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.inkSoft,
                }}>{whoTag(m.kid, getKid)}</Text>
              </View>
            )}
            {locked && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: tn.soft,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
              }}>
                {Icon.lock(tn.ink, 10)}
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 10.5, color: tn.ink }}>
                  {t('sealedPage.waitFor', { label: m.sealLabel || t('drawer.theAppointedDay') })}
                </Text>
              </View>
            )}
            {justOpenable && (
              <View style={{
                backgroundColor: tn.deep,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
              }}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 10.5, color: '#FFFDF7' }}>
                  {t('sealedPage.canOpen')}
                </Text>
              </View>
            )}
          </View>
          <Text numberOfLines={1} style={{
            marginTop: 6,
            fontFamily: theme.fonts.head, fontSize: 15, lineHeight: 21,
            color: theme.ink,
          }}>{m.title}</Text>
          <Text numberOfLines={2} style={{
            marginTop: 4,
            fontFamily: theme.fonts.body, fontSize: 12.5, lineHeight: 19,
            color: theme.inkSoft,
          }}>{locked ? t('memory.lockedShort') : m.caption}</Text>
        </View>
      </TouchableOpacity>

      {/* Time and place — below the card, on the timeline */}
      {(!!m.createdAt || !!m.place) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          {!!m.createdAt && (() => {
            const d = new Date(m.createdAt);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                {Icon.clock(theme.inkSoft, 11)}
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.inkSoft }}>{hh}:{mm}</Text>
              </View>
            );
          })()}
          {!!m.place && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {Icon.pin(theme.inkSoft, 11)}
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.inkSoft }}>{m.place}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   MemoryBook — timeline of all memories
   ════════════════════════════════════════════════════════════ */

export function MemoryBook({ route, navigation }) {
  const kidId = route?.params?.kidId || 'all';
  const { theme } = useTheme();
  const t = useT();
  const { memories, getKid } = useData();
  const [filter, setFilter] = useState(kidId === 'all' ? 'everything' : kidId);
  const list = bookFilter(memories, filter);

  const lead = filter === 'everything'
    ? t('memory.bookSubAll')
    : filter === 'all'
      ? t('memory.bookSubTogether')
      : t('memory.bookSubKid', { name: getKid(filter)?.name || t('drawer.child') });

  const handleOpenMemory = (m) => {
    navigation.navigate('Memory', { memory: m });
  };

  const renderItem = ({ item, index }) => {
    // 同一天的多件事归到一个日期下：只有当天第一件显示日期
    const prev = list[index - 1];
    const showDate = !prev || prev.date !== item.date;
    return (
      <MemoryThreadItem
        m={item}
        onOpen={handleOpenMemory}
        showWho={filter === 'everything' || filter === 'all'}
        showDate={showDate}
      />
    );
  };

  const ListHeader = () => (
    <View>
      {/* ── Top stats ── */}
      <View style={{ marginHorizontal: 2, marginTop: 2, marginBottom: 4 }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
          letterSpacing: 1,
        }}>{lead}</Text>
        <View style={{
          flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 8,
        }}>
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 54, lineHeight: 54,
            color: theme.accent,
          }}>{list.length}</Text>
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink,
          }}>{t('memory.memoriesUnit')}</Text>
        </View>
      </View>

      {/* ── Filter chips ── */}
      <View style={{ marginTop: 16 }}>
        <KidFilterChips value={filter} onChange={setFilter} />
      </View>

      {/* ── Timeline top marker ── */}
      {list.length > 0 && (
        <View style={{
          position: 'relative', paddingLeft: 34, paddingBottom: 8, marginTop: 18,
        }}>
          <View style={{
            position: 'absolute', left: 8, top: 15, bottom: 0, width: 2,
            backgroundColor: theme.line, opacity: 0.7,
          }} />
          <View style={{
            position: 'absolute', left: 3, top: 3,
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: theme.cream,
            borderWidth: 2, borderStyle: 'dashed',
            borderColor: theme.line,
          }} />
          <Text style={{
            fontFamily: theme.fonts.hand, fontSize: 16, color: theme.inkSoft,
          }}>{t('memory.growingHint')}</Text>
        </View>
      )}
    </View>
  );

  const ListEmpty = () => (
    <View style={{ alignItems: 'center', marginTop: 60 }}>
      <Text style={{
        fontFamily: theme.fonts.hand, fontSize: 18, color: theme.inkSoft,
        lineHeight: 32, textAlign: 'center',
      }}>
        {t('memory.emptyHint')}
      </Text>
    </View>
  );

  const ListFooter = () => {
    if (list.length === 0) return null;
    return (
      <View style={{
        position: 'relative', paddingLeft: 34, marginTop: -14,
      }}>
        <View style={{
          position: 'absolute', left: 1, top: 0,
          width: 16, height: 16, borderRadius: 8,
          backgroundColor: theme.accent,
          shadowColor: theme.accentShadow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 2,
          justifyContent: 'center', alignItems: 'center',
        }}>
          {Icon.check('#FFFDF7', 10)}
        </View>
        <Text style={{
          fontFamily: theme.fonts.hand, fontSize: 17, color: theme.inkSoft,
        }}>{t('memory.emptyStart')}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('memory.bookTitle')} onBack={() => navigation.goBack()} />
      <FlatList
        data={list}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 52, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
