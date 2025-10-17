import { useEffect, useMemo, useRef, useState } from 'react';
import { getRoundsIndex, getRoundDetail, setUserRoundFolder, getRoundFolders, addRoundFolder, renameRoundFolder, deleteRoundFolder, renameUserRound, deleteUserRound } from '../../../data/rounds.firestore.js';

export function useUserRounds({ auth, pushToast }) {
  const [roundsIndex, setRoundsIndex] = useState([]);
  const [loadingUserRounds, setLoadingUserRounds] = useState(false);
  const [roundFolders, setRoundFolders] = useState([]);
  const [foldersOpen, setFoldersOpen] = useState(() => new Set());
  const [selectedExcludeRoundIds, setSelectedExcludeRoundIds] = useState([]);
  const excludeDetailCache = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!auth?.user) {
        setRoundsIndex([]);
        excludeDetailCache.current.clear();
        setRoundFolders([]);
        return;
      }
      setLoadingUserRounds(true);
      try {
        // Fresh index and folders
        const index = await getRoundsIndex(auth.user.uid).catch(() => []);
        if (!cancelled) setRoundsIndex(index);
        const folders = await getRoundFolders(auth.user.uid).catch(() => []);
        if (!cancelled) setRoundFolders(folders);
      } finally {
        if (!cancelled) setLoadingUserRounds(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [auth?.user?.uid]);

  async function handleExcludeRoundToggle(e, roundId) {
    const shift = e?.nativeEvent?.shiftKey || e?.shiftKey;
    // Build visible IDs list externally if needed; here we only support single toggle
    const isSelected = selectedExcludeRoundIds.includes(roundId);
    const willSelect = !isSelected;
    setSelectedExcludeRoundIds(prev => {
      const set = new Set(prev);
      if (isSelected) set.delete(roundId); else set.add(roundId);
      return Array.from(set);
    });
    if (willSelect && auth?.user && !excludeDetailCache.current.has(roundId)) {
      try {
        const det = await getRoundDetail(auth.user.uid, roundId);
        if (det) excludeDetailCache.current.set(roundId, det);
      } catch {}
    }
  }

  async function refresh() {
    if (!auth?.user) return;
    setLoadingUserRounds(true);
    try {
      setRoundsIndex(await getRoundsIndex(auth.user.uid, { force: true }));
      setRoundFolders(await getRoundFolders(auth.user.uid, { force: true }));
    } finally {
      setLoadingUserRounds(false);
    }
  }

  async function createFolder(name) {
    if (!auth?.user) return;
    if (!name?.trim()) { pushToast?.('Folder name cannot be empty.', 'error'); return; }
    const lower = name.toLowerCase();
    if (roundFolders.some(f => f.toLowerCase() === lower)) { pushToast?.('Folder already exists.', 'error'); return; }
    await addRoundFolder(auth.user.uid, name);
    setRoundFolders(f => [...f, name].sort((a,b)=>a.localeCompare(b)));
    setFoldersOpen(s => { const n = new Set(s); n.add(name); return n; });
    pushToast?.('Folder created.', 'success');
  }

  async function renameFolder(oldName, newName) {
    if (!auth?.user) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if (roundFolders.some(f => f.toLowerCase() === trimmed.toLowerCase())) { pushToast?.('Folder name already exists.', 'error'); return; }
    await renameRoundFolder(auth.user.uid, oldName, trimmed);
    setRoundFolders(f => f.map(x => x === oldName ? trimmed : x));
    setRoundsIndex(list => list.map(r => r.folder === oldName ? { ...r, folder: trimmed } : r));
    setFoldersOpen(s => { const n = new Set(s); if (n.has(oldName)) { n.delete(oldName); n.add(trimmed); } return n; });
    pushToast?.('Folder renamed.', 'success');
  }

  async function moveRoundsToFolder(ids, folder) {
    if (!auth?.user) return;
    for (const id of ids) { try { await setUserRoundFolder(auth.user.uid, id, folder); } catch {} }
    setRoundsIndex(list => list.map(r => ids.includes(r.id) ? { ...r, folder } : r));
    pushToast?.(folder ? `Moved ${ids.length} round(s) to ${folder}.` : `Cleared folder for ${ids.length} round(s).`, 'success');
  }

  async function renameRound(round, newTitle) {
    if (!auth?.user) return;
    const dup = roundsIndex.some(x => x.id !== round.id && (x.title||'').trim().toLowerCase() === newTitle.toLowerCase());
    if (dup) { pushToast?.('Another round already has that title.', 'error'); return; }
    await renameUserRound(auth.user.uid, round.id, newTitle);
    setRoundsIndex(list => list.map(x => x.id === round.id ? { ...x, title: newTitle } : x));
    const det = excludeDetailCache.current.get(round.id);
    if (det) excludeDetailCache.current.set(round.id, { ...det, title: newTitle });
  }

  async function deleteRoundPermanently(roundId) {
    if (!auth?.user) return;
    await deleteUserRound(auth.user.uid, roundId);
    setRoundsIndex(list => list.filter(x => x.id !== roundId));
    setSelectedExcludeRoundIds(ids => ids.filter(x => x !== roundId));
    excludeDetailCache.current.delete(roundId);
    pushToast?.('Round deleted.', 'error');
  }

  async function deleteFolderAndRounds(name, roundIds = []) {
    if (!auth?.user) return;
    for (const id of roundIds) { try { await deleteUserRound(auth.user.uid, id); } catch {} }
    try { await deleteRoundFolder(auth.user.uid, name); } catch {}
    setRoundsIndex(list => list.filter(r => !roundIds.includes(r.id)));
    setSelectedExcludeRoundIds(ids => ids.filter(id => !roundIds.includes(id)));
    // Remove folder from local list immediately
    setRoundFolders(f => f.filter(n => n !== name));
    pushToast?.('Folder and rounds deleted.', 'error');
  }

  return {
    roundsIndex,
    setRoundsIndex,
    loadingUserRounds,
    roundFolders,
    setRoundFolders,
    foldersOpen,
    setFoldersOpen,
    selectedExcludeRoundIds,
    setSelectedExcludeRoundIds,
    excludeDetailCache,
    handleExcludeRoundToggle,
    refresh,
    createFolder,
    renameFolder,
    moveRoundsToFolder,
    renameRound,
    deleteRoundPermanently,
    deleteFolderAndRounds,
  };
}
