import React from 'react';

export default function PasscodePrompt({ passPrompt, setPassPrompt, onJoin, busy, error }) {
  return (
    <div className="glass p-6 space-y-3 max-w-md">
      <div className="font-medium">This room is private</div>
      <input
        className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard w-full"
        placeholder="Enter passcode"
        value={passPrompt}
        onChange={(e)=>setPassPrompt(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={onJoin} disabled={busy || !passPrompt}>Join</button>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}
