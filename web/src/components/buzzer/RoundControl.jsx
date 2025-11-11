import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuth from '../../data/useAuth.js';
import { listenGame, setBuzzerOpen, clearBuzz, updatePlayerStats } from '../../data/buzzer.firestore.js';
import useRoundsQuestionsLazy from '../../data/useRoundsQuestionsLazy.js';
import BuzzerLayout from '../layout/BuzzerLayout.jsx';
// (consolidated react-router-dom imports above)
import LatexRenderer from '../LatexRenderer.jsx';
import Loading from '../layout/Loading.jsx';

export default function RoundControl() {
  const { code } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const lazy = useRoundsQuestionsLazy();
  const isHost = !!(auth?.user && game?.hostUid === auth.user.uid);

  useEffect(() => {
    if (!code) return;
    const unsub = listenGame({ code, onGame: setGame, onPlayers: setPlayers });
    return () => unsub && unsub();
  }, [code]);

  // Load tournaments present in roundMeta (if any) for materialization
  const tlist = Array.from(new Set(game?.roundMeta?.tournaments || []));
  useEffect(() => {
    if (tlist.length === 0) return;
    (async () => { try { await lazy.ensureLoaded(tlist); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tlist)]);

  const allQs = useMemo(() => lazy.getLoadedQuestions(tlist), [lazy, JSON.stringify(tlist)]);
  const byId = useMemo(() => {
    const m = new Map();
    for (const q of allQs) m.set(q.id, q);
    return m;
  }, [allQs]);

  const pairs = useMemo(() => {
    const raw = Array.isArray(game?.roundPairs) ? game.roundPairs : [];
    return raw.map(p => ({ tossup: p.tossupId ? byId.get(p.tossupId) || null : null, bonus: p.bonusId ? byId.get(p.bonusId) || null : null }));
  }, [game?.roundPairs, byId]);

  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [game?.id]);

  const winnerUid = game?.state?.winnerUid || null;
  const winner = winnerUid ? players.find(p => p.uid === winnerUid) || null : null;

  if (!auth.user) return (
    <BuzzerLayout>
      <div className="glass p-6">Please sign in.</div>
    </BuzzerLayout>
  );
  if (!game) return (
    <BuzzerLayout>
      <Loading />
    </BuzzerLayout>
  );
  const loadingQuestions = tlist.length > 0 && allQs.length === 0;

  const cur = pairs[index] || null;

  async function markCorrect() {
    if (!isHost || !winnerUid) return;
    await updatePlayerStats({ code, uid: winnerUid, delta: { correct: 1, points: 4 } });
    await clearBuzz({ code });
    setIndex(i => Math.min(i + 1, pairs.length - 1));
  }
  async function markIncorrect() {
    if (!isHost || !winnerUid) return;
    await updatePlayerStats({ code, uid: winnerUid, delta: { incorrect: 1, points: 0 } });
    await clearBuzz({ code });
    // Allow rebound: host can reopen buzzer on same question
  }
  async function markStale() {
    if (!isHost) return;
    await clearBuzz({ code });
    setIndex(i => Math.min(i + 1, pairs.length - 1));
  }

  return (
    <BuzzerLayout>
      <div className="space-y-4">
        <div className="glass p-4 flex items-center justify-between">
          <div>
            <div className="text-sm opacity-70">Room</div>
            <div className="text-xl font-semibold">{code}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => navigate(`/buzzer/${code}`)}>Back</button>
            {isHost && (
              <>
                <button className={`btn ${game?.state?.buzzerOpen ? 'btn-orange' : 'btn-fancy'}`} onClick={() => setBuzzerOpen({ code, open: !game?.state?.buzzerOpen })}>
                  {game?.state?.buzzerOpen ? 'Close Buzzer' : 'Open Buzzer'}
                </button>
                <button className="btn btn-ghost" onClick={() => clearBuzz({ code })}>Clear</button>
              </>
            )}
          </div>
        </div>

        <div className="glass p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm opacity-75">Question {index + 1} / {pairs.length || 0}</div>
            <div className="flex gap-2">
              <button className="chip" onClick={() => setIndex(i => Math.max(0, i - 1))}>Prev</button>
              <button className="chip" onClick={() => setIndex(i => Math.min(pairs.length - 1, i + 1))}>Next</button>
            </div>
          </div>
          {loadingQuestions ? (
            <div className="opacity-70">Loading questions…</div>
          ) : cur ? (
            <div className="space-y-4">
              {cur.tossup && (
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-70">Toss-up • {cur.tossup.category}</div>
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap"><LatexRenderer>{cur.tossup.question}</LatexRenderer></div>
                </div>
              )}
              {cur.bonus && (
                <div className="mt-4 p-3 rounded-lg bg-black/5 dark:bg-white/10">
                  <div className="text-xs uppercase tracking-wide opacity-70">Bonus • {cur.bonus.category}</div>
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap"><LatexRenderer>{cur.bonus.question}</LatexRenderer></div>
                </div>
              )}
            </div>
          ) : (
            <div className="opacity-70">No question loaded.</div>
          )}

          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <div className="text-sm opacity-75">Winner: {winner ? (winner.displayName || winner.uid) : '—'}</div>
            {isHost && (
              <>
                <button className="btn btn-fancy" onClick={markCorrect} disabled={!winner}>Correct</button>
                <button className="btn btn-orange" onClick={markIncorrect} disabled={!winner}>Incorrect</button>
                <button className="btn btn-ghost" onClick={markStale}>Stale</button>
              </>
            )}
          </div>
        </div>

        <div className="glass p-6">
          <div className="font-semibold mb-2">Scores</div>
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {players.map(p => (
              <li key={p.uid} className="flex items-center justify-between rounded-lg bg-black/5 dark:bg-white/10 px-3 py-2">
                <span className="truncate pr-2">{p.displayName || p.uid}</span>
                <span className="font-semibold">{p.score || 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BuzzerLayout>
  );
}
