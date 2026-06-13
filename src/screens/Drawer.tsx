// screens/Drawer.js — side drawer, slides in from the left.
// Shows family overview, progress, weekly heatmap, and navigation rows.

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useTheme, TONE } from '../theme/tokens';
import { useT } from '../i18n';
import { meName, meChar, PET_BODY, SHOW_MASCOT, durationSince, sealedLockedFrom, sealedAllFrom, isMemoryUnsealed } from '../data';
import { useData } from '../data/DataProvider';
import { Icon } from '../components/Icons';
import { Bear } from '../components/Bear';

const DRAWER_WIDTH = 310;
const ANIM_DURATION_IN = 380;
const ANIM_DURATION_OUT = 300;

const HEAT_YEAR = 2026;
const WK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/* ── helper: heat cell colour ── */

function heatColor(count, accent, cream) {
  if (count <= 0) return 'transparent';
  if (count === 1) return accent + '66'; // ~40% opacity
  if (count === 2) return accent + 'A3'; // ~64% opacity
  return accent + 'E0'; // ~88% opacity
}

/* ── helper: compute next unlock info from done count ── */

function computeUnlockInfo(done, wardrobe) {
  const sorted = [...wardrobe].sort((a, b) => a.at - b.at);
  const unlocked = sorted.filter((w) => done >= w.at).length;
  const total = sorted.length;
  const next = sorted.find((w) => w.at > done) || null;
  const remain = next ? next.at - done : 0;
  return { unlocked, total, next, remain };
}

/* ══════════════════════════════════════════════════════════════
   DrawerRow — a tappable row with icon, label, optional sub/value
   ══════════════════════════════════════════════════════════════ */

function DrawerRow({ icon, title, sub, value, onPress, isStatic = false }) {
  const { theme } = useTheme();
  const tappable = !!onPress && !isStatic;

  const content = (
    <View style={[rowStyles.container, { borderBottomColor: theme.line }]}>
      <View
        style={[
          rowStyles.iconWrap,
          { backgroundColor: theme.sand, borderRadius: 13 },
        ]}
      >
        {icon}
      </View>
      <View style={rowStyles.textWrap}>
        <Text
          style={[
            rowStyles.title,
            { fontFamily: theme.fonts.body, color: theme.ink },
          ]}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={[
              rowStyles.sub,
              { fontFamily: theme.fonts.body, color: theme.inkSoft },
            ]}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {value != null && (
        <Text
          style={[
            rowStyles.value,
            { fontFamily: theme.fonts.head, color: theme.accent },
          ]}
        >
          {value}
        </Text>
      )}
      {tappable && Icon.chevR(theme.inkSoft, 17)}
    </View>
  );

  if (tappable) {
    return (
      <TouchableOpacity activeOpacity={0.65} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15.5,
  },
  sub: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 18,
  },
  value: {
    fontSize: 14,
    marginRight: 4,
  },
});

/* ══════════════════════════════════════════════════════════════
   MonthHeatmap — weekly heatmap showing active days
   ══════════════════════════════════════════════════════════════ */

function MonthHeatmap({ onOpen, kidId = 'all' }) {
  const { theme } = useTheme();
  const t = useT();
  const { memories, memoriesForKid } = useData();
  const WK = WK_KEYS.map((k) => t(`weekday.${k}`));

  const { month, weekCells, byKey, recordedDays, weekDone } = useMemo(() => {
    const parse = (s) => {
      if (!s) return { mo: null, da: null };
      // Support both "5 月 28 日" and "2024-05-28" formats
      const isoMatch = (s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) return { mo: +isoMatch[2], da: +isoMatch[3] };
      const mo = (s || '').match(/(\d+)\s*月/);
      const da = (s || '').match(/(\d+)\s*日/);
      return { mo: mo ? +mo[1] : null, da: da ? +da[1] : null };
    };

    const mems =
      kidId === 'all' ? memories : memoriesForKid(kidId);

    const dated = mems
      .map((m) => {
        const { mo, da } = parse(m.date);
        return mo && da ? new Date(HEAT_YEAR, mo - 1, da) : null;
      })
      .filter(Boolean);

    const newest =
      dated.length > 0
        ? new Date(Math.max(...dated.map((d) => +d)))
        : new Date(HEAT_YEAR, 4, 28);

    // Monday of that week
    const ws = new Date(newest);
    ws.setDate(newest.getDate() - ((newest.getDay() + 6) % 7));

    const key = (d) => `${d.getMonth() + 1}-${d.getDate()}`;

    const cells = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      return d;
    });

    const bk = {};
    dated.forEach((d) => {
      const k = key(d);
      bk[k] = (bk[k] || 0) + 1;
    });

    const wk = cells.map((d) => bk[key(d)] || 0);

    return {
      month: newest.getMonth() + 1,
      weekCells: cells,
      byKey: bk,
      recordedDays: wk.filter((c) => c > 0).length,
      weekDone: wk.reduce((a, b) => a + b, 0),
    };
  }, [kidId, memories, memoriesForKid]);

  const key = (d) => `${d.getMonth() + 1}-${d.getDate()}`;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onOpen && onOpen(month)}
      style={[
        heatStyles.card,
        {
          backgroundColor: theme.paper,
          borderColor: theme.line,
        },
      ]}
    >
      {/* Header */}
      <View style={heatStyles.header}>
        <Text
          style={[
            heatStyles.headerTitle,
            { fontFamily: theme.fonts.head, color: theme.ink },
          ]}
        >
          {t('drawer.weekTitle')}
        </Text>
        <View style={heatStyles.headerRight}>
          <Text
            style={[
              heatStyles.headerLink,
              { fontFamily: theme.fonts.body, color: theme.accent },
            ]}
          >
            {t('drawer.allRecords')}
          </Text>
          {Icon.chevR(theme.accent, 15)}
        </View>
      </View>

      {/* Weekday headers */}
      <View style={heatStyles.grid}>
        {WK.map((w, i) => (
          <View key={'wh' + i} style={heatStyles.gridCell}>
            <Text
              style={[
                heatStyles.weekLabel,
                { fontFamily: theme.fonts.body, color: theme.inkSoft },
              ]}
            >
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      <View style={[heatStyles.grid, { marginTop: 6 }]}>
        {weekCells.map((d, i) => {
          const c = byKey[key(d)] || 0;
          const filled = c > 0;
          return (
            <View key={'dc' + i} style={heatStyles.gridCell}>
              <View
                style={[
                  heatStyles.dayCell,
                  {
                    backgroundColor: heatColor(c, theme.accent, theme.cream),
                    borderColor: filled ? 'transparent' : theme.line,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    heatStyles.dayText,
                    {
                      fontFamily: theme.fonts.body,
                      color: filled ? theme.paper : theme.inkSoft,
                    },
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Footer stats */}
      <View style={[heatStyles.footer, { borderTopColor: theme.line }]}>
        <Text
          style={[
            heatStyles.footerText,
            { fontFamily: theme.fonts.body, color: theme.inkSoft },
          ]}
        >
          {t('drawer.recordedPrefix')}{' '}
          <Text
            style={{
              fontFamily: theme.fonts.head,
              fontSize: 15,
              color: theme.ink,
            }}
          >
            {t('common.daysCount', { count: recordedDays })}
          </Text>
        </Text>
        <Text
          style={[
            heatStyles.footerText,
            { fontFamily: theme.fonts.body, color: theme.inkSoft },
          ]}
        >
          {t('drawer.completedPrefix')}{' '}
          <Text
            style={{
              fontFamily: theme.fonts.head,
              fontSize: 15,
              color: theme.accent,
            }}
          >
            {t('common.thingsCount', { count: weekDone })}
          </Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const heatStyles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLink: {
    fontSize: 13,
    marginRight: 2,
  },
  grid: {
    marginTop: 13,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 10.5,
    opacity: 0.7,
    textAlign: 'center',
  },
  dayCell: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 13,
    lineHeight: 16,
  },
  footer: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  footerText: {
    fontSize: 13,
  },
});

/* ══════════════════════════════════════════════════════════════
   Drawer — main side drawer
   ══════════════════════════════════════════════════════════════ */

export default function Drawer({ visible, onClose, onNavigate, kidId = 'all', me }) {
  const { theme } = useTheme();
  const t = useT();
  const { kids, levels, memories, wardrobe, customLevels, FAMILY, getKid, kidDone, memoriesForKid, getMascot, wardrobeState } = useData();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: ANIM_DURATION_IN,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: ANIM_DURATION_IN,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: ANIM_DURATION_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: ANIM_DURATION_OUT,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    (route) => {
      onClose();
      if (onNavigate) onNavigate(route);
    },
    [onClose, onNavigate],
  );

  // ── Computed values ──

  const isAll = kidId === 'all';
  const focusName = isAll ? t('drawer.kids') : (getKid(kidId)?.name || t('drawer.child'));
  const done = isAll
    ? memories.length
    : memoriesForKid(kidId).length;
  const total = 100;
  const empty = done === 0;

  // Together-for duration (from earliest kid)
  const togetherFor = useMemo(() => {
    if (kids.length === 0) return '';
    const earliest = kids.reduce((a, b) => {
      const sinceA = a.since || '';
      const sinceB = b.since || '';
      return sinceA < sinceB ? a : b;
    });
    return durationSince(earliest.since);
  }, [kids]);

  // Sealed items（真实封存记录：仍锁定 + 已到期可打开，都算“封存物”）
  const sealedAll = sealedAllFrom(memories, kidId);
  const sealedLocked = sealedLockedFrom(memories, kidId);
  const sealedCount = sealedAll.length;
  const openableCount = sealedAll.filter(isMemoryUnsealed).length;
  const sealedSub = openableCount > 0
    ? t('drawer.sealedOpenable', { count: openableCount })
    : sealedLocked[0]
      ? t('drawer.sealedWaiting', { label: sealedLocked[0].sealLabel || t('drawer.theAppointedDay') })
      : t('drawer.sealedNone');

  // Mascot info
  const petKid = isAll ? (kids[0]?.id || 'duo') : kidId;
  const mascot = getMascot(petKid);
  const mascotDone = memoriesForKid(petKid).length;
  const unlockInfo = computeUnlockInfo(mascotDone, wardrobe);
  const activeAccessories = wardrobeState(mascotDone)
    .filter((w) => w.got)
    .map((w) => w.id);

  if (!shouldRender) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]} pointerEvents="box-none">
      {/* Backdrop / scrim */}
      <Animated.View
        style={[
          drawerStyles.scrim,
          { opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          drawerStyles.panel,
          {
            width: DRAWER_WIDTH,
            backgroundColor: theme.cream,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* ── Family header ── */}
        <View
          style={[
            drawerStyles.header,
            { borderBottomColor: theme.line },
          ]}
        >
          <Text
            style={[
              drawerStyles.headerTitle,
              { fontFamily: theme.fonts.head, color: theme.ink },
            ]}
          >
            {isAll ? t('drawer.growWithKids') : t('drawer.growWith', { name: focusName })}
          </Text>
          <Text
            style={[
              drawerStyles.headerSub,
              { fontFamily: theme.fonts.hand, color: theme.accent },
            ]}
          >
            {empty ? t('drawer.startToday') : t('drawer.recordedTogether', { dur: togetherFor || t('duration.fallback') })}
          </Text>

        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          style={drawerStyles.scrollArea}
          contentContainerStyle={drawerStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Progress hero card ── */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => go('book')}
            style={[
              drawerStyles.heroCard,
              {
                backgroundColor: theme.paper,
                borderColor: theme.line,
              },
            ]}
          >
            <Text
              style={[
                drawerStyles.heroLabel,
                { fontFamily: theme.fonts.body, color: theme.inkSoft },
              ]}
            >
              {isAll ? t('drawer.familyHundred') : t('drawer.hundredWith', { name: focusName })}
            </Text>
            <View style={drawerStyles.heroNumbers}>
              <Text
                style={[
                  drawerStyles.heroBig,
                  { fontFamily: theme.fonts.head, color: theme.ink },
                ]}
              >
                {done}
              </Text>
              <Text
                style={[
                  drawerStyles.heroUnit,
                  { fontFamily: theme.fonts.body, color: theme.inkSoft },
                ]}
              >
                {t('drawer.slashTotal', { total })}
              </Text>
            </View>
            {/* Progress bar */}
            <View
              style={[
                drawerStyles.progressTrack,
                { backgroundColor: theme.sand },
              ]}
            >
              <View
                style={[
                  drawerStyles.progressFill,
                  {
                    backgroundColor: theme.accent,
                    width: `${Math.max((done / total) * 100, 2)}%`,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                drawerStyles.heroHint,
                { fontFamily: theme.fonts.body, color: theme.inkSoft },
              ]}
            >
              {empty
                ? t('drawer.emptyHint')
                : t('drawer.progressHint', { done, remain: total - done })}
            </Text>
          </TouchableOpacity>

          {/* ── Week heatmap ── */}
          {!empty && (
            <MonthHeatmap
              kidId={kidId}
              onOpen={(month) => go('records')}
            />
          )}

          {/* ── Mascot / pet entry ── */}
          {SHOW_MASCOT && !empty && mascot && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => go('mascot')}
              style={[
                drawerStyles.petCard,
                {
                  backgroundColor: theme.paper,
                  borderColor: theme.line,
                },
              ]}
            >
              <View
                style={[
                  drawerStyles.petAvatar,
                  {
                    backgroundColor: theme.sand,
                    borderColor: theme.line,
                  },
                ]}
              >
                <Bear
                  size={54}
                  stage={PET_BODY}
                  accessories={activeAccessories}
                  tone={getKid(petKid)?.tone || 'orange'}
                />
              </View>
              <View style={drawerStyles.petInfo}>
                <View style={drawerStyles.petNameRow}>
                  <Text
                    style={[
                      drawerStyles.petName,
                      { fontFamily: theme.fonts.head, color: theme.ink },
                    ]}
                  >
                    {t('drawer.petWardrobe', { name: mascot.name })}
                  </Text>
                  <View
                    style={[
                      drawerStyles.petBadge,
                      { backgroundColor: theme.sand },
                    ]}
                  >
                    <Text
                      style={[
                        drawerStyles.petBadgeText,
                        { fontFamily: theme.fonts.body, color: theme.accent },
                      ]}
                    >
                      {unlockInfo.unlocked}/{unlockInfo.total}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    drawerStyles.petHint,
                    { fontFamily: theme.fonts.body, color: theme.inkSoft },
                  ]}
                >
                  {unlockInfo.next
                    ? t('drawer.petUnlock', { remain: unlockInfo.remain, name: unlockInfo.next.name })
                    : t('drawer.petAllDone')}
                </Text>
              </View>
              {Icon.chevR(theme.inkSoft, 20)}
            </TouchableOpacity>
          )}

          {/* ── Navigation rows ── */}
          <View style={{ marginTop: 10 }}>
            <DrawerRow
              icon={Icon.pen(theme.accent, 19)}
              title={t('drawer.ownLevels')}
              sub={customLevels.length ? t('drawer.ownLevelsSubHas') : t('drawer.ownLevelsSubEmpty')}
              value={customLevels.length ? t('common.itemsCount', { count: customLevels.length }) : undefined}
              onPress={() => go('ownlevels')}
            />
            <DrawerRow
              icon={Icon.lock(theme.accent, 19)}
              title={t('drawer.sealed')}
              sub={sealedSub}
              value={t('common.itemsCount', { count: sealedCount })}
              onPress={() => go('sealed')}
            />
          </View>
        </ScrollView>

        {/* ── Bottom: settings ── */}
        <View
          style={[
            drawerStyles.bottomBar,
            { borderTopColor: theme.line },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.65}
            onPress={() => go('settings')}
            style={drawerStyles.settingsRow}
          >
            <View
              style={[
                drawerStyles.settingsIcon,
                { backgroundColor: theme.sand },
              ]}
            >
              {Icon.gear(theme.accent, 20)}
            </View>
            <Text
              style={[
                drawerStyles.settingsLabel,
                { fontFamily: theme.fonts.body, color: theme.ink },
              ]}
            >
              {t('drawer.settings')}
            </Text>
            {Icon.chevR(theme.inkSoft, 17)}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

/* ── Drawer styles ── */

const drawerStyles = StyleSheet.create({
  scrim: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(40,34,26,0.55)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'column',
    shadowColor: '#28221A',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  /* ─ header ─ */
  header: {
    paddingTop: 62,
    paddingHorizontal: 24,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 26,
    lineHeight: 34,
  },
  headerSub: {
    marginTop: 4,
    fontSize: 18,
  },
  /* ─ scroll ─ */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 30,
  },
  /* ─ hero card ─ */
  heroCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  heroLabel: {
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 10,
  },
  heroNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroBig: {
    fontSize: 40,
    lineHeight: 44,
  },
  heroUnit: {
    fontSize: 15,
    marginLeft: 8,
  },
  progressTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    minWidth: 8,
    borderRadius: 999,
  },
  heroHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
  },
  /* ─ pet card ─ */
  petCard: {
    marginTop: 14,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  petAvatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 14,
  },
  petInfo: {
    flex: 1,
    minWidth: 0,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petName: {
    fontSize: 16,
    marginRight: 7,
  },
  petBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  petBadgeText: {
    fontSize: 11.5,
  },
  petHint: {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 18,
  },
  /* ─ bottom bar ─ */
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingVertical: 14,
    paddingBottom: 28,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15.5,
  },
});
