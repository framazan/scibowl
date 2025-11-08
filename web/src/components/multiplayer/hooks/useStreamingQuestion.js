import { useEffect, useMemo, useState } from 'react';
import { serverNow } from '../../../data/serverTime.js';

/**
 * Handles question streaming (stem + choices) and shared finish markers.
 * Depends on room.state pacing fields and RTDB markers.
 */
export default function useStreamingQuestion({ room, roomId, currentQ, parseMCChoicesRG, setStemFinishedAt, setChoicesFinishedAt, resultBanner }) {
  const [displayedWordCount, setDisplayedWordCount] = useState(0);
  const [choiceStreamCount, setChoiceStreamCount] = useState(0);
  const [revealChoicesAfterCheck, setRevealChoicesAfterCheck] = useState(false);
  const [mcTypedAnswer, setMcTypedAnswer] = useState('');

  const plainQuestionText = useMemo(() => String(currentQ?.question || currentQ?.text || ''), [currentQ?.id]);
  const words = useMemo(() => plainQuestionText.split(/\s+/).filter(Boolean), [plainQuestionText]);
  const streamFinished = displayedWordCount >= words.length;
  const choices = useMemo(() => parseMCChoicesRG(currentQ), [currentQ?.id]);
  const fullMcChoices = useMemo(() => {
    if (!Array.isArray(choices) || choices.length === 0) return [];
    const map = new Map(choices);
    return ['w','x','y','z'].map(k => [k, map.get(k)]);
  }, [choices]);

  // Reset streaming when question changes
  useEffect(() => {
    setDisplayedWordCount(0);
    setChoiceStreamCount(0);
    setRevealChoicesAfterCheck(false);
    setMcTypedAnswer('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id]);

  // Stream stem words using room-anchored pacing
  useEffect(() => {
    if (!currentQ) return;
    const perWordMs = Number(room?.state?.perWordMs || 200);
    const base = Number(room?.state?.streamedWordsBase || 0);
    const startAt = Number(room?.state?.streamStartAt || 0) || null;

    let iv = null;
    const tick = () => {
      const now = serverNow();
      const inc = startAt ? Math.max(0, Math.floor((now - startAt) / Math.max(1, perWordMs))) : 0;
      const next = Math.min(words.length, base + inc);
      if (room?.state?.awaitNext) setDisplayedWordCount(words.length);
      else setDisplayedWordCount(next);
    };

    if (!room?.state?.awaitNext && room?.state?.buzzerOpen && !room?.state?.winnerUid) {
      iv = setInterval(tick, 80);
      tick();
    } else {
      tick();
    }
    return () => { if (iv) clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, words.length, room?.state?.buzzerOpen, room?.state?.winnerUid, room?.state?.perWordMs, room?.state?.streamedWordsBase, room?.state?.streamStartAt, room?.state?.awaitNext]);

  // Record shared stemFinishedAt when stem completes once
  useEffect(() => {
    if (!currentQ) return;
    if (!streamFinished) return;
    if (room?.state?.stemFinishedAt) return;
    (async () => { try { await setStemFinishedAt({ roomId, at: serverNow() }); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamFinished, currentQ?.id, !!room?.state?.stemFinishedAt]);

  // Stream choices gradually after stem finished; pause when winner present
  useEffect(() => {
    if (!currentQ) return;
    if (choices.length === 0) return;
    if (!streamFinished) return;
    const perChoiceMs = Number(room?.state?.perChoiceMs || 400);
    const stemFinishedAt = Number(room?.state?.stemFinishedAt || 0);
    if (!stemFinishedAt) return;

    if (room?.state?.awaitNext) {
      if (choiceStreamCount < 4) setChoiceStreamCount(4);
      return;
    }
    if (room?.state?.winnerUid || !room?.state?.buzzerOpen || choiceStreamCount >= 4) return;
    const id = setInterval(() => setChoiceStreamCount(n => Math.min(4, n + 1)), perChoiceMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, choices.length, streamFinished, room?.state?.winnerUid, room?.state?.buzzerOpen, room?.state?.perChoiceMs, room?.state?.stemFinishedAt, room?.state?.awaitNext, choiceStreamCount]);

  // After a correct check, quickly reveal remaining choices
  useEffect(() => {
    if (!currentQ) return;
    if (choices.length === 0) return;
    if (!resultBanner) return;
    if (!resultBanner.correct) return;
    if (choiceStreamCount >= 4) return;
    if (!revealChoicesAfterCheck) setRevealChoicesAfterCheck(true);
    const id = setInterval(() => setChoiceStreamCount(n => (n < 4 ? n + 1 : 4)), 150);
    return () => clearInterval(id);
  }, [resultBanner, currentQ?.id, choices.length, choiceStreamCount, revealChoicesAfterCheck]);

  // Record shared choicesFinishedAt when all choices shown (or none exist)
  useEffect(() => {
    if (!currentQ) return;
    if (!streamFinished) return;
    if (room?.state?.choicesFinishedAt) return;
    const hasChoices = Array.isArray(choices) && choices.length > 0;
    const choicesDone = !hasChoices || choiceStreamCount >= 4;
    if (!choicesDone) return;
    (async () => { try { await setChoicesFinishedAt({ roomId, at: serverNow() }); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, streamFinished, choiceStreamCount, !!room?.state?.choicesFinishedAt]);

  return {
    displayedWordCount,
    setDisplayedWordCount,
    choiceStreamCount,
    setChoiceStreamCount,
    revealChoicesAfterCheck,
    setRevealChoicesAfterCheck,
    mcTypedAnswer,
    setMcTypedAnswer,
    streamFinished,
    words,
    plainQuestionText,
    choices,
    fullMcChoices,
  };
}
