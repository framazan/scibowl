import React, { useEffect, useMemo, useRef, useState } from 'react';
import LatexRenderer from './LatexRenderer.jsx';
import { Check, Eye, EyeOff, SkipForward, AlertTriangle, ChevronLeft, Pin, PinOff } from 'lucide-react';
import { useFilters } from './roundGenerator/hooks/useFilters.js';
import TournamentSelector from './roundGenerator/components/TournamentSelector.jsx';
import RoundRanges from './roundGenerator/components/RoundRanges.jsx';
import CategoriesSelector from './roundGenerator/components/CategoriesSelector.jsx';
import { parseMCChoices as parseMCChoicesRG, findBonus as findBonusRG } from './roundGenerator/utils/helpers.js';
import { isVisualBonus, getVisualBonusUrl } from '../data/visualBonuses.js';
import { checkAnswerMC as apiCheckMC, checkAnswerBonus as apiCheckBonus } from '../api/client.js';
import useThemePreference from '../hooks/useThemePreference.js';

function DoubleHelix() {
  return (
    <div className="flex items-center justify-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="animate-spin">
        <path
          d="M20 5 Q25 10 20 15 Q15 20 20 25 Q25 30 20 35"
          stroke="#3b82f6"
          strokeWidth="2"
          fill="none"
          className="animate-pulse"
        />
        <path
          d="M20 5 Q15 10 20 15 Q25 20 20 25 Q15 30 20 35"
          stroke="#3b82f6"
          strokeWidth="2"
          fill="none"
          className="animate-pulse"
          style={{ animationDelay: '0.5s' }}
        />
      </svg>
    </div>
  );
}

function pickRandom(arr, predicate = () => true) {
  const pool = arr.filter(predicate);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

export default function PracticeMode({ questions = [], tournamentName = null, lazy = null }) {
  // Merge tournaments and category selection like RoundGenerator via useFilters
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
    handleTournamentToggle,
    loadedQuestions,
    validQuestions,
    categories,
    inRanges, // not used here yet, but available
    roundRanges,
    setRoundRanges,
    roundsByTournament,
    globalNumericRoundMax,
  } = useFilters({ questions, lazy });

  // Track dark mode via shared preference hook (reactive to header toggle)
  const { dark } = useThemePreference();
  const isDark = !!dark;

  // Left pane collapsible and resizable state
  const [leftPaneCollapsed, setLeftPaneCollapsed] = useState(false);
  const [leftPaneHovered, setLeftPaneHovered] = useState(false);
  const [leftPanePinned, setLeftPanePinned] = useState(true); // true = expanded and pinned
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => {
    try {
      const v = localStorage.getItem('sb_leftPaneWidth_practice');
      const n = Number(v);
      return Number.isFinite(n) && n >= 220 && n <= 720 ? n : 320;
    } catch { return 320; }
  });
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(320);
  useEffect(() => {
    function onMove(e) {
      if (!resizingRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = clientX - startXRef.current;
      let next = Math.round(startWRef.current + dx);
      next = Math.max(220, Math.min(720, next));
      setLeftPaneWidth(next);
    }
    function onUp() {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      try { localStorage.setItem('sb_leftPaneWidth_practice', String(leftPaneWidth)); } catch {}
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [leftPaneWidth]);

  // Previous questions state
  const [previousQuestions, setPreviousQuestions] = useState([]);

  // Checkboxes for question types
  const [includeTossups, setIncludeTossups] = useState(true);
  const [includeBonuses, setIncludeBonuses] = useState(true);
  const [includeVisualBonuses, setIncludeVisualBonuses] = useState(false);
  // When visual bonuses are included, this switch restricts bonuses to only visual ones
  const [onlyVisualBonuses, setOnlyVisualBonuses] = useState(false);

  // If visual bonuses are turned off, reset the visual-only switch
  useEffect(() => {
    if (!includeVisualBonuses) setOnlyVisualBonuses(false);
  }, [includeVisualBonuses]);

  // Reading speed (words per second) for streaming read; default to 5 wps
  const [readingSpeed, setReadingSpeed] = useState(5);

  // Derive pool based on selections
  const practicePool = useMemo(() => {
    const catSet = new Set(selectedCategories);
    return validQuestions.filter(q => {
      if (selectedCategories.length && !catSet.has(q.category)) return false;
      if (!inRanges(q)) return false;
      const type = q.question_type?.toLowerCase();
      const visual = isVisualBonus(q);
      if (type === 'tossup') return includeTossups;
      if (type === 'bonus') {
        if (!includeBonuses && !includeVisualBonuses) return false;
        // If user explicitly toggles visual-only, restrict bonuses to visuals
        if (includeVisualBonuses && onlyVisualBonuses) return visual;
        if (!includeBonuses && includeVisualBonuses) return visual; // only visual
        if (includeBonuses && !includeVisualBonuses) return !visual; // only non-visual
        return true; // both selected
      }
      return false;
    });
  }, [validQuestions, selectedCategories, inRanges, includeTossups, includeBonuses, includeVisualBonuses, onlyVisualBonuses]);

  const [current, setCurrent] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  // For MC tossup interrupts: optional typed answer
  const [mcTypedAnswer, setMcTypedAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [bonusState, setBonusState] = useState(null); // {bonus, userAnswer, result, showAnswer}
  const [checking, setChecking] = useState(false);

  // Determine preferred type for new questions based on current toggles and availability
  const preferredType = useMemo(() => {
    const hasTossups = practicePool.some(q => q.question_type?.toLowerCase() === 'tossup');
    const hasBonuses = practicePool.some(q => q.question_type?.toLowerCase() === 'bonus');
    if (includeTossups && hasTossups) return 'tossup';
    if (hasBonuses) return 'bonus';
    return null;
  }, [practicePool, includeTossups]);

  // Do not auto-select a question on load; wait for user to start.

  const mcChoices = useMemo(() => parseMCChoicesRG(current), [current]);

  function nextQuestion() {
    const pred = preferredType ? (q => q.question_type?.toLowerCase() === preferredType) : (() => true);
    setCurrent(pickRandom(practicePool, pred));
    setUserAnswer('');
    setMcTypedAnswer('');
    setResult(null);
    setShowAnswer(false);
    setBonusState(null);
  }

  function localCheckMultipleChoice(selectedKey, q) {
    if (!q) return { correct: false };
    const ans = String(q.answer ?? '').trim().toLowerCase();
    // Accept various encodings like 'w', 'W', '(W)'. Also support text answer equals choice text.
    const key = String(selectedKey ?? '').trim().toLowerCase();
    const normalizedAnsKey = ans.replace(/[()\s.]/g, '').charAt(0);
    const choices = parseMCChoicesRG(q);
    const byKey = new Map(choices);
    const selectedText = byKey.get(key);
    // If answer looks like a key (w/x/y/z/a/b/c/d), compare keys
    const keyMap = { a: 'w', b: 'x', c: 'y', d: 'z' };
    const ansKey = keyMap[normalizedAnsKey] || normalizedAnsKey;
    if (['w','x','y','z'].includes(ansKey)) {
      const ok = ansKey === key;
      return { correct: ok, reason: ok ? undefined : `Correct: ${ansKey.toUpperCase()}` };
    }
    // Else compare selected text to answer text - require exact match
    const selNorm = String(selectedText ?? '').toLowerCase().replace(/\s+/g,' ').trim();
    const ansNorm = ans.toLowerCase().replace(/\s+/g,' ').trim();
    const ok = !!selNorm && selNorm === ansNorm;
    return { correct: ok };
  }

  async function check() {
    setChecking(true);
    try {
      let data;
      const isTossup = current?.question_type?.toLowerCase() === 'tossup';
      const typed = String(mcTypedAnswer || '').trim();
      if (mcChoices.length > 0 && !(isTossup && typed.length > 0)) {
        // Default MC path (radio W/X/Y/Z) unless in typed mode for tossup
        data = localCheckMultipleChoice(userAnswer, current);
      } else {
        // Use specialized MC endpoint when typed answer for MC tossup; otherwise use short-answer endpoint
        const useMcEndpoint = (mcChoices.length > 0 && isTossup && typed.length > 0);
        const body = {
          userAnswer: (mcChoices.length > 0 && isTossup && typed.length > 0) ? mcTypedAnswer : userAnswer,
          correctAnswer: current.answer,
          question: current.question,
        };
        if (useMcEndpoint) {
          body.choices = mcChoices; // provide choices context for LLM
        }
        const res = useMcEndpoint ? await apiCheckMC(body) : await apiCheckBonus(body);
        data = await res.json();
      }
      setResult(data);
      // If correct on a toss-up, show bonus if available
      if (data.correct && isTossup) {
        const bonus = findBonusRG(current, practicePool);
        if (bonus) {
          setBonusState({
            bonus,
            userAnswer: '',
            result: null,
            showAnswer: false,
          });
        }
      }
    } catch (e) {
      setResult({ correct: false, reason: 'Check failed' });
    } finally {
      setChecking(false);
    }
  }

  // Bonus answer check
  async function checkBonus() {
    if (!bonusState) return;
    setChecking(true);
    try {
      const bonusChoices = parseMCChoicesRG(bonusState.bonus);
      let data;
      if (bonusChoices.length > 0) {
        data = localCheckMultipleChoice(bonusState.userAnswer, bonusState.bonus);
      } else {
        const res = await apiCheckBonus({
          userAnswer: bonusState.userAnswer,
          correctAnswer: bonusState.bonus.answer,
          question: bonusState.bonus.question,
        });
        data = await res.json();
      }
      setBonusState(bs => ({ ...bs, result: data }));
    } catch (e) {
      setBonusState(bs => ({ ...bs, result: { correct: false, reason: 'Check failed' } }));
    } finally {
      setChecking(false);
    }
  }

  // UI scaffold similar to RoundGenerator's left panel
  return (
    <div className="relative">
      <div
        className={`relative z-10 grid gap-6 w-full md:grid-cols-[var(--left-pane-w)_minmax(0,1fr)]`}
        style={{
          // On small screens we let CSS stack naturally (grid becomes 1col). On md+, use the variable.
          ['--left-pane-w']: (leftPaneCollapsed && !leftPaneHovered) ? '25px' : `${leftPaneWidth}px`
        }}
      >
      <div className="md:self-start relative">
        {/* Invisible hover area for collapsed pane */}
        {leftPaneCollapsed && (
          <div
            className="absolute inset-0 z-5"
            onMouseEnter={() => setLeftPaneHovered(true)}
            onMouseLeave={() => setLeftPaneHovered(false)}
          />
        )}
        <button
          className="absolute top-2 -right-2 bg-white dark:bg-darkcard border border-black/10 dark:border-white/20 rounded-full p-1 shadow hover:bg-gray-50 dark:hover:bg-white/10 transition z-10"
          onClick={() => {
            if (leftPaneCollapsed || !leftPanePinned) {
              setLeftPaneCollapsed(false);
              setLeftPanePinned(true);
            } else {
              setLeftPanePinned(false);
              setLeftPaneCollapsed(true);
            }
          }}
          onMouseEnter={() => setLeftPaneHovered(true)}
          onMouseLeave={() => setLeftPaneHovered(false)}
          title={leftPaneCollapsed ? 'Expand panel' : leftPanePinned ? 'Unpin panel' : 'Pin panel'}
        >
          {leftPaneCollapsed ? (
            leftPaneHovered ? <Pin className="h-4 w-4" /> : <ChevronLeft className={`h-4 w-4 transition-transform rotate-180`} />
          ) : leftPanePinned ? (
            <PinOff className="h-4 w-4" />
          ) : (
            <Pin className="h-4 w-4" />
          )}
        </button>
        <div
          className={`glass p-6 space-y-6 bg-white/80 dark:bg-darkcard/70 backdrop-blur transition-all duration-300 ${leftPaneCollapsed && !leftPaneHovered ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}
          onMouseEnter={() => setLeftPaneHovered(true)}
          onMouseLeave={() => setLeftPaneHovered(false)}
        >
          {selectedTournaments.length === 0 && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-900/20 dark:text-amber-100 px-3 py-2"
            >
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
            showTournamentModal={false}
            setShowTournamentModal={() => {}}
          />
          <CategoriesSelector
            categories={categories}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
          />
          <RoundRanges
            selectedTournaments={selectedTournaments}
            tournaments={tournaments}
            roundRanges={roundRanges}
            setRoundRanges={setRoundRanges}
            roundsByTournament={roundsByTournament}
            globalNumericRoundMax={globalNumericRoundMax}
          />
          <div>
            <div className="font-semibold mb-2">Question Types</div>
            <div className="flex flex-wrap gap-2">
              <label className="chip cursor-pointer">
                <input type="checkbox" className="mr-1" checked={includeTossups} onChange={() => setIncludeTossups(v => !v)} /> Toss-ups
              </label>
              <label className={`chip cursor-pointer ${!includeTossups && !includeBonuses ? 'ring-1 ring-tint bg-tint/10' : ''}`}>
                <input type="checkbox" className="mr-1" checked={includeBonuses} onChange={() => setIncludeBonuses(v => !v)} /> Bonuses
              </label>
              <label className={`chip items-center gap-2 cursor-pointer ${includeBonuses ? '' : 'opacity-50 pointer-events-none'}`}
                title={includeBonuses ? 'Include image-based bonuses' : 'Enable Bonuses to toggle'}
                style={{ alignItems: 'center', minWidth: 220, justifyContent: 'flex-start', flexWrap: 'nowrap', display: 'inline-flex' }}>
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={includeVisualBonuses}
                  onChange={() => setIncludeVisualBonuses(v => !v)}
                  disabled={!includeBonuses}
                />
                <span>Visual bonuses</span>
                {/* Switch to restrict to only visual bonuses when visual is enabled */}
                <span
                  className={`${includeVisualBonuses ? '' : 'opacity-50'} ml-1 flex items-center gap-1`}
                  onClick={e => e.stopPropagation()}
                  title={includeVisualBonuses ? 'Only get visual bonuses' : 'Enable Visual bonuses first'}
                  style={{ alignItems: 'center' }}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onlyVisualBonuses}
                    aria-label="Only visual bonuses"
                    disabled={!includeVisualBonuses}
                    onClick={() => setOnlyVisualBonuses(v => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tint/60 ${onlyVisualBonuses ? 'bg-tint' : 'bg-black/30 dark:bg-white/30'} ${includeVisualBonuses ? '' : 'cursor-not-allowed'}`}
                    style={{ verticalAlign: 'middle' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${onlyVisualBonuses ? 'translate-x-4' : 'translate-x-1'}`}
                    />
                  </button>
                  <span className="text-[10px] leading-none text-black/60 dark:text-white/60 select-none ml-1" style={{ fontWeight: 500 }}>
                    only
                  </span>
                </span>
              </label>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Reading speed</div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={readingSpeed}
                onChange={(e) => setReadingSpeed(Number(e.target.value))}
                aria-label="Reading speed in words per second"
                className="w-48"
              />
              <div className="text-sm tabular-nums">{readingSpeed} w/s</div>
            </div>
            <div className="text-xs text-black/60 dark:text-white/60 mt-1">Space to buzz. Enter to check. “n” next, “a” show answer.</div>
          </div>
        </div>
        {/* Drag handle (shown when pane visible on md+) */}
        {!leftPaneCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize"
            onMouseDown={(e) => {
              if (leftPaneCollapsed) return;
              resizingRef.current = true;
              startXRef.current = e.clientX;
              startWRef.current = leftPaneWidth;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            onTouchStart={(e) => {
              if (leftPaneCollapsed) return;
              const t = e.touches?.[0];
              if (!t) return;
              resizingRef.current = true;
              startXRef.current = t.clientX;
              startWRef.current = leftPaneWidth;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            className={`hidden md:block absolute top-0 -right-5 h-full w-2 cursor-col-resize z-30 transition-colors`}
          >
            <div className="absolute inset-y-0 left-[-1px] right-[-1px] w-[1px] bg-gray-400 dark:bg-gray-500" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        {!current ? (
          <div className="glass p-6 bg-white/80 dark:bg-darkcard/70 backdrop-blur">
            {practicePool.length ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>Ready to begin.</div>
                <button className="btn btn-primary" onClick={() => {
                  const pred = preferredType ? (q => q.question_type?.toLowerCase() === preferredType) : (() => true);
                  const next = pickRandom(practicePool, pred);
                  if (next) {
                    setCurrent(next);
                    setUserAnswer('');
                    setMcTypedAnswer('');
                    setResult(null);
                    setShowAnswer(false);
                    setBonusState(null);
                  }
                }}>Start</button>
              </div>
            ) : 'No questions available. Select tournaments.'}
          </div>
        ) : (
          <PracticeQuestionCard
            current={current}
            setCurrent={(q) => {
              if (current) {
                setPreviousQuestions(prev => [...prev, current]);
              }
              setCurrent(q);
              setUserAnswer('');
              setMcTypedAnswer('');
              setResult(null);
              setShowAnswer(false);
              setBonusState(null);
            }}
            pool={practicePool}
            preferredType={preferredType}
            userAnswer={userAnswer}
            setUserAnswer={setUserAnswer}
            mcTypedAnswer={mcTypedAnswer}
            setMcTypedAnswer={setMcTypedAnswer}
            result={result}
            setResult={setResult}
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
            bonusState={bonusState}
            setBonusState={setBonusState}
            check={check}
            checkBonus={checkBonus}
            readingSpeed={readingSpeed}
            checking={checking}
          />
        )}
        {previousQuestions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-black/60 dark:text-white/60">Previous Questions</div>
            {previousQuestions.map((q, idx) => (
              <div key={q.id || idx} className="glass p-4 bg-white/80 dark:bg-darkcard/70 backdrop-blur flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold">{String(q.tournament).toUpperCase()}</span>
                  {' • Round '}{q.round}
                  {' • '}{q.category}
                  {q.question_number && <> • Q{q.question_number}</>}
                  {' • '}{q.question_type?.toLowerCase() === 'bonus' ? 'Bonus' : 'Toss-up'}
                </div>
                <div className="text-sm text-black/60 dark:text-white/60 truncate max-w-[200px]">
                  <LatexRenderer>{q.answer}</LatexRenderer>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function PracticeQuestionCard({ current, setCurrent, pool, preferredType, userAnswer, setUserAnswer, mcTypedAnswer, setMcTypedAnswer, result, setResult, showAnswer, setShowAnswer, bonusState, setBonusState, check, checkBonus, readingSpeed, checking }) {
  const mcChoices = useMemo(() => parseMCChoicesRG(current), [current]);
  const [currentVisualUrl, setCurrentVisualUrl] = React.useState(null);
  const [showCurrentVisualFull, setShowCurrentVisualFull] = React.useState(false);
  const [bonusVisualUrl, setBonusVisualUrl] = React.useState(null);
  const [showBonusVisualFull, setShowBonusVisualFull] = React.useState(false);

  // Streaming read state
  const [buzzed, setBuzzed] = useState(false);
  const [displayedWordCount, setDisplayedWordCount] = useState(0);
  const [streamingActive, setStreamingActive] = useState(true);
  const inputRef = useRef(null);
  const mcTypedInputRef = useRef(null);

  // Multiple-choice answer streaming (after the question finishes)
  const [choiceStreamCount, setChoiceStreamCount] = useState(0); // how many choices text are revealed (0..4)
  // After checking an answer, reveal remaining choices even if user buzzed early
  const [revealChoicesAfterCheck, setRevealChoicesAfterCheck] = useState(false);

  const plainQuestionText = useMemo(() => String(current?.question ?? ''), [current?.id]);
  const words = useMemo(() => plainQuestionText.split(/\s+/).filter(Boolean), [plainQuestionText]);
  const streamFinished = displayedWordCount >= words.length;
  const isBonusCurrent = String(current?.question_type || '').toLowerCase() === 'bonus';
  const canAnswer = isBonusCurrent || buzzed || streamFinished;

  // Advance streaming based on readingSpeed (words/sec)
  useEffect(() => {
    if (!current) return;
    if (!streamingActive) return;
    if (buzzed) return;
    if (words.length === 0) return;
    const intervalMs = Math.max(50, Math.round(1000 / Math.max(1, readingSpeed)));
    const id = setInterval(() => {
      setDisplayedWordCount((c) => {
        if (c >= words.length) return words.length;
        return c + 1;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [current?.id, streamingActive, buzzed, words.length, readingSpeed]);

  // Reset streaming when question changes
  useEffect(() => {
    setBuzzed(false);
    setDisplayedWordCount(0);
    setStreamingActive(true);
    setChoiceStreamCount(0);
    setRevealChoicesAfterCheck(false);
  }, [current?.id]);

  // Start streaming MC choices after stem is fully read
  useEffect(() => {
    if (!current) return;
    if (mcChoices.length === 0) return; // short answer question
    if (!streamFinished) return; // only begin after stem finishes
    if (buzzed) return; // do not stream choices after buzzing
    if (choiceStreamCount >= 4) return;
    // stream one choice at a time
    const choiceIntervalMs = Math.max(250, 1000 - Math.min(20, readingSpeed) * 25);
    const id = setInterval(() => {
      setChoiceStreamCount((n) => Math.min(4, n + 1));
    }, choiceIntervalMs);
    return () => clearInterval(id);
  }, [current?.id, streamFinished, mcChoices.length, choiceStreamCount, readingSpeed, buzzed]);

  // After checking an answer (via Enter or button), reveal/stream remaining choices regardless of buzz
  useEffect(() => {
    if (!current) return;
    if (mcChoices.length === 0) return;
    if (!result) return; // only after a check has happened
    if (choiceStreamCount >= 4) return;
    // Start reveal if not already
    if (!revealChoicesAfterCheck) setRevealChoicesAfterCheck(true);
    // Faster stream for post-check reveal
    const fastIntervalMs = 150;
    const id = setInterval(() => {
      setChoiceStreamCount((n) => {
        if (n >= 4) return 4;
        return n + 1;
      });
    }, fastIntervalMs);
    return () => clearInterval(id);
  }, [result, current?.id, mcChoices.length, choiceStreamCount, revealChoicesAfterCheck]);

  // Global keyboard shortcuts within this card
  useEffect(() => {
    function isTypingInInput(el) {
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }
    const onKeyDown = (e) => {
      const key = e.key;
      const target = e.target;
      // Spacebar to buzz
      if (key === ' ' || key === 'Spacebar') {
        // If not typing in input, treat as buzz
        if (!isTypingInInput(target)) {
          e.preventDefault();
          if (isBonusCurrent) {
            // For bonuses, space only focuses input; do not alter streaming state
            if (mcChoices.length === 0) {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          } else {
            if (!buzzed && streamingActive) {
              setBuzzed(true);
              setStreamingActive(false);
              // Focus text input if short answer
              if (mcChoices.length === 0) {
                setTimeout(() => inputRef.current?.focus(), 0);
              }
            }
          }
        }
      }
      // Enter to check answer
      if (key === 'Enter') {
        // Allow Enter to submit even when typing
        if (bonusState && !bonusState.result && bonusState.userAnswer) {
          e.preventDefault();
          checkBonus();
          return;
        }
        const mcReady = mcChoices.length > 0
          ? ((isBonusCurrent || buzzed) && (!isBonusCurrent && buzzed ? (String(mcTypedAnswer).trim().length > 0 || !!userAnswer) : !!userAnswer))
          : (canAnswer && String(userAnswer).trim().length > 0);
        if (mcReady) {
          e.preventDefault();
          check();
        }
      }
      // n for next question (blocked while checking)
      if ((key === 'n' || key === 'N') && !isTypingInInput(target)) {
        e.preventDefault();
        if (!checking) {
          nextQuestion();
        }
      }
      // a to toggle show answer
      if ((key === 'a' || key === 'A') && !isTypingInInput(target)) {
        e.preventDefault();
        setShowAnswer((s) => !s);
      }

      // w/x/y/z to select MC choices (only after buzz)
      if (!isTypingInInput(target) && (isBonusCurrent || buzzed) && mcChoices.length > 0) {
        const k = key.toLowerCase();
        if (k === 'w' || k === 'x' || k === 'y' || k === 'z') {
          e.preventDefault();
          setUserAnswer(k);
        }
      }

      // 't' to focus typed textbox on MC tossup interrupt
      if (!isTypingInInput(target) && !isBonusCurrent && buzzed && mcChoices.length > 0) {
        if (key === 't' || key === 'T') {
          e.preventDefault();
          setTimeout(() => mcTypedInputRef.current?.focus(), 0);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [buzzed, streamingActive, mcChoices.length, canAnswer, userAnswer, bonusState, mcTypedAnswer]);

  // Load visual image for current if it's a bonus and flagged as visual
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCurrentVisualUrl(null);
      const q = current;
      if (!q || q.question_type?.toLowerCase() !== 'bonus') return;
      if (!isVisualBonus(q)) return;
      const url = await getVisualBonusUrl({ tournament: q.tournament, round: q.round, question_number: q.question_number }).catch(() => null);
      if (!cancelled) setCurrentVisualUrl(url);
    }
    load();
    return () => { cancelled = true; };
  }, [current?.id]);

  // Load visual image for linked bonus (after a correct tossup)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBonusVisualUrl(null);
      const b = bonusState?.bonus;
      if (!b) return;
      if (!isVisualBonus(b)) return;
      const url = await getVisualBonusUrl({ tournament: b.tournament, round: b.round, question_number: b.question_number }).catch(() => null);
      if (!cancelled) setBonusVisualUrl(url);
    }
    load();
    return () => { cancelled = true; };
  }, [bonusState?.bonus?.id]);
  function nextQuestion() {
    const pred = preferredType ? (q => q.question_type?.toLowerCase() === preferredType) : (() => true);
    const next = pickRandom(pool, pred);
    // Prevent jumping while answer checking is in progress
    if (checking) return;
    setCurrent(next);
  }

  // Choose explanation text if available on the question object
  function getExplanationText(q) {
    if (!q || typeof q !== 'object') return null;
    const keys = ['explanation', 'Explanation', 'rationale', 'Rationale', 'solution', 'Solution', 'notes', 'Notes', 'why'];
    for (const k of keys) {
      const v = q[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }

  const currentExplanation = useMemo(() => getExplanationText(current), [current?.id]);
  const bonusExplanation = useMemo(() => getExplanationText(bonusState?.bonus), [bonusState?.bonus?.id]);
  const tournament_clean = String(current.tournament).toUpperCase();
  const canSelectMc = isBonusCurrent ? true : buzzed; // Bonuses don't require buzz; toss-ups do
  const fullMcChoices = useMemo(() => {
    if (!Array.isArray(mcChoices) || mcChoices.length === 0) return [];
    const map = new Map(mcChoices);
    const order = ['w','x','y','z'];
    return order.map(k => [k, map.get(k)]);
  }, [mcChoices]);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <style>{`
        /* Keep display-math inline, no big margins */
        .practice-katex .katex-display { margin: 0; }
        .practice-katex .katex-display > .katex { display: inline !important; }

        /* Minimize extra space around inline math */
        .practice-katex .katex { margin-left: 0.05em; margin-right: 0.02em; }
        /* If math is the very first thing in a block, don't indent it */
        .practice-katex > .katex:first-child { margin-left: 0; }
      `}</style>
      <div className="glass p-6 bg-white/80 dark:bg-darkcard/70 backdrop-blur">
        <div className="text-sm text-black/60 dark:text-white/80 mb-2">
          <span className="font-semibold">{tournament_clean}</span>{' \u2022 '}
          ROUND {current.round ?? '\u2014'}
          {' \u2022 '}{current.category}
          {current.question_number != null && (
            <>
              {' \u2022 '}Q{current.question_number}
            </>
          )}
          <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-700">
            {isBonusCurrent ? 'BONUS' : 'TOSS-UP'}
          </span>
          <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700">
            {mcChoices.length > 0 ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'}
          </span>
        </div>
        {/* Visual image when current is a visual bonus */}
        {current?.question_type?.toLowerCase() === 'bonus' && currentVisualUrl && (
          <div className="mb-3">
            <img
              src={currentVisualUrl}
              alt={`Visual bonus${current?.tournament ? ` • ${current.tournament}` : ''}${current?.round ? ` • Round ${current.round}` : ''}${current?.question_number != null ? ` • Q${current.question_number}` : ''}`}
              className="max-h-64 rounded-md border border-black/10 dark:border-white/10 object-contain cursor-zoom-in hover:opacity-95 transition"
              onClick={() => setShowCurrentVisualFull(true)}
            />
            <div className="text-xs text-black/60 dark:text-white/60 mt-1">Click image to view full screen</div>
          </div>
        )}
        {/* Streaming read: show partial plain text until the stem finishes; once finished, render full LaTeX even before any buzz. */}
        {!streamFinished ? (
          <div className="text-lg leading-relaxed whitespace-pre-line practice-katex">
            <LatexRenderer>{words.slice(0, Math.min(displayedWordCount, words.length)).join(' ')}</LatexRenderer>
            {!buzzed && (
              <div className="mt-2 text-sm text-black/60 dark:text-white/60">Press space to buzz</div>
            )}
          </div>
        ) : (
          <div className="text-lg leading-relaxed whitespace-pre-line practice-katex">
            <LatexRenderer>{current.question}</LatexRenderer>
          </div>
        )}
      </div>
      <div className="glass p-6 bg-white/80 dark:bg-darkcard/70 backdrop-blur flex flex-col justify-between" style={{ minHeight: '40vh', width: '100%' }}>
        <label className="block text-sm font-medium mb-2">Your answer</label>
        {/* Show radio buttons for MC, textbox for short answer only */}
        {Array.isArray(mcChoices) && mcChoices.length > 0 ? (
          <div className="space-y-3 text-lg mb-4">
            {/* Show choices if stem finished OR buzzed; for bonuses show during streaming as well */}
            {(!streamFinished && !buzzed && !isBonusCurrent) ? (
              <div className="text-sm text-black/60 dark:text-white/70">Choices will appear after the question is read.</div>
            ) : (
              fullMcChoices.map(([k, v], idx) => (
                <label key={k} className={`flex items-baseline gap-2 ${canSelectMc ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
                  <input
                    type="radio"
                    name={`tossup-mc-${current.id}`}
                    value={k}
                    checked={String(userAnswer) === String(k)}
                    onChange={() => setUserAnswer(k)}
                    className="accent-tint w-5 h-5"
                    disabled={!canSelectMc}
                  />
                  <span className="practice-katex">
                    {k.toUpperCase()}){' '}
                    {idx < choiceStreamCount && v ? (
                      <LatexRenderer>{v}</LatexRenderer>
                    ) : (
                      <span className="text-black/50 dark:text-white/50">…</span>
                    )}
                  </span>
                </label>
              ))
            )}
            {/* Textbox appears under MC choices on interrupt (tossup only) */}
            {(!isBonusCurrent && buzzed) && (
              <input
                className="w-full rounded-xl border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white px-4 py-3 outline-none focus:ring-2 focus:ring-tint text-lg"
                value={mcTypedAnswer}
                onChange={e => setMcTypedAnswer(e.target.value)}
                placeholder="Type your answer (press “t” to focus)"
                ref={mcTypedInputRef}
                disabled={!canSelectMc}
              />
            )}
          </div>
        ) : (
          <input
            className="w-full rounded-xl border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white px-4 py-3 outline-none focus:ring-2 focus:ring-tint text-lg"
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            placeholder="Type your answer"
            ref={inputRef}
            disabled={!canAnswer}
          />
        )}
        <div className="mt-4 flex gap-2">
          {(() => {
            const canCheck = fullMcChoices.length > 0
              ? ((isBonusCurrent || buzzed) && (!isBonusCurrent && buzzed ? (String(mcTypedAnswer).trim().length > 0 || !!userAnswer) : !!userAnswer))
              : (canAnswer && !!userAnswer);
            return (
              <button className="btn btn-primary px-3 py-1.5 text-base" onClick={check} disabled={!canCheck} title="Check answer">
                <Check size={16} />
              </button>
            );
          })()}
          <button className="btn btn-ghost px-3 py-1.5 text-base" onClick={() => setShowAnswer(s => !s)} title={showAnswer ? 'Hide answer' : 'Reveal answer'}>
            {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            className="btn btn-ghost px-3 py-1.5 text-base"
            onClick={nextQuestion}
            disabled={checking}
            title={checking ? 'Please wait—checking in progress' : 'Next question'}
          >
            <SkipForward size={16} />
          </button>
        </div>
        {checking ? (
          <div className="mt-4 rounded-xl px-4 py-3 border bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-800 flex items-center gap-3">
            <DoubleHelix />
            <span className="font-medium">Checking answer...</span>
          </div>
        ) : result && (
          <div
            className={
              `mt-4 rounded-xl px-4 py-3 border ` +
              (result.correct
                ? 'bg-green-100 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-100 dark:border-green-800'
                : 'bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-100 dark:border-red-800')
            }
          >
            {result.correct ? 'Correct' : 'Incorrect'}
            {result.reason ? <div className="text-sm text-black/70 dark:text-white/80">{result.reason}</div> : null}
            {!result.correct && currentExplanation && (
              <div className="mt-2 text-sm text-black/80 dark:text-white/80 whitespace-pre-line">
                <span className="font-semibold">Explanation:</span> {currentExplanation}
              </div>
            )}
          </div>
        )}
        {showAnswer && (
            <div className="mt-4 rounded-xl bg-black/5 dark:bg-white/10 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">ANSWER</div>
              <div className="font-medium text-black dark:text-white"><LatexRenderer>{current.answer.toUpperCase()}</LatexRenderer></div>
            </div>
        )}

        {/* Bonus UI */}
        {bonusState && (
          <div className="mt-8 border-t pt-6">
            <div className="font-semibold mb-2">Bonus</div>
            {bonusVisualUrl && (
              <div className="mb-3">
                <img
                  src={bonusVisualUrl}
                  alt={`Visual bonus${bonusState?.bonus?.tournament ? ` • ${bonusState.bonus.tournament}` : ''}${bonusState?.bonus?.round ? ` • Round ${bonusState.bonus.round}` : ''}${bonusState?.bonus?.question_number != null ? ` • Q${bonusState.bonus.question_number}` : ''}`}
                  className="max-h-64 rounded-md border border-black/10 dark:border-white/10 object-contain cursor-zoom-in hover:opacity-95 transition"
                  onClick={() => setShowBonusVisualFull(true)}
                />
                <div className="text-xs text-black/60 dark:text-white/60 mt-1">Click image to view full screen</div>
              </div>
            )}
            <div className="mb-2 whitespace-pre-line text-lg practice-katex">
              <LatexRenderer>{bonusState.bonus.question}</LatexRenderer>
            </div>
            {/* Show radio buttons for MC, textbox for short answer only */}
            {parseMCChoicesRG(bonusState.bonus).length > 0 ? (
              <div className="space-y-2 text-lg mb-4">
                {parseMCChoicesRG(bonusState.bonus).map(([k, v]) => (
                  <label key={k} className="flex items-baseline gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`bonus-mc-${bonusState.bonus.id}`}
                      value={k}
                      checked={String(bonusState.userAnswer) === String(k)}
                      onChange={() => setBonusState(bs => ({ ...bs, userAnswer: k }))}
                      className="accent-tint w-5 h-5"
                      disabled={!!bonusState.result}
                    />
                    <span className="practice-katex">
                      {k.toUpperCase()}) <LatexRenderer>{v}</LatexRenderer>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                className="w-full rounded-xl border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white px-4 py-3 outline-none focus:ring-2 focus:ring-tint text-lg"
                value={bonusState.userAnswer}
                onChange={e => setBonusState(bs => ({ ...bs, userAnswer: e.target.value }))}
                placeholder="Type your answer"
                disabled={!!bonusState.result}
              />
            )}
            <div className="mt-4 flex gap-2">
              <button className="btn btn-primary px-3 py-1.5 text-base" onClick={checkBonus} disabled={!bonusState.userAnswer || !!bonusState.result} title="Check answer">
                <Check size={16} />
              </button>
              <button className="btn btn-ghost px-3 py-1.5 text-base" onClick={() => setBonusState(bs => ({ ...bs, showAnswer: !bs.showAnswer }))} title={bonusState.showAnswer ? 'Hide answer' : 'Reveal answer'}>
                {bonusState.showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {bonusState.result && (
              <div
                className={
                  `mt-4 rounded-xl px-4 py-3 border ` +
                  (bonusState.result.correct
                    ? 'bg-green-100 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-100 dark:border-green-800'
                    : 'bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-100 dark:border-red-800')
                }
              >
                {bonusState.result.correct ? 'Correct' : 'Incorrect'}
                {bonusState.result.reason ? <div className="text-sm text-black/70 dark:text-white/80">{bonusState.result.reason}</div> : null}
                {!bonusState.result.correct && bonusExplanation && (
                  <div className="mt-2 text-sm text-black/80 dark:text-white/80 whitespace-pre-line">
                    <span className="font-semibold">Explanation:</span> {bonusExplanation}
                  </div>
                )}
              </div>
            )}
            {bonusState.showAnswer && (
                <div className="mt-4 rounded-xl bg-black/5 dark:bg-white/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">Answer</div>
                  <div className="font-medium text-black dark:text-white"><LatexRenderer>{bonusState.bonus.answer}</LatexRenderer></div>
                </div>
            )}
          </div>
        )}
      </div>
      {/* Full-screen overlays for current/bonus visuals */}
      {showCurrentVisualFull && currentVisualUrl && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Visual bonus image">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowCurrentVisualFull(false)} />
          <div className="relative max-w-[96vw] max-h-[96vh] p-2">
            <img src={currentVisualUrl} alt="Visual bonus full screen" className="max-w-[96vw] max-h-[92vh] object-contain rounded shadow-2xl" />
            <button type="button" className="absolute -top-3 -right-3 bg-white text-black rounded-full shadow p-2 hover:bg-white/90 focus:outline-none" aria-label="Close full screen image" onClick={() => setShowCurrentVisualFull(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      )}
      {showBonusVisualFull && bonusVisualUrl && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Visual bonus image">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowBonusVisualFull(false)} />
          <div className="relative max-w-[96vw] max-h-[96vh] p-2">
            <img src={bonusVisualUrl} alt="Visual bonus full screen" className="max-w-[96vw] max-h-[92vh] object-contain rounded shadow-2xl" />
            <button type="button" className="absolute -top-3 -right-3 bg-white text-black rounded-full shadow p-2 hover:bg-white/90 focus:outline-none" aria-label="Close full screen image" onClick={() => setShowBonusVisualFull(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
