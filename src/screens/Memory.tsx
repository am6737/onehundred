import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Dimensions, Image, Alert, Share,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useEvent, useEventListener } from 'expo';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useTheme, TONE } from '../theme/tokens';
import { PERSPECTIVES, isMemoryLocked, isMemoryUnsealed } from '../data';
import { useData } from '../data/DataProvider';
import { useMemoryMedia } from '../lib/media';
import { MemoryCover } from '../components/MemoryCover';
import { Icon, PhotoSlot, KidAvatar } from '../components/Icons';
import { LayerHeader, Sheet, Chip, PrimaryButton } from '../components/common';

const { width: SCREEN_W } = Dimensions.get('window');

/* ════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════ */

/** Activity number from the "100 things" list. */
function memSeq(m) {
  return parseInt(m.levelNum, 10) || 0;
}

/** Pretty date for the share card — replace relative words with a full date. */
function shareDate(d) {
  if (d === '今天' || d === '刚刚' || !d) {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  }
  return d;
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
  if (f === 'everything') return memories;
  return memories.filter(m => m.kid === f);
}

/** Label for who participated. */
function whoTag(kid, getKid) {
  return kid === 'all' ? '全家' : (getKid(kid)?.name || '孩子');
}

/* ════════════════════════════════════════════════════════════
   TypeBadge — pill overlay on hero photo (voice / video / photo)
   ════════════════════════════════════════════════════════════ */

function TypeBadge({ type = 'voice', dur }) {
  const { theme } = useTheme();
  const isVoice = type === 'voice';
  const isVideo = type === 'video';
  const icon = isVoice
    ? Icon.play('#FFFDF7', 11)
    : isVideo
      ? Icon.video('#FFFDF7', 13)
      : Icon.camera('#FFFDF7', 13);
  const label = isVoice
    ? (dur || '语音')
    : isVideo
      ? (dur || '视频')
      : '照片';

  return (
    <View style={badgeStyles.container}>
      <View style={[badgeStyles.iconWrap, { backgroundColor: theme.accent }]}>
        {icon}
      </View>
      <Text style={[badgeStyles.label, {
        fontFamily: theme.fonts.body,
        color: theme.ink,
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
    shadowColor: '#3A332B',
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

function MemoryVideo({ url, tone }) {
  const t = TONE[tone] || TONE.orange;
  const player = useVideoPlayer(url);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEventListener(player, 'playToEnd', () => {
    player.pause();
    player.currentTime = 0;
  });

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
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}
      >
        {!isPlaying && (
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: 'rgba(255,253,247,0.93)',
          }}>
            {Icon.play(t.deep, 26)}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   MemoryAudio — real playback of a saved voice memory
   ════════════════════════════════════════════════════════════ */

function MemoryAudio({ url, tone }) {
  const { theme } = useTheme();
  const t = TONE[tone] || TONE.orange;
  const playerRef = useRef(null);
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

  const bars = [14, 28, 20, 40, 26, 52, 34, 46, 22, 38, 30, 50, 24, 44, 18, 36, 28, 48, 20, 32, 16];

  return (
    <View style={{ height: 300, backgroundColor: t.soft, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        height: 60, gap: 4, marginBottom: 28, paddingHorizontal: 28,
      }}>
        {bars.map((h, i) => (
          <View key={i} style={{
            width: 4, height: h, borderRadius: 4,
            backgroundColor: t.deep, opacity: playing ? 0.8 : 0.32,
          }} />
        ))}
      </View>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.85}
        style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: t.deep,
          justifyContent: 'center', alignItems: 'center',
          shadowColor: '#3A332B',
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
      <Text style={{
        marginTop: 16,
        fontFamily: theme.fonts.body, fontSize: 13, color: t.ink,
      }}>
        {playing ? '播放中…' : '轻点播放这段录音'}
      </Text>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   ShareSheet — bottom sheet with share card preview
   ════════════════════════════════════════════════════════════ */

function ShareSheet({ m, visible, onClose }) {
  const { theme } = useTheme();
  const { getKid } = useData();
  const t = TONE[m.tone] || TONE.orange;
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
          dialogTitle: '分享这一页',
        });
      } else {
        // 极少数平台不支持文件分享，退回纯文字
        const who = m.kid === 'all' ? '我们一家' : `${getKid(m.kid)?.name || '孩子'}与我`;
        await Share.share({
          message: locked
            ? `我把「${m.title}」封存起来了，等${m.sealLabel || '约定的那天'}才舍得打开。\n\n— 一百件事`
            : `「${m.caption}」\n\n— ${who} · 第 ${memSeq(m)} 件事 · ${shareDate(m.date)} · 一百件事`,
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
    if (busy) return;
    setBusy(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true); // writeOnly：只要写入权限
      if (!perm.granted) {
        Alert.alert('需要相册权限', '请在系统设置里允许「一百件事」把照片保存到相册。');
        return;
      }
      const uri = await captureCard();
      await MediaLibrary.Asset.create(uri);
      Alert.alert('已存到相册', '这一页已经保存到你的相册里了。');
    } catch (e) {
      Alert.alert('没能保存', '保存到相册时出了点问题，待会儿再试一次。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={locked ? '这份封存，说给家人听' : '这一页，分享出去'}>
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
            width: 56, height: 56, borderRadius: 28, backgroundColor: t.soft,
            justifyContent: 'center', alignItems: 'center',
          }}>
            {Icon.lock(t.deep, 26)}
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
              等{m.sealLabel || '约定日期'}
            </Text>
          </View>
          <Text style={{
            marginTop: 14, maxWidth: 260, textAlign: 'center',
            fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 22, color: theme.inkSoft,
          }}>封存中的内容还藏着，分享出去的只是这份等待。</Text>
        </View>
      ) : (
      <View style={{
        borderRadius: 24, overflow: 'hidden',
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
        shadowColor: '#3A332B',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
        elevation: 6,
      }}>
        <MemoryCover memory={m} mode="hero" label="照片" style={{ width: '100%', height: 200, aspectRatio: undefined }} />
        <View style={{ padding: 18, paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: t.soft,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
          }}>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 12, color: t.ink,
            }}>
              {'第 '}{memSeq(m)}{' 件事 · '}{perspective ? perspective.long : ''}
            </Text>
          </View>
          <Text style={{
            marginTop: 12,
            fontFamily: theme.fonts.hand, fontSize: 19, lineHeight: 34,
            color: theme.ink,
          }}>
            {'「'}{m.caption}{'」'}
          </Text>
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft,
            }}>
              {m.kid === 'all' ? '我们一家' : `${getKid(m.kid)?.name || '孩子'}与我`}
              {' · '}{shareDate(m.date)}{' · 一百件事'}
            </Text>
          </View>
        </View>
      </View>
      )}
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
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
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink,
          }}>保存到相册</Text>
        </TouchableOpacity>
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
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 15, color: '#FFFDF7',
          }}>分享</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════
   MemoryPage — single memory detail view
   ════════════════════════════════════════════════════════════ */

export function MemoryPage({ route, navigation }) {
  const m = route?.params?.memory;
  const locked = isMemoryLocked(m);            // 封存中：不取媒体、不渲染内容
  const { theme } = useTheme();
  const { removeMemory } = useData();
  const t = TONE[m?.tone] || TONE.orange;
  const [shareVisible, setShareVisible] = useState(false);
  const [openText, setOpenText] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const media = useMemoryMedia(locked ? null : m?.id);
  const images = media.filter(x => x.kind === 'image');
  const video = media.find(x => x.kind === 'video');
  const audio = media.find(x => x.kind === 'audio');

  if (!m) return null;

  const confirmDelete = () => {
    Alert.alert(
      '删除这条回忆？',
      '删掉就找不回来了，这件事会重新回到「一百件事」里。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await removeMemory(m.id);
              navigation.goBack();
            } catch (e) {
              setDeleting(false);
              Alert.alert('删除失败', '没能删掉，稍后再试一次。');
            }
          },
        },
      ],
    );
  };

  // 删除按钮：封存中 / 已解封都能用
  const deleteButton = (
    <TouchableOpacity
      onPress={confirmDelete}
      disabled={deleting}
      activeOpacity={0.7}
      style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
        justifyContent: 'center', alignItems: 'center',
        opacity: deleting ? 0.4 : 1,
      }}
    >
      {Icon.trash(theme.danger, 20)}
    </TouchableOpacity>
  );

  // 封存中：内容锁住不渲染，但分享 / 删除照常可用
  if (locked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title="封存中" onBack={() => navigation.goBack()} right={deleteButton} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 36, paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center' }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36, backgroundColor: t.soft,
              justifyContent: 'center', alignItems: 'center',
            }}>
              {Icon.lock(t.deep, 32)}
            </View>
            <Text style={{
              marginTop: 20, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink, textAlign: 'center',
            }}>{m.title}</Text>
            <Text style={{
              marginTop: 12, maxWidth: 280, textAlign: 'center',
              fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 26, color: theme.inkSoft,
            }}>
              这一封还封存着。等{m.sealLabel || '约定的那天'}，它会自己回来找你们。
            </Text>

            <PrimaryButton
              label="分享这份封存"
              icon={Icon.share('#FFFDF7', 18)}
              onPress={() => setShareVisible(true)}
              style={{
                marginTop: 32, alignSelf: 'stretch',
                shadowColor: theme.accent,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6,
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
        right={deleteButton}
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
            shadowColor: '#3A332B',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.22,
            shadowRadius: 22,
            elevation: 8,
          }}>
            {video ? (
              <MemoryVideo url={video.url} tone={m.tone} />
            ) : audio ? (
              <MemoryAudio url={audio.url} tone={m.tone} />
            ) : images.length > 0 ? (
              <Image
                source={{ uri: images[Math.min(heroIndex, images.length - 1)].url }}
                style={{ width: '100%', height: 300 }}
                resizeMode="cover"
              />
            ) : (
              <PhotoSlot tone={m.tone} radius={28} label="照片" style={{ height: 300, aspectRatio: undefined }} />
            )}
            {/* Type badge overlay */}
            {(type === 'voice' || type === 'video') && (
              <View pointerEvents="none" style={{ position: 'absolute', left: 16, bottom: 16 }}>
                <TypeBadge type={type} dur={m.dur} />
              </View>
            )}
            {/* Multi-shot count overlay */}
            {shots > 1 && (
              <View style={{
                position: 'absolute', right: 16, bottom: 16,
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: 'rgba(255,253,247,0.93)',
                shadowColor: '#3A332B',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 9,
                elevation: 4,
              }}>
                {Icon.camera(t.deep, 14)}
                <Text style={{
                  fontFamily: theme.fonts.body, fontSize: 13, color: theme.ink,
                }}>{shots} 张</Text>
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
                      position: 'absolute', top: 4, left: 4,
                      backgroundColor: theme.accent,
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                    }}>
                      <Text style={{
                        fontFamily: theme.fonts.head, fontSize: 9.5, color: '#FFFDF7',
                      }}>封面</Text>
                    </View>
                  )}
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
                        ? { shadowColor: theme.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 1, elevation: 2 }
                        : {}),
                      borderWidth: i === 0 ? 2 : 1,
                      borderColor: i === 0 ? theme.accent : theme.line,
                    }}
                  />
                  {i === 0 && (
                    <View style={{
                      position: 'absolute', top: 4, left: 4,
                      backgroundColor: theme.accent,
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                    }}>
                      <Text style={{
                        fontFamily: theme.fonts.head, fontSize: 9.5, color: '#FFFDF7',
                      }}>封面</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* ── Page body ── */}
        <View style={{ paddingHorizontal: 28, paddingTop: 24 }}>
          {/* Sequence badge */}
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: t.soft, paddingHorizontal: 11, paddingVertical: 5,
            borderRadius: 999,
          }}>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 13, color: t.ink,
            }}>{'第 '}{memSeq(m)}{' 件事'}</Text>
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
              color: t.soft, lineHeight: 64,
            }}>{'“'}</Text>
            <Text style={{
              fontFamily: theme.fonts.hand, fontSize: 24, lineHeight: 47,
              color: theme.ink,
            }}>{m.caption}</Text>
          </View>

          {/* Date and place */}
          <View style={{
            marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft,
            }}>{m.date}</Text>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft, opacity: 0.4,
            }}>{'·'}</Text>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft,
            }}>{m.place}</Text>
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
                  backgroundColor: t.soft,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {Icon.pen(t.ink, 14)}
                </View>
                <Text style={{
                  fontFamily: theme.fonts.head, fontSize: 14.5, color: theme.ink,
                }}>录音文字</Text>
                <Text style={{
                  marginLeft: 'auto',
                  fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.inkSoft,
                }}>自动转写</Text>
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
                  }}>{openText ? '收起' : '看全文'}</Text>
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
            label="做成一张卡片"
            icon={Icon.share('#FFFDF7', 18)}
            onPress={() => setShareVisible(true)}
            style={{
              marginTop: 24,
              shadowColor: theme.accent,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 6,
            }}
          />
        </View>
      </ScrollView>

      {/* Share sheet */}
      <ShareSheet m={m} visible={shareVisible} onClose={() => setShareVisible(false)} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   KidFilterChips — filter row for the memory book
   ════════════════════════════════════════════════════════════ */

export function KidFilterChips({ value, onChange }) {
  const { theme } = useTheme();
  const { kids } = useData();
  const chips = [
    { k: 'everything', label: '全部' },
    ...kids.map(k => ({ k: k.id, label: k.name })),
    { k: 'all', label: '一起' },
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
              ...(on ? {
                shadowColor: theme.accent,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 9,
                elevation: 4,
              } : {}),
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

function MemoryThreadItem({ m, onOpen, showWho }) {
  const { theme } = useTheme();
  const { getKid } = useData();
  const t = TONE[m.tone] || TONE.orange;
  const type = normalType(m.type);
  const shots = shotCount(m);
  const locked = isMemoryLocked(m);          // 封存中：内容打不开
  const justOpenable = isMemoryUnsealed(m);  // 已到期：可以打开了

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
          backgroundColor: t.deep,
          shadowColor: t.soft,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 3,
          elevation: 2,
        }} />
      </View>

      {/* Date and place header */}
      <View style={{
        flexDirection: 'row', alignItems: 'baseline', gap: 8,
        marginBottom: 8,
      }}>
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink,
        }}>{m.date}</Text>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft,
        }}>{m.place}</Text>
      </View>

      {/* Memory card */}
      <TouchableOpacity
        onPress={() => onOpen(m)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          borderRadius: 18, overflow: 'hidden',
          backgroundColor: theme.paper,
          borderWidth: 1, borderColor: justOpenable ? t.deep : theme.line,
          borderStyle: locked ? 'dashed' : 'solid',
          shadowColor: '#3A332B',
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
              backgroundColor: t.soft, justifyContent: 'center', alignItems: 'center',
            }}>
              {Icon.lock(t.deep, 26)}
            </View>
          ) : (
            <>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
                <MemoryCover memory={m} style={{ width: '100%', height: '100%', aspectRatio: undefined }} />
              </View>
              {(type === 'voice' || type === 'video') && (
                <View style={{
                  position: 'absolute', left: 6, bottom: 6,
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: 'rgba(255,253,247,0.92)',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {type === 'video' ? Icon.video(t.deep, 11) : Icon.play(t.deep, 10)}
                </View>
              )}
              {type === 'photo' && shots > 1 && (
                <View style={{
                  position: 'absolute', left: 6, bottom: 6,
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                  backgroundColor: 'rgba(255,253,247,0.92)',
                }}>
                  {Icon.camera(t.deep, 10)}
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 10, color: t.ink,
                  }}>{shots}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Right text content */}
        <View style={{ flex: 1, padding: 11, paddingHorizontal: 13 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <View style={{
              backgroundColor: t.soft,
              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
            }}>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 11, color: t.ink,
              }}>{'第 '}{memSeq(m)}{' 件'}</Text>
            </View>
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
                backgroundColor: t.soft,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
              }}>
                {Icon.lock(t.ink, 10)}
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 10.5, color: t.ink }}>
                  等{m.sealLabel || '约定的那天'}
                </Text>
              </View>
            )}
            {justOpenable && (
              <View style={{
                backgroundColor: t.deep,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
              }}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 10.5, color: '#FFFDF7' }}>
                  可以打开了
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
          }}>{locked ? '封存中，到约定的那天才能打开。' : m.caption}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   MemoryBook — timeline of all memories
   ════════════════════════════════════════════════════════════ */

export function MemoryBook({ route, navigation }) {
  const kidId = route?.params?.kidId || 'all';
  const { theme } = useTheme();
  const { memories, getKid } = useData();
  const [filter, setFilter] = useState(kidId === 'all' ? 'everything' : kidId);
  const list = bookFilter(memories, filter);

  const lead = filter === 'everything'
    ? '你们一家一起走过的'
    : filter === 'all'
      ? '你们一起走过的'
      : `你和${getKid(filter)?.name || '孩子'}一起走过的`;

  const handleOpenMemory = (m) => {
    navigation.navigate('Memory', { memory: m });
  };

  const renderItem = ({ item, index }) => (
    <MemoryThreadItem
      m={item}
      onOpen={handleOpenMemory}
      showWho={filter === 'everything' || filter === 'all'}
    />
  );

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
          }}>段回忆</Text>
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
          }}>{'还在慢慢变长……'}</Text>
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
        {'这里还空着，\n等你们一起填满它。'}
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
          shadowColor: theme.accent,
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
        }}>一切，从这里开始</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title="回忆册" onBack={() => navigation.goBack()} />
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
