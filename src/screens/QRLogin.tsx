import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Icon } from '../components/Icons';
import { useT } from '../i18n';
import {
  completeQrLogin, createQrLoginChallenge, pollQrLoginChallenge,
  type QrLoginChallenge,
} from '../lib/qrLogin';
import { useTheme } from '../theme/tokens';

const QR_SIZE = Math.min(250, Dimensions.get('window').width - 96);

export default function QRLogin({ navigation }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [challenge, setChallenge] = useState<QrLoginChallenge | null>(null);
  const [state, setState] = useState<'loading' | 'pending' | 'confirming' | 'expired' | 'error'>('loading');

  const loadChallenge = useCallback(async () => {
    setState('loading');
    setChallenge(null);
    try {
      const next = await createQrLoginChallenge();
      setChallenge(next);
      setState('pending');
    } catch (error) {
      console.warn('[qr-login] Failed to create challenge', error);
      setState('error');
    }
  }, []);

  useEffect(() => { loadChallenge(); }, [loadChallenge]);

  useEffect(() => {
    if (!challenge) return;
    let cancelled = false;
    let running = false;
    let done = false;

    const poll = async () => {
      if (running || cancelled || done) return;
      running = true;
      try {
        const result = await pollQrLoginChallenge(challenge.id, challenge.pollToken);
        if (cancelled) return;
        if (result.status === 'expired') {
          done = true;
          setState('expired');
        } else if (result.status === 'approved') {
          done = true;
          setState('confirming');
          try {
            await completeQrLogin(result.tokenHash);
            if (!cancelled) navigation.replace('Home');
          } catch (error) {
            console.warn('[qr-login] Failed to complete sign-in', error);
            if (!cancelled) setState('error');
          }
        }
      } catch (error) {
        console.warn('[qr-login] Poll failed', error);
      } finally {
        running = false;
      }
    };

    poll();
    const timer = setInterval(poll, 1800);
    return () => { cancelled = true; clearInterval(timer); };
  }, [challenge, navigation]);

  const statusText = state === 'loading'
    ? t('common.loading')
    : state === 'confirming'
    ? t('login.qrConfirming')
    : state === 'expired'
      ? t('login.qrExpired')
      : state === 'error'
        ? t('login.qrCreateFail')
        : t('login.qrWaiting');

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.a11y.back')}
          style={{
            width: 42, height: 42,
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          {Icon.chevL(theme.ink, 24)}
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 30 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 24, color: theme.ink }}>
          {t('login.qrLoginTitle')}
        </Text>
        <Text style={{
          marginTop: 10, fontFamily: theme.fonts.body, fontSize: 14,
          lineHeight: 22, color: theme.inkSoft, textAlign: 'center',
        }}>
          {t('login.qrDisplayHint')}
        </Text>

        <View style={{
          width: QR_SIZE + 40, height: QR_SIZE + 40, marginTop: 34,
          backgroundColor: '#FFFFFF', borderRadius: 8,
          justifyContent: 'center', alignItems: 'center',
        }}>
          {challenge && state !== 'expired' ? (
            <QRCode value={challenge.qrValue} size={QR_SIZE} color="#111111" backgroundColor="#FFFFFF" />
          ) : (
            <ActivityIndicator color={theme.accent} />
          )}
        </View>

        <View style={{
          height: 64,
          marginTop: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {(state === 'pending' || state === 'confirming') ? (
            <ActivityIndicator color={theme.accent} size="small" />
          ) : null}
          <Text style={{
            marginTop: 8, fontFamily: theme.fonts.body, fontSize: 14,
            color: state === 'error' ? '#C0616B' : theme.inkSoft,
          }}>{statusText}</Text>
        </View>

        {(state === 'expired' || state === 'error') ? (
          <TouchableOpacity onPress={loadChallenge} activeOpacity={0.75} style={{ padding: 12 }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.accent }}>
              {t('login.qrRefresh')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
