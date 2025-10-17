import React from 'react';
import { Check, X, User } from 'lucide-react';

export default function ScorekeeperPane({
  headerOffset,
  close,
  currentIndex,
  displayPairs,
  awaitingPlayer,
  interruptArmed,
  setAwaitingPlayer,
  setInterruptArmed,
  isTossupFinal,
  recordNoAnswer,
  throwOutAndReplace,
  tossupResults,
  bonusResults,
  saveFixedBonus,
  players,
  handleSeatClick,
  allowedTeams,
  totalPoints,
  teamPoints,
  saveBonusPoints, // kept for possible future extended scoring
  subMode,
  setSubMode,
  resetScorekeeping,
  exportCoachesScoresheetPdf,
  coachesSheetLoading,
  tryoutsMode,
  setTryoutsMode,
  questionType
}) {
  return (
    <div className="fixed right-0 z-50 w-[400px] bg-white dark:bg-darkcard border-l border-black/10 dark:border-white/10 shadow-xl flex flex-col" style={{ top: headerOffset, height: `calc(100vh - ${headerOffset}px)` }}>
      <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
        <h2 className="font-semibold text-sm">Scorekeeper</h2>
        <button className="text-xs chip" onClick={close}>Close</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div>Q {Math.min(currentIndex + 1, displayPairs.length)} / {displayPairs.length}</div>
            <div className="text-[10px] mt-0.5 opacity-70">{allowedTeams.length === 0 ? 'No buzz' : 'Buzz: ' + allowedTeams.join('/')}</div>
          </div>
          <div className="font-semibold text-xs leading-tight flex flex-col items-end">
            <span>Total {totalPoints}</span>
            <span className="text-green-600 dark:text-green-400">A {teamPoints.A}</span>
            <span className="text-blue-600 dark:text-blue-400">B {teamPoints.B}</span>
          </div>
        </div>
        {currentIndex >= displayPairs.length && (
          <div className="p-2 rounded bg-emerald-600 text-white text-center text-xs">Round complete</div>
        )}
        {currentIndex < displayPairs.length && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[11px] font-medium">
                <input
                  type="checkbox"
                  className="scale-110"
                  checked={!!tryoutsMode}
                  onChange={e => setTryoutsMode(e.target.checked)}
                  disabled={questionType !== 'tossup'}
                  title={questionType === 'tossup' ? 'Tryouts mode: an incorrect buzz only locks that player; others may continue buzzing.' : 'Switch question type to Toss-ups to enable Tryouts mode.'}
                />
                Tryouts
              </label>
              {questionType !== 'tossup' && (
                <span className="text-[10px] opacity-60">Toss-ups only</span>
              )}
            </div>
            <div className="grid grid-cols-6 gap-2">
              <button
                className={`col-span-2 chip flex items-center justify-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:brightness-75 ${awaitingPlayer?.type==='incorrect' ? 'ring-2 ring-red-500' : ''}`}
                onClick={() => setAwaitingPlayer({ type: 'incorrect', interrupt: interruptArmed })}
                disabled={isTossupFinal(currentIndex)}
                title="Mark incorrect then click player seat (then select player)"
              ><X color="#ff2600" className="h-4 w-4" /> Incorrect</button>
              <button
                className={`col-span-2 chip flex items-center justify-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:brightness-75 ${awaitingPlayer?.type==='correct' ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setAwaitingPlayer({ type: 'correct', interrupt: interruptArmed })}
                disabled={isTossupFinal(currentIndex)}
                title="Mark correct then click player seat"
              ><Check color="#00f900" className="h-4 w-4" /> Correct</button>
              <button
                className={`col-span-2 chip flex items-center justify-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:brightness-75 ${interruptArmed ? 'bg-purple-600 text-white ring-2 ring-purple-500' : ''}`}
                onClick={() => setInterruptArmed(v => !v)}
                disabled={isTossupFinal(currentIndex)}
                title="Toggle interrupt (applies to next correct/incorrect)"
              >{interruptArmed ? 'Interrupt ON' : 'Interrupt'}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="chip text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={recordNoAnswer}
                disabled={isTossupFinal(currentIndex)}
                title="Record as no answer and advance (attempts already made remain in the log)"
              >No Answer</button>
              <button className="chip text-xs" onClick={throwOutAndReplace}>Throw Out & Replace</button>
            </div>
            {tossupResults[currentIndex]?.result === 'correct' && displayPairs[currentIndex]?.bonus && displayPairs[currentIndex]?.tossup && !bonusResults[currentIndex] && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  className="chip text-xs bg-green-600 text-white hover:bg-green-700"
                  onClick={() => { saveFixedBonus(true); }}
                >Award +10</button>
                <button
                  className="chip text-xs bg-red-600 text-white hover:bg-red-700"
                  onClick={() => { saveFixedBonus(false); }}
                >No Bonus</button>
              </div>
            )}
            {bonusResults[currentIndex] && (
              <div className="text-xs">Bonus: {bonusResults[currentIndex].points} pts</div>
            )}
            {awaitingPlayer && (
              <div className="text-xs text-center text-blue-600 dark:text-blue-300">Select a player seat to apply a {awaitingPlayer.interrupt ? 'Interrupt ' : ''}{awaitingPlayer.type}.</div>
            )}
          </div>
        )}
        <div>
          <div className="font-medium flex items-center gap-2 justify-between">
            <span>Players {subMode && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-purple-600 text-white">SUB MODE</span>}</span>
            {/* New substitution button triggers external modal */}
            <button type="button" className="chip px-2 py-1 text-[11px]" onClick={() => setSubMode(true)} title="Open substitution modal">Substitute</button>
          </div>
          <div className="space-y-6">
            {['A','B'].map(team => (
              <div key={team}>
                <div className={`text-[12px] font-semibold mb-2 tracking-wide ${team==='A' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>Team {team}</div>
                <div className="grid grid-cols-2 gap-4">
                  {players.filter(p => p.team === team).map(pl => {
                    const idx = players.findIndex(pp => pp.id === pl.id);
                    let cannotBuzz = (pl.status === 'replaced') || (awaitingPlayer && !allowedTeams.includes(pl.team));
                    if (tryoutsMode && questionType === 'tossup' && awaitingPlayer) {
                      const attempts = (tossupResults[currentIndex]?.attempts)||[];
                      if (attempts.some(a => a.playerId === pl.id)) {
                        cannotBuzz = true; // already tried
                      } else {
                        cannotBuzz = (pl.status === 'replaced'); // allow regardless of team restriction
                      }
                    }
                    return (
                      <button key={pl.id} onClick={() => handleSeatClick(idx)}
                        className={`relative flex flex-col items-center justify-center h-24 rounded-xl border border-black/10 dark:border-white/10 ${cannotBuzz ? 'bg-black/10 dark:bg-white/10 opacity-40 cursor-not-allowed' : 'bg-gradient-to-br from-black/5 to-black/10 dark:from-white/10 dark:to-white/5 hover:from-black/10 hover:to-black/20 dark:hover:from-white/20 dark:hover:to-white/10'} transition text-[11px] font-medium ${(awaitingPlayer && !cannotBuzz && pl.status!=='replaced') ? 'ring-2 ring-offset-2 ring-green-500 dark:ring-green-400 animate-pulse-slow' : ''}`}
                        title={pl.name || `Seat ${team}${pl.seat ?? (pl.id <=4 ? pl.id : pl.id-4)}`}
                        disabled={pl.status === 'replaced'}
                      >
                        <User className="h-7 w-7 opacity-70" />
                        <span className="mt-2 truncate max-w-[120px] px-2 text-center leading-tight">{pl.name || `Seat ${team}${pl.seat ?? (pl.id <=4 ? pl.id : pl.id-4)}`}</span>
                        {pl.status === 'replaced' && (
                          <span className="absolute top-1 left-1 text-[10px] bg-red-600 text-white px-1 rounded">OUT</span>
                        )}
                        {pl.stats.correct + pl.stats.correctInterrupt > 0 && (
                          <span className="absolute top-0 right-0 text-[10px] bg-green-600 text-white rounded-bl px-1">
                            {pl.stats.correct + pl.stats.correctInterrupt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="font-medium mb-1">Player Stats</div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-[9px] text-black/70 dark:text-white/70">
                <th className="text-left">Player</th><th>Tm</th>
                <th>C</th><th>I</th><th>CI</th><th>II</th>
              </tr>
            </thead>
            <tbody>
              {players.filter(p => p.name).map(p => (
                <tr key={p.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                  <td className="truncate max-w-[90px] pr-1">{p.name}</td>
                  <td className="text-center">{p.team}</td>
                  <td className="text-center">{p.stats.correct}</td>
                  <td className="text-center">{p.stats.incorrect}</td>
                  <td className="text-center">{p.stats.correctInterrupt}</td>
                  <td className="text-center">{p.stats.incorrectInterrupt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {currentIndex >= displayPairs.length && (
          <div className="space-y-2">
            <button className="btn btn-orange w-full justify-center" onClick={exportCoachesScoresheetPdf} disabled={coachesSheetLoading}>{coachesSheetLoading ? 'Generating…' : 'Coaches Scoresheet PDF'}</button>
            <button className="btn btn-ghost w-full justify-center" onClick={() => resetScorekeeping()}>Reset Scorekeeping</button>
          </div>
        )}
      </div>
    </div>
  );
}
