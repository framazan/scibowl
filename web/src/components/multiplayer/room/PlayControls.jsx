import React from 'react';

export default function PlayControls({ onStartNext, onTogglePause, isPaused, winnerActive, buzzWindowRemainingMs, showBuzzTimer }) {
  return (
    <div className="font-semibold flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span>Play</span>
        {showBuzzTimer && buzzWindowRemainingMs !== null && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-blue-600 text-white text-lg font-bold shadow-sm">
            {Math.ceil(Math.max(0, buzzWindowRemainingMs) / 1000)}s
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button className="chip" onClick={onStartNext}>Start/Next</button>
        <button className="chip" onClick={onTogglePause} disabled={!!winnerActive}>
          {isPaused ? 'Resume (P)' : 'Pause (P)'}
        </button>
      </div>
    </div>
  );
}
