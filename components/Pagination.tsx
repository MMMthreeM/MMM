'use client';
import { useState } from 'react';

export function usePagination<T>(items: T[], scope: string, size = 10) {
  const [cursor, setCursor] = useState({ scope, page: 1 });
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = cursor.scope === scope ? Math.min(cursor.page, pages) : 1;
  return { page, pages, total: items.length, size, items: items.slice((page - 1) * size, page * size), onChange: (next: number) => setCursor({ scope, page: Math.max(1, Math.min(next, pages)) }) };
}

export default function Pagination({ page, pages, total, size, onChange, label = '清單', targetId }: { page: number; pages: number; total: number; size: number; onChange: (page: number) => void; label?: string; targetId?: string }) {
  if (total <= size) return null;
  const move = (next: number) => {
    onChange(next);
    if (targetId) requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  };
  return <nav className="pagination" aria-label={`${label}分頁`}><p aria-live="polite">第 {(page - 1) * size + 1}–{Math.min(page * size, total)} 筆，共 {total} 筆</p><div><button type="button" className="btn btn-secondary" disabled={page === 1} onClick={() => move(page - 1)}>上一頁</button><label><span className="sr-only">頁碼</span><select aria-label={`${label}頁碼`} value={page} onChange={(event) => move(Number(event.target.value))}>{Array.from({ length: pages }, (_, index) => <option value={index + 1} key={index}>第 {index + 1} / {pages} 頁</option>)}</select></label><button type="button" className="btn btn-secondary" disabled={page === pages} onClick={() => move(page + 1)}>下一頁</button></div></nav>;
}
