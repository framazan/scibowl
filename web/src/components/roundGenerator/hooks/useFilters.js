import { useEffect, useMemo, useRef, useState } from 'react';
import { unique } from '../utils/helpers.js';

export function useFilters({ questions = [], lazy = null }) {
  const isLazy = !!lazy;
  const [selectedTournaments, setSelectedTournaments] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [tournamentGroupsOpen, setTournamentGroupsOpen] = useState(() => new Set());

  // Sorted tournament list
  const tournaments = useMemo(() => {
    const list = isLazy ? (lazy.tournaments || []) : unique(questions.map(q => q.tournament));
    return [...list].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
  }, [isLazy, lazy, questions]);

  // Shift-range selection support for tournament list (main and modal)
  const tournamentVisibleEntriesMainRef = useRef([]);
  const tournamentVisibleEntriesModalRef = useRef([]);
  const lastTournamentClickIndexMainRef = useRef(null);
  const lastTournamentClickIndexModalRef = useRef(null);

  function handleTournamentToggle(e, key, ctx = 'main') {
    const shift = e?.nativeEvent?.shiftKey || e?.shiftKey;
    const entries = (ctx === 'modal' ? tournamentVisibleEntriesModalRef.current : tournamentVisibleEntriesMainRef.current) || [];
    const idx = entries.findIndex(en => en?.type === 'key' && en.key === key);
    const isSelected = selectedTournaments.includes(key);
    const willSelect = !isSelected;
    const lastRef = ctx === 'modal' ? lastTournamentClickIndexModalRef : lastTournamentClickIndexMainRef;
    if (shift && lastRef.current != null && idx !== -1 && lastRef.current !== idx) {
      const [start, end] = [lastRef.current, idx].sort((a,b)=>a-b);
      const slice = entries.slice(start, end + 1);
      const rangeKeys = [];
      const groupsWithChildKeys = new Set(
        slice.filter(en => en && en.type === 'key' && en.base).map(en => en.base)
      );
      slice.forEach(en => {
        if (!en) return;
        if (en.type === 'key' && en.key) {
          rangeKeys.push(en.key);
        } else if (en.type === 'group' && Array.isArray(en.keys)) {
          if (!groupsWithChildKeys.has(en.base)) {
            en.keys.forEach(k => rangeKeys.push(k));
          }
        }
      });
      setSelectedTournaments(prev => {
        const set = new Set(prev);
        if (willSelect) rangeKeys.forEach(k => set.add(k)); else rangeKeys.forEach(k => set.delete(k));
        return Array.from(set);
      });
      lastRef.current = idx;
    } else {
      setSelectedTournaments(prev => {
        const set = new Set(prev);
        if (isSelected) set.delete(key); else set.add(key);
        return Array.from(set);
      });
      lastRef.current = idx;
    }
  }

  // Group tournaments by base (prefix before '-') and collect years
  const tournamentGroups = useMemo(() => {
    const groups = new Map();
    for (const t of tournaments) {
      if (!t) continue;
      const [base, yearPart] = String(t).split('-');
      const baseKey = base || t;
      const year = yearPart && /\d{4}/.test(yearPart) ? yearPart : null;
      if (!groups.has(baseKey)) groups.set(baseKey, { base: baseKey, years: [], all: [] });
      const g = groups.get(baseKey);
      g.all.push(t);
      if (year) g.years.push({ label: t, year: Number(year) || year, key: t }); else g.years.push({ label: t, year: null, key: t });
    }
    for (const g of groups.values()) {
      g.years.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    }
    return Array.from(groups.values()).sort((a, b) => a.base.localeCompare(b.base));
  }, [tournaments]);

  // Load selected tournaments on demand
  useEffect(() => {
    if (!isLazy) return;
    if (selectedTournaments.length === 0) return;
    lazy.ensureLoaded(selectedTournaments);
  }, [isLazy, lazy, selectedTournaments]);

  // Questions loaded for the current selection (or empty if none selected)
  const loadedQuestions = useMemo(() => (
    (isLazy ? lazy.getLoadedQuestions(selectedTournaments) : questions)
      .map(q => {
        let cat = q.category;
        if (typeof cat === 'string') {
          const trimmed = cat.trim();
          cat = trimmed ? trimmed.toUpperCase() : null;
        }
        return { ...q, category: cat };
      })
  ), [isLazy, lazy, selectedTournaments, questions]);

  // Filter out empty / null categories everywhere else
  const validQuestions = useMemo(() => loadedQuestions.filter(q => q.category != null && String(q.category).trim() !== ''), [loadedQuestions]);

  const categories = useMemo(() => unique(validQuestions.map(q => q.category)), [validQuestions]);

  // Start with no explicit round ranges; selecting tournaments alone doesn't auto-create a range.
  const [roundRanges, setRoundRanges] = useState([]);

  const roundsByTournament = useMemo(() => {
    const m = new Map();
    const source = loadedQuestions;
    for (const q of source) {
      const t = q.tournament;
      const r = q.round;
      if (t == null || r == null) continue;
      const list = m.get(t) ?? [];
      const rs = String(r);
      if (!list.includes(rs)) list.push(rs);
      m.set(t, list);
    }
    const out = {};
    for (const [t, arr] of m.entries()) {
      out[t] = [...arr].sort((a, b) => String(a).localeCompare(String(b)));
    }
    return out;
  }, [loadedQuestions]);

  const globalNumericRoundMax = useMemo(() => {
    let max = 0;
    for (const q of loadedQuestions) {
      const r = q.round;
      if (r != null && /^\d+$/.test(String(r))) {
        const n = Number(r);
        if (n > max) max = n;
      }
    }
    return max || 30;
  }, [loadedQuestions]);

  // When narrowed to exactly one tournament, normalize roundRanges to that tournament
  useEffect(() => {
    if (selectedTournaments.length === 1) {
      const only = selectedTournaments[0];
      setRoundRanges(ranges => {
        let changed = false;
        const next = ranges.map(r => {
          if (r.tournament !== only) { changed = true; return { ...r, tournament: only }; }
          return r;
        });
        return changed ? next : ranges;
      });
    }
  }, [selectedTournaments]);

  function inRanges(q) {
    if (!roundRanges.length || q?.round == null) return true;
    return roundRanges.some(({ from, to, tournament: rrT, dFrom, dTo }) => {
      const effectiveTournament = selectedTournaments.length === 1
        ? selectedTournaments[0]
        : (rrT || null);
      const matchT = !effectiveTournament || q.tournament === effectiveTournament;
      if (!matchT) return false;

      if (effectiveTournament) {
        const order = roundsByTournament[effectiveTournament] ?? [];
        const allNumeric = order.length > 0 && order.every(x => /^\d+$/.test(x));
        if (allNumeric) {
          const rNum = Number(q.round);
          return rNum >= Number(from) && rNum <= Number(to);
        } else {
          if (!order.length) return true;
          const idx = order.indexOf(String(q.round));
          if (idx === -1) return false;
          const start = dFrom ? order.indexOf(dFrom) : 0;
          const end = dTo ? order.indexOf(dTo) : order.length - 1;
          const [lo, hi] = [start, end].sort((a, b) => a - b);
          return idx >= lo && idx <= hi;
        }
      }
      const rNum = Number(q.round);
      if (Number.isNaN(rNum)) return false;
      return rNum >= Number(from) && rNum <= Number(to);
    });
  }

  return {
    isLazy,
    tournaments,
    tournamentGroups,
    selectedTournaments,
    setSelectedTournaments,
    selectedCategories,
    setSelectedCategories,
    tournamentGroupsOpen,
    setTournamentGroupsOpen,
    tournamentVisibleEntriesMainRef,
    tournamentVisibleEntriesModalRef,
    lastTournamentClickIndexMainRef,
    lastTournamentClickIndexModalRef,
    handleTournamentToggle,
    loadedQuestions,
    validQuestions,
    categories,
    roundRanges,
    setRoundRanges,
    roundsByTournament,
    globalNumericRoundMax,
    inRanges,
  };
}
