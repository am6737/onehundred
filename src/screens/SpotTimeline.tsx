import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { useData } from '../data/DataProvider';
import { yearFromDate, kidAgeAtYear, NOW_YM } from '../data';
import { Icon } from '../components/Icons';
import { MemoryCover } from '../components/MemoryCover';
import { LayerHeader, PrimaryButton } from '../components/common';

const { width: SCREEN_W } = Dimensions.get('window');

export default function SpotTimeline({ route, navigation }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { customLevels, memoriesForLevel, kids, getKid, removeCustomLevel } = useData();

  const { level: initLevel } = route.params || {};
  const level = customLevels.find(l => l.id === initLevel?.id) || initLevel;
  const tn = TONE[level?.tone] || TONE.orange;

  const levelMemories = memoriesForLevel(level?.num);

  const grouped = useMemo(() => {
    const map: Record<number, any[]> = {};
    levelMemories.forEach(m => {
      const y = yearFromDate(m.date);
      if (y) (map[y] ||= []).push(m);
    });
    return Object.entries(map)
      .map(([y, mems]) => ({ year: parseInt(y, 10), memories: mems }))
      .sort((a, b) => b.year - a.year);
  }, [levelMemories]);

  const yearsRecorded = grouped.length;
  const totalPhotos = levelMemories.length;
  const currentYear = NOW_YM.y;
  const hasCurrentYear = grouped.some(g => g.year === currentYear);
  const lastYearMemory = levelMemories[0];

  // Compare selection mode
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (memId: string) => {
    setSelected(prev => {
      if (prev.includes(memId)) return prev.filter(id => id !== memId);
      if (prev.length >= 2) return prev;
      return [...prev, memId];
    });
  };

  const enterCompare = () => {
    setCompareMode(true);
    setSelected([]);
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

  const goRecord = () => {
    const me = route.params?.me;
    const kidId = route.params?.kidId || (kids.length > 0 ? kids[0].id : 'all');
    navigation.navigate('Record', { level, kidId, me });
  };

  const goEdit = () => {
    navigation.navigate('AddOwnLevel', { level });
  };

  const confirmDelete = () => {
    Alert.alert(
      t('ownLevels.deleteTitle'),
      t('ownLevels.deleteBody', { title: level.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCustomLevel(level.id, level.illustrationPath);
              navigation.goBack();
            } catch {
              Alert.alert(t('ownLevels.deleteFailTitle'), t('ownLevels.deleteFailBody'));
            }
          },
        },
      ],
    );
  };

  const showMenu = () => {
    Alert.alert('', '', [
      { text: t('spotTimeline.editLevel'), onPress: goEdit },
      { text: t('spotTimeline.deleteLevel'), style: 'destructive', onPress: confirmDelete },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // Header right: compare button + ... menu
  const headerRight = compareMode ? (
    <TouchableOpacity onPress={exitCompare} activeOpacity={0.7}
      style={[styles.headerBtn, { backgroundColor: theme.paper, borderColor: theme.line }]}>
      <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: theme.accent }}>{t('spotTimeline.cancel')}</Text>
    </TouchableOpacity>
  ) : (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {totalPhotos >= 2 && (
        <TouchableOpacity onPress={enterCompare} activeOpacity={0.7}
          style={[styles.headerBtn, { backgroundColor: theme.paper, borderColor: theme.line, flexDirection: 'row', gap: 4, paddingHorizontal: 12 }]}>
          {Icon.eye(theme.accent, 16)}
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: theme.accent }}>{t('spotTimeline.compare')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={showMenu} activeOpacity={0.7}
        style={[styles.headerBtn, { backgroundColor: theme.paper, borderColor: theme.line }]}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.ink, marginTop: -2 }}>···</Text>
      </TouchableOpacity>
    </View>
  );

  // Kid age tags for a given year
  const ageTags = (year: number) => {
    return kids.map(kid => {
      const age = kidAgeAtYear(kid, year);
      if (age === null) return null;
      return t('spotTimeline.age', { name: kid.name, age });
    }).filter(Boolean);
  };

  const renderYearGroup = ({ item: group, index }) => {
    const isLast = index === grouped.length - 1;
    const mainMemory = group.memories[0];
    const isSelected = selected.includes(mainMemory.id);
    const selectIndex = selected.indexOf(mainMemory.id);
    const tags = ageTags(group.year);

    return (
      <View style={{ position: 'relative', paddingLeft: 34, paddingBottom: 22 }}>
        {/* Vertical timeline line */}
        <View style={{
          position: 'absolute', left: 8, top: 9, bottom: isLast ? 9 : 0, width: 2,
          backgroundColor: theme.line, opacity: 0.7,
        }} />

        {/* Timeline node dot */}
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

        {/* Year header */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 22, color: theme.ink }}>
            {group.year}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft }}>
            {t('spotTimeline.photoCount', { count: group.memories.length })} · {mainMemory.date}
          </Text>
        </View>

        {/* Photo card */}
        <TouchableOpacity
          activeOpacity={compareMode ? 0.85 : 0.8}
          onPress={() => {
            if (compareMode) {
              toggleSelect(mainMemory.id);
            } else {
              navigation.navigate('Memory', { memory: mainMemory });
            }
          }}
          style={[styles.photoCard, {
            backgroundColor: theme.paper,
            borderColor: isSelected ? (selectIndex === 0 ? theme.accent : '#5B8DEF') : theme.line,
            borderWidth: isSelected ? 2.5 : 1,
          }]}
        >
          <MemoryCover memory={mainMemory} videoFrame
            style={{ width: '100%', height: undefined, aspectRatio: 4 / 3 }}
            radius={16} />

          {/* Year + age overlay */}
          <View style={styles.yearOverlay}>
            <Text style={[styles.yearLabel, { fontFamily: theme.fonts.head }]}>
              {group.year}
            </Text>
            {tags.length > 0 && (
              <Text style={[styles.ageLabel, { fontFamily: theme.fonts.body }]}>
                {tags.join(' · ')}
              </Text>
            )}
          </View>

          {/* Shot count badge */}
          {group.memories.length > 1 && (
            <View style={[styles.shotBadge, { backgroundColor: 'rgba(255,253,247,0.92)' }]}>
              {Icon.camera(theme.ink, 11)}
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 11, color: theme.ink }}>
                {group.memories.length} {t('common.photo')}
              </Text>
            </View>
          )}

          {/* Compare selection badge */}
          {compareMode && isSelected && (
            <View style={[styles.selectBadge, { backgroundColor: selectIndex === 0 ? theme.accent : '#5B8DEF' }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: '#FFFDF7' }}>
                {selectIndex + 1}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Caption */}
        {!!mainMemory.caption && (
          <Text style={{ fontFamily: theme.fonts.hand || theme.fonts.body, fontSize: 14, color: theme.inkSoft, marginTop: 10, lineHeight: 22 }}>
            {mainMemory.caption}
          </Text>
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <View style={{ paddingBottom: 8 }}>
      {/* Tags */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {!!level.reminderText && (
          <View style={[styles.tag, { backgroundColor: tn.soft }]}>
            {Icon.pin(tn.ink, 12)}
            <Text style={{ fontFamily: theme.fonts.head, fontSize: 12, color: tn.ink }}>
              {level.reminderText}
            </Text>
          </View>
        )}
        <View style={[styles.tag, { backgroundColor: theme.sand }]}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>
            {level.num}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 54, lineHeight: 54, color: theme.accent }}>
            {totalPhotos}
          </Text>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink }}>
            {t('common.photo')}
          </Text>
        </View>
        {yearsRecorded > 0 && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft }}>
            {t('spotTimeline.statsYears', { count: yearsRecorded })}
          </Text>
        )}
      </View>

      {/* Spot note */}
      {!!level.spotNote && (
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {Icon.pin(theme.inkSoft, 14)}
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.ink }}>
              {level.spotNote.split('\n')[0]}
            </Text>
          </View>
          {level.spotNote.includes('\n') && (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft, lineHeight: 21, marginLeft: 20 }}>
              {level.spotNote.split('\n').slice(1).join('\n')}
            </Text>
          )}
        </View>
      )}

      {/* Compare selection hint */}
      {compareMode && (
        <View style={[styles.selectBar, { backgroundColor: theme.paper, borderColor: theme.line }]}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.ink }}>
            {t('spotTimeline.selectHint', { count: selected.length })}
          </Text>
        </View>
      )}

      {/* Reminder card: this year not yet recorded */}
      {!compareMode && !hasCurrentYear && totalPhotos > 0 && (
        <View style={[styles.reminderCard, { backgroundColor: theme.paper, borderColor: theme.line }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {Icon.bell(tn.deep, 18)}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 15, color: theme.ink }}>
                {t('spotTimeline.emptyThisYear', { year: currentYear })}
              </Text>
              {!!level.reminderText && (
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, marginTop: 2 }}>
                  {level.reminderText}
                </Text>
              )}
            </View>
          </View>

          {/* Reference thumbnail */}
          {lastYearMemory && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View style={{ width: 72, height: 54, borderRadius: 10, overflow: 'hidden' }}>
                <MemoryCover memory={lastYearMemory} videoFrame
                  style={{ width: '100%', height: '100%', aspectRatio: undefined }} />
                <View style={{ position: 'absolute', bottom: 2, left: 4 }}>
                  <Text style={{ fontFamily: theme.fonts.head, fontSize: 10, color: '#FFFDF7',
                    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }}>
                    {yearFromDate(lastYearMemory.date)}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft, flex: 1, lineHeight: 20 }}>
                {t('spotTimeline.reminderHint')}
              </Text>
            </View>
          )}

          <PrimaryButton label={t('spotTimeline.shootThisYear')} onPress={goRecord} icon={Icon.camera('#FFFDF7', 17)} />
        </View>
      )}
    </View>
  );

  // Empty state — no photos yet
  if (totalPhotos === 0 && !compareMode) {
    return (
      <View style={[styles.container, { backgroundColor: theme.cream }]}>
        <LayerHeader title={level.title} onBack={() => navigation.goBack()} right={headerRight} />
        <View style={styles.empty}>
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 20, color: theme.ink, textAlign: 'center', marginBottom: 12 }}>
            {t('spotTimeline.emptyTitle')}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            {t('spotTimeline.emptyHint')}
          </Text>
          {!!level.spotNote && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 28, paddingHorizontal: 12 }}>
              {Icon.pin(theme.inkSoft, 14)}
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft, flex: 1, lineHeight: 21 }}>
                {level.spotNote}
              </Text>
            </View>
          )}
          <PrimaryButton label={t('spotTimeline.shootFirst')} onPress={goRecord} icon={Icon.camera('#FFFDF7', 17)} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader title={level.title} onBack={() => navigation.goBack()} right={headerRight} />

      <FlatList
        data={grouped}
        keyExtractor={g => String(g.year)}
        renderItem={renderYearGroup}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      />

      {/* Compare CTA bar */}
      {compareMode && selected.length === 2 && (() => {
        const y1 = yearFromDate(levelMemories.find(m => m.id === selected[0])?.date);
        const y2 = yearFromDate(levelMemories.find(m => m.id === selected[1])?.date);
        const diff = y1 && y2 ? Math.abs(y1 - y2) : 0;
        return (
          <View style={[styles.compareCta, { backgroundColor: theme.cream, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity onPress={goCompare} activeOpacity={0.85}
              style={[styles.compareBtn, { backgroundColor: theme.accent }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7' }}>
                {t('spotTimeline.compareCta', { year1: Math.min(y1!, y2!), year2: Math.max(y1!, y2!), diff })}
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
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  reminderCard: {
    borderRadius: 18, borderWidth: 1, borderStyle: 'dashed',
    padding: 18, marginBottom: 22,
  },
  selectBar: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 18, alignItems: 'center',
  },
  photoCard: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#3A332B', shadowOffset: { width: 0, height: 8 },
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
  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 36,
  },
});
