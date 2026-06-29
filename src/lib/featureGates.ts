import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '100m.feature_gates';

export type FeatureGateId = 'mascot';

export const FEATURE_GATE_DEFS: Record<FeatureGateId, { devDefault: boolean }> = {
  mascot: { devDefault: true },
};

const ALL_IDS = Object.keys(FEATURE_GATE_DEFS) as FeatureGateId[];

let overrides: Record<string, boolean> = {};
const listeners = new Set<() => void>();

AsyncStorage.getItem(STORAGE_KEY)
  .then(raw => {
    if (raw) {
      overrides = JSON.parse(raw);
      listeners.forEach(l => l());
    }
  })
  .catch(() => {});

function save() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)).catch(() => {});
}

function emit() {
  listeners.forEach(l => l());
}

export function isFeatureEnabled(id: FeatureGateId): boolean {
  if (id in overrides) return overrides[id];
  return __DEV__ ? (FEATURE_GATE_DEFS[id]?.devDefault ?? false) : false;
}

export function setFeatureEnabled(id: FeatureGateId, enabled: boolean) {
  overrides = { ...overrides, [id]: enabled };
  save();
  emit();
}

export function resetFeatureGate(id: FeatureGateId) {
  const { [id]: _, ...rest } = overrides;
  overrides = rest;
  save();
  emit();
}

export function resetAllFeatureGates() {
  overrides = {};
  save();
  emit();
}

export function isOverridden(id: FeatureGateId): boolean {
  return id in overrides;
}

export function useFeatureGate(id: FeatureGateId): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    const cb = () => tick(n => n + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  return isFeatureEnabled(id);
}

export function getFeatureGateIds(): FeatureGateId[] {
  return ALL_IDS;
}
