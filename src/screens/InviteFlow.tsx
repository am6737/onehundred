import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { ROLES } from '../data';
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

function InvMemberRow({ role, onRemove = null, theme }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: theme.line,
    }}>
      <InvAvatar label={role} tone="orange" size={40} theme={theme} />
      <Text style={{ flex: 1, fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink }}>{role}</Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>已加入</Text>
    </View>
  );
}

const INVITE_OPTIONS = [
  { id: 'link', icon: 'share', label: '复制邀请链接', desc: '发给任何人' },
  { id: 'qr', icon: 'eye', label: '面对面扫码', desc: '让对方扫一扫' },
  { id: 'wechat', icon: 'users', label: '分享到微信', desc: '直接发给家人' },
];

export default function InviteFlow({ navigation, route }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('list');
  const [selectedRole, setSelectedRole] = useState(null);
  const [showShare, setShowShare] = useState(false);

  const familyMembers = ['爸爸'];
  const inviteCode = 'YIBAI-2026-A3K7';

  if (step === 'share') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title="邀请家人" onBack={() => setStep('list')} />
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 40 }}>
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink, textAlign: 'center',
            }}>邀请{selectedRole || '家人'}加入</Text>
            <Text style={{
              marginTop: 10, fontFamily: theme.fonts.body, fontSize: 14.5,
              color: theme.inkSoft, textAlign: 'center', lineHeight: 24,
            }}>选择一种方式，把邀请发出去</Text>
          </View>

          <View style={{
            borderRadius: 22, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, padding: 20, marginBottom: 20,
          }}>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
              textAlign: 'center', marginBottom: 8,
            }}>邀请码</Text>
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 24, color: theme.accent,
              textAlign: 'center', letterSpacing: 2,
            }}>{inviteCode}</Text>
          </View>

          {INVITE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => Alert.alert('马上就好', '邀请家人一起记的功能正在打磨，很快就能用。')}
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

  if (step === 'who') {
    const availableRoles = ROLES.filter(r => !familyMembers.includes(r));
    return (
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title="选择角色" onBack={() => setStep('list')} />
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 40 }}>
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
            textAlign: 'center', marginBottom: 8,
          }}>要邀请谁？</Text>
          <Text style={{
            fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.inkSoft,
            textAlign: 'center', marginBottom: 24,
          }}>选择 TA 在家里的角色</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {availableRoles.map(role => (
              <TouchableOpacity
                key={role}
                onPress={() => { setSelectedRole(role); setStep('share'); }}
                activeOpacity={0.8}
                style={{
                  width: '45%', alignItems: 'center', padding: 18,
                  borderRadius: 20, backgroundColor: theme.paper,
                  borderWidth: 1, borderColor: theme.line,
                }}
              >
                <InvAvatar label={role} tone="orange" size={56} theme={theme} />
                <Text style={{
                  marginTop: 10, fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink,
                }}>{role}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title="家庭成员" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <KidCluster theme={theme} />
          <Text style={{
            fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
          }}>我们的一百件事</Text>
          <Text style={{
            marginTop: 6, fontFamily: theme.fonts.body, fontSize: 14,
            color: theme.inkSoft,
          }}>和全家人一起记录成长</Text>
        </View>

        <View style={{
          borderRadius: 22, backgroundColor: theme.paper,
          borderWidth: 1, borderColor: theme.line, overflow: 'hidden',
        }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.line }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.inkSoft }}>已加入</Text>
          </View>
          {familyMembers.map(role => (
            <InvMemberRow key={role} role={role} theme={theme} />
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            label="邀请家人加入"
            icon={Icon.plus('#FFFDF7', 18)}
            onPress={() => setStep('who')}
          />
        </View>

        <Text style={{
          marginTop: 24, textAlign: 'center',
          fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 21,
          color: theme.inkSoft,
        }}>邀请更多家人一起参与，{'\n'}每个人都能看到回忆、养小熊</Text>
      </ScrollView>
    </View>
  );
}
