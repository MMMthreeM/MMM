'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { rankSearchOptions } from '@/lib/material-catalog';

export type SearchOption = { value: string; label: string; detail?: string; keywords?: string };
export default function SearchSelect({ label, value, options, onChange, emptyLabel = '全部', placeholder = '輸入名稱或關鍵字', disabled = false, valueLabel }: { label: string; value: string; options: SearchOption[]; onChange: (value: string) => void; emptyLabel?: string; placeholder?: string; disabled?: boolean; valueLabel?: string }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [active, setActive] = useState(0);
  const matching = rankSearchOptions(options, query);
  const pageCount = Math.max(1, Math.ceil(matching.length / 8));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = matching.slice(currentPage * 8, (currentPage + 1) * 8);
  const selected = options.find((option) => option.value === value);
  const choose = (next: string) => { onChange(next); setOpen(false); setQuery(''); };
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <div className="search-select" ref={root}>
    <label className="form-label" htmlFor={`${id}-input`}>{label}</label>
    <div className="search-select-control"><input id={`${id}-input`} ref={input} className="form-control" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && visible[active] ? `${id}-option-${active}` : undefined} value={open ? query : selected?.label || valueLabel || ''} placeholder={value ? selected?.label || valueLabel : emptyLabel || placeholder} disabled={disabled}
      onFocus={() => { setOpen(true); setQuery(''); setPage(0); setActive(0); }}
      onChange={(event) => { setQuery(event.target.value); setPage(0); setActive(0); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { setOpen(false); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          if (event.key === 'ArrowDown' && active === visible.length - 1 && currentPage + 1 < pageCount) { setPage(currentPage + 1); setActive(0); }
          else if (event.key === 'ArrowUp' && active === 0 && currentPage > 0) { setPage(currentPage - 1); setActive(7); }
          else setActive((index) => Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && open) { event.preventDefault(); if (visible[active]) choose(visible[active].value); }
        if (event.key === 'Tab') setOpen(false);
      }} />
      {value && !disabled && <button type="button" className="search-clear" aria-label={`清除${label}`} onClick={() => { choose(''); input.current?.focus(); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>}
    </div>
    {open && <div className="search-select-popup"><p className="search-select-help">輸入多個關鍵字縮小範圍，共 {matching.length} 筆</p>{emptyLabel && <button type="button" className="search-all" onClick={() => choose('')}>{emptyLabel}</button>}
      <ul id={`${id}-list`} role="listbox" aria-label={`${label}搜尋結果`}>{visible.map((option, index) => <li key={option.value} role="option" id={`${id}-option-${index}`} aria-selected={value === option.value} className={index === active ? 'is-active' : ''} onMouseEnter={() => setActive(index)}><button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)}><span>{option.label}</span>{option.detail && <small>{option.detail}</small>}</button></li>)}</ul>
      {!matching.length && <p className="p-4 text-sm text-[var(--muted)]">找不到符合的材料，請換一組關鍵字。</p>}
      {pageCount > 1 && <div className="search-result-pages"><button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setActive(0); }}>上一頁</button><span>{currentPage + 1} / {pageCount}</span><button type="button" disabled={currentPage + 1 === pageCount} onClick={() => { setPage(currentPage + 1); setActive(0); }}>下一頁</button></div>}
    </div>}
  </div>;
}
