import React, { useState } from 'react';

export default function RoomHeader({ room, roomId, membersCount, onBack, members, currentQ, answersMap }) {
  const [showDisconnected, setShowDisconnected] = useState(false);
  
  const connectedMembers = members.filter(m => m.online !== false);
  const disconnectedMembers = members.filter(m => m.online === false);

  return (
    <div className="glass p-4 flex items-start justify-between">
      <div className="flex gap-6 flex-1 min-w-0">
        <div className="flex-shrink-0">
          <div className="text-sm opacity-70">Room</div>
          <div className="text-xl font-semibold">{room?.name || roomId}</div>
          <div className="text-sm opacity-70">Participants: {membersCount}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold mb-2">Players</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-4 gap-y-1 max-h-32 overflow-y-auto">
            {connectedMembers.map(m => (
              <div key={m.uid} className="flex items-center justify-between gap-2 text-sm min-w-0">
                <span className="truncate pr-2 flex-1 flex items-center gap-2 min-w-0">
                  <span className="truncate">{m.displayName || m.uid}</span>
                  {m.lastQuestionId === currentQ?.id && m.lastAnswerStatus && (
                    <span className={`ml-2 text-xs rounded px-2 py-0.5 flex-shrink-0 ${m.lastAnswerStatus === 'correct' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' : m.lastAnswerStatus === 'incorrect' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' : 'bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70'}`}>
                      {m.lastAnswerStatus}
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular-nums flex-shrink-0">{m.score || 0}</span>
              </div>
            ))}
          </div>
          {disconnectedMembers.length > 0 && (
            <div className="mt-2">
              <button 
                className="text-sm font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white flex items-center gap-1"
                onClick={() => setShowDisconnected(!showDisconnected)}
              >
                <span>Disconnected ({disconnectedMembers.length})</span>
                <svg 
                  className={`w-4 h-4 transition-transform ${showDisconnected ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {showDisconnected && (
                <div className="mt-1 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-4 gap-y-1 max-h-24 overflow-y-auto">
                  {disconnectedMembers.map(m => (
                    <div key={m.uid} className="flex items-center justify-between gap-2 text-sm min-w-0 opacity-60">
                      <span className="truncate pr-2 flex-1 flex items-center gap-2 min-w-0">
                        <span className="truncate">{m.displayName || m.uid}</span>
                        <span className="text-xs rounded px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 flex-shrink-0">disconnected</span>
                        {m.lastQuestionId === currentQ?.id && m.lastAnswerStatus && (
                          <span className={`ml-2 text-xs rounded px-2 py-0.5 flex-shrink-0 ${m.lastAnswerStatus === 'correct' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' : m.lastAnswerStatus === 'incorrect' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' : 'bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70'}`}>
                            {m.lastAnswerStatus}
                          </span>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums flex-shrink-0">{m.score || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 ml-4">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
