import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  fetchLevels, fetchKids, fetchMemories,
  fetchCustomLevels, fetchProfile, insertCustomLevel,
  updateCustomLevel, deleteCustomLevel,
  insertMemory, insertKid, updateKid, updateProfile, deleteMemory,
  getKidFrom, kidLabelFrom, kidDoneFrom, memoriesForKidFrom, memoriesForLevelFrom,
  allLevelsFrom,
  throwbackFrom, yearReviewFrom, levelWeightFrom, weightedShuffleFrom,
  frameLabelFrom,
  FAMILY,
  fetchMyFamily, createFamily as apiCreateFamily, joinFamily as apiJoinFamily,
  removeFamilyMember, leaveFamily as apiLeaveFamily, clearFamilyCache,
} from './index';
import { t } from '../i18n';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === MAX_RETRIES - 1) throw e;
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  throw new Error('unreachable');
}

const DataContext = createContext<Record<string, any> | null>(null);

export function DataProvider({ children, userId }) {
  const [levels, setLevels] = useState<any[]>([]);
  const [kids, setKids] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [customLevels, setCustomLevels] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [family, setFamily] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevUserId = useRef(userId);
  if (userId !== prevUserId.current) {
    prevUserId.current = userId;
    if (userId) {
      setLoading(true);
      setLoaded(false);
    }
  }

  const loadAll = useCallback(async () => {
    if (!userId) { setLoading(false); setLoaded(false); return; }
    clearFamilyCache();
    setLoading(true);
    setLoaded(false);
    setError(null);
    try {
      const [lv, ki, me, cl, pr, fam] = await withRetry(() =>
        Promise.all([
          fetchLevels(), fetchKids(), fetchMemories(),
          fetchCustomLevels(), fetchProfile(), fetchMyFamily(),
        ])
      );
      setLevels(lv);
      setKids(ki);
      setMemories(me);
      setCustomLevels(cl);
      setProfile(pr);
      setFamily(fam);
      setLoaded(true);
    } catch (e) {
      console.error('DataProvider loadAll error:', e);
      setError(t('common.networkError'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const getKid = useCallback((id) => getKidFrom(kids, id), [kids]);
  const kidLabel = useCallback((id) => kidLabelFrom(kids, id), [kids]);
  const kidDone = useCallback((id) => kidDoneFrom(memories, id), [memories]);
  const memoriesForKid = useCallback((id) => memoriesForKidFrom(memories, id), [memories]);
  const memoriesForLevel = useCallback((levelNum) => memoriesForLevelFrom(memories, levelNum), [memories]);
  const allLevels = useCallback(() => allLevelsFrom(customLevels, levels), [customLevels, levels]);
  const throwback = useCallback((kidId?) => throwbackFrom(memories, kidId), [memories]);
  const yearReview = useCallback((kidId?) => yearReviewFrom(memories, kidId), [memories]);
  const frameLabel = useCallback((perspective, kidId, meLabel?) => frameLabelFrom(kids, perspective, kidId, meLabel), [kids]);
  const levelWeight = useCallback((l, kid) => levelWeightFrom(kids, l, kid), [kids]);
  const weightedShuffle = useCallback((arr, kid, seed) => weightedShuffleFrom(kids, arr, kid, seed), [kids]);

  const addMemory = useCallback(async (input) => {
    const mem = await insertMemory(input);
    setMemories(prev => [mem, ...prev]);
    return mem;
  }, []);

  const removeMemory = useCallback(async (id) => {
    await deleteMemory(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  }, []);

  const addCustomLevel = useCallback(async (input) => {
    const lv = await insertCustomLevel(input);
    setCustomLevels(prev => [lv, ...prev]);
    return lv;
  }, []);

  const editCustomLevel = useCallback(async (id, fields) => {
    const lv = await updateCustomLevel(id, fields);
    setCustomLevels(prev => prev.map(l => (l.id === id ? lv : l)));
    return lv;
  }, []);

  const removeCustomLevel = useCallback(async (id, illustrationPath) => {
    await deleteCustomLevel(id, illustrationPath);
    setCustomLevels(prev => prev.filter(l => l.id !== id));
  }, []);

  const addKid = useCallback(async (input) => {
    const kid = await insertKid(input);
    setKids(prev => [...prev, kid]);
    return kid;
  }, []);

  const editKid = useCallback(async (id, fields) => {
    await updateKid(id, fields);
    setKids(prev => prev.map(k => k.id === id ? { ...k, ...fields } : k));
  }, []);

  const updateMe = useCallback(async (fields) => {
    await updateProfile(fields);
    setProfile(prev => prev ? { ...prev, ...fields } : prev);
  }, []);

  const createFamily = useCallback(async (role, custom = '') => {
    const fam = await apiCreateFamily(role, custom);
    setFamily(await fetchMyFamily());
    return fam;
  }, []);

  const joinFamily = useCallback(async (code, role, custom = '') => {
    await apiJoinFamily(code, role, custom);
    await loadAll();           // 加入后整库重拉（拿到家庭的孩子/回忆/小熊）
  }, [loadAll]);

  const leaveFamily = useCallback(async () => {
    await apiLeaveFamily();
    setFamily(null);
  }, []);

  const removeMember = useCallback(async (memberUserId) => {
    await removeFamilyMember(memberUserId);
    setFamily(await fetchMyFamily());
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const value = {
    levels, kids, memories, customLevels, profile, family, loading, loaded, error,
    refresh: loadAll, dismissError,
    getKid, kidLabel, kidDone, memoriesForKid, memoriesForLevel, allLevels,
    throwback, yearReview,
    frameLabel, levelWeight, weightedShuffle,
    addMemory, removeMemory, addKid, editKid, addCustomLevel, editCustomLevel, removeCustomLevel, updateMe,
    createFamily, joinFamily, leaveFamily, removeMember,
    FAMILY,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
      {error && <ErrorBanner message={error} onRetry={loadAll} onDismiss={dismissError} />}
    </DataContext.Provider>
  );
}

function ErrorBanner({ message, onRetry, onDismiss }: { message: string; onRetry: () => void; onDismiss: () => void }) {
  return (
    <View style={bannerStyles.container}>
      <Text style={bannerStyles.text}>{message}</Text>
      <View style={bannerStyles.actions}>
        <Pressable onPress={onRetry} style={bannerStyles.retryBtn}>
          <Text style={bannerStyles.retryText}>{t('common.retry')}</Text>
        </Pressable>
        <Pressable onPress={onDismiss} style={bannerStyles.dismissBtn}>
          <Text style={bannerStyles.dismissText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 48, left: 16, right: 16,
    backgroundColor: '#3B2E1E', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: { flex: 1, color: '#FAF3E6', fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  retryBtn: { backgroundColor: '#DE8C57', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dismissBtn: { padding: 4 },
  dismissText: { color: '#FAF3E6', fontSize: 16 },
});

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
