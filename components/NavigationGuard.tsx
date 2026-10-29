'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const GuardContext = createContext<{ register: (id: string, dirty: boolean) => void; request: (action: () => void) => void }>({ register: () => {}, request: (action) => action() });

export function useUnsavedChanges(dirty: boolean) {
  const id = useId();
  const { register, request } = useContext(GuardContext);
  useEffect(() => { register(id, dirty); return () => register(id, false); }, [dirty, id, register]);
  return request;
}

export default function NavigationGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const sources = useRef(new Set<string>());
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<(() => void) | null>(null);
  const [prompt, setPrompt] = useState(false);
  const register = useCallback((id: string, dirty: boolean) => { if (dirty) sources.current.add(id); else sources.current.delete(id); }, []);
  const request = useCallback((action: () => void) => {
    if (!sources.current.size) return action();
    pending.current = action; setPrompt(true);
  }, []);
  useEffect(() => { if (prompt) dialog.current?.showModal(); }, [prompt]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (sources.current.size) { event.preventDefault(); event.returnValue = ''; } };
    const navigate = (event: MouseEvent) => {
      if (!sources.current.size || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.download || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault(); event.stopPropagation();
      request(() => { document.querySelector<HTMLDialogElement>('.nav-drawer')?.close(); router.push(url.pathname + url.search + url.hash); });
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [request, router]);
  const cancel = () => { pending.current = null; dialog.current?.close(); setPrompt(false); };
  return <GuardContext.Provider value={{ register, request }}>{children}
    <dialog ref={dialog} className="action-dialog leave-dialog" aria-labelledby="leave-title" aria-describedby="leave-description" onCancel={cancel}>
      <h2 id="leave-title" className="section-title">尚有未儲存的內容</h2>
      <p id="leave-description" className="mt-3 leading-7">離開後，這次尚未儲存的修改將不會保留。可先留在頁面，確認並儲存。</p>
      <div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={cancel}>繼續編輯</button><button type="button" className="btn btn-danger" onClick={() => { const action = pending.current; sources.current.clear(); cancel(); action?.(); }}>捨棄修改並離開</button></div>
    </dialog>
  </GuardContext.Provider>;
}
