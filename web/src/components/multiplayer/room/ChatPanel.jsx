import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function ChatPanel({
  roomId,
  messages,
  typingMap,
  selfUid,
  onSendMessage,
  onUpdateTyping,
  disabled,
  inputRef,
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollBackTimerRef = useRef(null);
  const animFrameRef = useRef(null);

  const scrollToBottom = (smooth = true, durationMs = 180) => {
    try {
      const el = listRef.current;
      if (!el) return;
      const target = el.scrollHeight;
      if (!smooth) {
        el.scrollTop = target;
        setIsAtBottom(true);
        return;
      }

      // Cancel any in-flight animation
      if (animFrameRef.current) {
        try { cancelAnimationFrame(animFrameRef.current); } catch {}
        animFrameRef.current = null;
      }

      const startTop = el.scrollTop;
      const distance = target - startTop;
      if (Math.abs(distance) < 1) { setIsAtBottom(true); return; }
      const startTime = performance.now();
      const dur = Math.max(60, Math.min(400, durationMs)); // clamp duration
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / dur);
        const eased = easeOutCubic(t);
        el.scrollTop = startTop + distance * eased;
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          animFrameRef.current = null;
          setIsAtBottom(true);
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
      setIsAtBottom(true);
    } catch {}
  };

  // Autoscroll when messages change
  useEffect(() => {
    try {
      const el = listRef.current;
      if (!el) return;
      // Only auto-scroll if already near bottom to avoid disrupting reading history
      const threshold = 48; // px
      const atBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
      if (atBottom || isAtBottom) {
        scrollToBottom(true, 140);
      }
    } catch {}
  }, [messages?.length, isAtBottom]);

  // Ensure bottom on mount
  useEffect(() => {
    const id = setTimeout(() => scrollToBottom(true, 160), 0);
    return () => clearTimeout(id);
  }, []);

  // Live typing entries (exclude self and active winner typing handled by parent via disabled prop)
  const liveTypers = useMemo(() => {
    const arr = [];
    Object.values(typingMap || {}).forEach((m) => {
      if (!m || !m.typing) return;
      if (!m.draft) return;
      if (m.uid === selfUid) return;
      arr.push({ uid: m.uid, name: m.displayName || m.uid, draft: String(m.draft || '') });
    });
    return arr;
  }, [JSON.stringify(typingMap), selfUid]);

  // No fusion: render each message as its own bubble to simplify behavior
  const flatMessages = useMemo(() => Array.isArray(messages) ? messages : [], [messages]);

  const handleScroll = () => {
    try {
      const el = listRef.current;
      if (!el) return;
      const threshold = 48;
      const atBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
      setIsAtBottom(atBottom);
      // If user scrolled up, schedule an auto scroll back to bottom in 2s
      if (!atBottom) {
        if (scrollBackTimerRef.current) clearTimeout(scrollBackTimerRef.current);
        scrollBackTimerRef.current = setTimeout(() => {
          scrollToBottom(true, 220);
        }, 2000);
      } else {
        if (scrollBackTimerRef.current) {
          clearTimeout(scrollBackTimerRef.current);
          scrollBackTimerRef.current = null;
        }
      }
    } catch {}
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setDraft(val);
    // RTDB rules limit draft length to 200 chars; enforce here to avoid silent write failures
    onUpdateTyping?.(!!val, String(val).slice(0, 200));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const text = String(draft || '').trim();
    if (!text) return;
    try {
      // Immediately clear typing state so "is typing" bubbles disappear without lag
      try { onUpdateTyping?.(false, ''); } catch {}
      await onSendMessage?.(text);
    } finally {
      setDraft('');
    }
  };

  return (
    <div className="flex flex-col h-[520px] max-h-[60vh]">
      <div ref={listRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto pr-1 pb-10 space-y-2">
        {flatMessages.map((m, idx) => {
          const mine = m.uid === selfUid;
          const text = String(m.text || '');
          const name = m.displayName || m.uid;
          return (
            <div key={m.id || `${m.uid}-${idx}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-black/5 dark:bg-white/10 text-black dark:text-white rounded-bl-md'}`}>
                {!mine && (<div className="text-[10px] opacity-70 mb-0.5">{name}</div>)}
                <div>{text}</div>
              </div>
            </div>
          );
        })}
        {/* Live-typing bubbles (overlay, do not affect scroll height) */}
        {liveTypers.length > 0 && (
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 px-1 space-y-1 z-20">
            {liveTypers.map((t) => (
              <div key={`live-${t.uid}`} className="flex justify-start">
                <div className="pointer-events-none max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words bg-black/70 dark:bg-white/20 text-white rounded-bl-md border border-dashed border-white/20 shadow">
                  <div className="text-[10px] opacity-80 mb-0.5">{t.name} (typing…)</div>
                  <div>{t.draft}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="pt-2">
        <textarea
          ref={inputRef}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard disabled:opacity-60 resize-y min-h-[44px]"
          placeholder={disabled ? 'Chat disabled while you are answering' : 'Type a message… (Enter to send, Shift+Enter for newline)'}
          value={draft}
          onChange={handleChange}
          onBlur={() => { try { onUpdateTyping?.(false, ''); } catch {} }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.shiftKey) {
              // Allow newline via Shift+Enter (default behavior), do not submit
              e.stopPropagation();
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              // Submit on Enter
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </form>
    </div>
  );
}
