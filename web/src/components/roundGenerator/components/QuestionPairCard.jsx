import React from 'react';
import LatexRenderer from '../../LatexRenderer.jsx';
import { parseMCChoices } from '../utils/helpers.js';
import { getVisualBonusUrl } from '../../../data/visualBonuses.js';

/**
 * Displays a tossup/bonus pair. Bonus visibility logic remains external via props.
 */
export default function QuestionPairCard({
  pair,
  index,
  scorekeeping = false,
  currentIndex = 0,
  tossupResults = [],
  showBonusContent,
  questionRef,
}) {
  const tuChoices = pair.tossup ? parseMCChoices(pair.tossup) : [];
  const boChoices = pair.bonus ? parseMCChoices(pair.bonus) : [];
  const pairActive = !scorekeeping || index === currentIndex;
  const [visualUrl, setVisualUrl] = React.useState(null);
  const [showVisualFull, setShowVisualFull] = React.useState(false);

  // When a bonus is shown, try to fetch a visual bonus image URL based on naming convention
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setVisualUrl(null);
      const b = pair?.bonus;
      if (!b) return;
      // Only attempt if this bonus is a visual or if an image might exist
      const flagged = (b.is_visual_bonus === true || String(b.visual || '').toLowerCase() === 'true');
      if (!flagged) return; // don't fetch for regular bonuses
      const url = await getVisualBonusUrl({ tournament: b.tournament, round: b.round, question_number: b.question_number }).catch(() => null);
      if (!cancelled) setVisualUrl(url);
    }
    if (showBonusContent) load();
    return () => { cancelled = true; };
  }, [pair?.bonus?.tournament, pair?.bonus?.round, pair?.bonus?.question_number, showBonusContent]);
  return (
    <>
    <div
      ref={questionRef}
      className={`glass p-6 space-y-4 min-w-0 relative ${scorekeeping && !pairActive ? 'opacity-50 blur-sm select-none pointer-events-none' : ''}`}
    >
      {scorekeeping && index === currentIndex && (
        <>
          <div className="absolute inset-0 rounded-lg pointer-events-none border-2 border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.35)]" style={{boxShadow:'0 0 0 3px rgba(34,197,94,0.35), 0 4px 12px -2px rgba(16,185,129,0.5)'}} />
          <div className="absolute -top-3 left-4 px-3 py-1 bg-green-600 text-white rounded-full text-[11px] font-semibold shadow-lg">Active</div>
        </>
      )}
      {pair.tossup && (
        <>
          <div className="text-sm text-black/60 dark:text-white/80 mb-2">
            <span className="font-semibold">{String(pair.tossup.tournament).toUpperCase()}</span>
            {' \u2022 '}Round {pair.tossup.round ?? '\u2014'}
            {' \u2022 '}{pair.tossup.category}
            {pair.tossup.question_number != null && (
              <>
                {' \u2022 '}Q{pair.tossup.question_number}
              </>
            )}
            <span className={
              `ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide border ` +
              (tuChoices.length > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700'
                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-700')
            }>
              {tuChoices.length > 0 ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'}
            </span>
          </div>
          <div className="font-medium mb-2">Toss-up {index + 1}</div>
          <div className="mb-3 whitespace-pre-line"><LatexRenderer>{pair.tossup.question}</LatexRenderer></div>
          {tuChoices.length > 0 && (
            <div className="mb-3">
              {tuChoices.map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`gen-tossup-${index}`} className="accent-tint" disabled />
                  <span>{k.toUpperCase()}) <LatexRenderer>{v}</LatexRenderer></span>
                </label>
              ))}
            </div>
          )}
          <div className="text-sm text-black/70 dark:text-white/80"><span className="uppercase text-black/60 dark:text-white/60">Answer:</span> <span className="text-black dark:text-white"><LatexRenderer>{pair.tossup.answer}</LatexRenderer></span></div>
        </>
      )}
      {pair.bonus && showBonusContent && (
        <div className={pair.tossup ? 'mt-6 pt-4 border-t' : 'mt-2'}>
          <div className="text-sm text-black/60 dark:text-white/80 mb-2">
            <span className="font-semibold">{String(pair.tossup ? pair.tossup.tournament : pair.bonus.tournament).toUpperCase()}</span>
            {' \u2022 '}Round {pair.bonus.round ?? '\u2014'}
            {' \u2022 '}{pair.bonus.category}
            {pair.bonus.question_number != null && (
              <>
                {' \u2022 '}Q{pair.bonus.question_number}
              </>
            )}
            <span className={
              `ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide border ` +
              (boChoices.length > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700'
                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-700')
            }>
              {boChoices.length > 0 ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'}
            </span>
          </div>
          <div className="font-semibold mb-2">Bonus {index + 1}</div>
          {visualUrl && (
            <div className="mb-3">
              <img
                src={visualUrl}
                alt={
                  `Visual bonus${pair?.bonus?.tournament ? ` • ${pair.bonus.tournament}` : ''}${pair?.bonus?.round ? ` • Round ${pair.bonus.round}` : ''}${pair?.bonus?.question_number != null ? ` • Q${pair.bonus.question_number}` : ''}`
                }
                className="max-h-64 rounded-md border border-black/10 dark:border-white/10 object-contain cursor-zoom-in hover:opacity-95 transition"
                onClick={() => setShowVisualFull(true)}
              />
              <div className="text-xs text-black/60 dark:text-white/60 mt-1">Click image to view full screen</div>
            </div>
          )}
          <div className="mb-2 whitespace-pre-line"><LatexRenderer>{pair.bonus.question}</LatexRenderer></div>
          {boChoices.length > 0 && (
            <div className="mb-3">
              {boChoices.map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`gen-bonus-${index}`} className="accent-tint" disabled />
                  <span>{k.toUpperCase()}) <LatexRenderer>{v}</LatexRenderer></span>
                </label>
              ))}
            </div>
          )}
          <div className="text-sm text-black/70 dark:text-white/80"><span className="uppercase text-black/60 dark:text-white/60">Answer:</span> <span className="text-black dark:text-white"><LatexRenderer>{pair.bonus.answer}</LatexRenderer></span></div>
        </div>
      )}
    </div>
      {showVisualFull && visualUrl && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Visual bonus image"
        >
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowVisualFull(false)}
          />
          <div className="relative max-w-[96vw] max-h-[96vh] p-2">
            <img
              src={visualUrl}
              alt="Visual bonus full screen"
              className="max-w-[96vw] max-h-[92vh] object-contain rounded shadow-2xl"
            />
            <button
              type="button"
              className="absolute -top-3 -right-3 bg-white text-black rounded-full shadow p-2 hover:bg-white/90 focus:outline-none"
              aria-label="Close full screen image"
              onClick={() => setShowVisualFull(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {/* ESC to close */}
          <EscapeToClose onClose={() => setShowVisualFull(false)} />
        </div>
      )}
  </>
  );
}

// Lightweight ESC listener component
function EscapeToClose({ onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return null;
}
