import { useEffect, useMemo, useState } from 'react';
import { serverNow } from '../../../data/serverTime.js';

/**
 * Derives buzz/answer window timers and anchors initial buzz window
 * only after streaming fully completes (choicesFinishedAt present).
 */
export default function useBuzzTimers({ room, roomId, currentQ }) {
  // Local tick to drive countdown re-computation
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 1_000_000), 200);
    return () => clearInterval(id);
  }, []);
  // Buzz window anchoring occurs when choicesFinishedAt is first set (in RTDB).
  // This hook only derives countdowns.

  // Derive timer remaining for buzz window
  const buzzWindowRemainingMs = useMemo(() => {
    const start = Number(room?.state?.buzzWindowStartAt || 0);
    const ms = Number(room?.state?.buzzWindowMs || 0);
    if (!start || !ms) return null;
    const now = serverNow();
    return Math.max(0, start + ms - now);
  }, [room?.state?.buzzWindowStartAt, room?.state?.buzzWindowMs, room?.state?.winnerUid, tick]);

  // Derive timer remaining for answer window
  const answerWindowDeadlineAt = Number(room?.state?.answerWindowDeadlineAt || 0) || null;
  const answerWindowUid = room?.state?.answerWindowUid || null;
  const answerWindowResolved = !!room?.state?.answerWindowResolved;
  const isGrading = !!room?.state?.grading;
  const answerWindowRemainingMs = useMemo(() => {
    if (!answerWindowDeadlineAt) return null;
    if (answerWindowResolved || isGrading) return null;
    const now = serverNow();
    return Math.max(0, answerWindowDeadlineAt - now);
  }, [answerWindowDeadlineAt, room?.state?.winnerUid, tick, answerWindowResolved, isGrading]);

  return {
    buzzWindowRemainingMs,
    answerWindowUid,
    answerWindowDeadlineAt,
    answerWindowRemainingMs,
  };
}
