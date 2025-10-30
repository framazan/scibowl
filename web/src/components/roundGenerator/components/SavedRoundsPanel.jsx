import React from 'react';
import { RefreshCw, FolderPlus, Pencil, Trash2, ChevronRight, ChevronDown, Eye, ListX } from 'lucide-react';
import { addRoundFolder, renameRoundFolder, deleteRoundFolder, setUserRoundFolder, renameUserRound } from '../../../data/rounds.firestore.js';

export default function SavedRoundsPanel({
  auth,
  roundsIndex,
  setRoundsIndex,
  roundFolders,
  setRoundFolders,
  loadingUserRounds,
  refresh,
  selectedExcludeRoundIds,
  setSelectedExcludeRoundIds,
  foldersOpen,
  setFoldersOpen,
  handleExcludeRoundToggle,
  pushToast,
  setManagerSelection,
  setShowRoundsManager,
  setFolderDeleteTarget,
  setDeleteTarget,
  onViewRound,
}) {
  if (!auth?.user) return null;
  return (
    <div>
      <div className="font-semibold mb-2 flex items-center gap-2">Exclude rounds
        <button className="chip px-2 py-0.5 text-xs" title="Clear selection" onClick={() => setSelectedExcludeRoundIds([])}>
          <ListX size={16} />
        </button>
        <button className="chip px-2 py-0.5 text-xs inline-flex items-center" aria-label="Refresh rounds & folders" title="Refresh" onClick={refresh}>
          <RefreshCw size={14} />
        </button>
        <button
          className="chip px-2 py-0.5 text-xs inline-flex items-center"
          aria-label="Create folder"
          title="Create folder"
          onClick={async () => {
            if (!auth?.user) return;
            const nameRaw = window.prompt('Folder name');
            if (nameRaw == null) return;
            const name = nameRaw.trim();
            if (!name) { pushToast('Folder name cannot be empty.', 'error'); return; }
            const lower = name.toLowerCase();
            if (roundFolders.some(f => f.toLowerCase() === lower)) { pushToast('Folder already exists.', 'error'); return; }
            try {
              await addRoundFolder(auth.user.uid, name);
              setRoundFolders(f => [...f, name].sort((a,b)=>a.localeCompare(b)));
              setFoldersOpen(s => { const n = new Set(s); n.add(name); return n; });
              pushToast('Folder created.', 'success');
            } catch (e) {
              pushToast(e.message || 'Failed to create folder.', 'error');
            }
          }}
        >
          <FolderPlus size={14} />
        </button>
        <button
          className="chip px-2 py-0.5 text-xs inline-flex items-center"
          aria-label="Open rounds manager"
          title="Manage saved rounds"
          onClick={() => { setManagerSelection(new Set(selectedExcludeRoundIds)); setShowRoundsManager(true); }}
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {loadingUserRounds ? (
        <div className="text-sm opacity-70">Loading your rounds…</div>
      ) : roundsIndex.length === 0 ? (
        <div className="text-sm opacity-70">No saved rounds yet.</div>
      ) : (
        <div className="border rounded-lg max-h-64 overflow-y-auto overflow-x-hidden divide-y divide-black/10 dark:divide-white/10">
          {(() => {
            const visibleIds = [];
            const folderNodes = roundFolders.sort((a,b)=>a.localeCompare(b)).map(folder => {
              const open = foldersOpen.has(folder);
              const roundsInFolder = roundsIndex.filter(r => r.folder === folder);
              return (
                <div key={folder} className="select-none">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    onClick={() => setFoldersOpen(s => { const n = new Set(s); if (n.has(folder)) n.delete(folder); else n.add(folder); return n; })}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (!auth?.user) return;
                      const idsRaw = e.dataTransfer.getData('text/round-ids');
                      if (!idsRaw) return;
                      const ids = idsRaw.split(',').filter(Boolean);
                      for (const id of ids) { try { await setUserRoundFolder(auth.user.uid, id, folder); } catch {} }
                      setRoundsIndex(list => list.map(r => ids.includes(r.id) ? { ...r, folder } : r));
                      pushToast(`Moved ${ids.length} round(s) to ${folder}.`, 'success');
                    }}
                  >
                    <button type="button" className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10" aria-label={open ? 'Collapse folder' : 'Expand folder'}>
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <input
                      type="checkbox"
                      className="accent-tint"
                      ref={el => {
                        if (!el) return;
                        const rif = roundsIndex.filter(r => r.folder === folder);
                        const total = rif.length;
                        const selected = rif.filter(r => selectedExcludeRoundIds.includes(r.id)).length;
                        el.indeterminate = selected > 0 && selected < total;
                      }}
                      checked={(() => { const rif = roundsIndex.filter(r => r.folder === folder); return rif.length > 0 && rif.every(r => selectedExcludeRoundIds.includes(r.id)); })()}
                      onChange={() => {
                        const rif = roundsIndex.filter(r => r.folder === folder);
                        const allIds = rif.map(r => r.id);
                        setSelectedExcludeRoundIds(prev => {
                          const set = new Set(prev);
                          const allSelected = allIds.every(id => set.has(id));
                          if (allSelected) allIds.forEach(id => set.delete(id)); else allIds.forEach(id => set.add(id));
                          return Array.from(set);
                        });
                      }}
                      aria-label={`Select all rounds in folder ${folder}`}
                      title="Select all in folder"
                    />
                    <span className="font-medium flex-1 truncate" title={folder}>{folder} <span className="opacity-60 text-xs">({roundsInFolder.length})</span></span>
                    <button
                      type="button"
                      className="chip px-2 py-0.5 text-[11px] inline-flex items-center"
                      aria-label="Rename folder"
                      title="Rename folder"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newName = window.prompt('Rename folder', folder);
                        if (newName == null) return;
                        const trimmed = newName.trim();
                        if (!trimmed || trimmed === folder) return;
                        if (roundFolders.some(f => f.toLowerCase() === trimmed.toLowerCase())) { pushToast('Folder name already exists.', 'error'); return; }
                        (async () => {
                          try {
                            await renameRoundFolder(auth.user.uid, folder, trimmed);
                            setRoundFolders(f => f.map(x => x === folder ? trimmed : x));
                            setRoundsIndex(list => list.map(r => r.folder === folder ? { ...r, folder: trimmed } : r));
                            setFoldersOpen(s => { const n = new Set(s); if (n.has(folder)) { n.delete(folder); n.add(trimmed); } return n; });
                            pushToast('Folder renamed.', 'success');
                          } catch (err) { pushToast(err.message || 'Failed to rename folder.', 'error'); }
                        })();
                      }}
                    ><Pencil size={13} /></button>
                    <button
                      type="button"
                      className="chip px-2 py-0.5 text-[11px] inline-flex items-center text-red-600 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900/30"
                      aria-label="Delete folder and its rounds"
                      title="Delete folder"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rif = roundsIndex.filter(r => r.folder === folder);
                        setFolderDeleteTarget({ name: folder, count: rif.length, roundIds: rif.map(r=>r.id) });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {open && (
                    <ul className="divide-y divide-black/5 dark:divide-white/10" role="group">
                      {roundsInFolder.map(r => {
                        visibleIds.push(r.id);
                        const ts = r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000) : null;
                        const label = ts ? `${ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} on ${ts.toLocaleDateString()}` : (r.title || 'Untitled');
                        const checked = selectedExcludeRoundIds.includes(r.id);
                        return (
                          <li key={r.id} draggable
                            onDragStart={(e)=>{ 
                              e.dataTransfer.effectAllowed='move';
                              const batch = selectedExcludeRoundIds.includes(r.id) ? selectedExcludeRoundIds : [r.id];
                              e.dataTransfer.setData('text/round-ids', batch.join(','));
                            }}
                          >
                            <div className={`group flex items-center justify-between gap-2 pl-10 pr-3 py-2 ${checked ? 'bg-tint/10 ring-1 ring-tint' : ''}`}> 
                              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" title={r.title || `Round ${label}` }>
                                <input type="checkbox" checked={checked} onChange={(ev) => handleExcludeRoundToggle(ev, r.id)} />
                                <span className="block whitespace-normal overflow-visible group-hover:truncate group-focus-within:truncate">{r.title || `Round ${label}`}</span>
                              </label>
                              <button
                                type="button"
                                className="chip px-2 py-0.5 text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center"
                                aria-label="View round"
                                title="View round"
                                onClick={(e) => { e.stopPropagation(); onViewRound?.(r); }}
                              ><Eye size={13} /></button>
                              <button type="button" className="chip px-2 py-0.5 text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center" aria-label="Rename round" title="Rename round"
                                onClick={async (e)=>{
                                  e.stopPropagation();
                                  const current = r.title || `Round ${label}`;
                                  const newTitleRaw = window.prompt('Rename round', current);
                                  if (newTitleRaw == null) return;
                                  const newTitle = newTitleRaw.trim();
                                  if (!newTitle || newTitle === current) return;
                                  const dup = roundsIndex.some(x => x.id !== r.id && (x.title||'').trim().toLowerCase() === newTitle.toLowerCase());
                                  if (dup) { pushToast('Another round already has that title.', 'error'); return; }
                                  try {
                                    await renameUserRound(auth.user.uid, r.id, newTitle);
                                    setRoundsIndex(list => list.map(x => x.id === r.id ? { ...x, title: newTitle } : x));
                                  } catch (err) { window.alert?.(err?.message || 'Failed to rename round.'); }
                                }}><Pencil size={13} /></button>
                              <button
                                type="button"
                                className="chip px-2 py-0.5 text-xs shrink-0 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900/30"
                                title="Delete round"
                                onClick={(e)=>{ e.stopPropagation(); setDeleteTarget(r); }}
                              ><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            });
            const unfiled = roundsIndex.filter(r => !r.folder);
            const unfiledNode = (
              <div
                key="__unfiled__"
                className="select-none"
                onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
                onDrop={async (e)=>{
                  e.preventDefault();
                  if (!auth?.user) return;
                  const idsRaw = e.dataTransfer.getData('text/round-ids');
                  if (!idsRaw) return;
                  const ids = idsRaw.split(',').filter(Boolean);
                  for (const id of ids) { try { await setUserRoundFolder(auth.user.uid, id, ''); } catch {} }
                  setRoundsIndex(list => list.map(r => ids.includes(r.id) ? (()=>{ const { folder: _omit, ...rest } = r; return rest; })() : r));
                  pushToast(`Cleared folder for ${ids.length} round(s).`, 'success');
                }}
              >
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/10 font-medium">Unfiled <span className="opacity-60 text-xs">({unfiled.length})</span></div>
                <ul className="divide-y divide-black/5 dark:divide-white/10" role="group">
                  {unfiled.map(r => {
                    visibleIds.push(r.id);
                    const ts = r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000) : null;
                    const label = ts ? `${ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} on ${ts.toLocaleDateString()}` : (r.title || 'Untitled');
                    const checked = selectedExcludeRoundIds.includes(r.id);
                    return (
                      <li key={r.id} draggable onDragStart={(e)=>{ e.dataTransfer.effectAllowed='move'; const batch = selectedExcludeRoundIds.includes(r.id) ? selectedExcludeRoundIds : [r.id]; e.dataTransfer.setData('text/round-ids', batch.join(',')); }}>
                        <div className={`group flex items-center justify-between gap-2 pl-6 pr-3 py-2 ${checked ? 'bg-tint/10 ring-1 ring-tint' : ''}`}>
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" title={r.title || `Round ${label}` }>
                            <input type="checkbox" checked={checked} onChange={(ev) => handleExcludeRoundToggle(ev, r.id)} />
                            <span className="block whitespace-normal overflow-visible group-hover:truncate group-focus-within:truncate">{r.title || `Round ${label}`}</span>
                          </label>
                          <button
                            type="button"
                            className="chip px-2 py-0.5 text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center"
                            aria-label="View round"
                            title="View round"
                            onClick={(e) => { e.stopPropagation(); onViewRound?.(r); }}
                          ><Eye size={13} /></button>
                          <button type="button" className="chip px-2 py-0.5 text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center" aria-label="Rename round" title="Rename round"
                            onClick={async (e)=>{
                              e.stopPropagation();
                              const current = r.title || `Round ${label}`;
                              const newTitleRaw = window.prompt('Rename round', current);
                              if (newTitleRaw == null) return;
                              const newTitle = newTitleRaw.trim();
                              if (!newTitle || newTitle === current) return;
                              const dup = roundsIndex.some(x => x.id !== r.id && (x.title||'').trim().toLowerCase() === newTitle.toLowerCase());
                              if (dup) { pushToast('Another round already has that title.', 'error'); return; }
                              try {
                                await renameUserRound(auth.user.uid, r.id, newTitle);
                                setRoundsIndex(list => list.map(x => x.id === r.id ? { ...x, title: newTitle } : x));
                              } catch (err) { window.alert?.(err?.message || 'Failed to rename round.'); }
                            }}><Pencil size={13} /></button>
                          <button
                            type="button"
                            className="chip px-2 py-0.5 text-xs shrink-0 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900/30"
                            title="Delete round"
                            onClick={(e)=>{ e.stopPropagation(); setDeleteTarget(r); }}
                          ><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
            return <>{folderNodes}{unfiledNode}</>;
          })()}
        </div>
      )}
    </div>
  );
}
