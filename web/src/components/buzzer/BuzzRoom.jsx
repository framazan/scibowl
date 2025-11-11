import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuth from '../../data/useAuth.js';
import { attemptBuzz, clearBuzz, listenGame, setBuzzerOpen, transferHost, joinGame } from '../../data/buzzer.firestore.js';
import BuzzerLayout from '../layout/BuzzerLayout.jsx';
import Loading from '../layout/Loading.jsx';

export default function BuzzRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [busy, setBusy] = useState(false);
  const uid = auth?.user?.uid;

  useEffect(() => {
    if (!code) return;
    const unsub = listenGame({ code, onGame: setGame, onPlayers: setPlayers });
    return () => unsub && unsub();
  }, [code]);

  // Ensure non-host authenticated users appear in the players list (idempotent merge)
  useEffect(() => {
    if (!auth?.user || !code || !game) return;
    if (auth.user.uid === game.hostUid) return; // host should NOT be a player
    joinGame({ code, uid: auth.user.uid, displayName: auth.user.displayName || auth.user.email }).catch(() => {});
  }, [auth?.user, code, game]);

  const isHost = !!(game && uid && game.hostUid === uid);
  const winner = game?.state?.winnerUid ? players.find(p => p.uid === game.state.winnerUid) || { displayName: game.state.winnerName } : null;

  if (auth.loading || !game) return (
    <BuzzerLayout>
      <Loading />
    </BuzzerLayout>
  );
  if (!auth.user) return (
    <BuzzerLayout>
      <div className="glass p-6">Please sign in to access this room.</div>
    </BuzzerLayout>
  );

  async function onBuzz() {
    if (!game?.state?.buzzerOpen) return;
    setBusy(true);
    try {
      const res = await attemptBuzz({ code, uid, displayName: auth.user.displayName || auth.user.email });
      // no-op; UI will reflect via snapshot
    } finally { setBusy(false); }
  }

  return (
    <BuzzerLayout>
      <div className="space-y-6">
        <div className="glass p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm opacity-75">Room</div>
            <div className="text-2xl font-semibold tracking-tight">{code}</div>
            <div className="text-sm opacity-75">Host: {game?.hostUid === uid ? 'You' : (players.find(p=>p.uid===game?.hostUid)?.displayName || 'Unknown')}</div>
          </div>
          {isHost && (
            <div className="flex gap-2">
              <button
                className={`btn ${game?.state?.buzzerOpen ? 'btn-orange' : 'btn-fancy'}`}
                onClick={() => setBuzzerOpen({ code, open: !game?.state?.buzzerOpen, actorUid: uid })}
              >{game?.state?.buzzerOpen ? 'Close Buzzer' : 'Open Buzzer'}</button>
              <button className="btn btn-ghost" onClick={() => clearBuzz({ code })}>Clear</button>
              <button className="btn btn-primary" onClick={() => navigate(`/buzzer/${code}/generate`)}>Start Game</button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4 items-start">
          <div className="glass p-6 md:col-span-2 space-y-4 text-center">
            {winner ? (
              <div className="space-y-2">
                <div className="text-sm opacity-75">Buzz winner</div>
                <div className="text-3xl font-bold">{winner.displayName || 'Unknown'}</div>
              </div>
            ) : isHost ? (
              <div className="space-y-2">
                <div className="text-sm opacity-75">Buzzer status</div>
                <div className="text-2xl font-semibold">{game?.state?.buzzerOpen ? 'Open' : 'Closed'}</div>
                <div className="opacity-70 text-sm">Hosts don't buzz. Use the controls to open/close.</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm opacity-75">Press to buzz</div>
                <button
                  disabled={busy || !game?.state?.buzzerOpen}
                  onClick={onBuzz}
                  className={`inline-flex items-center justify-center w-56 h-56 rounded-full text-2xl font-bold shadow-lg transition ${game?.state?.buzzerOpen ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'} ${busy ? 'opacity-70' : ''}`}
                  aria-live="polite"
                >Buzz</button>
                {!game?.state?.buzzerOpen && <div className="text-sm opacity-75">Waiting for host to open buzzer…</div>}
              </div>
            )}
          </div>

          <div className="glass p-6 space-y-3">
            <div className="font-semibold">Players</div>
            <ul className="space-y-1">
              {players.map(p => (
                <li key={p.uid} className="flex items-center justify-between">
                  <span className="truncate pr-2">{p.displayName || p.uid}</span>
                  {isHost && p.uid !== game.hostUid && (
                    <button className="chip" onClick={() => transferHost({ code, newHostUid: p.uid })}>Make host</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </BuzzerLayout>
  );
}
