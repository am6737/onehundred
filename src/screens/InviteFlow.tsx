import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Share, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { roleLabel } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, KidAvatar } from '../components/Icons';
import { LayerHeader, PrimaryButton, SecondaryButton, Sheet, Chip } from '../components/common';
import { familyInviteUrl } from '../lib/invite';

function InvAvatar({ label, tone, size = 52, theme }: any) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.sand,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{
        fontFamily: theme.fonts.head, fontSize: size * 0.38, color: theme.ink,
      }}>{label?.slice(0, 1) || '?'}</Text>
    </View>
  );
}

function KidCluster({ theme }: any) {
  const { kids } = useData();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 }}>
      {kids.map(k => (
        <KidAvatar key={k.id} name={k.name} tone={k.tone} size={48} />
      ))}
    </View>
  );
}

function InvMemberRow({ role, canRemove = false, onRemove = null, theme }: any) {
  const t = useT();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: theme.line,
    }}>
      <InvAvatar label={role} tone="orange" size={40} theme={theme} />
      <Text style={{ flex: 1, fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink }}>{role}</Text>
      {canRemove ? (
        <TouchableOpacity
          onPress={() => Alert.alert(t('invite.removeTitle'), t('invite.removeBody', { role }), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('invite.remove'), style: 'destructive', onPress: onRemove },
          ])}
          activeOpacity={0.7}
        >
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.danger || '#C2553D' }}>{t('invite.remove')}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>{t('invite.joined')}</Text>
      )}
    </View>
  );
}

export default function InviteFlow({ navigation, route }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState('list');
  const [showShare, setShowShare] = useState<any>(false);

  const { family, removeMember } = useData();
  const inviteCode = family?.inviteCode || '——';
  const hasCode = !!family?.inviteCode;
  const members = family?.members || [];
  const isCreator = family?.isCreator;

  const onShareLink = async () => {
    if (!hasCode) return;
    try {
      await Share.share({
        message: t('invite.shareMessage', { code: inviteCode, url: familyInviteUrl(inviteCode) }),
      });
    } catch {}
  };

  const onCopyCode = async () => {
    if (!hasCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert(t('invite.copiedTitle'));
  };

  if (step === 'share') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('invite.inviteFamily')} onBack={() => setStep('list')} />
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 40 }}>
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink, textAlign: 'center',
            }}>{t('invite.inviteToJoin')}</Text>
            <Text style={{
              marginTop: 10, fontFamily: theme.fonts.body, fontSize: 14.5,
              color: theme.inkSoft, textAlign: 'center', lineHeight: 24,
            }}>{t('invite.chooseWay')}</Text>
          </View>

          {/* 二维码卡片：让家人打开 App 扫一扫即可加入 */}
          <View style={{
            borderRadius: 22, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, padding: 24, marginBottom: 20,
            alignItems: 'center',
          }}>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 17, color: theme.ink,
              textAlign: 'center', marginBottom: 4,
            }}>{t('invite.qrTitle')}</Text>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
              textAlign: 'center', marginBottom: 20, lineHeight: 20,
            }}>{t('invite.qrHint')}</Text>

            {hasCode ? (
              <View style={{ padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF' }}>
                <QRCode
                  value={familyInviteUrl(inviteCode)}
                  size={200}
                  backgroundColor="#FFFFFF"
                  color="#2A2723"
                />
              </View>
            ) : (
              <ActivityIndicator color={theme.accent} style={{ height: 232 }} />
            )}

            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft,
              textAlign: 'center', marginTop: 20, marginBottom: 6,
            }}>{t('invite.orManualCode')}</Text>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 24, color: theme.accent,
              textAlign: 'center', letterSpacing: 3,
            }}>{inviteCode}</Text>
          </View>

          <PrimaryButton
            label={t('invite.shareLink')}
            icon={Icon.share('#FFFDF7', 18)}
            onPress={onShareLink}
          />
          <View style={{ height: 12 }} />
          <SecondaryButton
            label={t('invite.copyCode')}
            onPress={onCopyCode}
          />
        </ScrollView>
      </View>
    );
  }


  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('invite.members')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <KidCluster theme={theme} />
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
          }}>{t('invite.ourTitle')}</Text>
          <Text style={{
            marginTop: 6, fontFamily: theme.fonts.body, fontSize: 14,
            color: theme.inkSoft,
          }}>{t('invite.ourSub')}</Text>
        </View>

        <View style={{
          borderRadius: 22, backgroundColor: theme.paper,
          borderWidth: 1, borderColor: theme.line, overflow: 'hidden',
        }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.line }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.inkSoft }}>{t('invite.joined')}</Text>
          </View>
          {members.map(m => (
            <InvMemberRow
              key={m.userId}
              role={m.role === '其他' ? (m.customRole || t('role.familyMember')) : roleLabel(m.role)}
              theme={theme}
              canRemove={isCreator && !m.isMe}
              onRemove={() => removeMember(m.userId)}
            />
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            label={t('invite.inviteToJoin')}
            icon={Icon.plus('#FFFDF7', 18)}
            onPress={() => setStep('share')}
          />
        </View>

        <Text style={{
          marginTop: 24, textAlign: 'center',
          fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 21,
          color: theme.inkSoft,
        }}>{t('invite.footer')}</Text>

        {/* Join another family — shown when user is solo */}
        {members.length <= 1 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('JoinFamily')}
            activeOpacity={0.7}
            style={{
              marginTop: 24, padding: 20, borderRadius: 22,
              backgroundColor: theme.paper,
              borderWidth: 1.5, borderColor: theme.line,
              borderStyle: 'dashed',
              flexDirection: 'row', alignItems: 'center', gap: 14,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: theme.sand,
              justifyContent: 'center', alignItems: 'center',
            }}>
              {Icon.plus(theme.accent, 20)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink,
              }}>{t('invite.haveCode')}</Text>
              <Text style={{
                marginTop: 3, fontFamily: theme.fonts.body, fontSize: 12.5,
                color: theme.inkSoft, lineHeight: 19,
              }}>{t('invite.haveCodeDesc')}</Text>
            </View>
            {Icon.chevR(theme.inkSoft, 18)}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
