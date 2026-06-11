import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, COLORS } from '../theme/tokens';
import { ROLES, NOW_YM } from '../data';
import { useData } from '../data/DataProvider';
import { setMe as persistMe } from '../utils/storage';
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
  return (
    <>
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 34,
      }}>
        <Animated.Text entering={FadeIn.duration(500)} style={{
          fontFamily: theme.fonts.hand, fontSize: 19,
          color: theme.accent, letterSpacing: 2,
        }}>一百件事</Animated.Text>

        <Animated.Text entering={FadeIn.duration(500).delay(100)} style={{
          marginTop: 18, fontFamily: theme.fonts.head, fontSize: 32,
          lineHeight: 46, color: theme.ink, textAlign: 'center',
        }}>{'慢慢来，\n一起长大'}</Animated.Text>

        <Animated.View entering={FadeIn.duration(500).delay(180)} style={{
          width: 36, height: 3, borderRadius: 999,
          backgroundColor: theme.accent, opacity: 0.5, marginVertical: 22,
        }} />

        <Animated.Text entering={FadeIn.duration(500).delay(260)} style={{
          maxWidth: 280, fontSize: 16, lineHeight: 31,
          color: theme.inkSoft, textAlign: 'center',
        }}>{'把它们一件件记下来，\n慢慢写成一本回忆录。'}</Animated.Text>
      </View>

      <CTA label="好，开始吧" onPress={onNext} hint="花一分钟，让它认识你们" />
      <TouchableOpacity onPress={onJoin} activeOpacity={0.7} style={{ paddingBottom: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.inkSoft }}>
          已经有家人在用了？<Text style={{ color: theme.accent }}>输入邀请码加入</Text>
        </Text>
      </TouchableOpacity>
    </>
  );
}

/* ── Step 2: Me (select role) ── */

function MeStep({ value, onChange, onNext }) {
  const { theme } = useTheme();
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{
          fontFamily: theme.fonts.hand, fontSize: 17,
          color: theme.accent, marginBottom: 8,
        }}>第一件事</Text>
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 27,
          lineHeight: 38, color: theme.ink,
        }}>孩子叫你什么？</Text>
        <Text style={{
          marginTop: 12, fontSize: 15, lineHeight: 28,
          color: theme.inkSoft,
        }}>「为你」「为我」，都要先知道是谁在为谁。</Text>

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
                }}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      <CTA
        label={value ? `我是${value}` : '选一个'}
        onPress={onNext}
        disabled={!value}
      />
    </>
  );
}

/* ── Step 3: Child ── */

function ChildStep({ child, onChange, onNext }) {
  const { theme } = useTheme();
  const set = (patch) => onChange({ ...child, ...patch });
  const age = ageFrom(child.y, child.m);
  const named = child.name.trim().length > 0;

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{
          fontFamily: theme.fonts.head, fontSize: 27,
          lineHeight: 38, color: theme.ink,
        }}>这个家的小朋友</Text>
        <Text style={{
          marginTop: 12, fontSize: 15, lineHeight: 28,
          color: theme.inkSoft,
        }}>先从一个开始。TA 叫什么，又是哪个月来到你们身边的。</Text>

        <View style={{ alignItems: 'center', marginTop: 22 }}>
          <KidAvatar name={child.name} tone="orange" size={78} />
        </View>

        <TextInput
          value={child.name}
          onChangeText={(t) => set({ name: t })}
          placeholder="写下孩子的名字或小名"
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
            <Text style={{ fontSize: 15.5, color: theme.ink }}>出生年份</Text>
            <Stepper value={child.y} min={2008} max={NOW_YM.y} onChange={v => set({ y: v })} fmt={v => v + ' 年'} />
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 16, paddingHorizontal: 18,
          }}>
            <Text style={{ fontSize: 15.5, color: theme.ink }}>出生月份</Text>
            <Stepper value={child.m} min={1} max={12} wrap onChange={v => set({ m: v })} fmt={v => v + ' 月'} />
          </View>
        </View>

        <View style={{
          marginTop: 18, padding: 20, borderRadius: 22,
          backgroundColor: theme.sand, alignItems: 'center',
        }}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink }}>
            {named ? `${child.name.trim()}，今年 ${age} 岁` : `今年 ${age} 岁`}
          </Text>
        </View>
      </ScrollView>

      <CTA
        label={named ? '记下了' : '先写下名字'}
        onPress={onNext}
        disabled={!named}
      />
    </>
  );
}

/* ── Step 4: Done ── */

function DoneStep({ me, child, onEnter, loading }) {
  const { theme } = useTheme();
  const age = ageFrom(child.y, child.m);
  const recap = [`你是${me}`, `${child.name.trim()} ${age} 岁`];

  return (
    <>
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 32,
      }}>
        <Animated.Text entering={FadeIn.duration(400).delay(80)} style={{
          marginTop: 14, fontFamily: theme.fonts.head, fontSize: 28,
          lineHeight: 41, color: theme.ink, textAlign: 'center',
        }}>{`${child.name.trim()}，\n在这里等你们的第一件事`}</Animated.Text>

        <Animated.View entering={FadeIn.duration(400).delay(160)} style={{
          marginTop: 22, flexDirection: 'row', flexWrap: 'wrap',
          gap: 8, justifyContent: 'center',
        }}>
          {recap.map(t => (
            <View key={t} style={{
              paddingVertical: 8, paddingHorizontal: 15,
              borderRadius: 999, backgroundColor: theme.sand,
            }}>
              <Text style={{ fontSize: 13.5, color: theme.ink }}>{t}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.Text entering={FadeIn.duration(400).delay(240)} style={{
          marginTop: 24, fontFamily: theme.fonts.hand, fontSize: 16,
          color: theme.inkSoft, lineHeight: 29,
        }}>剩下的，慢慢来就好。</Animated.Text>
      </View>

      <CTA
        label={loading ? '准备中...' : '进入「一百件事」'}
        onPress={onEnter}
        disabled={loading}
      />
    </>
  );
}

/* ── Join step A: 邀请码 ── */
function JoinCodeStep({ code, onChange, onNext }) {
  const { theme } = useTheme();
  const ok = code.trim().length > 0;
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{ fontFamily: theme.fonts.hand, fontSize: 17, color: theme.accent, marginBottom: 8 }}>加入家人的家</Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink }}>输入邀请码</Text>
        <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 28, color: theme.inkSoft }}>
          家人在「邀请家人」里能看到这串口令。
        </Text>
        <TextInput
          value={code}
          onChangeText={(t) => onChange(t.toUpperCase())}
          placeholder="邀请码"
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
      <CTA label="下一步" onPress={onNext} disabled={!ok} />
    </>
  );
}

/* ── Join step B: 选自己的角色（孩子叫你什么）── */
function JoinRoleStep({ value, onChange, onEnter, loading }) {
  const { theme } = useTheme();
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink }}>孩子叫你什么？</Text>
        <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 28, color: theme.inkSoft }}>
          这个是你自己的角色，选一次就好。
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
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 19, color: on ? '#FFFDF7' : theme.ink }}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <CTA label={loading ? '加入中...' : (value ? `我是${value}，加入` : '选一个')} onPress={onEnter} disabled={!value || loading} />
    </>
  );
}

/* ── Main Onboarding Screen ── */

export default function OnboardingScreen({ navigation }) {
  const { addKid, createFamily, joinFamily } = useData();
  const { theme } = useTheme();

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
      await persistMe({ role: me, custom: '' });
      await addKid({ name: child.name.trim(), y: child.y, m: child.m, tone: 'orange' });
      navigation.replace('Home');
    } catch (e: any) {
      console.error('Onboarding create error:', e);
      Alert.alert('保存失败', '请检查网络后重试');
      setSaving(false);
    }
  };

  // 加入路径：redeem → 镜像角色 → 进首页
  const doJoin = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await joinFamily(code.trim(), me, '');
      await persistMe({ role: me, custom: '' });
      navigation.replace('Home');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('invalid_code')) {
        setJoinStep('code');
        Alert.alert('加入失败', '邀请码不对，请再确认一下');
      } else {
        const hint = msg.includes('already_in_family') ? '你已经在一个家里了' : '请检查网络后重试';
        Alert.alert('加入失败', hint);
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
