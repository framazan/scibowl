import { useEffect, useMemo, useRef, useState } from 'react';
import { getFirestoreDb } from '../firebase';
import { collection, getDoc, getDocs, doc } from 'firebase/firestore';

// Lazily load questions per tournament. Always loads tournament list first.
export default function useQuestionsLazy() {
  const [rounds, setRounds] = useState([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [errorRounds, setErrorRounds] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map()); // round -> questions[]

  const STALE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRounds(true);
        // First, show cached rounds
        const cached = await idbGet('meta:rounds');
        if (cached && !cancelled) setRounds(cached.list || []);
        // Always revalidate against server
        const db = getFirestoreDb();
        const colRef = collection(db, 'rounds');
        const snap = await getDocs(colRef);
        const remoteList = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        if (!cancelled) setRounds(remoteList);
        idbSet('meta:rounds', { list: remoteList, updatedAt: Date.now() });
      } catch (e) {
        if (!cancelled) setErrorRounds(e);
      } finally {
        if (!cancelled) setLoadingRounds(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Minimal IndexedDB helpers
  const dbRef = useRef(null);
  function openDb() {
    return new Promise((resolve, reject) => {
      if (dbRef.current) return resolve(dbRef.current);
      const req = indexedDB.open('scibowl-cache', 1);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tournamentQuestions')) {
          db.createObjectStore('tournamentQuestions');
        }
      };
      req.onsuccess = () => { dbRef.current = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('tournamentQuestions', 'readonly');
        const store = tx.objectStore('tournamentQuestions');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch { return null; }
  }
  async function idbSet(key, value) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('tournamentQuestions', 'readwrite');
        const store = tx.objectStore('tournamentQuestions');
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // ignore cache failures
    }
  }

  async function ensureLoaded(forRounds, { force = false } = {}) {
    const db = getFirestoreDb();
    const toFetch = (forRounds || []).filter(r => !cacheRef.current.has(r));
    if (toFetch.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      for (const r of toFetch) {
        // Try cache first (with TTL)
        const cached = await idbGet(`r:${r}`);
        const isFresh = cached && typeof cached.updatedAt === 'number' && (Date.now() - cached.updatedAt) <= STALE_MS;
        if (cached && isFresh && Array.isArray(cached.data)) {
          cacheRef.current.set(r, cached.data);
          continue;
        }
        if (cached && !force && Array.isArray(cached.data)) {
          cacheRef.current.set(r, cached.data);
        }
        // Fetch from network if force or stale/missing
        if (force || !isFresh) {
          const docRef = doc(db, 'rounds', r);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data().questions || [];
            cacheRef.current.set(r, data);
            idbSet(`r:${r}`, { data, updatedAt: Date.now() });
          }
        }
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  function getLoadedQuestions(selectedRounds) {
    const list = [];
    for (const r of selectedRounds || []) {
      const arr = cacheRef.current.get(r);
      if (arr) list.push(...arr);
    }
    return list;
  }

  return {
    rounds,
    loadingRounds,
    errorRounds,
    loading,
    error,
    ensureLoaded,
    getLoadedQuestions,
  };
}
