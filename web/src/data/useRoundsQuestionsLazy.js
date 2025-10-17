import { useEffect, useRef, useState, useMemo } from 'react';
import { getFirestoreDb } from '../firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

// New hook: loads list of tournaments (meta/tournaments) then lazily loads round docs for selected tournaments.
// It flattens tossups + bonuses into question objects for compatibility with existing RoundGenerator which expects flat question list.
// Interface kept similar to old useQuestionsLazy: tournaments[], ensureLoaded(tournaments), getLoadedQuestions(selectedTournaments)
// Additional: roundsIndex map for each tournament -> array of round ids; ability to force reload.
export default function useRoundsQuestionsLazy(options = {}) {
  const ROUND_SUBCOL = options.roundSubcollection || 'rounds';
  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [errorTournaments, setErrorTournaments] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Cache: tournament -> { rounds: { [roundId]: roundDoc }, flatQuestions: [] }
  const cacheRef = useRef(new Map());
  const STALE_MS = 5 * 24 * 60 * 60 * 1000; // same as old hook

  // IndexedDB for persistence
  const dbRef = useRef(null);
  function openDb() {
    return new Promise((resolve, reject) => {
      if (dbRef.current) return resolve(dbRef.current);
      const req = indexedDB.open('scibowl-rounds-cache', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('rounds')) db.createObjectStore('rounds'); // key: meta:tournaments OR t::<tournament>
      };
      req.onsuccess = () => { dbRef.current = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    try { const db = await openDb(); return await new Promise((res, rej) => { const tx = db.transaction('rounds', 'readonly'); const st = tx.objectStore('rounds'); const g = st.get(key); g.onsuccess = () => res(g.result || null); g.onerror = () => rej(g.error); }); } catch { return null; }
  }
  async function idbSet(key, value) {
    try { const db = await openDb(); await new Promise((res, rej) => { const tx = db.transaction('rounds', 'readwrite'); const st = tx.objectStore('rounds'); const p = st.put(value, key); p.onsuccess = () => res(); p.onerror = () => rej(p.error); }); } catch {}
  }

  // Load tournaments list (local first, then remote)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingTournaments(true);
        const cached = await idbGet('meta:tournaments');
        if (cached && !cancelled) setTournaments(cached.list || []);
        const db = getFirestoreDb();
        const metaDoc = await getDoc(doc(db, 'meta', 'tournaments'));
        if (!metaDoc.exists()) throw new Error('meta/tournaments document not found');
        const remoteList = metaDoc.data().list || [];
        if (!cancelled) setTournaments(remoteList);
        idbSet('meta:tournaments', { list: remoteList, updatedAt: Date.now() });
      } catch (e) {
        if (!cancelled) setErrorTournaments(e);
      } finally {
        if (!cancelled) setLoadingTournaments(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Ensure tournaments' rounds are loaded (light by default: just counts + flatten entire rounds since we need all questions for generator anyway)
  async function ensureLoaded(forTournaments, { force = false } = {}) {
    const list = (forTournaments || []).filter(Boolean);
    if (list.length === 0) return;
    setLoading(true); setError(null);
    const db = getFirestoreDb();
    try {
      for (const t of list) {
        const existing = cacheRef.current.get(t);
        if (existing && !force) continue; // already loaded
        // Try cache store (persistent) for flat questions
        const cached = await idbGet(`t:${t}`);
        const fresh = cached && typeof cached.updatedAt === 'number' && (Date.now() - cached.updatedAt) <= STALE_MS;
        if (cached && fresh && !force) {
          cacheRef.current.set(t, cached.payload);
          continue;
        }
        // Fetch all round docs under tournaments/<t>/rounds
        const subCol = collection(db, 'tournaments', t, ROUND_SUBCOL);
        const snap = await getDocs(subCol);
        const rounds = {};
        const flat = [];
        snap.forEach(d => {
          const data = d.data();
          const rid = d.id;
          rounds[rid] = { id: rid, ...data };
          const tossups = Array.isArray(data.tossups) ? data.tossups : [];
          const bonuses = Array.isArray(data.bonuses) ? data.bonuses : [];
          for (const q of tossups) {
            const origId = q._origId || q.origId || q.id;
            flat.push({ ...q, id: origId || `${t}__${rid}__tu__${q.question_number}`, tournament: t, round: rid });
          }
          for (const q of bonuses) {
            const origId = q._origId || q.origId || q.id;
            flat.push({ ...q, id: origId || `${t}__${rid}__bo__${q.question_number}`, tournament: t, round: rid });
          }
        });
        cacheRef.current.set(t, { rounds, flatQuestions: flat });
        idbSet(`t:${t}`, { payload: { rounds, flatQuestions: flat }, updatedAt: Date.now() });
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  function getLoadedQuestions(selected) {
    const out = [];
    for (const t of selected || []) {
      const cached = cacheRef.current.get(t);
      if (cached?.flatQuestions) out.push(...cached.flatQuestions);
    }
    return out;
  }

  // Additional helper: list rounds for a tournament (after loaded)
  function getRounds(tournament) {
    const cached = cacheRef.current.get(tournament);
    if (!cached) return [];
    return Object.values(cached.rounds).sort((a,b)=> a.round?.localeCompare?.(b.round || '') || 0);
  }

  return {
    tournaments,
    loadingTournaments,
    errorTournaments,
    loading,
    error,
    ensureLoaded,
    getLoadedQuestions,
    getRounds,
  };
}
