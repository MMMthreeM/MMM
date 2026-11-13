'use client';
import Link from 'next/link';
import { useOrders } from './useOrders';
import LoadingState from './LoadingState';
import { groupOrders, isReturnedOrder } from '@/lib/order-view';
import { OrderSummary } from './OrderReadView';
import WorkQueue from './WorkQueue';
import { detailHref } from '@/lib/order-navigation';

export default function CrewOverview() {
  const { orders, loading, error, refresh } = useOrders();
  const groups = groupOrders(orders), returned = groups.filter(isReturnedOrder), drafts = groups.filter(g => g.status === '編輯中');
  const recent = groups.filter(g => g.status !== '編輯中').sort((a,b) => b.first.orderDate.localeCompare(a.first.orderDate)).slice(0,3);
  return <main className="page-frame crew-home"><div className="page-heading"><div><h1 className="page-title">工班工作總覽</h1><p className="page-subtitle">建立需求、處理待辦，追蹤同工班共享的材料需求。</p></div></div>
    <section className="home-create"><div><h2 className="section-title">{!loading&&!error&&!groups.length?'建立第一張材料需求':'今天需要哪些材料？'}</h2><p>搜尋材料或貼上叫料清單，整理完成後送交審核。</p></div><Link href="/request" className="btn btn-primary">建立材料需求</Link></section>
    {loading ? <LoadingState label="正在整理工班需求…"/> : error ? <div role="alert" className="feedback-error">暫時無法取得最新工班需求，不能確認待辦件數。<button className="btn btn-quiet" onClick={()=>void refresh()}>重新載入需求</button></div> : <>
      
      <h2 className="section-title workspace-heading">待辦與需求進度</h2>
      <WorkQueue label="工班待辦概況" items={[
        {label:'退回待修改',count:returned.length,href:'/dashboard?status=退回待修改',description:'查看原因，修改後重新送出'},
        {label:'工班草稿',count:drafts.length,href:'/dashboard?tab=draft',description:'接續整理尚未送出的材料'},
        ...['處理中','審核完畢','準備出貨'].map(status=>({label:status==='處理中'?'待審核':status,count:groups.filter(g=>g.consistent&&g.status===status&&!isReturnedOrder(g)).length,href:'/dashboard?status='+encodeURIComponent(status==='處理中'?'待審核':status),description:status==='處理中'?'已送出，等待管理審核':status==='審核完畢'?'等待採購與出貨安排':'追蹤交期與送達進度'}))
      ]}/>
      {recent.length>0&&<section className="home-recent"><div className="page-heading"><h2 className="section-title">最近 3 張正式需求</h2><Link className="data-link" href="/dashboard">查看全部需求</Link></div><div className="request-list">{recent.map(g=><Link key={g.orderId} className="recent-order" href={detailHref(g.orderId,'/')}><OrderSummary group={g}/><span className="card-open">查看詳情</span></Link>)}</div></section>}
    </>}
  </main>;
}
