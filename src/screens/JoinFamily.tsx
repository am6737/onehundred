import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { ROLES, roleLabel, peekInvite } from '../data';
import { useData } from '../data/DataProvider';
import { Icon } from '../components/Icons';
import { LayerHeader } from '../components/common';
import QRScanner from '../components/QRScanner';

export default function JoinFamily({ navigation, route }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { family, joinFamily, leaveFamily, kids, memories } = useData();

  const initialCode = route?.params?.code || '';
  const [step, setStep] = useState<'code' | 'role'>('code');
  const [code, setCode] = useState(initialCode);
  const [takenRoles, setTakenRoles] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(!!route?.params?.autoScan);
  const autoTriggered = useRef(false);

  const isSolo = family && family.members?.length === 1;
  const availableRoles = ROLES.filter(r => !takenRoles.includes(r));

  const handleNext = async (rawCode?: string) => {
    const c = (rawCode ?? code).trim();
    if (!c || loading) return;
    setLoading(true);
    try {
      const result = await peekInvite(c);
      setCode(c);
      setTakenRoles(result.roles);
      setStep('role');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('invalid_code')) {
        Alert.alert(t('onboarding.joinFailTitle'), t('onboarding.invalidCode'));
      } else {
        Alert.alert(t('onboarding.joinFailTitle'), t('onboarding.networkRetry'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 扫码成功：填入邀请码并直接进入下一步（角色选择）
  const handleScanned = (scanned: string) => {
    setScanning(false);
    setCode(scanned);
    handleNext(scanned);
  };

  // 真正执行加入：solo 家庭先退出，再兑换邀请码
  const runJoin = async () => {
    setLoading(true);
    try {
      if (isSolo) {
        await leaveFamily();
      }
      await joinFamily(code.trim(), role, '');
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('invalid_code')) {
        Alert.alert(t('onboarding.joinFailTitle'), t('onboarding.invalidCode'));
      } else if (msg.includes('already_in_family')) {
        Alert.alert(t('onboarding.joinFailTitle'), t('onboarding.alreadyInFamily'));
      } else {
        Alert.alert(t('onboarding.joinFailTitle'), t('onboarding.networkRetry'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    if (!role || loading) return;
    // 多人家庭：不能带着其他成员离开，直接拦住
    if (family && !isSolo) {
      Alert.alert(t('joinFamily.cannotLeave'), t('joinFamily.cannotLeaveDesc'));
      return;
    }
    // solo 家庭里已经建了孩子/回忆：加入新家后会失去访问权，先确认
    if (isSolo && kids.length > 0) {
      const names = kids.map(k => k.name).filter(Boolean).join('、');
      const body = memories.length > 0
        ? t('joinFamily.leaveWarnBody', { names, count: memories.length })
        : t('joinFamily.leaveWarnBodyNoMemories', { names });
      Alert.alert(
        t('joinFamily.leaveWarnTitle'),
        body,
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('joinFamily.leaveWarnConfirm'), style: 'destructive', onPress: () => { runJoin(); } },
        ],
      );
      return;
    }
    // 空 solo 家庭 或 尚未建家：直接加入
    runJoin();
  };

  const handleBack = () => {
    if (step === 'role') {
      setStep('code');
      setRole('');
    } else {
      navigation.goBack();
    }
  };

  useEffect(() => {
    if (initialCode && !autoTriggered.current) {
      autoTriggered.current = true;
      handleNext();
    }
  }, []);

  if (step === 'role') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={t('joinFamily.title')}
          onBack={handleBack}
          right={
            <TouchableOpacity
              onPress={handleJoin}
              disabled={!role || loading}
              activeOpacity={0.7}
              style={{
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                backgroundColor: role && !loading ? theme.accent : theme.sand,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFDF7" size="small" />
              ) : (
                <Text style={{
                  fontFamily: theme.fonts.head, fontSize: 14,
                  color: role ? '#FFFDF7' : theme.inkSoft,
                }}>{t('joinFamily.join')}</Text>
              )}
            </TouchableOpacity>
          }
        />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}
        >
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {t('joinFamily.pickRoleDesc')}
          </Text>

          <View style={{ marginTop: 20, gap: 10 }}>
            {availableRoles.map(r => {
              const on = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 16, paddingHorizontal: 18,
                    borderRadius: 18, backgroundColor: theme.paper,
                    borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  }}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 12,
                    backgroundColor: on ? theme.accent : theme.sand,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{
                      fontFamily: theme.fonts.head, fontSize: 16,
                      color: on ? '#FFFDF7' : theme.ink,
                    }}>{roleLabel(r).slice(0, 1)}</Text>
                  </View>
                  <Text style={{
                    flex: 1, fontFamily: theme.fonts.body, fontSize: 16,
                    color: on ? theme.accent : theme.ink,
                  }}>{roleLabel(r)}</Text>
                  {on ? Icon.check(theme.accent, 18) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {takenRoles.length > 0 && (
            <Text style={{
              marginTop: 20, paddingHorizontal: 4,
              fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 21, color: theme.inkSoft,
            }}>
              {t('joinFamily.takenHint', { roles: takenRoles.map(r => roleLabel(r)).join('、') })}
            </Text>
          )}

          <Text style={{
            marginTop: 20, textAlign: 'center',
            fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 21, color: theme.inkSoft,
          }}>{t('joinFamily.hint')}</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      {!scanning && <LayerHeader title={t('joinFamily.title')} onBack={handleBack} />}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{
          marginTop: 2, marginHorizontal: 4,
          fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
        }}>
          {t('joinFamily.desc')}
        </Text>

        {/* Scan QR — 主推的加入方式 */}
        <TouchableOpacity
          onPress={() => setScanning(true)}
          activeOpacity={0.85}
          style={{
            marginTop: 28, paddingVertical: 18, borderRadius: 18,
            backgroundColor: theme.accent,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {Icon.camera('#FFFDF7', 20)}
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7' }}>
            {t('joinFamily.scanButton')}
          </Text>
        </TouchableOpacity>

        {/* Code input — 手动输入兜底 */}
        <View style={{
          marginTop: 18, padding: 24, borderRadius: 22,
          backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line,
          alignItems: 'center',
        }}>
          <Text style={{
            fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft, marginBottom: 14,
          }}>{t('joinFamily.orManual')}</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t('onboarding.codePlaceholder')}
            placeholderTextColor={theme.inkSoft}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={!initialCode}
            style={{
              width: '100%', borderWidth: 1, borderColor: theme.line,
              borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16,
              backgroundColor: theme.cream, color: theme.ink,
              fontFamily: theme.fonts.head, fontSize: 22, letterSpacing: 3,
              textAlign: 'center',
            }}
          />
        </View>

        {/* Next button */}
        <TouchableOpacity
          onPress={() => handleNext()}
          disabled={!code.trim() || loading}
          activeOpacity={0.7}
          style={{
            marginTop: 24, paddingVertical: 17, borderRadius: 999, alignItems: 'center',
            backgroundColor: code.trim() && !loading ? theme.accent : theme.sand,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFDF7" size="small" />
          ) : (
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 16,
              color: code.trim() ? '#FFFDF7' : theme.inkSoft,
            }}>{t('joinFamily.next')}</Text>
          )}
        </TouchableOpacity>

        <Text style={{
          marginTop: 20, textAlign: 'center',
          fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 21, color: theme.inkSoft,
        }}>{t('joinFamily.codeHint')}</Text>
      </ScrollView>

      {scanning && (
        <QRScanner onClose={() => setScanning(false)} onScanned={handleScanned} />
      )}
    </View>
  );
}
