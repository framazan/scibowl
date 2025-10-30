import React from 'react';

export default function PlayControls({ onStartNext, onTogglePause, isPaused, winnerActive }) {
  return (
    <div className="font-semibold flex items-center justify-between">
      <span>Play</span>
      <div className="flex gap-2">
        <button className="chip" onClick={onStartNext}>Start/Next</button>
        <button className="chip" onClick={onTogglePause} disabled={!!winnerActive}>
          {isPaused ? 'Resume (P)' : 'Pause (P)'}
        </button>
      </div>
    </div>
  );
}
