import { Suspense } from 'react';
import OrderForm from '@/components/OrderForm';
import Link from 'next/link';

export default function RequestPage() {
  return <main className="page-frame request-frame"><div className="page-heading"><div><h1 className="page-title">建立材料需求</h1><p className="page-subtitle">先選材料，再確認送出。草稿與需求單由同工班成員共用。</p></div><Link className="btn btn-secondary" href="/dashboard?tab=draft">開啟草稿</Link></div><Suspense fallback={<p role="status">正在載入申請表…</p>}><OrderForm /></Suspense></main>;
}
