'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Account } from '@/lib/order-view';
import ReportIssueButton from '@/components/ReportIssueButton';

const AccountContext = createContext<Account | null>(null);
export function useAccount() { return useContext(AccountContext); }

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const [storedAccount, setAccount] = useState<Account | null>(null);
  const account = storedAccount?.email.toLowerCase() === session?.user?.email?.toLowerCase() ? storedAccount : null;
  const [error, setError] = useState('');
  const menu = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (status !== 'authenticated') return;
    const controller = new AbortController();
    fetch('/api/me', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '無法取得帳號權限。');
      setAccount(body.account); setError('');
    }).catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [status, session?.user?.email]);
  const links = [
    ...(account?.role === 'Admin' ? [{ href: '/', label: '管理首頁' }, { href: '/admin', label: '審核中心' }] : []),
    { href: '/request', label: '建立訂單' }, { href: '/dashboard', label: '歷史需求單' },
    { href: account?.role === 'Admin' ? '/analytics' : '/', label: '儀表板' },
  ];
  return <AccountContext.Provider value={account}>
    <div className="app-shell">
      <header className="app-topbar" id="app-top" tabIndex={-1}><div className="app-topbar-inner">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" /><span className="brand-copy">材料需求管理<small>MAINTENANCE MATERIALS</small></span></Link>
        {account && status === 'authenticated' && <div className="flex min-w-0 items-center gap-3"><span className="hidden text-sm text-[var(--muted)] sm:block">{account.role === 'Admin' ? '管理者' : account.company} · {account.name}</span><button type="button" className="menu-button" aria-label="開啟主要選單" aria-haspopup="dialog" onClick={() => menu.current?.showModal()}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span>選單</span></button></div>}
      </div></header>
      {status === 'loading' || (status === 'authenticated' && !account && !error) ? <div className="page-frame" role="status">正在確認登入資訊…</div>
        : status === 'unauthenticated' ? <main className="page-frame login-frame"><section className="surface p-7 sm:p-9"><h1 className="page-title">材料需求管理</h1><p className="page-subtitle leading-7">建立需求、追蹤進度，掌握工班的材料使用情況。</p><p className="mt-6 text-sm leading-7 text-[var(--muted)]">請使用已登錄的 Google 帳號登入，系統會依照您的工班與權限提供對應功能。</p><button className="btn btn-primary mt-7 w-full" onClick={() => signIn('google', { callbackUrl: '/' })}>使用 Google 帳號登入</button></section></main>
          : error ? <div className="page-frame"><p role="alert" className="feedback-error">{error}</p><div className="mt-4 flex gap-3"><button className="btn btn-secondary" onClick={() => window.location.reload()}>重新整理</button><button className="btn btn-quiet" onClick={() => signOut({ callbackUrl: '/' })}>登出</button></div></div>
            : pathname.startsWith('/admin') && account?.role !== 'Admin' ? <div className="page-frame"><h1 className="page-title">此頁面僅供管理者使用</h1><Link href="/" className="btn btn-primary mt-5">返回工班儀表板</Link></div> : children}
      {account && status === 'authenticated' && <ReportIssueButton />}
      <dialog ref={menu} className="nav-drawer" aria-labelledby="menu-title" onClick={(event) => { if (event.target === menu.current) menu.current?.close(); }}>
        <div className="flex items-center justify-between gap-4"><h2 id="menu-title" className="section-title">工作選單</h2><button className="btn btn-quiet" onClick={() => menu.current?.close()} aria-label="關閉主要選單">關閉</button></div>
        <p className="mt-2 break-words text-sm text-[var(--muted)]">{account?.role === 'Admin' ? '管理者' : account?.company} · {account?.name}</p>
        <nav className="my-7 grid gap-2" aria-label="主要導覽">{links.map((link) => <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href ? 'is-active' : ''}`} aria-current={pathname === link.href ? 'page' : undefined} onClick={() => menu.current?.close()}>{link.label}<span aria-hidden="true">›</span></Link>)}</nav>
        <button className="btn btn-secondary w-full" onClick={() => signOut({ callbackUrl: '/' })}>登出</button>
      </dialog>
    </div>
  </AccountContext.Provider>;
}
