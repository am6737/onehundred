// SealDateSheet — 给"时间胶囊"这类可封存活动约定一个未来的开启日（年 + 月）。
// 不再把 25 个年份 + 12 个月份平铺成网格：主屏给几张"几年后"的约定卡（像一句承诺），
// 精确年月折进"自己挑个日子"，展开是上下滚动的双列滚轮（年 / 月），中间高亮带吸附定位。
// onConfirm 回传已算好的 { sealUntil, sealLabel }，调用方直接落库。

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { Icon } from './Icons';
import { LayerHeader } from './common';
import { makeSealDate } from '../data';

const NOW = new Date();
const CUR_Y = NOW.getFullYear();
const CUR_M = NOW.getMonth() + 1;
const CUR_D = NOW.getDate();

const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m 为 1-based

// 主屏的"约定"——人话的时间跨度，比挑数字更像许下一个承诺。
const PRESETS = [
  { n: 1, label: '一年后' },
  { n: 3, label: '三年后' },
  { n: 5, label: '五年后' },
  { n: 10, label: '十年后' },
];

// 滚轮几何：奇数可见行、中间为选中行，上下补白让首尾也能滚到中间。
const ITEM_H = 44;
const VISIBLE = 5;
const PAD = ITEM_H * Math.floor(VISIBLE / 2);
const WHEEL_H = ITEM_H * VISIBLE;

// 单列滚轮：原生 ScrollView + 吸附，松手后取中间那行。
function Wheel({ data, value, onChange, format }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const mounted = useRef(false);
  const idx = Math.max(0, data.indexOf(value));

  // 外部改值（点了约定卡）时滚到对应位置；首次定位交给 onLayout（不带动画，避免从 0 飞过来）。
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
  }, [value]);

  const settle = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const c = Math.min(data.length - 1, Math.max(0, i));
    if (data[c] !== value) onChange(data[c]);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      nestedScrollEnabled
      bounces={false}
      contentContainerStyle={{ paddingVertical: PAD }}
      onLayout={() => ref.current?.scrollTo({ y: idx * ITEM_H, animated: false })}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
    >
      {data.map(d => {
        const on = d === value;
        return (
          <View key={d} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{
              fontFamily: theme.fonts.head,
              fontSize: on ? 21 : 17,
              color: on ? theme.ink : theme.inkSoft,
              opacity: on ? 1 : 0.45,
            }}>{format ? format(d) : d}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export default function SealDateSheet({ visible, onClose, onConfirm, title = '约定一个开启的日子' }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(CUR_Y + 5);  // 默认"五年后的今天"
  const [month, setMonth] = useState(CUR_M);
  const [day, setDay] = useState(CUR_D);
  const [tuning, setTuning] = useState(false);   // 是否展开"自己挑个日子"

  // 数值变化时让预览卡轻轻回弹一下，给一点"刚改动"的反馈。
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pulse.setValue(0.95);
    Animated.spring(pulse, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 170 }).start();
  }, [year, month, day]);

  // 年/月一变，当月天数可能变少（如 31→30、闰二月），把日夹回有效范围。
  useEffect(() => {
    const dim = daysInMonth(year, month);
    if (day > dim) setDay(dim);
  }, [year, month]);

  if (!visible) return null;

  const years = Array.from({ length: 25 }, (_, i) => CUR_Y + 1 + i); // 明年起 25 年
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  const pickPreset = (n) => { setYear(CUR_Y + n); setMonth(CUR_M); setDay(CUR_D); };
  const isPreset = (n) => year === CUR_Y + n && month === CUR_M && day === CUR_D;
  const custom = !PRESETS.some(p => isPreset(p.n)); // 微调过、不落在任何约定卡上

  // 距今多久——给约定一点分量感。
  const totalMonths = (year - CUR_Y) * 12 + (month - CUR_M);
  const away = totalMonths >= 12
    ? `约 ${Math.round(totalMonths / 12)} 年后`
    : `约 ${Math.max(totalMonths, 1)} 个月后`;

  const confirm = () => {
    onConfirm(makeSealDate(year, month, day));
    onClose && onClose();
  };

  const colCap = {
    flex: 1, textAlign: 'center', paddingBottom: 4,
    fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={title}
          onBack={onClose}
          right={
            <TouchableOpacity onPress={confirm} activeOpacity={0.7} style={{
              paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: theme.accent,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: '#FFFDF7' }}>封存</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            选一个未来的日子。在那天到来前，连你自己也打不开它。
          </Text>

          {/* 约定卡：竖排，每张写明落到哪一年 */}
          <View style={{ marginTop: 16 }}>
            {PRESETS.map(p => {
              const on = isPreset(p.n);
              const y = CUR_Y + p.n;
              return (
                <TouchableOpacity
                  key={p.n}
                  onPress={() => pickPreset(p.n)}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, marginTop: 10,
                    backgroundColor: on ? theme.accentSoft : theme.paper,
                    borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: theme.fonts.head, fontSize: 18, color: on ? theme.accentInk : theme.ink,
                    }}>{p.label}</Text>
                    <Text style={{
                      marginTop: 3, fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
                    }}>{y} 年 {CUR_M} 月 {CUR_D} 日</Text>
                  </View>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: on ? theme.accent : 'transparent',
                    borderWidth: on ? 0 : 1.5, borderColor: theme.line,
                  }}>
                    {on && Icon.check('#FFFDF7', 14)}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 自己挑个日子：折叠入口 */}
          <TouchableOpacity
            onPress={() => setTuning(v => !v)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 8 }}
          >
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 13.5, color: custom ? theme.accentInk : theme.inkSoft,
            }}>
              {custom ? `自己挑的日子 · ${year} 年 ${month} 月 ${day} 日` : '自己挑个日子'}
            </Text>
            <View style={{ transform: [{ rotate: tuning ? '180deg' : '0deg' }] }}>
              {Icon.chevDown(theme.inkSoft, 16)}
            </View>
          </TouchableOpacity>

          {tuning && (
            <View style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={colCap}>哪一年</Text>
                <Text style={colCap}>哪个月</Text>
                <Text style={colCap}>哪一天</Text>
              </View>
              <View style={{ height: WHEEL_H, marginTop: 2 }}>
                {/* 居中选择带：accent 框住中间那行 */}
                <View pointerEvents="none" style={{
                  position: 'absolute', left: 0, right: 0, top: PAD, height: ITEM_H,
                  borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: theme.accent,
                  backgroundColor: theme.paper, borderRadius: 2,
                }} />
                <View style={{ flexDirection: 'row', flex: 1 }}>
                  <Wheel data={years} value={year} onChange={setYear} />
                  <Wheel data={months} value={month} onChange={setMonth} format={m => `${m} 月`} />
                  <Wheel data={days} value={day} onChange={setDay} format={d => `${d} 日`} />
                </View>
              </View>
            </View>
          )}

          {/* 预览 */}
          <Animated.View style={{ marginTop: 26, transform: [{ scale: pulse }] }}>
            <View style={{ padding: 22, borderRadius: 24, backgroundColor: theme.sand, alignItems: 'center' }}>
              {Icon.lock(theme.accent, 22)}
              <Text style={{
                marginTop: 10, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
              }}>{year} 年 {month} 月 {day} 日</Text>
              <Text style={{
                marginTop: 5, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.accentInk,
              }}>{away}</Text>
              <Text style={{
                marginTop: 8, fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
              }}>到了那天，它会自己回来找你们</Text>
            </View>
          </Animated.View>

          {/* 仅开发期：快速测试解封 */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={() => {
                onConfirm({ sealUntil: new Date(Date.now() + 60000).toISOString(), sealLabel: '1 分钟后(测试)' });
                onClose && onClose();
              }}
              activeOpacity={0.7}
              style={{ marginTop: 18, alignItems: 'center', paddingVertical: 10 }}
            >
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
                · 测试：1 分钟后解封 ·
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
