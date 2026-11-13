'use client';
import Link from 'next/link';
import { OrderSummary } from './OrderReadView';
import WorkQueue from './WorkQueue';
import LoadingState from '@/components/LoadingState';

import { useOrders } from '@/components/useOrders';
import { groupOrders, isReturnedOrder, waitingDays } from '@/lib/order-view';

export default function AdminOverview() {
  const { orders, loading, error, refresh } = useOrders(true);
  const groups = groupOrders(orders);
  const pending = groups.filter((group) => group.consistent && group.status === '處理中' && !isReturnedOrder(group)).sort((a, b) => a.first.orderDate.localeCompare(b.first.orderDate));
  const returned = groups.filter(isReturnedOrder);
  return <main className="page-frame"><div className="page-heading"><div><h1 className="page-title">管理工作總覽</h1><p className="page-subtitle">先處理等待最久的需求，再完成審核與安排出貨；匯出報表獨立操作。</p></div><Link href="/admin" className="btn btn-primary">前往案件管理</Link></div>
    {error && <p role="alert" className="feedback-error">{error}<button className="ml-3 underline" onClick={() => void refresh()}>重新載入</button></p>}

    {loading ? <LoadingState label="正在整理待辦需求…" /> : error&&!orders.length ? null : <>
      {groups.some(g=>!g.consistent)&&<p className="feedback-error mt-4" role="status">有 {groups.filter(g=>!g.consistent).length} 張需求資料待核實，僅供查看；請先處理例外。</p>}
      <h2 className="section-title workspace-heading">待辦與需求進度</h2>
      <WorkQueue label="管理待辦概況" items={[
        {label:'待審核需求',count:pending.length,href:'/admin?status=待審核',description:'集中核對多張需求'},
        {label:'審核完畢',count:groups.filter(g=>g.status==='審核完畢').length,href:'/admin?status=審核完畢',description:'依廠商彙整採購資料'},
        {label:'準備出貨',count:groups.filter(g=>g.status==='準備出貨').length,href:'/admin?status=準備出貨',description:'追蹤交期與送達進度'},
        {label:'退回待修改',count:returned.length,href:'/admin?status=退回待修改',description:'等待工班修改並重新送出'}
      ]}/>
      <section className="mt-8 overview-pending"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="section-title">待審清單</h2><p className="mt-1 text-sm text-[var(--muted)]">依等待時間排序；天數自需求日期計算。另有 <Link className="underline" href="/admin?status=%E9%80%80%E5%9B%9E%E5%BE%85%E4%BF%AE%E6%94%B9">{returned.length} 張退回待修改</Link>，等待工班修改。</p></div><span className="text-sm font-semibold">最久等待 {pending.length ? waitingDays(pending[0].first.orderDate) : 0} 天</span></div>
        {!pending.length ? <div className="surface empty-state">目前沒有待審核需求。</div> : <div className="request-list">{pending.map(group=><Link key={group.orderId} className="recent-order" href={`/admin?order=${encodeURIComponent(group.orderId)}`}><OrderSummary group={group}/><span className="card-open">等待 {waitingDays(group.first.orderDate)} 天 · 查看單據</span></Link>)}</div>}
      </section>
    </>}
  </main>;
}
