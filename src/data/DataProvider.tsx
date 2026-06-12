import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchLevels, fetchKids, fetchMemories, fetchMascots,
  fetchWardrobe, fetchCustomLevels, fetchProfile, insertCustomLevel,
  insertMemory, insertKid, updateProfile, deleteMemory,
  getKidFrom, kidLabelFrom, kidDoneFrom, memoriesForKidFrom,
  allLevelsFrom, getMascotFrom, wardrobeStateFrom, nextUnlockFrom,
  throwbackFrom, yearReviewFrom, levelWeightFrom, weightedShuffleFrom,
  frameLabelFrom,
  FAMILY,
  fetchMyFamily, createFamily as apiCreateFamily, joinFamily as apiJoinFamily,
  removeFamilyMember, clearFamilyCache,
} from './index';

const DataContext = createContext(null);

export function DataProvider({ children, userId }) {
  const [levels, setLevels] = useState([]);
  const [kids, setKids] = useState([]);
  const [memories, setMemories] = useState([]);
  const [mascots, setMascots] = useState({});
  const [wardrobe, setWardrobe] = useState([]);
  const [customLevels, setCustomLevels] = useState([]);
  const [profile, setProfile] = useState(null);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    clearFamilyCache();
    setLoading(true);
    try {
      const [lv, ki, me, ma, wa, cl, pr, fam] = await Promise.all([
        fetchLevels(), fetchKids(), fetchMemories(), fetchMascots(),
        fetchWardrobe(), fetchCustomLevels(), fetchProfile(), fetchMyFamily(),
      ]);
      setLevels(lv);
      setKids(ki);
      setMemories(me);
      setMascots(ma);
      setWardrobe(wa);
      setCustomLevels(cl);
      setProfile(pr);
      setFamily(fam);
    } catch (e) {
      console.error('DataProvider loadAll error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const getKid = useCallback((id) => getKidFrom(kids, id), [kids]);
  const kidLabel = useCallback((id) => kidLabelFrom(kids, id), [kids]);
  const kidDone = useCallback((id) => kidDoneFrom(memories, id), [memories]);
  const memoriesForKid = useCallback((id) => memoriesForKidFrom(memories, id), [memories]);
  const allLevels = useCallback(() => allLevelsFrom(customLevels, levels), [customLevels, levels]);
  const getMascot = useCallback((id) => getMascotFrom(mascots, id), [mascots]);
  const wardrobeState = useCallback((done) => wardrobeStateFrom(wardrobe, done), [wardrobe]);
  const nextUnlock = useCallback((done) => nextUnlockFrom(wardrobe, done), [wardrobe]);
  const throwback = useCallback((kidId?) => throwbackFrom(memories, kidId), [memories]);
  const yearReview = useCallback((kidId?) => yearReviewFrom(memories, mascots, wardrobe, kidId), [memories, mascots, wardrobe]);
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

  const addKid = useCallback(async (input) => {
    const kid = await insertKid(input);
    setKids(prev => [...prev, kid]);
    return kid;
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

  const removeMember = useCallback(async (memberUserId) => {
    await removeFamilyMember(memberUserId);
    setFamily(await fetchMyFamily());
  }, []);

  const value = {
    levels, kids, memories, mascots, wardrobe, customLevels, profile, family, loading,
    refresh: loadAll,
    getKid, kidLabel, kidDone, memoriesForKid, allLevels,
    getMascot, wardrobeState, nextUnlock, throwback, yearReview,
    frameLabel, levelWeight, weightedShuffle,
    addMemory, removeMemory, addKid, addCustomLevel, updateMe,
    createFamily, joinFamily, removeMember,
    FAMILY,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
