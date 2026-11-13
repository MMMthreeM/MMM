'use client';
import { useEffect, useRef } from 'react';

export default function FilterPanel({ children, count = 0, collapsed=false }: { children: React.ReactNode; count?: number; collapsed?: boolean }) {
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const update = () => { if (panel.current) panel.current.open = !collapsed&&!mobile.matches; };
    update(); mobile.addEventListener('change', update);
    return () => mobile.removeEventListener('change', update);
  }, [collapsed]);
  return <details ref={panel} className="surface filter-panel" open={!collapsed}><summary><span>篩選與排序{count ? `（${count} 項條件）` : ''}</span><span className="filter-toggle" aria-hidden="true" /></summary>{children}</details>;
}
