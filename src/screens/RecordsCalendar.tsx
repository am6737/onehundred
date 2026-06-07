import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { MEMORIES, KIDS, getKid } from '../data';
import { Icon, PhotoSlot } from '../components/Icons';
import { LayerHeader, Chip } from '../components/common';

const REC_WK = ['一', '二', '三', '四', '五', '六', '日'];
const REC_CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const REC_YEAR = 2026;

function parseMem(s) {
  if (!s) return { mo: null, da: null };
  const mo = (s || '').match(/(\d+)\s*月/);
  const da = (s || '').match(/(\d+)\s*日/);
  if (mo && da) return { mo: +mo[1], da: +da[1] };
  const d = new Date(s);
  if (!isNaN(d.getTime())) return { mo: d.getMonth() + 1, da: d.getDate() };
  return { mo: null, da: null };
}

function bookFilter(memories, filter) {
  if (filter === 'everything' || filter === 'all') return memories;
  return memories.filter(m => m.kid === filter);
}

function typeMeta(type) {
  const map = {
    voice: { ic: Icon.mic, txt: '语音' },
    audio: { ic: Icon.mic, txt: '语音' },
    photo: { ic: Icon.camera, txt: '照片' },
    video: { ic: Icon.video, txt: '视频' },
    text: { ic: Icon.pen, txt: '文字' },
  };
  return map[type] || map.text;
}

function memSeq(m) {
  const kidMems = MEMORIES.filter(x => x.kid === m.kid);
  const idx = kidMems.findIndex(x => x.id === m.id);
  return idx + 1;
}

export default function RecordsCalendar({ navigation, route }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const kidId = route?.params?.kidId || 'all';
  const initialMonth = route?.params?.initialMonth;

  const [filter, setFilter] = useState(kidId === 'all' ? 'everything' : kidId);

  const { byMonth, months } = useMemo(() => {
    const bm = {};
    bookFilter(MEMORIES, filter).forEach(m => {
      const { mo, da } = parseMem(m.date);
      if (!mo || !da) return;
      if (!bm[mo]) bm[mo] = {};
      if (!bm[mo][da]) bm[mo][da] = [];
      bm[mo][da].push(m);
    });
    const ms = Object.keys(bm).map(Number).sort((a, b) => a - b);
    return { byMonth: bm, months: ms };
  }, [filter]);

  const latest = months[months.length - 1] || 5;
  const [month, setMonth] = useState(initialMonth || latest);

  const pickDefaultDay = (mo) => {
    const days = Object.keys(byMonth[mo] || {}).map(Number);
    return days.length ? Math.max(...days) : null;
  };
  const [day, setDay] = useState(() => pickDefaultDay(initialMonth || latest));

  useEffect(() => {
    const m = months[months.length - 1] || 5;
    setMonth(m);
    const days = Object.keys(byMonth[m] || {}).map(Number);
    setDay(days.length ? Math.max(...days) : null);
  }, [filter]);

  const minMonth = months[0] || month;
  const maxMonth = months[months.length - 1] || month;

  const changeMonth = (dir) => {
    const next = month + dir;
    if (next < minMonth || next > maxMonth) return;
    setMonth(next);
    setDay(pickDefaultDay(next));
  };

  const first = new Date(REC_YEAR, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(REC_YEAR, month, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];

  const monthMap = byMonth[month] || {};
  const monthDays = Object.keys(monthMap).length;
  const monthCount = (Object.values(monthMap) as any[]).reduce((a: number, list: any) => a + list.length, 0);
  const selected = (day && monthMap[day]) || [];

  const filterOptions = [
    { id: 'everything', label: '全部' },
    ...KIDS.map(k => ({ id: k.id, label: k.name })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <LayerHeader title="记录日历" onBack={() => navigation.goBack()} />
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
              disabled={month <= minMonth}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.cream,
                justifyContent: 'center', alignItems: 'center',
                opacity: month <= minMonth ? 0.3 : 1,
              }}
            >
              {Icon.chevL(theme.ink, 18)}
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink }}>
                {REC_CN_MONTH[month - 1]}月
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft, marginTop: 1 }}>
                {REC_YEAR} 年
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              disabled={month >= maxMonth}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.cream,
                justifyContent: 'center', alignItems: 'center',
                opacity: month >= maxMonth ? 0.3 : 1,
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
              const sel = has && d === day;
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
              记录了 <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink }}>{monthDays} 天</Text>
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
              完成了 <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.accent }}>{monthCount} 件事</Text>
            </Text>
          </View>
        </View>

        {/* Selected day memories */}
        <View style={{ marginTop: 22 }}>
          {day ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 14, marginHorizontal: 2 }}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.ink }}>
                  {month} 月 {day} 日
                </Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
                  这天做了 {selected.length} 件事
                </Text>
              </View>
              {selected.map((m, i) => {
                const t = TONE[m.tone] || TONE.orange;
                const tm = typeMeta(m.type);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => navigation.navigate('Memory', { memory: m })}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', borderRadius: 22, overflow: 'hidden',
                      backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line,
                      marginBottom: 14,
                    }}
                  >
                    <View style={{ width: 92 }}>
                      <PhotoSlot tone={m.tone} radius={0} label="" style={{ height: '100%', minHeight: 110, aspectRatio: undefined }} />
                      <View style={{
                        position: 'absolute', left: 7, bottom: 7,
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
                        backgroundColor: 'rgba(255,253,247,0.92)',
                      }}>
                        {tm.ic(t.deep, 12)}
                        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: t.ink }}>
                          {(m.type === 'voice' || m.type === 'audio' || m.type === 'video') ? m.dur : tm.txt}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, padding: 14, paddingLeft: 15 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
                        <View style={{
                          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                          backgroundColor: t.soft,
                        }}>
                          <Text style={{ fontFamily: theme.fonts.head, fontSize: 11.5, color: t.ink }}>
                            第 {memSeq(m)} 件
                          </Text>
                        </View>
                        {m.place && (
                          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
                            {m.place}
                          </Text>
                        )}
                      </View>
                      <Text numberOfLines={1} style={{
                        fontFamily: theme.fonts.head, fontSize: 16.5, lineHeight: 23, color: theme.ink,
                      }}>{m.title}</Text>
                      <Text numberOfLines={2} style={{
                        marginTop: 5, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 21, color: theme.inkSoft,
                      }}>{m.caption}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <Text style={{
              textAlign: 'center', marginTop: 12,
              fontFamily: theme.fonts.hand, fontSize: 17, color: theme.inkSoft,
            }}>点亮的日子，是你们一起记下的。</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
