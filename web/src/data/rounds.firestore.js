import { getFirestoreDb } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, runTransaction, arrayRemove } from 'firebase/firestore';

// Schema: users/{uid}/rounds/{autoId}
// round document: {
//   createdAt, title, filters, pairs: [{tossupId, bonusId}], tournaments: [], questionType, count
// }

// Minimal IndexedDB for user rounds (separate DB to avoid version conflicts)
const ROUNDS_DB_NAME = 'scibowl-user-cache';
const ROUNDS_DB_VERSION = 1;
let roundsDbPromise = null;
const STALE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

function openRoundsDb() {
  if (roundsDbPromise) return roundsDbPromise;
  roundsDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(ROUNDS_DB_NAME, ROUNDS_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('roundsIndex')) db.createObjectStore('roundsIndex'); // key: uid -> entries object
      if (!db.objectStoreNames.contains('roundDetails')) db.createObjectStore('roundDetails'); // key: `${uid}::${roundId}` -> detail
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return roundsDbPromise;
}

async function idbGetIndex(uid) {
  try {
    const db = await openRoundsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('roundsIndex', 'readonly');
      const store = tx.objectStore('roundsIndex');
      const req = store.get(uid);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
async function idbSetIndex(uid, payload) {
  try {
    const db = await openRoundsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('roundsIndex', 'readwrite');
      const store = tx.objectStore('roundsIndex');
  const req = store.put(payload, uid);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore cache failures
  }
}
async function idbGetDetail(uid, roundId) {
  try {
    const db = await openRoundsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('roundDetails', 'readonly');
      const store = tx.objectStore('roundDetails');
      const req = store.get(`${uid}::${roundId}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
async function idbSetDetail(uid, roundId, detail) {
  try {
    const db = await openRoundsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('roundDetails', 'readwrite');
      const store = tx.objectStore('roundDetails');
  const req = store.put(detail, `${uid}::${roundId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore cache failures
  }
}
async function idbDeleteDetail(uid, roundId) {
  try {
    const db = await openRoundsDb();
    await new Promise((resolve) => {
      const tx = db.transaction('roundDetails', 'readwrite');
      const store = tx.objectStore('roundDetails');
      const req = store.delete(`${uid}::${roundId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore cache failures
  }
}
async function idbListDetailIds(uid) {
  try {
    const db = await openRoundsDb();
    return await new Promise((resolve) => {
      const tx = db.transaction('roundDetails', 'readonly');
      const store = tx.objectStore('roundDetails');
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result || []);
        const set = new Set();
        for (const k of keys) {
          if (typeof k === 'string' && k.startsWith(`${uid}::`)) {
            set.add(k.slice(`${uid}::`.length));
          }
        }
        resolve(set);
      };
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}
export async function clearUserRoundsCache(uid) {
  try {
    const db = await openRoundsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['roundsIndex', 'roundDetails'], 'readwrite');
      const idx = tx.objectStore('roundsIndex');
      const det = tx.objectStore('roundDetails');
      const delIdx = idx.delete(uid);
      delIdx.onerror = () => reject(delIdx.error);
      delIdx.onsuccess = () => {
        // clear all details for this uid by scanning keys and deleting matches
        const req = det.getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result || []).filter(k => typeof k === 'string' && k.startsWith(`${uid}::`));
          let remaining = keys.length;
          if (remaining === 0) { resolve(); return; }
          keys.forEach(k => {
            const d = det.delete(k);
            d.onsuccess = () => { if (--remaining === 0) resolve(); };
            d.onerror = () => { if (--remaining === 0) resolve(); };
          });
        };
        req.onerror = () => resolve();
      };
    });
  } catch {
    // ignore
  }
}

export async function saveUserRound(uid, payload) {
  if (!uid) throw new Error('Not authenticated');
  const db = getFirestoreDb();
  const roundsCol = collection(db, 'users', uid, 'rounds');
  const docRef = await addDoc(roundsCol, {
    ...payload,
    createdAt: serverTimestamp(),
  });
  // update lightweight index document for quick listing
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  const meta = {
    title: payload.title,
    count: payload.count,
    createdAt: serverTimestamp(),
  };
  // Important: set nested object under 'entries' so it merges properly
  await setDoc(idxRef, { entries: { [docRef.id]: meta } }, { merge: true });
  // write-through local cache
  try {
  const nowSec = Math.floor(Date.now()/1000);
  const existing = await idbGetIndex(uid);
  const entries = existing?.entries ? { ...existing.entries } : {};
  entries[docRef.id] = { title: payload.title, count: payload.count, createdAt: { seconds: nowSec } };
  await idbSetIndex(uid, { entries, updatedAt: Date.now() });
  await idbSetDetail(uid, docRef.id, { data: { id: docRef.id, ...payload, createdAt: { seconds: nowSec } }, updatedAt: Date.now() });
  } catch {}
  return docRef.id;
}

// Read lightweight index: { entries: { [id]: { title, createdAt, count } } }
export async function getRoundsIndex(uid, { force = false } = {}) {
  if (!uid) return [];
  // Local-first unless force
  if (!force) {
    const local = await idbGetIndex(uid);
    if (local && local.entries) {
      // if fresh, return immediately; if stale, we'll fall through to server
      const isStale = typeof local.updatedAt === 'number' ? (Date.now() - local.updatedAt > STALE_MS) : true;
      if (!isStale) {
        const list0 = Object.entries(local.entries).map(([id, v]) => ({ id, ...v }));
        list0.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        return list0;
      }
    }
  }
  const db = getFirestoreDb();
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  const snap = await getDoc(idxRef);
  if (!snap.exists()) {
    // write empty index locally to avoid repeated misses
    await idbSetIndex(uid, { entries: {}, updatedAt: Date.now() });
    return [];
  }
  const raw = snap.data() || {};
  // Normal path
  let entries = raw.entries || {};
  const folders = raw.folders || {};
  // Backward-compat: if earlier writes used dot-notated fields like 'entries.<id>'
  if ((!entries || Object.keys(entries).length === 0)) {
    const rebuilt = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('entries.')) {
        const id = k.slice('entries.'.length);
        if (id) rebuilt[id] = v;
      }
    }
    if (Object.keys(rebuilt).length > 0) {
      entries = rebuilt;
    }
  }
  // cache locally (include folders if present)
  await idbSetIndex(uid, { entries, folders, updatedAt: Date.now() });
  const list = Object.entries(entries).map(([id, v]) => ({ id, ...v }));
  // sort desc by createdAt
  list.sort((a, b) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
  return list;
}

export async function getRoundDetail(uid, roundId, { force = false } = {}) {
  if (!uid || !roundId) return null;
  // Local-first
  const local = await idbGetDetail(uid, roundId);
  if (local && !force) {
    // backward compat: either wrapper {data, updatedAt} or raw doc
    const isWrapped = local && typeof local === 'object' && 'data' in local && 'updatedAt' in local;
    if (isWrapped) {
      const stale = typeof local.updatedAt === 'number' ? (Date.now() - local.updatedAt > STALE_MS) : true;
      if (!stale) return local.data;
    } else {
      // raw doc without timestamp: treat as stale; but still return now and refresh in background? For simplicity, refetch now.
    }
  }
  const db = getFirestoreDb();
  const ref = doc(db, 'users', uid, 'rounds', roundId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  await idbSetDetail(uid, roundId, { data, updatedAt: Date.now() });
  return data;
}

// Sync flow used at app startup: always fetch remote index; cache it; download any missing round details into local DB.
export async function syncUserRoundsCache(uid) {
  if (!uid) return [];
  // Always get latest index from server
  let indexList = [];
  try {
    indexList = await getRoundsIndex(uid, { force: true });
  } catch (e) {
    // fallback to local if offline
    const local = await idbGetIndex(uid);
    if (local?.entries) {
      indexList = Object.entries(local.entries).map(([id, v]) => ({ id, ...v }));
    }
  }
  // Ensure local has details for each round present in index
  try {
    const have = await idbListDetailIds(uid);
    const missing = indexList.map(r => r.id).filter(id => !have.has(id));
    for (const id of missing) {
      // Fetch and cache detail; if this fails (offline), skip silently
      try { await getRoundDetail(uid, id, { force: true }); } catch {}
    }
  } catch {}
  return indexList;
}

// Return list of folder names for user rounds (from meta index). Local-first then remote.
export async function getRoundFolders(uid, { force = false } = {}) {
  if (!uid) return [];
  if (!force) {
    const local = await idbGetIndex(uid);
    const foldersLocal = local?.folders ? Object.keys(local.folders) : null;
    if (foldersLocal) return foldersLocal;
  }
  const db = getFirestoreDb();
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  const snap = await getDoc(idxRef);
  const data = snap.exists() ? (snap.data() || {}) : {};
  const foldersObj = data.folders || {};
  // merge into local cache without disturbing entries
  const existing = await idbGetIndex(uid);
  await idbSetIndex(uid, { entries: existing?.entries || {}, folders: foldersObj, updatedAt: Date.now() });
  return Object.keys(foldersObj);
}

// Create or upsert a folder name in meta index
export async function addRoundFolder(uid, name) {
  if (!uid) throw new Error('Not authenticated');
  const folder = (name ?? '').toString().trim();
  if (!folder) throw new Error('Folder name required');
  const db = getFirestoreDb();
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  await setDoc(idxRef, { folders: { [folder]: true } }, { merge: true });
  // update local cache
  const existing = await idbGetIndex(uid);
  const folders = { ...(existing?.folders || {}), [folder]: true };
  await idbSetIndex(uid, { entries: existing?.entries || {}, folders, updatedAt: Date.now() });
  return true;
}

// Rename an existing folder; updates meta index and any rounds currently assigned that folder
export async function renameRoundFolder(uid, fromName, toName) {
  if (!uid) throw new Error('Not authenticated');
  const from = (fromName ?? '').toString().trim();
  const to = (toName ?? '').toString().trim();
  if (!from) throw new Error('Source folder name required');
  if (!to) throw new Error('Destination folder name required');
  if (from === to) return true; // no-op
  const db = getFirestoreDb();
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  // Fetch current index to enumerate rounds needing update
  const snap = await getDoc(idxRef);
  if (!snap.exists()) throw new Error('No folders meta found');
  const data = snap.data() || {};
  const entries = { ...(data.entries || {}) };
  const foldersObj = { ...(data.folders || {}) };
  if (!foldersObj[from]) throw new Error('Folder does not exist');
  if (foldersObj[to]) throw new Error('A folder with that name already exists');
  // Update any index entries referencing the old folder (meta only)
  const updates = {};
  for (const [rid, meta] of Object.entries(entries)) {
    if (meta && meta.folder === from) {
      updates[`entries.${rid}.folder`] = to;
      entries[rid] = { ...meta, folder: to };
    }
  }
  // Write folder key changes: delete old and set new key in a single update
  await updateDoc(idxRef, { [`folders.${from}`]: deleteField(), [`folders.${to}`]: true }).catch(async () => {
    // Fallback: if updateDoc fails due to missing doc, seed folders value
    const seed = { folders: { [to]: true } };
    await setDoc(idxRef, seed, { merge: true });
  });
  if (Object.keys(updates).length > 0) {
    await updateDoc(idxRef, updates).catch(async () => {
      // Fallback: rewrite whole entries map if granular update fails
      await setDoc(idxRef, { entries }, { merge: true });
    });
  }
  // Update each round document's folder field
  const roundIdsToUpdate = Object.entries(entries).filter(([, m]) => m.folder === to).map(([rid]) => rid);
  for (const rid of roundIdsToUpdate) {
    try {
      const rRef = doc(db, 'users', uid, 'rounds', rid);
      await updateDoc(rRef, { folder: to });
    } catch { /* ignore */ }
  }
  // Update local cache
  try {
    const local = await idbGetIndex(uid);
    if (local) {
      const newFolders = { ...(local.folders || {}) };
      delete newFolders[from];
      newFolders[to] = true;
      const newEntries = { ...(local.entries || {}) };
      for (const [rid, meta] of Object.entries(newEntries)) {
        if (meta && meta.folder === from) newEntries[rid] = { ...meta, folder: to };
      }
      await idbSetIndex(uid, { entries: newEntries, folders: newFolders, updatedAt: Date.now() });
    }
  } catch { /* ignore cache errors */ }
  return true;
}

// Delete a folder; rounds inside have their folder cleared (moved to root)
export async function deleteRoundFolder(uid, name) {
  if (!uid) throw new Error('Not authenticated');
  const folder = (name ?? '').toString().trim();
  if (!folder) throw new Error('Folder name required');
  const db = getFirestoreDb();
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  const snap = await getDoc(idxRef);
  if (!snap.exists()) return true; // nothing to do
  const data = snap.data() || {};
  const foldersObj = { ...(data.folders || {}) };
  if (!foldersObj[folder]) return true; // already gone
  // Clear folder on any entries referencing it
  const entries = { ...(data.entries || {}) };
  const updates = {};
  for (const [rid, meta] of Object.entries(entries)) {
    if (meta && meta.folder === folder) {
      updates[`entries.${rid}.folder`] = deleteField();
      delete entries[rid].folder;
    }
  }
  // Delete folder key specifically instead of merging a new object (which wouldn't remove old keys)
  try {
    await updateDoc(idxRef, { [`folders.${folder}`]: deleteField() });
  } catch {
    // If missing meta doc, nothing to delete
  }
  if (Object.keys(updates).length > 0) {
    try {
      await updateDoc(idxRef, updates);
    } catch {
      await setDoc(idxRef, { entries }, { merge: true });
    }
  }
  // Update round documents: clear folder
  for (const [rid, meta] of Object.entries(entries)) {
    if (!meta.folder) { // previously cleared
      try {
        const rRef = doc(db, 'users', uid, 'rounds', rid);
        await updateDoc(rRef, { folder: deleteField() });
      } catch { /* ignore */ }
    }
  }
  // Local cache
  try {
    const local = await idbGetIndex(uid);
    if (local) {
      const newFolders = { ...(local.folders || {}) };
      delete newFolders[folder];
      const newEntries = { ...(local.entries || {}) };
      for (const [rid, meta] of Object.entries(newEntries)) {
        if (meta && meta.folder === folder) {
          const { folder: _omit, ...rest } = meta;
            newEntries[rid] = rest;
        }
      }
      await idbSetIndex(uid, { entries: newEntries, folders: newFolders, updatedAt: Date.now() });
    }
  } catch { /* ignore */ }
  return true;
}

// Delete a saved round from Firestore and local caches (index + detail)
export async function deleteUserRound(uid, roundId) {
  if (!uid || !roundId) throw new Error('Missing uid/roundId');
  const db = getFirestoreDb();

  // Delete main round document
  const roundRef = doc(db, 'users', uid, 'rounds', roundId);
  try { await deleteDoc(roundRef); } catch (e) { /* continue to try meta cleanup */ }

  // Remove from meta index
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  try {
    await updateDoc(idxRef, { [`entries.${roundId}`]: deleteField() });
  } catch (e) {
    // If update fails, try rewriting entries map without this id
    try {
      const snap = await getDoc(idxRef);
      const raw = snap.exists() ? (snap.data() || {}) : {};
      const entries = { ...(raw.entries || {}) };
      if (roundId in entries) delete entries[roundId];
      await setDoc(idxRef, { entries }, { merge: true });
    } catch { /* ignore */ }
  }

  // Update local caches
  try {
    const indexLocal = await idbGetIndex(uid);
    if (indexLocal?.entries && (roundId in indexLocal.entries)) {
      const { [roundId]: _omit, ...rest } = indexLocal.entries;
      await idbSetIndex(uid, { entries: rest, updatedAt: Date.now() });
    }
    await idbDeleteDetail(uid, roundId);
  } catch { /* ignore local cache failures */ }

  return true;
}

// Set or clear a folder for a saved round. folder: string | null | ''
export async function setUserRoundFolder(uid, roundId, folder) {
  if (!uid || !roundId) throw new Error('Missing uid/roundId');
  const db = getFirestoreDb();
  const roundRef = doc(db, 'users', uid, 'rounds', roundId);
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');

  // Update main round doc
  try {
    if (folder && folder.trim().length > 0) {
      await updateDoc(roundRef, { folder: folder.trim() });
    } else {
      await updateDoc(roundRef, { folder: deleteField() });
    }
  } catch (e) {
    // If updateDoc fails because doc missing, ignore
  }

  // Update meta index entry
  try {
    if (folder && folder.trim().length > 0) {
      await updateDoc(idxRef, { [`entries.${roundId}.folder`]: folder.trim() });
    } else {
      await updateDoc(idxRef, { [`entries.${roundId}.folder`]: deleteField() });
    }
  } catch (e) {
    // If meta doc missing, create entries map with this field if setting; else ignore
    if (folder && folder.trim().length > 0) {
      await setDoc(idxRef, { entries: { [roundId]: { folder: folder.trim() } } }, { merge: true });
    }
  }

  // Update local caches
  try {
    const indexLocal = await idbGetIndex(uid);
    if (indexLocal?.entries) {
      const entries = { ...indexLocal.entries };
      if (!entries[roundId]) entries[roundId] = {};
      if (folder && folder.trim().length > 0) {
        entries[roundId] = { ...entries[roundId], folder: folder.trim() };
      } else {
        const { folder: _omit, ...rest } = entries[roundId];
        entries[roundId] = rest;
      }
      await idbSetIndex(uid, { entries, updatedAt: Date.now() });
    }
    const detailLocal = await idbGetDetail(uid, roundId);
    if (detailLocal && detailLocal.data) {
      const newData = { ...detailLocal.data };
      if (folder && folder.trim().length > 0) newData.folder = folder.trim(); else delete newData.folder;
      await idbSetDetail(uid, roundId, { data: newData, updatedAt: Date.now() });
    }
  } catch { /* ignore local cache failures */ }

  return true;
}

export function buildExcludeSetFromRound(roundDoc) {
  const set = new Set();
  const pairs = roundDoc?.pairs || [];
  for (const p of pairs) {
    if (p.tossupId) set.add(p.tossupId);
    if (p.bonusId) set.add(p.bonusId);
  }
  return set;
}

// Rename a saved round: updates Firestore round doc, meta index, and local caches
export async function renameUserRound(uid, roundId, newTitle) {
  if (!uid) throw new Error('Not authenticated');
  if (!roundId) throw new Error('Missing roundId');
  const title = (newTitle ?? '').toString().trim();
  if (title.length === 0) throw new Error('Title cannot be empty');

  const db = getFirestoreDb();
  // Update main round document title
  const roundRef = doc(db, 'users', uid, 'rounds', roundId);
  await updateDoc(roundRef, { title });

  // Update index meta title only (preserve other fields)
  const idxRef = doc(db, 'users', uid, 'meta', 'roundsIndex');
  try {
    await updateDoc(idxRef, { [`entries.${roundId}.title`]: title });
  } catch (e) {
    // If meta doc missing, create entries map with this item
    await setDoc(idxRef, { entries: { [roundId]: { title } } }, { merge: true });
  }

  // Update local caches
  try {
    const indexLocal = await idbGetIndex(uid);
    if (indexLocal && indexLocal.entries && indexLocal.entries[roundId]) {
      indexLocal.entries[roundId] = { ...indexLocal.entries[roundId], title };
      await idbSetIndex(uid, { ...indexLocal, updatedAt: Date.now() });
    }
    const detailLocal = await idbGetDetail(uid, roundId);
    if (detailLocal && detailLocal.data) {
      const updated = { ...detailLocal, data: { ...detailLocal.data, title }, updatedAt: Date.now() };
      await idbSetDetail(uid, roundId, updated);
    }
  } catch {
    // ignore local cache failures
  }

  return true;
}

// =============================
// Shared Preset Round Claimer
// =============================
// Reads a shared preset set owned by an admin user and returns a matching round's pairs.
// Attempts to remove the claimed id from the admin's set via a transaction; this removal
// will likely be denied by Firestore rules for non-admin users, so it's best-effort only.
// Returns: { roundId: string|null, pairs?: any[] }
export async function claimSharedPresetRound({
  questionType = 'both',
  categories = [],
  count = 1,
  adminUid = 'fkLJJ2R6HbdwqoXSxrLUybZ0IdH2',
} = {}) {
  const db = getFirestoreDb();
  const presetsRef = doc(db, 'users', adminUid, 'meta', 'presets');
  let currentSet = [];
  try {
    const snap = await getDoc(presetsRef);
    const data = snap.exists() ? (snap.data() || {}) : {};
    currentSet = Array.isArray(data?.set) ? [...data.set] : [];
  } catch {
    return { roundId: null };
  }
  if (!currentSet || currentSet.length === 0) return { roundId: null };

  const desired = Math.max(1, Number(count) || 1);
  const cats = Array.isArray(categories) && categories.length ? new Set(categories.map(c => String(c).toUpperCase())) : null;
  const type = (questionType || 'both').toLowerCase();

  function satisfies(pairs) {
    if (!Array.isArray(pairs)) return 0;
    let pool = [];
    if (type === 'tossup') {
      pool = pairs.filter(p => !!p?.tossupMeta && (!cats || cats.has(String(p.tossupMeta.category || '').toUpperCase())));
    } else if (type === 'bonus') {
      pool = pairs.filter(p => !!p?.bonusMeta && (!cats || cats.has(String(p.bonusMeta.category || '').toUpperCase())));
    } else {
      // both: enforce tossup category/type; bonus optional
      pool = pairs.filter(p => !!p?.tossupMeta && (!cats || cats.has(String(p.tossupMeta.category || '').toUpperCase())));
    }
    return pool.length;
  }

  // Find usable round ids by scanning set and collect eligible candidates
  const eligible = [];
  let chosenPairs = null;
  for (let i = 0; i < currentSet.length; i++) {
    const rid = currentSet[i];
    try {
      const rsnap = await getDoc(doc(db, 'users', adminUid, 'rounds', rid));
      if (!rsnap.exists()) continue;
      const pairs = (rsnap.data()?.pairs) || [];
      if (satisfies(pairs) >= desired) { eligible.push({ index: i, rid, pairs }); }
    } catch { /* ignore and continue */ }
  }

  if (eligible.length === 0) return { roundId: null };
  // Pick a random eligible preset
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const claimedId = pick.rid;
  chosenPairs = pick.pairs;

  // Best-effort removal: attempt transaction; if rules don't allow tx.set,
  // fall back to arrayRemove which our rules permit.
  try {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(presetsRef);
      const d = s.exists() ? (s.data() || {}) : {};
      const arr = Array.isArray(d.set) ? [...d.set] : [];
      const idx = arr.indexOf(claimedId);
      if (idx !== -1) {
        arr.splice(idx, 1);
        tx.set(presetsRef, { set: arr }, { merge: true });
      }
    });
  } catch {
    try { await updateDoc(presetsRef, { set: arrayRemove(claimedId) }); } catch {}
  }

  return { roundId: claimedId, pairs: chosenPairs };
}
