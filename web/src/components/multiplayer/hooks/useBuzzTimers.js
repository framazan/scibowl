import { useEffect, useMemo } from 'react';
import { serverNow } from '../../../data/serverTime.js';

/**
 * Derives buzz/answer window timers and anchors initial buzz window
 * only after streaming fully completes (choicesFinishedAt present).
 */
export default function useBuzzTimers({ room, roomId, currentQ, setMpBuzzerOpen, resetBuzzWindowNow }) {
  // Anchor initial buzz window precisely when choices finished
  useEffect(() => {
    if (!room?.state?.buzzerOpen) return;
    if (!room?.state?.choicesFinishedAt) return; // not fully streamed yet
    if (room?.state?.buzzWindowStartAt) return; // already anchored
    // Explicitly anchor/reset now (includes duration policy inside)
    resetBuzzWindowNow({ roomId, qid: currentQ?.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.state?.buzzerOpen, room?.state?.choicesFinishedAt, currentQ?.id]);

  // Derive timer remaining for buzz window
  const buzzWindowRemainingMs = useMemo(() => {
    const start = Number(room?.state?.buzzWindowStartAt || 0);
    const ms = Number(room?.state?.buzzWindowMs || 0);
    if (!start || !ms) return null;
    const now = serverNow();
    return Math.max(0, start + ms - now);
  }, [room?.state?.buzzWindowStartAt, room?.state?.buzzWindowMs, room?.state?.winnerUid]);

  // Derive timer remaining for answer window
  const answerWindowDeadlineAt = Number(room?.state?.answerWindowDeadlineAt || 0) || null;
  const answerWindowUid = room?.state?.answerWindowUid || null;
  const answerWindowRemainingMs = useMemo(() => {
    if (!answerWindowDeadlineAt) return null;
    const now = serverNow();
    return Math.max(0, answerWindowDeadlineAt - now);
  }, [answerWindowDeadlineAt, room?.state?.winnerUid]);

  return {
    buzzWindowRemainingMs,
    answerWindowUid,
    answerWindowDeadlineAt,
    answerWindowRemainingMs,
  };
}
