import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, TouchableOpacity } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { useData } from '../data/DataProvider';
import { yearFromDate, kidAgeAtYear } from '../data';
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

  // Sort so older year is first (before), newer is second (after)
  const y1 = yearFromDate(mem1?.date);
  const y2 = yearFromDate(mem2?.date);
  const [before, after] = (y1 && y2 && y1 > y2) ? [mem2, mem1] : [mem1, mem2];
  const yearBefore = yearFromDate(before?.date) || 0;
  const yearAfter = yearFromDate(after?.date) || 0;
  const diff = Math.abs(yearAfter - yearBefore);

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
    transform: [{ translateX: sliderX.value }],
  }));

  // Age tags
  const ageTags = kids.map(kid => {
    const ageBefore = kidAgeAtYear(kid, yearBefore);
    const ageAfter = kidAgeAtYear(kid, yearAfter);
    if (ageBefore === null || ageAfter === null) return null;
    return t('spotCompare.ageChange', { name: kid.name, from: ageBefore, to: ageAfter });
  }).filter(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      <LayerHeader title={t('spotCompare.title')} onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        {/* Year range */}
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.inkSoft, textAlign: 'center' }}>
          {yearBefore} ↔ {yearAfter}
        </Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 26, color: theme.ink, textAlign: 'center', marginTop: 4 }}>
          {t('spotCompare.apart', { diff })}
        </Text>

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
                {img2 && (
                  <Image source={{ uri: img2 }} style={[styles.fullImage, { width: PHOTO_W, height: PHOTO_H }]}
                    resizeMode="cover" />
                )}
                {/* Year label on right (after) */}
                <View style={{ position: 'absolute', bottom: 10, right: 12 }}>
                  <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head }]}>{yearAfter}</Text>
                </View>

                {/* Before image (clipped) */}
                <Animated.View style={[{ position: 'absolute', top: 0, left: 0, height: PHOTO_H }, clipStyle]}>
                  {img1 && (
                    <Image source={{ uri: img1 }} style={[styles.fullImage, { width: PHOTO_W, height: PHOTO_H }]}
                      resizeMode="cover" />
                  )}
                  {/* Year label on left (before) */}
                  <View style={{ position: 'absolute', bottom: 10, left: 12 }}>
                    <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head }]}>{yearBefore}</Text>
                  </View>
                </Animated.View>

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
            /* Side by side */
            <View style={{ flexDirection: 'row', gap: 6, width: PHOTO_W }}>
              <View style={[styles.sideImage, { flex: 1 }]}>
                {img1 && <Image source={{ uri: img1 }} style={styles.sideFill} resizeMode="cover" />}
                <View style={styles.sideLabel}>
                  <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head, fontSize: 20 }]}>{yearBefore}</Text>
                </View>
              </View>
              <View style={[styles.sideImage, { flex: 1 }]}>
                {img2 && <Image source={{ uri: img2 }} style={styles.sideFill} resizeMode="cover" />}
                <View style={styles.sideLabel}>
                  <Text style={[styles.sliderYear, { fontFamily: theme.fonts.head, fontSize: 20 }]}>{yearAfter}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Drag hint */}
        {mode === 'slider' && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.inkSoft, textAlign: 'center', marginTop: 12 }}>
            {t('spotCompare.dragHint', { year1: yearBefore, year2: yearAfter })}
          </Text>
        )}

        {/* Captions */}
        <View style={{ marginTop: 20, gap: 12 }}>
          {!!before?.caption && (
            <View style={[styles.captionRow, { backgroundColor: theme.paper, borderColor: theme.line }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.accent }}>{yearBefore}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.ink, flex: 1, lineHeight: 21 }}>
                {before.caption}
              </Text>
            </View>
          )}
          {!!after?.caption && (
            <View style={[styles.captionRow, { backgroundColor: theme.paper, borderColor: theme.line }]}>
              <Text style={{ fontFamily: theme.fonts.head, fontSize: 18, color: theme.accent }}>{yearAfter}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.ink, flex: 1, lineHeight: 21 }}>
                {after.caption}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 8 },
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
    aspectRatio: 3 / 4, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#E8DFCF', position: 'relative',
  },
  sideFill: { width: '100%', height: '100%' },
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
