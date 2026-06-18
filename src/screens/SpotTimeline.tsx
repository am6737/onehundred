import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { useData } from '../data/DataProvider';
import { yearFromDate, monthFromDate, dayFromDate, kidAgeAtYear, MONTH_EN, formatTime } from '../data';
import { Icon } from '../components/Icons';
import { MemoryCover } from '../components/MemoryCover';
import { LayerHeader } from '../components/common';

export default function LevelTimeline({ route, navigation }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { memoriesForLevel, allLevels, kids, getKid } = useData();

  const { levelNum, kidId } = route.params || {};
  const level = allLevels().find(l => l.num === levelNum);
  const kid = kidId && kidId !== 'all' ? getKid(kidId) : null;
  const tn = TONE[level?.tone] || TONE.orange;

  const levelMemories = memoriesForLevel(levelNum);
  const total = levelMemories.length;

  const yearsRecorded = useMemo(() => {
    const years = new Set(levelMemories.map(m => yearFromDate(m.date)).filter(Boolean));
    return years.size;
  }, [levelMemories]);

  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (memId: string) => {
    setSelected(prev => {
      if (prev.includes(memId)) return prev.filter(id => id !== memId);
      if (prev.length >= 2) return prev;
      return [...prev, memId];
    });
  };

  const exitCompare = () => {
    setCompareMode(false);
    setSelected([]);
  };

  const goCompare = () => {
    const mem1 = levelMemories.find(m => m.id === selected[0]);
    const mem2 = levelMemories.find(m => m.id === selected[1]);
    if (mem1 && mem2) {
      navigation.navigate('SpotCompare', { memories: [mem1, mem2], level, kidId: route.params?.kidId });
      exitCompare();
    }
  };

  const ageTags = (year: number) => {
    return kids.map(kid => {
      const age = kidAgeAtYear(kid, year);
      if (age === null) return null;
      return t('spotTimeline.age', { name: kid.name, age });
    }).filter(Boolean);
  };

  const headerRight = compareMode ? (
    <TouchableOpacity onPress={exitCompare} activeOpacity={0.7}
      style={[styles.headerBtn, { backgroundColor: theme.paper, borderColor: theme.line }]}>
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: theme.accent }}>{t('common.cancel')}</Text>
    </TouchableOpacity>
  ) : total >= 2 ? (
    <TouchableOpacity onPress={() => { setCompareMode(true); setSelected([]); }} activeOpacity={0.7}
      style={[styles.headerBtn, { backgroundColor: theme.paper, borderColor: theme.line, flexDirection: 'row', gap: 4, paddingHorizontal: 12 }]}>
      {Icon.eye(theme.accent, 16)}
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: theme.accent }}>{t('memory.seeChange')}</Text>
    </TouchableOpacity>
  ) : null;

  const renderItem = ({ item: m, index }) => {
    const isLast = index === levelMemories.length - 1;
    const year = yearFromDate(m.date);
    const prevYear = index > 0 ? yearFromDate(levelMemories[index - 1].date) : null;
    const showYear = year !== prevYear;
    const isSelected = selected.includes(m.id);
    const selectIndex = selected.indexOf(m.id);
    const tags = year ? ageTags(year) : [];
    const seq = levelMemories.length - index;

    return (
      <View style={{ position: 'relative', paddingLeft: 34, paddingBottom: 22 }}>
        <View style={{
          position: 'absolute', left: 8, top: 9, bottom: isLast ? 9 : 0, width: 2,
          backgroundColor: theme.line, opacity: 0.7,
        }} />
        <View style={{
          position: 'absolute', left: 0, top: 5,
          width: 18, height: 18, borderRadius: 9,
          backgroundColor: theme.cream,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <View style={{
            width: 11, height: 11, borderRadius: 5.5,
            backgroundColor: tn.deep,
            shadowColor: tn.soft, shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1, shadowRadius: 3, elevation: 2,
          }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          {showYear && year ? (
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink }}>
              {year}
            </Text>
          ) : null}
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
            第 {seq} 次 · {m.date}{formatTime(m.createdAt) ? ` ${formatTime(m.createdAt)}` : ''}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={compareMode ? 0.85 : 0.8}
          onPress={() => {
            if (compareMode) toggleSelect(m.id);
            else navigation.navigate('Memory', { memory: m });
          }}
          style={[styles.photoCard, {
            backgroundColor: theme.paper,
            borderColor: isSelected ? (selectIndex === 0 ? theme.accent : '#5B8DEF') : theme.line,
            borderWidth: isSelected ? 2.5 : 1,
          }]}
        >
          <MemoryCover memory={m} videoFrame
            style={{ width: '100%', height: undefined, aspectRatio: 4 / 3 }}
            radius={16} />

          <View style={styles.yearOverlay}>
            {year ? (
              <Text style={[styles.yearLabel, { fontFamily: theme.fonts.head }]}>
                {year}
              </Text>
            ) : null}
            {tags.length > 0 && (
              <Text style={[styles.ageLabel, { fontFamily: theme.fonts.body }]}>
                {tags.join(' · ')}
              </Text>
            )}
          </View>

          {compareMode && isSelected && (
            <View style={[styles.selectBadge, { backgroundColor: selectIndex === 0 ? theme.accent : '#5B8DEF' }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: '#FFFDF7' }}>
                {selectIndex + 1}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {!!m.caption && (
          <Text style={{ fontFamily: theme.fonts.hand || theme.fonts.body, fontSize: 14, color: theme.inkSoft, marginTop: 10, lineHeight: 22 }}>
            {m.caption}
          </Text>
        )}
        {!!m.place && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            {Icon.pin(theme.inkSoft, 12)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft }}>
              {m.place}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <View style={{ paddingBottom: 8 }}>
      {/* Kid + source tags */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {kid && (
          <View style={[styles.tag, { backgroundColor: tn.soft }]}>
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 12.5, color: tn.ink }}>{kid.name}</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 54, lineHeight: 54, color: theme.accent }}>
            {total}
          </Text>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink }}>
            次
          </Text>
        </View>
        {yearsRecorded > 1 && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft }}>
            {t('spotTimeline.statsYears', { count: yearsRecorded })}
          </Text>
        )}
      </View>

      {/* Level title */}
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink, marginBottom: 16 }}>
        {level?.title}
      </Text>

      {compareMode && (
        <View style={[styles.selectBar, { backgroundColor: theme.paper, borderColor: theme.line }]}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.ink }}>
            {t('spotTimeline.selectHint', { count: selected.length })}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader title={t('memory.menuSeeAll')} onBack={() => compareMode ? exitCompare() : navigation.goBack()} right={headerRight} />

      <FlatList
        data={levelMemories}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      />

      {compareMode && selected.length === 2 && (() => {
        const sel1 = levelMemories.find(m => m.id === selected[0]);
        const sel2 = levelMemories.find(m => m.id === selected[1]);
        const ca1 = sel1?.createdAt || sel1?.date || '';
        const ca2 = sel2?.createdAt || sel2?.date || '';
        const [early, late] = ca1 > ca2 ? [sel2, sel1] : [sel1, sel2];
        const dEarly = early?.date || '';
        const dLate = late?.date || '';
        const y1 = yearFromDate(dEarly) || 0;
        const y2 = yearFromDate(dLate) || 0;
        const m1 = monthFromDate(dEarly);
        const m2 = monthFromDate(dLate);
        const dd1 = dayFromDate(dEarly);
        const dd2 = dayFromDate(dLate);
        const sy = y1 === y2;
        const sm = sy && m1 === m2;
        const sd = sm && dd1 === dd2;
        const mkLabel = (y, m, d, createdAt) => {
          if (sd && m && d)
            return t('spotCompare.labelMonthDayTime', { m, d, monthName: MONTH_EN[m], time: formatTime(createdAt) });
          if (sm && m && d)
            return t('spotCompare.labelMonthDay', { m, d, monthName: MONTH_EN[m] });
          if (sy && m)
            return t('spotCompare.labelMonth', { m, monthName: MONTH_EN[m] });
          return String(y || '');
        };
        const a = new Date(early?.createdAt || dEarly);
        const b = new Date(late?.createdAt || dLate);
        let gap = '';
        if (!isNaN(a.getTime()) && !isNaN(b.getTime())) {
          const diffMs = b.getTime() - a.getTime();
          const diffMinutes = Math.round(diffMs / 60000);
          const diffHours = Math.floor(diffMinutes / 60);
          const diffDays = Math.round(diffMs / 86400000);
          if (diffMinutes < 1) {
            // essentially same moment
          } else if (diffMinutes < 60) {
            gap = t('spotCompare.apartMinutes', { count: diffMinutes });
          } else if (diffHours < 24) {
            gap = t('spotCompare.apartHours', { count: diffHours });
          } else if (diffDays < 30) {
            gap = t('spotCompare.apartDays', { count: diffDays });
          } else {
            const diffMonths = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
            if (diffMonths < 1) {
              gap = t('spotCompare.apartDays', { count: diffDays });
            } else if (diffMonths < 12) {
              gap = t('spotCompare.apartMonths', { count: diffMonths });
            } else {
              const diffYears = Math.floor(diffMonths / 12);
              const rem = diffMonths % 12;
              gap = rem === 0
                ? t('spotCompare.apartYears', { count: diffYears })
                : t('spotCompare.apartYearsMonths', { years: diffYears, months: rem });
            }
          }
        }
        return (
          <View style={[styles.compareCta, { backgroundColor: theme.cream, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity onPress={goCompare} activeOpacity={0.85}
              style={[styles.compareBtn, { backgroundColor: theme.accent }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7' }}>
                {t('spotTimeline.compareCta', { label1: mkLabel(y1, m1, dd1, early?.createdAt), label2: mkLabel(y2, m2, dd2, late?.createdAt), gap })}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 22, paddingTop: 6 },
  headerBtn: {
    height: 38, borderRadius: 19, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10,
  },
  tag: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  selectBar: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 18, alignItems: 'center',
  },
  photoCard: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14, shadowRadius: 10, elevation: 3,
  },
  yearOverlay: {
    position: 'absolute', bottom: 10, left: 12,
  },
  yearLabel: {
    fontSize: 28, color: '#FFFDF7',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  ageLabel: {
    fontSize: 12, color: 'rgba(255,253,247,0.85)',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4,
  },
  shotBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  selectBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  compareCta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 22, paddingTop: 12,
  },
  compareBtn: {
    paddingVertical: 16, borderRadius: 999, alignItems: 'center',
    shadowColor: '#DE8C57', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 13, elevation: 4,
  },
});
