import React from 'react';

export default function TypingStream({
  fullMcChoices,
  choiceStreamCount,
  members,
  typingMap,
}) {
  const shownChoices = fullMcChoices.slice(0, Math.min(4, choiceStreamCount));
  return (
    <div className="mt-2 text-sm text-gray-500">
      {shownChoices.map(([k, text]) => {
        const typers = Object.entries(typingMap || {})
          .filter(([, val]) => val?.toLowerCase?.().trim() === k)
          .map(([uid]) => members?.[uid]?.name || uid);
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="font-mono uppercase">{k}.</span>
            <span className="truncate">{text}</span>
            {typers.length > 0 && (
              <span className="ml-auto text-xs text-indigo-500">{typers.join(', ')} typing</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
