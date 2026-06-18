import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, TouchableOpacity, ScrollView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { useData } from '../data/DataProvider';
import { yearFromDate, monthFromDate, dayFromDate, kidAgeAtYear, MONTH_EN, formatTime } from '../data';
import { useMemoryMedia } from '../lib/media';
import { LayerHeader } from '../components/common';

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_W = SCREEN_W - 44;
const PHOTO_H = PHOTO_W * 0.75; // 4:3

export default function SpotCompare({ route, navigation }) {
  const { theme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { kids } = useData();

  const { memories: [mem1, mem2], level } = route.params || {};
  const tn = TONE[level?.tone] || TONE.orange;

  // Sort so older is first — use createdAt for precision when dates match
  const ca1 = mem1?.createdAt || mem1?.date || '';
  const ca2 = mem2?.createdAt || mem2?.date || '';
  const [before, after] = ca1 > ca2 ? [mem2, mem1] : [mem1, mem2];
  const dateBefore = before?.date || '';
  const dateAfter = after?.date || '';
  const yearBefore = yearFromDate(dateBefore) || 0;
  const yearAfter = yearFromDate(dateAfter) || 0;

  const monthBefore = monthFromDate(dateBefore);
  const monthAfter = monthFromDate(dateAfter);
  const dayBefore_ = dayFromDate(dateBefore);
  const dayAfter_ = dayFromDate(dateAfter);
  const sameYear = yearBefore === yearAfter;
  const sameMonth = sameYear && monthBefore === monthAfter;
  const sameDay = sameMonth && dayBefore_ === dayAfter_;

  const makeLabel = (year, month, day, createdAt) => {
    if (sameDay && month && day)
      return t('spotCompare.labelMonthDayTime', { m: month, d: day, monthName: MONTH_EN[month], time: formatTime(createdAt) });
    if (sameMonth && month && day)
      return t('spotCompare.labelMonthDay', { m: month, d: day, monthName: MONTH_EN[month] });
    if (sameYear && month)
      return t('spotCompare.labelMonth', { m: month, monthName: MONTH_EN[month] });
    return String(year || '');
  };
  const labelBefore = makeLabel(yearBefore, monthBefore, dayBefore_, before?.createdAt);
  const labelAfter = makeLabel(yearAfter, monthAfter, dayAfter_, after?.createdAt);

  const gapLabel = (() => {
    const a = new Date(before?.createdAt || dateBefore);
    const b = new Date(after?.createdAt || dateAfter);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
    const diffMs = b.getTime() - a.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.round(diffMs / 86400000);
    if (diffMinutes < 1) return '';
    if (diffMinutes < 60) return t('spotCompare.apartMinutes', { count: diffMinutes });
    if (diffHours < 24) return t('spotCompare.apartHours', { count: diffHours });
    if (diffDays < 30) return t('spotCompare.apartDays', { count: diffDays });
    const diffMonths = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
    if (diffMonths < 1) return t('spotCompare.apartDays', { count: diffDays });
    if (diffMonths < 12) return t('spotCompare.apartMonths', { count: diffMonths });
    const diffYears = Math.floor(diffMonths / 12);
    const remainMonths = diffMonths % 12;
    if (remainMonths === 0) return t('spotCompare.apartYears', { count: diffYears });
    return t('spotCompare.apartYearsMonths', { years: diffYears, months: remainMonths });
  })();

  const media1 = useMemoryMedia(before?.id);
  const media2 = useMemoryMedia(after?.id);
  const img1 = media1.find(m => m.kind === 'image')?.url;
  const img2 = media2.find(m => m.kind === 'image')?.url;

  const [mode, setMode] = useState<'slider' | 'side'>('slider');

  // Slider
  const sliderX = useSharedValue(PHOTO_W / 2);
  const startX = useSharedValue(PHOTO_W / 2);

  const panGesture = Gesture.Pan()
    .onStart(() => { startX.value = sliderX.value; })
    .onUpdate(e => {
      sliderX.value = Math.max(20, Math.min(PHOTO_W - 20, startX.value + e.translationX));
    });

  const clipStyle = useAnimatedStyle(() => ({
    width: sliderX.value,
    overflow: 'hidden',
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    // shift left by half the handle width (36/2) so the line/handle center sits on the seam at sliderX
    transform: [{ translateX: sliderX.value - 18 }],
  }));

  // Age tags
  const ageTags = kids.map(kid => {
    const ageBefore = kidAgeAtYear(kid, yearBefore);
    const ageAfter = kidAgeAtYear(kid, yearAfter);
    if (ageBefore === null || ageAfter === null || ageBefore === ageAfter) return null;
    return t('spotCompare.ageChange', { name: kid.name, from: ageBefore, to: ageAfter });
  }).filter(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader title={t('spotCompare.title')} onBack={() => navigation.goBack()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date range */}
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft, textAlign: 'center' }}>
          {dateBefore} ↔ {dateAfter}
        </Text>
        {gapLabel ? (
          <Text style={{ fontFamily: theme.fonts.head, fontSize: 26, color: theme.ink, textAlign: 'center', marginTop: 4 }}>
            {gapLabel}
          </Text>
        ) : null}

        {/* Age tags */}
        {ageTags.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            {ageTags.map((tag, i) => (
              <View key={i} style={[styles.ageTag, { backgroundColor: tn.soft }]}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: tn.ink }}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Mode toggle */}
        <View style={[styles.modeRow, { marginTop: 16 }]}>
          {(['slider', 'side'] as const).map(m => {
            const on = mode === m;
            return (
              <TouchableOpacity key={m}
                onPress={() => setMode(m)}
                style={[styles.modeChip, {
                  backgroundColor: on ? theme.accent : theme.paper,
                  borderColor: on ? theme.accent : theme.line,
                }]}>
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 13, color: on ? '#FFFDF7' : theme.ink }}>
                  {m === 'slider' ? t('spotCompare.modeSlider') : t('spotCompare.modeSide')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Comparison area */}
        <View style={[styles.compareBox, { marginTop: 18 }]}>
          {mode === 'slider' ? (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.sliderContainer, { width: PHOTO_W, height: PHOTO_H }]}>
                {/* After image (background, full width) */}
                {img2 ? (
                  <Image source={{ uri: img2 }} style={[styles.fullImage, { width: PHOTO_W, height: PHOTO_H }]}
                    resizeMode="cover" />
                ) : (
                  <View style={[styles.fullImage, styles.emptySlot, { width: PHOTO_W, height: PHOTO_H }]}>
                    <Text style={[styles.emptySlotText, { fontFamily: theme.fonts.body }]}>{t('spotCompare.noPhoto')}</Text>
                  </View>
                )}

                {/* Before image (clipped) */}
                <Animated.View style={[{ position: 'absolute', top: 0, left: 0, height: PHOTO_H, backgroundColor: '#E8DFCF' }, clipStyle]}>
                  {img1 ? (
                    <Image source={{ uri: img1 }} style={[styles.fullImage, { width: PHOTO_W, height: PHOTO_H }]}
                      resizeMode="cover" />
                  ) : (
                    <View style={[styles.fullImage, styles.emptySlot, { width: PHOTO_W, height: PHOTO_H }]}>
                      <Text style={[styles.emptySlotText, { fontFamily: theme.fonts.body }]}>{t('spotCompare.noPhoto')}</Text>
                    </View>
                  )}
                </Animated.View>

                {/* Year labels — outside clip so they don't get cut */}
                <View style={{ position: 'absolute', bottom: 10, left: 12 }} pointerEvents="none">
                  <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head }]}>{labelBefore}</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 10, right: 12 }} pointerEvents="none">
                  <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head }]}>{labelAfter}</Text>
                </View>

                {/* Divider line + handle */}
                <Animated.View style={[styles.divider, dividerStyle]}>
                  <View style={styles.dividerLine} />
                  <View style={[styles.dividerHandle, { backgroundColor: '#FFFDF7' }]}>
                    <Text style={{ fontSize: 11, color: theme.ink }}>‹ ›</Text>
                  </View>
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          ) : (
            /* Stacked top & bottom */
            <View style={{ gap: 8, width: PHOTO_W }}>
              <View style={styles.sideImage}>
                {img1 ? (
                  <Image source={{ uri: img1 }} style={styles.sideFill} resizeMode="cover" />
                ) : (
                  <View style={[styles.sideFill, styles.emptySlot]}>
                    <Text style={[styles.emptySlotText, { fontFamily: theme.fonts.body }]}>{t('spotCompare.noPhoto')}</Text>
                  </View>
                )}
                <View style={styles.sideLabel}>
                  <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head, fontSize: 22 }]}>{labelBefore}</Text>
                </View>
              </View>
              <View style={styles.sideImage}>
                {img2 ? (
                  <Image source={{ uri: img2 }} style={styles.sideFill} resizeMode="cover" />
                ) : (
                  <View style={[styles.sideFill, styles.emptySlot]}>
                    <Text style={[styles.emptySlotText, { fontFamily: theme.fonts.body }]}>{t('spotCompare.noPhoto')}</Text>
                  </View>
                )}
                <View style={styles.sideLabel}>
                  <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head, fontSize: 22 }]}>{labelAfter}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Drag hint */}
        {mode === 'slider' && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, textAlign: 'center', marginTop: 12 }}>
            {t('spotCompare.dragHint', { label1: labelBefore, label2: labelAfter })}
          </Text>
        )}

        {/* Captions */}
        <View style={{ marginTop: 20, gap: 12 }}>
          {!!before?.caption && (
            <View style={[styles.captionRow, { backgroundColor: theme.paper, borderColor: theme.line }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.accent }}>{labelBefore}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.ink, flex: 1, lineHeight: 21 }}>
                {before.caption}
              </Text>
            </View>
          )}
          {!!after?.caption && (
            <View style={[styles.captionRow, { backgroundColor: theme.paper, borderColor: theme.line }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.accent }}>{labelAfter}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.ink, flex: 1, lineHeight: 21 }}>
                {after.caption}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 32 },
  ageTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  modeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  modeChip: {
    paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999,
    borderWidth: 1,
  },
  compareBox: { alignItems: 'center' },
  sliderContainer: {
    borderRadius: 18, overflow: 'hidden', position: 'relative',
    backgroundColor: '#E8DFCF',
  },
  fullImage: { position: 'absolute', top: 0, left: 0 },
  divider: {
    position: 'absolute', top: 0, height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  dividerLine: {
    position: 'absolute', top: 0, bottom: 0,
    width: 2, backgroundColor: '#FFFDF7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 3,
  },
  dividerHandle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  sideImage: {
    width: '100%', aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#E8DFCF', position: 'relative',
  },
  sideFill: { width: '100%', height: '100%' },
  emptySlot: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8DFCF' },
  emptySlotText: { fontSize: 13, color: '#B5A991' },
  sideLabel: { position: 'absolute', bottom: 8, left: 8 },
  sliderYear: {
    fontSize: 28, color: '#FFFDF7',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  captionRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
});
