import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { roleLabel } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, KidAvatar } from '../components/Icons';
import { LayerHeader, PrimaryButton, SecondaryButton, Sheet, Chip } from '../components/common';

function InvAvatar({ label, tone, size = 52, theme }) {
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

function KidCluster({ theme }) {
  const { kids } = useData();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 }}>
      {kids.map(k => (
        <KidAvatar key={k.id} name={k.name} tone={k.tone} size={48} />
      ))}
    </View>
  );
}

function InvMemberRow({ role, canRemove = false, onRemove = null, theme }) {
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

  const INVITE_OPTIONS = [
    { id: 'link', icon: 'share', label: t('invite.optLinkLabel'), desc: t('invite.optLinkDesc') },
    { id: 'qr', icon: 'eye', label: t('invite.optQrLabel'), desc: t('invite.optQrDesc') },
    { id: 'wechat', icon: 'users', label: t('invite.optWechatLabel'), desc: t('invite.optWechatDesc') },
  ];
  const [step, setStep] = useState('list');
  const [showShare, setShowShare] = useState(false);

  const { family, removeMember } = useData();
  const inviteCode = family?.inviteCode || '——';
  const members = family?.members || [];
  const isCreator = family?.isCreator;

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

          <View style={{
            borderRadius: 22, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, padding: 20, marginBottom: 20,
          }}>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
              textAlign: 'center', marginBottom: 8,
            }}>{t('invite.code')}</Text>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 24, color: theme.accent,
              textAlign: 'center', letterSpacing: 2,
            }}>{inviteCode}</Text>
          </View>

          {INVITE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => Alert.alert(t('invite.comingSoonTitle'), t('invite.comingSoonBody'))}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                padding: 16, borderRadius: 18, backgroundColor: theme.paper,
                borderWidth: 1, borderColor: theme.line, marginBottom: 12,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: theme.sand, justifyContent: 'center', alignItems: 'center',
              }}>
                {Icon[opt.icon]?.(theme.accent, 20)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink }}>{opt.label}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, marginTop: 2 }}>{opt.desc}</Text>
              </View>
              {Icon.chevR(theme.inkSoft, 18)}
            </TouchableOpacity>
          ))}
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
      </ScrollView>
    </View>
  );
}
