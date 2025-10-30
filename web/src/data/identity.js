import { getFirebaseAuth } from '../firebase';

const GUEST_UID_KEY = 'mpGuestUid';
const GUEST_NAME_KEY = 'mpGuestName';

function randomId(len = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function getCurrentIdentity() {
  const auth = getFirebaseAuth?.();
  const user = auth?.currentUser || null;
  if (user) {
    return {
      uid: user.uid,
      displayName: user.displayName || user.email || 'Player',
      isGuest: false,
    };
  }
  const uid = localStorage.getItem(GUEST_UID_KEY);
  const name = localStorage.getItem(GUEST_NAME_KEY);
  if (uid && name) {
    return { uid, displayName: name, isGuest: true };
  }
  return null;
}

export function ensureGuestIdentity(name) {
  let uid = localStorage.getItem(GUEST_UID_KEY);
  if (!uid) {
    uid = `guest_${randomId(16)}`;
    localStorage.setItem(GUEST_UID_KEY, uid);
  }
  if (name) {
    localStorage.setItem(GUEST_NAME_KEY, name);
  }
  const displayName = localStorage.getItem(GUEST_NAME_KEY) || name || 'Guest';
  return { uid, displayName, isGuest: true };
}

export function setGuestUsername(name) {
  if (!name) return;
  localStorage.setItem(GUEST_NAME_KEY, name);
}

export function clearGuestIdentity() {
  try { localStorage.removeItem(GUEST_UID_KEY); } catch {}
  try { localStorage.removeItem(GUEST_NAME_KEY); } catch {}
}

export function getGuestIdentity() {
  const uid = localStorage.getItem(GUEST_UID_KEY);
  const displayName = localStorage.getItem(GUEST_NAME_KEY);
  if (uid && displayName) return { uid, displayName, isGuest: true };
  return null;
}
