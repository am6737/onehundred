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
import { ROLES, DEFAULT_ME, meName, meChar, NOW_YM } from '../data';
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
          我是
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
                const on = meName(me) === o;
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
                    }}>{o}</Text>
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
        }}>{value}</Text>
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
                const on = value === o;
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
                    }}>{o}</Text>
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
          title={`${kid.name}的小档案`}
          onBack={onClose}
          right={
            <TouchableOpacity onPress={save} activeOpacity={0.7} style={{
              paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
              backgroundColor: theme.accent,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: '#FFFDF7' }}>记下</Text>
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
            TA 是哪个月来到你们身边的？年龄会自己长大，你不用每年来改。
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
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>出生年份</Text>
              <Stepper value={y} min={2008} max={NOW.y} onChange={setY} fmt={v => v + ' 年'} />
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>出生月份</Text>
              <Stepper value={m} min={1} max={12} wrap onChange={setM} fmt={v => v + ' 月'} />
            </View>
          </View>

          {/* Age summary */}
          <View style={{
            marginTop: 18, paddingVertical: 20, paddingHorizontal: 18,
            borderRadius: 22, backgroundColor: theme.sand, alignItems: 'center',
          }}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 24, color: theme.ink }}>
              今年 {age} 岁啦
            </Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13.5,
              lineHeight: 23, color: theme.inkSoft, textAlign: 'center',
            }}>
              距离 TA 满 18 岁，还有 {toEighteen} 年{'\n'}那封信，正在等那一天
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
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [y, setY] = useState(2024);
  const [m, setM] = useState(1);
  const [tone, setTone] = useState('pink');
  const age = ageFrom(y, m);
  const canSave = name.trim().length > 0;
  const save = () => { if (!canSave) return; onAdd({ name: name.trim(), y, m, tone }); onClose(); };

  const tones = [['orange', '暖橘'], ['green', '森绿'], ['pink', '藕粉']];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title="再添一个孩子"
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
              }}>记下</Text>
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
            }}>写下名字，就为 TA 开一条回忆线</Text>
          </View>

          {/* Name input */}
          <View style={{ marginTop: 22 }}>
            <Text style={{
              paddingHorizontal: 4, paddingBottom: 8,
              fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
            }}>TA 叫什么</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="写下孩子的名字或小名"
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
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>出生年份</Text>
              <Stepper value={y} min={2008} max={NOW.y} onChange={setY} fmt={v => v + ' 年'} />
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16, paddingHorizontal: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.ink }}>出生月份</Text>
              <Stepper value={m} min={1} max={12} wrap onChange={setM} fmt={v => v + ' 月'} />
            </View>
          </View>

          {/* Tone picker */}
          <View style={{ marginTop: 18 }}>
            <Text style={{
              paddingHorizontal: 4, paddingBottom: 10,
              fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
            }}>给 TA 挑一个主色</Text>
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
              {canSave ? `${name.trim()}，今年 ${age} 岁` : `今年 ${age} 岁`}
            </Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13,
              lineHeight: 23, color: theme.inkSoft,
            }}>记下之后，TA 也会有一条只属于你们俩的回忆线</Text>
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
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const { family } = useData();
  const code = family?.inviteCode || '——';

  const myName = me.role === '其他' ? (me.custom || '我') : me.role;
  const myChar = me.role === '其他' ? (me.custom || '我')[0] : me.role[me.role.length - 1];
  const isParent = me.role === '爸爸' || me.role === '妈妈';
  const adults = (family?.members || []).map(m => {
    const nm = m.role === '其他' ? (m.customRole || '家人') : m.role;
    return {
      ch: nm[nm.length - 1],
      name: nm,
      role: m.isMe ? '你' + (family?.isCreator ? ' · 管理员' : '') : '家长',
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
        <LayerHeader title="家庭成员" onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            这个家现在有 {peopleCount} 个人。被邀请进来的人，才能看见你们的回忆。
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
                name={k.name} role="孩子" last={i === kids.length - 1}
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
            }}>邀请家人一起记</Text>
            <Text style={{
              marginTop: 8, fontFamily: theme.fonts.body, fontSize: 13.5,
              lineHeight: 23, color: theme.inkSoft, textAlign: 'center',
            }}>
              把这串口令发给奶奶、外公或另一半，{'\n'}他们输入后就能加入这个家。
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
              }}>{copied ? '已记下' : '记下邀请码'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{
            textAlign: 'center', marginTop: 20,
            fontFamily: theme.fonts.hand, fontSize: 17,
            color: theme.inkSoft, lineHeight: 30,
          }}>
            · 记得越多的人，回忆越热闹 ·
          </Text>
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
  const insets = useSafeAreaInsets();
  const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const TIMES = ['早上', '中午', '下午', '晚上'];
  const [d0, t0] = (value || '周日 晚上').split(' ');
  const [day, setDay] = useState(DAYS.includes(d0) ? d0 : '周日');
  const [time, setTime] = useState(TIMES.includes(t0) ? t0 : '晚上');
  const save = () => { onChange(`${day} ${time}`); onClose(); };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title="提醒时间"
          onBack={onClose}
          right={
            <TouchableOpacity onPress={save} activeOpacity={0.7} style={{
              paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
              backgroundColor: theme.accent,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: '#FFFDF7' }}>记下</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            挑一个你们都松弛下来的时刻。它只会很轻地招呼一声，不会催你。
          </Text>

          {/* Day picker */}
          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 10,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>哪一天</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {DAYS.map(d => {
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
                  }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time picker */}
          <Text style={{
            marginTop: 24, paddingHorizontal: 4, paddingBottom: 10,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>哪个时段</Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {TIMES.map(tm => {
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
                  }}>{tm}</Text>
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
            }}>{day} {time}</Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
            }}>到了这个时候，轻轻提醒你一次</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   SealedItemsSheet
   ══════════════════════════════════════════════════════════ */

function SealedItemsSheet({ onClose }) {
  const { theme } = useTheme();
  const { levels } = useData();
  const insets = useSafeAreaInsets();
  const sealed = levels.filter(l => l.sealed);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title="封存物" onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          {/* Hero */}
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 999,
              backgroundColor: theme.accent,
              justifyContent: 'center', alignItems: 'center',
              shadowColor: theme.accent, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
            }}>
              {Icon.lock('#FFFDF7', 28)}
            </View>
            <Text style={{
              marginTop: 16, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
            }}>你们封起来的 {sealed.length} 件</Text>
            <Text style={{
              marginTop: 10, fontFamily: theme.fonts.body, fontSize: 14,
              lineHeight: 25, color: theme.inkSoft, textAlign: 'center', maxWidth: 280,
            }}>
              一旦封存，连你自己也打不开。时间到了，它会自己回来找你们。
            </Text>
          </View>

          {/* Sealed items */}
          <View style={{ gap: 14, marginTop: 4 }}>
            {sealed.map(l => (
              <View key={l.num} style={{
                flexDirection: 'row', gap: 13, alignItems: 'flex-start',
                padding: 16, backgroundColor: theme.paper,
                borderWidth: 1.5, borderColor: theme.line,
                borderStyle: 'dashed', borderRadius: 20,
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 999,
                  backgroundColor: theme.accent,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {Icon.lock('#FFFDF7', 18)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{
                    fontFamily: theme.fonts.head, fontSize: 16.5,
                    lineHeight: 24, color: theme.ink,
                  }}>{l.title}</Text>
                  <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {Icon.lock(theme.inkSoft, 13)}
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft }}>
                        {l.sealedOn || '未封存'} 封存
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {Icon.seed(theme.accent, 13)}
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.accent }}>
                        等{l.sealUntil || '约定日期'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Text style={{
            textAlign: 'center', marginTop: 26,
            fontFamily: theme.fonts.hand, fontSize: 17,
            color: theme.inkSoft, lineHeight: 30,
          }}>
            · 有些话，要等很久才舍得听 ·
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   PrivacySheet
   ══════════════════════════════════════════════════════════ */

function PrivacySheet({ value, onChange, onClose }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const OPTIONS = [
    { k: '只有家人', iconFn: Icon.users, sub: '被邀请进这个家的人，才能看见这些回忆。' },
    { k: '仅我自己', iconFn: Icon.lock, sub: '回忆只留在你这里，连家人也看不到。' },
    { k: '家人 + 亲友', iconFn: Icon.eye, sub: '你额外邀请的亲友，也能一起看。' },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title="谁能看到" onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4, marginBottom: 18,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            这些回忆很私密。你来决定，它们对谁敞开。
          </Text>

          <View style={{ gap: 12 }}>
            {OPTIONS.map(o => {
              const on = value === o.k;
              return (
                <TouchableOpacity
                  key={o.k}
                  onPress={() => onChange(o.k)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
                    paddingVertical: 17, paddingHorizontal: 17, borderRadius: 20,
                    backgroundColor: theme.paper,
                    borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                    ...(on ? {
                      shadowColor: theme.accent, shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.3, shadowRadius: 24, elevation: 4,
                    } : {}),
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 13,
                    backgroundColor: on ? theme.accent : theme.sand,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    {o.iconFn(on ? '#FFFDF7' : theme.ink, 20)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: theme.fonts.head, fontSize: 16.5, color: theme.ink }}>{o.k}</Text>
                    <Text style={{
                      marginTop: 3, fontFamily: theme.fonts.body, fontSize: 13,
                      lineHeight: 21, color: theme.inkSoft,
                    }}>{o.sub}</Text>
                  </View>
                  <View style={{
                    width: 22, height: 22, borderRadius: 999, marginTop: 2,
                    borderWidth: 2, borderColor: on ? theme.accent : theme.line,
                    backgroundColor: on ? theme.accent : 'transparent',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    {on ? Icon.check('#FFFDF7', 14) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ marginTop: 22, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={{
                paddingVertical: 14, paddingHorizontal: 40, borderRadius: 999,
                backgroundColor: theme.accent,
                shadowColor: theme.accent, shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3, shadowRadius: 24, elevation: 4,
              }}
            >
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7' }}>就这样</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   DocSheet — terms / privacy policy
   ══════════════════════════════════════════════════════════ */

const APP_NAME = '一百件事';
const APP_VERSION = '1.0.0';
const APP_BUILD = '1';
const APP_EMAIL = 'hi@yibaijianshi.app';

const DOCS = {
  terms: {
    title: '用户协议', updated: '2026 年 6 月',
    body: [
      ['关于这份约定', '欢迎使用「一百件事」。它是一款陪你和孩子一起，把值得做的小事一件件做完的应用。打开并使用它，就表示你认可这份约定。'],
      ['你的内容，归你', '你记录的文字、照片与语音，所有权始终是你的。我们只是帮你把它们好好收着、好好排版，不会拿去做别的。'],
      ['请温柔地使用', '请不要上传违法或侵犯他人的内容。账号由你自己保管，因转借或泄露造成的后果需要你自己承担。'],
      ['服务会慢慢长大', '我们可能会新增、调整或下线某些功能。涉及你权益的重要变化，我们会提前在应用内告诉你。'],
      ['找到我们', `对这份约定有疑问，随时写信到 ${APP_EMAIL}。`],
    ],
  },
  privacy: {
    title: '隐私政策', updated: '2026 年 6 月',
    body: [
      ['我们收集什么', '只收集让应用正常运转所必需的：你填写的家庭成员信息，以及你主动记录的回忆内容。'],
      ['怎么使用这些信息', '用来为你呈现回忆册、生成纸质书排版、按你设置的节奏温柔提醒。仅此而已，绝不售卖。'],
      ['谁能看到', '默认只有你和你邀请的家人能看到这些回忆。你可以在「设置 · 谁能看到这些回忆」里随时调整。'],
      ['你说了算', '你可以随时导出或删除你的内容。删除后，我们会在合理期限内从服务器一并清除。'],
      ['找到我们', `关于隐私的任何问题，欢迎写信到 ${APP_EMAIL}。`],
    ],
  },
};

function DocSheet({ kind, onClose }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const d = DOCS[kind];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title={d.title} onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, letterSpacing: 0.3,
          }}>最近更新 · {d.updated}</Text>
          {d.body.map(([h, p], i) => (
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
        <LayerHeader title="关于" onBack={onClose} />
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
              }}>百</Text>
            </View>
            <Text style={{
              marginTop: 15, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
            }}>{APP_NAME}</Text>
            <Text style={{
              marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.inkSoft,
            }}>版本 {APP_VERSION}（build {APP_BUILD}）</Text>
          </View>

          {/* Tagline */}
          <Text style={{
            marginTop: 18, textAlign: 'center',
            fontFamily: theme.fonts.hand, fontSize: 18,
            lineHeight: 35, color: theme.inkSoft,
          }}>
            和孩子一起，把一百件值得做的事，{'\n'}一件一件，慢慢做完。
          </Text>

          {/* Action rows */}
          <View style={{
            marginTop: 24, backgroundColor: theme.paper,
            borderWidth: 1, borderColor: theme.line, borderRadius: 22, overflow: 'hidden',
          }}>
            <Row
              icon={Icon.download(theme.accent, 19)}
              title="检查更新"
              value={checking ? '检查中...' : '已是最新'}
              onPress={checkUpdate}
            />
            <Row
              icon={Icon.book(theme.accent, 19)}
              title="用户协议"
              onPress={() => setDoc('terms')}
            />
            <Row
              icon={Icon.eye(theme.accent, 19)}
              title="隐私政策"
              onPress={() => setDoc('privacy')}
            />
            <Row
              icon={Icon.users(theme.accent, 19)}
              title="联系我们"
              sub={APP_EMAIL}
              value={copied ? '已复制' : '复制'}
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
            © 2026 {APP_NAME}{'\n'}用心做给每一个家
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
          title={anon ? '绑定手机号' : '更换手机号'}
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
              }}>换好了</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            换号之后，下次就用新号码登录。你们记下的回忆，一件都不会少。
          </Text>

          {/* Current number */}
          {!anon ? (
            <View style={{
              marginTop: 22, flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 15, paddingHorizontal: 18,
              backgroundColor: theme.sand, borderRadius: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.inkSoft }}>当前号码</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.ink }}>138 **** 6688</Text>
            </View>
          ) : null}

          {/* New phone */}
          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>新的手机号</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="输入新的手机号"
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
          }}>验证码</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6 位验证码"
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
              }}>{countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>
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
  const insets = useSafeAreaInsets();
  const CONFIRM_TEXT = '清除所有回忆';
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
      Alert.alert('注销没成功', '账号还没注销掉，请检查网络后再试一次。');
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title="注销账户" onBack={onClose} />
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
              }}>这是不可恢复的</Text>
            </View>
            <Text style={{
              marginTop: 14, fontFamily: theme.fonts.body, fontSize: 14.5,
              lineHeight: 26, color: theme.ink,
            }}>
              你们记下的所有回忆——照片、录音、那些话——都会被永久清除，没有办法再找回来。请确认你真的想好了。
            </Text>
          </View>

          {/* Confirmation input */}
          <View style={{ marginTop: 24 }}>
            <Text style={{
              paddingHorizontal: 4, paddingBottom: 10,
              fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.inkSoft,
            }}>
              请输入 <Text style={{ fontFamily: theme.fonts.head, color: '#C0616B' }}>"{CONFIRM_TEXT}"</Text> 以确认
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
            }}>我明白注销后，这些回忆将永远消失，无法找回。</Text>
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
              }}>永久注销账户</Text>
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
      Alert.alert('绑定失败', e.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title="绑定邮箱"
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
              }}>{loading ? '绑定中...' : '绑定'}</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            绑定邮箱后，你可以用邮箱和密码登录，回忆不会丢失。
          </Text>

          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>邮箱</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="请输入邮箱"
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
          }}>密码</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="设置密码（至少 6 位）"
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
  const insets = useSafeAreaInsets();
  const [subSheet, setSubSheet] = useState(null); // 'changePhone' | 'deleteAccount' | 'bindEmail'
  const [showLogout, setShowLogout] = useState(false);
  const [showUnbindWechat, setShowUnbindWechat] = useState(false);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader title="账户与安全" onBack={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {anon
              ? '你目前是游客身份。绑定手机号或邮箱后，回忆就不会丢失。'
              : '这些只关乎你怎么登进这个家。回忆和家人，都在前面那几栏里。'}
          </Text>

          {/* Login methods */}
          <SettingGroup label="登录方式">
            <Row
              icon={Icon.phone(theme.accent, 19)}
              title="手机号"
              value={anon ? '未绑定' : '138 **** 6688'}
              onPress={() => setSubSheet('changePhone')}
            />
            <Row
              icon={Icon.users(theme.accent, 19)}
              title="微信"
              value={anon ? '未绑定' : '已绑定'}
              onPress={anon ? undefined : () => setShowUnbindWechat(true)}
              last={anon ? false : true}
            />
            {anon ? (
              <Row
                icon={Icon.mail(theme.accent, 19)}
                title="邮箱"
                value="未绑定"
                onPress={() => setSubSheet('bindEmail')}
                last
              />
            ) : null}
          </SettingGroup>

          {/* Login status */}
          <SettingGroup label="登录状态" note="退出后回忆会好好留着，下次用同一个账号登录就能再见到。">
            <Row
              icon={Icon.logout(theme.accent, 19)}
              title="退出登录"
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
                }}>注销账户</Text>
                {Icon.chevR(theme.inkSoft, 18)}
              </TouchableOpacity>
            </View>
            <Text style={{
              paddingTop: 10, paddingHorizontal: 8,
              fontFamily: theme.fonts.body, fontSize: 12.5,
              lineHeight: 21, color: theme.inkSoft,
            }}>注销是永久的：所有回忆、照片与录音都会被清除，且无法找回。</Text>
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
        title="解除微信绑定？"
        message={'解绑后就不能用微信快速登录了，\n你随时可以再绑回来。'}
        confirmLabel="解除绑定"
        confirmColor={theme.accent}
        onConfirm={() => setShowUnbindWechat(false)}
        cancelLabel="先不了"
        onCancel={() => setShowUnbindWechat(false)}
      />

      <ConfirmDialog
        visible={showLogout}
        icon={Icon.logout(theme.accent, 26)}
        title="要先退出吗？"
        message={'你们记下的一切都会好好留着，\n下次用同一个账号登录就能再见到。'}
        confirmLabel="退出登录"
        confirmColor={theme.accent}
        onConfirm={async () => {
          setShowLogout(false);
          await signOut();
        }}
        cancelLabel="再想想"
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
  const insets = useSafeAreaInsets();
  const { kids: dataKids, levels, memories, FAMILY, getKid, kidLabel } = useData();

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
  const [sheet, setSheet] = useState(null); // 'add'|'invite'|'remindTime'|'sealed'|'privacy'|'about'|'account'
  const [remindOn, setRemindOn] = useState(true);
  const [remindAt, setRemindAt] = useState('周日 晚上');
  const [privacy, setPrivacy] = useState('只有家人');
  const [defView, setDefView] = useState('一起');
  const [rhythm, setRhythm] = useState('每两周');
  const [anon, setAnon] = useState(false);
  useEffect(() => { isAnonymous().then(setAnon); }, []);

  const editKid = kids.find(k => k.id === editId);
  const sealedCount = levels.filter(l => l.sealed).length;
  const saveKid = (patch) => setKids(ks => ks.map(k => k.id === editId ? { ...k, ...patch } : k));
  const addKid = (k) => setKids(ks => [...ks, { id: 'k' + Date.now(), acc: ['scarf'], ...k }]);

  const onBack = () => {
    if (navigation && navigation.goBack) navigation.goBack();
  };

  // Appearance mode: '系统' | '浅色' | '深色'
  const colorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('系统');

  const handleThemeMode = useCallback((mode) => {
    setThemeMode(mode);
    if (mode === '深色') setTheme.setIsDark(true);
    else if (mode === '浅色') setTheme.setIsDark(false);
    else setTheme.setIsDark(colorScheme === 'dark');
  }, [colorScheme, setTheme]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title="设置" onBack={onBack} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity section: who is using the app ── */}
        <SettingGroup label="我">
          <IdentityRow
            me={me}
            options={ROLES}
            onSelect={(o) => setMe({ role: o, custom: '' })}
          />
        </SettingGroup>

        {/* ── Account section ── */}
        <SettingGroup label="账户">
          <Row
            icon={Icon.shieldCheck(theme.accent, 20)}
            title="账户与安全"
            value={anon ? '游客' : undefined}
            onPress={() => setSheet('account')}
            last
          />
        </SettingGroup>

        {/* ── Children section ── */}
        <SettingGroup label="孩子们" note="每多一个孩子，就多一条只属于你们俩的回忆线。">
          {kids.map(k => (
            <Row
              key={k.id}
              icon={<KidAvatar name={k.name} tone={k.tone} size={32} />}
              title={k.name}
              value={`${ageFrom(k.y, k.m)} 岁`}
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
            title="再添一个孩子"
            onPress={() => setSheet('add')}
            last
          />
        </SettingGroup>

        {/* ── Family section ── */}
        <SettingGroup label="家庭">
          <Row
            icon={Icon.users(theme.accent, 20)}
            title="家庭成员"
            value="邀请家人"
            onPress={() => setSheet('invite')}
          />
          <SelectRow
            icon={Icon.eye(theme.accent, 20)}
            title="默认从谁的视角开始"
            options={['为你', '为我', '一起']}
            value={defView}
            onSelect={setDefView}
            last
          />
        </SettingGroup>

        {/* ── Notifications section ── */}
        <SettingGroup
          label="提醒"
          note="我们不催你。这些事没有截止日，想做的时候它们都在。提醒只是一声很轻的招呼。"
        >
          <SelectRow
            icon={Icon.bell(theme.accent, 20)}
            title="轻轻提醒一次"
            options={['不提醒', '每周', '每两周']}
            value={rhythm}
            onSelect={setRhythm}
          />
          <Row
            icon={Icon.seed(theme.accent, 20)}
            title="提醒时间"
            value={rhythm === '不提醒' ? '已关' : remindAt}
            onPress={rhythm === '不提醒' ? undefined : () => setSheet('remindTime')}
            last
          />
        </SettingGroup>

        {/* ── Sealed & Privacy section ── */}
        <SettingGroup
          label="封存与隐私"
          note="被封存的信和时间胶囊，在约定的日子到来前，连你自己也打不开——这是它珍贵的原因。"
        >
          <Row
            icon={Icon.lock(theme.accent, 19)}
            title="封存物"
            value={`${sealedCount} 件待开启`}
            onPress={() => setSheet('sealed')}
          />
          <Row
            icon={Icon.eye(theme.accent, 20)}
            title="谁能看到这些回忆"
            value={privacy}
            onPress={() => setSheet('privacy')}
            last
          />
        </SettingGroup>

        {/* ── Preservation section ── */}
        <SettingGroup label="留存" note="它们太重要了，不该只活在一部手机里。">
          <Row
            icon={Icon.book(theme.accent, 20)}
            title="导出成一本纸质书"
            value="去看看"
            onPress={() => navigation.navigate('Photobook')}
            last
          />
        </SettingGroup>

        {/* ── Appearance section ── */}
        <SettingGroup label="外观">
          <SelectRow
            title="明暗"
            options={['系统', '浅色', '深色']}
            value={themeMode}
            onSelect={handleThemeMode}
            last
          />
        </SettingGroup>

        {/* ── About section ── */}
        <SettingGroup label="关于">
          <Row
            icon={Icon.info(theme.accent, 20)}
            title="关于一百件事"
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
          }}>{APP_NAME} · 版本 {APP_VERSION}</Text>
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
      {sheet === 'sealed' ? (
        <SealedItemsSheet onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'privacy' ? (
        <PrivacySheet value={privacy} onChange={setPrivacy} onClose={() => setSheet(null)} />
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
