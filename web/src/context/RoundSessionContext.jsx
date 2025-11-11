import React, { createContext, useContext, useEffect, useState } from 'react';
import { idbSet } from '../data/idb.js';
import { pushCurrentMeta, readSessionRoundsMeta } from '../data/sessionRoundsCache.js';

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
        // Keep legacy keys for backward compatibility
        idbSet('sb_current_round', toMinimal(value));
        idbSet('sb_current_round_meta', toMeta(value));
      } catch {}
      return value;
    });
  };
  const pushGeneratedRound = (pairs) => {
    // Append to in-memory history for this session
    setHistory(prev => [...prev, pairs]);
    setGeneratedPairs(pairs);
    // Update session-scoped cache (persist across refresh, reset on tab close)
    try { pushCurrentMeta(toMeta(pairs)); } catch {}
  };
  // On mount: ensure a session id exists by touching the session cache (no destructive clears).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      try { await readSessionRoundsMeta(); } catch {}
    })();
    return () => { alive = false; };
  }, []);
  return (
    <RoundSessionContext.Provider value={{ generatedPairs: generatedPairsState, setGeneratedPairs, history, setHistory, pushGeneratedRound }}>
      {children}
    </RoundSessionContext.Provider>
  );
}

export function useRoundSession() {
  const ctx = useContext(RoundSessionContext);
  if (!ctx) throw new Error('useRoundSession must be used within a RoundSessionProvider');
  return ctx;
}
