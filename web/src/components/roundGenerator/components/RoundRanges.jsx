import React from 'react';
import { Plus, Minus } from 'lucide-react';

export default function RoundRanges({
  selectedTournaments,
  tournaments,
  roundRanges,
  setRoundRanges,
  roundsByTournament,
  globalNumericRoundMax,
}) {
  return (
    <div>
      <div className="font-semibold mb-2 flex items-center justify-between gap-2">
        <span>Round ranges</span>
        <button
          type="button"
          className={`chip px-2 py-1 ${selectedTournaments.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Add round range"
          title="Add range"
          disabled={selectedTournaments.length === 0}
          onClick={() => {
            if (selectedTournaments.length === 0) return;
            const tournamentLocked = selectedTournaments.length === 1;
            const lockedTournament = tournamentLocked ? selectedTournaments[0] : '';
            setRoundRanges([...roundRanges, { from: 1, to: 3, tournament: lockedTournament }]);
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {roundRanges.length === 0 && (
          <div className="text-xs italic text-black/70 dark:text-white/60 px-1">
            All rounds included (no range filters). Add a range to limit rounds.
          </div>
        )}
        {roundRanges.map((rr, idx) => {
          const optionsList = selectedTournaments.length > 0 ? selectedTournaments : tournaments;
          const lockBecauseSingleSelected = selectedTournaments.length === 1;
          const lockBecauseOnlyOneTotal = selectedTournaments.length === 0 && tournaments.length === 1;
          const tournamentLocked = lockBecauseSingleSelected || lockBecauseOnlyOneTotal || optionsList.length === 1;
          const lockedTournament = tournamentLocked ? (selectedTournaments[0] || optionsList[0] || '') : '';
          const effectiveValue = tournamentLocked ? lockedTournament : (rr.tournament || '');
          const activeTournament = tournamentLocked ? lockedTournament : (rr.tournament || null);
          const orderedRounds = activeTournament ? (roundsByTournament[activeTournament] ?? []) : [];
          const isNumericRounds = orderedRounds.length > 0 && orderedRounds.every(x => /^\d+$/.test(x));
          return (
            <div key={idx} className="round-range-row w-full overflow-hidden">
              <div className="select-wrapper flex-1 min-w-0">
                <select
                  className={
                    `sb-select-range rounded-lg border px-3 py-1.5 shadow-none focus:outline-none ` +
                    (tournamentLocked
                      ? 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-white/20 cursor-not-allowed pointer-events-none'
                      : 'bg-white text-black border-black/10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-darkcard dark:text-white dark:border-white/20')
                  }
                  value={effectiveValue}
                  disabled={tournamentLocked}
                  onChange={e => {
                    if (tournamentLocked) return;
                    const v = [...roundRanges]; v[idx] = { ...v[idx], tournament: e.target.value }; setRoundRanges(v);
                  }}
                  title={effectiveValue || 'All Tournaments'}
                >
                  {tournamentLocked ? (
                    <option value={lockedTournament}>{lockedTournament}</option>
                  ) : selectedTournaments.length === 0 ? (
                    <>
                      <option value="">All Tournaments</option>
                      {optionsList.map(t => <option key={t} value={t}>{t}</option>)}
                    </>
                  ) : (
                    optionsList.map(t => <option key={t} value={t}>{t}</option>)
                  )}
                </select>
              </div>
              {!activeTournament ? (
                (() => {
                  const opts = Array.from({ length: globalNumericRoundMax }, (_, i) => i + 1);
                  const fromVal = (rr.from != null && rr.from >= 1) ? rr.from : opts[0];
                  const toVal = (rr.to != null && rr.to >= fromVal) ? rr.to : (rr.to != null ? rr.to : opts[opts.length - 1]);
                  return (
                    <>
                      <div className="select-wrapper sb-select-round"><select
                        className="rounded-lg border border-black/10 bg-white text-black px-2 py-1 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-darkcard dark:text-white dark:border-white/20 shrink-0 sb-select-round"
                        value={String(fromVal)}
                        onChange={e => {
                          const v = [...roundRanges];
                          let from = Number(e.target.value);
                          let to = Number(v[idx].to);
                          if (!Number.isFinite(to) || to < from) to = from;
                          v[idx] = { ...v[idx], from, to, dFrom: undefined, dTo: undefined };
                          setRoundRanges(v);
                        }}
                      >
                        {opts.map(n => <option key={n} value={n}>{n}</option>)}
                      </select></div>
                      <span className="text-black dark:text-white">to</span>
                      <div className="select-wrapper sb-select-round"><select
                        className="rounded-lg border border-black/10 bg-white text-black px-2 py-1 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-darkcard dark:text-white dark:border-white/20 shrink-0 sb-select-round"
                        value={String(toVal)}
                        onChange={e => {
                          const v = [...roundRanges];
                          let to = Number(e.target.value);
                          let from = Number(v[idx].from);
                          if (!Number.isFinite(from) || from > to) from = to;
                          v[idx] = { ...v[idx], from, to, dFrom: undefined, dTo: undefined };
                          setRoundRanges(v);
                        }}
                      >
                        {opts.map(n => <option key={n} value={n}>{n}</option>)}
                      </select></div>
                    </>
                  );
                })()
              ) : isNumericRounds ? (
                <>
                  <div className="select-wrapper sb-select-round"><select
                    className="rounded-lg border border-black/10 bg-white text-black px-2 py-1 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-darkcard dark:text-white dark:border-white/20 shrink-0 sb-select-round"
                    value={
                      (rr.from != null && orderedRounds.includes(String(rr.from)))
                        ? String(rr.from)
                        : (orderedRounds[0] ?? '')
                    }
                    onChange={e => {
                      const v = [...roundRanges];
                      let from = Number(e.target.value);
                      let to = Number(v[idx].to);
                      if (!Number.isFinite(to) || to < from) to = from;
                      v[idx] = { ...v[idx], from, to, dFrom: undefined, dTo: undefined };
                      setRoundRanges(v);
                    }}
                  >
                    {orderedRounds.map(r => <option key={r} value={r}>{r}</option>)}
                  </select></div>
                  <span className="text-black dark:text-white">to</span>
                  <div className="select-wrapper sb-select-round"><select
                    className="rounded-lg border border-black/10 bg-white text-black px-2 py-1 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-darkcard dark:text-white dark:border-white/20 shrink-0 sb-select-round"
                    value={
                      (rr.to != null && orderedRounds.includes(String(rr.to)))
                        ? String(rr.to)
                        : (orderedRounds[orderedRounds.length - 1] ?? '')
                    }
                    onChange={e => {
                      const v = [...roundRanges];
                      let to = Number(e.target.value);
                      let from = Number(v[idx].from);
                      if (!Number.isFinite(from) || from > to) from = to;
                      v[idx] = { ...v[idx], from, to, dFrom: undefined, dTo: undefined };
                      setRoundRanges(v);
                    }}
                  >
                    {orderedRounds.map(r => <option key={r} value={r}>{r}</option>)}
                  </select></div>
                </>
              ) : (
                <>
                  <div className="select-wrapper sb-select-round"><select
                    className="rounded-lg border border-black/10 bg-white text-black px-2 py-1 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-darkcard dark:text-white dark:border-white/20 shrink-0 sb-select-round"
                    value={rr.dFrom ?? orderedRounds[0] ?? ''}
                    onChange={e => {
                      const v = [...roundRanges];
                      const newFrom = e.target.value;
                      let newTo = v[idx].dTo;
                      if (newTo) {
                        const fromIdx = orderedRounds.indexOf(newFrom);
                        const toIdx = orderedRounds.indexOf(newTo);
                        if (fromIdx !== -1 && toIdx !== -1 && fromIdx > toIdx) {
                          newTo = newFrom;
                        }
                      }
                      v[idx] = { ...v[idx], dFrom: newFrom, dTo: newTo };
                      setRoundRanges(v);
                    }}
                  >
                    {orderedRounds.map(r => <option key={r} value={r}>{r}</option>)}
                  </select></div>
                  <span className="text-black dark:text-white">to</span>
                  <div className="select-wrapper sb-select-round"><select
                    className="rounded-lg border border-black/10 bg-white text-black px-2 py-1 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-darkcard dark:text-white dark:border-white/20 shrink-0 sb-select-round"
                    value={rr.dTo ?? orderedRounds[orderedRounds.length - 1] ?? ''}
                    onChange={e => {
                      const v = [...roundRanges];
                      const newTo = e.target.value;
                      let newFrom = v[idx].dFrom;
                      if (newFrom) {
                        const fromIdx = orderedRounds.indexOf(newFrom);
                        const toIdx = orderedRounds.indexOf(newTo);
                        if (fromIdx !== -1 && toIdx !== -1 && fromIdx > toIdx) {
                          newFrom = newTo;
                        }
                      }
                      v[idx] = { ...v[idx], dFrom: newFrom ?? newTo, dTo: newTo };
                      setRoundRanges(v);
                    }}
                  >
                    {orderedRounds.map(r => <option key={r} value={r}>{r}</option>)}
                  </select></div>
                </>
              )}
              <button
                className="chip shrink-0"
                aria-label="Remove round range"
                title="Remove range"
                onClick={() => setRoundRanges(roundRanges.filter((_, i) => i !== idx))}
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
