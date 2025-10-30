import { getFirestoreDb } from '../firebase';
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  query,
  where,
  addDoc,
  orderBy,
  limit,
  deleteDoc,
} from 'firebase/firestore';

// Games collection schema (client-only, no Cloud Functions):
// games/{code}:
//   code: string
//   hostUid: string
//   createdAt: timestamp
//   phase: 'lobby' | 'round'
//   state: {
//     buzzerOpen: boolean,
//     cycle: number,
//     winnerUid: string|null,
//     winnerName: string|null,
//     winnerAt: timestamp|null
//   }
//   roundPairs?: Array<{ tossupId: string|null, bonusId: string|null }>
// subcollections:
//   players/{uid}: { uid, displayName, joinedAt, score, stats: { correct, incorrect, interruptsCorrect, interruptsIncorrect } }

function gamesCol(db) { return collection(db, 'games'); }
function gameRef(db, code) { return doc(db, 'games', String(code).toUpperCase()); }
function playerRef(db, code, uid) { return doc(db, 'games', String(code).toUpperCase(), 'players', uid); }

export function generateCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createGame({ hostUid, hostName }) {
  if (!hostUid) throw new Error('Not authenticated');
  const db = getFirestoreDb();
  // Try a few codes to avoid rare collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const ref = gameRef(db, code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    await setDoc(ref, {
      code,
      hostUid,
      createdAt: serverTimestamp(),
      phase: 'lobby',
      state: { buzzerOpen: false, cycle: 0, winnerUid: null, winnerName: null, winnerAt: null },
    });
    return code;
  }
  throw new Error('Failed to create game code');
}

export async function joinGame({ code, uid, displayName }) {
  if (!uid) throw new Error('Not authenticated');
  const db = getFirestoreDb();
  const ref = gameRef(db, code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Game not found');
  await setDoc(playerRef(db, code, uid), {
    uid,
    displayName: displayName || 'Player',
    joinedAt: serverTimestamp(),
    score: 0,
    stats: { correct: 0, incorrect: 0, interruptsCorrect: 0, interruptsIncorrect: 0 },
  }, { merge: true });
  return true;
}

export function listenGame({ code, onGame, onPlayers }) {
  const db = getFirestoreDb();
  const unsubGame = onSnapshot(gameRef(db, code), (snap) => {
    onGame?.(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
  const unsubPlayers = onSnapshot(collection(db, 'games', String(code).toUpperCase(), 'players'), (qs) => {
    const list = [];
    qs.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a,b) => (a.displayName||'').localeCompare(b.displayName||''));
    onPlayers?.(list);
  });
  return () => { try { unsubGame(); } catch {} try { unsubPlayers(); } catch {} };
}

export async function setBuzzerOpen({ code, open, actorUid }) {
  const db = getFirestoreDb();
  const ref = gameRef(db, code);
  // When opening: increment cycle and clear winner
  if (open) {
    await updateDoc(ref, {
      'state.buzzerOpen': true,
      'state.cycle': (await getDoc(ref)).data()?.state?.cycle + 1 || 1,
      'state.winnerUid': null,
      'state.winnerName': null,
      'state.winnerAt': null,
    }).catch(async () => {
      // Fallback to transaction to safely increment
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists()) throw new Error('Game missing');
        const cur = s.data() || {};
        const st = cur.state || {};
        const nextCycle = (typeof st.cycle === 'number' ? st.cycle : 0) + 1;
        tx.update(ref, {
          'state.buzzerOpen': true,
          'state.cycle': nextCycle,
          'state.winnerUid': null,
          'state.winnerName': null,
          'state.winnerAt': null,
        });
      });
    });
  } else {
    await updateDoc(ref, { 'state.buzzerOpen': false });
  }
}

// Attempt to buzz: atomically set winner if none for current cycle and buzzer is open.
export async function attemptBuzz({ code, uid, displayName }) {
  const db = getFirestoreDb();
  const ref = gameRef(db, code);
  try {
    const result = await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error('Game missing');
      const data = s.data() || {};
      const st = data.state || {};
      if (!st.buzzerOpen) return { ok: false, reason: 'closed', winnerUid: st.winnerUid || null };
      if (st.winnerUid) return { ok: false, reason: 'already', winnerUid: st.winnerUid };
      // Claim winner
      tx.update(ref, {
        'state.winnerUid': uid,
        'state.winnerName': displayName || null,
        'state.winnerAt': serverTimestamp(),
        'state.buzzerOpen': false, // auto-close on first buzz
      });
      return { ok: true, winnerUid: uid };
    });
    return result;
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function clearBuzz({ code }) {
  const db = getFirestoreDb();
  const ref = gameRef(db, code);
  await updateDoc(ref, {
    'state.winnerUid': null,
    'state.winnerName': null,
    'state.winnerAt': null,
  });
}

export async function transferHost({ code, newHostUid }) {
  const db = getFirestoreDb();
  await updateDoc(gameRef(db, code), { hostUid: newHostUid });
  // If the new host was a player, remove them from players
  const pref = playerRef(db, code, newHostUid);
  try {
    await deleteDoc(pref);
  } catch {} // ignore if not exists
}

export async function commitRoundToGame({ code, pairs, meta = {} }) {
  const db = getFirestoreDb();
  const ref = gameRef(db, code);
  const minimal = (Array.isArray(pairs) ? pairs : []).map(p => ({
    tossupId: p?.tossup?.id || p?.tossupId || null,
    bonusId: p?.bonus?.id || p?.bonusId || null,
  }));
  await updateDoc(ref, {
    roundPairs: minimal,
    phase: 'round',
    roundMeta: {
      questionType: meta.questionType || null,
      count: minimal.length,
      categories: meta.categories || [],
      tournaments: meta.tournaments || [],
    },
  });
}

export async function updatePlayerStats({ code, uid, delta = {} }) {
  const db = getFirestoreDb();
  const pref = playerRef(db, code, uid);
  const snap = await getDoc(pref);
  const cur = snap.exists() ? (snap.data() || {}) : {};
  const stats = cur.stats || {};
  const next = {
    stats: {
      correct: (stats.correct || 0) + (delta.correct || 0),
      incorrect: (stats.incorrect || 0) + (delta.incorrect || 0),
      interruptsCorrect: (stats.interruptsCorrect || 0) + (delta.interruptsCorrect || 0),
      interruptsIncorrect: (stats.interruptsIncorrect || 0) + (delta.interruptsIncorrect || 0),
    },
    score: (cur.score || 0) + (delta.points || 0),
  };
  await updateDoc(pref, next);
}

export async function setPhase({ code, phase }) {
  const db = getFirestoreDb();
  await updateDoc(gameRef(db, code), { phase });
}
