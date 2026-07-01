import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Share, ActivityIndicator, AppState,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { meName } from '../data';
import { useData } from '../data/DataProvider';
import { LayerHeader, PrimaryButton, SecondaryButton } from '../components/common';
import { Icon } from '../components/Icons';
import {
  createInviteToken, fetchInviteTokens, fetchInviteMemoryId, deactivateInviteToken,
  inviteUrl, getInviteExpiryHours, type InviteToken,
} from '../lib/yaoji';
import { supabase } from '../lib/supabase';
import { CommonActions } from '@react-navigation/native';

type InviteStatus = 'waiting' | 'viewed' | 'recording' | 'uploading' | 'done';

const RECORDING_STALE_MS = 2 * 60 * 1000;
const UPLOADING_STALE_MS = 5 * 60 * 1000;
const STALE_CHECK_INTERVAL_MS = 15 * 1000;

const STATUS_RANK: Record<InviteStatus, number> = {
  waiting: 0,
  viewed: 1,
  recording: 2,
  uploading: 3,
  done: 4,
};

function mergeInviteStatus(current: InviteStatus | undefined, next: InviteStatus): InviteStatus {
  if (!current) return next;
  return STATUS_RANK[next] >= STATUS_RANK[current] ? next : current;
}

function isStaleTransientStatus(status: InviteStatus | undefined, updatedAt: number | undefined, now = Date.now()): boolean {
  if (!updatedAt) return false;
  if (status === 'recording') return now - updatedAt > RECORDING_STALE_MS;
  if (status === 'uploading') return now - updatedAt > UPLOADING_STALE_MS;
  return false;
}

export default function InviteRecord({ route, navigation }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { refresh } = useData();
  const { level, kidId, me } = route.params;

  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<{ token: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenStatus, setTokenStatus] = useState<Record<string, InviteStatus>>({});
  const [tokenStatusAt, setTokenStatusAt] = useState<Record<string, number>>({});
  const refreshedRef = useRef(false);
  const completingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const channelsRef = useRef<any[]>([]);

  const refreshTokenList = useCallback(async () => {
    try {
      const list = await fetchInviteTokens(level.num);
      const active = list.filter(t => new Date(t.expiresAt) > new Date());
      setTokens(active);
      setTokenStatus(prev => {
        const now = Date.now();
        const next = { ...prev };
        active.forEach(token => {
          const status = next[token.id];
          if (token.openedAt && (!status || status === 'waiting' || isStaleTransientStatus(status, tokenStatusAt[token.id], now))) {
            next[token.id] = 'viewed';
          }
        });
        return next;
      });
      return active;
    } catch {
      return [];
    }
  }, [level.num, tokenStatusAt]);

  const completeInviteRecord = useCallback(async (tokenId: string, memoryId: string | null) => {
    if (completingRef.current) return;
    completingRef.current = true;
    refreshedRef.current = true;
    setTokenStatus(prev => ({ ...prev, [tokenId]: 'done' }));
    setTokenStatusAt(prev => ({ ...prev, [tokenId]: Date.now() }));

    try {
      await refresh();
    } catch (e) {
      console.warn('InviteRecord refresh after completion failed:', e);
    }

    navigation.dispatch(
      CommonActions.reset({
        index: memoryId ? 1 : 0,
        routes: [
          { name: 'Home' },
          ...(memoryId ? [{ name: 'Memory', params: { memoryId } }] : []),
        ],
      })
    );
  }, [navigation, refresh]);

  const checkInviteCompletion = useCallback(async (tokenId?: string | null) => {
    if (!tokenId || completingRef.current) return;
    try {
      const memoryId = await fetchInviteMemoryId(tokenId);
      if (memoryId) {
        await completeInviteRecord(tokenId, memoryId);
      }
    } catch (e) {
      console.warn('InviteRecord completion check failed:', e);
    }
  }, [completeInviteRecord]);

  useEffect(() => {
    (async () => {
      const active = await refreshTokenList();
      if (active.length) {
        setGenerated({ token: active[0].id, url: inviteUrl(active[0].id) });
      } else {
        await handleCreate();
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    channelsRef.current.forEach(ch => supabase.removeChannel(ch));
    channelsRef.current = [];
    const allIds = tokens.map(t => t.id);
    if (generated?.token && !allIds.includes(generated.token)) allIds.push(generated.token);
    allIds.forEach(id => {
      const ch = supabase.channel('invite:' + id)
        .on('broadcast', { event: 'status' }, ({ payload }) => {
          if (payload?.status) {
            const nextStatus = payload.status as InviteStatus;
            setTokenStatus(prev => ({ ...prev, [id]: mergeInviteStatus(prev[id], nextStatus) }));
            setTokenStatusAt(prev => ({ ...prev, [id]: Date.now() }));
            if (nextStatus === 'done') {
              completeInviteRecord(id, payload.memoryId ?? null);
            }
          }
        })
        .subscribe();
      channelsRef.current.push(ch);
    });
    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [tokens, generated?.token, completeInviteRecord]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;
      if (wasBackground && nextState === 'active') {
        refreshTokenList();
        checkInviteCompletion(generated?.token);
      }
    });
    return () => sub.remove();
  }, [generated?.token, checkInviteCompletion, refreshTokenList]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTokenStatus(prev => {
        let changed = false;
        const next = { ...prev };
        const openedIds = new Set(tokens.filter(t => t.openedAt).map(t => t.id));
        if (generated?.token && prev[generated.token] && prev[generated.token] !== 'waiting') {
          openedIds.add(generated.token);
        }

        openedIds.forEach(id => {
          if (isStaleTransientStatus(next[id], tokenStatusAt[id], now)) {
            next[id] = 'viewed';
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, STALE_CHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [generated?.token, tokens, tokenStatusAt]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      if (!refreshedRef.current) {
        refreshedRef.current = true;
        refresh();
      }
    });
    return unsub;
  }, [navigation, refresh]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const expiryHours = await getInviteExpiryHours();
      const result = await createInviteToken({
        levelNum: level.num,
        levelTitle: level.title,
        levelWhy: level.why || '',
        levelHow: level.how || '',
        levelRecord: level.record || '',
        levelSuggest: level.suggest || 'photo',
        levelTone: level.tone || 'orange',
        perspective: level.perspective,
        kidId: kidId || undefined,
        kidName: undefined,
        inviterRole: meName(me),
        illustrationPath: level.illustrationPath || level.illustration_path || undefined,
        expiresDays: expiryHours / 24,
      });
      setGenerated({ token: result.token, url: result.url });
      refreshTokenList();
    } catch (e: any) {
      Alert.alert(t('yaoji.errorTitle'), e.message || t('yaoji.errorGeneric'));
    }
    setCreating(false);
  };

  const handleRefreshInvite = async () => {
    if (!generated?.token || creating) return;
    setCreating(true);
    const oldToken = generated.token;
    try {
      await deactivateInviteToken(oldToken);
      setGenerated(null);
      setTokens(prev => prev.filter(t => t.id !== oldToken));
      setTokenStatus(prev => {
        const next = { ...prev };
        delete next[oldToken];
        return next;
      });
      setTokenStatusAt(prev => {
        const next = { ...prev };
        delete next[oldToken];
        return next;
      });

      const expiryHours = await getInviteExpiryHours();
      const result = await createInviteToken({
        levelNum: level.num,
        levelTitle: level.title,
        levelWhy: level.why || '',
        levelHow: level.how || '',
        levelRecord: level.record || '',
        levelSuggest: level.suggest || 'photo',
        levelTone: level.tone || 'orange',
        perspective: level.perspective,
        kidId: kidId || undefined,
        kidName: undefined,
        inviterRole: meName(me),
        illustrationPath: level.illustrationPath || level.illustration_path || undefined,
        expiresDays: expiryHours / 24,
      });
      setGenerated({ token: result.token, url: result.url });
      await refreshTokenList();
    } catch (e: any) {
      Alert.alert(t('yaoji.errorTitle'), e.message || t('yaoji.errorGeneric'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert('', t('yaoji.copied'));
  };

  const handleShare = async (url: string) => {
    try {
      await Share.share({
        message: `${t('yaoji.shareMessage', { title: level.title })}\n${url}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader
        title={t('yaoji.title')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Level info */}
        <Text style={[styles.levelTitle, { color: theme.ink, fontFamily: theme.fonts.head }]}>
          {level.title}
        </Text>

        {/* Loading */}
        {!generated && (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
        )}

        {/* Generated result */}
        {generated && (() => {
          const currentStatus = tokenStatus[generated.token] || 'waiting';
          const inviteOpened = currentStatus !== 'waiting';
          return (
            <View style={[styles.resultCard, { backgroundColor: theme.paper, borderColor: theme.line }]}>
              <View style={[styles.qrWrap, { backgroundColor: theme.paper }]}>
                <View style={inviteOpened && styles.qrDimmed}>
                  <QRCode
                    value={generated.url}
                    size={180}
                    backgroundColor={theme.paper}
                    color={theme.ink}
                  />
                </View>
                {inviteOpened && (
                  <View style={[styles.qrOverlay, { backgroundColor: theme.paper + 'E8' }]}>
                    <Text style={[styles.qrOverlayTitle, { color: theme.ink, fontFamily: theme.fonts.head }]}>
                      {t('yaoji.qrOpenedTitle')}
                    </Text>
                    <Text style={[styles.qrOverlayText, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                      {t('yaoji.qrOpenedDesc')}
                    </Text>
                  </View>
                )}
              </View>

              <StatusBadge
                status={currentStatus}
                theme={theme} t={t} large
              />

              {!inviteOpened && (
                <Text style={[styles.urlText, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}
                  selectable numberOfLines={2}>
                  {generated.url}
                </Text>
              )}

              {inviteOpened ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={handleRefreshInvite}
                    disabled={creating}
                    style={[styles.actionBtn, { backgroundColor: theme.accent, opacity: creating ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.actionLabel, { color: '#fff', fontFamily: theme.fonts.head }]}>
                      {creating ? t('yaoji.generating') : t('yaoji.refreshInvite')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => handleCopy(generated.url)}
                    style={[styles.actionBtn, { backgroundColor: theme.sand }]}
                  >
                    <Text style={[styles.actionLabel, { color: theme.ink, fontFamily: theme.fonts.head }]}>
                      {t('yaoji.copyLink')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShare(generated.url)}
                    style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                  >
                    <Text style={[styles.actionLabel, { color: '#fff', fontFamily: theme.fonts.head }]}>
                      {t('yaoji.share')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })()}

        {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />}
      </ScrollView>
    </View>
  );
}

const STATUS_CONFIG: Record<InviteStatus, { color: string; label: string }> = {
  waiting: { color: '#8B8175', label: 'yaoji.statusWait' },
  viewed: { color: '#DE8C57', label: 'yaoji.statusViewed' },
  recording: { color: '#5E7C61', label: 'yaoji.statusRecording' },
  uploading: { color: '#5E7C61', label: 'yaoji.statusUploading' },
  done: { color: '#5E7C61', label: 'yaoji.statusDone' },
};

function StatusBadge({ status, theme, t, large = false }: any) {
  const cfg = STATUS_CONFIG[status as InviteStatus] || STATUS_CONFIG.waiting;
  return (
    <View style={[
      statusStyles.badge,
      large && statusStyles.badgeLarge,
      { backgroundColor: cfg.color + '18' },
    ]}>
      <View style={[statusStyles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[
        statusStyles.text,
        large && statusStyles.textLarge,
        { color: cfg.color, fontFamily: theme.fonts.body },
      ]}>
        {t(cfg.label)}
      </Text>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  badgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11 },
  textLarge: { fontSize: 13 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroller: { flex: 1 },
  scrollContent: { paddingHorizontal: 26, paddingTop: 12 },

  levelTitle: { fontSize: 24, marginBottom: 8 },

  resultCard: {
    marginTop: 24, padding: 24, borderRadius: 22,
    borderWidth: 1, alignItems: 'center',
  },
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, position: 'relative', overflow: 'hidden' },
  qrDimmed: { opacity: 0.16 },
  qrOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 18,
  },
  qrOverlayTitle: { fontSize: 18, marginBottom: 6, textAlign: 'center' },
  qrOverlayText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  urlText: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center',
  },
  actionLabel: { fontSize: 15 },

});
