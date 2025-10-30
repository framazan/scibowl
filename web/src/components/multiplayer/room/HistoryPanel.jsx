import React from 'react';
import LatexRenderer from '../../LatexRenderer.jsx';
import { parseMCChoices as parseMCChoicesRG } from '../../roundGenerator/utils/helpers.js';

export default function HistoryPanel({ history, page, setPage, pageSize, byId, buzzesMap, answersMap, members }) {
  if (!Array.isArray(history) || history.length === 0) return null;
  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-black/60 dark:text-white/60">Previous Questions</div>
        <div className="flex items-center gap-2 text-xs">
          <button className="chip" disabled={page<=0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Prev</button>
          <span className="opacity-70">Page {page+1}</span>
          <button className="chip" disabled={(page+1)*pageSize>=history.length} onClick={()=>setPage(p=>p+1)}>Next</button>
        </div>
      </div>
      {history.slice(page*pageSize, page*pageSize + pageSize).map((h, idx) => {
        const q = byId.get(h.questionId) || { id: h.questionId };
        return (
          <details key={h.id || h.questionId || idx} className="rounded-lg bg-black/5 dark:bg-white/10">
            <summary className="cursor-pointer px-3 py-2 text-sm">
              {q.tournament ? (
                <>
                  <span className="font-semibold">{String(q.tournament).toUpperCase()}</span>
                  {' • Round '}{q.round}
                  {' • '}{q.category}
                  {q.question_number && <> • Q{q.question_number}</>}
                  {' • '}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${String(q?.question_type||'').toLowerCase()==='bonus' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-100' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100'}`}>
                    {String(q?.question_type||'').toLowerCase()==='bonus' ? 'BONUS' : 'TOSS-UP'}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold">Question {q.id}</span>
                  <span className="ml-2 opacity-70">(Load tournaments to view details)</span>
                </>
              )}
            </summary>
            {q.question && (
              <div className="px-3 pb-3 whitespace-pre-wrap"><LatexRenderer>{q.question}</LatexRenderer></div>
            )}
            {(() => {
              const choices = parseMCChoicesRG(q);
              return choices.length > 0 && (
                <div className="px-3 pb-3 space-y-1">
                  {choices.map(([k, v]) => (
                    <div key={k} className="text-sm">
                      <span className="font-semibold mr-2">{k.toUpperCase()})</span>
                      <LatexRenderer>{v}</LatexRenderer>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="px-3 pb-1 flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">ANSWER</span>
            </div>
            {q.answer && (
              <div className="px-3 pb-3"><LatexRenderer>{String(q.answer).toUpperCase()}</LatexRenderer></div>
            )}
            {q.id && Array.isArray(buzzesMap[q.id]) && buzzesMap[q.id].length > 0 && (
              <div className="px-3 pb-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">Buzz History</div>
                {buzzesMap[q.id].slice().reverse().map((bz, bidx, barr) => {
                  const ansRec = answersMap?.[q.id]?.[bz.uid] || null;
                  const correct = !!ansRec?.correct;
                  const name = bz.displayName || members.find(m=>m.uid===bz.uid)?.displayName || bz.uid;
                  return (
                    <div key={bz.id || `${bz.uid}-${bidx}`} className="text-sm flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{name}</span>
                      <span className="chip text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">buzzed</span>
                      <span className="text-[10px] opacity-60">#{(barr.length - bidx)}</span>
                      {ansRec?.text && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 whitespace-pre-wrap break-words">{ansRec.text}</span>
                      )}
                      {ansRec && (
                        <span className={`chip text-xs ${correct ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'}`}>
                          {correct ? 'correct' : 'incorrect'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
