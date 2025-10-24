import React, { useMemo, useState } from 'react';

import PracticeMode from './components/PracticeMode.jsx';
import Admin from './components/Admin.jsx';
import RoundGenerator from './components/RoundGenerator.jsx';
import useRoundsQuestionsLazy from './data/useRoundsQuestionsLazy.js';
import { Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import useAuth from './data/useAuth.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RoundGeneratorSEO, PracticeSEO } from './components/SEO.jsx';
import { useRoundSession } from '../context/RoundSessionContext.jsx';
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
  // Derive tab from pathname
  const tab = location.pathname.startsWith('/practice') ? 'practice' : location.pathname.startsWith('/admin') ? 'admin' : 'generate';
  const [dark, setDark] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  // Persist generated round across tab switches (reset on page refresh) via context
  const { generatedPairs: persistedGenerated, setGeneratedPairs: setPersistedGenerated, pushGeneratedRound } = useRoundSession();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    // Set background color for full page in dark mode
    if (dark) {
      document.body.classList.add('dark-bg');
    } else {
      document.body.classList.remove('dark-bg');
    }
    // Dynamically set theme-color to eliminate maroon flash on overscroll
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', dark ? '#000000' : '#ffffff');
  }, [dark]);

  return (
  <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop">
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
                onClick={() => navigate('/admin')}
                className={`btn ${tab==='admin' ? 'btn-primary' : 'btn-ghost'}`}
                aria-pressed={tab==='admin'}
                title="Admin editor"
              >Admin</button>
            )}
            <button
              className="ml-4 btn btn-ghost px-2 py-2 rounded-full text-lg flex items-center gap-2"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setDark(d => !d)}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
              <span className="hidden sm:inline align-middle">{dark ? 'Light' : 'Dark'} Mode</span>
            </button>
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
            {tab === 'practice' ? (
              <PracticeMode lazy={q} />
            ) : tab === 'admin' ? (
              <Admin auth={auth} />
            ) : (
              <RoundGenerator lazy={q} auth={auth} persistedGenerated={persistedGenerated} setPersistedGenerated={setPersistedGenerated} onNewRound={pushGeneratedRound} />
            )}
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
  {/* <DebugRoundStorage /> */}
    </div>
  );
}

//

// PracticeScaffold removed; PracticeMode now owns selection and lazy loading
