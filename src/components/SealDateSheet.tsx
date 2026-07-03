// SealDateSheet — 给"时间胶囊"这类可封存活动约定一个未来的开启日。
// 主屏给几张"半年/一年/三年后"的约定卡（像一句承诺）+ 一张预览卡；
// 精确年月日折进"自己挑个日子"——点开是一张底部弹窗卡片，里面是三列滚轮（年 / 月 / 日）。
// onConfirm 回传已算好的 { sealUntil, sealLabel }，调用方直接落库。

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { useT } from '../i18n';
import { Icon } from './Icons';
import { LayerHeader, WheelColumn, Sheet } from './common';
import { makeSealDate } from '../data';

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const NOW = new Date();
const CUR_Y = NOW.getFullYear();
const CUR_M = NOW.getMonth() + 1;
const CUR_D = NOW.getDate();

const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m 为 1-based

// 从今天起推 months 个月，落到具体年月日（目标月天数不足则夹到当月最后一天）。
const shiftYMD = (months) => {
  const total = (CUR_M - 1) + months;
  const y = CUR_Y + Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(CUR_D, daysInMonth(y, m)) };
};

// 主屏的"约定"——人话的时间跨度，比挑数字更像许下一个承诺。半年不是整年，统一按"加几个月"算。
const PRESETS = [
  { months: 6, key: 'presetHalfYear' },
  { months: 12, key: 'preset1' },
  { months: 36, key: 'preset3' },
];

const DEFAULT = shiftYMD(12); // 默认"一年后"

// 滚轮几何：奇数可见行、中间为选中行；用共享的 WheelColumn（同「设置 · 免打扰时段」手感）。
// 三列并排，行高/字号比免打扰(44/22)略小，免得挤。
const ITEM_H = 40;
const VISIBLE = 5;
const PAD = ITEM_H * Math.floor(VISIBLE / 2);
const WHEEL_H = ITEM_H * VISIBLE;

// "自己挑个日子"底部弹窗：三列滚轮（年 / 月 / 日）+「选好了」。草稿随打开时的已选值播种，
// 点「选好了」才回传主屏；下滑 / 点遮罩关闭则丢弃。滚轮手势由 Sheet 自带的 GestureHandlerRootView 兜底，
// swipeFromHandleOnly 让竖滑落在滚轮上时是滚动而非关闭弹窗。
function DayPickerSheet({ visible, onClose, initY, initM, initD, onConfirm }: any) {
  const { theme } = useTheme();
  const t = useT();
  const [year, setYear] = useState(initY);
  const [month, setMonth] = useState(initM);
  const [day, setDay] = useState(initD);

  // 每次打开都以主屏当前值为起点。
  useEffect(() => {
    if (visible) { setYear(initY); setMonth(initM); setDay(initD); }
  }, [visible]);

  // 年/月一变，当月天数可能变少（如 31→30、闰二月），把日夹回有效范围。
  useEffect(() => {
    const dim = daysInMonth(year, month);
    if (day > dim) setDay(dim);
  }, [year, month]);

  // WheelColumn 要 [{ value, label }]：年直接展示数字，月/日复用现成的本地化格式。
  const years = Array.from({ length: 26 }, (_, i) => { const y = CUR_Y + i; return { value: y, label: String(y) }; }); // 今年起 26 年（半年后可能仍落在今年）
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: t('onboarding.monthFmt', { v: i + 1 }) }));
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => ({ value: i + 1, label: t('seal.dayFmt', { v: i + 1 }) }));

  const colCap = {
    flex: 1, textAlign: 'center' as const, paddingBottom: 4,
    fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
  };
  const wheelText = { fontSize: 18 }; // 三列并排，字号比免打扰(22)小一点才不挤

  return (
    <Sheet visible={visible} onClose={onClose} title={t('seal.pickOwn')} swipeFromHandleOnly>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text style={colCap}>{t('seal.whichYear')}</Text>
          <Text style={colCap}>{t('seal.whichMonth')}</Text>
          <Text style={colCap}>{t('seal.whichDay')}</Text>
        </View>
        <View style={{ height: WHEEL_H, marginTop: 2 }}>
          {/* 居中选择带：accent 框住中间那行 */}
          <View pointerEvents="none" style={{
            position: 'absolute', left: 0, right: 0, top: PAD, height: ITEM_H,
            borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: theme.accent,
            backgroundColor: theme.paper, borderRadius: 2,
          }} />
          <View style={{ flexDirection: 'row', flex: 1 }}>
            <WheelColumn data={years} value={year} onChange={setYear} itemHeight={ITEM_H} visibleCount={VISIBLE} textStyle={wheelText} />
            <WheelColumn data={months} value={month} onChange={setMonth} itemHeight={ITEM_H} visibleCount={VISIBLE} textStyle={wheelText} />
            <WheelColumn data={days} value={day} onChange={setDay} itemHeight={ITEM_H} visibleCount={VISIBLE} textStyle={wheelText} />
          </View>
        </View>
        <TouchableOpacity
          onPress={() => { onConfirm(year, month, day); onClose(); }}
          activeOpacity={0.7}
          style={{
            marginTop: 18, paddingVertical: 13, borderRadius: 999,
            backgroundColor: theme.accent, alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: '#FFFDF7' }}>
            {t('seal.pickDone')}
          </Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

export default function SealDateSheet({ visible, onClose, onConfirm, title = undefined }: any) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const sheetTitle = title || t('seal.title');
  const fmtYMD = (y, m, d) => t('seal.dateYMD', { y, m, d, mon: MONTHS_EN[m - 1] });
  const [year, setYear] = useState(DEFAULT.y);  // 默认"一年后"
  const [month, setMonth] = useState(DEFAULT.m);
  const [day, setDay] = useState(DEFAULT.d);
  const [pickerOpen, setPickerOpen] = useState(false); // 是否弹出"自己挑个日子"

  // 数值变化时让预览卡轻轻回弹一下，给一点"刚改动"的反馈。
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pulse.setValue(0.95);
    Animated.spring(pulse, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 170 }).start();
  }, [year, month, day]);

  if (!visible) return null;

  const pickPreset = (p) => { const { y, m, d } = shiftYMD(p.months); setYear(y); setMonth(m); setDay(d); };
  const isPreset = (p) => { const { y, m, d } = shiftYMD(p.months); return year === y && month === m && day === d; };
  const custom = !PRESETS.some(isPreset); // 微调过、不落在任何约定卡上

  // 距今多久——给约定一点分量感。
  const totalMonths = (year - CUR_Y) * 12 + (month - CUR_M);
  const away = totalMonths >= 12
    ? t('seal.awayYears', { n: Math.round(totalMonths / 12) })
    : t('seal.awayMonths', { n: Math.max(totalMonths, 1) });

  const confirm = () => {
    onConfirm(makeSealDate(year, month, day));
    onClose && onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title={sheetTitle}
          onBack={onClose}
          right={
            <TouchableOpacity onPress={confirm} activeOpacity={0.7} style={{
              paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: theme.accent,
            }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 14, color: '#FFFDF7' }}>{t('seal.confirm')}</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {t('seal.intro')}
          </Text>

          {/* 约定卡：竖排，每张写明落到哪一天 */}
          <View style={{ marginTop: 16 }}>
            {PRESETS.map(p => {
              const on = isPreset(p);
              const { y, m, d } = shiftYMD(p.months);
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => pickPreset(p)}
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
                    }}>{t('seal.' + p.key)}</Text>
                    <Text style={{
                      marginTop: 3, fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
                    }}>{fmtYMD(y, m, d)}</Text>
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

          {/* 自己挑个日子：点开弹出底部滚轮卡片 */}
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 8 }}
          >
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 13.5, color: custom ? theme.accentInk : theme.inkSoft,
            }}>
              {custom ? t('seal.customPicked', { date: fmtYMD(year, month, day) }) : t('seal.pickOwn')}
            </Text>
            {Icon.chevR(theme.inkSoft, 16)}
          </TouchableOpacity>

          {/* 预览 */}
          <Animated.View style={{ marginTop: 26, transform: [{ scale: pulse }] }}>
            <View style={{ padding: 22, borderRadius: 24, backgroundColor: theme.sand, alignItems: 'center' }}>
              {Icon.lock(theme.accent, 22)}
              <Text style={{
                marginTop: 10, fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink,
              }}>{fmtYMD(year, month, day)}</Text>
              <Text style={{
                marginTop: 5, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.accentInk,
              }}>{away}</Text>
            </View>
          </Animated.View>
        </ScrollView>

        <DayPickerSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          initY={year}
          initM={month}
          initD={day}
          onConfirm={(y: number, m: number, d: number) => { setYear(y); setMonth(m); setDay(d); }}
        />
      </View>
    </Modal>
  );
}
