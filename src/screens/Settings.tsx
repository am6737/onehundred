// screens/Settings.js — React Native implementation of the Settings screen.
// Faithfully converted from the web prototype at screens_settings.jsx.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  Modal, Pressable, TextInput, StyleSheet, Dimensions,
  useColorScheme, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, COLORS } from '../theme/tokens';
import { useI18n, useT } from '../i18n';
import { ROLES, DEFAULT_ME, meName, meChar, roleLabel, NOW_YM } from '../data';
import { useData } from '../data/DataProvider';
import { signOut, isAnonymous, bindEmail, deleteAccount } from '../lib/auth';
import { Icon, KidAvatar } from '../components/Icons';
import { LayerHeader, Sheet, Chip, PrimaryButton, SecondaryButton, Section } from '../components/common';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

const NOW = { y: NOW_YM.y, m: NOW_YM.m };

function ageFrom(y, m) {
  let a = NOW.y - y - (NOW.m < m ? 1 : 0);
  return Math.max(0, a);
}

/* ══════════════════════════════════════════════════════════
   Small components
   ══════════════════════════════════════════════════════════ */

// SettingGroup — a card-like group of setting rows
function SettingGroup({ label, note = null, children }) {
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
function Row({ icon = null, title, sub = null, value = null, onPress = null, last = false, children = null }) {
  const { theme } = useTheme();
  const tappable = !!onPress;

  const inner = (
    <View style={{
      width: '100%', flexDirection: 'row', alignItems: 'center',
      gap: 13, paddingVertical: 15, paddingHorizontal: 16,
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
        }}>{title}</Text>
        {sub ? (
          <Text style={{
            marginTop: 2, fontFamily: theme.fonts.body,
            fontSize: 12.5, color: theme.inkSoft, lineHeight: 19,
          }}>{sub}</Text>
        ) : null}
      </View>
      {children}
      {value != null ? (
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft,
        }}>{value}</Text>
      ) : null}
      {tappable ? Icon.chevR(theme.inkSoft, 18) : null}
    </View>
  );

  if (!tappable) return <View>{inner}</View>;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
}

// Toggle — a row with a Switch toggle
function ToggleRow({ icon, title, sub, value, onValueChange, last }) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      gap: 13, paddingVertical: 12, paddingHorizontal: 16,
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
        }}>{title}</Text>
        {sub ? (
          <Text style={{
            marginTop: 2, fontFamily: theme.fonts.body,
            fontSize: 12.5, color: theme.inkSoft, lineHeight: 19,
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
function Seg({ options, value, onChange }) {
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
                shadowColor: theme.ink, shadowOffset: { width: 0, height: 1 },
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
function Stepper({ value, min, max, onChange, fmt = (v) => String(v), wrap = false }) {
  const { theme } = useTheme();
  const step = (d) => {
    let v = value + d;
    if (wrap) { if (v < min) v = max; if (v > max) v = min; }
    else v = Math.min(max, Math.max(min, v));
    onChange(v);
  };
  const StepBtn = ({ d, dis }) => (
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
function RoleAvatar({ ch, size = 48, on }) {
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

function IdentityRow({ me, options, onSelect, divider = false }) {
  const { theme } = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
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
          gap: 13, paddingVertical: 15, paddingHorizontal: 16,
          borderBottomWidth: divider ? 1 : 0, borderBottomColor: theme.line,
        }}
      >
        <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>
          {t('settings.iAm')}
        </Text>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 14.5,
          color: open ? theme.accent : theme.inkSoft,
        }}>{meName(me)}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          {Icon.chevDown(open ? theme.accent : theme.inkSoft, 18)}
        </View>
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ position: 'absolute', top: pos.top, right: pos.right }}
          >
            <View style={{
              minWidth: 120, backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              borderRadius: 12, padding: 4,
              shadowColor: theme.ink, shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.18, shadowRadius: 24, elevation: 8,
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
                      color: on ? theme.accent : theme.ink,
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

function SelectRow({ icon = null, title, sub = null, options, value, onSelect, last = false }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 20 });
  // options 可为字符串数组或 {key,label} 数组：用 key 判等、label 显示
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
          gap: 13, paddingVertical: 15, paddingHorizontal: 16,
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
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>{title}</Text>
          {sub ? (
            <Text style={{ marginTop: 2, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, lineHeight: 19 }}>{sub}</Text>
          ) : null}
        </View>
        <Text style={{
          fontFamily: theme.fonts.body, fontSize: 14,
          color: open ? theme.accent : theme.inkSoft,
        }}>{valueLabel}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          {Icon.chevDown(open ? theme.accent : theme.inkSoft, 18)}
        </View>
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ position: 'absolute', top: pos.top, right: pos.right }}
          >
            <View style={{
              minWidth: 120, backgroundColor: theme.paper,
              borderWidth: 1, borderColor: theme.line,
              borderRadius: 12, padding: 4,
              shadowColor: theme.ink, shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.18, shadowRadius: 24, elevation: 8,
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
                      color: on ? theme.accent : theme.ink,
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

function ChildProfileSheet({ kid, onChange, onClose }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [y, setY] = useState(kid.y);
  const [m, setM] = useState(kid.m);
  const age = ageFrom(y, m);
  const toEighteen = Math.max(0, y + 18 - NOW.y);
  const save = () => { onChange({ y, m }); onClose(); };

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
            <KidAvatar name={kid.name} tone={kid.tone} size={84} />
            <Text style={{ marginTop: 8, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink }}>{kid.name}</Text>
          </View>

          {/* Description */}
          <Text style={{
            marginTop: 18, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {t('settings.kidProfileDesc')}
          </Text>

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
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>{t('onboarding.birthYear')}</Text>
              <Stepper value={y} min={2008} max={NOW.y} onChange={setY} fmt={v => t('onboarding.yearFmt', { v })} />
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>{t('onboarding.birthMonth')}</Text>
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

function AddChildSheet({ onAdd, onClose }) {
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
            <Text style={{
              marginTop: 12, fontFamily: theme.fonts.hand, fontSize: 18,
              color: theme.inkSoft, lineHeight: 30,
            }}>{t('settings.addChildTagline')}</Text>
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
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>{t('onboarding.birthYear')}</Text>
              <Stepper value={y} min={2008} max={NOW.y} onChange={setY} fmt={v => t('onboarding.yearFmt', { v })} />
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>{t('onboarding.birthMonth')}</Text>
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
                      ...(on ? {
                        shadowColor: c, shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3, shadowRadius: 20, elevation: 4,
                      } : {}),
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

function ParentAvatar({ ch }) {
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

function MemberRow({ avatar, name, role, last = false }) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 13,
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.line,
    }}>
      {avatar}
      <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>{name}</Text>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>{role}</Text>
    </View>
  );
}

function InviteSheet({ kids, me, onClose }) {
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
  const peopleCount = adults.length + kids.length;

  const copy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('settings.familyMembers')} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {t('settings.familyCountDesc', { count: peopleCount })}
          </Text>

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
            <View style={{
              marginTop: 16, padding: 14, borderRadius: 16,
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
                marginTop: 14, width: '100%', paddingVertical: 14, borderRadius: 999,
                backgroundColor: copied ? theme.sand : theme.accent,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {copied ? Icon.check(theme.accent, 18) : null}
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 16,
                color: copied ? theme.accent : '#FFFDF7',
              }}>{copied ? t('settings.codeCopied') : t('settings.copyCode')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   ReminderTimeSheet
   ══════════════════════════════════════════════════════════ */

function ReminderTimeSheet({ value, onChange, onClose }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  // 用稳定的 key 存值（如 'sun evening'），展示时再翻译，切语言不丢选中态
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const TIME_KEYS = ['morning', 'noon', 'afternoon', 'evening'];
  const [d0, t0] = (value || 'sun evening').split(' ');
  const [day, setDay] = useState(DAY_KEYS.includes(d0) ? d0 : 'sun');
  const [time, setTime] = useState(TIME_KEYS.includes(t0) ? t0 : 'evening');
  const save = () => { onChange(`${day} ${time}`); onClose(); };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={t('settings.remindTime')}
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
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {t('settings.reminderSheetDesc')}
          </Text>

          {/* Day picker */}
          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 10,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>{t('settings.whichDay')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {DAY_KEYS.map(d => {
              const on = day === d;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDay(d)}
                  activeOpacity={0.7}
                  style={{
                    width: (SCREEN_W - 44 - 27) / 4, // 4 columns with gaps
                    paddingVertical: 13, borderRadius: 16, alignItems: 'center',
                    backgroundColor: on ? theme.accent : theme.paper,
                    borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  }}
                >
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 14.5,
                    color: on ? '#FFFDF7' : theme.ink,
                  }}>{t('settings.day.' + d)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time picker */}
          <Text style={{
            marginTop: 24, paddingHorizontal: 4, paddingBottom: 10,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>{t('settings.whichTime')}</Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {TIME_KEYS.map(tm => {
              const on = time === tm;
              return (
                <TouchableOpacity
                  key={tm}
                  onPress={() => setTime(tm)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: 'center',
                    backgroundColor: on ? theme.accent : theme.paper,
                    borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  }}
                >
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 15,
                    color: on ? '#FFFDF7' : theme.ink,
                  }}>{t('settings.time.' + tm)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preview card */}
          <View style={{
            marginTop: 26, padding: 20, borderRadius: 22,
            backgroundColor: theme.sand, alignItems: 'center',
          }}>
            {Icon.bell(theme.accent, 22)}
            <Text style={{
              marginTop: 10, fontFamily: theme.fonts.head, fontSize: 21, color: theme.ink,
            }}>{t('settings.remindAtFmt', { day: t('settings.day.' + day), time: t('settings.time.' + time) })}</Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
            }}>{t('settings.reminderPreview')}</Text>
          </View>
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

function DocSheet({ kind, onClose }) {
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

function AboutSheet({ onClose }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState(null);
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
            <View style={{
              width: 84, height: 84, borderRadius: 24,
              backgroundColor: theme.accent,
              justifyContent: 'center', alignItems: 'center',
              shadowColor: theme.accent, shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.4, shadowRadius: 30, elevation: 8,
            }}>
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 42,
                color: '#FFFDF7', marginTop: 2,
              }}>{t('settings.appMark')}</Text>
            </View>
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

function ChangePhoneSheet({ anon, onClose }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const canSend = phone.trim().length >= 11 && countdown === 0;
  const canSave = phone.trim().length >= 11 && code.trim().length === 6;

  const sendCode = () => {
    if (!canSend) return;
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={anon ? t('settings.bindPhone') : t('settings.changePhone')}
          onBack={onClose}
          right={
            <TouchableOpacity
              onPress={canSave ? onClose : undefined}
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
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.ink }}>138 **** 6688</Text>
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
              }}>{countdown > 0 ? `${countdown}s` : t('settings.getCode')}</Text>
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

function ConfirmDialog({ visible, icon, title, message, confirmLabel, confirmColor, onConfirm, cancelLabel, onCancel }) {
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
          shadowColor: theme.ink, shadowOffset: { width: 0, height: 20 },
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

function DeleteAccountSheet({ onClose }) {
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
            backgroundColor: '#FDF5F5',
            borderWidth: 1.5, borderColor: '#F0D6D6',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 34, height: 34, borderRadius: 12,
                backgroundColor: '#F0D6D6',
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

function BindEmailSheet({ onBound, onClose }) {
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

function AccountSecuritySheet({ anon, onAnonChanged, onClose }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [subSheet, setSubSheet] = useState(null); // 'changePhone' | 'deleteAccount' | 'bindEmail'
  const [showLogout, setShowLogout] = useState(false);
  const [showUnbindWechat, setShowUnbindWechat] = useState(false);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={t('settings.accountSecurity')} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {anon ? t('settings.accountDescAnon') : t('settings.accountDesc')}
          </Text>

          {/* Login methods */}
          <SettingGroup label={t('settings.loginMethods')}>
            <Row
              icon={Icon.phone(theme.accent, 19)}
              title={t('settings.phone')}
              value={anon ? t('settings.notBound') : '138 **** 6688'}
              onPress={() => setSubSheet('changePhone')}
            />
            <Row
              icon={Icon.users(theme.accent, 19)}
              title={t('settings.wechat')}
              value={anon ? t('settings.notBound') : t('settings.bound')}
              onPress={anon ? undefined : () => setShowUnbindWechat(true)}
              last={anon ? false : true}
            />
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
                  gap: 13, paddingVertical: 15, paddingHorizontal: 16,
                }}
              >
                <View style={{
                  width: 34, height: 34, borderRadius: 12,
                  backgroundColor: '#F0D6D6',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {Icon.lock('#D2929A', 19)}
                </View>
                <Text style={{
                  flex: 1, fontFamily: theme.fonts.body, fontSize: 15.5, color: '#C0616B',
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
        <ChangePhoneSheet anon={anon} onClose={() => setSubSheet(null)} />
      ) : null}
      {subSheet === 'deleteAccount' ? (
        <DeleteAccountSheet onClose={() => setSubSheet(null)} />
      ) : null}
      {subSheet === 'bindEmail' ? (
        <BindEmailSheet onBound={onAnonChanged} onClose={() => setSubSheet(null)} />
      ) : null}

      <ConfirmDialog
        visible={showUnbindWechat}
        icon={Icon.users(theme.accent, 26)}
        title={t('settings.unbindWechatTitle')}
        message={t('settings.unbindWechatMsg')}
        confirmLabel={t('settings.unbind')}
        confirmColor={theme.accent}
        onConfirm={() => setShowUnbindWechat(false)}
        cancelLabel={t('settings.notNow')}
        onCancel={() => setShowUnbindWechat(false)}
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
   Main Settings Screen
   ══════════════════════════════════════════════════════════ */

export default function Settings({ navigation, route }) {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const insets = useSafeAreaInsets();
  const { kids: dataKids, FAMILY, getKid, kidLabel } = useData();

  // Route params: me and setMe — use local state so UI updates immediately
  const parentSetMe = route?.params?.setMe || (() => {});
  const [me, setMeLocal] = useState(route?.params?.me || DEFAULT_ME);
  const setMe = useCallback((m) => {
    setMeLocal(m);
    parentSetMe(m);
  }, [parentSetMe]);

  // Local state
  const [kids, setKids] = useState(() => dataKids.map(k => ({ ...k })));
  const [editId, setEditId] = useState(null);
  const [sheet, setSheet] = useState(null); // 'add'|'invite'|'remindTime'|'about'|'account'
  const [remindOn, setRemindOn] = useState(true);
  const [remindAt, setRemindAt] = useState('sun evening');
  const [defView, setDefView] = useState('together');
  const [rhythm, setRhythm] = useState('biweekly');
  const [anon, setAnon] = useState(false);

  // 把 'sun evening' 这样的 key 对翻成展示文案
  const formatRemind = (v) => {
    const [d, tm] = (v || 'sun evening').split(' ');
    return t('settings.remindAtFmt', { day: t('settings.day.' + d), time: t('settings.time.' + tm) });
  };
  useEffect(() => { isAnonymous().then(setAnon); }, []);

  const editKid = kids.find(k => k.id === editId);
  const saveKid = (patch) => setKids(ks => ks.map(k => k.id === editId ? { ...k, ...patch } : k));
  const addKid = (k) => setKids(ks => [...ks, { id: 'k' + Date.now(), acc: ['scarf'], ...k }]);

  const onBack = () => {
    if (navigation && navigation.goBack) navigation.goBack();
  };

  // Appearance mode: 'system' | 'light' | 'dark'
  const colorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system');

  const handleThemeMode = useCallback((mode) => {
    setThemeMode(mode);
    if (mode === 'dark') setTheme.setIsDark(true);
    else if (mode === 'light') setTheme.setIsDark(false);
    else setTheme.setIsDark(colorScheme === 'dark');
  }, [colorScheme, setTheme]);

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
            last
          />
        </SettingGroup>

        {/* ── Notifications section ── */}
        <SettingGroup
          label={t('settings.groupReminder')}
          note={t('settings.reminderNote')}
        >
          <SelectRow
            icon={Icon.bell(theme.accent, 20)}
            title={t('settings.remindOnce')}
            options={[
              { key: 'off', label: t('settings.remindOff') },
              { key: 'weekly', label: t('settings.remindWeekly') },
              { key: 'biweekly', label: t('settings.remindBiweekly') },
            ]}
            value={rhythm}
            onSelect={setRhythm}
          />
          <Row
            icon={Icon.seed(theme.accent, 20)}
            title={t('settings.remindTime')}
            value={rhythm === 'off' ? t('settings.remindClosed') : formatRemind(remindAt)}
            onPress={rhythm === 'off' ? undefined : () => setSheet('remindTime')}
            last
          />
        </SettingGroup>

        {/* ── Preservation section ── */}
        <SettingGroup label={t('settings.groupKeep')} note={t('settings.keepNote')}>
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
            last
          />
        </SettingGroup>

        {/* ── Footer ── */}
        <View style={{ alignItems: 'center', marginTop: 34 }}>
          <Text style={{
            fontFamily: theme.fonts.body, fontSize: 12,
            color: theme.inkSoft, opacity: 0.7,
          }}>{t('settings.footerVersion', { name: t('settings.appName'), version: APP_VERSION })}</Text>
        </View>

      </ScrollView>

      {/* ── Sub-sheets ── */}
      {editKid ? (
        <ChildProfileSheet
          kid={editKid}
          onChange={saveKid}
          onClose={() => setEditId(null)}
        />
      ) : null}
      {sheet === 'add' ? (
        <AddChildSheet onAdd={addKid} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'invite' ? (
        <InviteSheet kids={kids} me={me} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'remindTime' ? (
        <ReminderTimeSheet value={remindAt} onChange={setRemindAt} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'about' ? (
        <AboutSheet onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'account' ? (
        <AccountSecuritySheet anon={anon} onAnonChanged={() => isAnonymous().then(setAnon)} onClose={() => setSheet(null)} />
      ) : null}
    </View>
  );
}
