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
  fetchInviteRecordCounts, inviteUrl, type InviteToken,
} from '../lib/yaoji';

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
  const refreshedRef = useRef(false);

  const loadTokens = useCallback(async () => {
    try {
      const list = await fetchInviteTokens(level.num);
      const active = list.filter(t => new Date(t.expiresAt) > new Date());
      setTokens(active);
      if (active.length) {
        const c = await fetchInviteRecordCounts(active.map(t => t.id));
        setCounts(c);
      }
    } catch {}
    setLoading(false);
  }, [level.num]);

  useEffect(() => { loadTokens(); }, [loadTokens]);

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
      const result = await createInviteToken({
        levelNum: level.num,
        levelTitle: level.title,
        levelWhy: level.why || '',
        levelHow: level.how || '',
        levelSuggest: level.suggest || 'photo',
        levelTone: level.tone || 'orange',
        kidId: kidId || undefined,
        kidName: undefined,
        inviterRole: meName(me),
      });
      setGenerated({ token: result.token, url: result.url });
      loadTokens();
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
            setTokens(prev => prev.filter(t => t.id !== tokenId));
            if (generated?.token === tokenId) setGenerated(null);
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
        <Text style={[styles.desc, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
          {t('yaoji.desc')}
        </Text>

        {/* Generate button */}
        {!generated && (
          <PrimaryButton
            label={creating ? t('yaoji.generating') : t('yaoji.generate')}
            onPress={handleCreate}
            icon={creating ? null : Icon.share('#FFFDF7', 20)}
            style={styles.generateBtn}
          />
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
              <TouchableOpacity onPress={loadTokens} style={styles.refreshBtn}>
                {Icon.redo(theme.accent, 16)}
              </TouchableOpacity>
            </View>
            {tokens.map(tk => {
              const count = counts[tk.id] || 0;
              return (
                <View key={tk.id} style={[styles.tokenItem, { backgroundColor: theme.paper, borderColor: theme.line }]}>
                  <View style={styles.tokenInfo}>
                    <Text style={[styles.tokenId, { color: theme.ink, fontFamily: theme.fonts.body }]} numberOfLines={1}>
                      {inviteUrl(tk.id)}
                    </Text>
                    <Text style={[styles.tokenMeta, { color: theme.inkSoft, fontFamily: theme.fonts.body }]}>
                      {t('yaoji.expiresAt', { date: new Date(tk.expiresAt).toLocaleDateString() })}
                      {count > 0 ? `  ·  ${t('yaoji.receivedCount', { count })}` : ''}
                    </Text>
                  </View>
                  <View style={styles.tokenActions}>
                    <TouchableOpacity onPress={() => handleCopy(inviteUrl(tk.id))} style={styles.tokenBtn}>
                      {Icon.share(theme.inkSoft, 18)}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroller: { flex: 1 },
  scrollContent: { paddingHorizontal: 26, paddingTop: 12 },

  levelTitle: { fontSize: 24, marginBottom: 8 },
  desc: { fontSize: 14, lineHeight: 22 },

  generateBtn: { marginTop: 24 },

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
  tokenId: { fontSize: 12, marginBottom: 4 },
  tokenMeta: { fontSize: 12 },
  tokenActions: { flexDirection: 'row', gap: 8 },
  tokenBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
});
