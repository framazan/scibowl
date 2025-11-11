import React from 'react';
import { getFirestoreDb } from '../firebase';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import LatexRenderer from './LatexRenderer.jsx';
import { isVisualBonus } from '../data/visualBonuses.js';
import { parseMCChoices } from './roundGenerator/utils/helpers.js';
import Loading from './layout/Loading.jsx';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  const [editableTournaments, setEditableTournaments] = React.useState([]);
  const [savingTournaments, setSavingTournaments] = React.useState(false);
  const [tournamentListCollapsed, setTournamentListCollapsed] = React.useState(true);
  const [questionGroupsCollapsed, setQuestionGroupsCollapsed] = React.useState(true);
  const [individualQuestionCollapsed, setIndividualQuestionCollapsed] = React.useState({});

  const canEdit = !!auth?.user && auth.user.uid === ADMIN_UID;

  const groupedQuestions = React.useMemo(() => {
    if (!roundDoc) return [];
    const tossups = roundDoc.tossups || [];
    const bonuses = roundDoc.bonuses || [];
    const groups = new Map();
    
    // Add tossups
    tossups.forEach((q, idx) => {
      const num = q.question_number || idx + 1;
      if (!groups.has(num)) groups.set(num, { question_number: num, tossup: null, bonuses: [] });
      groups.get(num).tossup = { ...q, originalIndex: idx };
    });
    
    // Add bonuses
    bonuses.forEach((q, idx) => {
      const num = q.question_number || idx + 1;
      if (!groups.has(num)) groups.set(num, { question_number: num, tossup: null, bonuses: [] });
      groups.get(num).bonuses.push({ ...q, originalIndex: idx });
    });
    
    // Sort by question number
    return Array.from(groups.values()).sort((a, b) => (a.question_number || 0) - (b.question_number || 0));
  }, [roundDoc]);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // tournaments list from meta doc
        const meta = await getDoc(doc(db, 'meta', 'tournaments'));
        const list = meta.exists() ? (meta.data()?.list || []) : [];
        setTournaments(list);
        setEditableTournaments([...list]);
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

  async function saveTournaments() {
    if (!canEdit) return;
    try {
      setSavingTournaments(true); setError(null);
      const mref = doc(db, 'meta', 'tournaments');
      await updateDoc(mref, { list: editableTournaments });
      setTournaments([...editableTournaments]);
      alert('Tournament list saved.');
    } catch (e) { console.error(e); setError(e); alert('Save failed: ' + (e.message || String(e))); }
    finally { setSavingTournaments(false); }
  }

  function addTournament(name) {
    if (name.trim() && !editableTournaments.includes(name.trim())) {
      setEditableTournaments(prev => [...prev, name.trim()]);
    }
  }

  function removeTournament(name) {
    setEditableTournaments(prev => prev.filter(t => t !== name));
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
      <div className="glass p-4">
        <div className={`flex items-center justify-between ${tournamentListCollapsed ? '' : 'mb-3'}`}>
          <h2 className="font-semibold">Tournament List</h2>
          <button
            type="button"
            onClick={() => setTournamentListCollapsed(!tournamentListCollapsed)}
            className="btn btn-ghost p-1"
            title={tournamentListCollapsed ? 'Expand' : 'Collapse'}
          >
            {tournamentListCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
        {!tournamentListCollapsed && (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {editableTournaments.map(t => (
                <div key={t} className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded px-3 py-1">
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => removeTournament(t)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove tournament"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New tournament name"
                className="flex-1 rounded border p-2 bg-white dark:bg-darkcard"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    addTournament(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector('input[placeholder="New tournament name"]');
                  if (input) {
                    addTournament(input.value);
                    input.value = '';
                  }
                }}
                className="btn btn-ghost"
              >
                Add
              </button>
              <button className="btn btn-primary" onClick={saveTournaments} disabled={savingTournaments}>
                {savingTournaments ? 'Saving...' : 'Save List'}
              </button>
            </div>
          </div>
        )}
      </div>

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
        {roundDoc && (
          <button
            type="button"
            onClick={() => {
              const newCollapsed = !questionGroupsCollapsed;
              setQuestionGroupsCollapsed(newCollapsed);
              // Reset individual collapse states when using global toggle
              if (newCollapsed) {
                setIndividualQuestionCollapsed({});
              }
            }}
            className="btn btn-ghost"
            title={questionGroupsCollapsed ? 'Expand All' : 'Collapse All'}
          >
            {questionGroupsCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
        )}
        {loading && <Loading className="text-sm opacity-70" />}
        {error && <span className="text-sm text-red-600">{String(error.message || error)}</span>}
      </div>

      {!roundDoc ? (
        <div className="glass p-6">Select a tournament and round.</div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-all duration-300 ease-in-out">
          {groupedQuestions.map((group) => (
            <QuestionGroup 
              key={group.question_number} 
              group={group} 
              onChange={updateQuestion} 
              globalCollapsed={questionGroupsCollapsed}
              individualCollapsed={individualQuestionCollapsed[group.question_number]}
              onToggleIndividual={(questionNumber) => {
                setIndividualQuestionCollapsed(prev => ({
                  ...prev,
                  [questionNumber]: prev[questionNumber] !== undefined ? !prev[questionNumber] : !questionGroupsCollapsed
                }));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionGroup({ group, onChange, globalCollapsed, individualCollapsed, onToggleIndividual }) {
  const { question_number, tossup, bonuses } = group;
  const isCollapsed = individualCollapsed !== undefined ? individualCollapsed : globalCollapsed;
  return (
    <div className={`glass transition-all duration-300 ease-in-out ${
      isCollapsed ? 'p-2' : 'p-4 col-span-full'
    }`}>
      <div className={`flex items-center justify-between ${!isCollapsed ? 'mb-3' : ''}`}>
        <h2 className={`font-semibold transition-all duration-300 ease-in-out dark:text-white ${
          isCollapsed ? 'text-sm' : 'text-base'
        }`}>Question #{question_number}</h2>
        <button
          type="button"
          onClick={() => onToggleIndividual(question_number)}
          className={`btn btn-ghost transition-all duration-300 ease-in-out ${
            isCollapsed ? 'p-0.5' : 'p-1'
          }`}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!isCollapsed && (
        <div className="grid gap-4">
          {tossup && (
            <div className="rounded border border-black/10 dark:border-white/10 p-3">
              <div className="text-sm opacity-70 mb-2">Toss-up • {tossup.category ?? '—'}</div>
              <label className="block mb-2">
                <div className="text-xs uppercase tracking-wide mb-1">Question</div>
                <textarea className="w-full min-h-[120px] rounded border p-2 bg-white dark:bg-darkcard" value={tossup.question || ''} onChange={e => onChange('tossups', tossup.originalIndex, 'question', e.target.value)} />
              </label>
              <label className="block mb-2">
                <div className="text-xs uppercase tracking-wide mb-1">Answer</div>
                <textarea className="w-full min-h-[60px] rounded border p-2 bg-white dark:bg-darkcard" value={tossup.answer || ''} onChange={e => onChange('tossups', tossup.originalIndex, 'answer', e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs uppercase tracking-wide mb-1">Category</div>
                  <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={tossup.category || ''} onChange={e => onChange('tossups', tossup.originalIndex, 'category', e.target.value)} />
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide mb-1">Question Number</div>
                  <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={tossup.question_number ?? ''} onChange={e => onChange('tossups', tossup.originalIndex, 'question_number', e.target.value)} />
                </label>
              </div>
              {parseMCChoices(tossup).length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {(() => {
                    const choices = parseMCChoices(tossup);
                    const choiceMap = new Map(choices);
                    return ['w','x','y','z'].map(k => (
                      <label key={k} className="block">
                        <div className="text-xs uppercase tracking-wide mb-1">{k.toUpperCase()}</div>
                        <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={choiceMap.get(k) || ''}
                          onChange={e => {
                            const v = e.target.value;
                            const currentChoices = parseMCChoices(tossup);
                            const newChoices = currentChoices.filter(([key]) => key !== k);
                            if (v.trim()) newChoices.push([k, v.trim()]);
                            const choicesObj = {};
                            newChoices.forEach(([key, val]) => choicesObj[key] = val);
                            onChange('tossups', tossup.originalIndex, 'choices', choicesObj);
                          }} />
                      </label>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
          {bonuses.map((bonus, bidx) => (
            <div key={bidx} className="rounded border border-black/10 dark:border-white/10 p-3">
              <div className="text-sm opacity-70 mb-2">Bonus • {bonus.category ?? '—'}</div>
              <label className="block mb-2">
                <div className="text-xs uppercase tracking-wide mb-1">Question</div>
                <textarea className="w-full min-h-[120px] rounded border p-2 bg-white dark:bg-darkcard" value={bonus.question || ''} onChange={e => onChange('bonuses', bonus.originalIndex, 'question', e.target.value)} />
              </label>
              <label className="block mb-2">
                <div className="text-xs uppercase tracking-wide mb-1">Answer</div>
                <textarea className="w-full min-h-[60px] rounded border p-2 bg-white dark:bg-darkcard" value={bonus.answer || ''} onChange={e => onChange('bonuses', bonus.originalIndex, 'answer', e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs uppercase tracking-wide mb-1">Category</div>
                  <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={bonus.category || ''} onChange={e => onChange('bonuses', bonus.originalIndex, 'category', e.target.value)} />
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide mb-1">Question Number</div>
                  <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={bonus.question_number ?? ''} onChange={e => onChange('bonuses', bonus.originalIndex, 'question_number', e.target.value)} />
                </label>
              </div>
              {parseMCChoices(bonus).length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {(() => {
                    const choices = parseMCChoices(bonus);
                    const choiceMap = new Map(choices);
                    return ['w','x','y','z'].map(k => (
                      <label key={k} className="block">
                        <div className="text-xs uppercase tracking-wide mb-1">{k.toUpperCase()}</div>
                        <input className="w-full rounded border p-2 bg-white dark:bg-darkcard" value={choiceMap.get(k) || ''}
                          onChange={e => {
                            const v = e.target.value;
                            const currentChoices = parseMCChoices(bonus);
                            const newChoices = currentChoices.filter(([key]) => key !== k);
                            if (v.trim()) newChoices.push([k, v.trim()]);
                            const choicesObj = {};
                            newChoices.forEach(([key, val]) => choicesObj[key] = val);
                            onChange('bonuses', bonus.originalIndex, 'choices', choicesObj);
                          }} />
                      </label>
                    ));
                  })()}
                </div>
              )}
              <div className="mt-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-tint"
                    checked={(() => {
                      if (bonus && (bonus.visual != null || bonus.is_visual_bonus != null)) {
                        const v = bonus.visual ?? bonus.is_visual_bonus;
                        if (v === true) return true;
                        const s = String(v ?? '').trim().toLowerCase();
                        return s === 'true' || s === '1' || s === 'yes' || s === 'y';
                      }
                      return isVisualBonus(bonus);
                    })()}
                    onChange={e => {
                      const checked = e.target.checked;
                      const value = checked ? 'true' : '';
                      onChange('bonuses', bonus.originalIndex, 'visual', value);
                    }}
                  />
                  <span className="text-sm">Visual bonus</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
