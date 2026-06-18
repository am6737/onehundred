import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Share, ActivityIndicator,
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
  createInviteToken, fetchInviteTokens, deactivateInviteToken,
  fetchInviteRecordCounts, inviteUrl, getInviteExpiryHours, type InviteToken,
} from '../lib/yaoji';
import { supabase } from '../lib/supabase';

type InviteStatus = 'waiting' | 'viewed' | 'recording' | 'uploading' | 'done';

export default function InviteRecord({ route, navigation }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { refresh } = useData();
  const { level, kidId, me } = route.params;

  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<{ token: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenStatus, setTokenStatus] = useState<Record<string, InviteStatus>>({});
  const refreshedRef = useRef(false);
  const channelsRef = useRef<any[]>([]);

  const refreshTokenList = useCallback(async () => {
    try {
      const list = await fetchInviteTokens(level.num);
      const active = list.filter(t => new Date(t.expiresAt) > new Date());
      setTokens(active);
      if (active.length) {
        const c = await fetchInviteRecordCounts(active.map(t => t.id));
        setCounts(c);
      }
      return active;
    } catch {
      return [];
    }
  }, [level.num]);

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
            setTokenStatus(prev => ({ ...prev, [id]: payload.status }));
            if (payload.status === 'done') {
              refreshedRef.current = true;
              refresh().then(() => {
                const memId = payload.memoryId;
                if (memId) {
                  navigation.replace('Memory', { memoryId: memId });
                } else {
                  navigation.goBack();
                }
              });
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
  }, [tokens, generated?.token]);

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

  const handleDeactivate = (tokenId: string) => {
    Alert.alert(t('yaoji.deactivateTitle'), t('yaoji.deactivateConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('yaoji.deactivate'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivateInviteToken(tokenId);
            const remaining = tokens.filter(t => t.id !== tokenId);
            setTokens(remaining);
            if (generated?.token === tokenId) {
              if (remaining.length) {
                setGenerated({ token: remaining[0].id, url: inviteUrl(remaining[0].id) });
              } else {
                setGenerated(null);
                handleCreate();
              }
            }
          } catch {}
        },
      },
    ]);
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
        {generated && (
          <View style={[styles.resultCard, { backgroundColor: theme.paper, borderColor: theme.line }]}>
            <View style={styles.qrWrap}>
              <QRCode
                value={generated.url}
                size={180}
                backgroundColor={theme.paper}
                color={theme.ink}
              />
            </View>

            {generated && (
              <StatusBadge
                status={tokenStatus[generated.token] || 'waiting'}
                theme={theme} t={t} large
              />
            )}

            <Text style={[styles.urlText, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}
              selectable numberOfLines={2}>
              {generated.url}
            </Text>

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
          </View>
        )}

        {/* Existing tokens */}
        {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />}

        {!loading && tokens.length > 0 && (
          <View style={styles.tokenList}>
            <View style={styles.tokenListHeader}>
              <Text style={[styles.tokenListTitle, { color: theme.inkSoft, fontFamily: theme.fonts.head }]}>
                {t('yaoji.existingTokens')}
              </Text>
              <TouchableOpacity onPress={refreshTokenList} style={styles.refreshBtn}>
                {Icon.redo(theme.accent, 16)}
              </TouchableOpacity>
            </View>
            {tokens.map(tk => {
              const count = counts[tk.id] || 0;
              const isCurrent = generated?.token === tk.id;
              const st = tokenStatus[tk.id];
              return (
                <View key={tk.id} style={[styles.tokenItem, { backgroundColor: theme.paper, borderColor: isCurrent ? theme.accent : theme.line }]}>
                  <View style={styles.tokenInfo}>
                    <View style={styles.tokenIdRow}>
                      <Text style={[styles.tokenId, { color: theme.ink, fontFamily: theme.fonts.body }]} numberOfLines={1}>
                        {inviteUrl(tk.id)}
                      </Text>
                      {isCurrent && (
                        <View style={[styles.currentBadge, { backgroundColor: theme.accent }]}>
                          <Text style={[styles.currentBadgeText, { fontFamily: theme.fonts.head }]}>
                            {t('yaoji.current')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.tokenMetaRow}>
                      <Text style={[styles.tokenMeta, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                        {t('yaoji.expiresAt', { date: new Date(tk.expiresAt).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}
                        {count > 0 ? `  ·  ${t('yaoji.receivedCount', { count })}` : ''}
                      </Text>
                      {st && <StatusBadge status={st} theme={theme} t={t} />}
                    </View>
                  </View>
                  <View style={styles.tokenActions}>
                    <TouchableOpacity onPress={() => handleCopy(inviteUrl(tk.id))} style={styles.tokenBtn}>
                      {Icon.copy(theme.inkSoft, 18)}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeactivate(tk.id)} style={styles.tokenBtn}>
                      {Icon.trash(theme.inkSoft, 18)}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
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
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 16 },
  urlText: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center',
  },
  actionLabel: { fontSize: 15 },

  tokenList: { marginTop: 32 },
  tokenListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tokenListTitle: { fontSize: 14 },
  refreshBtn: { padding: 6 },
  tokenItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 1,
    marginBottom: 10,
  },
  tokenInfo: { flex: 1, marginRight: 8 },
  tokenIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tokenId: { fontSize: 12, flexShrink: 1 },
  tokenMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  currentBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  currentBadgeText: { fontSize: 10, color: '#fff' },
  tokenMeta: { fontSize: 12 },
  tokenActions: { flexDirection: 'row', gap: 8 },
  tokenBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
});
