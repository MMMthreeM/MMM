'use client';
import { signIn, signOut, useSession } from "next-auth/react";
import OrderForm from "@/components/OrderForm";
import Link from 'next/link';

function Brand() { return <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" /><span className="brand-copy">材料需求管理<small>MAINTENANCE MATERIALS</small></span></Link>; }
function HomeContent() {
  const { data: session } = useSession();
  return <main className="app-shell"><header className="app-topbar"><div className="app-topbar-inner"><Brand />{session && <nav className="flex items-center gap-1 sm:gap-2" aria-label="主要導覽"><Link href="/dashboard" className="btn btn-quiet">歷史需求單</Link><button onClick={() => signOut()} className="btn btn-secondary">登出</button></nav>}</div></header>
    {session ? <div className="page-frame"><div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="page-title">建立材料需求</h1><p className="page-subtitle">選取材料、確認數量後送出；草稿會與同工班成員同步。</p></div><div className="rounded-lg bg-[var(--soft-blue)] px-4 py-2.5 text-sm text-[#25516c]"><span className="font-bold">目前登入：</span>{session.user?.email}</div></div><OrderForm /></div> : <div className="page-frame flex min-h-[calc(100vh-72px)] items-center justify-center"><section className="surface w-full max-w-md p-7 sm:p-9"><h1 className="page-title">材料需求管理</h1><p className="page-subtitle leading-6">集中建立、追蹤與審核各工班的材料需求單。</p><div className="mt-8 rounded-xl bg-[var(--soft-blue)] p-4 text-sm leading-6 text-[#315c76]">請使用已登錄的 Google 帳號登入。系統會依您的工班與權限提供對應功能。</div><button onClick={() => signIn('google')} className="btn btn-primary mt-7 w-full">使用 Google 帳號登入</button></section></div>}
  </main>;
}
export default function Home() { return <HomeContent />; }
