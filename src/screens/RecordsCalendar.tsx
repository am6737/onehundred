import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useI18n } from '../i18n';
import { useData } from '../data/DataProvider';
import { isMemoryLocked } from '../data';
import { Icon } from '../components/Icons';
import { MemoryCover } from '../components/MemoryCover';
import { LayerHeader, Chip } from '../components/common';

const REC_WK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const REC_CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const REC_EN_MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseMem(s) {
  if (!s) return { yr: null, mo: null, da: null };
  const mo = (s || '').match(/(\d+)\s*月/);
  const da = (s || '').match(/(\d+)\s*日/);
  if (mo && da) {
    const yrM = (s || '').match(/(\d{4})\s*年/);
    return { yr: yrM ? +yrM[1] : new Date().getFullYear(), mo: +mo[1], da: +da[1] };
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return { yr: d.getFullYear(), mo: d.getMonth() + 1, da: d.getDate() };
  return { yr: null, mo: null, da: null };
}

function bookFilter(memories, filter) {
  if (filter === 'everything' || filter === 'all') return memories;
  return memories.filter(m => m.kid === filter);
}

function typeMeta(type) {
  const map = {
    voice: { ic: Icon.mic, key: 'ownLevels.sugVoice' },
    audio: { ic: Icon.mic, key: 'ownLevels.sugVoice' },
    photo: { ic: Icon.camera, key: 'common.photo' },
    video: { ic: Icon.video, key: 'ownLevels.sugVideo' },
    text: { ic: Icon.pen, key: 'ownLevels.sugText' },
  };
  return map[type] || map.text;
}

function memSeq(m) {
  return parseInt(m.levelNum, 10) || 0;
}

export default function RecordsCalendar({ navigation, route }) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { memories, kids, getKid } = useData();
  const insets = useSafeAreaInsets();
  const REC_WK = REC_WK_KEYS.map(k => t('weekday.' + k));
  const monthHeader = (m) => lang === 'zh' ? `${REC_CN_MONTH[m - 1]}月` : REC_EN_MONTH[m - 1];
  const kidId = route?.params?.kidId || 'all';
  const initialMonth = route?.params?.initialMonth;
  const initialYear = route?.params?.initialYear;

  const [filter, setFilter] = useState(kidId === 'all' ? 'everything' : kidId);

  const { byYear, years, allYM } = useMemo(() => {
    const by: Record<number, Record<number, Record<number, any[]>>> = {};
    bookFilter(memories, filter).forEach(m => {
      const { yr, mo, da } = parseMem(m.date);
      if (!yr || !mo || !da) return;
      if (!by[yr]) by[yr] = {};
      if (!by[yr][mo]) by[yr][mo] = {};
      if (!by[yr][mo][da]) by[yr][mo][da] = [];
      by[yr][mo][da].push(m);
    });
    const ys = Object.keys(by).map(Number).sort((a, b) => a - b);
    const pairs: { y: number; m: number }[] = [];
    for (const y of ys) {
      const ms = Object.keys(by[y]).map(Number).sort((a, b) => a - b);
      for (const m of ms) pairs.push({ y, m });
    }
    return { byYear: by, years: ys, allYM: pairs };
  }, [filter, memories]);

  const latestYM = allYM[allYM.length - 1] || { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
  const [year, setYear] = useState(initialYear || latestYM.y);
  const [month, setMonth] = useState(initialMonth || latestYM.m);

  const pickDefaultDay = (yr: number, mo: number) => {
    const days = Object.keys(byYear[yr]?.[mo] || {}).map(Number);
    return days.length ? Math.max(...days) : null;
  };
  const [day, setDay] = useState(() => pickDefaultDay(initialYear || latestYM.y, initialMonth || latestYM.m));

  useEffect(() => {
    const lym = allYM[allYM.length - 1];
    if (!lym) return;
    setYear(lym.y);
    setMonth(lym.m);
    const days = Object.keys(byYear[lym.y]?.[lym.m] || {}).map(Number);
    setDay(days.length ? Math.max(...days) : null);
  }, [filter]);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const pickerDropY = useSharedValue(-20);
  const pickerOpacity = useSharedValue(0);
  const openPicker = () => {
    pickerDropY.value = -20;
    pickerOpacity.value = 0;
    setPickerYear(year);
    setShowPicker(true);
    pickerDropY.value = withSpring(0, { damping: 20, stiffness: 260 });
    pickerOpacity.value = withTiming(1, { duration: 200 });
  };
  const closePicker = () => {
    pickerDropY.value = withTiming(-12, { duration: 140 });
    pickerOpacity.value = withTiming(0, { duration: 140 }, (fin) => {
      if (fin) runOnJS(setShowPicker)(false);
    });
  };
  const pickerAnimStyle = useAnimatedStyle(() => ({
    opacity: pickerOpacity.value,
    transform: [{ translateY: pickerDropY.value }],
  }));
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: pickerOpacity.value,
  }));

  const curIdx = allYM.findIndex(p => p.y === year && p.m === month);
  const canPrev = curIdx > 0;
  const canNext = curIdx < allYM.length - 1;

  const changeMonth = (dir: number) => {
    const next = curIdx + dir;
    if (next < 0 || next >= allYM.length) return;
    const { y, m } = allYM[next];
    setYear(y);
    setMonth(m);
    setDay(pickDefaultDay(y, m));
  };

  const jumpTo = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    setDay(pickDefaultDay(y, m));
    closePicker();
  };

  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];

  const monthMap = byYear[year]?.[month] || {};
  const activeDay = (day != null && monthMap[day]) ? day : (() => {
    const ds = Object.keys(monthMap).map(Number);
    return ds.length ? Math.max(...ds) : null;
  })();

  useEffect(() => {
    if (activeDay !== day) setDay(activeDay);
  }, [activeDay]);
  const monthDays = Object.keys(monthMap).length;
  const monthCount = (Object.values(monthMap) as any[]).reduce((a: number, list: any) => a + list.length, 0);
  const selected = activeDay != null ? (monthMap[activeDay] || []) : [];

  const filterOptions = [
    { id: 'everything', label: t('records.filterAll') },
    ...kids.map(k => ({ id: k.id, label: k.name })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title={t('records.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {filterOptions.map(opt => (
            <Chip
              key={opt.id}
              label={opt.label}
              active={filter === opt.id}
              onPress={() => setFilter(opt.id)}
            />
          ))}
        </View>

        {/* Calendar card */}
        <View style={{
          borderRadius: 26, backgroundColor: theme.paper,
          borderWidth: 1, borderColor: theme.line,
          padding: 18, paddingBottom: 20,
        }}>
          {/* Month switcher */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              disabled={!canPrev}
              accessibilityRole="button"
              accessibilityLabel={t('common.a11y.prevMonth')}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.cream,
                justifyContent: 'center', alignItems: 'center',
                opacity: canPrev ? 1 : 0.3,
              }}
            >
              {Icon.chevL(theme.ink, 18)}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openPicker}
              activeOpacity={0.7}
              style={{ alignItems: 'center', flexDirection: 'column' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink }}>
                  {monthHeader(month)}
                </Text>
                {Icon.chevDown(theme.inkSoft, 14)}
              </View>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft, marginTop: 1 }}>
                {t('records.yearLabel', { y: year })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              disabled={!canNext}
              accessibilityRole="button"
              accessibilityLabel={t('common.a11y.nextMonth')}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.cream,
                justifyContent: 'center', alignItems: 'center',
                opacity: canNext ? 1 : 0.3,
              }}
            >
              {Icon.chevR(theme.ink, 18)}
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={{ marginTop: 14, flexDirection: 'row' }}>
            {REC_WK.map((w, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.inkSoft, opacity: 0.7 }}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              if (d == null) return <View key={'p' + i} style={{ width: '14.28%', aspectRatio: 1 }} />;
              const list = monthMap[d];
              const has = !!list;
              const sel = has && d === activeDay;
              const tone = has ? TONE[list[0].tone] : null;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => has && setDay(d)}
                  activeOpacity={has ? 0.7 : 1}
                  style={{
                    width: '14.28%', aspectRatio: 1,
                    justifyContent: 'center', alignItems: 'center',
                    padding: 2,
                  }}
                >
                  <View style={{
                    width: '100%', height: '100%',
                    borderRadius: 11, justifyContent: 'center', alignItems: 'center',
                    backgroundColor: sel ? theme.accent : has ? tone.soft : 'transparent',
                    borderWidth: sel ? 0 : has ? 0 : 1,
                    borderColor: theme.line,
                  }}>
                    <Text style={{
                      fontFamily: theme.fonts.body, fontSize: 13,
                      color: sel ? theme.paper : has ? tone.ink : theme.inkSoft,
                      fontWeight: has ? '600' : '400',
                    }}>{d}</Text>
                    {has && list.length > 1 && (
                      <View style={{
                        position: 'absolute', bottom: 4,
                        width: 4, height: 4, borderRadius: 2,
                        backgroundColor: sel ? theme.paper : tone.deep,
                      }} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Month summary */}
          <View style={{
            marginTop: 16, paddingTop: 13,
            borderTopWidth: 1, borderTopColor: theme.line,
            flexDirection: 'row', justifyContent: 'space-between',
          }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
              {t('drawer.recordedPrefix')} <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink }}>{t('common.daysCount', { count: monthDays })}</Text>
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
              {t('drawer.completedPrefix')} <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.accent }}>{t('common.thingsCount', { count: monthCount })}</Text>
            </Text>
          </View>
        </View>

        {/* Selected day memories */}
        <View style={{ marginTop: 22 }}>
          {selected.length > 0 ? (
            [activeDay].map(d => {
              const dayMemories = d != null ? (monthMap[d] || []) : [];
              return (
                <View key={d}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12, marginHorizontal: 2 }}>
                    <Text style={{ fontFamily: theme.fonts.head, fontSize: 17, color: theme.ink }}>
                      {t('records.dayHeader', { m: month, d, mon: REC_EN_MONTH[month - 1] })}
                    </Text>
                    <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
                      {t('common.thingsCount', { count: dayMemories.length })}
                    </Text>
                  </View>
                  {dayMemories.map((m) => {
                    const tn = TONE[m.tone] || TONE.orange;
                    const tm = typeMeta(m.type);
                    const locked = isMemoryLocked(m);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => navigation.navigate('Memory', { memory: m })}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row', borderRadius: 20, overflow: 'hidden',
                          backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line,
                          borderStyle: locked ? 'dashed' : 'solid',
                          marginBottom: 14, height: 100,
                        }}
                      >
                        <View style={{ width: 100 }}>
                          {locked ? (
                            <View style={{
                              width: 100, height: 100, backgroundColor: tn.soft,
                              justifyContent: 'center', alignItems: 'center',
                            }}>
                              {Icon.lock(tn.deep, 26)}
                            </View>
                          ) : (
                            <>
                              <MemoryCover memory={m} style={{ width: 100, height: 100, aspectRatio: undefined }} />
                              <View style={{
                                position: 'absolute', left: 7, bottom: 7,
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
                                backgroundColor: 'rgba(255,253,247,0.92)',
                              }}>
                                {tm.ic(tn.deep, 12)}
                                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: tn.ink }}>
                                  {(m.type === 'voice' || m.type === 'audio' || m.type === 'video') ? m.dur : t(tm.key)}
                                </Text>
                              </View>
                            </>
                          )}
                        </View>
                        <View style={{ flex: 1, padding: 12, paddingLeft: 14, justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <View style={{
                              paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
                              backgroundColor: tn.soft,
                            }}>
                              <Text style={{ fontFamily: theme.fonts.head, fontSize: 11, color: tn.ink }}>
                                {t('records.nthThing', { n: memSeq(m) })}
                              </Text>
                            </View>
                            {m.place && (
                              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.inkSoft }}>
                                {m.place}
                              </Text>
                            )}
                          </View>
                          <Text numberOfLines={1} style={{
                            fontFamily: theme.fonts.head, fontSize: 15, lineHeight: 21, color: theme.ink,
                          }}>{m.title}</Text>
                          <Text numberOfLines={1} style={{
                            marginTop: 3, fontFamily: theme.fonts.body, fontSize: 12.5, lineHeight: 18, color: theme.inkSoft,
                          }}>{locked ? t('records.lockedCaption', { label: m.sealLabel || t('drawer.theAppointedDay') }) : m.caption}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          ) : (
            <Text style={{
              textAlign: 'center', marginTop: 12,
              fontFamily: theme.fonts.hand, fontSize: 17, color: theme.inkSoft,
            }}>{t('records.emptyHint')}</Text>
          )}
        </View>
      </ScrollView>

      {/* Year + month picker */}
      <Modal visible={showPicker} transparent animationType="none" onRequestClose={closePicker}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }, backdropAnimStyle]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="box-none">
          <Pressable>
          <Animated.View style={[{
            width: 300, borderRadius: 22, backgroundColor: theme.paper,
            padding: 20, paddingBottom: 16,
          }, pickerAnimStyle]}>
            {/* Year switcher */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 18 }}>
              <TouchableOpacity
                onPress={() => { const i = years.indexOf(pickerYear); if (i > 0) setPickerYear(years[i - 1]); }}
                disabled={years.indexOf(pickerYear) <= 0}
                accessibilityRole="button"
                accessibilityLabel={t('common.a11y.prevYear')}
                style={{ opacity: years.indexOf(pickerYear) <= 0 ? 0.25 : 1, padding: 4 }}
              >
                {Icon.chevL(theme.ink, 18)}
              </TouchableOpacity>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink, minWidth: 60, textAlign: 'center' as const }}>
                {t('records.yearLabel', { y: pickerYear })}
              </Text>
              <TouchableOpacity
                onPress={() => { const i = years.indexOf(pickerYear); if (i < years.length - 1) setPickerYear(years[i + 1]); }}
                disabled={years.indexOf(pickerYear) >= years.length - 1}
                accessibilityRole="button"
                accessibilityLabel={t('common.a11y.nextYear')}
                style={{ opacity: years.indexOf(pickerYear) >= years.length - 1 ? 0.25 : 1, padding: 4 }}
              >
                {Icon.chevR(theme.ink, 18)}
              </TouchableOpacity>
            </View>
            {/* Month grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const hasData = !!byYear[pickerYear]?.[m];
                const isCur = pickerYear === year && m === month;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => hasData && jumpTo(pickerYear, m)}
                    activeOpacity={hasData ? 0.7 : 1}
                    style={{ width: '33.33%', paddingVertical: 8, alignItems: 'center' }}
                  >
                    <View style={{
                      width: 72, paddingVertical: 10, borderRadius: 14, alignItems: 'center',
                      backgroundColor: isCur ? theme.accent : hasData ? theme.cream : 'transparent',
                    }}>
                      <Text style={{
                        fontFamily: theme.fonts.head, fontSize: 15,
                        color: isCur ? theme.paper : hasData ? theme.ink : theme.inkSoft,
                        opacity: hasData ? 1 : 0.4,
                      }}>
                        {lang === 'zh' ? `${REC_CN_MONTH[m - 1]}月` : REC_EN_MONTH[m - 1].slice(0, 3)}
                      </Text>
                      {hasData && !isCur && (
                        <View style={{
                          marginTop: 4, width: 4, height: 4, borderRadius: 2,
                          backgroundColor: theme.accent,
                        }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
          </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
