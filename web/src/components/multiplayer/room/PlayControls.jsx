import React from 'react';

export default function PlayControls({
  onStartNext,
  onTogglePause,
  isPaused,
  winnerActive,
  buzzWindowRemainingMs,
  showBuzzTimer,
  readingSpeed,
  onChangeReadingSpeed,
}) {
  const showSpeedSlider = typeof readingSpeed === 'number' && onChangeReadingSpeed;

  return (
    <div className="space-y-3">
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

      {showSpeedSlider && (
        <div className="flex items-center gap-3 text-sm text-black/80 dark:text-white/80">
          <label htmlFor="mp-reading-speed" className="font-medium">Reading speed</label>
          <input
            id="mp-reading-speed"
            type="range"
            min={1}
            max={12}
            step={1}
            value={readingSpeed}
            onChange={(e) => onChangeReadingSpeed(Number(e.target.value))}
            className="w-40"
          />
          <span className="tabular-nums w-12 text-right">{readingSpeed} w/s</span>
        </div>
      )}
    </div>
  );
}
