import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenPublicRooms, listenUserActiveRooms, createRoom as createRoomRtdb, joinRoom as joinRoomRtdb, findRoomByNameOrCode as findRoomByNameOrCodeRtdb } from '../../data/multiplayer.rtdb.js';
import useAuth from '../../data/useAuth.js';
import Layout from '../layout/Layout.jsx';
import Loading from '../layout/Loading.jsx';
import { MultiplayerSEO } from '../SEO.jsx';

export default function MultiplayerLanding() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const setRoomsStable = React.useCallback((newRooms) => {
    setRooms(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newRooms)) return prev;
      return newRooms;
    });
  }, []);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [joinQuery, setJoinQuery] = useState('');
  const [joinPass, setJoinPass] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    const unsub = listenPublicRooms({ onRooms: setRoomsStable });
    return () => unsub();
  }, [setRoomsStable]);

  // Active sessions for signed-in users
  useEffect(() => {
    if (!auth?.user?.uid) return;
    const unsub = listenUserActiveRooms({ uid: auth.user.uid, onRooms: setActiveRooms });
    return () => unsub();
  }, [auth?.user?.uid]);

  async function onCreate(e) {
    e?.preventDefault();
    if (!auth?.user) { navigate('/signin'); return; }
    setCreating(true); setError('');
    try {
      // Trim inputs and enforce passcode for private rooms
      const trimmedName = (name || '').trim();
      const trimmedPass = (passcode || '').trim();
      if (isPrivate && !trimmedPass) {
        throw new Error('Passcode is required for private rooms');
      }
      const roomId = await createRoomRtdb({
        name: trimmedName || 'Room',
        isPrivate,
        passcode: isPrivate ? trimmedPass : '',
      });
      // Auto-join: include passcode so private room join does not fail
      await joinRoomRtdb({ roomId, passcode: isPrivate ? trimmedPass : undefined });
      navigate(`/multiplayer/${roomId}`);
    } catch (e) {
      setError(e?.message || String(e));
    } finally { setCreating(false); }
  }

  async function onJoinSubmit(e) {
    e?.preventDefault();
    setJoinBusy(true); setError('');
    try {
      const q = (joinQuery || '').trim();
      if (!q) throw new Error('Enter a room name or code');
      const room = await findRoomByNameOrCodeRtdb({ queryText: q });
      if (!room) throw new Error('Room not found');
      // Navigate to the room; pass the passcode in navigation state so the room page can avoid prompting again
      navigate(`/multiplayer/${room.id}`, { state: { passcode: (joinPass || '').trim() } });
    } catch (e) {
      setError(e?.message || String(e));
    } finally { setJoinBusy(false); }
  }

  return (
    <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop">
      <Layout auth={auth}>
        <MultiplayerSEO />
        {auth.loading ? (
          <Loading />
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="glass p-6 space-y-3">
              <h1 className="text-xl font-semibold">Multiplayer</h1>
              <p className="text-sm opacity-80">Join a public room or create your own. Private rooms require a passcode.</p>
              {/* Join existing room by name or code */}
              <form onSubmit={onJoinSubmit} className="grid sm:grid-cols-4 gap-2 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-sm opacity-75 mb-1">Room name or code</label>
                  <input className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard w-full" value={joinQuery} onChange={(e)=>setJoinQuery(e.target.value)} placeholder="e.g., Friday Practice or ABC123" />
                </div>
                {/* spacer to align passcode on right column, mirroring create row layout */}
                <div className="hidden sm:block" />
                <div>
                  <label className="block text-sm opacity-75 mb-1">Passcode (if required)</label>
                  <input className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard w-full" value={joinPass} onChange={(e)=>setJoinPass(e.target.value)} placeholder="Room passcode" />
                </div>
                <div className="sm:col-span-4 flex gap-2">
                  <button className="btn btn-primary" type="submit" disabled={joinBusy || !joinQuery}>{joinBusy ? 'Joining…' : 'Join room'}</button>
                </div>
              </form>

              {/* Create room explanation */}
              <div className="text-sm opacity-80">
                Create a new room to practice live buzzing. Share the code to invite others, or keep it public for everyone to see. Set a passcode to keep it private.
              </div>

              {(() => {
                const disabled = !auth?.user;
                const blurCls = disabled ? 'opacity-60 pointer-events-none' : '';
                const hint = disabled ? 'Sign in to create rooms' : '';
                return (
                  <form onSubmit={onCreate} className="grid sm:grid-cols-4 gap-2 items-end" aria-disabled={disabled} title={hint}>
                    <div className="sm:col-span-2">
                      <label className="block text-sm opacity-75 mb-1">Room name</label>
                      <input className={`rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard w-full ${blurCls}`} value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g., Friday Practice" disabled={disabled} />
                    </div>
                    <div className={`flex items-center gap-2 ${blurCls}`}>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={isPrivate} onChange={(e)=>setIsPrivate(e.target.checked)} disabled={disabled} /> Private
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm opacity-75 mb-1">Passcode {isPrivate ? '' : '(optional)'}</label>
                      <input className={`rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-darkcard w-full ${blurCls}`} value={passcode} onChange={(e)=>setPasscode(e.target.value)} disabled={disabled || !isPrivate} placeholder="Set a passcode" />
                    </div>
                    <div className="sm:col-span-4 flex gap-2 items-center">
                      <button className={`btn btn-fancy ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} type="submit" disabled={disabled || creating || (isPrivate && !passcode)}>{creating ? 'Creating…' : 'Create room'}</button>
                      {disabled && (
                        <span className="text-xs opacity-80">Sign in to create a room</span>
                      )}
                      {error && <div className="text-sm text-red-600">{error}</div>}
                    </div>
                  </form>
                );
              })()}
            </div>

            {auth?.user && (
              <div className="glass p-6 space-y-3">
                <h2 className="text-lg font-semibold">Active sessions</h2>
                {activeRooms.length === 0 ? (
                  <div className="opacity-70 text-sm">No active rooms yet.</div>
                ) : (
                  <ul className="divide-y divide-black/5 dark:divide-white/10">
                    {activeRooms.map(r => (
                      <li key={r.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.name || r.id}</div>
                          <div className="text-sm opacity-70">{(r.memberCount || 0)} online • Active {new Date(r.lastActiveAt||r.createdAt||0).toLocaleString()}</div>
                        </div>
                        <button className="btn btn-primary" onClick={()=>navigate(`/multiplayer/${r.id}`)}>Rejoin</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="glass p-6 space-y-3">
              <h2 className="text-lg font-semibold">Public rooms</h2>
              {rooms.length === 0 ? (
                <div className="opacity-70 text-sm">No public rooms right now.</div>
              ) : (
                <ul className="divide-y divide-black/5 dark:divide-white/10">
                  {rooms.map(r => (
                    <li key={r.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.name || r.id}</div>
                        <div className="text-sm opacity-70">{(r.memberCount || 0)} online</div>
                      </div>
                      <button className="btn btn-primary" onClick={()=>navigate(`/multiplayer/${r.id}`)}>Join</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Layout>
    </div>
  );
}
