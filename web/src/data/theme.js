// Theme preference management with localStorage (source of truth) + IndexedDB mirror
// Values: 'system' | 'light' | 'dark'
import { idbGet, idbSet } from './idb.js';

const THEME_PREF_KEY = 'themePreference';

export function getSystemPrefersDark() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

export function determineDark(pref) {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  // system
  return getSystemPrefersDark();
}

export async function loadThemePreference() {
  // Prefer localStorage so it matches the inline boot script and user-facing behavior
  try {
    const v = localStorage.getItem(THEME_PREF_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  // Fallback to IndexedDB if LS is unavailable or empty
  try {
    const v = await idbGet(THEME_PREF_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'system';
}

export async function saveThemePreference(pref) {
  try {
    await idbSet(THEME_PREF_KEY, pref);
  } catch {}
  try {
    localStorage.setItem(THEME_PREF_KEY, pref);
  } catch {}
}

export function subscribeToSystemTheme(onChange) {
  let mql;
  try {
    mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  } catch {}
  if (!mql) return () => {};
  const handler = (e) => {
    onChange(!!e.matches);
  };
  if (mql.addEventListener) mql.addEventListener('change', handler);
  else if (mql.addListener) mql.addListener(handler);
  return () => {
    if (mql.removeEventListener) mql.removeEventListener('change', handler);
    else if (mql.removeListener) mql.removeListener(handler);
  };
}
