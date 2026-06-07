import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONE } from '../theme/tokens';
import {
  PERSPECTIVES, LEVELS, getKid, kidLabel, meName, frameLabel,
} from '../data';
import { Icon, PhotoSlot } from '../components/Icons';
import { LayerHeader, Section, PrimaryButton, SecondaryButton } from '../components/common';

export default function LevelDetail({ route, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { level, kidId, me } = route.params;

  const t = TONE[level.tone] || TONE.orange;
  const perspective = PERSPECTIVES[level.perspective];
  const kid = getKid(kidId);
  const sugMap = {
    voice: { label: '用语音录下来', icon: () => Icon.mic(t.ink, 22) },
    photo: { label: '拍一张照片', icon: () => Icon.camera(t.ink, 22) },
    text:  { label: '写下来', icon: () => Icon.pen(t.ink, 22) },
  };
  const sug = sugMap[level.suggest] || null;

  return (
    <View style={[styles.container, { backgroundColor: theme.cream }]}>
      {/* Header */}
      <LayerHeader
        title=""
        onBack={() => navigation.goBack()}
      />

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Perspective badge */}
        {perspective && (
          <View style={[styles.badge, { backgroundColor: t.soft }]}>
            <Text style={[styles.badgeText, {
              color: t.ink,
              fontFamily: theme.fonts.head,
            }]}>
              {perspective.long}
            </Text>
          </View>
        )}

        {/* Title */}
        <Text style={[styles.title, {
          color: theme.ink,
          fontFamily: theme.fonts.head,
        }]}>
          {level.title}
        </Text>

        {/* Sealed notice */}
        {level.sealed && (
          <View style={[styles.sealedBox, { borderColor: theme.line }]}>
            <View style={styles.sealedIcon}>
              {Icon.lock(theme.inkSoft, 18)}
            </View>
            <Text style={[styles.sealedText, {
              color: theme.inkSoft,
              fontFamily: theme.fonts.body,
            }]}>
              这一封会被封存，直到约定的那天才打开
            </Text>
          </View>
        )}

        {/* Why section */}
        <SectionBlock
          kicker="为什么值得做"
          body={level.why}
          theme={theme}
        />

        {/* How section */}
        <SectionBlock
          kicker="可以怎么做"
          body={level.how}
          theme={theme}
        />

        {/* Record section */}
        <SectionBlock
          kicker="记录些什么"
          body={level.record}
          theme={theme}
        />

        {/* Suggestion chip */}
        {sug && (
          <View style={[styles.suggestCard, {
            backgroundColor: theme.paper,
            borderColor: theme.line,
          }]}>
            <View style={[styles.suggestIcon, { backgroundColor: t.soft }]}>
              {sug.icon()}
            </View>
            <View style={styles.suggestTextWrap}>
              <Text style={[styles.suggestLabel, {
                color: theme.inkSoft,
                fontFamily: theme.fonts.body,
              }]}>
                这一关最适合
              </Text>
              <Text style={[styles.suggestValue, {
                color: theme.ink,
                fontFamily: theme.fonts.head,
              }]}>
                {sug.label}
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* Gradient overlay effect via background View */}
        <View style={[styles.bottomGradient, { backgroundColor: theme.cream }]} />
        <View style={styles.bottomButtons}>
          <SecondaryButton
            label="以后再说"
            onPress={() => navigation.goBack()}
            style={styles.laterBtn}
          />
          <PrimaryButton
            label="做完了，记录一下"
            onPress={() => {
              // Navigate to record screen with level data
              if (navigation) {
                navigation.navigate('Record', { level, kidId, me });
              }
            }}
            style={styles.recordBtn}
          />
        </View>
      </View>
    </View>
  );
}

/* ── SectionBlock — custom section with accent kicker dot ── */

function SectionBlock({ kicker, body, theme }) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.kickerRow}>
        <View style={[styles.kickerDot, { backgroundColor: theme.accent }]} />
        <Text style={[styles.kickerText, {
          color: theme.accent,
          fontFamily: theme.fonts.head,
        }]}>
          {kicker}
        </Text>
      </View>
      <Text style={[styles.sectionBody, {
        color: theme.ink,
        fontFamily: theme.fonts.body,
      }]}>
        {body}
      </Text>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 4,
    paddingBottom: 130,
  },

  /* Badge */
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 13,
  },

  /* Title */
  title: {
    fontSize: 30,
    lineHeight: 42,
    marginTop: 16,
  },

  /* Sealed */
  sealedBox: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,253,247,0.6)',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sealedIcon: {
    marginRight: 8,
  },
  sealedText: {
    flex: 1,
    fontSize: 13.5,
  },

  /* Section block */
  sectionBlock: {
    marginTop: 28,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  kickerDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginRight: 10,
  },
  kickerText: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 17,
    lineHeight: 34,
  },

  /* Suggest card */
  suggestCard: {
    marginTop: 34,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  suggestLabel: {
    fontSize: 13,
  },
  suggestValue: {
    fontSize: 17,
    marginTop: 2,
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -30,
    bottom: 0,
    opacity: 0.95,
  },
  bottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    gap: 12,
  },
  laterBtn: {
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  recordBtn: {
    flex: 1,
    paddingVertical: 15,
  },
});
