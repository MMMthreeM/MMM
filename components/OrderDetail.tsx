'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isReturnedOrder, orderPresentation, type OrderGroup } from '@/lib/order-view';
import { editHref, publishConfirmedFeedback, safeReturnTo } from '@/lib/order-navigation';
import { submissionDisposition, mutationMessage } from '@/lib/order-form-state';
import OrderHistoryPanel from './OrderHistoryPanel';
import OrderProgress from './OrderProgress';
import { useAccount } from './AppShell';
import { OrderFacts, OrderMaterials } from './OrderReadView';

export default function OrderDetail({group,returnTo,onClose,onDeleted,stale=false,readOnlyReason}:{group:OrderGroup;returnTo:string;onClose?:()=>void;onDeleted?:()=>Promise<void>;stale?:boolean;readOnlyReason?:string}) {
  const account=useAccount();
  const router=useRouter(), dialog=useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState<{ref?:string}|null>(null);
  const p=orderPresentation(group), returned=isReturnedOrder(group), readOnly=stale||!group.consistent||group.items.some(r=>r.readState!=='verified'||!r.lineRef||!r.mcf);
  const editable=!readOnly&&(account?.role==='Admin'||['編輯中','處理中'].includes(group.status)), deletable=!readOnly&&['編輯中','處理中'].includes(group.status)&&!returned;
  const destination=safeReturnTo(returnTo);
  const Heading=onClose?'h2':'h1';
  const finish=async()=>{dialog.current?.close();publishConfirmedFeedback('需求單已刪除。');if(onDeleted)await onDeleted();else router.replace(destination);};
  const remove=async()=>{if(busy||uncertain)return;setBusy(true);setError('');try{
    const r=await fetch('/api/orders/delete-item',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractVersion:2,intent:'delete-order',orderId:group.orderId})});const b=await r.json();const result=submissionDisposition(b);
    if(result==='confirmed')await finish();else if(result==='rejected')setError(mutationMessage(b.code));else{setUncertain({ref:b.attemptRef});dialog.current?.close();}
  }catch{setUncertain({});dialog.current?.close();}finally{setBusy(false);}};
  return <section className="surface order-detail" data-order-id={group.orderId} aria-label={`需求詳情 ${group.orderId}`}>
    <header className="detail-heading"><div><Heading className={onClose?"section-title":"page-title"}>{group.status==='編輯中'?group.first.draftName||'工班草稿':'需求詳情'}</Heading></div>{onClose?<button className="btn btn-quiet" aria-label="關閉需求詳情" onClick={onClose}>關閉</button>:<Link className="btn btn-quiet" href={destination}>返回原位置</Link>}</header>
    <div className="detail-content"><section className="request-status" aria-label="目前狀態與下一步"><span className={'status status-'+p.tone}>{p.label}</span><p>{readOnly?'目前僅供查看，請先核實需求資料。':returned?'請依退回原因修改材料，完成後重新送出。':group.status==='編輯中'?'接續整理材料，確認後送交審核。':group.status==='處理中'?'等待管理員審核；需要調整時可修改需求。':group.status==='審核完畢'?'已完成審核，等待採購與出貨安排。':group.status==='準備出貨'?'等待材料送達；交期依廠商回覆為準。':group.status==='已送達'?'材料已送達，可查看明細或再訂一次。':'請核實目前需求進度。'}</p>{editable&&!uncertain&&<Link className="btn btn-primary" href={editHref(group.orderId,'edit',destination)}>{group.status==='編輯中'?'開啟草稿':returned?'修改並重新送出':'修改需求'}</Link>}</section>
      {stale&&<p className="feedback-error mt-4" role="status">{readOnlyReason||'目前無法核實最新資料或寫入條件，這張需求暫時僅供查看。'}</p>}
      {!group.consistent&&<p className="feedback-error mt-4" role="alert">資料待核實，目前僅供查看，不能修改或再訂。</p>}
      {group.status!=='編輯中'&&<OrderProgress status={group.status} returned={returned} verified={group.consistent}/>}
      {returned&&<section className="return-callout" aria-label="目前有效退回"><h3 className="section-title">請依退回原因修改並重新送出</h3><p>{group.first.returnInfo?.reason||group.first.returnNote}</p><div className="flex flex-wrap gap-2">{group.first.returnInfo?.targets.map((t,index)=><button key={t.lineRef.lineId} className="data-link" onClick={()=>{const id=t.currentLineRef?.lineId??t.lineRef.lineId;document.getElementById('detail-line-'+id)?.scrollIntoView({block:'center',behavior:'smooth'});}}>{t.name||`退回材料 ${index+1}`}</button>)}</div></section>}
      <section className="request-section" aria-label="需求基本資料"><h3 className="section-title">需求資料</h3><OrderFacts group={group}/></section>
      <section className="request-section" aria-labelledby="detail-materials"><h3 className="section-title" id="detail-materials">材料清單 · {group.items.length} 筆</h3><OrderMaterials group={group}/></section>
      <OrderHistoryPanel group={group}/>
      {group.items.length>10&&<a className="data-link" href="#detail-materials">返回材料清單頂端</a>}
      {error&&<p className="feedback-error" role="alert">{error}</p>}
      {uncertain&&<section className="feedback-error" role="alert"><h3>刪除結果待核實</h3><p>原需求與作業已保留。請勿再次刪除；無法查明時交由管理者核實。</p>{uncertain.ref&&<button className="btn btn-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/orders/operations?attemptRef='+encodeURIComponent(uncertain.ref!),{cache:'no-store'});const b=await r.json();if(r.ok&&submissionDisposition(b)==='confirmed')await finish();else setError('原作業仍待核實，請勿重新送出。');}catch{setError('查詢失敗，仍須核實原作業。');}finally{setBusy(false);}}}>查詢原作業結果</button>}</section>}
    </div>
    {!uncertain&&<footer className="detail-actions">{!readOnly&&group.status!=='編輯中'&&<Link className="btn btn-secondary" href={editHref(group.orderId,'reorder',destination)}>再訂一次</Link>}{deletable&&<details className="detail-more"><summary className="btn btn-quiet">更多操作</summary><button className="btn btn-danger" disabled={busy} onClick={()=>dialog.current?.showModal()}>刪除單據</button></details>}</footer>}
    <dialog className="action-dialog" ref={dialog} aria-labelledby="delete-order-title" onCancel={e=>{if(busy)e.preventDefault();}}><h2 id="delete-order-title" className="section-title">確認刪除需求單</h2><p className="mt-4">{group.first.draftName} · {group.orderId}</p><p>共 {group.items.length} 筆材料，刪除後無法從此介面還原。</p>{error&&<p className="feedback-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>dialog.current?.close()}>保留需求</button><button className="btn btn-danger" disabled={busy} onClick={()=>void remove()}>{busy?'正在核實刪除…':'確認刪除'}</button></div></dialog>
  </section>;
}
