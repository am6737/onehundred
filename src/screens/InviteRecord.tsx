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
  createInviteToken, fetchInviteTokens,
  inviteUrl, getInviteExpiryHours, type InviteToken,
} from '../lib/yaoji';
import { supabase } from '../lib/supabase';
import { CommonActions } from '@react-navigation/native';

type InviteStatus = 'waiting' | 'viewed' | 'recording' | 'uploading' | 'done';

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
  const refreshedRef = useRef(false);
  const channelsRef = useRef<any[]>([]);

  const refreshTokenList = useCallback(async () => {
    try {
      const list = await fetchInviteTokens(level.num);
      const active = list.filter(t => new Date(t.expiresAt) > new Date());
      setTokens(active);
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
                navigation.dispatch(
                  CommonActions.reset({
                    index: memId ? 1 : 0,
                    routes: [
                      { name: 'Home' },
                      ...(memId ? [{ name: 'Memory', params: { memoryId: memId } }] : []),
                    ],
                  })
                );
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
            <View style={[styles.qrWrap, { backgroundColor: theme.paper }]}>
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
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 16 },
  urlText: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center',
  },
  actionLabel: { fontSize: 15 },

});
