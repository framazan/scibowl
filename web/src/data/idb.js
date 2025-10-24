// Minimal IndexedDB key-value helper (no external deps)
// DB: 'scibowl_current_cache', store: 'kv'

const DB_NAME = 'scibowl_current_cache';
const DB_VERSION = 1;
const STORE = 'kv';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let done = false;
    tx.oncomplete = () => { if (!done) resolve(); };
    tx.onerror = () => { if (!done) reject(tx.error); };
    const p = fn(store);
    Promise.resolve(p).then((val) => { done = true; resolve(val); }, (err) => { done = true; reject(err); });
  });
}

export async function idbGet(key) {
  return withStore('readonly', (store) => new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  }));
}

export async function idbSet(key, value) {
  return withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const req = store.put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }));
}

export async function idbDel(key) {
  return withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }));
}
