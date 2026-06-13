/* ════════════════════════════════════════════════════════════
   一百件事 — i18n（中 / 英）

   手写的轻量方案，风格与 theme/tokens.tsx 的 ThemeProvider 一致：
   - 不引入第三方库，无原生模块，改语言无需重建原生。
   - 既能在组件里用 useI18n()/useT()（切换语言会触发重渲染），
     也能在 data 层等纯函数里用模块级 t()（读全局当前语言）。
   ════════════════════════════════════════════════════════════ */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { zh } from './locales/zh';
import { en } from './locales/en';

export const LANGS = ['zh', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = { zh: '中文', en: 'English' };

const RESOURCES: Record<Lang, any> = { zh, en };
const STORAGE_KEY = 'app.lang';

/* ── 设备语言检测（纯 JS，无原生模块）──
   用 Hermes 的 Intl 读系统 locale；识别不到就回退中文。 */
export function detectDeviceLang(): Lang {
  try {
    const locale =
      (typeof Intl !== 'undefined' &&
        Intl.DateTimeFormat().resolvedOptions().locale) || '';
    if (/^zh/i.test(locale)) return 'zh';
    if (/^en/i.test(locale)) return 'en';
  } catch {
    // ignore — Intl 不可用时回退
  }
  return 'zh';
}

/* ── 读取已保存的语言；没有则跟随系统 ── */
export async function loadSavedLang(): Promise<Lang> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return detectDeviceLang();
}

/* ── 翻译查找 ── */

function lookup(dict: any, key: string): any {
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
}

function interpolate(str: string, vars?: Record<string, any>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : '',
  );
}

export function translate(lang: Lang, key: string, vars?: Record<string, any>): string {
  let val = lookup(RESOURCES[lang], key);
  // 漏翻时回退中文
  if (val == null && lang !== 'zh') val = lookup(RESOURCES.zh, key);
  // 还找不到就显示 key 本身，便于发现漏翻
  if (val == null) return key;

  // 复数：值为 { one, other } 且传了 count
  if (val && typeof val === 'object') {
    if (vars && 'count' in vars) {
      const n = Number(vars.count);
      const form = lang === 'zh' ? 'other' : n === 1 ? 'one' : 'other';
      val = val[form] != null ? val[form] : val.other;
    } else {
      return key; // 误用：对象但没给 count
    }
  }

  return interpolate(typeof val === 'string' ? val : String(val), vars);
}

// 取原始值（数组/对象，如协议正文这种结构化内容），漏翻回退中文。
export function translateRaw(lang: Lang, key: string): any {
  let val = lookup(RESOURCES[lang], key);
  if (val == null && lang !== 'zh') val = lookup(RESOURCES.zh, key);
  return val;
}

/* ── 模块级当前语言 + 独立 t()（供 data 层等非组件代码用）──
   组件在切换语言时会重渲染并重新调用这些纯函数，从而读到新语言。 */
let _lang: Lang = 'zh';
export function getLang(): Lang {
  return _lang;
}
export function setGlobalLang(l: Lang) {
  _lang = l;
}
export function t(key: string, vars?: Record<string, any>): string {
  return translate(_lang, key, vars);
}
export function tRaw(key: string): any {
  return translateRaw(_lang, key);
}

/* ── Context（切换语言触发重渲染）── */

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, any>) => string;
  tRaw: (key: string) => any;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang || 'zh';
    setGlobalLang(l); // 首帧前同步全局，避免闪烁
    return l;
  });

  const setLang = useCallback((l: Lang) => {
    setGlobalLang(l);
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const tBound = useCallback(
    (key: string, vars?: Record<string, any>) => translate(lang, key, vars),
    [lang],
  );
  const tRawBound = useCallback((key: string) => translateRaw(lang, key), [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: tBound, tRaw: tRawBound }),
    [lang, setLang, tBound, tRawBound],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/* 只取 t 的便捷 hook（同时确保组件订阅了语言变化）。 */
export function useT() {
  return useI18n().t;
}

export { I18nContext };
