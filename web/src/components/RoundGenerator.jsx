import React, { useMemo, useState, useRef } from 'react';
import { idbGet } from '../data/idb.js';
import { AlertTriangle, Plus, Minus, FileDown, CloudCheck, Trash2, ChevronRight, ChevronUp, ChevronDown, ArrowUp, List, RefreshCw, FolderPlus, Pencil, Maximize2, Play } from 'lucide-react';
import LatexRenderer from './LatexRenderer.jsx';
import { getRoundsIndex, getRoundDetail, saveUserRound, buildExcludeSetFromRound, renameUserRound, syncUserRoundsCache, deleteUserRound, setUserRoundFolder, getRoundFolders, addRoundFolder, renameRoundFolder, deleteRoundFolder } from '../data/rounds.firestore.js';
import { unique, findBonus, parseMCChoices, categoryToCode, loadHtml2Pdf } from './roundGenerator/utils/helpers.js';
import { isVisualBonus } from '../data/visualBonuses.js';
import TournamentSelector from './roundGenerator/components/TournamentSelector.jsx';
import RoundRanges from './roundGenerator/components/RoundRanges.jsx';
import SavedRoundsPanel from './roundGenerator/components/SavedRoundsPanel.jsx';
import { useFilters } from './roundGenerator/hooks/useFilters.js';
import { useUserRounds } from './roundGenerator/hooks/useUserRounds.js';
// react-pdf for scoresheet generation (round PDF of questions still uses existing html2pdf for now)
import { pdf as reactPdf } from '@react-pdf/renderer';
import ScoresheetPDF from './ScoresheetPDF.jsx';
import QuestionPairCard from './roundGenerator/components/QuestionPairCard.jsx';
import RoundPdfContent from './roundGenerator/components/RoundPdfContent.jsx';
import SearchBar from './roundGenerator/components/SearchBar.jsx';
import ScorekeeperPane from './roundGenerator/components/ScorekeeperPane.jsx';
import SubstitutionModal from './roundGenerator/components/SubstitutionModal.jsx'; // New modal for structured player substitutions
import { checkAnswerMC as apiCheckMC, checkAnswerBonus as apiCheckBonus } from '../api/client.js';
import { useRoundSession } from '../context/RoundSessionContext.jsx';

export default function RoundGenerator({ questions = [], lazy = null, auth = null, persistedGenerated = null, setPersistedGenerated = null, onNewRound = null }) {
  // Filters, tournaments, rounds, and ranges
  const {
    isLazy,
    tournaments,
    tournamentGroups,
    selectedTournaments,
    setSelectedTournaments,
    selectedCategories,
    setSelectedCategories,
    tournamentGroupsOpen,
    setTournamentGroupsOpen,
    tournamentVisibleEntriesMainRef,
    tournamentVisibleEntriesModalRef,
    lastTournamentClickIndexMainRef,
    lastTournamentClickIndexModalRef,
    handleTournamentToggle,
    loadedQuestions,
    validQuestions,
    categories,
    roundRanges,
    setRoundRanges,
    roundsByTournament,
    globalNumericRoundMax,
    inRanges,
  } = useFilters({ questions, lazy });

  // UI state for tournament selector modal (used by TournamentSelector)
  const [showTournamentModal, setShowTournamentModal] = useState(false);

  // Simple toast system (must be defined before hooks that use pushToast)
  const [toasts, setToasts] = useState([]); // { id, message, type, ttl, created }
  function pushToast(message, type = 'info', ttl = 4000) {
    const id = Math.random().toString(36).slice(2);
    const created = Date.now();
    setToasts(t => [...t, { id, message, type, ttl, created }]);
    if (ttl > 0) setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttl + 50);
  }

  // Saved user rounds management
  const {
    roundsIndex,
    setRoundsIndex,
    loadingUserRounds,
    roundFolders,
    setRoundFolders,
    foldersOpen,
    setFoldersOpen,
    selectedExcludeRoundIds,
    setSelectedExcludeRoundIds,
    excludeDetailCache,
    handleExcludeRoundToggle,
    refresh,
    createFolder,
    renameFolder,
    moveRoundsToFolder,
    renameRound,
    deleteRoundPermanently,
    deleteFolderAndRounds,
  } = useUserRounds({ auth, pushToast });
  const lastTournamentIndex = useRef(null);
  const lastCategoryIndex = useRef(null);
  // Track if the user has attempted a generation (used for empty-results messaging)
  const [generationAttempted, setGenerationAttempted] = useState(false);
  const [count, setCount] = useState(10);
  // Generated round pairs: use externally managed state if provided (to persist across tab switches)
  const [localGenerated, setLocalGenerated] = useState([]);
  const generated = Array.isArray(persistedGenerated) ? persistedGenerated : localGenerated;
  const setGenerated = typeof setPersistedGenerated === 'function' ? setPersistedGenerated : setLocalGenerated;
  // Session history paginator (previously generated rounds this session)
  const { history } = useRoundSession();
  const [histPos, setHistPos] = useState(null);
  React.useEffect(() => {
    if (Array.isArray(history) && history.length > 0) setHistPos(history.length - 1);
    else setHistPos(null);
  }, [history]);
  function loadHistoryAt(pos) {
    if (!Array.isArray(history) || history.length === 0) return;
    if (pos < 0 || pos >= history.length) return;
    setCommittedSearch('');
    setHistPos(pos);
    const pairs = history[pos] || [];
    setGenerated(pairs);
    setHasUnsavedRound(true);
    resetScorekeeping();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }
  // Question type selection now driven by checkboxes
  const [includeTossups, setIncludeTossups] = useState(true);
  const [includeBonuses, setIncludeBonuses] = useState(true);
  const [includeVisualBonuses, setIncludeVisualBonuses] = useState(false);
  const [questionType, setQuestionType] = useState('both'); // derived legacy mode for compatibility
  // Allow visual bonuses in paired mode (when both tossups and bonuses selected)
  const allowVisualInPairs = includeTossups && includeBonuses && includeVisualBonuses;
  // Allow visual bonuses when generating bonus-only rounds (both bonus types selected without tossups)
  const allowVisualInBonusOnly = !includeTossups && includeBonuses && includeVisualBonuses;
  // Keep legacy questionType in sync for existing logic, scorekeeper, and saving
  React.useEffect(() => {
    let mode = 'both';
    if (includeTossups && includeBonuses) mode = 'both';
    else if (includeTossups && !includeBonuses) mode = 'tossup';
    else if (!includeTossups && includeBonuses && !includeVisualBonuses) mode = 'bonus';
    else if (!includeTossups && !includeBonuses && includeVisualBonuses) mode = 'visual-bonus';
    else if (!includeTossups && includeBonuses && includeVisualBonuses) mode = 'bonus'; // bonus-only but allow visuals
    else mode = 'both'; // fallback
    setQuestionType(mode);
  }, [includeTossups, includeBonuses, includeVisualBonuses]);
  const pdfRef = React.useRef(null);
  const QUESTIONS_PER_PAGE = 2;
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // moved into useUserRounds
  const [showBackToTop, setShowBackToTop] = useState(false);
  // Track dark mode so we can adapt tournament selection gradient for accessibility
  const [isDark, setIsDark] = useState(() => {
    try { return document.documentElement.classList.contains('dark'); } catch { return false; }
  });
  React.useEffect(() => {
    try {
      const root = document.documentElement;
      const update = () => setIsDark(root.classList.contains('dark'));
      update();
      // Observe class attribute changes (tailwind dark mode toggles class)
      const mo = new MutationObserver(update);
      mo.observe(root, { attributes: true, attributeFilter: ['class'] });
      // Also listen to OS scheme changes as a fallback
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', update);
      return () => { mo.disconnect(); mql.removeEventListener('change', update); };
    } catch { /* no-op in non-browser */ }
  }, []);
  // Scorekeeper / stats state
  const [scorekeeping, setScorekeeping] = useState(false); // whether scorekeeping pane is open
  const nextPlayerIdRef = useRef(9);
  const [players, setPlayers] = useState(() => Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    team: i < 4 ? 'A' : 'B',
    seat: i < 4 ? (i + 1) : (i - 3), // seat number within team
    name: '',
    status: 'active',
    stats: { correct: 0, incorrect: 0, correctInterrupt: 0, incorrectInterrupt: 0 }
  })));
  const [currentIndex, setCurrentIndex] = useState(0); // index of active pair (tossup/bonus)
  const [awaitingPlayer, setAwaitingPlayer] = useState(null); // { type: 'correct'|'incorrect', interrupt: boolean }
  const [interruptArmed, setInterruptArmed] = useState(false); // toggled when Interrupt button pressed prior to correct/incorrect
  // Typed-answer on interrupt (LLM check) state
  const [typedAnswerActive, setTypedAnswerActive] = useState(false); // when true, clicking a player selects them for typed-answer flow instead of immediately logging
  const [typedAnswerText, setTypedAnswerText] = useState('');
  const [typedAnswerPlayerId, setTypedAnswerPlayerId] = useState(null);
  const [typedAnswerLoading, setTypedAnswerLoading] = useState(false);
  const [typedAnswerReason, setTypedAnswerReason] = useState('');
  // tossupResults: final outcome snapshot for each tossup. We augment with an `attempts` array so we can track first incorrect then rebound attempt without losing penalty points.
  const [tossupResults, setTossupResults] = useState([]); // per index: { result?, playerId?, interrupt?, points, attempts?: [{ playerId, team, result, interrupt, points }] }
  const [bonusResults, setBonusResults] = useState([]); // per index: { points: number, team: 'A'|'B' }
  // Team buzz / substitution state
  const [attemptedTeam, setAttemptedTeam] = useState(null); // team that has already attempted this tossup
  const [allowedTeams, setAllowedTeams] = useState(['A', 'B']); // teams allowed to buzz; after incorrect restrict to other team
  // Tryouts mode: when enabled (and only for toss-ups only rounds) an incorrect attempt locks ONLY that player, not their teammates or other team.
  const [tryoutsMode, setTryoutsMode] = useState(false);
  // Persist tryouts mode preference across sessions (local only)
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('sb_tryoutsMode');
      if (stored === '1') setTryoutsMode(true);
    } catch {}
  }, []);
  React.useEffect(() => {
    try { localStorage.setItem('sb_tryoutsMode', tryoutsMode ? '1':'0'); } catch {}
  }, [tryoutsMode]);
  const [subMode, setSubMode] = useState(false); // substitution mode toggle
  const [activeSubTeam, setActiveSubTeam] = useState('A');
  // Dedicated substitution modal visibility
  const [showSubModal, setShowSubModal] = useState(false);
  const [bonusInput, setBonusInput] = useState(''); // active bonus input value
  // Removed stats PDF (unofficial) per request
  const [headerOffset, setHeaderOffset] = useState(0); // height of global header to offset side pane
  const questionRefs = useRef([]); // refs to question cards for smooth scrolling

  // Measure a likely site header (common selectors) once and on resize
  React.useEffect(() => {
    function measure() {
      const header = document.querySelector('header, .site-header, .app-header, .top-bar');
      if (header) {
        const rect = header.getBoundingClientRect();
        setHeaderOffset(rect.height);
      } else {
        setHeaderOffset(0);
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Smooth scroll to active question when scorekeeping and currentIndex changes
  React.useEffect(() => {
    if (!scorekeeping) return;
    const el = questionRefs.current[currentIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      const topPad = Math.max(headerOffset + 12, 0);
      // Use window.scrollTo for offset control
      const rect = el.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - topPad;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }, [currentIndex, scorekeeping, headerOffset]);

  // Derived total points (simplified Science Bowl scoring)
  const totalPoints = useMemo(() => {
    let sum = 0;
    tossupResults.forEach(r => {
      if (!r) return;
      if (Array.isArray(r.attempts)) {
        r.attempts.forEach(a => { if (typeof a.points === 'number') sum += a.points; });
      } else if (typeof r.points === 'number') {
        sum += r.points;
      }
    });
    bonusResults.forEach(r => { if (r && typeof r.points === 'number') sum += r.points; });
    return sum;
  }, [tossupResults, bonusResults]);

  // Per-team aggregate points (toss-up + bonus)
  const teamPoints = useMemo(() => {
    const totals = { A: 0, B: 0 };
    tossupResults.forEach(r => {
      if (!r) return;
      if (Array.isArray(r.attempts) && r.attempts.length) {
        r.attempts.forEach(a => {
          const team = players.find(p => p.id === a.playerId)?.team;
            if (team) totals[team] += a.points || 0;
        });
      } else if (r.playerId) {
        const team = players.find(p => p.id === r.playerId)?.team;
        if (team) totals[team] += r.points || 0;
      }
    });
    bonusResults.forEach(r => { if (r?.team) totals[r.team] += r.points || 0; });
    return totals;
  }, [tossupResults, bonusResults, players]);

  function resetScorekeeping() {
    setCurrentIndex(0);
    setAwaitingPlayer(null);
    setTossupResults([]);
    setBonusResults([]);
    setBonusInput('');
  setAttemptedTeam(null);
  setAllowedTeams(['A','B']);
  setSubMode(false);
  }
  function handleSeatClick(idx) {
    const p = players[idx];
    if (!p) return;
    // If we're in typed-answer flow, clicking a seat selects the player and returns early
    if (typedAnswerActive) {
      if (!allowedTeams.includes(p.team)) {
        pushToast(`Team ${p.team} not allowed to buzz now.`, 'error');
        return;
      }
      if (p.status === 'replaced') {
        pushToast('Cannot buzz: seat replaced.', 'error');
        return;
      }
      // In tryouts mode, ensure this player hasn't already attempted on this tossup
      if (tryoutsMode && questionType === 'tossup') {
        const attempts = (tossupResults[currentIndex]?.attempts) || [];
        if (attempts.some(a => a.playerId === p.id)) {
          pushToast('This player already attempted this toss-up.', 'error');
          return;
        }
      }
      setTypedAnswerPlayerId(p.id);
      pushToast(`Selected ${p.name || `Seat ${p.team}${p.seat ?? ''}`} for typed interrupt.`, 'info', 2500);
      return;
    }
    if (p.status === 'replaced') {
      pushToast('Cannot buzz: seat replaced.', 'error');
      return;
    }
    // Legacy in-place rename remains when not awaiting player & not using new modal
    // (substitution modal supersedes subMode flow; subMode retained for backwards compatibility)
    if (awaitingPlayer) {
      if (!allowedTeams.includes(p.team)) {
        pushToast(`Team ${p.team} not allowed to buzz now.`, 'error');
        return;
      }
      // Register tossup attempt for this player
      const { type, interrupt } = awaitingPlayer;
      const isFirstAttempt = attemptedTeam == null; // if true, rebound still possible after incorrect
      setTossupResults(res => {
        const next = [...res];
        const attemptPoints = type === 'correct' ? 4 : (type === 'incorrect' && interrupt ? -4 : 0);
        const prev = next[currentIndex] || {};
        const attempts = Array.isArray(prev.attempts) ? [...prev.attempts] : [];
        attempts.push({ playerId: p.id, team: p.team, result: type, interrupt, points: attemptPoints });
        if (type === 'correct') {
          // Finalize immediately
          next[currentIndex] = { ...prev, attempts, result: 'correct', playerId: p.id, interrupt, points: attemptPoints };
        } else {
          if (isFirstAttempt) {
            // Store first incorrect attempt but allow rebound (do not advance yet)
            next[currentIndex] = { ...prev, attempts, result: 'incorrect', playerId: p.id, interrupt, points: attemptPoints };
          } else {
            // Second incorrect attempt ends question
            next[currentIndex] = { ...prev, attempts, result: 'incorrect', playerId: p.id, interrupt, points: attemptPoints };
          }
        }
        return next;
      });
      setPlayers(list => list.map(pl => pl.id === p.id ? ({
        ...pl,
        stats: {
          ...pl.stats,
          correct: pl.stats.correct + (awaitingPlayer.type === 'correct' && !awaitingPlayer.interrupt ? 1 : 0),
          incorrect: pl.stats.incorrect + (awaitingPlayer.type === 'incorrect' && !awaitingPlayer.interrupt ? 1 : 0),
          correctInterrupt: pl.stats.correctInterrupt + (awaitingPlayer.type === 'correct' && awaitingPlayer.interrupt ? 1 : 0),
          incorrectInterrupt: pl.stats.incorrectInterrupt + (awaitingPlayer.type === 'incorrect' && awaitingPlayer.interrupt ? 1 : 0),
        }
      }) : pl));
      setAwaitingPlayer(null);
      setInterruptArmed(false);
      if (isFirstAttempt && awaitingPlayer.type === 'incorrect') {
        if (tryoutsMode && questionType === 'tossup') {
          // In tryouts mode we only block this specific player from being selected again this tossup.
          setAttemptedTeam(null); // no team-wide attempt tracking
          setAllowedTeams(['A','B']); // keep all teams available
        } else {
          // Mark first team attempted; allow rebound from the other team (still awaiting outcome)
          setAttemptedTeam(p.team);
          setAllowedTeams([p.team === 'A' ? 'B' : 'A']);
        }
      } else if (awaitingPlayer.type === 'incorrect') {
        // Second incorrect (both teams attempted) -> finalize tossup and advance
        setAttemptedTeam(null);
        setAllowedTeams([]);
        setTimeout(() => advanceIfReady(), 200);
      } else if (awaitingPlayer.type === 'correct') {
        setAttemptedTeam(null);
        setAllowedTeams([]);
        const pair = displayPairs[currentIndex];
        if (pair?.bonus && pair.tossup) {
          setBonusInput('');
        } else {
          setTimeout(() => advanceIfReady(), 150);
        }
      }
      return;
    }
    // Simple name entry / rename outside awaiting mode
    if (!p.name) {
      const name = window.prompt('Enter player name (seat ' + (idx + 1) + ')', '');
      if (name != null) setPlayers(list => list.map((pl, i) => i === idx ? { ...pl, name: name.trim() } : pl));
    } else {
      const name = window.prompt('Rename player', p.name);
      if (name != null) setPlayers(list => list.map((pl, i) => i === idx ? { ...pl, name: name.trim() } : pl));
    }
  }

  // Internal helper to record an attempt for a given player, used by typed-answer flow
  function recordAttemptForPlayer({ player, type, interrupt }) {
    if (!player) return;
    const isFirstAttempt = attemptedTeam == null;
    setTossupResults(res => {
      const next = [...res];
      const attemptPoints = type === 'correct' ? 4 : (type === 'incorrect' && interrupt ? -4 : 0);
      const prev = next[currentIndex] || {};
      const attempts = Array.isArray(prev.attempts) ? [...prev.attempts] : [];
      attempts.push({ playerId: player.id, team: player.team, result: type, interrupt, points: attemptPoints });
      if (type === 'correct') {
        next[currentIndex] = { ...prev, attempts, result: 'correct', playerId: player.id, interrupt, points: attemptPoints };
      } else {
        next[currentIndex] = { ...prev, attempts, result: 'incorrect', playerId: player.id, interrupt, points: attemptPoints };
      }
      return next;
    });
    // Update player stats
    setPlayers(list => list.map(pl => pl.id === player.id ? ({
      ...pl,
      stats: {
        ...pl.stats,
        correct: pl.stats.correct + (type === 'correct' && !interrupt ? 1 : 0),
        incorrect: pl.stats.incorrect + (type === 'incorrect' && !interrupt ? 1 : 0),
        correctInterrupt: pl.stats.correctInterrupt + (type === 'correct' && interrupt ? 1 : 0),
        incorrectInterrupt: pl.stats.incorrectInterrupt + (type === 'incorrect' && interrupt ? 1 : 0),
      }
    }) : pl));
    // Clear awaiting/interrupt flags if set (typed-answer path sets none normally)
    setAwaitingPlayer(null);
    setInterruptArmed(false);
    if (type === 'incorrect') {
      if (isFirstAttempt) {
        if (tryoutsMode && questionType === 'tossup') {
          setAttemptedTeam(null);
          setAllowedTeams(['A','B']);
        } else {
          setAttemptedTeam(player.team);
          setAllowedTeams([player.team === 'A' ? 'B' : 'A']);
        }
      } else {
        // both teams have attempted and missed
        setAttemptedTeam(null);
        setAllowedTeams([]);
        setTimeout(() => advanceIfReady(), 200);
      }
    } else if (type === 'correct') {
      setAttemptedTeam(null);
      setAllowedTeams([]);
      const pair = displayPairs[currentIndex];
      if (!(pair?.bonus && pair.tossup)) {
        setTimeout(() => advanceIfReady(), 150);
      } else {
        setBonusInput('');
      }
    }
  }

  async function checkTypedAnswerWithLLM() {
    try {
      if (!typedAnswerActive) return;
      const pair = displayPairs[currentIndex];
      const tossup = pair?.tossup;
      if (!tossup) { pushToast('No toss-up at this question.', 'error'); return; }
      if (!typedAnswerPlayerId) { pushToast('Select a player seat first.', 'error'); return; }
      const player = players.find(p => p.id === typedAnswerPlayerId);
      if (!player) { pushToast('Invalid player selection.', 'error'); return; }
      const ua = String(typedAnswerText || '').trim();
      if (!ua) { pushToast('Enter an answer to check.', 'error'); return; }
      setTypedAnswerLoading(true);
      setTypedAnswerReason('');
      // Post to backend function: use MC checker if tossup has choices (typed interrupt), else short-answer checker
      const tuChoices = parseMCChoices(tossup);
      const isMC = Array.isArray(tuChoices) && tuChoices.length > 0;
      const payload = { userAnswer: ua, correctAnswer: tossup.answer, question: tossup.question };
      if (isMC) { (payload).choices = tuChoices; }
      const resp = await (isMC ? apiCheckMC(payload) : apiCheckBonus(payload)).catch(err => ({ ok: false, statusText: err?.message }));
      if (!resp || !resp.ok) {
        pushToast('AI check failed. You can record manually.', 'error');
        return;
      }
      const data = await resp.json().catch(() => ({}));
      const correct = !!data?.correct;
      const reason = typeof data?.reason === 'string' ? data.reason : '';
      setTypedAnswerReason(reason || '');
      // Record attempt with interrupt = true
      recordAttemptForPlayer({ player, type: correct ? 'correct' : 'incorrect', interrupt: true });
      pushToast(correct ? 'AI: Correct interrupt.' : 'AI: Incorrect interrupt.', correct ? 'success' : 'error');
    } catch (e) {
      console.error(e);
      pushToast('AI check encountered an error.', 'error');
    } finally {
      setTypedAnswerLoading(false);
      // reset typed-answer panel but keep reason briefly
      setTypedAnswerActive(false);
      setTypedAnswerText('');
      setTypedAnswerPlayerId(null);
      // Clear reason after a short delay
      setTimeout(() => setTypedAnswerReason(''), 4000);
    }
  }

  function recordNoAnswer() {
    setTossupResults(res => {
      const next = [...res];
      const prev = next[currentIndex] || {};
      // Preserve any existing attempts (buzzes) exactly as-is.
      const attempts = Array.isArray(prev.attempts) ? prev.attempts : [];
      next[currentIndex] = { ...prev, attempts, result: 'no-answer', points: prev.points || 0 };
      return next;
    });
    setAwaitingPlayer(null);
    setInterruptArmed(false);
    setAllowedTeams([]);
    setTimeout(() => advanceIfReady(), 150);
  }

  function advanceIfReady() {
    const pair = displayPairs[currentIndex];
    const tossRes = tossupResults[currentIndex];
    // If there is a bonus AND tossup correct and not yet scored bonus, wait
    if (pair?.bonus && pair?.tossup && tossRes?.result === 'correct' && !bonusResults[currentIndex]) return;
    // Move to next unanswered pair
    setCurrentIndex(ci => Math.min(ci + 1, displayPairs.length));
  setAttemptedTeam(null);
  setAllowedTeams(['A','B']);
  }

  function saveBonusPoints() {
    const val = Number(bonusInput);
    if (!Number.isFinite(val) || val < 0) return;
    const pts = Math.min(10, Math.max(0, val));
  const tu = tossupResults[currentIndex];
  const team = tu?.playerId ? (players.find(p => p.id === tu.playerId)?.team || 'A') : 'A';
  setBonusResults(r => { const next = [...r]; next[currentIndex] = { points: pts, team }; return next; });
    setBonusInput('');
    setTimeout(() => advanceIfReady(), 100);
  }

  // Helper: determine if a tossup is fully resolved (no further attempts allowed)
  function isTossupFinal(idx) {
    const r = tossupResults[idx];
    if (!r) return false; // no attempts logged yet
    if (r.result === 'replaced' || r.result === 'no-answer') return true;
    if (r.result === 'correct') return true;
    // If incorrect and only one attempt, not final (rebound possible)
    if (tryoutsMode && questionType === 'tossup') {
      // In tryouts mode we allow unlimited distinct-player attempts across both teams until a correct OR all players exhausted.
      // Determine unique active players still available: any active player not already in attempts list.
      const attempts = r.attempts || [];
      const attemptedPlayerIds = new Set(attempts.map(a => a.playerId));
      const remaining = players.filter(p => p.status !== 'replaced').filter(p => !attemptedPlayerIds.has(p.id));
      // Final only if no remaining players
      return remaining.length === 0;
    }
    const attempts = r.attempts || [];
    const distinctTeams = new Set(attempts.map(a => players.find(p => p.id === a.playerId)?.team).filter(Boolean));
    return distinctTeams.size >= 2 && r.result === 'incorrect'; // both teams tried incorrectly
  }

  // New fixed bonus award (either +10 or 0) then advance
  function saveFixedBonus(award) {
    const pts = award ? 10 : 0;
    const tu = tossupResults[currentIndex];
    const team = tu?.playerId ? (players.find(p => p.id === tu.playerId)?.team || 'A') : 'A';
    setBonusResults(r => { const next = [...r]; next[currentIndex] = { points: pts, team }; return next; });
    // Immediately move to next pair; manually replicate advance logic so we don't wait on state flush.
    setAwaitingPlayer(null);
    setInterruptArmed(false);
    setAttemptedTeam(null);
    setAllowedTeams(['A','B']);
    setCurrentIndex(ci => Math.min(ci + 1, displayPairs.length));
  }

  function throwOutAndReplace() {
    const pair = displayPairs[currentIndex];
    if (!pair) return;
    // Build a replacement pair using existing filters (avoid duplicates by id).
    // IMPORTANT: We *do not* mark the tossup as final ('replaced') so that buttons remain active.
    const existingIds = new Set(displayPairs.flatMap(p => [p.tossup?.id, p.bonus?.id].filter(Boolean)));
    const poolPairs = computePairs();
    const replacement = poolPairs.find(p => !existingIds.has(p.tossup?.id) && !existingIds.has(p.bonus?.id)) || poolPairs[0];
    setGenerated(list => list.map((p, idx) => idx === currentIndex ? replacement : p));
    // Clear any prior scoring result for this index so isTossupFinal() returns false.
    setTossupResults(res => { const next = [...res]; next[currentIndex] = undefined; return next; });
    setBonusResults(res => { const next = [...res]; next[currentIndex] = undefined; return next; });
    // Reset buzz state so both teams can attempt.
    setAttemptedTeam(null);
    setAllowedTeams(['A','B']);
    setAwaitingPlayer(null);
    setInterruptArmed(false);
    setTypedAnswerActive(false);
    setTypedAnswerText('');
    setTypedAnswerPlayerId(null);
    pushToast('Question replaced.', 'info');
  }

  const [coachesSheetLoading, setCoachesSheetLoading] = useState(false);
  async function exportCoachesScoresheetPdf() {
    setCoachesSheetLoading(true);
    try {
      // Build react-pdf document in memory
      const blob = await reactPdf(<ScoresheetPDF sheetRows={sheetRows} players={players} metadata={{ generatedAt: new Date().toLocaleString() }} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Coaches-Scoresheet-' + new Date().toISOString().slice(0,10) + '.pdf';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    } catch (e) {
      console.error('Failed to export coaches scoresheet (react-pdf):', e);
      window.alert?.('Failed to export coaches scoresheet: ' + (e.message || String(e)));
    } finally {
      setCoachesSheetLoading(false);
    }
  }

  // categoryToCode now imported from helpers

  const maxRows = 25; // official sheet rows
  // searchInput: what's currently typed; committedSearch: last submitted search to execute
  const [searchInput, setSearchInput] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  // Track whether current generated round has been saved
  const [hasUnsavedRound, setHasUnsavedRound] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState(null); // round id slated for deletion
  const [deleting, setDeleting] = useState(false);
  const [showRoundsManager, setShowRoundsManager] = useState(false);
  const [managerSelection, setManagerSelection] = useState(new Set());
  const [folderDeleteTarget, setFolderDeleteTarget] = useState(null); // { name, count }
  const [deletingFolder, setDeletingFolder] = useState(false);
  // Track visible exclude-round ids (render order) for shift-range selection
  const excludeVisibleIdsRef = useRef([]);
  const lastExcludeClickIndexRef = useRef(null);
  // Exclude toggle logic provided by useUserRounds via handleExcludeRoundToggle

  // Show a floating Back to Top button after scrolling down a bit
  React.useEffect(() => {
    const onScroll = () => {
      try {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        setShowBackToTop(y > 300);
      } catch {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // user rounds loading now handled by useUserRounds

  function computePairs() {
    // Build exclusion set from selected rounds
    const excludeSet = new Set();
    // ensure details are present (lazy fetch)
    const needed = selectedExcludeRoundIds.filter(id => !excludeDetailCache.current.has(id));
    // Note: computePairs can be sync; we won't fetch here to avoid async. Exclusion for newly selected ids will apply on next generate after fetch.
    for (const id of selectedExcludeRoundIds) {
      const detail = excludeDetailCache.current.get(id);
      if (detail) {
        const s = buildExcludeSetFromRound(detail);
        for (const qid of s) excludeSet.add(qid);
      }
    }
    // Helper: balanced sampling across categories
  function balancedSample(all, desired) {
      if (all.length === 0 || desired <= 0) return [];
      // Determine which categories to use (respect selection but ignore ones with zero items)
      const byCat = new Map();
      for (const q of all) {
        if (!byCat.has(q.category)) byCat.set(q.category, []);
        byCat.get(q.category).push(q);
      }
      let cats = Array.from(byCat.keys());
      if (selectedCategories.length) {
        const setSel = new Set(selectedCategories);
        cats = cats.filter(c => setSel.has(c));
      }
      // Remove empty categories (shouldn't exist) and sort for stability then shuffle for distributing remainders
      cats = cats.filter(c => (byCat.get(c)?.length || 0) > 0);
      if (cats.length === 0) return [];
      const shuffledCats = [...cats].sort(() => Math.random() - 0.5);
      const base = Math.floor(desired / shuffledCats.length);
      let remainder = desired % shuffledCats.length;
      const picks = [];
      const usedIds = new Set();
      // initial allocation
      for (let i = 0; i < shuffledCats.length; i++) {
        const cat = shuffledCats[i];
        const list = [...byCat.get(cat)];
        // shuffle list
        list.sort(() => Math.random() - 0.5);
        const need = Math.min(base + (remainder > 0 ? 1 : 0), list.length);
        if (remainder > 0) remainder--;
        for (let k = 0; k < need; k++) {
          const q = list[k];
          if (!usedIds.has(q.id)) {
            picks.push(q); usedIds.add(q.id);
          }
        }
      }
      // If shortfall, fill with leftovers from any category
      if (picks.length < desired) {
        const leftovers = [];
        for (const cat of cats) {
          for (const q of byCat.get(cat)) if (!usedIds.has(q.id)) leftovers.push(q);
        }
        leftovers.sort(() => Math.random() - 0.5);
        for (const q of leftovers) {
          if (picks.length >= desired) break;
          picks.push(q); usedIds.add(q.id);
        }
      }
      return picks.slice(0, desired);
    }

    let pairs = [];
  if (questionType === 'tossup') {
      const pool = validQuestions.filter(q =>
        (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
        inRanges(q) &&
        q.question_type?.toLowerCase() === 'tossup' &&
        !excludeSet.has(q.id)
      );
      const picks = pool.length <= count ? [...pool] : balancedSample(pool, count);
      // Shuffle final picks for display randomness (Fisher-Yates)
      for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picks[i], picks[j]] = [picks[j], picks[i]];
      }
      pairs = picks.map(tossup => ({ tossup, bonus: null }));
    } else if (questionType === 'bonus') {
      const pool = validQuestions.filter(q =>
        (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
        inRanges(q) &&
        q.question_type?.toLowerCase() === 'bonus' &&
        // include visuals only if allowed in bonus-only mode
        (allowVisualInBonusOnly ? true : !isVisualBonus(q)) &&
        !excludeSet.has(q.id)
      );
      const picks = pool.length <= count ? [...pool] : balancedSample(pool, count);
      for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picks[i], picks[j]] = [picks[j], picks[i]];
      }
      pairs = picks.map(bonus => ({ tossup: null, bonus }));
    } else if (questionType === 'visual-bonus') {
      // Visual bonuses only; use flags is_visual_bonus or visual=='true'
      const pool = validQuestions.filter(q =>
        (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
        inRanges(q) &&
        q.question_type?.toLowerCase() === 'bonus' &&
        isVisualBonus(q) &&
        !excludeSet.has(q.id)
      );
      const picks = pool.length <= count ? [...pool] : balancedSample(pool, count);
      for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picks[i], picks[j]] = [picks[j], picks[i]];
      }
      pairs = picks.map(bonus => ({ tossup: null, bonus }));
    } else {
      // Both: balance based on tossups only; bonuses are paired when possible.
      const tossupPoolRaw = validQuestions.filter(q =>
        (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
        inRanges(q) &&
        q.question_type?.toLowerCase() === 'tossup' &&
        !excludeSet.has(q.id)
      );
      // Only include tossups that have an eligible paired bonus (respect visual flag)
      const tossupPool = tossupPoolRaw.filter(tu => {
        const bonus = findBonus(tu, validQuestions);
        if (!bonus) return false;
        if (excludeSet.has(bonus.id)) return false;
        if (!allowVisualInPairs && isVisualBonus(bonus)) return false;
        return true;
      });
      const tossupPicks = tossupPool.length <= count ? [...tossupPool] : balancedSample(tossupPool, count);
      for (let i = tossupPicks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tossupPicks[i], tossupPicks[j]] = [tossupPicks[j], tossupPicks[i]];
      }
      pairs = tossupPicks.map(tossup => {
        const bonus = findBonus(tossup, validQuestions);
        const finalBonus = (bonus && (allowVisualInPairs || !isVisualBonus(bonus)) && !excludeSet.has(bonus.id)) ? bonus : null;
        return { tossup, bonus: finalBonus };
      });
    }
    return pairs;
  }

  // loadHtml2Pdf imported

  // Load selected tournaments on demand
  React.useEffect(() => {
    if (!isLazy) return;
    if (selectedTournaments.length === 0) return; // wait until user selects
    lazy.ensureLoaded(selectedTournaments);
  }, [isLazy, lazy, selectedTournaments]);

  // loadedQuestions, validQuestions, categories, roundsByTournament, globalNumericRoundMax, and inRanges are provided by useFilters

  // Search results derivation
  const searchResults = useMemo(() => {
    const term = committedSearch.trim().toLowerCase();
    if (!term) return [];
    return validQuestions
      .filter(q => {
        const fields = [q.question, q.answer, q.category, q.tournament, q.round];
        return fields.some(f => f != null && String(f).toLowerCase().includes(term));
      })
      .map(q => ({
        tossup: q.question_type?.toLowerCase() === 'tossup' ? q : null,
        bonus: q.question_type?.toLowerCase() === 'bonus' ? q : null,
      }));
  }, [committedSearch, validQuestions]);

  // Decide what to display
  const displayPairs = (committedSearch.trim() && generated.length > 0) ? searchResults : generated;
  // Build official scoresheet rows AFTER displayPairs is defined to avoid TDZ errors.
  const sheetRows = useMemo(() => {
    const rows = [];
    for (let i=0;i<Math.min(displayPairs.length, maxRows);i++) {
      const pair = displayPairs[i];
      const tu = pair.tossup;
      const tuRes = tossupResults[i];
      const bonus = bonusResults[i];
      const mc = tu ? parseMCChoices(tu).length > 0 : false;
      const attempts = tuRes?.attempts || [];
      const byTeam = { A: attempts.filter(a=>players.find(p=>p.id===a.playerId)?.team==='A'), B: attempts.filter(a=>players.find(p=>p.id===a.playerId)?.team==='B') };
      rows.push({
        index: i+1,
        subject: categoryToCode(tu?.category || pair.bonus?.category),
        type: mc ? 'MC' : 'SA',
        attempts,
        byTeam,
        bonusA: (bonus && bonus.team==='A') ? bonus.points : 0,
        bonusB: (bonus && bonus.team==='B') ? bonus.points : 0,
        penaltyA: attempts.filter(a=>players.find(p=>p.id===a.playerId)?.team==='A' && (a.points||0)<0).reduce((s,a)=>s + Math.abs(a.points||0),0),
        penaltyB: attempts.filter(a=>players.find(p=>p.id===a.playerId)?.team==='B' && (a.points||0)<0).reduce((s,a)=>s + Math.abs(a.points||0),0),
        bonusAwardedTeam: bonus?.team || null
      });
    }
    while (rows.length < maxRows) rows.push({ pad:true, index: rows.length+1 });
    let runA = 0, runB = 0;
    rows.forEach(r => {
      if (r.pad) { r.cumA = runA; r.cumB = runB; return; }
      const attemptPtsA = (r.attempts||[]).filter(a=>players.find(p=>p.id===a.playerId)?.team==='A').reduce((s,a)=>s+(a.points||0),0);
      const attemptPtsB = (r.attempts||[]).filter(a=>players.find(p=>p.id===a.playerId)?.team==='B').reduce((s,a)=>s+(a.points||0),0);
      runA += attemptPtsA + (r.bonusA||0);
      runB += attemptPtsB + (r.bonusB||0);
      r.cumA = runA; r.cumB = runB;
    });
    return rows;
  }, [displayPairs, tossupResults, bonusResults, players]);


  function handleMultiSelect(list, setList, items, idx, lastIdxRef, e) {
    if (e.shiftKey && lastIdxRef.current !== null) {
      const [start, end] = [lastIdxRef.current, idx].sort((a, b) => a - b);
      const range = items.slice(start, end + 1);
      const newList = Array.from(new Set([...list, ...range]));
      setList(newList);
    } else {
      if (list.includes(items[idx])) {
        setList(list.filter(i => i !== items[idx]));
      } else {
        setList([...list, items[idx]]);
      }
      lastIdxRef.current = idx;
    }
  }

  // inRanges provided by useFilters

  async function generate(opts = {}) {
    const { force = false } = opts;
  if (committedSearch.trim()) {
      // If searching, skip random generation; UI will show search results.
      return;
    }
    // Validate at least one question type is selected
    if (!includeTossups && !includeBonuses && !includeVisualBonuses) {
      pushToast('Select at least one question type (Toss-ups, Bonuses, or Visual bonuses).', 'error');
      return;
    }
    setGenerationAttempted(true);
    // If an unsaved round exists, prompt user before overwriting unless forced
    if (!force && generated.length > 0 && hasUnsavedRound) {
      setShowUnsavedDialog(true);
      return;
    }
  // Ensure questions are loaded (lazy mode) for the selected tournaments
  try { if (isLazy && selectedTournaments.length > 0) { await lazy.ensureLoaded(selectedTournaments); } } catch {}
  console.group('RoundGenerator.generate');
    console.log('Filters:', {
      selectedTournaments,
      selectedCategories,
      roundRanges,
      count,
      questionType,
    });
    // ...existing code...
  const pairs = computePairs();
  if (typeof onNewRound === 'function') onNewRound(pairs); else setGenerated(pairs);
    if (pairs.length === 0) {
      pushToast('No questions match the criteria provided.', 'error', 5000);
    }
    setHasUnsavedRound(true);
    console.groupEnd();
  }

  async function onSaveRound() {
    if (!auth?.user) {
      window.alert?.('Please log in to save rounds.');
      return;
    }
    setSaving(true);
    try {
      let pairs = generated;
      if (!pairs || pairs.length === 0) {
        pairs = computePairs();
        setGenerated(pairs);
      }
      if (!pairs || pairs.length === 0) return;
      const now = new Date();
      const title = `Round at ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} on ${now.toLocaleDateString()}`;
      const payload = {
        title,
        questionType,
        count: pairs.length,
        tournaments: selectedTournaments,
        categories: selectedCategories,
        roundRanges,
        pairs: pairs.map(p => ({
          tossupId: p.tossup?.id || null,
          bonusId: p.bonus?.id || null,
          tossupMeta: p.tossup ? {
            tournament: p.tossup.tournament,
            round: p.tossup.round,
            question_number: p.tossup.question_number,
            category: p.tossup.category,
          } : null,
          bonusMeta: p.bonus ? {
            tournament: p.bonus.tournament,
            round: p.bonus.round,
            question_number: p.bonus.question_number,
            category: p.bonus.category,
          } : null,
        })),
      };
      const id = await saveUserRound(auth.user.uid, payload);
      // Optimistically prepend to list
  setRoundsIndex(r => [{ id, title: payload.title, createdAt: { seconds: Math.floor(Date.now()/1000) }, count: payload.count }, ...r]);
      // Removed blocking alert in favor of toast only
      pushToast('Round saved to your account.', 'success');
      setHasUnsavedRound(false);
    } catch (e) {
      console.error(e);
      window.alert?.(`Failed to save round: ${e.message || String(e)}`);
      pushToast(`Failed to save round: ${e.message || String(e)}`, 'error', 6000);
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    // Prefer search results if a search term is active
    // For lazy mode, require at least one selected tournament or already generated pairs
    if (isLazy && selectedTournaments.length === 0 && generated.length === 0 && (loadedQuestions?.length ?? 0) === 0) {
      // Non-blocking hint; UI already shows an alert card
      window.alert?.('Select at least one tournament to generate a PDF.');
      return;
    }

    setPdfLoading(true);
    try {
      // Auto-generate if none exist yet
  let pairs = [];
  if (committedSearch.trim()) {
        pairs = displayPairs; // derived later; ensures we export current search view
      } else {
        pairs = generated;
        if (!pairs || pairs.length === 0) {
          pairs = computePairs();
          setGenerated(pairs);
          // Wait for DOM to update and KaTeX to render
          await new Promise(r => requestAnimationFrame(() => r()))
            .then(() => new Promise(r => setTimeout(r, 0)));
        }
      }

      if (!pairs || pairs.length === 0) {
        // Still nothing to export
        return;
      }

      // Build a clean document in a hidden container for consistent PDF layout
      const container = pdfRef.current;
      if (!container) return;

      const html2pdf = await loadHtml2Pdf();
      const opt = {
        margin:       [12, 12, 12, 12], // 12mm margins
        filename:     `SciBowl-Round-${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        // Use CSS-controlled breaks only; avoid-all can cause big gaps/blank pages
        pagebreak:    { mode: ['css', 'legacy'] },
        jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };
      await html2pdf().from(container).set(opt).save();
    } finally {
      setPdfLoading(false);
    }
  }

  // Open/view a previously saved round (from Exclude rounds pane)
  async function openSavedRound(roundMeta) {
    try {
      if (!auth?.user || !roundMeta?.id) return;
      // Fetch full details for this round
      const detail = await getRoundDetail(auth.user.uid, roundMeta.id).catch(() => null);
      if (!detail) { pushToast('Failed to open round details.', 'error'); return; }
      // Determine tournaments used and ensure questions are loaded in lazy mode
      const tset = new Set();
      for (const p of detail.pairs || []) {
        if (p?.tossupMeta?.tournament) tset.add(p.tossupMeta.tournament);
        if (p?.bonusMeta?.tournament) tset.add(p.bonusMeta.tournament);
      }
      const tlist = Array.from(tset);
      try { if (isLazy && tlist.length) { await lazy.ensureLoaded(tlist); } } catch {}
      // Build map of available questions from currently loaded data
      const sourceQs = isLazy ? lazy.getLoadedQuestions(tlist.length ? tlist : selectedTournaments) : validQuestions;
      const byId = new Map();
      for (const q of sourceQs) byId.set(q.id, q);
      // Materialize pairs using available questions; retain ids for fallback lookup
      let pairsWithIds = (detail.pairs || []).map(p => ({
        tuId: p.tossupId || null,
        boId: p.bonusId || null,
        tossup: p.tossupId ? byId.get(p.tossupId) || null : null,
        bonus: p.bonusId ? byId.get(p.bonusId) || null : null,
      }));
      // If some questions are missing from cache due to not loaded tournaments, attempt a broader lookup from available questions
      if (pairsWithIds.some(x => ((x.tuId && !x.tossup) || (x.boId && !x.bonus)))) {
        const allQs = isLazy ? lazy.getLoadedQuestions(Array.from(new Set([...(tlist || []), ...selectedTournaments]))) : validQuestions;
        const alt = new Map();
        for (const q of allQs) alt.set(q.id, q);
        pairsWithIds = pairsWithIds.map(x => ({
          ...x,
          tossup: x.tossup || (x.tuId ? alt.get(x.tuId) || null : null),
          bonus: x.bonus || (x.boId ? alt.get(x.boId) || null : null),
        }));
      }
      // Strip helper ids and filter out entirely empty pairs
      const pairs = pairsWithIds
        .map(({ tossup, bonus }) => ({ tossup, bonus }))
        .filter(p => p.tossup || p.bonus);
      if (!pairs.length) { pushToast('Round questions are not available in the current dataset.', 'error'); return; }
      setGenerated(pairs);
      setHasUnsavedRound(false);
      setCommittedSearch('');
      // Optionally update filters to match saved round context (categories/tournaments/ranges)
      try {
        if (Array.isArray(detail.tournaments) && detail.tournaments.length) setSelectedTournaments(detail.tournaments);
        if (Array.isArray(detail.categories)) setSelectedCategories(detail.categories);
        if (detail.roundRanges) setRoundRanges(detail.roundRanges);
        if (detail.questionType) setQuestionType(detail.questionType);
      } catch {}
      resetScorekeeping();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      pushToast('Round opened.', 'success');
    } catch (e) {
      pushToast(e?.message || 'Failed to open round.', 'error');
    }
  }

  // Restore last generated round from localStorage (ids + tournaments) if nothing currently loaded
  React.useEffect(() => {
    if (generated && generated.length > 0) return;
    (async () => {
      try {
        const meta = await idbGet('sb_current_round_meta');
        if (!Array.isArray(meta) || meta.length === 0) return;
        // Determine tournaments to load
        const tset = new Set();
        for (const rec of meta) { if (rec?.tu?.tournament) tset.add(rec.tu.tournament); if (rec?.bo?.tournament) tset.add(rec.bo.tournament); }
        const tlist = Array.from(tset);
        try { if (isLazy && tlist.length) { await lazy.ensureLoaded(tlist); } } catch {}
        const sourceQs = isLazy ? lazy.getLoadedQuestions(tlist.length ? tlist : selectedTournaments) : validQuestions;
        const byId = new Map(sourceQs.map(q => [q.id, q]));
        const pairs = meta.map(rec => ({
          tossup: rec?.tu?.id ? (byId.get(rec.tu.id) || null) : null,
          bonus: rec?.bo?.id ? (byId.get(rec.bo.id) || null) : null,
        })).filter(p => p.tossup || p.bonus);
        if (pairs.length > 0) {
          setGenerated(pairs);
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLazy, lazy, validQuestions]);

  return (
    <div
  className={`grid gap-6 md:grid-cols-3 max-w-[100vw] w-full overflow-x-hidden ${scorekeeping ? 'transition-all' : ''}`}
  style={scorekeeping ? { paddingRight: 420 } : undefined}
    >
      <div className={`md:self-start ${scorekeeping ? 'hidden' : ''}`}>
  <div className="glass p-6 space-y-6 overflow-x-hidden min-w-0">
        <SearchBar
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          committedSearch={committedSearch}
          setCommittedSearch={setCommittedSearch}
          hasGenerated={generated.length > 0}
        />
        <div>
          <div className="font-semibold mb-2">Question Types</div>
          <div className="flex gap-2 flex-wrap">
            <label className={`chip cursor-pointer ${includeTossups ? 'ring-1 ring-tint bg-tint/10' : ''}`}>
              <input type="checkbox" className="mr-1" checked={includeTossups} onChange={e => setIncludeTossups(e.target.checked)} /> Toss-ups
            </label>
            <label className={`chip cursor-pointer ${includeBonuses ? 'ring-1 ring-tint bg-tint/10' : ''}`}>
              <input type="checkbox" className="mr-1" checked={includeBonuses} onChange={e => setIncludeBonuses(e.target.checked)} /> Bonuses
            </label>
            <label className={`chip cursor-pointer ${includeVisualBonuses ? 'ring-1 ring-tint bg-tint/10' : ''}`} title="Bonuses that have associated visual images">
              <input type="checkbox" className="mr-1" checked={includeVisualBonuses} onChange={e => setIncludeVisualBonuses(e.target.checked)} /> Visual bonuses
            </label>
          </div>
        </div>
  {selectedTournaments.length === 0 && (
          <div role="alert" aria-live="polite" className="flex items-start gap-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-900/20 dark:text-amber-100 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-sm">No tournaments selected.</div>
          </div>
        )}
        <TournamentSelector
          tournaments={tournaments}
          tournamentGroups={tournamentGroups}
          selectedTournaments={selectedTournaments}
          setSelectedTournaments={setSelectedTournaments}
          tournamentGroupsOpen={tournamentGroupsOpen}
          setTournamentGroupsOpen={setTournamentGroupsOpen}
          handleTournamentToggle={handleTournamentToggle}
          tournamentVisibleEntriesMainRef={tournamentVisibleEntriesMainRef}
          isDark={isDark}
          showTournamentModal={showTournamentModal}
          setShowTournamentModal={setShowTournamentModal}
        />
        {auth?.user && (
          <SavedRoundsPanel
            auth={auth}
            roundsIndex={roundsIndex}
            setRoundsIndex={setRoundsIndex}
            roundFolders={roundFolders}
            setRoundFolders={setRoundFolders}
            loadingUserRounds={loadingUserRounds}
            refresh={refresh}
            selectedExcludeRoundIds={selectedExcludeRoundIds}
            setSelectedExcludeRoundIds={setSelectedExcludeRoundIds}
            foldersOpen={foldersOpen}
            setFoldersOpen={setFoldersOpen}
            handleExcludeRoundToggle={handleExcludeRoundToggle}
            pushToast={pushToast}
            setManagerSelection={setManagerSelection}
            setShowRoundsManager={setShowRoundsManager}
            setFolderDeleteTarget={setFolderDeleteTarget}
            setDeleteTarget={setDeleteTarget}
            onViewRound={openSavedRound}
          />
        )}
        <div>
          <div className="font-semibold mb-2 flex items-center gap-2">Categories
            <button className="chip px-2 py-0.5 text-xs" onClick={() => setSelectedCategories([])}>Clear</button>
            <button className="chip px-2 py-0.5 text-xs" onClick={() => setSelectedCategories(categories)}>Select All</button>
            <button className="chip px-2 py-0.5 text-xs" onClick={() => {
              const setAll = new Set(categories);
              setSelectedCategories(prev => categories.filter(c => !prev.includes(c)));
            }}>Invert</button>
          </div>
          <div className="flex flex-wrap gap-2 min-w-0">
            {categories.map((c) => {
              const active = selectedCategories.includes(c);
              return (
                <label key={c} className={`chip cursor-pointer ${active ? 'ring-1 ring-tint bg-tint/10' : ''}`} title={c}>
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={active}
                    onChange={() => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                  />
                  <span className="truncate max-w-[12rem] inline-block align-middle">{c}</span>
                </label>
              );
            })}
          </div>
        </div>
        <RoundRanges
          selectedTournaments={selectedTournaments}
          tournaments={tournaments}
          roundRanges={roundRanges}
          setRoundRanges={setRoundRanges}
          roundsByTournament={roundsByTournament}
          globalNumericRoundMax={globalNumericRoundMax}
        />
        <div className="flex items-center gap-3">
          <label className="text-black dark:text-white">Count</label>
          <input type="number" min={1} max={50} className="w-24 rounded-lg border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white px-2 py-1" value={count}
            onChange={e => setCount(Number(e.target.value))} />
        </div>
  <div className="pt-2 flex flex-wrap justify-center gap-4 w-full">
    <button className="btn btn-fancy flex items-center gap-2 hover-lift" onClick={generate} style={{ minWidth: 140 }}>
      {/* Magic wand icon */}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 4V2m0 20v-2m7-7h-2M4 12H2m16.24-6.24l-1.42 1.42M6.34 17.66l-1.42 1.42M17.66 17.66l-1.42-1.42M6.34 6.34l-1.42-1.42M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
      Generate
    </button>
    {auth?.user ? (
      <button className="btn btn-outline-fancy flex items-center gap-2 hover-lift disabled:opacity-50 disabled:cursor-not-allowed" onClick={onSaveRound} disabled={saving || generated.length===0} style={{ minWidth: 140 }}>
        <CloudCheck className="h-5 w-5" />
        {saving ? 'Saving…' : 'Save Round'}
      </button>
    ) : (
      <button className="btn btn-outline-fancy flex items-center gap-2 hover-lift disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => window.alert?.('Log in to save rounds.')} disabled={generated.length===0} style={{ minWidth: 140 }}>
        <CloudCheck className="h-5 w-5" />
        Save Round
      </button>
    )}
          <button
            className="btn btn-ghost btn-sm hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={pdfLoading}
            onClick={exportPdf}
            title="Generate and export as PDF"
          >
            {pdfLoading ? (
              <span className="inline-flex items-center">
                <span className="h-4 w-4 mr-2 inline-block animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                Generating...
              </span>
            ) : (
              <span className="inline-flex items-center">
                <FileDown className="h-4 w-4 mr-1" /> Generate PDF
              </span>
            )}
          </button>
          {/* Scorekeeping toggle button */}
          <button
            className={`btn flex items-center gap-2 hover-lift disabled:opacity-50 disabled:cursor-not-allowed ${scorekeeping ? 'btn-orange' : 'btn-fancy'}`}
            onClick={() => {
              if (!scorekeeping) { resetScorekeeping(); }
              setScorekeeping(s => !s);
            }}
            style={{ minWidth: 140 }}
            title={scorekeeping ? 'Close Scorekeeper' : 'Open Scorekeeper'}
            disabled={generated.length===0}
          >
            <Play className="h-5 w-5" /> {scorekeeping ? 'Close' : 'Scorekeeper'}
          </button>
  </div>
  {/* Session history paginator */}
  {Array.isArray(history) && history.length > 0 && (
    <div className="mt-3 flex items-center justify-center gap-3 text-sm">
      <button
        className="chip px-2 py-1 disabled:opacity-50"
        onClick={() => loadHistoryAt((histPos ?? (history.length - 1)) - 1)}
        disabled={(histPos ?? (history.length - 1)) <= 0}
        aria-label="Previous generated round"
      >
        ◀ Prev
      </button>
      <div className="opacity-80">
        Round {((histPos ?? (history.length - 1)) + 1)} of {history.length} (this session)
      </div>
      <button
        className="chip px-2 py-1 disabled:opacity-50"
        onClick={() => loadHistoryAt((histPos ?? (history.length - 1)) + 1)}
        disabled={(histPos ?? (history.length - 1)) >= history.length - 1}
        aria-label="Next generated round"
      >
        Next ▶
      </button>
    </div>
  )}
  </div>
  </div>

  <div className={`${scorekeeping ? 'md:col-span-3' : 'md:col-span-2'} space-y-4 min-w-0 overflow-x-hidden`}>
        {(() => {
          // Derive display pairs: search results OR generated pairs
          return null;})()}
        {/** Compute search results *before* rendering main list **/}
        {displayPairs.length === 0 && (
          <div className="glass p-6" role="status" aria-live="polite">
            {committedSearch.trim()
              ? 'No matches found.'
              : generationAttempted
                ? 'No questions match the criteria provided.'
                : 'No questions generated yet.'}
          </div>
        )}
        {displayPairs.map((pair, i) => {
          const pairActive = !scorekeeping || i === currentIndex;
          const showBonusContent = pairActive && (!scorekeeping || !pair.tossup || (tossupResults[i]?.result === 'correct') || i < currentIndex);
          return (
            <QuestionPairCard
              key={`${pair.tossup?.id ?? 'tu'}-${pair.bonus?.id ?? 'bo'}-${i}`}
              pair={pair}
              index={i}
              scorekeeping={scorekeeping}
              currentIndex={currentIndex}
              tossupResults={tossupResults}
              showBonusContent={showBonusContent}
              questionRef={el => { questionRefs.current[i] = el; }}
            />
          );
        })}
      </div>

      {/* Scorekeeping side pane */}
      {scorekeeping && (
        <ScorekeeperPane
          headerOffset={headerOffset}
          close={() => setScorekeeping(false)}
          currentIndex={currentIndex}
          displayPairs={displayPairs}
          awaitingPlayer={awaitingPlayer}
          interruptArmed={interruptArmed}
          setAwaitingPlayer={setAwaitingPlayer}
            setInterruptArmed={setInterruptArmed}
            // Typed-answer props
            typedAnswerActive={typedAnswerActive}
            setTypedAnswerActive={setTypedAnswerActive}
            typedAnswerText={typedAnswerText}
            setTypedAnswerText={setTypedAnswerText}
            typedAnswerPlayerId={typedAnswerPlayerId}
            typedAnswerLoading={typedAnswerLoading}
            typedAnswerReason={typedAnswerReason}
            checkTypedAnswer={checkTypedAnswerWithLLM}
          isTossupFinal={isTossupFinal}
          recordNoAnswer={recordNoAnswer}
          throwOutAndReplace={throwOutAndReplace}
          tossupResults={tossupResults}
          bonusResults={bonusResults}
          saveFixedBonus={saveFixedBonus}
          players={players}
          handleSeatClick={handleSeatClick}
          allowedTeams={allowedTeams}
          totalPoints={totalPoints}
          teamPoints={teamPoints}
          saveBonusPoints={saveBonusPoints}
          subMode={subMode}
          setSubMode={() => { setShowSubModal(true); }}
          resetScorekeeping={resetScorekeeping}
          exportCoachesScoresheetPdf={exportCoachesScoresheetPdf}
          coachesSheetLoading={coachesSheetLoading}
          tryoutsMode={tryoutsMode}
          setTryoutsMode={setTryoutsMode}
          questionType={questionType}
        />
      )}

      <RoundPdfContent displayPairs={displayPairs} QUESTIONS_PER_PAGE={QUESTIONS_PER_PAGE} pdfRef={pdfRef} />
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-tint text-white shadow-lg px-4 py-2 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tint"
        >
          <ArrowUp className="h-4 w-4" />
          <span className="hidden sm:inline">Top</span>
        </button>
      )}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUnsavedDialog(false)} />
          <div className="relative bg-white dark:bg-darkcard rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4 border border-black/10 dark:border-white/10">
            <h2 className="text-lg font-semibold">Unsaved round</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">You already have a generated round that hasn't been saved. What would you like to do?</p>
            <div className="flex flex-col gap-2">
              <button
                disabled={saving}
                onClick={async () => {
                  await onSaveRound();
                  setShowUnsavedDialog(false);
                  // After successful save, immediately generate a fresh round bypassing dialog
                  generate({ force: true });
                }}
                className="btn btn-primary w-full justify-center disabled:opacity-60"
              >{saving ? 'Saving…' : 'Save & Generate New'}</button>
              <button
                onClick={() => {
                  setShowUnsavedDialog(false);
                  console.log('Discarding unsaved round and generating new');
                  generate({ force: true });
                }}
                className="btn btn-orange w-full justify-center"
              >Generate Without Saving</button>
              <button
                onClick={() => setShowUnsavedDialog(false)}
                className="btn btn-ghost w-full justify-center"
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-darkcard rounded-lg shadow-xl max-w-sm w-full p-6 space-y-5 border border-black/10 dark:border-white/10">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600 dark:text-red-300">Delete Round</h2>
            <div className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              Are you sure you want to delete
              <span className="font-medium text-black dark:text-white"> {deleteTarget.title || 'this round'}</span>? This action cannot be undone.
            </div>
            <div className="flex flex-col gap-2">
              <button
                disabled={deleting}
                onClick={async () => {
                  if (!auth?.user || !deleteTarget) return;
                  setDeleting(true);
                  try {
                    await deleteUserRound(auth.user.uid, deleteTarget.id);
                    setRoundsIndex(list => list.filter(x => x.id !== deleteTarget.id));
                    setSelectedExcludeRoundIds(ids => ids.filter(x => x !== deleteTarget.id));
                    excludeDetailCache.current.delete(deleteTarget.id);
                    setDeleteTarget(null);
                    pushToast('Round deleted.', 'error'); // red per request
                  } catch (err) {
                    console.error(err);
                    pushToast(err?.message || 'Failed to delete round.', 'error', 6000);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="btn btn-orange w-full justify-center disabled:opacity-60"
              >{deleting ? 'Deleting…' : 'Delete Permanently'}</button>
              <button
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="btn btn-ghost w-full justify-center"
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
      {folderDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deletingFolder && setFolderDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-darkcard rounded-lg shadow-xl max-w-sm w-full p-6 space-y-5 border border-black/10 dark:border-white/10">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600 dark:text-red-300">Delete Folder</h2>
            <div className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              Delete folder <span className="font-semibold text-black dark:text-white">{folderDeleteTarget.name}</span> and its {folderDeleteTarget.count} round(s)? This cannot be undone.
            </div>
            <div className="flex flex-col gap-2">
              <button
                disabled={deletingFolder}
                onClick={async () => {
                  if (!auth?.user) return;
                  setDeletingFolder(true);
                  try {
                    await deleteFolderAndRounds(folderDeleteTarget.name, folderDeleteTarget.roundIds);
                    // Also remove the folder from local UI state explicitly
                    setRoundFolders(f => f.filter(n => n !== folderDeleteTarget.name));
                    setManagerSelection(new Set());
                    setFolderDeleteTarget(null);
                  } finally {
                    setDeletingFolder(false);
                  }
                }}
                className="btn btn-orange w-full justify-center disabled:opacity-60"
              >{deletingFolder ? 'Deleting…' : 'Delete Permanently'}</button>
              <button
                disabled={deletingFolder}
                onClick={() => setFolderDeleteTarget(null)}
                className="btn btn-ghost w-full justify-center"
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Tournament modal handled by TournamentSelector */}
      {/* Substitution Modal */}
      <SubstitutionModal
        open={showSubModal}
        onClose={() => { setShowSubModal(false); setSubMode(false); }}
        players={players}
        onSubmit={({ team, playerId, newName }) => {
          setPlayers(list => {
            const alreadyHasSub = list.filter(p => p.team === team).length >= 5;
            if (alreadyHasSub) return list; // guard
            const updated = list.map(p => p.id === playerId ? { ...p, status: 'replaced' } : p);
            const seatNumbers = updated.filter(p => p.team === team).map(p => p.seat).filter(Boolean);
            const newSeat = Math.max(0, ...seatNumbers, 4) + (seatNumbers.includes(5) ? 0 : 1); // prefer 5
            const newPlayer = {
              id: nextPlayerIdRef.current++,
              team,
              seat: newSeat > 5 ? newSeat : 5, // force 5 as first sub
              name: newName,
              status: 'active',
              stats: { correct: 0, incorrect: 0, correctInterrupt: 0, incorrectInterrupt: 0 }
            };
            return [...updated, newPlayer];
          });
          pushToast(`Substitution: ${newName} entered for Team ${team}.`, 'success');
        }}
      />
      {showRoundsManager && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRoundsManager(false)} />
          <div className="relative bg-white dark:bg-darkcard rounded-lg shadow-xl max-w-3xl w-full p-6 space-y-4 border border-black/10 dark:border-white/10 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Manage Saved Rounds</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRoundsManager(false)}>Close</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="chip px-3 py-1"
                onClick={() => setManagerSelection(new Set(roundsIndex.map(r => r.id)))}
              >Select All</button>
              <button
                className="chip px-3 py-1"
                onClick={() => setManagerSelection(new Set())}
              >Clear</button>
              <button
                className="chip px-3 py-1"
                onClick={() => setManagerSelection(sel => new Set(roundsIndex.filter(r => !sel.has(r.id)).map(r=>r.id)))}
              >Invert</button>
              <button
                className="chip px-3 py-1"
                onClick={() => { setSelectedExcludeRoundIds(Array.from(managerSelection)); pushToast('Excluded rounds updated.', 'success'); }}
              >Apply Exclusions</button>
              <button
                className="chip px-3 py-1 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900/30"
                onClick={async () => {
                  if (!auth?.user) return;
                  if (managerSelection.size === 0) { pushToast('No rounds selected.', 'error'); return; }
                  if (!window.confirm(`Delete ${managerSelection.size} selected round(s)? This cannot be undone.`)) return;
                  const ids = Array.from(managerSelection);
                  let ok = 0;
                  for (const id of ids) {
                    try { await deleteUserRound(auth.user.uid, id); ok++; } catch {}
                  }
                  setRoundsIndex(list => list.filter(r => !managerSelection.has(r.id)));
                  setSelectedExcludeRoundIds(idsSel => idsSel.filter(id => !managerSelection.has(id)));
                  setManagerSelection(new Set());
                  pushToast(`Deleted ${ok} round(s).`, 'error');
                }}
              >Delete Selected</button>
            </div>
            <div className="flex-1 overflow-auto rounded border border-black/10 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/5 dark:bg-white/10 backdrop-blur">
                  <tr>
                    <th className="text-left px-3 py-2 w-10">Sel</th>
                    <th className="text-left px-3 py-2">Title</th>
                    <th className="text-left px-3 py-2">Folder</th>
                    <th className="text-left px-3 py-2">Count</th>
                    <th className="text-left px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {roundsIndex.map(r => {
                    const ts = r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000) : null;
                    return (
                      <tr key={r.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5 hover:bg-tint/10">
                        <td className="px-3 py-1.5"><input type="checkbox" checked={managerSelection.has(r.id)} onChange={()=>setManagerSelection(sel => { const n = new Set(sel); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                        <td className="px-3 py-1.5 truncate max-w-[280px]" title={r.title}>{r.title || 'Untitled'}</td>
                        <td className="px-3 py-1.5">{r.folder || ''}</td>
                        <td className="px-3 py-1.5">{r.count ?? ''}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{ts ? ts.toLocaleDateString() : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-3 w-[min(92vw,360px)] pointer-events-none">
        {toasts.map(t => {
          const pct = 0; // visual handled purely by CSS animation bar
          return (
            <div
              key={t.id}
              className={
                'group pointer-events-auto relative overflow-hidden rounded-md px-4 py-3 pr-10 text-sm shadow-lg flex items-start gap-3 animate-toast-enter ' +
                (t.type === 'success' ? 'bg-emerald-600 text-white' :
                 t.type === 'error' ? 'bg-red-600 text-white' :
                 'bg-neutral-800 text-white')
              }
              role="status"
              aria-live="polite"
            >
              <div className="flex-1 break-words leading-relaxed">{t.message}</div>
              <button
                className="absolute top-1.5 right-1.5 rounded p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Dismiss notification"
                onClick={() => setToasts(all => all.filter(x => x.id !== t.id))}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
              </button>
              <span
                className="absolute bottom-0 left-0 h-0.5 bg-white/70 group-hover:bg-white"
                style={{
                  width: '100%',
                  transformOrigin: 'left',
                  animation: `toast-bar-${t.id} ${t.ttl}ms linear forwards`
                }}
              />
              <style>{`@keyframes toast-disappear { to { opacity:0; transform: translateY(-4px); } }
                @keyframes toast-enter { from { opacity:0; transform: translateY(-4px) scale(.98); } to { opacity:1; transform: translateY(0) scale(1); } }
                .animate-toast-enter { animation: toast-enter 160ms cubic-bezier(.4,0,.2,1); }
              `}</style>
              <style>{`@keyframes toast-bar-${t.id} { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
            </div>
          );
        })}
      </div>
    </div>
  );
}
