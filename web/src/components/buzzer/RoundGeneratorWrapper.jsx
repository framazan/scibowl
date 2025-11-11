import React, { Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoundSession } from '../../context/RoundSessionContext.jsx';
import useAuth from '../../data/useAuth.js';
import { commitRoundToGame } from '../../data/buzzer.firestore.js';
import useRoundsQuestionsLazy from '../../data/useRoundsQuestionsLazy.js';
import TabbedHeader from '../layout/TabbedHeader.jsx';

// Lazy-load RoundGenerator to avoid mixing static and dynamic imports
const LazyRoundGenerator = lazy(() => import('../RoundGenerator.jsx'));

function BuzzerLayout({ children }) {
  const auth = useAuth();
  return (
    <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop">
      <TabbedHeader auth={auth} />
      <main className="w-full px-4 py-8 app-main text-black dark:text-white">{children}</main>
      <footer className="w-full px-4 pb-8 text-center text-black/60 dark:text-white/60">
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

export default function RoundGeneratorWrapper() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { generatedPairs, setGeneratedPairs, pushGeneratedRound } = useRoundSession();
  const auth = useAuth();
  const lazy = useRoundsQuestionsLazy();

  async function useThisRound() {
    if (!generatedPairs || generatedPairs.length === 0) { window.alert?.('Generate a round first.'); return; }
    // Derive tournaments and categories from the pairs we have
    const tset = new Set();
    const cset = new Set();
    generatedPairs.forEach(p => {
      if (p?.tossup) { if (p.tossup.tournament) tset.add(p.tossup.tournament); if (p.tossup.category) cset.add(p.tossup.category); }
      if (p?.bonus) { if (p.bonus.tournament) tset.add(p.bonus.tournament); if (p.bonus.category) cset.add(p.bonus.category); }
    });
    await commitRoundToGame({ code, pairs: generatedPairs, meta: { tournaments: Array.from(tset), categories: Array.from(cset) } });
    navigate(`/buzzer/${code}/round`);
  }

  return (
    <BuzzerLayout>
      <div className="space-y-4">
        <div className="glass p-4 flex items-center justify-between">
          <div>
            <div className="text-sm opacity-70">Room</div>
            <div className="text-xl font-semibold">{code}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => navigate(`/buzzer/${code}`)}>Back to Lobby</button>
            <button className="btn btn-primary" onClick={useThisRound}>Use This Round</button>
          </div>
        </div>
        <Suspense fallback={<div className="glass p-6">Loading…</div>}>
          <LazyRoundGenerator
            lazy={lazy}
            auth={auth}
            persistedGenerated={generatedPairs}
            setPersistedGenerated={setGeneratedPairs}
            onNewRound={pushGeneratedRound}
          />
        </Suspense>
      </div>
    </BuzzerLayout>
  );
}
