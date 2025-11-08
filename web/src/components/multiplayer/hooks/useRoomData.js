import { useEffect, useState } from 'react';
import { onValue } from 'firebase/database';
import { getRoomRef } from '../../../data/multiplayer.rtdb.js';

/**
 * Subscribes to full room snapshot from RTDB; minimal wrapper to isolate side-effect.
 */
export default function useRoomData({ roomId }) {
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    const ref = getRoomRef(roomId);
    const unsub = onValue(ref, snap => {
      setRoom(snap.val());
    });
    return () => unsub();
  }, [roomId]);

  return { room };
}
