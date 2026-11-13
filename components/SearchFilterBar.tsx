'use client';
import { useId, useRef, useState, type ReactNode } from 'react';

export default function SearchFilterBar({ label, search, count = 0, children }: { label: string; search: ReactNode; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId(), trigger = useRef<HTMLButtonElement>(null);
  return <div className="search-filter-bar" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <div className="form-label">{label}</div>
    <div className="search-filter-field">{search}<button ref={trigger} type="button" className={`search-filter-trigger ${count ? 'has-filters' : ''}`} title="進階篩選" aria-label="進階篩選" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" /></svg>
      {count > 0 && <span className="filter-active-dot" aria-hidden="true" />}<span className="sr-only">{count ? `已套用 ${count} 項條件` : ''}</span>
    </button></div>
    <div id={id} className="surface search-filter-panel" hidden={!open} role="region" aria-label="進階篩選條件">{children}</div>
  </div>;
}
