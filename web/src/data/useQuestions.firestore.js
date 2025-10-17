import { getFirestoreDb } from '../firebase';
import { getDocs, collection, doc, getDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

// Loads all questions from Firestore, each document is a single question
export default function useQuestions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const db = getFirestoreDb();
        // Fetch tournament list from meta/tournaments document
        const metaDoc = await getDoc(doc(db, 'meta', 'tournaments'));
        if (!metaDoc.exists()) throw new Error('meta/tournaments document not found');
        const tournaments = metaDoc.data().list || [];
        const allQuestions = [];
        for (const t of tournaments) {
          const colRef = collection(db, t);
          const snap = await getDocs(colRef);
          for (const docSnap of snap.docs) {
            allQuestions.push({ ...docSnap.data(), id: docSnap.id, tournament: t });
          }
        }
        if (!cancelled) setData(allQuestions);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

// Only keep summarize for meta
