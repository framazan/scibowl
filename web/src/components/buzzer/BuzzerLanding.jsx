import React, { useState, useEffect } from 'react';
import useAuth from '../../data/useAuth.js';
import { createGame, joinGame } from '../../data/buzzer.firestore.js';
import { useNavigate } from 'react-router-dom';
import { getFirestore, onSnapshot, query, collection, where, deleteDoc, doc } from 'firebase/firestore';
import BuzzerLayout from '../layout/BuzzerLayout.jsx';
import Loading from '../layout/Loading.jsx';

export default function BuzzerLanding() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hostingGames, setHostingGames] = useState([]);
  const [playingGames, setPlayingGames] = useState([]);

  useEffect(() => {
    if (!auth.user) return;
    const db = getFirestore();
    const hostingQuery = query(collection(db, 'games'), where('hostUid', '==', auth.user.uid));
    const hostingUnsub = onSnapshot(hostingQuery, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHostingGames(games);
    });
    const playingQuery = query(collection(db, 'games'), where('players', 'array-contains', auth.user.uid));
    const playingUnsub = onSnapshot(playingQuery, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlayingGames(games);
    });
    return () => {
      hostingUnsub();
      playingUnsub();
    };
  }, [auth.user]);

  if (auth.loading) return (
    <BuzzerLayout>
      <Loading />
    </BuzzerLayout>
  );
  if (!auth.user) {
    return (
      <BuzzerLayout>
        <div className="glass p-6 max-w-lg mx-auto text-center space-y-4">
          <h1 className="text-2xl font-semibold">Buzzer</h1>
          <p>Please sign in to host or join a game.</p>
          <button className="btn btn-primary" onClick={() => navigate('/signin')}>Sign in</button>
        </div>
      </BuzzerLayout>
    );
  }

  async function onCreate() {
    setLoading(true); setError('');
    try {
      const c = await createGame({ hostUid: auth.user.uid, hostName: auth.user.displayName || auth.user.email });
      navigate(`/buzzer/${c}`);
    } catch (e) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  async function onJoin(e) {
    e?.preventDefault();
    const c = (code || '').trim().toUpperCase();
    if (!c) return;
    setLoading(true); setError('');
    try {
      await joinGame({ code: c, uid: auth.user.uid, displayName: auth.user.displayName || auth.user.email });
      navigate(`/buzzer/${c}`);
    } catch (e) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  async function endGame(gameId) {
    if (!confirm('Are you sure you want to end this game? This action cannot be undone.')) return;
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'games', gameId));
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  return (
    <BuzzerLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="glass p-6 space-y-3">
          <h1 className="text-xl font-semibold">Host a Game</h1>
          <p className="text-sm opacity-80">Create a room and share the code with players.</p>
          <button className="btn btn-fancy" onClick={onCreate} disabled={loading}>Create Game</button>
        </div>
        <div className="glass p-6 space-y-3">
          <h2 className="text-lg font-semibold">Join a Game</h2>
          <form onSubmit={onJoin} className="flex gap-2">
            <input
              type="text"
              inputMode="text"
              pattern="[A-Za-z0-9]{4,8}"
              maxLength={8}
              placeholder="Enter code"
              value={code}
              onChange={(e)=>setCode(e.target.value.toUpperCase())}
              className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard flex-1"
            />
            <button type="submit" className="btn btn-fancy" disabled={loading || !code}>Join</button>
          </form>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
        {(hostingGames.length > 0 || playingGames.length > 0) && (
          <div className="glass p-6 space-y-3">
            <h2 className="text-lg font-semibold">Active Games</h2>
            {hostingGames.length > 0 && (
              <div>
                <h3 className="text-md font-medium">Hosting</h3>
                <ul className="space-y-1">
                  {hostingGames.map(game => (
                    <li key={game.id} className="flex justify-between items-center">
                      <span>Room {game.id} ({game.players ? game.players.length : 0} players)</span>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-rejoin" onClick={() => navigate(`/buzzer/${game.id}`)}>Rejoin</button>
                        <button className="btn btn-sm btn-red" onClick={() => endGame(game.id)}>End Game</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {playingGames.length > 0 && (
              <div>
                <h3 className="text-md font-medium">Playing</h3>
                <ul className="space-y-1">
                  {playingGames.map(game => (
                    <li key={game.id} className="flex justify-between items-center">
                      <span>Room {game.id} ({game.players ? game.players.length : 0} players)</span>
                      <button className="btn btn-sm btn-rejoin" onClick={() => navigate(`/buzzer/${game.id}`)}>Rejoin</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </BuzzerLayout>
  );
}
