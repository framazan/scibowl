import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({
  searchInput,
  setSearchInput,
  committedSearch,
  setCommittedSearch,
  hasGenerated = false,
}) {
  return (
    <div>
      <div className="font-semibold mb-2 flex items-center gap-2">Search
        {committedSearch && (
          <button
            type="button"
            className="chip px-2 py-0.5 text-xs"
            onClick={() => { setSearchInput(''); setCommittedSearch(''); }}
            aria-label="Clear search"
          >Clear</button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-black/50 dark:text-white/50 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setCommittedSearch(searchInput); }}
            placeholder="Find text in generated round..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Search questions"
            disabled={!hasGenerated}
          />
        </div>
        <button
          type="button"
            className="btn btn-sm btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!hasGenerated || !searchInput.trim() || searchInput.trim() === committedSearch.trim()}
          onClick={() => setCommittedSearch(searchInput)}
        >Search</button>
      </div>
      {committedSearch.trim() && (
        <div className="text-xs mt-1 opacity-70">Showing all matches containing "{committedSearch}" (ignores other filters except selected tournaments for loading).</div>
      )}
    </div>
  );
}
