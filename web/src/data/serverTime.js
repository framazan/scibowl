// Lightweight Firebase RTDB server time helper
// Tracks .info/serverTimeOffset and exposes serverNow() for synchronized clocks
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { ensureAppCheck, getFirebaseApp } from '../firebase';

let offsetMs = 0;
let initialized = false;
let readyResolvers = [];

function ensureInit() {
  if (initialized) return;
  try {
    // Ensure App Check is active before accessing RTDB special info path
    ensureAppCheck();
    const db = getDatabase(getFirebaseApp());
    const offRef = ref(db, ".info/serverTimeOffset");
    const cb = onValue(offRef, (snap) => {
      const val = Number(snap.val() || 0);
      offsetMs = Number.isFinite(val) ? val : 0;
      if (!initialized) {
        initialized = true;
        readyResolvers.forEach((r) => { try { r(); } catch {} });
        readyResolvers = [];
      }
    });
    // No explicit off here; this module is intended to live for app lifetime
    // Return unsubscribe if needed in future
    return () => off(offRef, 'value', cb);
  } catch {
    // Ignore init errors; serverNow will fallback to client time
    initialized = true;
    readyResolvers.forEach((r) => { try { r(); } catch {} });
    readyResolvers = [];
  }
}

export function serverNow() {
  // Initialize on first call
  ensureInit();
  return Date.now() + (offsetMs || 0);
}

export function waitUntilServerTimeReady() {
  ensureInit();
  if (initialized) return Promise.resolve();
  return new Promise((resolve) => {
    readyResolvers.push(resolve);
    // Fallback timeout in case .info never resolves
    setTimeout(() => {
      if (!initialized) {
        initialized = true;
        try { resolve(); } catch {}
      }
    }, 2000);
  });
}
