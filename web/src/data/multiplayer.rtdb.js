import { getFirebaseAuth, ensureAppCheck, getFirebaseApp } from '../firebase';
import { getCurrentIdentity } from './identity';
import { getDatabase, ref, get, set, update, push, onValue, off, runTransaction, serverTimestamp, query, orderByChild, limitToLast, child, onChildAdded, onChildChanged, equalTo } from 'firebase/database';
import { serverNow } from './serverTime';

function db() {
  // Ensure App Check is initialized before any RTDB access
  ensureAppCheck();
  return getDatabase(getFirebaseApp());
}
function roomRef(roomId) { return ref(db(), `mp/rooms/${roomId}`); }
function membersRef(roomId) { return ref(db(), `mp/roomMembers/${roomId}`); }
function memberRef(roomId, uid) { return ref(db(), `mp/roomMembers/${roomId}/${uid}`); }
function messagesRef(roomId) { return ref(db(), `mp/roomMessages/${roomId}`); }
function settingsRef(roomId) { return ref(db(), `mp/roomSettings/${roomId}`); }
function answersRef(roomId) { return ref(db(), `mp/roomAnswers/${roomId}`); }
function answerRef(roomId, questionId, uid) { return ref(db(), `mp/roomAnswers/${roomId}/${questionId}/${uid}`); }
function buzzesRef(roomId) { return ref(db(), `mp/roomBuzzes/${roomId}`); }
function buzzListRef(roomId, questionId) { return ref(db(), `mp/roomBuzzes/${roomId}/${questionId}`); }
function historyRef(roomId) { return ref(db(), `mp/roomHistory/${roomId}`); }
function userRoomsRef(uid) { return ref(db(), `mp/userRooms/${uid}`); }
async function touchRoom(roomId) {
  try { await update(roomRef(roomId), { lastActiveAt: Date.now() }); } catch {}
}

function generateCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
// Browser-friendly SHA-256 hex helper; falls back to plain string on failure
async function sha256Hex(text) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(String(text || ''));
    const digest = await (self.crypto || window.crypto).subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return String(text || '');
  }
}

export async function createRoom({ name = 'Room', isPrivate = false, passcode = '' }) {
  // Simple client-side create; for private rooms, prefer server enforcement if needed
  const roomName = String(name || 'Room').trim() || 'Room';
  const pass = String(passcode || '').trim();
  if (isPrivate && !pass) {
    throw new Error('Passcode is required for private rooms');
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const rref = roomRef(code);
    const snap = await get(rref);
    if (snap.exists()) continue;
    let passHash = null;
    if (isPrivate && pass) {
      try { passHash = await sha256Hex(pass); } catch { passHash = pass; }
    }
    await set(rref, {
      name: roomName,
      isPrivate: !!isPrivate,
      status: 'open',
      createdAt: Date.now(),
      state: {
        buzzerOpen: false,
        winnerUid: null,
        winnerName: null,
        winnerAt: null,
          awaitNext: false,
        // Streaming sync fields
        perWordMs: 200,
        perChoiceMs: 400,
        streamedWordsBase: 0,
        streamStartAt: null,
        stemFinishedAt: null,
        choicesBase: 0,
        choicesStartAt: null,
      },
      game: { currentId: null, tournaments: [], used: null },
      // Store a hash (not the plain passcode) for lightweight client-side checks
      passHash: passHash || null,
      lastActiveAt: Date.now(),
    });
    return code;
  }
  throw new Error('Failed to create room');
}

export async function joinRoom({ roomId, uid: uidOverride, displayName: nameOverride, passcode, passHashOverride }) {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  const ident = user ? { uid: user.uid, displayName: user.displayName || user.email || 'Player' } : (getCurrentIdentity() || {});
  const uid = uidOverride || ident.uid;
  const displayName = nameOverride || ident.displayName || 'Player';
  if (!uid) throw new Error('No identity available');
  // Fetch room to determine if pass required
  let roomSnap = null;
  try { roomSnap = await get(roomRef(roomId)); } catch {}
  const roomVal = roomSnap?.exists() ? roomSnap.val() : null;
  const isPrivate = !!roomVal?.isPrivate;
  const requiredHash = roomVal?.passHash || null;
  // Resolve member passHash: from provided passcode, override hash, or localStorage
  let memberPassHash = null;
  if (isPrivate && requiredHash) {
    if (passHashOverride) memberPassHash = String(passHashOverride);
    else if (passcode) memberPassHash = await sha256Hex(passcode);
    else try { memberPassHash = window.localStorage.getItem(`mp_pass_hash_${roomId}`); } catch {}
    if (!memberPassHash || memberPassHash !== requiredHash) {
      throw new Error('Incorrect or missing passcode');
    }
  }
  // Upsert member presence/typing fields
  await update(memberRef(roomId, uid), {
    uid,
    displayName,
    typing: false,
    draft: '',
    lastTypedAt: Date.now(),
    ...(memberPassHash ? { passHash: memberPassHash } : {}),
  });
  // Index this room under the user for Active Sessions
  try {
    if (user?.uid) {
      await update(child(userRoomsRef(uid), roomId), {
        roomId,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    }
  } catch {}
  // Update room activity
  touchRoom(roomId);
  // Ensure a score field exists without overwriting any existing value
  const sref = child(memberRef(roomId, uid), 'score');
  await runTransaction(sref, (curr) => (typeof curr === 'number' ? curr : 0));
  return true;
}

export function listenRoom({ roomId, onRoom, onMembers, onMessages, onSettings, onAnswers }) {
  const unsubscribes = [];
  const rref = roomRef(roomId);
  const mref = membersRef(roomId);
  const msgQuery = query(messagesRef(roomId), orderByChild('createdAt'), limitToLast(200));
  const sref = settingsRef(roomId);
  const aref = answersRef(roomId);

  const roomCb = onValue(rref, (s) => {
    const data = s.exists() ? { id: roomId, ...s.val() } : null;
    onRoom?.(data);
  });
  unsubscribes.push(() => off(rref, 'value', roomCb));

  const settingsCb = onValue(sref, (s) => {
    const settings = s.val() || {};
    onSettings?.(settings);
  });
  unsubscribes.push(() => off(sref, 'value', settingsCb));

  const membersCb = onValue(mref, (s) => {
    const val = s.val() || {};
    const list = Object.values(val);
    list.sort((a, b) => {
      const sa = a.score || 0;
      const sb = b.score || 0;
      if (sb !== sa) return sb - sa;
      const na = (a.displayName || '').toLowerCase();
      const nb = (b.displayName || '').toLowerCase();
      const nameCmp = na.localeCompare(nb);
      if (nameCmp !== 0) return nameCmp;
      const ua = String(a.uid || '');
      const ub = String(b.uid || '');
      return ua.localeCompare(ub);
    });
    onMembers?.(list);
  });
  unsubscribes.push(() => off(mref, 'value', membersCb));

  const messagesCb = onValue(msgQuery, (s) => {
    const val = s.val() || {};
    const list = Object.entries(val).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    onMessages?.(list);
  });
  unsubscribes.push(() => off(msgQuery, 'value', messagesCb));

  const answersCb = onValue(aref, (s) => {
    const val = s.val() || {};
    // Structure: { [questionId]: { [uid]: answerData } }
    onAnswers?.(val);
  });
  unsubscribes.push(() => off(aref, 'value', answersCb));

  return () => { unsubscribes.forEach((u) => { try { u(); } catch {} }); };
}

// Stream all buzz history for a room grouped by questionId
export function listenBuzzes({ roomId, onBuzzes }) {
  const bref = buzzesRef(roomId);
  const cb = onValue(bref, (s) => {
    const val = s.val() || {};
    const out = {};
    Object.entries(val).forEach(([qid, entries]) => {
      const list = Object.entries(entries || {}).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => (a.at || 0) - (b.at || 0));
      out[qid] = list;
    });
    onBuzzes?.(out);
  });
  return () => off(bref, 'value', cb);
}

// Lightweight typing listener with child events for lower-latency updates without rebuilding full list
export function listenTyping({ roomId, onTyping }) {
  const mref = membersRef(roomId);
  const handle = (s) => {
    const v = s.val() || {};
    const uid = v.uid || s.key;
    onTyping?.({
      uid,
      displayName: v.displayName || uid,
      typing: !!v.typing,
      draft: String(v.draft || ''),
      lastTypedAt: Number(v.lastTypedAt || 0),
    });
  };
  const cb1 = onChildAdded(mref, handle);
  const cb2 = onChildChanged(mref, handle);
  return () => {
    try { off(mref, 'child_added', cb1); } catch {}
    try { off(mref, 'child_changed', cb2); } catch {}
  };
}

export async function sendMessage({ roomId, text }) {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  const ident = user ? { uid: user.uid, displayName: user.displayName || user.email || 'Player' } : (getCurrentIdentity() || {});
  const uid = ident?.uid;
  if (!uid) return false;
  const displayName = ident.displayName || 'Player';
  const newRef = push(messagesRef(roomId));
  await set(newRef, { uid, displayName, text, createdAt: Date.now() });
  // Activity
  await touchRoom(roomId);
  try { if (user?.uid) await update(child(userRoomsRef(uid), roomId), { lastActiveAt: Date.now() }); } catch {}
  return true;
}

export async function awardScore({ roomId, uid, delta }) {
  const sref = child(memberRef(roomId, uid), 'score');
  await runTransaction(sref, (curr) => (curr || 0) + (Number(delta) || 0));
  await touchRoom(roomId);
  try {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (user?.uid) await update(child(userRoomsRef(uid), roomId), { lastActiveAt: Date.now() });
  } catch {}
  return true;
}

// Update room-wide settings (tournaments, categories, round ranges). Call with partial patches.
export async function updateRoomSettings({ roomId, patch, requireHost = false }) {
  const auth = getFirebaseAuth();
  const uid = auth?.currentUser?.uid || null;
  if (!roomId || !patch || typeof patch !== 'object') return false;

  try {
    // Hostless mode: any authenticated member can update room settings

    const payload = { ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, 'selectedTournaments')) {
      const arr = Array.isArray(patch.selectedTournaments) ? patch.selectedTournaments.slice(0, 20) : [];
      await update(roomRef(roomId), { 'game/tournaments': arr });
    }
    if (Object.keys(payload).length > 0) {
      await update(settingsRef(roomId), payload);
    }
    return true;
  } catch (e) {
    // Swallow permission_denied and return false so callers can silently ignore
    return false;
  }
}

// Mark per-user per-question answer status and optional text/choice
export async function setAnswerStatus({ roomId, questionId, uid, displayName, data }) {
  if (!roomId || !questionId || !uid) return false;
  const body = {
    uid,
    displayName: displayName || null,
    status: data?.status || 'typing', // 'typing' | 'correct' | 'incorrect' | 'idle'
    text: data?.text || '',
    choice: data?.choice || '',
    correct: typeof data?.correct === 'boolean' ? data.correct : null,
    points: Number.isFinite(data?.points) ? Number(data.points) : null,
    updatedAt: Date.now(),
  };
  await set(answerRef(roomId, questionId, uid), body);
  await touchRoom(roomId);
  try { await update(child(userRoomsRef(uid), roomId), { lastActiveAt: Date.now() }); } catch {}
  // Also mirror lightweight status on member for quick UI
  await update(memberRef(roomId, uid), {
    lastQuestionId: questionId,
    lastAnswerStatus: body.status,
    lastAnswerCorrect: body.correct,
    lastAnswerAt: body.updatedAt,
  });
  // Update the current buzz record with grading result if available
  try {
    const r = await get(roomRef(roomId));
    const st = r.val()?.state || {};
    const key = st.currentBuzzKey;
    if (key) {
      const recPath = child(buzzListRef(roomId, questionId), key);
      const snap = await get(recPath);
      const rec = snap.val();
      if (rec && (!rec.uid || rec.uid === uid)) {
        await update(recPath, {
          status: body.status,
          text: body.text,
          correct: body.correct,
          points: body.points,
          checkedAt: Date.now(),
        });
      }
    }
  } catch {}
  return true;
}

export async function removeMember({ roomId, uid }) {
  if (!roomId || !uid) return false;
  const mref = memberRef(roomId, uid);
  await set(mref, null);
  return true;
}

export async function setMpBuzzerOpen({ roomId, open }) {
  const now = serverNow();
  await runTransaction(roomRef(roomId), (curr) => {
    const data = curr || {};
    const st = data.state || {};
    const per = Number(st.perWordMs || 200);
    const perChoice = Number(st.perChoiceMs || 400);

    if (!open) {
      // Freeze progress: accumulate words and choices, clear timers
      const elapsed = st.streamStartAt ? Math.max(0, now - Number(st.streamStartAt)) : 0;
      const inc = per > 0 ? Math.floor(elapsed / per) : 0;
      const nextBase = Math.max(0, Number(st.streamedWordsBase || 0)) + Math.max(0, inc);

      const chElapsed = st.choicesStartAt ? Math.max(0, now - Number(st.choicesStartAt)) : 0;
      const chInc = perChoice > 0 ? Math.floor(chElapsed / perChoice) : 0;
      const nextChoicesBase = Math.min(4, Math.max(0, Number(st.choicesBase || 0)) + Math.max(0, chInc));

      return {
        ...data,
        state: {
          ...st,
          buzzerOpen: false,
          streamStartAt: null,
          streamedWordsBase: nextBase,
          choicesStartAt: null,
          choicesBase: nextChoicesBase,
        },
      };
    }

    // Open: ensure streamStartAt is set; if stem already finished and choices not complete, start choices
    const next = { ...data, state: { ...st, buzzerOpen: true } };
    if (!st.streamStartAt) next.state.streamStartAt = now;
    if (st.stemFinishedAt && !st.choicesStartAt && Number(st.choicesBase || 0) < 4) {
      next.state.choicesStartAt = now;
    }
    // IMPORTANT TIMER CHANGE:
    // Do NOT anchor buzzWindowStartAt here anymore. We only start the shared buzz window
    // AFTER streaming is fully complete (stem + choices). This prevents the timer from
    // starting early due to interrupts or partial question reads.
    // The anchoring now occurs explicitly when choicesFinishedAt is first set OR via
    // resetBuzzWindowNow on post-stream incorrect answers.
    // (legacy logic removed)
    return next;
  });
}

// Reset the shared buzz window start to "now" (only if choices are finished),
// so a fresh window is available for a rebound attempt after an incorrect answer.
export async function resetBuzzWindowNow({ roomId }) {
  const now = serverNow();
  await runTransaction(roomRef(roomId), (curr) => {
    const data = curr || {};
    const st = data.state || {};
    // Only reset when choices have finished streaming for the current question
    if (!st.choicesFinishedAt) return curr;
    const next = { ...data, state: { ...st } };
    next.state.buzzWindowStartAt = now;
    // If original duration missing, infer from question id.
    if (!Number.isFinite(next.state.buzzWindowMs) || next.state.buzzWindowMs <= 0) {
      const qid = (data.game && data.game.currentId) || '';
      const isBonus = /__bo__\d+$/i.test(String(qid));
      next.state.buzzWindowMs = isBonus ? 10000 : 4000;
    }
    // NEW RULE: If this reset occurs after a fully streamed question (i.e., the timer was
    // already running and an incorrect answer happened AFTER streaming completed), we set
    // a rebound window of exactly 5000ms regardless of original duration for toss-ups.
    // Bonus questions retain their original longer window.
    const qid = (data.game && data.game.currentId) || '';
    const isBonus = /__bo__\d+$/i.test(String(qid));
    if (!isBonus) {
      // For toss-ups only, apply 5s rebound logic.
      // Detect that we are in a post-stream incorrect scenario by checking winnerUid is null
      // (buzzer reopened) and answerWindowResolved was set previously.
      // Since resetBuzzWindowNow is invoked right after an incorrect answer grading,
      // we approximate by shortening when we already had a buzzWindowStartAt earlier.
      if (st.buzzWindowStartAt) {
        next.state.buzzWindowMs = 5000; // 5 seconds rebound window
      }
    }
    return next;
  });
}

// Mark whether a rebound (second buzz attempt after an incorrect interrupt) is available.
export async function setReboundAvailable({ roomId, value }) {
  if (!roomId) return false;
  try {
    await update(roomRef(roomId), { 'state/reboundAvailable': !!value });
    return true;
  } catch { return false; }
}

// Toggle shared grading state so all clients can show a consistent animation
export async function setMpGrading({ roomId, grading }) {
  await update(roomRef(roomId), { 'state/grading': !!grading });
}

export async function attemptMpBuzz({ roomId, uid, displayName }) {
  const sref = roomRef(roomId);
  try {
    let result = { ok: false };
    await runTransaction(sref, (curr) => {
      const data = curr || {};
      const st = data.state || {};
      const locked = (st.lockedOut && typeof st.lockedOut === 'object') ? st.lockedOut : {};
      if (locked && uid && locked[uid]) { result = { ok: false, reason: 'locked' }; return curr; }
      if (!st.buzzerOpen) { result = { ok: false, reason: 'closed', winnerUid: st.winnerUid || null }; return curr; }
      if (st.winnerUid) { result = { ok: false, reason: 'already', winnerUid: st.winnerUid }; return curr; }
      // Freeze stream progress at buzz
      const now = serverNow();
      const per = Number(st.perWordMs || 200);
      const elapsed = st.streamStartAt ? Math.max(0, now - Number(st.streamStartAt)) : 0;
      const inc = per > 0 ? Math.floor(elapsed / per) : 0;
      const nextBase = Math.max(0, Number(st.streamedWordsBase || 0)) + Math.max(0, inc);

      const perChoice = Number(st.perChoiceMs || 400);
      const chElapsed = st.choicesStartAt ? Math.max(0, now - Number(st.choicesStartAt)) : 0;
      const chInc = perChoice > 0 ? Math.floor(chElapsed / perChoice) : 0;
      const nextChoicesBase = Math.min(4, Math.max(0, Number(st.choicesBase || 0)) + Math.max(0, chInc));

      const interrupt = !st.stemFinishedAt;
      const next = {
        ...data,
        state: {
          ...(data.state || {}),
          buzzerOpen: false,
          winnerUid: uid,
          winnerName: displayName || null,
          winnerAt: Date.now(),
          streamStartAt: null,
          streamedWordsBase: nextBase,
          choicesStartAt: null,
          choicesBase: nextChoicesBase,
          currentBuzzKey: null,
          // Start a synchronized per-buzz answer window (3s)
          answerWindowUid: uid,
          answerWindowStartAt: now,
          answerWindowDeadlineAt: now + 3000,
          answerWindowResolved: false,
          currentBuzzInterrupt: !!interrupt,
        },
      };
      // Do NOT set buzzWindowStartAt here. The window should only start when choices finish
      // (anchored by setMpBuzzerOpen when st.choicesFinishedAt is present), or explicitly
      // reset via resetBuzzWindowNow() after an incorrect answer.
      result = { ok: true, winnerUid: uid };
      return next;
    });
    // Append buzz record under current question and store key for grading update
    if (result.ok) {
      const rs = await get(roomRef(roomId));
      const rv = rs.val() || {};
      const qid = rv?.game?.currentId || null;
      if (qid) {
        const recRef = push(buzzListRef(roomId, qid));
        const key = recRef.key;
        const interrupt = !rv?.state?.stemFinishedAt;
        await set(recRef, { uid, displayName, at: Date.now(), interrupt });
        await update(roomRef(roomId), { 'state/currentBuzzKey': key });
      }
    }
    return result;
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function clearMpBuzz({ roomId }) {
  await update(roomRef(roomId), {
    'state/winnerUid': null,
    'state/winnerName': null,
    'state/winnerAt': null,
    'state/answerWindowUid': null,
    'state/answerWindowStartAt': null,
    'state/answerWindowDeadlineAt': null,
    'state/answerWindowResolved': null,
    'state/currentBuzzInterrupt': null,
  });
}

export async function setMpCurrentQuestion({ roomId, questionId, tournaments = [] }) {
  let prevIdCaptured = null;
  await runTransaction(roomRef(roomId), (curr) => {
    const data = curr || {};
    const game = data.game || {};
    const prevId = game.currentId || null;
    prevIdCaptured = prevId;
    const used = (game.used && typeof game.used === 'object') ? game.used : {};

    const next = { ...data };
    next.game = {
      ...(next.game || {}),
      currentId: questionId || null,
      tournaments: Array.isArray(tournaments) ? tournaments.slice(0, 20) : [],
      used: { ...used },
    };
    if (prevId) next.game.used[prevId] = true;

    // Determine default buzz window duration from question id (__tu__/__bo__)
    const isBonus = /__bo__\d+$/i.test(String(questionId || ''));
    const buzzMs = isBonus ? 10000 : 4000;
    next.state = {
      ...(next.state || {}),
      // Reset buzzer and lockouts for new question
      buzzerOpen: false,
      winnerUid: null,
      winnerName: null,
      winnerAt: null,
      awaitNext: false,
      currentBuzzKey: null,
      lockedOut: null,
      // Initialize streaming sync fields
      perWordMs: 200,
      perChoiceMs: 400,
      streamedWordsBase: 0,
      streamStartAt: null,
      stemFinishedAt: null,
      choicesFinishedAt: null,
      choicesBase: 0,
      choicesStartAt: null,
      // Timers
      buzzWindowMs: buzzMs,
      buzzWindowStartAt: null,
      answerWindowUid: null,
      answerWindowStartAt: null,
      answerWindowDeadlineAt: null,
      answerWindowResolved: null,
      currentBuzzInterrupt: null,
    };
    return next;
  });
  // Append previous question to history after switching
  try {
    if (prevIdCaptured) {
      const rec = push(historyRef(roomId));
      await set(rec, { questionId: prevIdCaptured, at: Date.now() });
    }
  } catch {}
}

// Claim handling of an expired answer window to avoid double-processing across clients
export async function claimAnswerTimeout({ roomId, uid }) {
  let claimed = false;
  await runTransaction(roomRef(roomId), (curr) => {
    const data = curr || {};
    const st = data.state || {};
    const now = serverNow();
    if (!st.answerWindowUid || st.answerWindowUid !== uid) return curr;
    if (!st.answerWindowDeadlineAt || st.answerWindowResolved) return curr;
    if (now < Number(st.answerWindowDeadlineAt)) return curr;
    const next = { ...data, state: { ...st, answerWindowResolved: true } };
    claimed = true;
    return next;
  });
  return claimed;
}

// Set a shared timestamp when the stem first finishes on any client; no-op if already set
export async function setStemFinishedAt({ roomId, at }) {
  const ts = Number(at || serverNow());
  await runTransaction(roomRef(roomId), (curr) => {
    const data = curr || {};
    const st = data.state || {};
    if (st.stemFinishedAt) return curr;
    return { ...data, state: { ...st, stemFinishedAt: ts } };
  });
}

// Set a shared timestamp when the choices are fully finished for the current question
export async function setChoicesFinishedAt({ roomId, at }) {
  const ts = Number(at || serverNow());
  await runTransaction(roomRef(roomId), (curr) => {
    const data = curr || {};
    const st = data.state || {};
    if (st.choicesFinishedAt) return curr;
    return { ...data, state: { ...st, choicesFinishedAt: ts } };
  });
}

// Mark a player as locked out for the remainder of the current question
export async function mpLockoutUid({ roomId, uid }) {
  if (!roomId || !uid) return false;
  await runTransaction(roomRef(roomId), (curr) => {
    const data = curr || {};
    const st = data.state || {};
    const locked = (st.lockedOut && typeof st.lockedOut === 'object') ? st.lockedOut : {};
    const nextLocked = { ...locked, [uid]: true };
    return { ...data, state: { ...st, lockedOut: nextLocked } };
  });
  return true;
}

// Clear all lockouts (e.g., on question end)
export async function mpResetLockouts({ roomId }) {
  await update(roomRef(roomId), { 'state/lockedOut': null });
}

// Toggle awaiting next-question flag after a correct answer
export async function setAwaitNext({ roomId, value }) {
  await update(roomRef(roomId), { 'state/awaitNext': !!value });
  await touchRoom(roomId);
}

export function listenPublicRooms({ onRooms }) {
  const q = query(ref(db(), 'mp/rooms'), orderByChild('createdAt'), limitToLast(50));
  const memberUnsubs = new Map();
  let latestRooms = [];
  let counts = {};

  const recompute = () => {
    // Prefer server-computed memberCount on room if present; fallback to local counts map
    const merged = latestRooms.map(r => ({ ...r, memberCount: (typeof r.memberCount === 'number' ? r.memberCount : (counts[r.id] || 0)) }));
    onRooms?.(merged);
  };

  const attachFor = (roomId) => {
    if (memberUnsubs.has(roomId)) return;
    const mref = membersRef(roomId);
    const cbm = onValue(mref, (s) => {
      const val = s.val() || {};
      counts[roomId] = Object.keys(val).length;
      recompute();
    });
    memberUnsubs.set(roomId, () => off(mref, 'value', cbm));
  };

  const detachAbsent = (roomIds) => {
    for (const [rid, u] of memberUnsubs.entries()) {
      if (!roomIds.includes(rid)) {
        try { u(); } catch {}
        memberUnsubs.delete(rid);
        delete counts[rid];
      }
    }
  };

  const cb = onValue(q, (s) => {
    const val = s.val() || {};
    const list = Object.entries(val).map(([id, v]) => ({ id, ...v }))
      .filter(r => r.status === 'open' && r.isPrivate === false)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    latestRooms = list;
    const ids = list.map(r => r.id);
    ids.forEach(attachFor);
    detachAbsent(ids);
    recompute();
  });
  return () => {
    off(q, 'value', cb);
    for (const u of memberUnsubs.values()) { try { u(); } catch {} }
    memberUnsubs.clear();
  };
}

// Listen to rooms this user has joined (Active Sessions), newest activity first
export function listenUserActiveRooms({ uid, onRooms }) {
  if (!uid) return () => {};
  const uref = userRoomsRef(uid);
  const memberUnsubs = new Map();
  let latest = [];
  let counts = {};

  const recompute = () => {
    const merged = latest.map(r => ({ ...r, memberCount: counts[r.id] || 0 }));
    // Sort by lastActiveAt desc
    merged.sort((a,b) => (b.lastActiveAt||0) - (a.lastActiveAt||0));
    onRooms?.(merged);
  };

  const attachFor = (roomId) => {
    if (memberUnsubs.has(roomId)) return;
    const mref = membersRef(roomId);
    const cbm = onValue(mref, (s) => {
      const val = s.val() || {};
      counts[roomId] = Object.keys(val).length;
      recompute();
    });
    memberUnsubs.set(roomId, () => off(mref, 'value', cbm));
  };

  const detachAbsent = (roomIds) => {
    for (const [rid, u] of memberUnsubs.entries()) {
      if (!roomIds.includes(rid)) {
        try { u(); } catch {}
        memberUnsubs.delete(rid);
        delete counts[rid];
      }
    }
  };

  const cb = onValue(uref, async (s) => {
    const val = s.val() || {};
    const ids = Object.keys(val);
    // Fetch room meta for each id
    const rooms = [];
    for (const id of ids) {
      try {
        const rs = await get(roomRef(id));
        if (rs.exists()) rooms.push({ id, ...rs.val() });
      } catch {}
    }
    latest = rooms;
    ids.forEach(attachFor);
    detachAbsent(ids);
    recompute();
  });

  return () => {
    off(uref, 'value', cb);
    for (const u of memberUnsubs.values()) { try { u(); } catch {} }
    memberUnsubs.clear();
  };
}

// Listen to all history entries for a room, newest first
export function listenHistory({ roomId, onHistory }) {
  const href = historyRef(roomId);
  const cb = onValue(href, (s) => {
    const val = s.val() || {};
    const list = Object.entries(val).map(([id, v]) => ({ id, ...(v||{}) }))
      .sort((a,b) => (b.at||0) - (a.at||0));
    onHistory?.(list);
  });
  return () => off(href, 'value', cb);
}

// Find a room by exact code (id) or by exact name match
export async function findRoomByNameOrCode({ queryText }) {
  const text = String(queryText || '').trim();
  if (!text) return null;
  // Try direct id
  try {
    const rs = await get(roomRef(text));
    if (rs.exists()) return { id: text, ...rs.val() };
  } catch {}
  // Try uppercase variant for code-like inputs (users may type lower-case)
  const up = text.toUpperCase();
  if (up !== text) {
    try {
      const rs2 = await get(roomRef(up));
      if (rs2.exists()) return { id: up, ...rs2.val() };
    } catch {}
  }
  // Try equalTo by name
  try {
    const q = query(ref(db(), 'mp/rooms'), orderByChild('name'), equalTo(text));
    const s = await get(q);
    const val = s.val() || {};
    const entry = Object.entries(val)[0];
    if (entry) {
      const [id, v] = entry;
      return { id, ...(v||{}) };
    }
  } catch {}
  return null;
}
