import { useEffect, useMemo, useRef, useState } from 'react';
import { serverNow } from '../../../data/serverTime.js';

/**
 * Handles question streaming (stem + choices) and shared finish markers.
 * Depends on room.state pacing fields and RTDB markers.
 */
export default function useStreamingQuestion({ room, roomId, currentQ, parseMCChoicesRG, setStemFinishedAt, setChoicesFinishedAt, resultBanner }) {
  const [displayedWordCount, setDisplayedWordCount] = useState(0);
  const [choiceStreamCount, setChoiceStreamCount] = useState(0);
  const [choiceWordProgress, setChoiceWordProgress] = useState([0, 0, 0, 0]);
  const [revealChoicesAfterCheck, setRevealChoicesAfterCheck] = useState(false);
  const [mcTypedAnswer, setMcTypedAnswer] = useState('');
  const questionResetGuardRef = useRef(false);

  const plainQuestionText = useMemo(() => String(currentQ?.question || currentQ?.text || ''), [currentQ?.id]);
  const words = useMemo(() => plainQuestionText.split(/\s+/).filter(Boolean), [plainQuestionText]);
  const streamFinished = displayedWordCount >= words.length;
  const choices = useMemo(() => parseMCChoicesRG(currentQ), [currentQ?.id]);
  const fullMcChoices = useMemo(() => {
    if (!Array.isArray(choices) || choices.length === 0) return [];
    const map = new Map(choices);
    return ['w','x','y','z'].map(k => [k, map.get(k)]);
  }, [choices]);
  const choiceWordArrays = useMemo(() => {
    return (fullMcChoices.length ? fullMcChoices : []).map(([, text = '']) => {
      return String(text || '').split(/\s+/).filter(Boolean);
    });
  }, [fullMcChoices]);
  const totalChoicesWithContent = useMemo(() => {
    if (!choiceWordArrays.length) return 0;
    return choiceWordArrays.reduce((acc, words) => acc + (words.length > 0 ? 1 : 0), 0);
  }, [choiceWordArrays]);

  // Guard downstream finish markers during the frame when a new question mounts
  useEffect(() => {
    questionResetGuardRef.current = true;
    const rafId = window.requestAnimationFrame(() => {
      questionResetGuardRef.current = false;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [currentQ?.id]);

  // Reset streaming when question changes
  useEffect(() => {
    setDisplayedWordCount(0);
    setChoiceStreamCount(0);
    setChoiceWordProgress(Array.from({ length: 4 }, () => 0));
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
    if (questionResetGuardRef.current) return;
    const hasWords = words.length > 0;
    if (hasWords && displayedWordCount === 0) return;
    if (!room?.state?.streamStartAt) return;
  (async () => { try { await setStemFinishedAt({ roomId, questionId: currentQ?.id, at: serverNow() }); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamFinished, currentQ?.id, !!room?.state?.stemFinishedAt, displayedWordCount, words.length, room?.state?.streamStartAt]);

  // Keep choiceStreamCount in sync with fully revealed choices based on word progress
  useEffect(() => {
    if (!currentQ) return;
    if (!choiceWordArrays.length) {
      if (choiceStreamCount !== 0) setChoiceStreamCount(0);
      return;
    }
    const lengths = choiceWordArrays.map(arr => arr.length);
    const revealedCount = lengths.reduce((acc, len, idx) => {
      const shown = choiceWordProgress[idx] || 0;
      if (len === 0) return acc;
      return acc + (shown >= len ? 1 : 0);
    }, 0);
    if (revealedCount > choiceStreamCount) {
      setChoiceStreamCount(Math.min(choiceWordArrays.length, revealedCount));
    }
  }, [choiceWordArrays, choiceWordProgress, choiceStreamCount, currentQ]);

  // Ensure awaitNext forces full reveal immediately
  useEffect(() => {
    if (!currentQ) return;
    if (!room?.state?.awaitNext) return;
    const lengths = choiceWordArrays.map(arr => arr.length);
    const allShown = lengths.every((len, idx) => (len === 0) || (choiceWordProgress[idx] || 0) >= len);
    if (allShown) return;
    setChoiceWordProgress(lengths.map(len => len));
    setChoiceStreamCount(Math.min(choiceWordArrays.length, lengths.filter(len => len > 0).length));
  }, [currentQ, room?.state?.awaitNext, choiceWordArrays, choiceWordProgress]);

  // Stream choices gradually after stem finished; pause when winner present
  useEffect(() => {
    if (!currentQ) return;
    if (!choiceWordArrays.length) return;
    if (!streamFinished) return;
    const perChoiceMs = Number(room?.state?.perChoiceMs || 400);
    const stemFinishedAt = Number(room?.state?.stemFinishedAt || 0);
    if (!stemFinishedAt) return;

    if (room?.state?.awaitNext) return;
    if (room?.state?.winnerUid || !room?.state?.buzzerOpen) return;

    const activeIndex = Math.min(choiceStreamCount, choiceWordArrays.length - 1);
    if (activeIndex < 0) return;
    const totalWords = choiceWordArrays[activeIndex]?.length || 0;
    if (totalWords === 0) {
      if (choiceStreamCount < choiceWordArrays.length) {
        setChoiceStreamCount((n) => Math.min(choiceWordArrays.length, n + 1));
      }
      return;
    }
    const shown = choiceWordProgress[activeIndex] || 0;
    if (shown >= totalWords) {
      return;
    }

    const id = setInterval(() => {
      setChoiceWordProgress(prev => {
        const next = prev.slice(0, Math.max(choiceWordArrays.length, 4));
        const currentIdx = Math.min(choiceStreamCount, choiceWordArrays.length - 1);
        if (currentIdx < 0) return prev;
        const total = choiceWordArrays[currentIdx]?.length || 0;
        if (total === 0) return prev;
        const currentShown = next[currentIdx] || 0;
        if (currentShown >= total) return prev;
        const copy = next.slice();
        copy[currentIdx] = Math.min(total, currentShown + 1);
        return copy.length ? copy : prev;
      });
    }, Math.max(40, perChoiceMs));
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, streamFinished, room?.state?.winnerUid, room?.state?.buzzerOpen, room?.state?.perChoiceMs, room?.state?.stemFinishedAt, room?.state?.awaitNext, choiceStreamCount, choiceWordProgress, choiceWordArrays.length]);

  // After a correct check, quickly reveal remaining choices
  useEffect(() => {
    if (!currentQ) return;
    if (!choiceWordArrays.length) return;
    if (!resultBanner) return;
    if (!resultBanner.correct) return;
    const lengths = choiceWordArrays.map(arr => arr.length);
    const allShown = lengths.every((len, idx) => (len === 0) || (choiceWordProgress[idx] || 0) >= len);
    if (allShown) return;
    if (!revealChoicesAfterCheck) setRevealChoicesAfterCheck(true);
    const id = setInterval(() => {
      setChoiceWordProgress(prev => {
        const next = prev.slice(0, Math.max(choiceWordArrays.length, 4));
        let advanced = false;
        for (let i = 0; i < choiceWordArrays.length; i += 1) {
          const total = choiceWordArrays[i]?.length || 0;
          if (total === 0) continue;
          const currentShown = next[i] || 0;
          if (currentShown < total) {
            const copy = next.slice();
            copy[i] = Math.min(total, currentShown + 2);
            advanced = true;
            return copy;
          }
        }
        return advanced ? next : prev;
      });
    }, 120);
    return () => clearInterval(id);
  }, [resultBanner, currentQ?.id, choiceWordArrays, choiceWordProgress, revealChoicesAfterCheck]);

  // Record shared choicesFinishedAt when all choices shown (or none exist)
  useEffect(() => {
    if (!currentQ) return;
    if (!streamFinished) return;
    if (room?.state?.choicesFinishedAt) return;
    if (questionResetGuardRef.current) return;
    if (!room?.state?.stemFinishedAt) return;
    const hasWords = words.length > 0;
    if (hasWords && displayedWordCount === 0) return;
    const hasChoices = totalChoicesWithContent > 0;
    const choicesDone = !hasChoices || (choiceStreamCount >= totalChoicesWithContent);
    if (!choicesDone) return;
  (async () => { try { await setChoicesFinishedAt({ roomId, questionId: currentQ?.id, at: serverNow() }); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, streamFinished, choiceStreamCount, !!room?.state?.choicesFinishedAt, !!room?.state?.stemFinishedAt, displayedWordCount, words.length, totalChoicesWithContent]);

  return {
    displayedWordCount,
    setDisplayedWordCount,
    choiceStreamCount,
    setChoiceStreamCount,
    choiceWordProgress,
    setChoiceWordProgress,
    choiceWordArrays,
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
