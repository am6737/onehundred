import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, COLORS } from '../theme/tokens';
import { useT } from '../i18n';
import { ROLES, NOW_YM, roleLabel } from '../data';
import { useData } from '../data/DataProvider';
import { Icon, KidAvatar } from '../components/Icons';

const { width: SCREEN_W } = Dimensions.get('window');

const FLOW = ['welcome', 'me', 'child', 'done'] as const;
const STEP_PAGES = ['me', 'child'];
const ageFrom = (y: number, m: number) => Math.max(0, NOW_YM.y - y - (NOW_YM.m < m ? 1 : 0));

/* ── TopBar with progress dots ── */

function TopBar({ onBack, page }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const i = STEP_PAGES.indexOf(page);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 8,
    }}>
      <View style={{ width: 42 }}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: theme.sand,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            {Icon.chevL(theme.ink, 20)}
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 7 }}>
        {i >= 0 && STEP_PAGES.map((_, k) => (
          <View key={k} style={{
            width: k === i ? 22 : 7, height: 7, borderRadius: 999,
            backgroundColor: (k <= i) ? theme.accent : theme.line,
          }} />
        ))}
      </View>

      <View style={{ width: 42 }} />
    </View>
  );
}

/* ── CTA button ── */

function CTA({ label, onPress, disabled = false, hint = '' }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 + insets.bottom }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        style={{
          paddingVertical: 17, borderRadius: 999, alignItems: 'center',
          backgroundColor: disabled ? theme.sand : theme.accent,
          shadowColor: disabled ? 'transparent' : theme.accent,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: disabled ? 0 : 0.3,
          shadowRadius: 28,
          elevation: disabled ? 0 : 4,
        }}
      >
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 17.5,
          color: disabled ? theme.inkSoft : '#FFFDF7',
          letterSpacing: 0.5,
        }}>{label}</Text>
      </TouchableOpacity>
      {hint ? (
        <Text style={{
          textAlign: 'center', marginTop: 13,
          fontFamily: theme.fonts.hand, fontSize: 15.5,
          color: theme.inkSoft, lineHeight: 26,
        }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ── Stepper ── */

function Stepper({ value, min, max, onChange, fmt = (v) => String(v), wrap = false }) {
  const { theme } = useTheme();
  const step = (d: number) => {
    let v = value + d;
    if (wrap) { if (v < min) v = max; if (v > max) v = min; }
    else v = Math.min(max, Math.max(min, v));
    onChange(v);
  };
  const Btn = ({ d, dis }) => (
    <TouchableOpacity
      onPress={() => step(d)}
      disabled={dis}
      activeOpacity={0.7}
      style={{
        width: 34, height: 34, borderRadius: 999,
        backgroundColor: theme.sand,
        justifyContent: 'center', alignItems: 'center',
        opacity: dis ? 0.35 : 1,
      }}
    >
      {d < 0 ? Icon.chevL(theme.ink, 18) : Icon.chevR(theme.ink, 18)}
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Btn d={-1} dis={!wrap && value <= min} />
      <Text style={{
        minWidth: 64, textAlign: 'center',
        fontFamily: theme.fonts.head, fontSize: 21, color: theme.ink,
      }}>{fmt(value)}</Text>
      <Btn d={1} dis={!wrap && value >= max} />
    </View>
  );
}

/* ── Step 1: Welcome ── */

function WelcomeStep({ onNext, onJoin }) {
  const { theme } = useTheme();
  const t = useT();
  return (
    <>
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 34,
      }}>
        <Animated.Text entering={FadeIn.duration(500)} style={{
          fontFamily: theme.fonts.hand, fontSize: 19,
          color: theme.accent, letterSpacing: 2,
        }}>{t('onboarding.brand')}</Animated.Text>

        <Animated.Text entering={FadeIn.duration(500).delay(100)} style={{
          marginTop: 18, fontFamily: theme.fonts.head, fontSize: 32,
          lineHeight: 46, color: theme.ink, textAlign: 'center',
        }}>{t('onboarding.welcomeTitle')}</Animated.Text>

        <Animated.View entering={FadeIn.duration(500).delay(180)} style={{
          width: 36, height: 3, borderRadius: 999,
          backgroundColor: theme.accent, opacity: 0.5, marginVertical: 22,
        }} />

        <Animated.Text entering={FadeIn.duration(500).delay(260)} style={{
          maxWidth: 280, fontSize: 16, lineHeight: 31,
          color: theme.inkSoft, textAlign: 'center',
        }}>{t('onboarding.welcomeBody')}</Animated.Text>
      </View>

      <CTA label={t('onboarding.start')} onPress={onNext} hint={t('onboarding.startHint')} />
      <TouchableOpacity onPress={onJoin} activeOpacity={0.7} style={{ paddingBottom: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.inkSoft }}>
          {t('onboarding.haveFamily')}<Text style={{ color: theme.accent }}>{t('onboarding.enterInvite')}</Text>
        </Text>
      </TouchableOpacity>
    </>
  );
}

/* ── Step 2: Me (select role) ── */

function MeStep({ value, onChange, onNext }) {
  const { theme } = useTheme();
  const t = useT();
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{
          fontFamily: theme.fonts.hand, fontSize: 17,
          color: theme.accent, marginBottom: 8,
        }}>{t('onboarding.firstThing')}</Text>
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 27,
          lineHeight: 38, color: theme.ink,
        }}>{t('onboarding.whatCallYou')}</Text>
        <Text style={{
          marginTop: 12, fontSize: 15, lineHeight: 28,
          color: theme.inkSoft,
        }}>{t('onboarding.whatCallYouHint')}</Text>

        <View style={{
          marginTop: 26, flexDirection: 'row', flexWrap: 'wrap', gap: 11,
        }}>
          {ROLES.map(r => {
            const on = value === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => onChange(r)}
                activeOpacity={0.7}
                style={{
                  width: (SCREEN_W - 48 - 11) / 2,
                  paddingVertical: 20, borderRadius: 20, alignItems: 'center',
                  backgroundColor: on ? theme.accent : theme.paper,
                  borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  shadowColor: on ? theme.accent : 'transparent',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: on ? 0.3 : 0,
                  shadowRadius: 24,
                  elevation: on ? 4 : 0,
                }}
              >
                <Text style={{
                  fontFamily: theme.fonts.head, fontSize: 19,
                  color: on ? '#FFFDF7' : theme.ink,
                }}>{roleLabel(r)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      <CTA
        label={value ? t('onboarding.iAm', { role: roleLabel(value) }) : t('onboarding.pickOne')}
        onPress={onNext}
        disabled={!value}
      />
    </>
  );
}

/* ── Step 3: Child ── */

function ChildStep({ child, onChange, onNext }) {
  const { theme } = useTheme();
  const t = useT();
  const set = (patch) => onChange({ ...child, ...patch });
  const age = ageFrom(child.y, child.m);
  const named = child.name.trim().length > 0;

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 27,
          lineHeight: 38, color: theme.ink,
        }}>{t('onboarding.childTitle')}</Text>
        <Text style={{
          marginTop: 12, fontSize: 15, lineHeight: 28,
          color: theme.inkSoft,
        }}>{t('onboarding.childHint')}</Text>

        <View style={{ alignItems: 'center', marginTop: 22 }}>
          <KidAvatar name={child.name} tone="orange" size={78} />
        </View>

        <TextInput
          value={child.name}
          onChangeText={(v) => set({ name: v })}
          placeholder={t('onboarding.childNamePlaceholder')}
          placeholderTextColor={theme.inkSoft}
          maxLength={8}
          autoFocus
          style={{
            marginTop: 18, width: '100%',
            borderWidth: 1.5, borderColor: theme.line,
            borderRadius: 18, paddingVertical: 15, paddingHorizontal: 17,
            backgroundColor: theme.paper, color: theme.ink,
            fontFamily: theme.fonts.head, fontSize: 17, textAlign: 'center',
          }}
        />

        <View style={{
          marginTop: 14, backgroundColor: theme.paper,
          borderWidth: 1, borderColor: theme.line,
          borderRadius: 22, overflow: 'hidden',
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 16, paddingHorizontal: 18,
            borderBottomWidth: 1, borderBottomColor: theme.line,
          }}>
            <Text style={{ fontSize: 15.5, color: theme.ink }}>{t('onboarding.birthYear')}</Text>
            <Stepper value={child.y} min={2008} max={NOW_YM.y} onChange={v => set({ y: v })} fmt={v => t('onboarding.yearFmt', { v })} />
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 16, paddingHorizontal: 18,
          }}>
            <Text style={{ fontSize: 15.5, color: theme.ink }}>{t('onboarding.birthMonth')}</Text>
            <Stepper value={child.m} min={1} max={12} wrap onChange={v => set({ m: v })} fmt={v => t('onboarding.monthFmt', { v })} />
          </View>
        </View>

        <View style={{
          marginTop: 18, padding: 20, borderRadius: 22,
          backgroundColor: theme.sand, alignItems: 'center',
        }}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink }}>
            {named ? t('onboarding.ageRecapNamed', { name: child.name.trim(), age }) : t('onboarding.ageRecap', { age })}
          </Text>
        </View>
      </ScrollView>

      <CTA
        label={named ? t('onboarding.gotIt') : t('onboarding.writeNameFirst')}
        onPress={onNext}
        disabled={!named}
      />
    </>
  );
}

/* ── Step 4: Done ── */

function DoneStep({ me, child, onEnter, loading }) {
  const { theme } = useTheme();
  const t = useT();
  const age = ageFrom(child.y, child.m);
  const recap = [t('onboarding.recapYou', { role: roleLabel(me) }), t('onboarding.recapChild', { name: child.name.trim(), age })];

  return (
    <>
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 32,
      }}>
        <Animated.Text entering={FadeIn.duration(400).delay(80)} style={{
          marginTop: 14, fontFamily: theme.fonts.head, fontSize: 28,
          lineHeight: 41, color: theme.ink, textAlign: 'center',
        }}>{t('onboarding.doneTitle', { name: child.name.trim() })}</Animated.Text>

        <Animated.View entering={FadeIn.duration(400).delay(160)} style={{
          marginTop: 22, flexDirection: 'row', flexWrap: 'wrap',
          gap: 8, justifyContent: 'center',
        }}>
          {recap.map(r => (
            <View key={r} style={{
              paddingVertical: 8, paddingHorizontal: 15,
              borderRadius: 999, backgroundColor: theme.sand,
            }}>
              <Text style={{ fontSize: 13.5, color: theme.ink }}>{r}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.Text entering={FadeIn.duration(400).delay(240)} style={{
          marginTop: 24, fontFamily: theme.fonts.hand, fontSize: 16,
          color: theme.inkSoft, lineHeight: 29,
        }}>{t('onboarding.doneHint')}</Animated.Text>
      </View>

      <CTA
        label={loading ? t('onboarding.preparing') : t('onboarding.enterApp')}
        onPress={onEnter}
        disabled={loading}
      />
    </>
  );
}

/* ── Join step A: 邀请码 ── */
function JoinCodeStep({ code, onChange, onNext }) {
  const { theme } = useTheme();
  const t = useT();
  const ok = code.trim().length > 0;
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{ fontFamily: theme.fonts.hand, fontSize: 17, color: theme.accent, marginBottom: 8 }}>{t('onboarding.joinTitle')}</Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink }}>{t('onboarding.enterCode')}</Text>
        <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 28, color: theme.inkSoft }}>
          {t('onboarding.joinHint')}
        </Text>
        <TextInput
          value={code}
          onChangeText={(v) => onChange(v.toUpperCase())}
          placeholder={t('onboarding.codePlaceholder')}
          placeholderTextColor={theme.inkSoft}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          style={{
            marginTop: 22, width: '100%',
            borderWidth: 1.5, borderColor: theme.line, borderRadius: 18,
            paddingVertical: 16, paddingHorizontal: 17,
            backgroundColor: theme.paper, color: theme.ink,
            fontFamily: theme.fonts.head, fontSize: 20, letterSpacing: 3, textAlign: 'center',
          }}
        />
      </ScrollView>
      <CTA label={t('common.next')} onPress={onNext} disabled={!ok} />
    </>
  );
}

/* ── Join step B: 选自己的角色（孩子叫你什么）── */
function JoinRoleStep({ value, onChange, onEnter, loading }) {
  const { theme } = useTheme();
  const t = useT();
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink }}>{t('onboarding.whatCallYou')}</Text>
        <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 28, color: theme.inkSoft }}>
          {t('onboarding.joinRoleHint')}
        </Text>
        <View style={{ marginTop: 26, flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
          {ROLES.map(r => {
            const on = value === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => onChange(r)}
                activeOpacity={0.7}
                style={{
                  width: (SCREEN_W - 48 - 11) / 2,
                  paddingVertical: 20, borderRadius: 20, alignItems: 'center',
                  backgroundColor: on ? theme.accent : theme.paper,
                  borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  shadowColor: on ? theme.accent : 'transparent',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: on ? 0.3 : 0,
                  shadowRadius: 24,
                  elevation: on ? 4 : 0,
                }}
              >
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 19, color: on ? '#FFFDF7' : theme.ink }}>{roleLabel(r)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <CTA label={loading ? t('onboarding.joining') : (value ? t('onboarding.iAmJoin', { role: roleLabel(value) }) : t('onboarding.pickOne'))} onPress={onEnter} disabled={!value || loading} />
    </>
  );
}

/* ── Main Onboarding Screen ── */

export default function OnboardingScreen({ navigation }) {
  const { addKid, createFamily, joinFamily, updateMe } = useData();
  const { theme } = useTheme();
  const t = useT();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [page, setPage] = useState<typeof FLOW[number]>('welcome');
  const [joinStep, setJoinStep] = useState<'code' | 'role'>('code');
  const [me, setMe] = useState('');
  const [code, setCode] = useState('');
  const [child, setChild] = useState({ name: '', y: 2021, m: 3 });
  const [saving, setSaving] = useState(false);

  const idx = FLOW.indexOf(page);
  const next = () => setPage(FLOW[Math.min(FLOW.length - 1, idx + 1)]);

  // 创建路径：建家 → 镜像角色 → 加孩子 → 进首页
  const enter = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createFamily(me, '');
      await updateMe({ role: me, custom_role: '' });
      await addKid({ name: child.name.trim(), y: child.y, m: child.m, tone: 'orange' });
      navigation.replace('Home');
    } catch (e: any) {
      console.error('Onboarding create error:', e);
      Alert.alert(t('onboarding.saveFailTitle'), t('onboarding.networkRetry'));
      setSaving(false);
    }
  };

  // 加入路径：redeem → 镜像角色 → 进首页
  const doJoin = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await joinFamily(code.trim(), me, '');
      await updateMe({ role: me, custom_role: '' });
      navigation.replace('Home');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('invalid_code')) {
        setJoinStep('code');
        Alert.alert(t('onboarding.joinFailTitle'), t('onboarding.invalidCode'));
      } else {
        const hint = msg.includes('already_in_family') ? t('onboarding.alreadyInFamily') : t('onboarding.networkRetry');
        Alert.alert(t('onboarding.joinFailTitle'), hint);
      }
      setSaving(false);
    }
  };

  const startJoin = () => { setMode('join'); setJoinStep('code'); };
  const back = () => {
    if (mode === 'join') {
      if (joinStep === 'role') { setJoinStep('code'); return; }
      setMode('create'); setPage('welcome'); return;
    }
    if (idx > 0) setPage(FLOW[idx - 1]);
  };
  const showBack = mode === 'join' || idx > 0;

  const body = (() => {
    if (mode === 'join') {
      if (joinStep === 'code') return <JoinCodeStep code={code} onChange={setCode} onNext={() => setJoinStep('role')} />;
      return <JoinRoleStep value={me} onChange={setMe} onEnter={doJoin} loading={saving} />;
    }
    switch (page) {
      case 'welcome': return <WelcomeStep onNext={next} onJoin={startJoin} />;
      case 'me': return <MeStep value={me} onChange={setMe} onNext={next} />;
      case 'child': return <ChildStep child={child} onChange={setChild} onNext={next} />;
      case 'done': return <DoneStep me={me} child={child} onEnter={enter} loading={saving} />;
      default: return null;
    }
  })();

  // 进度点只在创建路径显示；加入路径不显示
  const barPage = mode === 'join' ? 'welcome' : page;

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <TopBar onBack={showBack ? back : null} page={barPage} />
      <View style={{ flex: 1 }}>
        {body}
      </View>
    </View>
  );
}
