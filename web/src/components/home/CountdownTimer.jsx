import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { getFirestoreDb } from '../../firebase.js';
// Background is rendered in Home.jsx so no background import here

// Helper: compute time parts from ms
function getTimeParts(ms) {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}


// Small label for unit with subtle animation on change
function TimeBlock({ value, label }) {
  return (
    <div className="relative">
      <div className="rounded-2xl px-5 sm:px-6 py-4 sm:py-5 text-center bg-white/25 dark:bg-black/25 backdrop-blur-sm border border-white/30 dark:border-white/20 shadow-lg">
        <div className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#121930] dark:text-white tabular-nums">
          {pad2(value)}
        </div>
        <div className="mt-1 text-xs sm:text-sm uppercase tracking-wider text-black/60 dark:text-white/60">{label}</div>
      </div>
      {/* decorative glow */}
      <div className="absolute -inset-0.5 -z-10 rounded-3xl bg-gradient-to-tr from-fuchsia-500/30 via-sky-500/30 to-emerald-500/30 blur-xl" />
    </div>
  );
}

export default function CountdownTimer() {
  const [target, setTarget] = useState(null); // Date
  const [tournamentName, setTournamentName] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  // Fetch nearest upcoming countdown timestamp
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const db = getFirestoreDb();
        const snap = await getDocs(collection(db, 'countdowns'));
        const events = [];
        snap.forEach((doc) => {
          const data = doc.data();
          let t = data?.time;
          // Firestore Timestamp -> ms
          if (t && typeof t.toMillis === 'function') t = t.toMillis();
          // If stored as seconds or string
          if (typeof t === 'string') {
            const parsed = Date.parse(t);
            if (!Number.isNaN(parsed)) t = parsed;
          }
          if (typeof t === 'number') {
            // If seconds, convert to ms
            if (t < 1e12) t = t * 1000;
            events.push({
              timeMs: t,
              name: typeof data?.name === 'string' && data.name.trim() ? data.name.trim() : doc.id,
            });
          }
        });

        const upcoming = events
          .filter((e) => e.timeMs > Date.now())
          .sort((a, b) => a.timeMs - b.timeMs)[0] || null;

        if (!cancelled) {
          setTarget(upcoming ? new Date(upcoming.timeMs) : null);
          setTournamentName(upcoming ? upcoming.name : '');
        }
      } catch (e) {
        console.error('Failed to load countdowns:', e);
        if (!cancelled) {
          setTarget(null);
          setTournamentName('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tick each second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = useMemo(() => (target ? Math.max(0, target.getTime() - now) : 0), [target, now]);
  const { days, hours, minutes, seconds } = useMemo(() => getTimeParts(diff), [diff]);

  if (loading) return null; // avoid layout shift on first paint
  if (!target) return null; // no upcoming events -> no banner

  return (
    <section id="countdown" className="relative mx-auto max-w-6xl px-3 sm:px-4 pt-4 sm:pt-6 md:pt-10 pb-8 sm:pb-10">
      <div className="relative grid place-items-center text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30 px-3 py-1 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs sm:text-sm font-medium text-[#121930] dark:text-white">next tournament starts in</span>
        </div>

        <div className="flex flex-col items-center gap-5 sm:gap-6">
          <div className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-4 md:gap-6">
            <TimeBlock value={days} label={days === 1 ? 'day' : 'days'} />
            <TimeBlock value={hours} label={hours === 1 ? 'hour' : 'hours'} />
            <TimeBlock value={minutes} label={minutes === 1 ? 'minute' : 'minutes'} />
            <TimeBlock value={seconds} label={seconds === 1 ? 'second' : 'seconds'} />
          </div>

          <div className="text-xs sm:text-sm text-black/70 dark:text-white/70">
            until <span className="font-semibold text-[#121930] dark:text-white">{tournamentName}</span> — {target.toLocaleString()}
          </div>
        </div>
      </div>
    </section>
  );
}
