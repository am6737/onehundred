// screens/Settings.js — React Native implementation of the Settings screen.
// Faithfully converted from the web prototype at screens_settings.jsx.

import React, { useState, useCallback, useRef, useEffect, useMemo, useImperativeHandle } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  Modal, Pressable, TextInput, StyleSheet, Dimensions,
  Alert, ActivityIndicator, Image, Platform, ToastAndroid, Animated, Share,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import WheelPicker from '@quidone/react-native-wheel-picker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Network from 'expo-network';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DooPush } from 'doopush-react-native-sdk';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, COLORS } from '../theme/tokens';
import { useI18n, useT } from '../i18n';
import { ROLES, DEFAULT_ME, meName, meChar, roleLabel, NOW_YM, fetchNotificationPrefs, updateNotificationPrefs, fetchNotificationTemplates, sendTestNotification, fetchProfile } from '../data';
import { useData } from '../data/DataProvider';
import { signOut, isAnonymous, bindEmail, deleteAccount, getCurrentUserPhone, maskPhone, updatePhone, verifyPhoneChange, signInWithApple, bindApple, isAppleSignInAvailable, getLinkedProviders, unbindProvider } from '../lib/auth';
import { getInviteExpiryHours, setInviteExpiryHours, INVITE_EXPIRY_OPTIONS, DEFAULT_INVITE_EXPIRY } from '../lib/yaoji';
import { safeDooPushRegister } from '../lib/doopushRegister';
import { supabase } from '../lib/supabase';
import { Icon, KidAvatar } from '../components/Icons';
import { LayerHeader, Sheet, Chip, PrimaryButton, SecondaryButton, Section } from '../components/common';
import { familyInviteUrl } from '../lib/invite';
import QRCode from 'react-native-qrcode-svg';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

function ageFrom(y: any, m: any) {
  return Math.max(0, NOW_YM.y - y - (NOW_YM.m < m ? 1 : 0));
}

/* ══════════════════════════════════════════════════════════
   Small components
   ══════════════════════════════════════════════════════════ */

// 所有设置行共用的最小行高。让单行行高不再依赖行内最高元素
// （图标 34 / 文字 / 原生 Switch 在 Android 上各不相同），保证 iOS / Android
// 上每一行高度一致。带副标题的行会自然超过此值。
const ROW_MIN_HEIGHT = 58;

// SettingGroup — a card-like group of setting rows
function SettingGroup({ label, note = null, children }: any) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={{
        paddingHorizontal: 6, paddingBottom: 10,
        fontFamily: theme.fonts.head, fontSize: 14,
        color: theme.inkSoft, letterSpacing: 0.5,
      }}>{label}</Text>
      <View style={{
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
        borderRadius: 22, overflow: 'hidden',
      }}>
        {children}
      </View>
      {note ? (
        <Text style={{
          paddingTop: 10, paddingHorizontal: 8,
          fontFamily: theme.fonts.body, fontSize: 12.5,
          lineHeight: 21, color: theme.inkSoft,
        }}>{note}</Text>
      ) : null}
    </View>
  );
}

// Row — a setting row with label, optional value, optional onPress with chevron
function Row({ icon = null, title, sub = null, value = null, onPress = null, last = false, children = null }: any) {
  const { theme } = useTheme();
  const tappable = !!onPress;

  const inner = (
    <View style={{
      width: '100%', flexDirection: 'row', alignItems: 'center',
      gap: 13, paddingVertical: 12, paddingHorizontal: 16,
      minHeight: ROW_MIN_HEIGHT,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.line,
    }}>
      {icon ? (
        <View style={{
          width: 34, height: 34, borderRadius: 12,
          backgroundColor: theme.sand,
          justifyContent: 'center', alignItems: 'center',
        }}>{typeof icon === 'function' ? icon : icon}</View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink,
          includeFontPadding: false,
        }}>{title}</Text>
        {sub ? (
          <Text style={{
            marginTop: 2, fontFamily: theme.fonts.body,
            fontSize: 12.5, color: theme.inkSoft, lineHeight: 19,
            includeFontPadding: false,
          }}>{sub}</Text>
        ) : null}
      </View>
      {children}
      {value != null ? (
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft,
          includeFontPadding: false,
        }}>{value}</Text>
      ) : null}
      {tappable ? Icon.chevR(theme.inkSoft, 18) : null}
    </View>
  );

  if (!tappable) return <View>{inner}</View>;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">{inner}</TouchableOpacity>;
}

// Toggle — a row with a Switch toggle
function ToggleRow({ icon, title, sub, value, onValueChange, last }: any) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      gap: 13, paddingVertical: 12, paddingHorizontal: 16,
      minHeight: ROW_MIN_HEIGHT,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.line,
    }}>
      {icon ? (
        <View style={{
          width: 34, height: 34, borderRadius: 12,
          backgroundColor: theme.sand,
          justifyContent: 'center', alignItems: 'center',
        }}>{icon}</View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink,
          includeFontPadding: false,
        }}>{title}</Text>
        {sub ? (
          <Text style={{
            marginTop: 2, fontFamily: theme.fonts.body,
            fontSize: 12.5, color: theme.inkSoft, lineHeight: 19,
            includeFontPadding: false,
          }}>{sub}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.line, true: theme.accent }}
        thumbColor="#FFFDF7"
      />
    </View>
  );
}

// Seg — segmented control (row of buttons acting as radio)
function Seg({ options, value, onChange }: any) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', gap: 4, padding: 4,
      backgroundColor: theme.sand, borderRadius: 999,
    }}>
      {options.map(o => {
        const on = value === o;
        return (
          <TouchableOpacity
            key={o}
            onPress={() => onChange(o)}
            activeOpacity={0.7}
            style={{
              paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999,
              backgroundColor: on ? theme.paper : 'transparent',
              ...(on ? {
                shadowColor: theme.shadow, shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
              } : {}),
            }}
          >
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 13.5,
              color: on ? theme.ink : theme.inkSoft,
            }}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Stepper — round step control: < value >
function Stepper({ value, min, max, onChange, fmt = (v: any) => String(v), wrap = false }: any) {
  const { theme } = useTheme();
  const step = (d) => {
    let v = value + d;
    if (wrap) { if (v < min) v = max; if (v > max) v = min; }
    else v = Math.min(max, Math.max(min, v));
    onChange(v);
  };
  const StepBtn = ({ d, dis }: any) => (
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
      <StepBtn d={-1} dis={!wrap && value <= min} />
      <Text style={{
        minWidth: 64, textAlign: 'center',
        fontFamily: theme.fonts.head, fontSize: 21, color: theme.ink,
      }}>{fmt(value)}</Text>
      <StepBtn d={1} dis={!wrap && value >= max} />
    </View>
  );
}

// RoleAvatar — small role avatar
function RoleAvatar({ ch, size = 48, on }: any) {
  const { theme } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: 16,
      backgroundColor: on ? theme.accent : theme.sand,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{
        fontFamily: theme.fonts.head, fontSize: size * 0.42,
        color: on ? '#FFFDF7' : theme.ink,
      }}>{ch}</Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   IdentityRow — shows current identity with floating picker
   ══════════════════════════════════════════════════════════ */

function IdentityRow({ me, options, onSelect, divider = false }: any) {
  const { theme } = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const [pos, setPos] = useState({ top: 0, right: 20 });

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    const node = triggerRef.current;
    if (node) {
      node.measure((_x, _y, w, h, pageX, pageY) => {
        setPos({ top: pageY + h + 6, right: Math.max(16, SCREEN_W - pageX - w + 16) });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };

  return (
    <View>
      <TouchableOpacity
        ref={triggerRef}
        onPress={handleOpen}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row', alignItems: 'center',
          gap: 13, paddingVertical: 12, paddingHorizontal: 16,
          minHeight: ROW_MIN_HEIGHT,
          borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.line,
        }}
      >
        <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink, includeFontPadding: false }}>
          {t('settings.iAm')}
        </Text>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 14.5,
          color: open ? theme.accent : theme.inkSoft, includeFontPadding: false,
        }}>{meName(me)}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          {Icon.chevDown(open ? theme.accent : theme.inkSoft, 18)}
        </View>
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ position: 'absolute', top: pos.top, right: pos.right }}
          >
            <View style={{
              minWidth: 120, backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              borderRadius: 12, padding: 4,
            }}>
              {options.map(o => {
                const on = me.role === o;
                return (
                  <TouchableOpacity
                    key={o}
                    onPress={() => { onSelect(o); setOpen(false); }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      gap: 8, paddingVertical: 8, paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: on ? theme.sand : 'transparent',
                    }}
                  >
                    <Text style={{
                      flex: 1, fontFamily: theme.fonts.body, fontSize: 14.5,
                      color: on ? theme.accent : theme.ink, includeFontPadding: false,
                    }}>{roleLabel(o)}</Text>
                    {on ? Icon.check(theme.accent, 14) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   SelectRow — row with dropdown picker
   ══════════════════════════════════════════════════════════ */

function SelectRow({ icon = null, title, sub = null, options, value, onSelect, last = false }: any) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const [pos, setPos] = useState({ top: 0, right: 20 });
  const norm = (o) => (typeof o === 'string' ? { key: o, label: o } : o);
  const current = options.map(norm).find(o => o.key === value);
  const valueLabel = current ? current.label : value;

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    const node = triggerRef.current;
    if (node) {
      node.measure((_x, _y, w, h, pageX, pageY) => {
        setPos({ top: pageY + h + 6, right: Math.max(16, SCREEN_W - pageX - w + 16) });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };

  return (
    <View>
      <TouchableOpacity
        ref={triggerRef}
        onPress={handleOpen}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row', alignItems: 'center',
          gap: 13, paddingVertical: 12, paddingHorizontal: 16,
          minHeight: ROW_MIN_HEIGHT,
          borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.line,
        }}
      >
        {icon ? (
          <View style={{
            width: 34, height: 34, borderRadius: 12,
            backgroundColor: theme.sand,
            justifyContent: 'center', alignItems: 'center',
          }}>{icon}</View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink, includeFontPadding: false }}>{title}</Text>
          {sub ? (
            <Text style={{ marginTop: 2, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, lineHeight: 19, includeFontPadding: false }}>{sub}</Text>
          ) : null}
        </View>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 14,
          color: open ? theme.accent : theme.inkSoft, includeFontPadding: false,
        }}>{valueLabel}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          {Icon.chevDown(open ? theme.accent : theme.inkSoft, 18)}
        </View>
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ position: 'absolute', top: pos.top, right: pos.right }}
          >
            <View style={{
              minWidth: 120, backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              borderRadius: 12, padding: 4,
            }}>
              {options.map(norm).map(o => {
                const on = value === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    onPress={() => { onSelect(o.key); setOpen(false); }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      gap: 8, paddingVertical: 8, paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: on ? theme.sand : 'transparent',
                    }}
                  >
                    <Text style={{
                      flex: 1, fontFamily: theme.fonts.body, fontSize: 14.5,
                      color: on ? theme.accent : theme.ink, includeFontPadding: false,
                    }}>{o.label}</Text>
                    {on ? Icon.check(theme.accent, 14) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   ChildProfileSheet
   ══════════════════════════════════════════════════════════ */

function ChildProfileSheet({ kid, onChange, onClose }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(kid.name);
  const [y, setY] = useState(kid.y);
  const [m, setM] = useState(kid.m);
  const age = ageFrom(y, m);
  const toEighteen = Math.max(0, y + 18 - NOW_YM.y);
  const trimmed = name.trim();
  const canSave = trimmed.length > 0;
  const save = () => { if (canSave) { onChange({ name: trimmed, y, m }); onClose(); } };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={t('settings.kidProfileTitle', { name: kid.name })}
          onBack={onClose}
          right={
            <TouchableOpacity onPress={save} activeOpacity={0.7} style={{
              paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
              backgroundColor: theme.accent,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: '#FFFDF7' }}>{t('settings.recordIt')}</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          {/* Avatar + name */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <KidAvatar name={trimmed || kid.name} tone={kid.tone} size={84} />
            <TextInput
              value={name}
              onChangeText={v => setName(v.slice(0, 8))}
              placeholder={t('onboarding.childNamePlaceholder')}
              placeholderTextColor={theme.inkSoft}
              style={{
                marginTop: 8, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
                textAlign: 'center', paddingVertical: 4, paddingHorizontal: 12,
                borderBottomWidth: 1.5, borderBottomColor: theme.line, minWidth: 120,
              }}
            />
          </View>

          {/* Birthday steppers */}
          <View style={{
            marginTop: 14, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, borderRadius: 22, overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
              borderBottomWidth: 1, borderBottomColor: theme.line,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink, includeFontPadding: false }}>{t('onboarding.birthYear')}</Text>
              <Stepper value={y} min={2008} max={NOW_YM.y} onChange={setY} fmt={v => t('onboarding.yearFmt', { v })} />
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink, includeFontPadding: false }}>{t('onboarding.birthMonth')}</Text>
              <Stepper value={m} min={1} max={12} wrap onChange={setM} fmt={v => t('onboarding.monthFmt', { v })} />
            </View>
          </View>

          {/* Age summary */}
          <View style={{
            marginTop: 18, paddingVertical: 20, paddingHorizontal: 18,
            borderRadius: 22, backgroundColor: theme.sand, alignItems: 'center',
          }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 24, color: theme.ink }}>
              {t('settings.ageNow', { age })}
            </Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13.5,
              lineHeight: 23, color: theme.inkSoft, textAlign: 'center',
            }}>
              {t('settings.toEighteen', { years: toEighteen })}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   AddChildSheet
   ══════════════════════════════════════════════════════════ */

function AddChildSheet({ onAdd, onClose }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [y, setY] = useState(2024);
  const [m, setM] = useState(1);
  const [tone, setTone] = useState('pink');
  const age = ageFrom(y, m);
  const canSave = name.trim().length > 0;
  const save = () => { if (!canSave) return; onAdd({ name: name.trim(), y, m, tone }); onClose(); };

  const tones = [['orange', t('settings.toneOrange')], ['green', t('settings.toneGreen')], ['pink', t('settings.tonePink')]];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={t('settings.addChild')}
          onBack={onClose}
          right={
            <TouchableOpacity
              onPress={save}
              disabled={!canSave}
              activeOpacity={0.7}
              style={{
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                backgroundColor: canSave ? theme.accent : theme.sand,
              }}
            >
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 14,
                color: canSave ? '#FFFDF7' : theme.inkSoft,
              }}>{t('settings.recordIt')}</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          {/* Preview avatar */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <KidAvatar name={name} tone={tone} size={84} />
          </View>

          {/* Name input */}
          <View style={{ marginTop: 22 }}>
            <Text style={{
              paddingHorizontal: 4, paddingBottom: 8,
              fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
            }}>{t('settings.kidNameLabel')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.childNamePlaceholder')}
              placeholderTextColor={theme.inkSoft}
              maxLength={8}
              autoFocus
              style={{
                width: '100%', borderWidth: 1, borderColor: theme.line,
                borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
                backgroundColor: theme.paper, color: theme.ink,
                fontFamily: theme.fonts.body, fontSize: 16,
              }}
            />
          </View>

          {/* Birthday steppers */}
          <View style={{
            marginTop: 18, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, borderRadius: 22, overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
              borderBottomWidth: 1, borderBottomColor: theme.line,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink, includeFontPadding: false }}>{t('onboarding.birthYear')}</Text>
              <Stepper value={y} min={2008} max={NOW_YM.y} onChange={setY} fmt={v => t('onboarding.yearFmt', { v })} />
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink, includeFontPadding: false }}>{t('onboarding.birthMonth')}</Text>
              <Stepper value={m} min={1} max={12} wrap onChange={setM} fmt={v => t('onboarding.monthFmt', { v })} />
            </View>
          </View>

          {/* Tone picker */}
          <View style={{ marginTop: 18 }}>
            <Text style={{
              paddingHorizontal: 4, paddingBottom: 10,
              fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
            }}>{t('settings.pickColor')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {tones.map(([key, label]) => {
                const c = COLORS[key];
                const on = tone === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setTone(key)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1, alignItems: 'center', gap: 7, paddingVertical: 14,
                      borderRadius: 18, backgroundColor: theme.paper,
                      borderWidth: 1.5, borderColor: on ? c : theme.line,
                    }}
                  >
                    <View style={{
                      width: 26, height: 26, borderRadius: 999,
                      backgroundColor: c,
                    }} />
                    <Text style={{
                      fontFamily: theme.fonts.body, fontSize: 13,
                      color: on ? theme.ink : theme.inkSoft,
                    }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Age preview */}
          <View style={{
            marginTop: 20, padding: 18, borderRadius: 22,
            backgroundColor: theme.sand, alignItems: 'center',
          }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink }}>
              {canSave ? t('onboarding.ageRecapNamed', { name: name.trim(), age }) : t('onboarding.ageRecap', { age })}
            </Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13,
              lineHeight: 23, color: theme.inkSoft,
            }}>{t('settings.addChildHint')}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   InviteSheet — family members + invite code
   ══════════════════════════════════════════════════════════ */

function ParentAvatar({ ch }: any) {
  const { theme } = useTheme();
  return (
    <View style={{
      width: 34, height: 34, borderRadius: 12,
      backgroundColor: theme.sand,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink }}>{ch}</Text>
    </View>
  );
}

function MemberRow({ avatar, name, role, last = false }: any) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 13,
      paddingVertical: 14, paddingHorizontal: 16,
      minHeight: ROW_MIN_HEIGHT,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.line,
    }}>
      {avatar}
      <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink, includeFontPadding: false }}>{name}</Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>{role}</Text>
    </View>
  );
}

function InviteSheet({ kids, me, onClose, onJoinFamily }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const { family } = useData();
  const code = family?.inviteCode || '——';

  const myName = meName(me);
  const myChar = meChar(me);
  const isParent = me.role === '爸爸' || me.role === '妈妈';
  const adults = (family?.members || []).map(m => {
    const nm = m.role === '其他' ? (m.customRole || t('role.familyMember')) : roleLabel(m.role);
    return {
      ch: nm.slice(0, 1),
      name: nm,
      role: m.isMe ? t('settings.you') + (family?.isCreator ? t('settings.admin') : '') : t('settings.parentRole'),
    };
  });
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const shareLink = async () => {
    if (code === '——') return;
    try {
      await Share.share({ message: t('invite.shareMessage', { code, url: familyInviteUrl(code) }) });
    } catch {}
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('settings.familyMembers')} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          {/* Members list */}
          <View style={{
            marginTop: 18, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, borderRadius: 22, overflow: 'hidden',
          }}>
            {adults.map((a, i) => (
              <MemberRow key={a.name + i} avatar={<ParentAvatar ch={a.ch} />} name={a.name} role={a.role} />
            ))}
            {kids.map((k, i) => (
              <MemberRow
                key={k.id}
                avatar={<KidAvatar name={k.name} tone={k.tone} size={34} />}
                name={k.name} role={t('settings.childRole')} last={i === kids.length - 1}
              />
            ))}
          </View>

          {/* Invite section */}
          <View style={{
            marginTop: 24, padding: 22, borderRadius: 24,
            backgroundColor: theme.paper,
            borderWidth: 1.5, borderColor: theme.line,
            borderStyle: 'dashed',
            alignItems: 'center',
          }}>
            {Icon.users(theme.accent, 26)}
            <Text style={{
              marginTop: 10, fontFamily: theme.fonts.head, fontSize: 18, color: theme.ink,
            }}>{t('settings.inviteTitle')}</Text>
            <Text style={{
              marginTop: 8, fontFamily: theme.fonts.body, fontSize: 13.5,
              lineHeight: 23, color: theme.inkSoft, textAlign: 'center',
            }}>
              {t('settings.inviteDesc')}
            </Text>

            {/* 二维码：让家人打开 App 扫一扫即可加入 */}
            {code !== '——' ? (
              <View style={{ marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' }}>
                <QRCode value={familyInviteUrl(code)} size={180} backgroundColor="#FFFFFF" color="#2A2723" />
              </View>
            ) : null}

            <Text style={{
              marginTop: 18, fontFamily: theme.fonts.body, fontSize: 12.5,
              color: theme.inkSoft, textAlign: 'center',
            }}>{t('invite.orManualCode')}</Text>
            <View style={{
              marginTop: 8, padding: 14, borderRadius: 16,
              backgroundColor: theme.sand, width: '100%', alignItems: 'center',
            }}>
              <Text style={{
                fontFamily: 'monospace', fontSize: 20, letterSpacing: 3, color: theme.ink,
              }}>{code}</Text>
            </View>
            <TouchableOpacity
              onPress={copy}
              activeOpacity={0.7}
              style={{
                marginTop: 14, width: '100%', minHeight: 52, paddingVertical: 14, borderRadius: 999,
                backgroundColor: copied ? theme.sand : theme.accent,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {copied ? (
                <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                  {Icon.check(theme.accent, 18)}
                </View>
              ) : null}
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 16,
                color: copied ? theme.accent : '#FFFDF7',
              }}>{copied ? t('settings.codeCopied') : t('settings.copyCode')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={shareLink}
              activeOpacity={0.7}
              style={{
                marginTop: 10, width: '100%', minHeight: 52, paddingVertical: 14, borderRadius: 999,
                borderWidth: 1.5, borderColor: theme.line,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {Icon.share(theme.accent, 18)}
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink }}>
                {t('invite.shareLink')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Join another family — for solo users */}
          {adults.length <= 1 && onJoinFamily && (
            <View style={{ marginTop: 22 }}>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink, textAlign: 'center',
              }}>{t('invite.haveCode')}</Text>
              <Text style={{
                marginTop: 4, fontFamily: theme.fonts.body, fontSize: 12.5,
                color: theme.inkSoft, textAlign: 'center',
              }}>{t('invite.haveCodeDesc')}</Text>
              <TouchableOpacity
                onPress={() => onJoinFamily(true)}
                activeOpacity={0.85}
                style={{
                  marginTop: 14, paddingVertical: 15, borderRadius: 999,
                  backgroundColor: theme.accent,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {Icon.camera('#FFFDF7', 18)}
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7' }}>
                  {t('invite.scanToJoin')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onJoinFamily(false)}
                activeOpacity={0.7}
                style={{
                  marginTop: 10, paddingVertical: 15, borderRadius: 999,
                  borderWidth: 1.5, borderColor: theme.line,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink }}>
                  {t('invite.enterCodeToJoin')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}


/* ══════════════════════════════════════════════════════════
   DocSheet — terms / privacy policy
   ══════════════════════════════════════════════════════════ */

const APP_VERSION = '1.0.0';
const APP_BUILD = '1';
const APP_EMAIL = 'hi@yibaijianshi.app';

function DocSheet({ kind, onClose }: any) {
  const { theme } = useTheme();
  const { t, tRaw } = useI18n();
  const insets = useSafeAreaInsets();
  const title = kind === 'terms' ? t('settings.docTermsTitle') : t('settings.docPrivacyTitle');
  const body = (tRaw(kind === 'terms' ? 'settings.terms' : 'settings.privacy') || [])
    .map(([h, p]) => [h, p.replace('{{email}}', APP_EMAIL)]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={title} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, letterSpacing: 0.3,
          }}>{t('settings.docUpdatedLine', { date: t('settings.docUpdated') })}</Text>
          {body.map(([h, p], i) => (
            <View key={i} style={{ marginTop: 22 }}>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 16.5, color: theme.ink,
              }}>{h}</Text>
              <Text style={{
                marginTop: 9, fontFamily: theme.fonts.body, fontSize: 14,
                lineHeight: 27, color: theme.inkSoft,
              }}>{p}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   AboutSheet
   ══════════════════════════════════════════════════════════ */

function AboutSheet({ onClose }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const checkUpdate = () => {
    if (checking) return;
    setChecking(true);
    setTimeout(() => setChecking(false), 1100);
  };
  const contact = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1900);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('settings.about')} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          {/* App icon */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <Image
              source={require('../../assets/icon.png')}
              style={{
                width: 84, height: 84, borderRadius: 24,
                shadowColor: theme.accentShadow, shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.4, shadowRadius: 30,
              }}
            />
            <Text style={{
              marginTop: 15, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
            }}>{t('settings.appName')}</Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.inkSoft,
            }}>{t('settings.versionBuild', { version: APP_VERSION, build: APP_BUILD })}</Text>
          </View>

          {/* Tagline */}
          <Text style={{
            marginTop: 18, textAlign: 'center',
            fontFamily: theme.fonts.hand, fontSize: 18,
            lineHeight: 35, color: theme.inkSoft,
          }}>
            {t('settings.aboutTagline')}
          </Text>

          {/* Action rows */}
          <View style={{
            marginTop: 24, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, borderRadius: 22, overflow: 'hidden',
          }}>
            <Row
              icon={Icon.download(theme.accent, 19)}
              title={t('settings.checkUpdate')}
              value={checking ? t('settings.checking') : t('settings.upToDate')}
              onPress={checkUpdate}
            />
            <Row
              icon={Icon.book(theme.accent, 19)}
              title={t('settings.docTermsTitle')}
              onPress={() => setDoc('terms')}
            />
            <Row
              icon={Icon.eye(theme.accent, 19)}
              title={t('settings.docPrivacyTitle')}
              onPress={() => setDoc('privacy')}
            />
            <Row
              icon={Icon.users(theme.accent, 19)}
              title={t('settings.contactUs')}
              sub={APP_EMAIL}
              value={copied ? t('settings.copied') : t('settings.copy')}
              onPress={contact}
              last
            />
          </View>

          {/* Footer */}
          <Text style={{
            textAlign: 'center', marginTop: 26,
            fontFamily: theme.fonts.body, fontSize: 12,
            color: theme.inkSoft, opacity: 0.85, lineHeight: 22,
          }}>
            {t('settings.aboutFooter', { name: t('settings.appName') })}
          </Text>
        </ScrollView>
      </View>

      {doc ? <DocSheet kind={doc} onClose={() => setDoc(null)} /> : null}
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   ChangePhoneSheet
   ══════════════════════════════════════════════════════════ */

function ChangePhoneSheet({ anon, currentPhone, onChanged, onClose }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<any>(null);

  const validPhone = phone.replace(/\D/g, '').length === 11;
  const canSend = validPhone && countdown === 0 && !loading;
  const canSave = validPhone && code.trim().length === 6 && !loading;

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    if (!canSend) return;
    setLoading(true);
    try {
      await updatePhone(phone);
      startCountdown();
      Alert.alert(t('settings.codeSentTitle'), t('settings.codeSentBody'));
    } catch (e: any) {
      Alert.alert(t('settings.phoneChangeFailTitle'), e?.message || t('settings.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setLoading(true);
    try {
      await verifyPhoneChange(phone, code.trim());
      const updated = await getCurrentUserPhone();
      onChanged?.(updated);
      Alert.alert(t('settings.phoneChangeSuccessTitle'), t('settings.phoneChangeSuccessBody'));
      onClose();
    } catch (e: any) {
      Alert.alert(t('settings.phoneChangeFailTitle'), e?.message || t('settings.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={anon ? t('settings.bindPhone') : t('settings.changePhone')}
          onBack={onClose}
          right={
            <TouchableOpacity
              onPress={canSave ? save : undefined}
              disabled={!canSave}
              activeOpacity={0.7}
              style={{
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                backgroundColor: canSave ? theme.accent : theme.sand,
              }}
            >
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 14,
                color: canSave ? '#FFFDF7' : theme.inkSoft,
              }}>{t('settings.changed')}</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {t('settings.changePhoneDesc')}
          </Text>

          {/* Current number */}
          {!anon ? (
            <View style={{
              marginTop: 22, flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 15, paddingHorizontal: 18,
              backgroundColor: theme.sand, borderRadius: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.inkSoft }}>{t('settings.currentNumber')}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.ink }}>{maskPhone(currentPhone)}</Text>
            </View>
          ) : null}

          {/* New phone */}
          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>{t('settings.newPhone')}</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t('settings.newPhonePlaceholder')}
            placeholderTextColor={theme.inkSoft}
            keyboardType="phone-pad"
            maxLength={11}
            style={{
              width: '100%', borderWidth: 1, borderColor: theme.line,
              borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
              backgroundColor: theme.paper, color: theme.ink,
              fontFamily: theme.fonts.body, fontSize: 16,
            }}
          />

          {/* Verification code */}
          <Text style={{
            marginTop: 20, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>{t('settings.verifyCode')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={t('settings.codePlaceholder6')}
              placeholderTextColor={theme.inkSoft}
              keyboardType="number-pad"
              maxLength={6}
              style={{
                flex: 1, borderWidth: 1, borderColor: theme.line,
                borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
                backgroundColor: theme.paper, color: theme.ink,
                fontFamily: theme.fonts.body, fontSize: 16,
              }}
            />
            <TouchableOpacity
              onPress={sendCode}
              disabled={!canSend}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 18, borderRadius: 18,
                backgroundColor: theme.sand,
                justifyContent: 'center', alignItems: 'center',
                opacity: canSend ? 1 : 0.5,
              }}
            >
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 14, color: theme.ink,
              }}>{loading ? '...' : countdown > 0 ? `${countdown}s` : t('settings.getCode')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   ConfirmDialog — reusable centered confirmation dialog
   ══════════════════════════════════════════════════════════ */

function ConfirmDialog({ visible, icon, title, message, confirmLabel, confirmColor, onConfirm, cancelLabel, onCancel }: any) {
  const { theme } = useTheme();
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}>
        <View style={{
          width: SCREEN_W - 56, backgroundColor: theme.paper,
          borderRadius: 26, paddingTop: 30, paddingBottom: 24,
          paddingHorizontal: 24, alignItems: 'center',
          shadowColor: theme.shadow, shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.2, shadowRadius: 40, elevation: 12,
        }}>
          {/* Icon */}
          <View style={{
            width: 56, height: 56, borderRadius: 18,
            backgroundColor: theme.sand,
            justifyContent: 'center', alignItems: 'center',
          }}>
            {icon}
          </View>

          {/* Title */}
          <Text style={{
            marginTop: 18, fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink,
          }}>{title}</Text>

          {/* Message */}
          <Text style={{
            marginTop: 10, fontFamily: theme.fonts.body, fontSize: 14,
            lineHeight: 24, color: theme.inkSoft, textAlign: 'center',
          }}>{message}</Text>

          {/* Confirm button */}
          <TouchableOpacity
            onPress={onConfirm}
            activeOpacity={0.7}
            style={{
              marginTop: 22, width: '100%', paddingVertical: 16, borderRadius: 999,
              backgroundColor: confirmColor || theme.accent,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7',
            }}>{confirmLabel}</Text>
          </TouchableOpacity>

          {/* Cancel button */}
          <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={{ marginTop: 14 }}>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 15, color: theme.inkSoft,
            }}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   DeleteAccountSheet
   ══════════════════════════════════════════════════════════ */

function DeleteAccountSheet({ onClose }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const CONFIRM_TEXT = t('settings.deleteConfirmText');
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canDelete = input.trim() === CONFIRM_TEXT && checked && !deleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await deleteAccount();
      // 成功后会触发 SIGNED_OUT，App 根导航会重置回登录页，
      // 本组件随 Settings 一起卸载，这里不用再做收尾。
    } catch (e) {
      console.error('Delete account failed:', e);
      setDeleting(false);
      Alert.alert(t('settings.deleteFailTitle'), t('settings.deleteFailBody'));
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('settings.deleteAccount')} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          {/* Warning card */}
          <View style={{
            marginTop: 16, padding: 20, borderRadius: 22,
            backgroundColor: theme.isDark ? 'rgba(192,97,107,0.12)' : '#FDF5F5',
            borderWidth: 1.5, borderColor: theme.isDark ? 'rgba(192,97,107,0.25)' : '#F0D6D6',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 34, height: 34, borderRadius: 12,
                backgroundColor: theme.isDark ? 'rgba(192,97,107,0.2)' : '#F0D6D6',
                justifyContent: 'center', alignItems: 'center',
              }}>
                {Icon.lock('#C0616B', 18)}
              </View>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 17, color: '#C0616B',
              }}>{t('settings.irreversible')}</Text>
            </View>
            <Text style={{
              marginTop: 14, fontFamily: theme.fonts.body, fontSize: 14.5,
              lineHeight: 26, color: theme.ink,
            }}>
              {t('settings.deleteWarning')}
            </Text>
          </View>

          {/* Confirmation input */}
          <View style={{ marginTop: 24 }}>
            <Text style={{
              paddingHorizontal: 4, paddingBottom: 10,
              fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.inkSoft,
            }}>
              {t('settings.deletePromptPre')}<Text style={{ fontFamily: theme.fonts.head, color: '#C0616B' }}>"{CONFIRM_TEXT}"</Text>{t('settings.deletePromptPost')}
            </Text>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={CONFIRM_TEXT}
              placeholderTextColor={theme.inkSoft}
              style={{
                width: '100%', borderWidth: 1, borderColor: theme.line,
                borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
                backgroundColor: theme.paper, color: theme.ink,
                fontFamily: theme.fonts.body, fontSize: 16,
              }}
            />
          </View>

          {/* Checkbox */}
          <TouchableOpacity
            onPress={() => setChecked(!checked)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: 12,
              marginTop: 22, paddingHorizontal: 4,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, marginTop: 1,
              borderWidth: 2, borderColor: checked ? theme.accent : theme.line,
              backgroundColor: checked ? theme.accent : 'transparent',
              justifyContent: 'center', alignItems: 'center',
            }}>
              {checked ? Icon.check('#FFFDF7', 14) : null}
            </View>
            <Text style={{
              flex: 1, fontFamily: theme.fonts.body, fontSize: 14,
              lineHeight: 23, color: theme.ink,
            }}>{t('settings.deleteCheck')}</Text>
          </TouchableOpacity>

          {/* Button */}
          <TouchableOpacity
            onPress={handleDelete}
            disabled={!canDelete}
            activeOpacity={0.7}
            style={{
              marginTop: 32, width: '100%', paddingVertical: 16, borderRadius: 999,
              backgroundColor: canDelete ? '#C0616B' : theme.sand,
              alignItems: 'center',
            }}
          >
            {deleting ? (
              <ActivityIndicator color="#FFFDF7" size="small" />
            ) : (
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 16,
                color: canDelete ? '#FFFDF7' : theme.inkSoft,
              }}>{t('settings.deletePermanent')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   BindEmailSheet
   ══════════════════════════════════════════════════════════ */

function BindEmailSheet({ onBound, onClose }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSave = email.includes('@') && password.length >= 6 && !loading;

  const handleBind = async () => {
    if (!canSave) return;
    setLoading(true);
    try {
      await bindEmail(email, password);
      onBound();
      onClose();
    } catch (e: any) {
      Alert.alert(t('settings.bindFailTitle'), e.message || t('settings.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={t('settings.bindEmail')}
          onBack={onClose}
          right={
            <TouchableOpacity
              onPress={handleBind}
              disabled={!canSave}
              activeOpacity={0.7}
              style={{
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                backgroundColor: canSave ? theme.accent : theme.sand,
              }}
            >
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 14,
                color: canSave ? '#FFFDF7' : theme.inkSoft,
              }}>{loading ? t('settings.binding') : t('settings.bind')}</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {t('settings.bindEmailDesc')}
          </Text>

          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>{t('settings.email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('emailLogin.emailPlaceholder')}
            placeholderTextColor={theme.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              width: '100%', borderWidth: 1, borderColor: theme.line,
              borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
              backgroundColor: theme.paper, color: theme.ink,
              fontFamily: theme.fonts.body, fontSize: 16,
            }}
          />

          <Text style={{
            marginTop: 20, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>{t('settings.password')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('settings.passwordPlaceholderSet')}
            placeholderTextColor={theme.inkSoft}
            secureTextEntry
            style={{
              width: '100%', borderWidth: 1, borderColor: theme.line,
              borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
              backgroundColor: theme.paper, color: theme.ink,
              fontFamily: theme.fonts.body, fontSize: 16,
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   AccountSecuritySheet
   ══════════════════════════════════════════════════════════ */

function AccountSecuritySheet({ anon, onAnonChanged, onClose }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [subSheet, setSubSheet] = useState<string | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [showUnbind, setShowUnbind] = useState<string | null>(null); // 'apple' | 'wechat'
  const [uid, setUid] = useState('');
  const [uidCopied, setUidCopied] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);
  const [currentPhone, setCurrentPhone] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [appleAvail, setAppleAvail] = useState(false);

  const refreshProviders = useCallback(() => {
    getLinkedProviders().then(setProviders);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUid(data.user.id.slice(0, 8));
      setCurrentPhone(data?.user?.phone || '');
    });
    fetchProfile().then(p => { if (p?.generated_email) setGeneratedEmail(p.generated_email); });
    refreshProviders();
    isAppleSignInAvailable().then(setAppleAvail);
  }, []);

  const wechatBound = providers.includes('wechat');
  const appleBound = providers.includes('apple');

  const handleBindApple = async () => {
    try {
      await bindApple();
      refreshProviders();
      onAnonChanged?.();
      Alert.alert(t('settings.bindSuccess'), t('settings.bindSuccessMsg'));
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('settings.bindFail'), e?.message || t('settings.tryAgain'));
      }
    }
  };

  const handleUnbind = async (provider: string) => {
    setShowUnbind(null);
    try {
      await unbindProvider(provider);
      refreshProviders();
    } catch (e: any) {
      Alert.alert(t('settings.unbindFail'), e?.message || t('settings.tryAgain'));
    }
  };

  const copyUid = async () => {
    if (!uid) return;
    await Clipboard.setStringAsync(uid);
    setUidCopied(true);
    setTimeout(() => setUidCopied(false), 1800);
  };

  const copyEmail = async () => {
    if (!generatedEmail) return;
    await Clipboard.setStringAsync(generatedEmail);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1800);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('settings.accountSecurity')} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          {uid ? (
            <SettingGroup label={t('settings.userId')}>
              <Row
                icon={Icon.shieldCheck(theme.accent, 19)}
                title={uid}
                value={uidCopied ? t('settings.userIdCopied') : t('settings.copyId')}
                onPress={copyUid}
                last
              />
            </SettingGroup>
          ) : null}

          {generatedEmail ? (
            <SettingGroup label={t('settings.email')}>
              <Row
                icon={Icon.mail(theme.accent, 19)}
                title={generatedEmail}
                value={emailCopied ? t('settings.userIdCopied') : t('settings.copyId')}
                onPress={copyEmail}
                last
              />
            </SettingGroup>
          ) : null}

          {/* Login methods */}
          <SettingGroup label={t('settings.loginMethods')}>
            <Row
              icon={Icon.phone(theme.accent, 19)}
              title={t('settings.phone')}
              value={currentPhone ? maskPhone(currentPhone) : t('settings.notBound')}
              onPress={() => setSubSheet('changePhone')}
            />
            <Row
              icon={Icon.users(theme.accent, 19)}
              title={t('settings.wechat')}
              value={wechatBound ? t('settings.bound') : t('settings.notBound')}
              onPress={() => wechatBound ? setShowUnbind('wechat') : setShowUnbind('wechat')}
            />
            {appleAvail ? (
              <Row
                icon={Icon.apple(theme.accent, 19)}
                title={t('settings.apple')}
                value={appleBound ? t('settings.bound') : t('settings.notBound')}
                onPress={() => appleBound ? setShowUnbind('apple') : handleBindApple()}
                last={anon ? false : true}
              />
            ) : null}
            {anon ? (
              <Row
                icon={Icon.mail(theme.accent, 19)}
                title={t('settings.email')}
                value={t('settings.notBound')}
                onPress={() => setSubSheet('bindEmail')}
                last
              />
            ) : null}
          </SettingGroup>

          {/* Login status */}
          <SettingGroup label={t('settings.loginStatus')} note={t('settings.loginStatusNote')}>
            <Row
              icon={Icon.logout(theme.accent, 19)}
              title={t('settings.logout')}
              onPress={() => setShowLogout(true)}
              last
            />
          </SettingGroup>

          {/* Delete account */}
          <View style={{ marginTop: 26 }}>
            <View style={{
              backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              borderRadius: 22, overflow: 'hidden',
            }}>
              <TouchableOpacity
                onPress={() => setSubSheet('deleteAccount')}
                activeOpacity={0.7}
                style={{
                  width: '100%', flexDirection: 'row', alignItems: 'center',
                  gap: 13, paddingVertical: 12, paddingHorizontal: 16,
                  minHeight: ROW_MIN_HEIGHT,
                }}
              >
                <View style={{
                  width: 34, height: 34, borderRadius: 12,
                  backgroundColor: theme.isDark ? 'rgba(192,97,107,0.2)' : '#F0D6D6',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {Icon.lock('#D2929A', 19)}
                </View>
                <Text style={{
                  flex: 1, fontFamily: theme.fonts.body, fontSize: 15.5, color: '#C0616B',
                  includeFontPadding: false,
                }}>{t('settings.deleteAccount')}</Text>
                {Icon.chevR(theme.inkSoft, 18)}
              </TouchableOpacity>
            </View>
            <Text style={{
              paddingTop: 10, paddingHorizontal: 8,
              fontFamily: theme.fonts.body, fontSize: 12.5,
              lineHeight: 21, color: theme.inkSoft,
            }}>{t('settings.deleteNote')}</Text>
          </View>
        </ScrollView>
      </View>

      {/* Sub-sheets & dialogs */}
      {subSheet === 'changePhone' ? (
        <ChangePhoneSheet anon={anon} currentPhone={currentPhone} onChanged={setCurrentPhone} onClose={() => setSubSheet(null)} />
      ) : null}
      {subSheet === 'deleteAccount' ? (
        <DeleteAccountSheet onClose={() => setSubSheet(null)} />
      ) : null}
      {subSheet === 'bindEmail' ? (
        <BindEmailSheet onBound={() => { refreshProviders(); onAnonChanged?.(); }} onClose={() => setSubSheet(null)} />
      ) : null}

      <ConfirmDialog
        visible={showUnbind === 'wechat'}
        icon={Icon.users(theme.accent, 26)}
        title={t('settings.unbindWechatTitle')}
        message={t('settings.unbindWechatMsg')}
        confirmLabel={t('settings.unbind')}
        confirmColor={theme.accent}
        onConfirm={() => handleUnbind('wechat')}
        cancelLabel={t('settings.notNow')}
        onCancel={() => setShowUnbind(null)}
      />

      <ConfirmDialog
        visible={showUnbind === 'apple'}
        icon={Icon.apple(theme.accent, 26)}
        title={t('settings.unbindAppleTitle')}
        message={t('settings.unbindAppleMsg')}
        confirmLabel={t('settings.unbind')}
        confirmColor={theme.accent}
        onConfirm={() => handleUnbind('apple')}
        cancelLabel={t('settings.notNow')}
        onCancel={() => setShowUnbind(null)}
      />

      <ConfirmDialog
        visible={showLogout}
        icon={Icon.logout(theme.accent, 26)}
        title={t('settings.logoutTitle')}
        message={t('settings.logoutMsg')}
        confirmLabel={t('settings.logout')}
        confirmColor={theme.accent}
        onConfirm={async () => {
          setShowLogout(false);
          await signOut();
        }}
        cancelLabel={t('settings.reconsider')}
        onCancel={() => setShowLogout(false)}
      />

    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   Developer Tools Sheet
   ══════════════════════════════════════════════════════════ */

const DEV_UNLOCK_KEY = '100m.dev_unlocked';
const DND_ITEM_H = 44;
const DND_VISIBLE = 5;
const DND_PAD = DND_ITEM_H * Math.floor(DND_VISIBLE / 2);
const DND_WHEEL_H = DND_ITEM_H * DND_VISIBLE;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function tickHaptic() {
  // 滚轮每跨过一格触发一次「选择」轻震；原生模块缺失时静默降级。
  try { Haptics.selectionAsync().catch(() => {}); } catch {}
}

const HOUR_DATA = HOURS.map(h => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }));

// 自定义 renderList：完全复刻 quidone 内部的 Animated.ScrollView（snapToOffsets + 原生驱动
// 的 scrollOffset + scrollToIndex），唯一区别是外面套了 RNGH 的 Gesture.Native()。
// 因为本弹窗是 Modal+GestureHandlerRootView，新架构下没登记进 RNGH 的普通 ScrollView 收不到
// 触摸（这也是 Sheet 必须走原生手势的原因），套上 Native 手势后滚轮才滚得动。
function WheelScrollList({
  listMethodsRef, data, keyExtractor, renderItem, itemHeight, pickerHeight,
  readOnly, scrollOffset, initialIndex, contentContainerStyle,
  onTouchStart, onTouchEnd, onTouchCancel, onScrollStart, onScrollEnd,
}: any) {
  const scrollRef = useRef<any>(null);
  const activeRef = useRef(false);
  const endTimer = useRef<any>(null);
  const native = useMemo(() => Gesture.Native(), []);

  useImperativeHandle(listMethodsRef, () => ({
    scrollToIndex: ({ index, animated }: any) =>
      scrollRef.current?.scrollTo({ x: 0, y: index * itemHeight, animated }),
  }), [itemHeight]);

  const snapToOffsets = useMemo(() => data.map((_: any, i: number) => i * itemHeight), [data, itemHeight]);
  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollOffset } } }],
    { useNativeDriver: true },
  ), [scrollOffset]);
  const ccStyle = useMemo(
    () => [{ paddingVertical: (pickerHeight - itemHeight) / 2 }, contentContainerStyle],
    [pickerHeight, itemHeight, contentContainerStyle],
  );

  // quidone 用 onValueChanged 依赖 onScrollEnd 收尾：滚动开始触发一次 start，
  // 停下（含甩动惯性结束、慢放无惯性）后触发 end。
  const start = () => {
    if (endTimer.current) { clearTimeout(endTimer.current); endTimer.current = null; }
    if (!activeRef.current) { activeRef.current = true; onScrollStart?.(); }
  };
  const end = () => {
    if (activeRef.current) { activeRef.current = false; onScrollEnd?.(); }
  };

  return (
    <GestureDetector gesture={native}>
      <Animated.ScrollView
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        scrollEnabled={!readOnly}
        contentOffset={{ x: 0, y: initialIndex * itemHeight }}
        onScroll={onScroll}
        snapToOffsets={snapToOffsets}
        nestedScrollEnabled
        removeClippedSubviews={false}
        style={{ width: '100%', overflow: 'visible' }}
        contentContainerStyle={ccStyle}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onScrollBeginDrag={start}
        onMomentumScrollBegin={start}
        onScrollEndDrag={() => {
          if (endTimer.current) clearTimeout(endTimer.current);
          endTimer.current = setTimeout(end, 60); // 无惯性时的收尾兜底
        }}
        onMomentumScrollEnd={end}
      >
        {data.map((item: any, index: number) => renderItem({ key: keyExtractor(item, index), item, index }))}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

function HourWheel({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { theme } = useTheme();
  return (
    <WheelPicker
      data={HOUR_DATA}
      value={value}
      onValueChanged={({ item }) => onChange(item.value)}
      onValueChanging={tickHaptic}
      itemHeight={DND_ITEM_H}
      visibleItemCount={DND_VISIBLE}
      style={{ flex: 1 }}
      itemTextStyle={{ fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink }}
      renderOverlay={null}
      renderList={({ ref, ...listProps }: any) => <WheelScrollList listMethodsRef={ref} {...listProps} />}
    />
  );
}

function DndSheet({ visible, onClose, startH, endH, onConfirm }: any) {
  const { theme } = useTheme();
  const t = useT();
  const [s, setS] = useState(startH);
  const [e, setE] = useState(endH);

  useEffect(() => { if (visible) { setS(startH); setE(endH); } }, [visible]);

  const duration = (e - s + 24) % 24;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.dndTitle')} swipeFromHandleOnly>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.inkSoft,
          textAlign: 'center', lineHeight: 20,
        }}>{t('settings.dndDesc')}</Text>

        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft }}>
            {t('settings.dndFrom')}
          </Text>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft }}>
            {t('settings.dndTo')}
          </Text>
        </View>

        <View style={{ height: DND_WHEEL_H, marginTop: 4 }}>
          <View pointerEvents="none" style={{
            position: 'absolute', left: 0, right: 0, top: DND_PAD, height: DND_ITEM_H,
            borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: theme.accent,
            backgroundColor: theme.paper, borderRadius: 2,
          }} />
          <View style={{ flexDirection: 'row', flex: 1 }}>
            <HourWheel value={s} onChange={setS} />
            <HourWheel value={e} onChange={setE} />
          </View>
        </View>

        <Text style={{
          textAlign: 'center', fontFamily: theme.fonts.body,
          fontSize: 13, color: theme.inkSoft, marginTop: 4,
        }}>
          {duration > 0
            ? t('settings.dndDuration', { n: duration })
            : t('settings.dndAllDay')}
        </Text>

        <TouchableOpacity
          onPress={() => onConfirm({ start: s, end: e })}
          activeOpacity={0.7}
          style={{
            marginTop: 20, paddingVertical: 13, borderRadius: 999,
            backgroundColor: theme.accent, alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: '#FFFDF7' }}>
            {t('settings.dndConfirm')}
          </Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

function flashToast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
}

function DevToolsSheet({ onClose, onLock }: any) {
  const { theme, mode } = useTheme();
  const { lang } = useI18n();
  const t = useT();
  const data = useData();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [auth, setAuth] = useState<any>(null);
  const [sys, setSys] = useState<any>(null);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tplMap, setTplMap] = useState<Record<string, { title: string; body: string }>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [tested, setTested] = useState<{ scene: string; ok: boolean; sent?: number; targets?: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [tk, did, userRes, sessRes, net, ip, installTime, vendorId, deviceType] = await Promise.all([
        DooPush.getDeviceToken(),
        DooPush.getDeviceId(),
        supabase.auth.getUser().catch(() => null),
        supabase.auth.getSession().catch(() => null),
        Network.getNetworkStateAsync().catch(() => null),
        Network.getIpAddressAsync().catch(() => ''),
        Application.getInstallationTimeAsync().catch(() => null),
        Platform.OS === 'ios' ? Application.getIosIdForVendorAsync().catch(() => '') : Promise.resolve(''),
        Device.getDeviceTypeAsync().catch(() => null),
      ]);
      setToken(tk);
      setDeviceId(did);
      const u = (userRes as any)?.data?.user;
      const s = (sessRes as any)?.data?.session;
      setAuth(u ? {
        userId: u.id,
        phone: u.phone || '',
        email: u.email || '',
        anonymous: u.is_anonymous === true,
        provider: u.app_metadata?.provider || '',
        expiresAt: s?.expires_at || 0,
      } : null);
      setSys({
        net, ip, installTime, deviceType,
        installId: Platform.OS === 'android' ? (Application.getAndroidId?.() || '') : vendorId,
      });
    } catch (e: any) {
      console.warn('[DevTools] refresh failed', e?.message || e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // 推送测试/预览用的文案物种：与线上 sender 行为一致，固定 squirrel。
  const species = 'squirrel';

  // 拉取通知模板（按当前语言 + species），供「推送测试」分组内联预览
  useEffect(() => {
    let alive = true;
    fetchNotificationTemplates(lang, species)
      .then((rows: any[]) => {
        if (!alive) return;
        const m: Record<string, { title: string; body: string }> = {};
        for (const r of rows) m[r.scene] = { title: r.title, body: r.body };
        setTplMap(m);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [lang, species]);

  // 把某个 scene 的真实模板作为测试推送发到本机
  const sendTest = async (scene: string) => {
    if (testing) return;
    // 实时重取最新 token：iOS token 会轮换，缓存的旧 token 在 DooPush 那边会「找不到设备」。
    let tk = token;
    try { tk = (await DooPush.getDeviceToken()) || token; } catch {}
    if (tk !== token) setToken(tk);
    if (!tk) { Alert.alert(t('settings.devSecPushTest'), t('settings.devPushTestNoToken')); return; }
    setTesting(scene);
    setTested(null);
    // 先断开网关：让 DooPush server 把本机标记为离线，否则前台在线设备会被 /push/single 跳过。
    // 短等让服务端 MarkOffline 落库后再发，避免竞态（App 保持前台，前台收到走 addMessageListener，无横幅）。
    try { await DooPush.disconnectGateway(); } catch {}
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const r = await sendTestNotification({ scene, deviceToken: tk, lang, species });
      const ok = r.sent > 0;
      setTested({ scene, ok, sent: r.sent, targets: r.targets });
      flashToast(ok ? t('settings.devPushTestSent') : t('settings.devPushTestFail'));
      setTimeout(() => setTested((prev) => (prev?.scene === scene ? null : prev)), 2600);
    } catch (e: any) {
      setTested({ scene, ok: false });
      Alert.alert(t('settings.devSecPushTest'), String(e?.message || e));
      setTimeout(() => setTested((prev) => (prev?.scene === scene ? null : prev)), 2200);
    } finally {
      setTesting(null);
      // 推送已发出，恢复网关连接（App 在后台时此调用会在回到前台后生效）
      DooPush.connectGateway().catch(() => {});
    }
  };

  const register = async () => {
    if (registering) return;
    setRegistering(true);
    try {
      const r = await safeDooPushRegister();
      setToken(r.token);
      setDeviceId(r.deviceId);
    } catch (e: any) {
      Alert.alert(t('settings.devRegister'), String(e?.message || e));
    } finally {
      setRegistering(false);
    }
  };

  const copy = async (id: string, value: any) => {
    const str = value == null ? '' : String(value);
    if (!str) return;
    await Clipboard.setStringAsync(str);
    setCopied(id);
    flashToast(t('settings.copied'));
    setTimeout(() => setCopied(null), 1500);
  };

  const lock = () => {
    Alert.alert(t('settings.devLock'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.devLock'),
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(DEV_UNLOCK_KEY);
          onLock && onLock();
          onClose && onClose();
        },
      },
    ]);
  };

  // ── 派生信息 ──
  const fam = data.family;
  const myMember = fam?.members?.find((m: any) => m.isMe);
  const myRole = myMember ? (myMember.customRole || myMember.role) : (data.profile?.role || '');
  const supaHost = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const buildMode = __DEV__ ? 'development' : 'production';
  const tzOffset = -new Date().getTimezoneOffset() / 60;
  const tz = `UTC${tzOffset >= 0 ? '+' : ''}${tzOffset}`;
  const dataState = data.loading ? 'loading' : data.loaded ? 'loaded' : 'idle';
  const sessionExpiry = auth?.expiresAt
    ? `${new Date(auth.expiresAt * 1000).toLocaleString()} · ${Math.round((auth.expiresAt * 1000 - Date.now()) / 60000)}m`
    : '';

  // 原生模块的同步常量：旧 dev build 若未编入这些原生模块，读取可能抛错，统一兜底，避免崩页。
  const native = useMemo(() => {
    const g = (fn: () => any) => { try { return fn(); } catch { return null; } };
    return {
      model: g(() => Device.modelName),
      manufacturer: g(() => Device.manufacturer),
      osName: g(() => Device.osName),
      osVersion: g(() => Device.osVersion),
      deviceName: g(() => Device.deviceName),
      isDevice: g(() => Device.isDevice),
      totalMemory: g(() => Device.totalMemory),
      cpu: g(() => Device.supportedCpuArchitectures),
      appId: g(() => Application.applicationId),
      nativeAppVer: g(() => Application.nativeApplicationVersion),
      nativeBuildVer: g(() => Application.nativeBuildVersion),
      execEnv: g(() => Constants.executionEnvironment),
      sessionId: g(() => Constants.sessionId),
      easProjectId: g(() => (Constants.expoConfig as any)?.extra?.eas?.projectId || (Constants as any)?.easConfig?.projectId),
      otaId: g(() => Updates.updateId),
      otaChannel: g(() => Updates.channel),
      otaRuntime: g(() => Updates.runtimeVersion),
      otaCreatedAt: g(() => Updates.createdAt),
      otaEmbedded: g(() => Updates.isEmbeddedLaunch),
      otaEnabled: g(() => Updates.isEnabled),
    };
  }, []);

  // 设备
  const DEVICE_TYPES = ['unknown', 'phone', 'tablet', 'desktop', 'tv'];
  const deviceType = sys?.deviceType != null ? (DEVICE_TYPES[sys.deviceType] || 'unknown') : '';
  const osStr = native.osName ? `${native.osName} ${native.osVersion || ''}`.trim() : `${Platform.OS} ${Platform.Version}`;
  const memGB = native.totalMemory ? `${(native.totalMemory / 1073741824).toFixed(1)} GB` : '';
  const cpuArch = native.cpu?.join(', ') || '';
  const installTime = sys?.installTime ? new Date(sys.installTime).toLocaleString() : '';

  // 网络
  const netType = sys?.net?.type || '';
  const netConnected = sys?.net ? sys.net.isConnected : null;
  const netInternet = sys?.net ? sys.net.isInternetReachable : null;

  // 应用 / 原生 / OTA
  const nativeVer = native.nativeAppVer
    ? `${native.nativeAppVer} (${native.nativeBuildVer || '?'})`
    : '';
  const execEnv = native.execEnv || '';
  const easProjectId = native.easProjectId || '';
  const otaCreated = native.otaCreatedAt ? new Date(native.otaCreatedAt).toLocaleString() : '';

  // ── 一键导出整份调试报告 ──
  const report = [
    '# 一百件事 · 调试信息',
    '',
    '[账号]',
    `userId: ${auth?.userId || '-'}`,
    `phone: ${auth?.phone || '-'}`,
    `email: ${auth?.email || '-'}`,
    `anonymous: ${auth ? auth.anonymous : '-'}`,
    `provider: ${auth?.provider || '-'}`,
    `sessionExpiry: ${sessionExpiry || '-'}`,
    '',
    '[家庭]',
    `familyId: ${fam?.id || '-'}`,
    `inviteCode: ${fam?.inviteCode || '-'}`,
    `myRole: ${myRole || '-'}`,
    `isCreator: ${fam ? fam.isCreator : '-'}`,
    `members: ${fam?.members?.length ?? '-'}`,
    '',
    '[数据]',
    `kids: ${data.kids?.length ?? 0}`,
    `memories: ${data.memories?.length ?? 0}`,
    `customLevels: ${data.customLevels?.length ?? 0}`,
    `levels: ${data.levels?.length ?? 0}`,
    `state: ${dataState}`,
    `lastError: ${data.error || '-'}`,
    '',
    '[推送]',
    `token: ${token || '-'}`,
    `deviceId: ${deviceId || '-'}`,
    '',
    '[设备]',
    `model: ${native.model || '-'}`,
    `manufacturer: ${native.manufacturer || '-'}`,
    `os: ${osStr}`,
    `deviceName: ${native.deviceName || '-'}`,
    `deviceType: ${deviceType || '-'}`,
    `physical: ${native.isDevice}`,
    `memory: ${memGB || '-'}`,
    `cpu: ${cpuArch || '-'}`,
    `installId: ${sys?.installId || '-'}`,
    '',
    '[网络]',
    `type: ${netType || '-'}`,
    `connected: ${netConnected == null ? '-' : netConnected}`,
    `internet: ${netInternet == null ? '-' : netInternet}`,
    `ip: ${sys?.ip || '-'}`,
    '',
    '[更新]',
    `updateId: ${native.otaId || '-'}`,
    `channel: ${native.otaChannel || '-'}`,
    `runtimeVersion: ${native.otaRuntime || '-'}`,
    `createdAt: ${otaCreated || '-'}`,
    `embedded: ${native.otaEmbedded}`,
    `enabled: ${native.otaEnabled}`,
    '',
    '[应用]',
    `version: ${APP_VERSION} (${APP_BUILD})`,
    `nativeVersion: ${nativeVer || '-'}`,
    `bundleId: ${native.appId || '-'}`,
    `execEnv: ${execEnv || '-'}`,
    `easProject: ${easProjectId || '-'}`,
    `sessionId: ${native.sessionId || '-'}`,
    `installTime: ${installTime || '-'}`,
    `platform: ${Platform.OS} ${Platform.Version}`,
    `build: ${buildMode}`,
    `lang: ${lang}`,
    `theme: ${mode} · ${theme.isDark ? 'dark' : 'light'}`,
    `timezone: ${tz}`,
    `supabase: ${supaHost || '-'}`,
  ].join('\n');

  const copyAll = async () => {
    await Clipboard.setStringAsync(report);
    flashToast(t('settings.copied'));
  };

  // 单行：左标签 + 右值（点按复制）。block=值另起一行换行展示（适合长 ID）。
  const row = ({ id, label, value, block, empty, last }: any) => {
    const has = value !== null && value !== undefined && value !== '';
    const str = has ? String(value) : (empty || '—');
    return (
      <TouchableOpacity
        key={id}
        activeOpacity={has ? 0.6 : 1}
        onPress={() => copy(id, str)}
      >
        <View style={{
          paddingVertical: 11, paddingHorizontal: 16,
          borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.line,
        }}>
          {block ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.ink }}>
                  {label}
                </Text>
                {has ? (
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: copied === id ? theme.accent : theme.inkSoft }}>
                    {copied === id ? t('settings.copied') : t('settings.copy')}
                  </Text>
                ) : null}
              </View>
              <Text selectable style={{
                marginTop: 6, fontFamily: theme.fonts.body, fontSize: 12,
                color: theme.inkSoft, opacity: has ? 1 : 0.6, lineHeight: 17,
              }}>
                {str}
              </Text>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.ink }}>
                {label}
              </Text>
              <Text selectable numberOfLines={1} style={{
                flex: 1, textAlign: 'right', fontFamily: theme.fonts.body, fontSize: 13,
                color: copied === id ? theme.accent : theme.inkSoft, opacity: has ? 1 : 0.6,
              }}>
                {copied === id ? t('settings.copied') : str}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const card = (title: string, children: any) => (
    <View style={{ marginTop: 16 }}>
      <Text style={{
        marginLeft: 6, marginBottom: 7, fontFamily: theme.fonts.body,
        fontSize: 12.5, color: theme.inkSoft, letterSpacing: 0.3,
      }}>
        {title}
      </Text>
      <View style={{
        backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line,
        borderRadius: 18, overflow: 'hidden',
      }}>
        {children}
      </View>
    </View>
  );

  const yn = (b: any) => (b === true ? '✓' : b === false ? '✗' : '—');

  // ── 推送测试：7 种消息类型，按优先级展示 ──
  const PUSH_SCENES: { scene: string; label: string }[] = [
    { scene: 'gentle_remind', label: t('settings.devSceneGentleRemind') },
    { scene: 'growth_nudge', label: t('settings.devSceneGrowthNudge') },
    { scene: 'loss_hint', label: t('settings.devSceneLossHint') },
    { scene: 'milestone', label: t('settings.devSceneMilestone') },
    { scene: 'capsule', label: t('settings.devSceneCapsule') },
    { scene: 'family_activity', label: t('settings.devSceneFamilyActivity') },
    { scene: 'streak', label: t('settings.devSceneStreak') },
  ];
  const sampleVars: Record<string, string | number> = {
    done: 5, remain: 2, days: 3, who: lang === 'en' ? 'Dad' : '爸爸',
  };
  const interpTpl = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_m, k) => (sampleVars[k] != null ? String(sampleVars[k]) : ''));

  const testRow = ({ scene, label }: { scene: string; label: string }, last?: boolean) => {
    const tpl = tplMap[scene];
    const preview = tpl ? `${tpl.title} · ${interpTpl(tpl.body)}` : '—';
    const busy = testing === scene;
    const done = tested?.scene === scene ? tested : null;
    const rightText = busy
      ? t('settings.devPushTestSending')
      : done
        ? (done.ok
            ? `${t('settings.devPushTestSent')} ${done.sent}/${done.targets}`
            : t('settings.devPushTestFail'))
        : t('settings.devPushTestSend');
    const rightColor = done
      ? (done.ok ? theme.accent : theme.danger)
      : (token ? theme.accent : theme.inkSoft);
    return (
      <TouchableOpacity
        key={scene}
        activeOpacity={token ? 0.6 : 1}
        disabled={busy}
        onPress={() => sendTest(scene)}
      >
        <View style={{
          paddingVertical: 11, paddingHorizontal: 16,
          borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.line,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.ink }}>
              {label}
            </Text>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 12.5,
              color: rightColor, opacity: token || done ? 1 : 0.5,
            }}>
              {rightText}
            </Text>
          </View>
          <Text numberOfLines={3} style={{
            marginTop: 5, fontFamily: theme.fonts.body, fontSize: 12,
            color: theme.inkSoft, lineHeight: 17,
          }}>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('settings.devTitle')} onBack={onClose} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}
        >
          {card(t('settings.devSecAccount'), [
            row({ id: 'uid', label: t('settings.devUserId'), value: auth?.userId, block: true }),
            row({ id: 'phone', label: t('settings.devPhone'), value: auth?.phone }),
            row({ id: 'email', label: t('settings.devEmail'), value: auth?.email }),
            row({ id: 'anon', label: t('settings.devAnonymous'), value: auth ? yn(auth.anonymous) : null }),
            row({ id: 'provider', label: t('settings.devProvider'), value: auth?.provider }),
            row({ id: 'expiry', label: t('settings.devSessionExpiry'), value: sessionExpiry, last: true }),
          ])}

          {card(t('settings.devSecFamily'), [
            row({ id: 'fid', label: t('settings.devFamilyId'), value: fam?.id, block: true }),
            row({ id: 'invite', label: t('settings.devInviteCode'), value: fam?.inviteCode }),
            row({ id: 'role', label: t('settings.devMyRole'), value: myRole }),
            row({ id: 'creator', label: t('settings.devIsCreator'), value: fam ? yn(fam.isCreator) : null }),
            row({ id: 'members', label: t('settings.devMemberCount'), value: fam?.members?.length, last: true }),
          ])}

          {card(t('settings.devSecData'), [
            row({ id: 'kids', label: t('settings.devKids'), value: data.kids?.length ?? 0 }),
            row({ id: 'mem', label: t('settings.devMemories'), value: data.memories?.length ?? 0 }),
            row({ id: 'clv', label: t('settings.devCustomLevels'), value: data.customLevels?.length ?? 0 }),
            row({ id: 'lv', label: t('settings.devLevels'), value: data.levels?.length ?? 0 }),
            row({ id: 'state', label: t('settings.devDataState'), value: dataState }),
            row({ id: 'err', label: t('settings.devLastError'), value: data.error, block: true, last: true }),
          ])}

          {card(t('settings.devSecPush'), [
            row({ id: 'token', label: t('settings.devPushToken'), value: token, block: true, empty: t('settings.devNotRegistered') }),
            row({ id: 'device', label: t('settings.devDeviceId'), value: deviceId, block: true, empty: t('settings.devNotRegistered'), last: true }),
          ])}

          {card(t('settings.devSecPushTest'),
            PUSH_SCENES.map((s, i) => testRow(s, i === PUSH_SCENES.length - 1)),
          )}
          <Text style={{
            marginTop: 7, marginLeft: 6, fontFamily: theme.fonts.body,
            fontSize: 11.5, color: theme.inkSoft, lineHeight: 16,
          }}>
            {t('settings.devPushTestHint')}
          </Text>


          {card(t('settings.devSecDevice'), [
            row({ id: 'model', label: t('settings.devModel'), value: native.model }),
            row({ id: 'mfr', label: t('settings.devManufacturer'), value: native.manufacturer }),
            row({ id: 'os', label: t('settings.devOS'), value: osStr }),
            row({ id: 'dname', label: t('settings.devDeviceName'), value: native.deviceName }),
            row({ id: 'dtype', label: t('settings.devDeviceType'), value: deviceType }),
            row({ id: 'physical', label: t('settings.devPhysical'), value: native.isDevice == null ? null : yn(native.isDevice) }),
            row({ id: 'mem', label: t('settings.devMemory'), value: memGB }),
            row({ id: 'cpu', label: t('settings.devCpuArch'), value: cpuArch }),
            row({ id: 'iid', label: t('settings.devInstallId'), value: sys?.installId, block: true, last: true }),
          ])}

          {card(t('settings.devSecNetwork'), [
            row({ id: 'ntype', label: t('settings.devNetType'), value: netType }),
            row({ id: 'nconn', label: t('settings.devConnected'), value: netConnected == null ? null : yn(netConnected) }),
            row({ id: 'ninet', label: t('settings.devInternet'), value: netInternet == null ? null : yn(netInternet) }),
            row({ id: 'ip', label: t('settings.devIp'), value: sys?.ip, last: true }),
          ])}

          {card(t('settings.devSecUpdate'), [
            row({ id: 'otaid', label: t('settings.devOtaId'), value: native.otaId, block: true, empty: t('settings.devOtaNone') }),
            row({ id: 'otach', label: t('settings.devOtaChannel'), value: native.otaChannel }),
            row({ id: 'otart', label: t('settings.devOtaRuntime'), value: native.otaRuntime }),
            row({ id: 'otacr', label: t('settings.devOtaCreated'), value: otaCreated }),
            row({ id: 'otaem', label: t('settings.devOtaEmbedded'), value: native.otaEmbedded == null ? null : yn(native.otaEmbedded) }),
            row({ id: 'otaen', label: t('settings.devOtaEnabled'), value: native.otaEnabled == null ? null : yn(native.otaEnabled), last: true }),
          ])}

          {card(t('settings.devSecApp'), [
            row({ id: 'ver', label: t('settings.devVersion'), value: `${APP_VERSION} (${APP_BUILD})` }),
            row({ id: 'nver', label: t('settings.devNativeVersion'), value: nativeVer }),
            row({ id: 'bundle', label: t('settings.devBundleId'), value: native.appId, block: true }),
            row({ id: 'exec', label: t('settings.devExecEnv'), value: execEnv }),
            row({ id: 'eas', label: t('settings.devEasProject'), value: easProjectId, block: true }),
            row({ id: 'sid', label: t('settings.devSessionId'), value: native.sessionId, block: true }),
            row({ id: 'itime', label: t('settings.devInstallTime'), value: installTime }),
            row({ id: 'plat', label: t('settings.devPlatform'), value: `${Platform.OS} ${Platform.Version}` }),
            row({ id: 'build', label: t('settings.devBuildMode'), value: buildMode }),
            row({ id: 'lang', label: t('settings.devLang'), value: lang }),
            row({ id: 'theme', label: t('settings.devTheme'), value: `${mode} · ${theme.isDark ? 'dark' : 'light'}` }),
            row({ id: 'tz', label: t('settings.devTimezone'), value: tz }),
            row({ id: 'supa', label: t('settings.devSupabase'), value: supaHost, block: true, last: true }),
          ])}

          <View style={{ marginTop: 22, gap: 12 }}>
            <PrimaryButton
              label={registering ? t('settings.devRegistering') : t('settings.devRegister')}
              onPress={register}
            />
            <SecondaryButton label={t('settings.devCopyAll')} onPress={copyAll} />
            <SecondaryButton label={t('settings.devRefresh')} onPress={refresh} />
            <SecondaryButton label={t('settings.devLock')} onPress={lock} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* 通知偏好（频率 + 家人动态 + 免打扰），读写 notification_preferences。 */
function PetNotifyGroup() {
  const { theme } = useTheme();
  const t = useT();
  const [prefs, setPrefs] = useState({
    enabled: true, frequency: 'normal', notify_family: true,
    quiet_start: '22:00:00', quiet_end: '08:00:00',
  });
  const [dndSheet, setDndSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchNotificationPrefs()
      .then(p => { if (alive && p) setPrefs(prev => ({ ...prev, ...p })); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const save = (patch: Record<string, any>) => {
    setPrefs(prev => ({ ...prev, ...patch }));
    updateNotificationPrefs(patch).catch(e => console.warn('notif prefs:', e?.message || e));
  };

  const hourOf = (s: string) => parseInt((s || '0').split(':')[0], 10) || 0;
  const toTime = (h: number) => `${String(h).padStart(2, '0')}:00:00`;

  const qStart = hourOf(prefs.quiet_start);
  const qEnd = hourOf(prefs.quiet_end);

  // 后端约定：quiet_start == quiet_end → 永不免打扰（关）。开关用此判断开/关，
  // 关闭时记住上次的时段，下次打开直接复原。
  const dndOn = qStart !== qEnd;
  const lastWindow = useRef({ start: 22, end: 8 });
  useEffect(() => { if (dndOn) lastWindow.current = { start: qStart, end: qEnd }; }, [dndOn, qStart, qEnd]);

  const toggleDnd = (on: boolean) => {
    if (on) {
      const w = lastWindow.current;
      save({ quiet_start: toTime(w.start), quiet_end: toTime(w.end) });
    } else {
      save({ quiet_start: '00:00:00', quiet_end: '00:00:00' });
    }
  };

  return (
    <>
    <SettingGroup label={t('settings.groupPetNotify')}>
      <ToggleRow
        title={t('settings.petNotifyEnabled')}
        value={prefs.enabled}
        onValueChange={(v: boolean) => save({ enabled: v })}
        last={!prefs.enabled}
      />
      {prefs.enabled && (
        <>
          <SelectRow
            title={t('settings.petFrequency')}
            options={[
              { key: 'gentle', label: t('settings.freqGentle') },
              { key: 'normal', label: t('settings.freqNormal') },
              { key: 'frequent', label: t('settings.freqFrequent') },
            ]}
            value={prefs.frequency}
            onSelect={(v: string) => save({ frequency: v })}
          />
          <ToggleRow
            title={t('settings.dnd')}
            value={dndOn}
            onValueChange={toggleDnd}
            last={!dndOn}
          />
          {dndOn && (
            <Row
              icon={Icon.moon(theme.accent, 20)}
              title={t('settings.dndTitle')}
              value={`${String(qStart).padStart(2, '0')}:00 – ${String(qEnd).padStart(2, '0')}:00`}
              onPress={() => setDndSheet(true)}
              last
            />
          )}
        </>
      )}
    </SettingGroup>
    <DndSheet
      visible={dndSheet}
      onClose={() => setDndSheet(false)}
      startH={qStart}
      endH={qEnd}
      onConfirm={(val: any) => {
        save({ quiet_start: toTime(val.start), quiet_end: toTime(val.end) });
        setDndSheet(false);
      }}
    />
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Settings Screen
   ══════════════════════════════════════════════════════════ */

export default function Settings({ navigation, route }: any) {
  const { theme, mode: themeMode, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const insets = useSafeAreaInsets();
  const { kids: dataKids, editKid, addKid: dbAddKid, FAMILY, getKid, kidLabel, profile, updateMe } = useData();

  // 身份（我是谁）直接走 DataProvider：profile 是唯一真源，避免把回调函数塞进导航参数
  // （会触发 React Navigation 的 non-serializable 警告）。本地 state 让选择即时反映。
  const [me, setMeLocal] = useState(() => ({
    role: profile?.role ?? DEFAULT_ME.role,
    custom: profile?.custom_role ?? DEFAULT_ME.custom,
  }));
  useEffect(() => {
    if (profile) setMeLocal({ role: profile.role, custom: profile.custom_role || '' });
  }, [profile]);
  const setMe = useCallback((m: any) => {
    setMeLocal(m);
    updateMe({ role: m.role, custom_role: m.custom || '' })
      .catch((e: any) => console.warn('updateMe:', e?.message || e));
  }, [updateMe]);

  // Local state
  const [kids, setKids] = useState(() => dataKids.map(k => ({ ...k })));
  const [editId, setEditId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null); // 'add'|'invite'|'about'|'account'|'dev'
  const [defView, setDefView] = useState('together');
  const [anon, setAnon] = useState(false);
  const [inviteExpiry, setInviteExpiry] = useState(DEFAULT_INVITE_EXPIRY);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const versionTapsRef = useRef(0);
  const versionTapTimerRef = useRef<any>(null);

  useEffect(() => { isAnonymous().then(setAnon); }, []);
  useEffect(() => { getInviteExpiryHours().then(setInviteExpiry); }, []);
  useEffect(() => {
    AsyncStorage.getItem(DEV_UNLOCK_KEY).then(v => setDevUnlocked(v === '1')).catch(() => {});
  }, []);

  const onVersionTap = useCallback(() => {
    if (devUnlocked) { setSheet('dev'); return; }
    if (versionTapTimerRef.current) clearTimeout(versionTapTimerRef.current);
    versionTapsRef.current += 1;
    const taps = versionTapsRef.current;
    const need = 7;
    if (taps >= need) {
      versionTapsRef.current = 0;
      AsyncStorage.setItem(DEV_UNLOCK_KEY, '1').catch(() => {});
      setDevUnlocked(true);
      Alert.alert(t('settings.devUnlocked'));
      return;
    }
    if (taps >= 3) {
      flashToast(t('settings.devTapsLeft', { n: need - taps }));
    }
    versionTapTimerRef.current = setTimeout(() => {
      versionTapsRef.current = 0;
    }, 2500);
  }, [devUnlocked, t]);

  const editingKid = kids.find(k => k.id === editId);
  const saveKid = (patch) => {
    setKids(ks => ks.map(k => k.id === editId ? { ...k, ...patch } : k));
    editKid(editId, patch).catch(e => console.warn('updateKid:', e?.message || e));
  };
  // 添加小朋友：真正落库拿到 id 后并入本地列表。
  const addKid = async (k) => {
    try {
      const kid = await dbAddKid({ name: k.name, y: k.y, m: k.m, tone: k.tone });
      setKids(ks => [...ks, kid]);
    } catch (e: any) {
      console.warn('addKid:', e?.message || e);
      Alert.alert(t('onboarding.saveFailTitle'), t('onboarding.networkRetry'));
    }
  };

  const onBack = () => {
    if (navigation && navigation.goBack) navigation.goBack();
  };

  const handleThemeMode = useCallback((mode) => {
    setTheme.setMode(mode);
  }, [setTheme]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('settings.title')} onBack={onBack} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity section: who is using the app ── */}
        <SettingGroup label={t('settings.groupMe')}>
          <IdentityRow
            me={me}
            options={ROLES}
            onSelect={(o) => setMe({ role: o, custom: '' })}
          />
        </SettingGroup>

        {/* ── Account section ── */}
        <SettingGroup label={t('settings.groupAccount')}>
          <Row
            icon={Icon.shieldCheck(theme.accent, 20)}
            title={t('settings.accountSecurity')}
            value={anon ? t('settings.guest') : undefined}
            onPress={() => setSheet('account')}
            last
          />
        </SettingGroup>

        {/* ── Children section ── */}
        <SettingGroup label={t('settings.groupKids')} note={t('settings.kidsNote')}>
          {kids.map(k => (
            <Row
              key={k.id}
              icon={<KidAvatar name={k.name} tone={k.tone} size={32} />}
              title={k.name}
              value={t('common.ageYears', { age: ageFrom(k.y, k.m) })}
              onPress={() => setEditId(k.id)}
            />
          ))}
          <Row
            icon={
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 22,
                color: theme.accent, lineHeight: 26,
              }}>+</Text>
            }
            title={t('settings.addChild')}
            onPress={() => setSheet('add')}
            last
          />
        </SettingGroup>

        {/* ── Notifications ── */}
        <PetNotifyGroup />

        {/* ── Family section ── */}
        <SettingGroup label={t('settings.groupFamily')}>
          <Row
            icon={Icon.users(theme.accent, 20)}
            title={t('settings.familyMembers')}
            value={t('settings.inviteFamily')}
            onPress={() => setSheet('invite')}
          />
          <SelectRow
            icon={Icon.eye(theme.accent, 20)}
            title={t('settings.defaultView')}
            options={[
              { key: 'parent', label: t('perspective.parent.label') },
              { key: 'child', label: t('perspective.child.label') },
              { key: 'together', label: t('perspective.together.label') },
            ]}
            value={defView}
            onSelect={setDefView}
          />
          <SelectRow
            icon={Icon.share(theme.accent, 20)}
            title={t('settings.inviteExpiry')}
            options={INVITE_EXPIRY_OPTIONS.map(h => ({
              key: String(h),
              label: h < 24 ? t('settings.expiryHours', { n: h }) : t('settings.expiryDays', { n: h / 24 }),
            }))}
            value={String(inviteExpiry)}
            onSelect={(v) => { const h = Number(v); setInviteExpiry(h); setInviteExpiryHours(h); }}
            last
          />
        </SettingGroup>

        {/* ── Preservation section ── */}
        <SettingGroup label={t('settings.groupKeep')}>
          <Row
            icon={Icon.book(theme.accent, 20)}
            title={t('settings.exportBook')}
            value={t('settings.goLook')}
            onPress={() => navigation.navigate('Photobook')}
            last
          />
        </SettingGroup>

        {/* ── Appearance section ── */}
        <SettingGroup label={t('settings.groupAppearance')}>
          <SelectRow
            title={t('settings.themeMode')}
            options={[
              { key: 'system', label: t('settings.themeSystem') },
              { key: 'light', label: t('settings.themeLight') },
              { key: 'dark', label: t('settings.themeDark') },
            ]}
            value={themeMode}
            onSelect={handleThemeMode}
          />
          <SelectRow
            title={t('lang.title')}
            options={[
              { key: 'zh', label: t('lang.zh') },
              { key: 'en', label: t('lang.en') },
            ]}
            value={lang}
            onSelect={setLang}
            last
          />
        </SettingGroup>

        {/* ── About section ── */}
        <SettingGroup label={t('settings.groupAbout')}>
          <Row
            icon={Icon.info(theme.accent, 20)}
            title={t('settings.aboutApp')}
            value={`v${APP_VERSION}`}
            onPress={() => setSheet('about')}
            last={!devUnlocked}
          />
          {devUnlocked ? (
            <Row
              icon={Icon.gear(theme.accent, 20)}
              title={t('settings.developerTools')}
              onPress={() => setSheet('dev')}
              last
            />
          ) : null}
        </SettingGroup>

        {/* ── Footer ── */}
        <View style={{ alignItems: 'center', marginTop: 34 }}>
          <TouchableOpacity activeOpacity={0.6} onPress={onVersionTap} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 12,
              color: theme.inkSoft, opacity: 0.7,
            }}>{t('settings.footerVersion', { name: t('settings.appName'), version: APP_VERSION })}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Sub-sheets ── */}
      {editingKid ? (
        <ChildProfileSheet
          kid={editingKid}
          onChange={saveKid}
          onClose={() => setEditId(null)}
        />
      ) : null}
      {sheet === 'add' ? (
        <AddChildSheet onAdd={addKid} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'invite' ? (
        <InviteSheet kids={kids} me={me} onClose={() => setSheet(null)} onJoinFamily={(autoScan?: boolean) => { setSheet(null); navigation.navigate('JoinFamily', { autoScan }); }} />
      ) : null}
{sheet === 'about' ? (
        <AboutSheet onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'account' ? (
        <AccountSecuritySheet anon={anon} onAnonChanged={() => isAnonymous().then(setAnon)} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'dev' ? (
        <DevToolsSheet
          onClose={() => setSheet(null)}
          onLock={() => setDevUnlocked(false)}
        />
      ) : null}
    </View>
  );
}
