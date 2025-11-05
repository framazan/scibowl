import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getDatabase, ref, update as rtdbUpdate, onDisconnect, serverTimestamp } from 'firebase/database';
import useAuth from '../../data/useAuth.js';
import Layout from '../layout/Layout.jsx';
import Loading from '../layout/Loading.jsx';
import { RoomSEO } from '../SEO.jsx';
import { joinRoom as joinRoomRtdb, listenRoom as listenRoomRtdb, listenTyping as listenTypingRtdb, listenBuzzes as listenBuzzesRtdb, sendMessage as sendMessageRtdb, awardScore as awardScoreRtdb, setMpBuzzerOpen, attemptMpBuzz, clearMpBuzz, setMpCurrentQuestion, setAnswerStatus, mpLockoutUid, mpResetLockouts, setMpGrading, setStemFinishedAt, setChoicesFinishedAt, setAwaitNext, updateRoomSettings as updateRoomSettingsRtdb, removeMember as removeMemberRtdb, listenHistory as listenHistoryRtdb, claimAnswerTimeout } from '../../data/multiplayer.rtdb.js';
import { getCurrentIdentity, ensureGuestIdentity, setGuestUsername, clearGuestIdentity, getGuestIdentity } from '../../data/identity.js';
import { serverNow } from '../../data/serverTime.js';
import { checkAnswerMC as apiCheckMC, checkAnswerBonus as apiCheckBonus } from '../../api/client.js';
import useRoundsQuestionsLazy from '../../data/useRoundsQuestionsLazy.js';
import TournamentSelector from '../roundGenerator/components/TournamentSelector.jsx';
import CategoriesSelector from '../roundGenerator/components/CategoriesSelector.jsx';
import RoundRanges from '../roundGenerator/components/RoundRanges.jsx';
import { useFilters } from '../roundGenerator/hooks/useFilters.js';
import { parseMCChoices as parseMCChoicesRG } from '../roundGenerator/utils/helpers.js';
import LatexRenderer from '../LatexRenderer.jsx';
import RoomHeader from './room/RoomHeader.jsx';
import PlayControls from './room/PlayControls.jsx';
import PasscodePrompt from './room/PasscodePrompt.jsx';
import QuestionPanel from './room/QuestionPanel.jsx';
import BuzzList from './room/BuzzList.jsx';
import HistoryPanel from './room/HistoryPanel.jsx';
import ChatPanel from './room/ChatPanel.jsx';
// Match PracticeMode animation
function DoubleHelix() {
  return (
    <div className="flex items-center justify-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="animate-spin">
        <path d="M20 5 Q25 10 20 15 Q15 20 20 25 Q25 30 20 35" stroke="#3b82f6" strokeWidth="2" fill="none" className="animate-pulse" />
        <path d="M20 5 Q15 10 20 15 Q25 20 20 25 Q15 30 20 35" stroke="#3b82f6" strokeWidth="2" fill="none" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
      </svg>
    </div>
  );
}

export default function MultiplayerRoom() {
  // Move onBuzz above conditional returns
  async function onBuzz() {
    if (!room?.state?.buzzerOpen) return;
    const identNow = getCurrentIdentity();
    const uid = identNow?.uid;
    const displayName = identNow?.displayName || 'Player';
    setBusy(true);
    try {
      await attemptMpBuzz({ roomId, uid, displayName });
    } finally { setBusy(false); }
  }
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [room, setRoom] = useState(null);
  const setRoomStable = React.useCallback((newRoom) => {
    setRoom(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newRoom)) return prev;
      return newRoom;
    });
  }, []);
  const [members, setMembers] = useState([]);
  const setMembersStable = React.useCallback((newList) => {
    setMembers(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newList)) return prev;
      return newList;
    });
  }, []);
  const [messages, setMessages] = useState([]);
  const setMessagesStable = React.useCallback((newMessages) => {
    setMessages(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newMessages)) return prev;
      return newMessages;
    });
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState(''); // used for inline chat/answer box
  const [passPrompt, setPassPrompt] = useState('');
  const [needsPass, setNeedsPass] = useState(false);
  const [needsGuestName, setNeedsGuestName] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestNameError, setGuestNameError] = useState('');
  const inputRef = useRef(null);
  const lazy = useRoundsQuestionsLazy();
  // Current identity (auth or guest)
  const selfIdentity = getCurrentIdentity();
  const selfUid = selfIdentity?.uid || null;
  const selfName = selfIdentity?.displayName || 'Player';
  const [questionError, setQuestionError] = useState('');
  const [settings, setSettings] = useState({ selectedTournaments: [], selectedCategories: [], roundRanges: [] });
  const setSettingsStable = React.useCallback((newSettings) => {
    setSettings(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newSettings)) return prev;
      return newSettings;
    });
  }, []);
  const [history, setHistory] = useState([]);
  // Right pane tabs: 'settings' | 'chat'
  const [rightTab, setRightTab] = useState('settings');
  // Chat unread tracking
  const [lastChatSeenAt, setLastChatSeenAt] = useState(() => Date.now());
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [resultBanner, setResultBanner] = useState(null); // {correct, reason}
  const grading = !!room?.state?.grading; // shared grading flag from RTDB
  // Low-latency typing map keyed by uid
  const [typingMap, setTypingMap] = useState({});
  const [buzzesMap, setBuzzesMap] = useState({});
  const [answersMap, setAnswersMap] = useState({}); // { [questionId]: { [uid]: {status, text, ...} } }
  // Streaming states mimic PracticeMode
  const [displayedWordCount, setDisplayedWordCount] = useState(0);
  const [choiceStreamCount, setChoiceStreamCount] = useState(0);
  const [revealChoicesAfterCheck, setRevealChoicesAfterCheck] = useState(false);
  const [mcTypedAnswer, setMcTypedAnswer] = useState('');
  // Local tick to refresh countdown UIs
  const [tick, setTick] = useState(0);
  // Removed userAnswer state (radio MC)
  // Local filter for question types
  const [selectedTypes, setSelectedTypes] = useState({ tossup: true, bonus: true });
  // Refs for auto-focus in winner answer area
  const saInputRef = useRef(null); // short-answer input
  const mcInputRef = useRef(null); // MC typed input
  const chatInputRef = useRef(null);

  // Subscribe to room, members, messages, answers
  useEffect(() => {
    if (!roomId) return;
    return listenRoomRtdb({ roomId, onRoom: setRoomStable, onMembers: setMembersStable, onMessages: setMessagesStable, onSettings: setSettingsStable, onAnswers: setAnswersMap });
  }, [roomId, setRoomStable, setMembersStable, setMessagesStable, setSettingsStable]);

  // If user logs in while having a guest presence, purge the guest member entry
  useEffect(() => {
    if (!roomId) return;
    if (!auth?.user) return;
    const guest = getGuestIdentity();
    if (!guest) return;
    const exists = members.some(m => m.uid === guest.uid);
    if (!exists) return;
    (async () => {
      try { await removeMemberRtdb({ roomId, uid: guest.uid }); } catch {}
      try { clearGuestIdentity(); } catch {}
    })();
  }, [roomId, auth?.user?.uid, JSON.stringify(members.map(m=>m.uid))]);

  // Low-latency typing subscription
  useEffect(() => {
    if (!roomId) return;
    return listenTypingRtdb({ roomId, onTyping: (e) => {
      setTypingMap((prev) => ({ ...prev, [e.uid]: e }));
    }});
  }, [roomId]);

  // Buzz history subscription
  useEffect(() => {
    if (!roomId) return;
    return listenBuzzesRtdb({ roomId, onBuzzes: setBuzzesMap });
  }, [roomId]);

  // Presence: mark current user online and set onDisconnect to offline
  useEffect(() => {
    const uid = selfUid;
    if (!roomId || !uid) return;
    const db = getDatabase();
    const mRef = ref(db, `mp/roomMembers/${roomId}/${uid}`);
    try {
      const od = onDisconnect(mRef);
      od.update({ online: false, lastSeenAt: serverTimestamp() });
    } catch {}
    (async () => {
      try { await rtdbUpdate(mRef, { online: true, lastSeenAt: Date.now() }); } catch {}
    })();
    return () => {
      try { rtdbUpdate(mRef, { online: false, lastSeenAt: Date.now() }); } catch {}
    };
  }, [roomId, selfUid]);

  // History subscription (persisted across refresh)
  useEffect(() => {
    if (!roomId) return;
    return listenHistoryRtdb({ roomId, onHistory: setHistory });
  }, [roomId]);

  // Heartbeat to update timers ~5 times a second
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 200);
    return () => clearInterval(id);
  }, []);

  // Ensure question sources are loaded for the current room
  // Build effective tournament list from (a) local UI selection, (b) room settings, (c) room.game fallback,
  // and always include the tournament inferred from the current question id if present.
  const currentIdStr = String(room?.game?.currentId || '') || '';
  const inferredCurrentTournament = useMemo(() => {
    // Expected ID format: <tournament>__<round>__tu|bo__<num>
    const m = currentIdStr.match(/^([^_]+)__[^_]+__(?:tu|bo)__\d+$/i);
    return m ? m[1] : null;
  }, [currentIdStr]);
  const tlist = useMemo(() => {
    const b = Array.isArray(settings?.selectedTournaments) && settings.selectedTournaments.length ? settings.selectedTournaments : [];
    const c = Array.isArray(room?.game?.tournaments) ? room.game.tournaments : [];
    const out = new Set([...(b||[]), ...(c||[])]);
    if (inferredCurrentTournament) out.add(inferredCurrentTournament);
    return Array.from(out);
  }, [JSON.stringify(settings?.selectedTournaments||[]), JSON.stringify(room?.game?.tournaments||[]), inferredCurrentTournament]);
  useEffect(() => {
    if (!tlist || tlist.length === 0) return;
    (async () => { try { await lazy.ensureLoaded(tlist); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tlist)]);

  // Question helpers (hooks must be declared before any conditional returns)
  const allQs = React.useMemo(() => lazy.getLoadedQuestions(tlist), [lazy, JSON.stringify(tlist)]);
  const byId = React.useMemo(() => {
    const m = new Map();
    for (const q of allQs) m.set(q.id, q);
    return m;
  }, [allQs]);
  const currentQ = room?.game?.currentId ? byId.get(room.game.currentId) || null : null;
  const amMember = React.useMemo(() => {
    const ident = getCurrentIdentity();
    const uid = ident?.uid;
    if (!uid) return false;
    return members.some(m => m.uid === uid);
  }, [members, auth?.user?.uid]);
  // Hostless mode: no host privileges; selection is local per user

  // Side panel: wire filters using useFilters but sync state with RTDB settings
  const {
    tournamentGroups,
    selectedTournaments,
    setSelectedTournaments,
    selectedCategories,
    setSelectedCategories,
    tournamentGroupsOpen,
    setTournamentGroupsOpen,
    tournamentVisibleEntriesMainRef,
    handleTournamentToggle,
    categories,
    roundRanges,
    setRoundRanges,
    roundsByTournament,
    globalNumericRoundMax,
    inRanges,
  } = useFilters({ questions: [], lazy });

  // UI state for tournament selector modal and dark mode (to match RoundGenerator behavior)
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    try { return document.documentElement.classList.contains('dark'); } catch { return false; }
  });
  useEffect(() => {
    try {
      const root = document.documentElement;
      const update = () => setIsDark(root.classList.contains('dark'));
      update();
      const mo = new MutationObserver(update);
      mo.observe(root, { attributes: true, attributeFilter: ['class'] });
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', update);
      return () => { mo.disconnect(); mql.removeEventListener('change', update); };
    } catch { /* no-op */ }
  }, []);

  // Track user-initiated settings changes to avoid writing on mount/refresh
  const settingsDirtyRef = React.useRef(false);
  const markSettingsDirty = () => { settingsDirtyRef.current = true; };
  const setSelectedTournamentsDirty = (v) => { setSelectedTournaments(v); markSettingsDirty(); };
  const setSelectedCategoriesDirty = (v) => { setSelectedCategories(v); markSettingsDirty(); };
  const setRoundRangesDirty = (v) => { setRoundRanges(v); markSettingsDirty(); };
  const setSelectedTypesDirty = (fnOrVal) => {
    const next = typeof fnOrVal === 'function' ? fnOrVal(selectedTypes) : fnOrVal;
    setSelectedTypes(next);
    markSettingsDirty();
  };

  // Initialize local filter state from room settings
  const settingsJson = JSON.stringify(settings);
  useEffect(() => {
    try {
      const s = JSON.parse(settingsJson || '{}');
      if (Array.isArray(s.selectedTournaments) && JSON.stringify(s.selectedTournaments) !== JSON.stringify(selectedTournaments)) {
        setSelectedTournaments(s.selectedTournaments);
      }
      if (Array.isArray(s.selectedCategories) && JSON.stringify(s.selectedCategories) !== JSON.stringify(selectedCategories)) {
        setSelectedCategories(s.selectedCategories);
      }
      if (Array.isArray(s.roundRanges) && JSON.stringify(s.roundRanges) !== JSON.stringify(roundRanges)) {
        setRoundRanges(s.roundRanges);
      }
      if (s.selectedTypes && (s.selectedTypes.tossup !== undefined || s.selectedTypes.bonus !== undefined)) {
        const nextTypes = {
          tossup: s.selectedTypes.tossup ?? true,
          bonus: s.selectedTypes.bonus ?? true,
        };
        if (JSON.stringify(nextTypes) !== JSON.stringify(selectedTypes)) {
          setSelectedTypes(nextTypes);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsJson]);

  // Sync side panel settings to RTDB so all devices share the same selection
  useEffect(() => {
    if (!roomId) return;
    const patch = {
      selectedTournaments: Array.isArray(selectedTournaments) ? selectedTournaments : [],
      selectedCategories: Array.isArray(selectedCategories) ? selectedCategories : [],
      roundRanges: Array.isArray(roundRanges) ? roundRanges : [],
      selectedTypes: selectedTypes || { tossup: true, bonus: true },
    };
    if (!settingsDirtyRef.current) return; // only write after local UI changes
    // Avoid redundant writes if same as current settings
    const same = (() => {
      try {
        const s = settings || {};
        return (
          JSON.stringify(s.selectedTournaments||[]) === JSON.stringify(patch.selectedTournaments) &&
          JSON.stringify(s.selectedCategories||[]) === JSON.stringify(patch.selectedCategories) &&
          JSON.stringify(s.roundRanges||[]) === JSON.stringify(patch.roundRanges) &&
          JSON.stringify(s.selectedTypes||{}) === JSON.stringify(patch.selectedTypes)
        );
      } catch { return false; }
    })();
    if (same) return;
    const t = setTimeout(() => { updateRoomSettingsRtdb({ roomId, patch }); settingsDirtyRef.current = false; }, 200);
    return () => clearTimeout(t);
  }, [roomId, JSON.stringify(selectedTournaments), JSON.stringify(selectedCategories), JSON.stringify(roundRanges), JSON.stringify(selectedTypes), settingsJson]);

  // Handle join with optional passcode
  useEffect(() => {
    if (!room) return;
    const ident = getCurrentIdentity();
    if (!ident && !auth?.user) {
      setNeedsGuestName(true);
      return;
    }
    (async () => {
      try {
        // If private and not a member yet, show pass prompt unless we have a validated session
        const sessionKey = `mp_pass_ok_${roomId}`;
        const hasSession = typeof window !== 'undefined' ? (window.localStorage.getItem(sessionKey) === '1') : false;
        const passFromNav = location?.state?.passcode ? String(location.state.passcode).trim() : '';
        if (room.isPrivate && !amMember && !hasSession) {
          if (passFromNav) {
            // Attempt auto-join with provided passcode and mark session
            await joinRoomRtdb({ roomId, passcode: passFromNav, uid: ident?.uid, displayName: ident?.displayName });
            try {
              window.localStorage.setItem(sessionKey, '1');
              if (room?.passHash) window.localStorage.setItem(`mp_pass_hash_${roomId}`, String(room.passHash));
            } catch {}
            setNeedsPass(false);
          } else {
            setNeedsPass(true);
          }
        } else if (!amMember) {
          await joinRoomRtdb({ roomId, uid: ident?.uid, displayName: ident?.displayName });
        }
      } catch (e) {
        setError(e?.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!room, auth?.user?.uid, amMember]);

  // Presence/typing updates
  useEffect(() => {
    const h = (e) => {
      // Mark not typing on unload
      try { updateTyping(roomId, false, ''); } catch {}
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [roomId]);

  // Derived streaming helpers
  const plainQuestionText = useMemo(() => String(currentQ?.question || currentQ?.text || ''), [currentQ?.id]);
  const words = useMemo(() => plainQuestionText.split(/\s+/).filter(Boolean), [plainQuestionText]);
  const streamFinished = displayedWordCount >= words.length;
  const isBonusCurrent = String(currentQ?.question_type || '').toLowerCase() === 'bonus';
  const choices = useMemo(() => parseMCChoicesRG(currentQ), [currentQ?.id]);
  const fullMcChoices = useMemo(() => {
    if (!Array.isArray(choices) || choices.length === 0) return [];
    const map = new Map(choices);
    return ['w','x','y','z'].map(k => [k, map.get(k)]);
  }, [choices]);

  // Reset streaming when question changes
  useEffect(() => {
  setDisplayedWordCount(0);
  setChoiceStreamCount(0);
  setRevealChoicesAfterCheck(false);
  setMcTypedAnswer('');
  setResultBanner(null);
  }, [currentQ?.id]);

  // Space to buzz; 'p' to pause/resume (when not typing)
  useEffect(() => {
    function isTypingInInput(el) {
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }
    const handler = (e) => {
      const key = e.key;
      if (key === ' ' || key === 'Spacebar') {
        if (!isTypingInInput(e.target)) {
          const identNow = getCurrentIdentity();
          const uid = identNow?.uid;
          const locked = (room?.state?.lockedOut && typeof room.state.lockedOut === 'object') ? room.state.lockedOut : {};
          const canBuzz = !!currentQ && !!room?.state?.buzzerOpen && !room?.state?.winnerUid && (!uid || !locked[uid]);
          if (canBuzz) {
            e.preventDefault();
            onBuzz();
          }
        }
      } else if (String(key).toLowerCase() === 'p') {
        if (!isTypingInInput(e.target)) {
          e.preventDefault();
          togglePause();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [room?.state?.buzzerOpen, room?.state?.winnerUid, room?.state?.lockedOut, !!currentQ]);

  // Enter-to-open chat when user hasn't buzzed and not focused in input
  useEffect(() => {
    const isTypingInInput = (el) => {
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const handler = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (String(e.key) !== 'Enter') return;
      const target = e.target || document.activeElement;
      if (isTypingInInput(target)) return;
      // Only if the current user is not the active winner
      const isSelfWinner = !!(selfUid && room?.state?.winnerUid === selfUid);
      if (isSelfWinner) return;
      e.preventDefault();
      setRightTab('chat');
      setTimeout(() => { try { chatInputRef.current?.focus?.(); } catch {} }, 0);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selfUid, room?.state?.winnerUid]);

  // Recompute unread chat count when messages or tab changes
  useEffect(() => {
    const list = Array.isArray(messages) ? messages : [];
    if (rightTab === 'chat') {
      // Mark all as seen; set baseline to latest message or now
      const latest = list.reduce((mx, m) => Math.max(mx, Number(m.createdAt || 0)), 0);
      setLastChatSeenAt(latest || Date.now());
      if (unreadChatCount !== 0) setUnreadChatCount(0);
      return;
    }
    // When not on chat, count new messages after last seen (exclude own messages)
    const threshold = Number(lastChatSeenAt || 0);
    const cnt = list.reduce((acc, m) => acc + ((Number(m.createdAt || 0) > threshold && m.uid !== selfUid) ? 1 : 0), 0);
    if (cnt !== unreadChatCount) setUnreadChatCount(cnt);
  }, [rightTab, messages, lastChatSeenAt, selfUid]);

  // Auto-focus answer input in buzz row when current user becomes the winner and not locked
  const isWinnerNow = !!(selfUid && room?.state?.winnerUid === selfUid);
  useEffect(() => {
    if (!currentQ || !isWinnerNow) return;
    const locked = !!(selfUid && answersMap?.[currentQ.id]?.[selfUid]);
    if (locked) return;
    const el = mcInputRef.current;
    if (el && typeof el.focus === 'function') {
      // Delay a tick to ensure render completed
      setTimeout(() => {
        try { el.focus(); el.select?.(); } catch {}
      }, 0);
    }
  }, [isWinnerNow, currentQ?.id, answersMap, selfUid]);

  // Keyboard shortcuts: allow any player to press 'n' to advance at any time
  useEffect(() => {
    const isTypingInInput = (el) => {
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const handler = (e) => {
      // Ignore when modifiers pressed
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Ignore when user is focused on a text input/textarea/contenteditable
      const target = e.target || document.activeElement;
      if (isTypingInInput(target)) return;
      const k = String(e.key || '').toLowerCase();
      if (k === 'n') {
        e.preventDefault();
        nextQuestionManual();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentQ?.id]);

  // Stream words based on server-anchored room state for consistent pacing across clients
  useEffect(() => {
    if (!currentQ) return;
    const perWordMs = Number(room?.state?.perWordMs || 200);
    const base = Number(room?.state?.streamedWordsBase || 0);
    const startAt = Number(room?.state?.streamStartAt || 0) || null;

    let raf = null;
    let iv = null;
    const tick = () => {
      const now = serverNow();
      const inc = startAt ? Math.max(0, Math.floor((now - startAt) / Math.max(1, perWordMs))) : 0;
      const next = Math.min(words.length, base + inc);
      // If a correct answer occurred, reveal the full stem immediately for everyone
      if (room?.state?.awaitNext) {
        setDisplayedWordCount(words.length);
      } else {
        setDisplayedWordCount(next);
      }
    };

    // Update at ~60fps when running, else compute one-off frozen value
    if (!room?.state?.awaitNext && room?.state?.buzzerOpen && !room?.state?.winnerUid) {
      iv = setInterval(tick, 80);
      tick();
    } else {
      tick();
    }
    return () => { if (iv) clearInterval(iv); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, words.length, room?.state?.buzzerOpen, room?.state?.winnerUid, room?.state?.perWordMs, room?.state?.streamedWordsBase, room?.state?.streamStartAt, room?.state?.awaitNext]);

  // Align MC choices start using stemFinishedAt; stream choices gradually; pause while buzz is active
  useEffect(() => {
    if (!currentQ) return;
    if (choices.length === 0) return;
    if (!streamFinished) return;

    const perChoiceMs = Number(room?.state?.perChoiceMs || 400);
    const stemFinishedAt = Number(room?.state?.stemFinishedAt || 0);
    if (!stemFinishedAt) return; // wait until we record finish time

    // If a correct answer occurred, reveal all choices immediately for everyone
    if (room?.state?.awaitNext) {
      if (choiceStreamCount < 4) setChoiceStreamCount(4);
      return;
    }

    // Stream choices from current position at a fixed interval
    if (room?.state?.winnerUid || !room?.state?.buzzerOpen || choiceStreamCount >= 4) return;
    const id = setInterval(() => {
      setChoiceStreamCount(n => Math.min(4, n + 1));
    }, perChoiceMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, choices.length, streamFinished, room?.state?.winnerUid, room?.state?.buzzerOpen, room?.state?.perChoiceMs, room?.state?.stemFinishedAt, room?.state?.awaitNext, choiceStreamCount]);

  // After a check, quickly reveal remaining choices
  useEffect(() => {
    if (!currentQ) return;
    if (choices.length === 0) return;
    if (!resultBanner) return;
    // Only reveal remaining choices quickly on CORRECT results; on incorrect, keep streaming normally
    if (!resultBanner.correct) return;
    if (choiceStreamCount >= 4) return;
    if (!revealChoicesAfterCheck) setRevealChoicesAfterCheck(true);
    const id = setInterval(() => setChoiceStreamCount(n => (n < 4 ? n + 1 : 4)), 150);
    return () => clearInterval(id);
  }, [resultBanner, currentQ?.id, choices.length, choiceStreamCount, revealChoicesAfterCheck]);

  // Record a shared stemFinishedAt once when stem completes, to anchor choices across clients
  useEffect(() => {
    if (!currentQ) return;
    if (!streamFinished) return;
    if (room?.state?.stemFinishedAt) return;
    // Write once if missing; races are benign
    (async () => {
      try { await setStemFinishedAt({ roomId, at: serverNow() }); } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamFinished, currentQ?.id, !!room?.state?.stemFinishedAt]);

  // Record a shared choicesFinishedAt once when all choices have streamed (or no choices exist)
  useEffect(() => {
    if (!currentQ) return;
    if (!streamFinished) return; // wait for stem to finish first
    if (room?.state?.choicesFinishedAt) return;
    const hasChoices = Array.isArray(choices) && choices.length > 0;
    const choicesDone = !hasChoices || choiceStreamCount >= 4;
    if (!choicesDone) return;
    (async () => {
      try { await setChoicesFinishedAt({ roomId, at: serverNow() }); } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, streamFinished, choiceStreamCount, !!room?.state?.choicesFinishedAt]);

  // Derived timers
  const buzzWindowMs = Number(room?.state?.buzzWindowMs || 0) || 0;
  const buzzWindowStartAt = Number(room?.state?.buzzWindowStartAt || 0) || 0;
  const buzzWindowRemainingMs = useMemo(() => {
    if (!buzzWindowMs || !buzzWindowStartAt) return null;
    const rem = buzzWindowMs - Math.max(0, serverNow() - buzzWindowStartAt);
    return Math.max(0, rem);
  }, [buzzWindowMs, buzzWindowStartAt, tick]);

  const answerWindowUid = room?.state?.answerWindowUid || null;
  const answerDeadlineAt = Number(room?.state?.answerWindowDeadlineAt || 0) || 0;
  const answerWindowRemainingMs = useMemo(() => {
    if (!answerWindowUid || !answerDeadlineAt) return null;
    return Math.max(0, answerDeadlineAt - serverNow());
  }, [answerWindowUid, answerDeadlineAt, tick]);

  // Auto-close buzzer when shared buzz window expires (no active winner)
  useEffect(() => {
    if (!currentQ) return;
    if (!room?.state?.buzzerOpen) return;
    if (room?.state?.winnerUid) return;
    if (room?.state?.awaitNext) return;
    if (buzzWindowRemainingMs === null) return;
    if (buzzWindowRemainingMs > 0) return;
    (async () => { try { await setMpBuzzerOpen({ roomId, open: false }); } catch {} })();
  }, [buzzWindowRemainingMs, !!currentQ, room?.state?.buzzerOpen, room?.state?.winnerUid, room?.state?.awaitNext]);

  // Ensure buzz window start is anchored as soon as choices finish (if buzzer is open)
  useEffect(() => {
    if (!currentQ) return;
    if (!room?.state?.buzzerOpen) return;
    if (!room?.state?.choicesFinishedAt) return;
    if (room?.state?.buzzWindowStartAt) return;
    (async () => { try { await setMpBuzzerOpen({ roomId, open: true }); } catch {} })();
  }, [!!currentQ, room?.state?.buzzerOpen, room?.state?.choicesFinishedAt, room?.state?.buzzWindowStartAt]);

  // Auto-handle answer timeout after 3s if winner hasn't submitted
  useEffect(() => {
    if (!currentQ) return;
    const uid = room?.state?.winnerUid;
    if (!uid) return;
    if (!answerWindowUid || uid !== answerWindowUid) return;
    if (!answerWindowRemainingMs || answerWindowRemainingMs > 0) return;
    const ansRec = answersMap?.[currentQ.id]?.[uid] || null;
    if (ansRec) return; // already answered
    // Try to claim handling; only one client proceeds
    (async () => {
      try {
        const claimed = await claimAnswerTimeout({ roomId, uid });
        if (!claimed) return;
        const isTossup = String(currentQ?.question_type || '').toLowerCase() === 'tossup';
        const interrupt = !!room?.state?.currentBuzzInterrupt;
        const delta = isTossup ? (interrupt ? -4 : 0) : 0;
        const identNow = getCurrentIdentity();
        const displayName = identNow?.displayName || 'Player';
        await setAnswerStatus({ roomId, questionId: currentQ.id, uid, displayName, data: { status: 'incorrect', text: '', correct: false, points: delta } });
        if (delta !== 0) { try { await awardScoreRtdb({ roomId, uid, delta }); } catch {} }
        await mpLockoutUid({ roomId, uid });
        await clearMpBuzz({ roomId });
        await setMpBuzzerOpen({ roomId, open: true });
      } catch {}
    })();
  }, [answerWindowRemainingMs, answersMap, currentQ?.id, room?.state?.winnerUid, answerWindowUid]);

  // Join handler with passcode for private rooms
  async function handleJoinWithPass() {
    try {
      setBusy(true);
      setError('');
      await joinRoomRtdb({ roomId, passcode: passPrompt });
      // Mark this session as validated so we don't prompt again
      try {
        window.localStorage.setItem(`mp_pass_ok_${roomId}`, '1');
        if (room?.passHash) window.localStorage.setItem(`mp_pass_hash_${roomId}`, String(room.passHash));
      } catch {}
      setNeedsPass(false);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinAsGuest() {
    setGuestNameError('');
    const name = String(guestNameInput || '').trim();
    if (!name || name.length < 2) { setGuestNameError('Enter a username (min 2 chars)'); return; }
    // Ensure uniqueness within current members
    const taken = members.some(m => (m.displayName || '').toLowerCase() === name.toLowerCase());
    if (taken) { setGuestNameError('Username is taken in this room'); return; }
    const ident = ensureGuestIdentity(name);
    try {
      setBusy(true);
      await joinRoomRtdb({ roomId, uid: ident.uid, displayName: ident.displayName });
      setNeedsGuestName(false);
    } catch (e) {
      setGuestNameError(e?.message || String(e));
    } finally { setBusy(false); }
  }

  if (auth.loading || !room) return (
    <div className="min-h-screen app-radial-bg dark:app-rad-bg transition-colors glass-backdrop">
      <Layout auth={auth}>
        <RoomSEO />
        <div className="glass p-6 space-y-3 max-w-3xl">
          <h1 className="text-xl font-semibold">Multiplayer Room</h1>
          <p className="opacity-80 text-sm">
            Practice Science Bowl together in real time. Rooms support live buzzing, chat, and shared control of question flow. Create a room on the
            <a className="text-blue-600 hover:underline ml-1" href="/multiplayer">multiplayer page</a> or join with a code.
          </p>
          <ul className="list-disc pl-5 text-sm opacity-80 space-y-1">
            <li>Host or join private/public rooms</li>
            <li>Buzz in on toss-ups and type answers</li>
            <li>Multiple choice and short-answer grading</li>
            <li>Filters for tournaments, categories, and rounds</li>
          </ul>
          <div className="pt-2">
            <a href="/round-generator" className="text-blue-600 hover:underline text-sm">Try the Round Generator</a>
            <span className="opacity-60 mx-2">•</span>
            <a href="/buzzer" className="text-blue-600 hover:underline text-sm">Use the simple buzzer</a>
          </div>
          <div className="pt-3">
            <Loading />
          </div>
        </div>
      </Layout>
    </div>
  );

  const haveIdentity = !!getCurrentIdentity();
  if (!auth.user && !haveIdentity) {
    return (
      <div className="min-h-screen app-radial-bg dark:app-rad-bg transition-colors glass-backdrop">
        <Layout auth={auth}>
          <div className="glass p-6 space-y-3 max-w-md">
            <div className="font-medium">Enter a username to join</div>
            <input className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard w-full" placeholder="Username" value={guestNameInput} onChange={(e)=>setGuestNameInput(e.target.value)} />
            <div className="flex gap-2 items-center">
              <button className="btn btn-primary" onClick={handleJoinAsGuest} disabled={busy || !guestNameInput}>Join</button>
              {guestNameError && <div className="text-sm text-red-600">{guestNameError}</div>}
            </div>
            <div className="text-xs opacity-70">You can sign in later; your guest slot will be removed automatically.</div>
          </div>
        </Layout>
      </div>
    );
  }

  // Move startOrNextQuestion above conditional returns
  async function startOrNextQuestion() {
    try {
      setQuestionError('');
      const normalizeCategory = (c) => {
        const u = String(c || '').trim().toUpperCase();
        if (!u) return u;
        // Map common MS/variant labels to HS-style buckets where reasonable
        if (u === 'PHYSICAL SCIENCE') return 'PHYSICS';
        if (u === 'LIFE SCIENCE') return 'BIOLOGY';
        if (u === 'EARTH AND SPACE SCIENCE') return 'EARTH AND SPACE';
        if (u === 'PHYS') return 'PHYSICS';
        if (u === 'CHEM') return 'CHEMISTRY';
        return u;
      };
      // Prefer local UI selection; fall back to room settings; then room.game; then any available
      let useTs = (selectedTournaments && selectedTournaments.length)
        ? selectedTournaments
        : (settings.selectedTournaments && settings.selectedTournaments.length)
          ? settings.selectedTournaments
          : (tlist.length ? tlist : (lazy.tournaments || []).slice(0, 2));
      if (!useTs.length) { setQuestionError('No tournaments loaded yet.'); return; }
      // Ensure loaded
      await lazy.ensureLoaded(useTs);
      // Filter by categories and round ranges from local UI state (more up-to-date)
      const rawPool = lazy.getLoadedQuestions(useTs);
      const usedMap = (room?.game?.used && typeof room.game.used === 'object') ? room.game.used : {};
      const selectedCats = (selectedCategories && selectedCategories.length)
        ? selectedCategories
        : (settings.selectedCategories || []);
      const catSet = new Set(selectedCats || []);
      const pool = rawPool.filter(q => {
        const rawU = String(q.category || '').toUpperCase();
        const catU = normalizeCategory(rawU);
        const catOk = !catSet.size || (rawU && (catSet.has(catU) || catSet.has(rawU)));
        // Type filter: allow tossup/bonus per selection
        const qt = String(q.question_type || '').toLowerCase();
        const typeOk = (selectedTypes.tossup && qt === 'tossup') || (selectedTypes.bonus && qt === 'bonus');
        const notUsed = !usedMap[q.id];
        return catOk && inRanges(q) && typeOk && notUsed;
      });
      if (!selectedTypes.tossup && !selectedTypes.bonus) {
        setQuestionError('Select at least one type: Toss-up or Bonus');
        return;
      }
      if (pool.length === 0) { setQuestionError('No questions available (all used for current filters).'); return; }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      await setMpCurrentQuestion({ roomId, questionId: pick.id, tournaments: useTs });
      await mpResetLockouts({ roomId });
      await setMpBuzzerOpen({ roomId, open: true });
      setResultBanner(null);
    } catch (e) {
      setQuestionError(e?.message || String(e));
    }
  }
  
  // Toggle pause/resume of reading and buzzing (no effect if someone has already buzzed)
  async function togglePause() {
    try {
      if (room?.state?.winnerUid) return; // don't resume while a winner is active
      const open = !!room?.state?.buzzerOpen;
      await setMpBuzzerOpen({ roomId, open: !open });
    } catch {}
  }

  // Helpers for grading
  // localCheckMultipleChoice removed; all MC answers use API and textbox input

  async function submitAnswerOrChat(e) {
    e?.preventDefault();
    const choicesLocal = parseMCChoicesRG(currentQ);
    const isMc = (choicesLocal || []).length > 0;
    // Winner input uses a single text box (mcTypedAnswer) for BOTH MC and short-answer
    const answerText = (mcTypedAnswer || '').trim();
    // For MC and Short Answer: we always take the winner's typed input
    const v = answerText;
    if (!v) {
      // Block empty submissions to avoid confusing grading responses
      setResultBanner({ correct: false, reason: 'No answer provided' });
      return;
    }
    if (!currentQ) return;
  const identNow = getCurrentIdentity();
  const uid = identNow?.uid;
  const displayName = identNow?.displayName || 'Player';
    const isWinner = uid && room?.state?.winnerUid === uid;

  // Show grading animation for all users
  await setMpGrading({ roomId, grading: true });

    // Winner: grade answer using API
    const isTossup = String(currentQ?.question_type || '').toLowerCase() === 'tossup';
    const choices = choicesLocal;
    const stem = String(currentQ?.question || currentQ?.leadin || currentQ?.text || '').trim();
    const correct = String(
      currentQ?.answer ??
      (Array.isArray(currentQ?.answers) ? currentQ.answers[0] : '') ??
      ''
    ).trim();
    let result = null;
    try {
      if (isTossup) {
        if (isMc) {
          // Tossup MC
          const body = {
            userAnswer: answerText,
            correctAnswer: correct,
            question: stem,
            choices: choices,
          };
          const res = await apiCheckMC(body);
          result = await res.json();
        } else {
          // Tossup short answer
          const body = {
            userAnswer: answerText,
            correctAnswer: correct,
            question: stem,
          };
          const res = await apiCheckBonus(body);
          result = await res.json();
        }
      } else {
        // Bonus (always use checkBonus)
        const body = {
          userAnswer: answerText,
          correctAnswer: correct,
          question: stem,
          ...(isMc ? { choices } : {}),
        };
        const res = await apiCheckBonus(body);
        result = await res.json();
      }
    } catch (err) {
      result = { correct: false, reason: 'Grading failed' };
    }

  setResultBanner(result);
  setChat('');
  // Keep mcTypedAnswer so others see the final locked text until next question

  // Hide grading animation after grading
  await setMpGrading({ roomId, grading: false });

    // Determine interrupt (buzzed before stem finished)
    const interrupt = !streamFinished;
    let delta = 0;
    if (isTossup) {
      delta = result.correct ? 4 : (interrupt ? -4 : 0);
    } else {
      delta = result.correct ? 10 : 0;
    }

    await setAnswerStatus({ roomId, questionId: currentQ.id, uid, displayName, data: { status: result.correct ? 'correct' : 'incorrect', text: v, correct: !!result.correct, points: delta } });
      if (delta !== 0) {
        await awardScoreRtdb({ roomId, uid, delta });
      }

    if (result.correct) {
      // Don't auto-advance; set awaiting-next flag
      await setAwaitNext({ roomId, value: true });
    } else {
      await mpLockoutUid({ roomId, uid });
      await clearMpBuzz({ roomId });
      await setMpBuzzerOpen({ roomId, open: true });
    }
  }

  async function nextQuestionManual() {
    try {
      await setAwaitNext({ roomId, value: false });
      await clearMpBuzz({ roomId });
      await mpResetLockouts({ roomId });
      await startOrNextQuestion();
    } catch {}
  }

  return (
    <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop">
      <Layout auth={auth}>
        <div className="space-y-4">
          <RoomHeader room={room} roomId={roomId} membersCount={members.length} onBack={()=>navigate('/multiplayer')} members={members} currentQ={currentQ} answersMap={answersMap} />

          {needsPass && !amMember && (
            <PasscodePrompt passPrompt={passPrompt} setPassPrompt={setPassPrompt} onJoin={handleJoinWithPass} busy={busy} error={error} />
          )}

          {(!needsPass || amMember) && (
            <div className="grid lg:grid-cols-3 gap-4 items-start">
              <div className="glass p-6 lg:col-span-2 space-y-4">
                <PlayControls
                  onStartNext={startOrNextQuestion}
                  onTogglePause={togglePause}
                  isPaused={!room?.state?.buzzerOpen}
                  winnerActive={room?.state?.winnerUid}
                  buzzWindowRemainingMs={buzzWindowRemainingMs}
                  showBuzzTimer={!!currentQ && !!room?.state?.buzzerOpen && !!room?.state?.choicesFinishedAt && !room?.state?.winnerUid && !room?.state?.awaitNext && buzzWindowRemainingMs !== null}
                />
                {questionError && <div className="text-sm text-red-600">{questionError}</div>}
                <QuestionPanel
                  grading={grading}
                  currentQ={currentQ}
                  words={words}
                  displayedWordCount={displayedWordCount}
                  plainQuestionText={plainQuestionText}
                  showBuzzHint={!room?.state?.winnerUid && room?.state?.buzzerOpen}
                  fullMcChoices={fullMcChoices}
                  choiceStreamCount={choiceStreamCount}
                  resultBanner={resultBanner}
                />
                {/* Buzz history: show all buzzes for current question in order */}
                <BuzzList
                  currentQId={currentQ?.id}
                  buzzes={currentQ ? buzzesMap[currentQ.id] : []}
                  answersForQ={currentQ ? answersMap?.[currentQ.id] : {}}
                  selfUid={selfUid}
                  members={members}
                  typingMap={typingMap}
                  winnerUid={room?.state?.winnerUid}
                  awaitNext={room?.state?.awaitNext}
                  mcTypedAnswer={mcTypedAnswer}
                  setMcTypedAnswer={setMcTypedAnswer}
                  onSubmit={submitAnswerOrChat}
                  onUpdateTyping={(typing, draft)=>updateTyping(roomId, typing, draft)}
                  mcInputRef={mcInputRef}
                  answerWindowUid={answerWindowUid}
                  answerWindowRemainingMs={answerWindowRemainingMs}
                />

                <HistoryPanel
                  history={history}
                  page={page}
                  setPage={setPage}
                  pageSize={pageSize}
                  byId={byId}
                  buzzesMap={buzzesMap}
                  answersMap={answersMap}
                  members={members}
                />
                {error && <div className="text-sm text-red-600">{error}</div>}
              </div>

              <div className="glass p-6 space-y-6">
                {/* Tabs header */}
                <div className="flex border-b border-black/10 dark:border-white/10 mb-3">
                  {['settings','chat'].map((key) => {
                    const isActive = rightTab===key;
                    const label = key === 'settings' ? 'Settings' : 'Chat';
                    return (
                      <button
                        key={key}
                        className={`relative px-3 py-2 -mb-px border-b-2 text-sm font-medium mr-2 ${isActive ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        onClick={()=>setRightTab(key)}
                      >
                        {label}
                        {/* Unread badge for Chat tab when inactive */}
                        {key==='chat' && !isActive && unreadChatCount>0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center shadow">{unreadChatCount>99?'99+':unreadChatCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {rightTab === 'settings' ? (
                  <>
                    <div>
                      <div className="font-semibold mb-2">Selection</div>
                      <TournamentSelector
                        tournaments={lazy.tournaments || []}
                        tournamentGroups={tournamentGroups}
                        selectedTournaments={selectedTournaments}
                        setSelectedTournaments={setSelectedTournamentsDirty}
                        tournamentGroupsOpen={tournamentGroupsOpen}
                        setTournamentGroupsOpen={setTournamentGroupsOpen}
                        handleTournamentToggle={handleTournamentToggle}
                        tournamentVisibleEntriesMainRef={tournamentVisibleEntriesMainRef}
                        isDark={isDark}
                        showTournamentModal={showTournamentModal}
                        setShowTournamentModal={setShowTournamentModal}
                      />
                    </div>
                    <CategoriesSelector
                      categories={categories}
                      selectedCategories={selectedCategories}
                      setSelectedCategories={setSelectedCategoriesDirty}
                    />
                    <div className="pt-2">
                      <div className="font-semibold mb-1">Question Type</div>
                      <div className="flex items-center gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedTypes.tossup}
                            onChange={(e)=>setSelectedTypesDirty(t=>({ ...t, tossup: e.target.checked }))}
                          />
                          Toss-up
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedTypes.bonus}
                            onChange={(e)=>setSelectedTypesDirty(t=>({ ...t, bonus: e.target.checked }))}
                          />
                          Bonus
                        </label>
                      </div>
                    </div>
                    <RoundRanges
                      selectedTournaments={selectedTournaments}
                      tournaments={lazy.tournaments || []}
                      roundRanges={roundRanges}
                      setRoundRanges={setRoundRangesDirty}
                      roundsByTournament={roundsByTournament}
                      globalNumericRoundMax={globalNumericRoundMax}
                    />
                  </>
                ) : (
                  <ChatPanel
                    roomId={roomId}
                    messages={messages}
                    typingMap={typingMap}
                    selfUid={selfUid}
                    onSendMessage={async (text)=>{ try { await sendMessageRtdb({ roomId, text }); } catch {} }}
                    onUpdateTyping={(typing, draft)=>updateTyping(roomId, typing, draft)}
                    disabled={!!(selfUid && room?.state?.winnerUid === selfUid)}
                    inputRef={chatInputRef}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
      {/* Fixed mobile buzz bar at bottom */}
      {(() => {
        const locked = (room?.state?.lockedOut && typeof room.state.lockedOut === 'object') ? room.state.lockedOut : {};
        const canBuzz = !!currentQ && !!room?.state?.buzzerOpen && !room?.state?.winnerUid && (!selfUid || !locked[selfUid]);
        return (
          <div className="md:hidden fixed bottom-0 inset-x-0 z-40 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto">
              <button
                className={`w-full py-4 rounded-2xl text-white text-lg font-bold shadow-xl active:scale-[0.98] transition ${canBuzz ? 'bg-red-600' : 'bg-red-300 cursor-not-allowed'}`}
                onClick={() => { if (canBuzz) onBuzz(); }}
                aria-label="Buzz"
                disabled={!canBuzz}
              >
                {canBuzz ? 'BUZZ' : (room?.state?.winnerUid ? 'BUZZ LOCKED' : 'BUZZ DISABLED')}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Smooth typing display: gradually reveal or hide characters to match latest drafts.
function TypingStream({ typingMap, selfUid }) {
  const [displays, setDisplays] = React.useState({}); // { uid: { displayed: string, target: string, name: string } }

  // Update targets on low-latency typingMap events (exclude self)
  React.useEffect(() => {
    const next = {};
    Object.values(typingMap || {}).forEach((m) => {
      if (!m || m.uid === selfUid) return;
      const draft = String(m.draft || '');
      const isTyping = !!m.typing && draft.length > 0;
      if (!isTyping) return;
      next[m.uid] = { displayed: (displays[m.uid]?.displayed || ''), target: draft, name: m.displayName || m.uid };
    });
    setDisplays(prev => {
      const merged = { ...prev };
      // Remove any that are no longer typing
      Object.keys(merged).forEach(uid => { if (!next[uid]) delete merged[uid]; });
      // Add/update targets
      Object.entries(next).forEach(([uid, entry]) => {
        if (!merged[uid]) merged[uid] = { displayed: '', target: entry.target, name: entry.name };
        else merged[uid] = { ...merged[uid], target: entry.target, name: entry.name };
      });
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(typingMap), selfUid]);

  // Interval to animate towards target; accelerate when far behind, snap when close (no extra lag)
  React.useEffect(() => {
    const id = setInterval(() => {
      setDisplays(prev => {
        const out = { ...prev };
        let changed = false;
        for (const uid of Object.keys(out)) {
          const { displayed = '', target = '' } = out[uid] || {};
          if (displayed === target) continue;
          // Move by a variable step towards target
          let next;
          if (displayed.length < target.length) {
            const delta = target.length - displayed.length;
            if (delta <= 3) next = target; // snap when close
            else {
              const step = Math.max(1, Math.min(6, Math.floor(delta / 4))); // up to 6 chars when far behind
              next = target.slice(0, displayed.length + step);
            }
          } else {
            const delta = displayed.length - target.length;
            if (delta <= 3) next = target; // snap when close
            else {
              const step = Math.max(1, Math.min(5, Math.floor(delta / 5)));
              next = displayed.slice(0, Math.max(0, displayed.length - step));
            }
          }
          if (next !== displayed) {
            out[uid] = { ...out[uid], displayed: next };
            changed = true;
          }
        }
        return changed ? out : prev;
      });
    }, 40);
    return () => clearInterval(id);
  }, []);

  const entries = Object.entries(displays);
  if (entries.length === 0) return null;
  return (
    <div className="text-xs text-black/70 dark:text-white/70">
      Typing: {entries.slice(0, 3).map(([uid, e], i) => (
        <span key={uid}>
          <span className="font-medium">{e.name}</span>
          {': '}{e.displayed}{(displays[uid]?.target || '').length > 60 ? '…' : ''}
          {i < Math.min(entries.length, 3) - 1 ? ' • ' : ''}
        </span>
      ))}
      {entries.length > 3 ? ` • +${entries.length - 3} more` : ''}
    </div>
  );
}

// Lightweight typing updater with debounce/throttle to reduce write/read churn
let typingTimer = null;
let lastSent = { roomId: null, typing: null, draft: null, at: 0 };
async function updateTyping(roomId, typing, draft) {
  const db = getDatabase();
  const now = Date.now();
  const text = draft || '';
  const immediate = !typing || text.length === 0 || now - (lastSent.at || 0) > 300 || lastSent.typing !== !!typing;

  const send = async () => {
    try {
      const ident = getCurrentIdentity?.() || null;
      const uid = ident?.uid;
      const displayName = ident?.displayName || 'Player';
      if (!uid) return;
      // Skip identical repeats within a short window
      const now2 = Date.now();
      if (
        lastSent.roomId === roomId &&
        lastSent.typing === !!typing &&
        lastSent.draft === text &&
        now2 - (lastSent.at || 0) < 120
      ) {
        return;
      }
      const mref = ref(db, `mp/roomMembers/${roomId}/${uid}`);
      await rtdbUpdate(mref, {
        uid,
        displayName,
        typing: !!typing,
        draft: text,
        lastTypedAt: Date.now(),
      });
      lastSent = { roomId, typing: !!typing, draft: text, at: now2 };
    } catch {}
  };

  if (typingTimer) clearTimeout(typingTimer);
  if (immediate) {
    await send();
  } else {
    typingTimer = setTimeout(send, 120);
  }
}
