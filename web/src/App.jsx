import React, { useState, Suspense, lazy } from 'react';

const PracticeMode = lazy(() => import('./components/PracticeMode.jsx'));
const Admin = lazy(() => import('./components/Admin.jsx'));
const RoundGenerator = lazy(() => import('./components/RoundGenerator.jsx'));
import useRoundsQuestionsLazy from './data/useRoundsQuestionsLazy.js';
import { UserCog } from 'lucide-react';
import MuiThemeSwitch from './components/MuiThemeSwitch.jsx';
import { useEffect } from 'react';
import useAuth from './data/useAuth.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RoundGeneratorSEO, PracticeSEO } from './components/SEO.jsx';
import { useRoundSession } from './context/RoundSessionContext.jsx';
import { determineDark, loadThemePreference, saveThemePreference, subscribeToSystemTheme } from './data/theme.js';
// import AdSlot from './components/AdSlot.jsx'; // Uncomment when you have a real slot id

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}


export default function App() {
  const q = useRoundsQuestionsLazy();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Persist generated round across tab switches (and to IndexedDB) via context
  const { generatedPairs: persistedGenerated, setGeneratedPairs: setPersistedGenerated, pushGeneratedRound } = useRoundSession();
  // Derive tab from pathname
  const tab = location.pathname.startsWith('/practice') ? 'practice' : location.pathname.startsWith('/admin') ? 'admin' : 'generate';
  // Theme preference: 'system' | 'light' | 'dark'
  const [themePref, setThemePref] = useState('system');
  const [dark, setDark] = useState(() => {
    try { return document.documentElement.classList.contains('dark'); }
    catch { return determineDark('system'); }
  });
  // Track if user explicitly changed theme; avoids persisting defaults on first load
  const userChangedPrefRef = React.useRef(false);

  // Load saved preference on mount; default to system otherwise
  useEffect(() => {
    let mounted = true;
    loadThemePreference().then((pref) => {
      if (!mounted) return;
      setThemePref(pref);
      setDark(determineDark(pref));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    // Set background color for full page in dark mode
    if (dark) document.body.classList.add('dark-bg');
    else document.body.classList.remove('dark-bg');
    // Dynamically set theme-color; avoid duplicating tag
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', dark ? '#000000' : '#ffffff');
  }, [dark]);

  // Persist preference whenever it changes
  useEffect(() => {
    if (userChangedPrefRef.current) {
      saveThemePreference(themePref);
    }
  }, [themePref]);

  // When following system, subscribe to system theme changes and reflect immediately
  useEffect(() => {
    if (themePref !== 'system') return; // only follow system when set to system
    // Ensure initial sync to current system setting
    setDark(determineDark('system'));
    const unsubscribe = subscribeToSystemTheme((isDark) => {
      setDark(!!isDark);
    });
    return () => unsubscribe && unsubscribe();
  }, [themePref]);

  // Toggle bright red border around entire page in admin mode
  useEffect(() => {
    try {
      const cls = 'admin-border-on';
      const body = document.body;
      const html = document.documentElement;
      if (tab === 'admin') {
        body.classList.add(cls);
        html.classList.add(cls);
      } else {
        body.classList.remove(cls);
        html.classList.remove(cls);
      }
      return () => { body.classList.remove(cls); html.classList.remove(cls); };
    } catch {}
  }, [tab]);

  return (
  <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop">
  {/* Admin mode border style - fixed overlay so content cannot cover it */}
  <style>{`
    html.admin-border-on::before, body.admin-border-on::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      box-shadow: inset 0 0 0 6px #dc2626;
      z-index: 2147483647; /* max to sit above app */
    }
    @media (max-width: 480px) {
      html.admin-border-on::before, body.admin-border-on::before {
        box-shadow: inset 0 0 0 4px #dc2626;
      }
    }
  `}</style>
  {tab === 'practice' ? <PracticeSEO /> : <RoundGeneratorSEO />}
      <header className="header-bar">
        <div className="w-full px-4 py-3 flex items-center justify-between">
          <div className="brand-cluster">
            <img src="/logo.png" alt="Davidson Science Bowl Logo" className="w-8 h-8 rounded-lg" />
            <div className="font-semibold tracking-tight" style={{ color: '#550000' }}>Davidson Science Bowl</div>
          </div>
          <nav className="flex items-center gap-2">
            <TabButton active={tab === 'practice'} onClick={() => navigate('/practice')}>Practice</TabButton>
            <button
              onClick={() => navigate('/round-generator')}
              className={`btn btn-top-maroon ${tab==='generate' ? '' : ''}`}
              aria-pressed={tab==='generate'}
            >Round Generator</button>
                  {auth?.user?.uid === 'fkLJJ2R6HbdwqoXSxrLUybZ0IdH2' && (
                    <button
                      onClick={() => {
                        // Apply border immediately for visual feedback, then navigate
                        try {
                          document.body.classList.add('admin-border-on');
                          document.documentElement.classList.add('admin-border-on');
                        } catch {}
                        navigate('/admin');
                      }}
                      className={
                        // Force white text/icon on all states
                        `btn inline-flex items-center gap-2 font-semibold text-white ` +
                        (tab === 'admin'
                          ? 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
                          : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500')
                      }
                      aria-pressed={tab==='admin'}
                      title="Admin editor"
                    >
                      <UserCog size={18} className="text-white" />
                      <span className="text-white">Admin</span>
                    </button>
                  )}
            <div className="ml-4">
              <div className="relative inline-flex items-center group">
                {themePref !== 'system' && (
                  <button
                    type="button"
                    onClick={() => {
                      userChangedPrefRef.current = true;
                      setThemePref('system');
                      setDark(determineDark('system'));
                    }}
                    className="mr-2 hidden group-hover:inline-flex items-center px-2 py-1 rounded text-xs border border-black/10 dark:border-white/20 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-black dark:text-white hover:bg-white/90 dark:hover:bg-black/60 transition"
                    aria-label="Follow system theme"
                    title="Follow system"
                  >
                    Follow system
                  </button>
                )}
                <MuiThemeSwitch
                  checked={dark}
                  onChange={(next) => {
                    // Manual toggle = explicit user preference (stop following system)
                    userChangedPrefRef.current = true;
                    setThemePref(next ? 'dark' : 'light');
                    setDark(next);
                  }}
                />
              </div>
            </div>
            <div className="ml-3">
              {auth.loading ? (
                <div className="text-sm opacity-70">Loading…</div>
              ) : auth.user ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-80 max-w-[12rem] truncate">{auth.user.email || auth.user.displayName}</span>
                  <button className="btn btn-ghost" onClick={auth.logout}>Logout</button>
                </div>
              ) : (
                <Link to="/signin" className="btn btn-primary">Sign in</Link>
              )}
            </div>
          </nav>
        </div>
      </header>

  <main className="w-full px-4 py-8 text-black dark:text-white">
        {q.loadingTournaments && (
          <div className="glass p-6">Loading tournaments…</div>
        )}
        {q.errorTournaments && (
          <div className="glass p-6 text-red-600">Failed to load tournaments: {String(q.errorTournaments)}</div>
        )}
        {!q.loadingTournaments && !q.errorTournaments && (
          <div className="space-y-6">
            <Suspense fallback={<div className="glass p-6">Loading…</div>}>
              {tab === 'practice' ? (
                <PracticeMode lazy={q} />
              ) : tab === 'admin' ? (
                <Admin auth={auth} />
              ) : (
                <RoundGenerator
                  lazy={q}
                  auth={auth}
                  persistedGenerated={persistedGenerated}
                  setPersistedGenerated={setPersistedGenerated}
                  onNewRound={pushGeneratedRound}
                />
              )}
            </Suspense>
          </div>
        )}
      </main>
  <footer className="w-full px-4 pb-8 text-center text-black/60 dark:text-white/60">
        {/* Example Ad Placement (uncomment with real slot id) */}
        {false && (
          <div className="my-8 flex justify-center">
            {/* <AdSlot slot="1234567890" /> */}
          </div>
        )}
        <div className="space-y-2">
          <div>Built with Firebase • Vite • Tailwind</div>
          <div className="text-xs flex flex-wrap gap-2 justify-center" aria-label="Legal and policy links">
            <a href="/terms-of-service" className="hover:underline focus:outline-none focus:ring-1 focus:ring-current" rel="nofollow">Terms of Service</a>
            <span aria-hidden="true">•</span>
            <a href="/privacy-policy" className="hover:underline focus:outline-none focus:ring-1 focus:ring-current" rel="nofollow">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

//

// PracticeScaffold removed; PracticeMode now owns selection and lazy loading
