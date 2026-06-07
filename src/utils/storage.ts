import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  me: '@me-identity',
  appearance: '@appearance',
  familyExtras: '@family-extras',
};

/* ── Me (identity) ── */

export async function getMe() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.me);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setMe(m) {
  try {
    await AsyncStorage.setItem(KEYS.me, JSON.stringify(m));
  } catch {
    // silently fail
  }
}

/* ── Appearance (theme preset / dark mode / accent) ── */

export async function getAppearance() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.appearance);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setAppearance(v) {
  try {
    await AsyncStorage.setItem(KEYS.appearance, JSON.stringify(v));
  } catch {
    // silently fail
  }
}

/* ── Family extras (additional family members beyond ROLES) ── */

export async function getFamilyExtras() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.familyExtras);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setFamilyExtras(list) {
  try {
    await AsyncStorage.setItem(KEYS.familyExtras, JSON.stringify(list));
  } catch {
    // silently fail
  }
}

/* ── Family count ── */

export function familyCount(kids, extras) {
  // kids array length + extras array length + 1 for the primary user
  const kidCount = Array.isArray(kids) ? kids.length : 0;
  const extraCount = Array.isArray(extras) ? extras.length : 0;
  return kidCount + extraCount + 1;
}
