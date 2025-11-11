import React from 'react';

export default function Toasts({ toasts, headerOffset = 0, onDismiss }) {
  return (
    <div
      className="fixed right-4 z-[60] flex flex-col gap-3 w-[min(92vw,360px)] pointer-events-none"
      style={{ top: Math.max(headerOffset + 8, 12) }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={
            'group pointer-events-auto relative overflow-hidden rounded-md px-4 py-3 pr-10 text-sm shadow-lg flex items-start gap-3 animate-toast-enter ' +
            (t.type === 'success' ? 'bg-emerald-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-white')
          }
          role="status"
          aria-live="polite"
        >
          <div className="flex-1 break-words leading-relaxed">{t.message}</div>
          <button
            className="absolute top-1.5 right-1.5 rounded p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss notification"
            onClick={() => onDismiss?.(t.id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
          </button>
          <span
            className="absolute bottom-0 left-0 h-0.5 bg-white/70 group-hover:bg-white"
            style={{ width: '100%', transformOrigin: 'left', animation: `toast-bar-${t.id} ${t.ttl}ms linear forwards` }}
          />
          <style>{`@keyframes toast-enter { from { opacity:0; transform: translateY(-4px) scale(.98); } to { opacity:1; transform: translateY(0) scale(1); } } .animate-toast-enter { animation: toast-enter 160ms cubic-bezier(.4,0,.2,1); }`}</style>
          <style>{`@keyframes toast-bar-${t.id} { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
        </div>
      ))}
    </div>
  );
}
