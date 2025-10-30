import React from 'react';
import { ChevronUp, ChevronDown, Maximize2, List, ListX, CheckSquare } from 'lucide-react';
import isMsTournament from '../utils/isMsTournament.js';

export default function TournamentSelector({
  tournaments,
  tournamentGroups,
  selectedTournaments,
  setSelectedTournaments,
  tournamentGroupsOpen,
  setTournamentGroupsOpen,
  handleTournamentToggle,
  tournamentVisibleEntriesMainRef,
  isDark,
  showTournamentModal,
  setShowTournamentModal,
}) {
  return (
    <div>
      <div className="font-semibold mb-2 flex items-center flex-wrap gap-2">Tournaments
        <button
          className="chip px-2 py-0.5 text-xs"
          title="Clear selection"
          onClick={() => setSelectedTournaments([])}
        >
          <ListX size={16} />
        </button>
        <button
          className="chip px-2 py-0.5 text-xs"
          title="Select all"
          onClick={() => setSelectedTournaments((tournaments || []).filter(t => !isMsTournament(t)))}
        >
          <CheckSquare size={16} />
        </button>
        <button
          className="chip px-2 py-0.5 text-xs inline-flex items-center gap-1"
          aria-label="Expand tournament list"
          title="Expand to modal"
          onClick={() => setShowTournamentModal(true)}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <div className="border rounded-lg max-h-56 overflow-y-auto overflow-x-hidden">
        <ul role="tree" className="divide-y divide-black/5 dark:divide-white/10">
          {(() => {
            const entries = [];
            const nodes = tournamentGroups.map(group => {
              const isExpandable = group.all.length > 1;
              const isOpen = isExpandable && tournamentGroupsOpen.has(group.base);
              const allSelected = group.all.every(t => selectedTournaments.includes(t));
              const someSelected = !allSelected && group.all.some(t => selectedTournaments.includes(t));
              let groupStyle = {};
              if (isExpandable) {
                const selectedCount = group.all.filter(t => selectedTournaments.includes(t)).length;
                const ratio = group.all.length > 0 ? selectedCount / group.all.length : 0;
                const eased = Math.pow(ratio, 0.85);
                const hue = 120 * eased;
                if (selectedCount > 0) {
                  if (isDark) {
                    const darkLightness = 28 + (eased * 8);
                    const darkSaturation = 60;
                    groupStyle = { backgroundColor: `hsl(${hue.toFixed(0)} ${darkSaturation}% ${darkLightness}%)`, color: '#fff' };
                  } else {
                    const lightLightness = 92 - (eased * 8);
                    const lightSaturation = 70;
                    groupStyle = { backgroundColor: `hsl(${hue.toFixed(0)} ${lightSaturation}% ${lightLightness}%)` };
                  }
                }
              }
              if (!isExpandable) {
                const onlyKey = group.all[0];
                const active = selectedTournaments.includes(onlyKey);
                entries.push({ type: 'key', key: onlyKey, base: group.base });
                return (
                  <li key={group.base} role="treeitem" className="select-none">
                    <label
                      className={
                        `flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer min-w-0 ` +
                        (active
                          ? 'bg-blue-100 dark:bg-blue-900/40'
                          : 'hover:bg-black/5 dark:hover:bg-white/10')
                      }
                    >
                      <span className="inline-block w-5 shrink-0" aria-hidden="true" />
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          className="accent-tint"
                          checked={active}
                          onChange={(ev) => handleTournamentToggle(ev, onlyKey, 'main')}
                        />
                        <span className="font-medium truncate min-w-0" title={onlyKey}>{onlyKey}</span>
                      </div>
                    </label>
                  </li>
                );
              }
              return (
                <li key={group.base} role="treeitem" aria-expanded={isOpen} className="select-none">
                  <div
                    className={
                      'flex items-center gap-2 px-2 py-1.5 rounded min-w-0 ' +
                      (isExpandable ? 'transition-colors ' : '') +
                      (!isExpandable ? 'hover:bg-black/5 dark:hover:bg-white/10' : (someSelected || allSelected ? '' : 'hover:bg-black/5 dark:hover:bg-white/10'))
                    }
                    style={groupStyle}
                  >
                    {isExpandable && (
                      <button
                        type="button"
                        className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                        onClick={() => setTournamentGroupsOpen(s => { const n = new Set(s); if (n.has(group.base)) n.delete(group.base); else n.add(group.base); return n; })}
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                      >
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                    <input
                      type="checkbox"
                      className="accent-tint"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={(e) => {
                        const checked = e.target.checked || someSelected;
                        setSelectedTournaments(prev => {
                          const set = new Set(prev);
                          if (checked) group.all.forEach(t => set.add(t)); else group.all.forEach(t => set.delete(t));
                          return Array.from(set);
                        });
                      }}
                    />
                    <span className="font-medium truncate" title={group.base}>{`${group.base} (${group.all.length})`}</span>
                  </div>
                  {(() => { entries.push({ type: 'group', base: group.base, keys: group.all }); return null; })()}
                  {isOpen && (
                    <ul role="group" className="pl-10 py-1 overflow-x-hidden min-w-0">
                      {group.years.map(item => {
                        const active = selectedTournaments.includes(item.key);
                        entries.push({ type: 'key', key: item.key, base: group.base });
                        return (
                          <li key={item.key} role="treeitem" aria-selected={active} className="px-2 min-w-0 text-xs">
                            <label
                              className={
                                `flex items-center gap-2 px-2 py-1 rounded cursor-pointer min-w-0 ` +
                                (active
                                  ? 'bg-blue-100 dark:bg-blue-900/40'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10')
                              }
                            >
                              <input
                                type="checkbox"
                                className="accent-tint"
                                checked={active}
                                onChange={(ev) => handleTournamentToggle(ev, item.key, 'main')}
                              />
                              <span className="truncate min-w-0" title={item.label}>{item.label}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            });
            tournamentVisibleEntriesMainRef.current = entries;
            return nodes;
          })()}
        </ul>
      </div>

      {showTournamentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTournamentModal(false)} />
          <div className="relative bg-white dark:bg-darkcard rounded-lg shadow-xl max-w-3xl w-full p-6 space-y-4 border border-black/10 dark:border-white/10 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Select Tournaments</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTournamentModal(false)}>Close</button>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <button
                className="chip px-2 py-0.5 text-xs"
                title="Clear selection"
                onClick={() => setSelectedTournaments([])}
              >
                <ListX size={16} />
              </button>
              <button
                className="chip px-2 py-0.5 text-xs"
                title="Select all"
                onClick={() => setSelectedTournaments((tournaments || []).filter(t => !isMsTournament(t)))}
              >
                <CheckSquare size={16} />
              </button>
              <button
                className="chip px-2 py-0.5 text-xs inline-flex items-center gap-1"
                aria-label="Expand all groups"
                title="Expand all groups"
                onClick={() => setTournamentGroupsOpen(new Set(tournamentGroups.filter(g => g.all.length > 1).map(g => g.base)))}
              >
                <List size={15} />
                <ChevronDown size={15} />
              </button>
              <button
                className="chip px-2 py-0.5 text-xs inline-flex items-center gap-1"
                aria-label="Collapse all groups"
                title="Collapse all groups"
                onClick={() => setTournamentGroupsOpen(new Set())}
              >
                <List size={15} />
                <ChevronUp size={15} />
              </button>
            </div>
            <div className="border rounded-lg max-h-[65vh] overflow-y-auto overflow-x-hidden">
              <ul role="tree" className="divide-y divide-black/5 dark:divide-white/10">
                {(() => {
                  const entries = [];
                  const nodes = tournamentGroups.map(group => {
                    const isExpandable = group.all.length > 1;
                    const isOpen = isExpandable && tournamentGroupsOpen.has(group.base);
                    const allSelected = group.all.every(t => selectedTournaments.includes(t));
                    const someSelected = !allSelected && group.all.some(t => selectedTournaments.includes(t));
                    return (
                      <li key={group.base} role="treeitem" aria-expanded={isOpen} className="select-none">
                        <div className={'flex items-center gap-2 px-2 py-1.5 rounded min-w-0 ' + (isExpandable ? 'transition-colors ' : '')}>
                          {isExpandable && (
                            <button
                              type="button"
                              className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                              onClick={() => setTournamentGroupsOpen(s => { const n = new Set(s); if (n.has(group.base)) n.delete(group.base); else n.add(group.base); return n; })}
                              aria-label={isOpen ? 'Collapse' : 'Expand'}
                            >
                              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                          <input
                            type="checkbox"
                            className="accent-tint"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected; }}
                            onChange={(e) => {
                              const checked = e.target.checked || someSelected;
                              setSelectedTournaments(prev => {
                                const set = new Set(prev);
                                if (checked) group.all.forEach(t => set.add(t)); else group.all.forEach(t => set.delete(t));
                                return Array.from(set);
                              });
                            }}
                          />
                          <span className="font-medium truncate" title={group.base}>{`${group.base} (${group.all.length})`}</span>
                        </div>
                        {isOpen && (
                          <ul role="group" className="pl-10 py-1 overflow-x-hidden min-w-0">
                            {group.years.map(item => {
                              const active = selectedTournaments.includes(item.key);
                              entries.push({ type: 'key', key: item.key, base: group.base });
                              return (
                                <li key={item.key} role="treeitem" aria-selected={active} className="px-2 min-w-0 text-xs">
                                  <label className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer min-w-0 ${active ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
                                    <input type="checkbox" className="accent-tint" checked={active} onChange={(ev) => handleTournamentToggle(ev, item.key, 'modal')} />
                                    <span className="truncate min-w-0" title={item.label}>{item.label}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  });
                  return nodes;
                })()}
              </ul>
            </div>
          </div>
        </div>
      )}
      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400"> * Select All does not include MS rounds.</div>
    </div>
  );
}
