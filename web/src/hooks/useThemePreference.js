import React from 'react';
import { determineDark, loadThemePreference, saveThemePreference, subscribeToSystemTheme } from '../data/theme.js';

// Manages theme preference (system/light/dark), applies HTML/body classes and theme-color meta
export default function useThemePreference() {
  const [themePref, setThemePref] = React.useState('system'); // 'system' | 'light' | 'dark'
  const [dark, setDark] = React.useState(() => {
    try { return document.documentElement.classList.contains('dark'); }
    catch { return determineDark('system'); }
  });

  // Cross-component sync: listen for and emit theme change events
  React.useEffect(() => {
    const onThemeChange = (e) => {
      const detail = (e && e.detail) || {};
      if (detail.pref === 'light' || detail.pref === 'dark' || detail.pref === 'system') {
        // Avoid unnecessary updates
        if (detail.pref !== themePref) setThemePref(detail.pref);
      }
      if (typeof detail.dark === 'boolean') {
        if (detail.dark !== dark) setDark(detail.dark);
      }
    };
    window.addEventListener('theme:change', onThemeChange);
    return () => window.removeEventListener('theme:change', onThemeChange);
  }, [themePref, dark]);

  // Load saved preference on mount
  React.useEffect(() => {
    let mounted = true;
    loadThemePreference().then((pref) => {
      if (!mounted) return;
      setThemePref(pref);
      setDark(determineDark(pref));
    });
    return () => { mounted = false; };
  }, []);

  // Apply classes and meta tag for theme
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    if (dark) document.body.classList.add('dark-bg');
    else document.body.classList.remove('dark-bg');

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', dark ? '#000000' : '#ffffff');
  }, [dark]);

  // Persist preference when it changes
  React.useEffect(() => {
    try { saveThemePreference(themePref); } catch {}
    // Broadcast theme changes so other hook instances update immediately
    try {
      window.dispatchEvent(new CustomEvent('theme:change', { detail: { pref: themePref, dark: determineDark(themePref) } }));
    } catch {}
  }, [themePref]);

  // Follow system changes when in system mode
  React.useEffect(() => {
    if (themePref !== 'system') return;
    // Sync immediately
    setDark(determineDark('system'));
    const unsubscribe = subscribeToSystemTheme((isDark) => setDark(!!isDark));
    return () => unsubscribe && unsubscribe();
  }, [themePref]);

  // When user toggles dark directly, set explicit pref
  const setDarkExplicit = React.useCallback((next) => {
    setThemePref(next ? 'dark' : 'light');
    setDark(!!next);
    // Ensure immediate cross-component propagation
    try {
      window.dispatchEvent(new CustomEvent('theme:change', { detail: { pref: next ? 'dark' : 'light', dark: !!next } }));
    } catch {}
  }, []);

  return { themePref, setThemePref, dark, setDark: setDarkExplicit };
}
