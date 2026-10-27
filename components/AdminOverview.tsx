'use client';
import Link from 'next/link';
import { useOrders } from '@/components/useOrders';
import { groupOrders, isReturnedOrder, waitingDays } from '@/lib/order-view';

export default function AdminOverview() {
  const { orders, loading, error, refresh } = useOrders(true);
  const groups = groupOrders(orders);
  const pending = groups.filter((group) => group.consistent && group.status === '處理中' && !isReturnedOrder(group)).sort((a, b) => a.first.orderDate.localeCompare(b.first.orderDate));
  const returned = groups.filter(isReturnedOrder);
  return <main className="page-frame"><div className="page-heading"><div><h1 className="page-title">管理工作總覽</h1><p className="page-subtitle">先處理等待最久的需求，再彙整審核中的單據出貨。</p></div><Link href="/admin" className="btn btn-primary">進入審核中心</Link></div>
    {error && <p role="alert" className="feedback-error">{error}<button className="ml-3 underline" onClick={() => void refresh()}>重新載入</button></p>}
    {loading ? <p role="status">正在整理待辦需求…</p> : <>
      <section className="overview-queue surface" aria-label="待辦概況">{[{ label: '待審需求', value: pending.length, status: '待審核' }, { label: '審核中・可匯出', value: groups.filter((group) => group.status === '審核中').length, status: '審核中' }, { label: '準備出貨', value: groups.filter((group) => group.status === '準備出貨').length, status: '準備出貨' }].map((item) => <Link key={item.status} href={`/admin?status=${encodeURIComponent(item.status)}`}><span>{item.label}</span><strong>{item.value}<small> 張</small></strong><span className="queue-link">查看需求單 <span aria-hidden="true">→</span></span></Link>)}</section>
      <section className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="section-title">待審清單</h2><p className="mt-1 text-sm text-[var(--muted)]">依等待時間排序；天數自最近送出／更新時間計算。另有 <Link className="underline" href="/admin?status=%E9%80%80%E5%9B%9E%E5%BE%85%E4%BF%AE%E6%94%B9">{returned.length} 張退回待修改</Link>，等待工班補件。</p></div><span className="text-sm font-semibold">最久等待 {pending.length ? waitingDays(pending[0].first.orderDate) : 0} 天</span></div>
        {!pending.length ? <div className="surface empty-state">目前沒有待審需求。</div> : <div className="surface overflow-hidden"><div className="table-scroll"><table className="data-table w-full text-left"><thead><tr><th scope="col">需求單</th><th scope="col">請購工班</th><th scope="col">材料筆數</th><th scope="col">等待時間</th><th scope="col">操作</th></tr></thead><tbody>{pending.map((group) => <tr key={group.orderId}><th scope="row" className="material-name"><span className="order-number">{group.orderId}</span><span className="mt-1 block text-xs font-normal text-[var(--muted)]">{group.first.orderDate}</span></th><td>{group.first.reqCompany}</td><td>{group.items.length} 筆</td><td className={waitingDays(group.first.orderDate) >= 3 ? 'font-bold text-[var(--warning)]' : ''}>{waitingDays(group.first.orderDate)} 天</td><td><Link className="btn btn-quiet" href={`/admin?order=${encodeURIComponent(group.orderId)}`}>查看單據</Link></td></tr>)}</tbody></table></div></div>}
      </section>
    </>}
  </main>;
}
