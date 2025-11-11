// Session-scoped cache of saved/generated rounds using IndexedDB as storage
// Persists across refreshes but resets when the browser tab/window is closed.
// We achieve session semantics by namespacing keys with a sessionStorage-backed id.

import { idbGet, idbSet } from './idb.js';

const SESS_KEY = 'sb_session_id';

function getSessionId() {
  try {
    let sid = sessionStorage.getItem(SESS_KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESS_KEY, sid);
    }
    return sid;
  } catch {
    // Fallback: non-session-scoped key (will persist longer than desired)
    return 'fallback';
  }
}

function getCacheKey() {
  const sid = getSessionId();
  return `s:${sid}:rounds`;
}

// Shape: { current: MetaRound|null, old: Array<MetaRound> }
// MetaRound = Array<{ tu: {id, tournament}|null, bo: {id, tournament}|null }>

export async function readSessionRoundsMeta() {
  const key = getCacheKey();
  const val = await idbGet(key);
  if (!val || typeof val !== 'object') return { current: null, old: [] };
  const cur = Array.isArray(val.current) ? val.current : null;
  const old = Array.isArray(val.old) ? val.old.filter(Array.isArray) : [];
  return { current: cur, old };
}

export async function writeSessionRoundsMeta(cache) {
  const key = getCacheKey();
  const payload = {
    current: Array.isArray(cache?.current) ? cache.current : null,
    old: Array.isArray(cache?.old) ? cache.old.filter(Array.isArray) : [],
    updatedAt: Date.now(),
  };
  await idbSet(key, payload);
  return payload;
}

// Add a new "current" meta round. If an existing current exists, push it to the front of old[]
export async function pushCurrentMeta(metaRound) {
  const cache = await readSessionRoundsMeta();
  const next = {
    current: Array.isArray(metaRound) ? metaRound : null,
    old: cache.current ? [cache.current, ...(cache.old || [])] : (cache.old || []),
  };
  await writeSessionRoundsMeta(next);
  return next;
}

// Swap paginator to a specific index in the list [current, ...old]
// index 0 => keep current; index > 0 => move that old[index-1] to current and shift previous current to old[0]
export async function swapToIndex(index) {
  const cache = await readSessionRoundsMeta();
  const cur = cache.current;
  const old = Array.isArray(cache.old) ? [...cache.old] : [];
  if (!(Number.isFinite(index)) || index <= 0 || index >= (1 + old.length)) {
    // no change
    return cache;
  }
  const picked = old[index - 1];
  const remaining = old.filter((_, i) => i !== (index - 1));
  const next = {
    current: picked || null,
    old: cur ? [cur, ...remaining] : remaining,
  };
  await writeSessionRoundsMeta(next);
  return next;
}

// Convenience: list meta rounds as an array [current, ...old] (filtering nulls)
export async function listSessionRoundsMeta() {
  const { current, old } = await readSessionRoundsMeta();
  const out = [];
  if (Array.isArray(current)) out.push(current);
  for (const o of old || []) if (Array.isArray(o)) out.push(o);
  return out;
}
