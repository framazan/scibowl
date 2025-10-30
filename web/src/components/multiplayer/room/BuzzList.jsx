import React from 'react';

export default function BuzzList({
  currentQId,
  buzzes,
  answersForQ,
  selfUid,
  members,
  typingMap,
  winnerUid,
  awaitNext,
  mcTypedAnswer,
  setMcTypedAnswer,
  onSubmit,
  onUpdateTyping,
  mcInputRef,
}) {
  if (!currentQId || !Array.isArray(buzzes) || buzzes.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {(buzzes.slice().reverse()).map((bz, ridx, rarr) => {
        const isActive = winnerUid === bz.uid && ridx === 0; // latest buzz on top
        const ansRec = answersForQ?.[bz.uid] || null;
        const locked = !!ansRec;
        const correct = !!ansRec?.correct;
        const isSelf = selfUid === bz.uid;
        const showDraft = typingMap?.[bz.uid]?.draft || members.find(m=>m.uid===bz.uid)?.draft || '';
        const name = bz.displayName || members.find(m=>m.uid===bz.uid)?.displayName || bz.uid;
        return (
          <div key={bz.id || `${bz.uid}-${ridx}`} className="rounded-lg bg-black/5 dark:bg-white/10 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-black dark:text-white">{name}</span>
              <span className="chip text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">buzzed</span>
              <span className="text-[10px] opacity-60">#{(rarr.length - ridx)}</span>
              {locked ? (
                <span className="ml-2 px-2 py-1 rounded bg-black/10 dark:bg-white/10 text-sm whitespace-pre-wrap break-words">{ansRec?.text || ''}</span>
              ) : isActive ? (
                isSelf ? (
                  <form onSubmit={onSubmit} className="flex-1 min-w-[200px]">
                    <input
                      className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 bg-white dark:bg-darkcard w-full"
                      placeholder="Type your answer and press Enter"
                      value={mcTypedAnswer}
                      onChange={e=>{ setMcTypedAnswer(e.target.value); onUpdateTyping(!!e.target.value, String(e.target.value).slice(0,200)); }}
                      ref={mcInputRef}
                      autoFocus
                    />
                  </form>
                ) : (
                  <span className="ml-2 text-sm text-black/80 dark:text-white/80 whitespace-pre-wrap break-words">{showDraft}</span>
                )
              ) : null}
              {locked && (
                <span className={`chip text-xs ${correct ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'}`}>
                  {correct ? 'correct' : 'incorrect'}
                </span>
              )}
              {awaitNext && correct && isActive && (
                <span className="ml-2 text-xs opacity-70">Press ‘n’ for next</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
