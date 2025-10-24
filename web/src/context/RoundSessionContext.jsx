import React, { createContext, useContext, useEffect, useState } from 'react';
import { idbSet, idbDel } from '../data/idb.js';

const RoundSessionContext = createContext(null);

export function RoundSessionProvider({ children }) {
  // Start empty; hydrate from IndexedDB asynchronously
  const [generatedPairsState, _setGeneratedPairsState] = useState([]);
  const [history, setHistory] = useState([]);
  const toMinimal = (pairs) => {
    try {
      if (!Array.isArray(pairs)) return [];
      return pairs.map(p => ({ t: p?.tossup?.id || null, b: p?.bonus?.id || null }));
    } catch { return []; }
  };
  const toMeta = (pairs) => {
    try {
      if (!Array.isArray(pairs)) return [];
      return pairs.map(p => ({
        tu: p?.tossup ? { id: p.tossup.id, tournament: p.tossup.tournament } : null,
        bo: p?.bonus ? { id: p.bonus.id, tournament: p.bonus.tournament } : null,
      }));
    } catch { return []; }
  };
  const setGeneratedPairs = (next) => {
    _setGeneratedPairsState(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      try {
        window.__sbGeneratedPairs = value;
        // Persist to IndexedDB
        idbSet('sb_current_round', toMinimal(value));
        idbSet('sb_current_round_meta', toMeta(value));
      } catch {}
      return value;
    });
  };
  const pushGeneratedRound = (pairs) => {
    setHistory(prev => [...prev, pairs]); // session-only history (cleared on refresh)
    setGeneratedPairs(pairs);
  };
  // On mount: clear any persisted history from prior sessions.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      // Clear any previously persisted history after refresh (one-time per load)
      try { await idbDel('sb_generated_history'); } catch {}
      try { await idbDel('sb_generated_history_meta'); } catch {}
      // Also clear any previously persisted current round so we ignore cache after refresh
      try { await idbDel('sb_current_round'); } catch {}
      try { await idbDel('sb_current_round_meta'); } catch {}
    })();
    return () => { alive = false; };
  }, []);
  return (
    <RoundSessionContext.Provider value={{ generatedPairs: generatedPairsState, setGeneratedPairs, history, pushGeneratedRound }}>
      {children}
    </RoundSessionContext.Provider>
  );
}

export function useRoundSession() {
  const ctx = useContext(RoundSessionContext);
  if (!ctx) throw new Error('useRoundSession must be used within a RoundSessionProvider');
  return ctx;
}
