import React, { useMemo, useState } from 'react';
import LatexRenderer from './LatexRenderer.jsx';
import { Check, Eye, EyeOff, SkipForward } from 'lucide-react';

function pickRandom(arr, predicate = () => true) {
  const pool = arr.filter(predicate);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function findBonus(tossup, all) {
  // Find bonus with same round, tournament, and question_number as tossup
  if (!tossup) return null;
  return all.find(q => q.question_type?.toLowerCase() === 'bonus' &&
    q.round === tossup.round &&
    q.tournament === tossup.tournament &&
    q.question_number === tossup.question_number);
}

function parseMCChoices(q) {
  const raw = q?.choices;
  if (!raw) return [];

  const order = ['w', 'x', 'y', 'z'];

  function normalizeChoiceKey(k) {
    const cleaned = String(k).replace(/[.)\s]/g, '').toLowerCase();
    const first = cleaned[0];
    const map = { a: 'w', b: 'x', c: 'y', d: 'z', w: 'w', x: 'x', y: 'y', z: 'z', '1': 'w', '2': 'x', '3': 'y', '4': 'z' };
    return map[first] ?? first;
  }

  function extractText(v) {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      return v.text ?? v.value ?? v.choice ?? v.content ?? v.answer ?? v.option ?? v.label ?? v.name ?? null;
    }
    return null;
  }

  // Array shapes: ['...', '...', ...] or [{text:'...'}, ...]
  if (Array.isArray(raw)) {
    return raw
      .map((item, idx) => {
        const text = extractText(item);
        if (!text) return null;
        const providedKey = (item && typeof item === 'object'
          ? (item.key ?? item.letter ?? item.label)
          : null);
        const key = normalizeChoiceKey(providedKey ?? order[idx] ?? String(idx + 1));
        return [key, text];
      })
      .filter(Boolean);
  }

  // Object shapes: { W: '...', X: '...' } or { a: '...', b: '...' } or { 'w)': '...' }
  const entries = Object.entries(raw)
    .map(([k, v]) => {
      const text = extractText(v);
      if (!text) return null;
      return [normalizeChoiceKey(k), text];
    })
    .filter(Boolean);

  // Return in w/x/y/z order
  const byKey = new Map(entries);
  return order.map(k => [k, byKey.get(k)]).filter(([_, v]) => v != null);
}
export default function PracticeMode({ questions, tournamentName }) {
  const [current, setCurrent] = useState(() => pickRandom(questions, q => q.question_type?.toLowerCase() === 'tossup'));
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [bonusState, setBonusState] = useState(null); // {bonus, userAnswer, result, showAnswer}

  const mcChoices = useMemo(() => parseMCChoices(current), [current]);

  function nextQuestion() {
    setCurrent(pickRandom(questions, q => q.question_type?.toLowerCase() === 'tossup'));
    setUserAnswer('');
    setResult(null);
    setShowAnswer(false);
    setBonusState(null);
  }

  async function check() {
    try {
      const res = await fetch('/api/checkAnswer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAnswer,
          correctAnswer: current.answer,
          question: current.question,
        })
      });
      const data = await res.json();
      setResult(data);
      // If correct, show bonus if available
      if (data.correct) {
        const bonus = findBonus(current, questions);
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
    }
  }

  // Bonus answer check
  async function checkBonus() {
    if (!bonusState) return;
    try {
      const res = await fetch('/api/checkAnswer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAnswer: bonusState.userAnswer,
          correctAnswer: bonusState.bonus.answer,
          question: bonusState.bonus.question,
        })
      });
      const data = await res.json();
      setBonusState(bs => ({ ...bs, result: data }));
    } catch (e) {
      setBonusState(bs => ({ ...bs, result: { correct: false, reason: 'Check failed' } }));
    }
  }

  if (!current) return <div className="glass p-6">No questions available.</div>;
  const tournament_clean = String(current.tournament).toUpperCase();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <style>{`
        /* Keep display-math inline, no big margins */
        .practice-katex .katex-display { margin: 0; }
        .practice-katex .katex-display > .katex { display: inline !important; }

        /* Add a little space before inline math so it doesn't touch the previous word */
        .practice-katex .katex { margin-left: 0.2em; margin-right: 0.05em; }
        /* If math is the very first thing in a block, don't indent it */
        .practice-katex > .katex:first-child { margin-left: 0; }
      `}</style>
      <div className="glass p-6">
        <div className="text-sm text-black/60 dark:text-white/80 mb-2">
          <span className="font-semibold">{tournament_clean}</span>{' \u2022 '}
          ROUND {current.round ?? '\u2014'}
          {' \u2022 '}{current.category}
          {current.question_number != null && (
            <>
              {' \u2022 '}Q{current.question_number}
            </>
          )}
          <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700">
            {mcChoices.length > 0 ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'}
          </span>
        </div>
        <div className="text-lg leading-relaxed whitespace-pre-line practice-katex">
          <LatexRenderer>{current.question}</LatexRenderer>
        </div>
      </div>
      <div className="glass p-6 flex flex-col justify-between" style={{ minHeight: '40vh', width: '100%' }}>
        <label className="block text-sm font-medium mb-2">Your answer</label>
        {/* Show radio buttons for MC, textbox for short answer only */}
        {Array.isArray(mcChoices) && mcChoices.length > 0 ? (
          <div className="space-y-2 text-lg mb-4">
            {mcChoices.map(([k, v]) => (
              <label key={k} className="flex items-baseline gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`tossup-mc-${current.id}`}
                  value={k}
                  checked={String(userAnswer) === String(k)}
                  onChange={() => setUserAnswer(k)}
                  className="accent-tint w-5 h-5"
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
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            placeholder="Type your answer"
          />
        )}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary px-3 py-1.5 text-base" onClick={check} disabled={!userAnswer} title="Check answer">
            <Check size={16} />
          </button>
          <button className="btn btn-ghost px-3 py-1.5 text-base" onClick={() => setShowAnswer(s => !s)} title={showAnswer ? 'Hide answer' : 'Reveal answer'}>
            {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button className="btn btn-ghost px-3 py-1.5 text-base" onClick={nextQuestion} title="Next question">
            <SkipForward size={16} />
          </button>
        </div>
        {result && (
          <div className={`mt-4 rounded-xl px-4 py-3 ${result.correct ? 'bg-green-100' : 'bg-red-100'}`}>
            {result.correct ? 'Correct' : 'Incorrect'}
            {result.reason ? <div className="text-sm text-black/70">{result.reason}</div> : null}
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
            <div className="mb-2 whitespace-pre-line text-lg practice-katex">
              <LatexRenderer>{bonusState.bonus.question}</LatexRenderer>
            </div>
            {/* Show radio buttons for MC, textbox for short answer only */}
            {parseMCChoices(bonusState.bonus).length > 0 ? (
              <div className="space-y-2 text-lg mb-4">
                {parseMCChoices(bonusState.bonus).map(([k, v]) => (
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
              <div className={`mt-4 rounded-xl px-4 py-3 ${bonusState.result.correct ? 'bg-green-100' : 'bg-red-100'}`}>
                {bonusState.result.correct ? 'Correct' : 'Incorrect'}
                {bonusState.result.reason ? <div className="text-sm text-black/70">{bonusState.result.reason}</div> : null}
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
    </div>
  );
}
