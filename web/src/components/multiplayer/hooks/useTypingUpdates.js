import { useCallback, useEffect, useRef, useState } from 'react';
import { updateTyping } from '../../../data/multiplayer.rtdb.js';

/**
 * Manages user's transient typing state for MC responses (live broadcast to room).
 */
export default function useTypingUpdates({ roomId, uid }) {
  const [typed, setTyped] = useState('');
  const lastSentRef = useRef('');

  useEffect(() => { lastSentRef.current = ''; setTyped(''); }, [roomId, uid]);

  const broadcastTyping = useCallback((value) => {
    setTyped(value);
    if (!roomId || !uid) return;
    if (value === lastSentRef.current) return;
    lastSentRef.current = value;
    updateTyping({ roomId, uid, typed: value }).catch(() => {});
  }, [roomId, uid]);

  return { typed, setTyped: broadcastTyping };
}
