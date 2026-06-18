jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('../../i18n', () => ({
  t: (key: string, vars?: any) => {
    if (vars?.count != null) return `${vars.count}`;
    return key;
  },
  getLang: () => 'zh',
}));

import {
  kidAge,
  NOW_YM,
  durationSince,
  yearFromDate,
  monthFromDate,
  dayFromDate,
  kidDoneFrom,
  memoriesForKidFrom,
  memoriesForLevelFrom,
  isMemoryLocked,
  isMemoryUnsealed,
  sealedLockedFrom,
  sealedAllFrom,
  meName,
  meChar,
  kidAgeAtYear,
  allLevelsFrom,
} from '../index';

describe('NOW_YM', () => {
  it('returns current year and month dynamically', () => {
    const now = new Date();
    expect(NOW_YM.y).toBe(now.getFullYear());
    expect(NOW_YM.m).toBe(now.getMonth() + 1);
  });
});

describe('kidAge', () => {
  it('returns null for null/undefined kid', () => {
    expect(kidAge(null)).toBeNull();
    expect(kidAge(undefined)).toBeNull();
  });

  it('returns null for "all" kid', () => {
    expect(kidAge({ id: 'all' })).toBeNull();
  });

  it('calculates age when birthday has passed', () => {
    const y = NOW_YM.y - 5;
    const m = NOW_YM.m - 1 || 12;
    expect(kidAge({ id: 'k1', y, m })).toBe(m === 12 ? 4 : 5);
  });

  it('calculates age when birthday has not passed', () => {
    const y = NOW_YM.y - 5;
    const m = NOW_YM.m + 1 > 12 ? 1 : NOW_YM.m + 1;
    const expected = NOW_YM.m + 1 > 12 ? 5 : 4;
    expect(kidAge({ id: 'k1', y, m })).toBe(expected);
  });

  it('returns 0 for newborn', () => {
    expect(kidAge({ id: 'k1', y: NOW_YM.y, m: NOW_YM.m })).toBe(0);
  });
});

describe('kidAgeAtYear', () => {
  it('returns null for null kid or all', () => {
    expect(kidAgeAtYear(null, 2026)).toBeNull();
    expect(kidAgeAtYear({ id: 'all' }, 2026)).toBeNull();
  });

  it('calculates age at a given year', () => {
    expect(kidAgeAtYear({ id: 'k1', y: 2020 }, 2026)).toBe(6);
  });

  it('returns 0 for birth year', () => {
    expect(kidAgeAtYear({ id: 'k1', y: 2026 }, 2026)).toBe(0);
  });
});

describe('yearFromDate / monthFromDate / dayFromDate', () => {
  it('parses ISO date string', () => {
    expect(yearFromDate('2025-03-15')).toBe(2025);
    expect(monthFromDate('2025-03-15')).toBe(3);
    expect(dayFromDate('2025-03-15')).toBe(15);
  });

  it('returns null for null/invalid input', () => {
    expect(yearFromDate(null)).toBeNull();
    expect(monthFromDate(undefined)).toBeNull();
    expect(dayFromDate('')).toBeNull();
  });
});

describe('kidDoneFrom', () => {
  const memories = [
    { kid: 'k1', levelNum: '01', perspective: 'parent' },
    { kid: 'k1', levelNum: '02', perspective: 'parent' },
    { kid: 'k2', levelNum: '01', perspective: 'parent' },
    { kid: 'all', levelNum: '03', perspective: 'together' },
  ];

  it('returns unique levelNum count for "all"', () => {
    // 01, 02, 03 — deduped by levelNum only
    expect(kidDoneFrom(memories, 'all')).toBe(3);
  });

  it('counts kid-specific + "all" memories (deduplicated by levelNum)', () => {
    // k1: 01, 02, 03(from 'all') → 3 unique
    expect(kidDoneFrom(memories, 'k1')).toBe(3);
    // k2: 01, 03(from 'all') → 2 unique
    expect(kidDoneFrom(memories, 'k2')).toBe(2);
  });

  it('deduplicates repeated records of the same activity', () => {
    const withRepeat = [
      ...memories,
      { kid: 'k1', levelNum: '01', perspective: 'parent' },
      { kid: 'k1', levelNum: '01', perspective: 'parent' },
    ];
    expect(kidDoneFrom(withRepeat, 'k1')).toBe(3);
    expect(kidDoneFrom(withRepeat, 'all')).toBe(3);
  });

  it('same levelNum from different perspectives still counts as one', () => {
    const multiPerspective = [
      { kid: 'k1', levelNum: '01', perspective: 'parent' },
      { kid: 'k1', levelNum: '01', perspective: 'child' },
    ];
    expect(kidDoneFrom(multiPerspective, 'k1')).toBe(1);
  });
});

describe('memoriesForKidFrom', () => {
  const memories = [
    { kid: 'k1', levelNum: '01' },
    { kid: 'k2', levelNum: '02' },
    { kid: 'all', levelNum: '03' },
  ];

  it('returns all memories for "all"', () => {
    expect(memoriesForKidFrom(memories, 'all')).toHaveLength(3);
  });

  it('includes kid-specific and "all" memories', () => {
    const result = memoriesForKidFrom(memories, 'k1');
    expect(result).toHaveLength(2);
  });
});

describe('memoriesForLevelFrom', () => {
  const memories = [
    { kid: 'k1', levelNum: '01', date: '2025-06-01' },
    { kid: 'k1', levelNum: '01', date: '2024-06-01' },
    { kid: 'k1', levelNum: '02', date: '2025-01-01' },
  ];

  it('filters by levelNum', () => {
    expect(memoriesForLevelFrom(memories, '01')).toHaveLength(2);
    expect(memoriesForLevelFrom(memories, '02')).toHaveLength(1);
    expect(memoriesForLevelFrom(memories, '99')).toHaveLength(0);
  });

  it('sorts by date descending', () => {
    const result = memoriesForLevelFrom(memories, '01');
    expect(result[0].date).toBe('2025-06-01');
    expect(result[1].date).toBe('2024-06-01');
  });
});

describe('isMemoryLocked / isMemoryUnsealed', () => {
  it('returns false for non-sealed memory', () => {
    expect(isMemoryLocked({ sealed: false })).toBe(false);
    expect(isMemoryUnsealed({ sealed: false })).toBe(false);
  });

  it('returns locked=true for future seal date', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const mem = { sealed: true, sealUntil: future };
    expect(isMemoryLocked(mem)).toBe(true);
    expect(isMemoryUnsealed(mem)).toBe(false);
  });

  it('returns unsealed=true for past seal date', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const mem = { sealed: true, sealUntil: past };
    expect(isMemoryLocked(mem)).toBe(false);
    expect(isMemoryUnsealed(mem)).toBe(true);
  });
});

describe('sealedLockedFrom / sealedAllFrom', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const memories = [
    { kid: 'k1', sealed: true, sealUntil: future },
    { kid: 'k1', sealed: true, sealUntil: past },
    { kid: 'k2', sealed: true, sealUntil: future },
    { kid: 'k1', sealed: false, sealUntil: null },
  ];

  it('sealedLockedFrom returns only locked ones', () => {
    expect(sealedLockedFrom(memories, 'all')).toHaveLength(2);
    expect(sealedLockedFrom(memories, 'k1')).toHaveLength(1);
  });

  it('sealedAllFrom returns all sealed', () => {
    expect(sealedAllFrom(memories, 'all')).toHaveLength(3);
    expect(sealedAllFrom(memories, 'k2')).toHaveLength(1);
  });
});

describe('meName / meChar', () => {
  it('returns fallback for null', () => {
    expect(meName(null)).toBe('role.parentFallback');
  });

  it('returns role label for standard role', () => {
    expect(meName({ role: '爸爸', custom: '' })).toBe('role.dad');
  });

  it('returns custom name for 其他 role', () => {
    expect(meName({ role: '其他', custom: '小姨' })).toBe('小姨');
  });

  it('meChar returns last character for zh', () => {
    expect(meChar({ role: '爸爸', custom: '' })).toBeTruthy();
  });
});

describe('allLevelsFrom', () => {
  it('merges custom and built-in levels', () => {
    const custom = [{ num: '★1' }];
    const builtin = [{ num: '01' }, { num: '02' }];
    expect(allLevelsFrom(custom, builtin)).toHaveLength(3);
    expect(allLevelsFrom(custom, builtin)[0].num).toBe('★1');
  });
});
