import React from 'react';
import { getFirestoreDb } from '../firebase';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import LatexRenderer from './LatexRenderer.jsx';
import { isVisualBonus } from '../data/visualBonuses.js';

const ADMIN_UID = 'fkLJJ2R6HbdwqoXSxrLUybZ0IdH2';

export default function Admin({ auth }) {
  const db = React.useMemo(() => getFirestoreDb(), []);
  const [tournaments, setTournaments] = React.useState([]);
  const [selectedT, setSelectedT] = React.useState('');
  const [rounds, setRounds] = React.useState([]);
  const [selectedR, setSelectedR] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [roundDoc, setRoundDoc] = React.useState(null); // { tossups:[], bonuses:[] }
  const [saving, setSaving] = React.useState(false);

  const canEdit = !!auth?.user && auth.user.uid === ADMIN_UID;

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // tournaments list from meta doc
        const meta = await getDoc(doc(db, 'meta', 'tournaments'));
        const list = meta.exists() ? (meta.data()?.list || []) : [];
        setTournaments(list);
      } catch (e) { setError(e); }
      finally { setLoading(false); }
    })();
  }, [db]);

  React.useEffect(() => {
    (async () => {
      if (!selectedT) { setRounds([]); setSelectedR(''); return; }
      try {
        setLoading(true); setError(null);
        const col = collection(db, 'tournaments', selectedT, 'rounds');
        const snap = await getDocs(col);
        const list = [];
        snap.forEach(d => list.push(d.id));
        list.sort((a,b) => String(a).localeCompare(String(b)));
        setRounds(list);
        // auto select first
        if (list.length && !selectedR) setSelectedR(list[0]);
      } catch (e) { setError(e); }
      finally { setLoading(false); }
    })();
  }, [db, selectedT]);

  React.useEffect(() => {
    (async () => {
      if (!selectedT || !selectedR) { setRoundDoc(null); return; }
      try {
        setLoading(true); setError(null);
        const rref = doc(db, 'tournaments', selectedT, 'rounds', selectedR);
        const rs = await getDoc(rref);
        setRoundDoc(rs.exists() ? rs.data() : { tossups: [], bonuses: [] });
      } catch (e) { setError(e); setRoundDoc(null); }
      finally { setLoading(false); }
    })();
  }, [db, selectedT, selectedR]);

  async function saveChanges() {
    if (!canEdit || !selectedT || !selectedR || !roundDoc) return;
    try {
      setSaving(true); setError(null);
      const rref = doc(db, 'tournaments', selectedT, 'rounds', selectedR);
      // Only update modified fields (simple approach: update whole arrays)
      const payload = {};
      if (Array.isArray(roundDoc.tossups)) payload['tossups'] = roundDoc.tossups;
      if (Array.isArray(roundDoc.bonuses)) payload['bonuses'] = roundDoc.bonuses;
      await updateDoc(rref, payload);
      alert('Saved.');
    } catch (e) { console.error(e); setError(e); alert('Save failed: ' + (e.message || String(e))); }
    finally { setSaving(false); }
  }

  function updateQuestion(type, idx, field, value) {
    setRoundDoc(prev => {
      const next = { ...(prev || {}) };
      const arr = Array.isArray(next[type]) ? [...next[type]] : [];
      const q = { ...(arr[idx] || {}) };
      q[field] = value;
      arr[idx] = q;
      next[type] = arr;
      return next;
    });
  }

  if (!auth?.user) return <div className="glass p-6">Please sign in.</div>;
  if (!canEdit) return <div className="glass p-6 text-red-600">Access denied. Admins only.</div>;

  return (
    <div className="grid gap-4">
      <div className="glass p-4 flex flex-wrap gap-3 items-center">
        <div>
          <div className="text-sm font-semibold mb-1">Tournament</div>
          <select className="select" value={selectedT} onChange={e => setSelectedT(e.target.value)}>
            <option value="">Select tournament…</option>
            {tournaments.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div className="text-sm font-semibold mb-1">Round</div>
          <select className="select" value={selectedR} onChange={e => setSelectedR(e.target.value)} disabled={!selectedT}>
            <option value="">Select round…</option>
            {rounds.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={saveChanges} disabled={!roundDoc || saving}>Save</button>
        {loading && <span className="text-sm opacity-70">Loading…</span>}
        {error && <span className="text-sm text-red-600">{String(error.message || error)}</span>}
      </div>

      {!roundDoc ? (
        <div className="glass p-6">Select a tournament and round.</div>
      ) : (
        <div className="grid gap-4">
          <EditorSection type="tossups" data={roundDoc.tossups || []} onChange={updateQuestion} />
          <EditorSection type="bonuses" data={roundDoc.bonuses || []} onChange={updateQuestion} />
        </div>
      )}
    </div>
  );
}

function EditorSection({ type, data, onChange }) {
  const title = type === 'tossups' ? 'Toss-ups' : 'Bonuses';
  return (
    <div className="glass p-4">
      <h2 className="font-semibold mb-3">{title} ({data.length})</h2>
      <div className="grid gap-4">
        {data.map((q, idx) => (
          <div key={idx} className="rounded border border-black/10 dark:border-white/10 p-3">
            <div className="text-sm opacity-70 mb-2">#{q?.question_number ?? idx+1} • {q?.category ?? '—'}</div>
            <label className="block mb-2">
              <div className="text-xs uppercase tracking-wide mb-1">Question</div>
              <textarea className="w-full min-h-[120px] rounded border p-2 bg-white dark:bg-darkcard" value={q?.question || ''} onChange={e => onChange(type, idx, 'question', e.target.value)} />
            </label>
            <label className="block mb-2">
              <div className="text-xs uppercase tracking-wide mb-1">Answer</div>
              <textarea className="w-full min-h-[60px] rounded border p-2 bg-white dark:bg-darkcard" value={q?.answer || ''} onChange={e => onChange(type, idx, 'answer', e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs uppercase tracking-wide mb-1">Category</div>
                <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={q?.category || ''} onChange={e => onChange(type, idx, 'category', e.target.value)} />
              </label>
              <label className="block">
                <div className="text-xs uppercase tracking-wide mb-1">Question Number</div>
                <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={q?.question_number ?? ''} onChange={e => onChange(type, idx, 'question_number', e.target.value)} />
              </label>
            </div>
            {type === 'bonuses' && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {['w','x','y','z'].map(k => (
                  <label key={k} className="block">
                    <div className="text-xs uppercase tracking-wide mb-1">{k.toUpperCase()}</div>
                    <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={q?.choices?.[k] ?? q?.[k] ?? ''}
                      onChange={e => {
                        const v = e.target.value;
                        // keep both shapes minimal: place into choices map
                        const choices = { ...(q?.choices || {}) };
                        choices[k] = v;
                        onChange(type, idx, 'choices', choices);
                      }} />
                  </label>
                ))}
              </div>
            )}
            {type === 'bonuses' && (
              <div className="mt-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-tint"
                    checked={(() => {
                      // Use robust detection as default if explicit flag absent
                      if (q && (q.visual != null || q.is_visual_bonus != null)) {
                        const v = q.visual ?? q.is_visual_bonus;
                        if (v === true) return true;
                        const s = String(v ?? '').trim().toLowerCase();
                        return s === 'true' || s === '1' || s === 'yes' || s === 'y';
                      }
                      return isVisualBonus(q);
                    })()}
                    onChange={e => {
                      // Persist as string 'true' for compatibility with existing frontend logic
                      const checked = e.target.checked;
                      const value = checked ? 'true' : '';
                      onChange(type, idx, 'visual', value);
                    }}
                  />
                  <span className="text-sm">Visual bonus</span>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
