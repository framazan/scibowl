import React, { useState, Suspense, lazy } from 'react';

const PracticeMode = lazy(() => import('./components/PracticeMode.jsx'));
const Admin = lazy(() => import('./components/Admin.jsx'));
const RoundGenerator = lazy(() => import('./components/RoundGenerator.jsx'));
import useRoundsQuestionsLazy from './data/useRoundsQuestionsLazy.js';
import useAuth from './data/useAuth.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RoundGeneratorSEO, PracticeSEO } from './components/SEO.jsx';
import { useRoundSession } from './context/RoundSessionContext.jsx';
// import AdSlot from './components/AdSlot.jsx'; // Uncomment when you have a real slot id
import Layout from './components/layout/Layout.jsx';
import Loading from './components/layout/Loading.jsx';


export default function App() {
  const q = useRoundsQuestionsLazy();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Persist generated round across tab switches (and to IndexedDB) via context
  const { generatedPairs: persistedGenerated, setGeneratedPairs: setPersistedGenerated, pushGeneratedRound } = useRoundSession();
  // Derive tab from pathname
  const tab = location.pathname.startsWith('/practice')
    ? 'practice'
    : location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/buzzer')
    ? 'buzzer'
    : 'generate';

  return (
    <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop">
      {/* Admin mode border style - fixed overlay so content cannot cover it */}
      {tab === 'practice' ? <PracticeSEO /> : <RoundGeneratorSEO />}
      <Layout auth={auth}>
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
      </Layout>
    </div>
  );
}

//

// PracticeScaffold removed; PracticeMode now owns selection and lazy loading
