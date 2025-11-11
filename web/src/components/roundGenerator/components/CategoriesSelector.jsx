import React from 'react';
import { ListX, CheckSquare, ArrowRightLeft } from 'lucide-react';

export default function CategoriesSelector({
  categories,
  selectedCategories,
  setSelectedCategories,
}) {
  return (
    <div>
      <div className="font-semibold mb-2 flex items-center gap-2">Categories
        <button className="chip px-2 py-0.5 text-xs" title="Clear selection" onClick={() => setSelectedCategories([])}>
          <ListX size={16} />
        </button>
        <button className="chip px-2 py-0.5 text-xs" title="Select all" onClick={() => setSelectedCategories(categories)}>
          <CheckSquare size={16} />
        </button>
        <button className="chip px-2 py-0.5 text-xs" title="Invert selection" onClick={() => setSelectedCategories(prev => categories.filter(c => !prev.includes(c)))}>
          <ArrowRightLeft size={16} />
        </button>
      </div>
      <div className="rounded-lg max-h-56 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-wrap gap-2 min-w-0 p-2">
          {categories.map((c) => {
            const active = selectedCategories.includes(c);
            return (
              <label key={c} className={`chip cursor-pointer ${active ? 'ring-1 ring-tint bg-tint/10' : ''}`} title={c}>
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={active}
                  onChange={() => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                />
                <span className="truncate max-w-[12rem] inline-block align-middle">{c}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}