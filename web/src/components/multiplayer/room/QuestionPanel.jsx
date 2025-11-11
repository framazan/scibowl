import React from 'react';
import LatexRenderer from '../../LatexRenderer.jsx';

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

export default function QuestionPanel({
  grading,
  currentQ,
  words,
  displayedWordCount,
  plainQuestionText,
  showBuzzHint,
  fullMcChoices,
  choiceStreamCount,
  choiceWordProgress,
  choiceWordArrays,
  resultBanner,
  timesUp,
  correctAnswer,
}) {
  return (
    <div className="rounded-lg bg-black/5 dark:bg-white/10 p-4 min-h-32 text-black dark:text-white">
      {grading ? (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3">
            <DoubleHelix />
            <span className="ml-4 text-lg font-semibold">Checking answer...</span>
          </div>
        </div>
      ) : currentQ ? (
        <div>
          <div className="text-sm text-black/60 dark:text-white/80 mb-2 flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{String(currentQ.tournament).toUpperCase()}</span>{' \u2022 '}
            ROUND {currentQ.round ?? '\u2014'}
            {' \u2022 '}{currentQ.category}
            {' \u2022 '}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${String(currentQ?.question_type||'').toLowerCase()==='bonus' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-100' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100'}`}>
              {String(currentQ?.question_type||'').toLowerCase()==='bonus' ? 'BONUS' : 'TOSS-UP'}
            </span>
            {' \u2022 '}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${(fullMcChoices || []).length>0 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-100' : 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-100'}`}>
              {(fullMcChoices || []).length>0 ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'}
            </span>
          </div>
          {/* Stem */}
          {(() => {
            const streamFinished = displayedWordCount >= words.length;
            if (!streamFinished) {
              return (
                <div className="text-base whitespace-pre-line text-black dark:text-white">
                  <LatexRenderer>{words.slice(0, Math.min(displayedWordCount, words.length)).join(' ')}</LatexRenderer>
                  {showBuzzHint && (
                    <div className="mt-2 text-xs opacity-70 text-black dark:text-white">Press Space to buzz</div>
                  )}
                </div>
              );
            }
            return (
              <div className="text-base whitespace-pre-line text-black dark:text-white"><LatexRenderer>{plainQuestionText}</LatexRenderer></div>
            );
          })()}

          {/* MC choices */}
          {(fullMcChoices || []).length>0 && (
            <div className="mt-4 space-y-2 text-base text-black dark:text-white">
              {fullMcChoices.map(([k,v], idx)=> (
                <div key={k} className="practice-katex text-black dark:text-white">
                  <span className="font-semibold mr-1 text-black dark:text-white">{k.toUpperCase()})</span>
                  {(() => {
                    const fullText = String(v || '');
                    if (!fullText) return <span className="opacity-50">…</span>;
                    const wordsForChoice = Array.isArray(choiceWordArrays?.[idx]) ? choiceWordArrays[idx] : [];
                    const totalWords = wordsForChoice.length;
                    const shownWords = Math.min(totalWords, choiceWordProgress?.[idx] || 0);
                    const fullyRevealed = choiceStreamCount > idx;
                    const activelyStreaming = choiceStreamCount === idx && shownWords > 0 && shownWords < totalWords;
                    if (fullyRevealed || (choiceStreamCount >= (choiceWordArrays?.length || 0) && totalWords > 0 && shownWords >= totalWords)) {
                      return <LatexRenderer>{fullText}</LatexRenderer>;
                    }
                    if (activelyStreaming) {
                      const partialWords = wordsForChoice.slice(0, shownWords);
                      const partialText = partialWords.join(' ');
                      const tail = shownWords >= totalWords ? '' : ' …';
                      return partialText ? <span className="opacity-80">{`${partialText}${tail}`}</span> : <span className="opacity-50">…</span>;
                    }
                    if (choiceStreamCount === idx && shownWords >= totalWords && totalWords > 0) {
                      return <LatexRenderer>{fullText}</LatexRenderer>;
                    }
                    return <span className="opacity-50">…</span>;
                  })()}
                </div>
              ))}
            </div>
          )}

          {resultBanner && (
            <div className={`mt-3 rounded-lg px-3 py-2 ${resultBanner.correct ? 'bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-100' : 'bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-100'}`}>
              {resultBanner.correct ? 'Correct' : 'Incorrect'}{resultBanner.reason ? ` — ${resultBanner.reason}` : ''}
            </div>
          )}

          {timesUp && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
              <div className="inline-flex items-center px-2 py-1 rounded bg-red-600/90 text-white text-xs font-semibold">
                Time’s up
              </div>
              {correctAnswer && (
                <div className="rounded-lg px-3 py-2 bg-black/5 dark:bg-white/10 text-black dark:text-white sm:flex-1">
                  <div className="text-xs uppercase tracking-wide opacity-70 mb-1">Correct answer</div>
                  <div className="practice-katex text-base text-black dark:text-white"><LatexRenderer>{String(correctAnswer)}</LatexRenderer></div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="opacity-70 text-sm">No question selected yet.</div>
      )}
    </div>
  );
}
