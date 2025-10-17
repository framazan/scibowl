import React, { useState, useEffect } from 'react';

// Reusable substitution modal. Lets scorekeeper pick a team seat to swap and name the incoming player.
export default function SubstitutionModal({
  open,
  onClose,
  players,
  onSubmit,
  initialTeam = 'A'
}) {
  const [team, setTeam] = useState(initialTeam);
  const [playerId, setPlayerId] = useState(null); // outgoing player's id (seat)
  const [newName, setNewName] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setTeam(initialTeam);
      const first = players.filter(p => p.team === initialTeam)[0];
      setPlayerId(first?.id ?? null);
      setNewName('');
      setTouched(false);
    }
  }, [open, initialTeam, players]);

  if (!open) return null;

  const teamPlayers = players.filter(p => p.team === team);
  const existingCount = players.filter(p => p.team === team).length;
  const teamAtLimit = existingCount >= 5; // only allow one substitute (5th column)
  const canSubmit = newName.trim().length > 0 && playerId != null && !teamAtLimit;
  const outgoing = players.find(p => p.id === playerId);

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-darkcard rounded-lg shadow-xl w-full max-w-md border border-black/10 dark:border-white/10 p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">Substitute Player</h2>
          <button type="button" className="chip text-xs" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="font-medium text-xs uppercase tracking-wide">Team</label>
            <div className="flex gap-2">
              {['A','B'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={`chip px-3 py-1 text-sm ${team===t? 'ring-2 ring-tint bg-tint/10' : ''}`}
                  onClick={() => { setTeam(t); const first = players.filter(p => p.team === t)[0]; setPlayerId(first?.id ?? null); }}
                >Team {t}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-medium text-xs uppercase tracking-wide">Outgoing Seat</label>
            <div className="grid grid-cols-2 gap-2">
              {teamPlayers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlayerId(p.id)}
                  className={`chip flex flex-col items-center gap-1 py-2 ${playerId===p.id ? 'ring-2 ring-tint bg-tint/10' : ''}`}
                >
                  <span className="text-[11px] font-semibold">{p.name || `Seat ${team}${p.seat ?? (p.id <=4 ? p.id : p.id-4)}`}</span>
                  {p.name && <span className="text-[10px] opacity-60">{p.stats.correct + p.stats.correctInterrupt} C / {p.stats.incorrect + p.stats.incorrectInterrupt} I</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-medium text-xs uppercase tracking-wide" htmlFor="new-player-name">New Player Name</label>
            <input
              id="new-player-name"
              type="text"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-darkcard px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tint"
              placeholder="Enter name"
              value={newName}
              onChange={e => { setNewName(e.target.value); setTouched(true); }}
              autoFocus
            />
            {touched && newName.trim()==='' && (
              <div className="text-[11px] text-red-600 mt-1">Name required.</div>
            )}
          </div>
          {teamAtLimit && (
            <div className="text-[11px] text-red-600">Team already has a substitute (5 players shown). Further substitutions disabled.</div>
          )}
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return; 
              onSubmit({ team, playerId, newName: newName.trim() });
              onClose();
            }}
            className="btn btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >Apply Substitution</button>
          <button type="button" onClick={onClose} className="btn btn-ghost w-full justify-center">Cancel</button>
        </div>
      </div>
    </div>
  );
}
