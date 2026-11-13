'use client';
import { FORMAL_STATUS_OPTIONS } from '@/lib/order-status';
import { auditPendingNotice } from '@/lib/mutation-notice';



import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { useSearchParams } from 'next/navigation';
import { useOrders } from '@/components/useOrders';
import { filterOrderGroups, groupOrders, isReturnedOrder, type OrderFilters, type OrderGroup } from '@/lib/order-view';
import {submissionDisposition,mutationMessage} from '@/lib/order-form-state';
import OrderHistoryPanel from '@/components/OrderHistoryPanel';
import { OrderSummary, OrderFacts, OrderMaterials } from './OrderReadView';
import { canAdminMoveStatus, type OrderStatus } from '@/lib/order-domain';
import SearchFilterBar from './SearchFilterBar';
import Pagination, { usePagination } from '@/components/Pagination';
import LoadingState from '@/components/LoadingState';
import BackToTop from '@/components/BackToTop';
import { canonicalVendor } from '@/lib/material-identity';
import SearchSelect from '@/components/SearchSelect';
import { recentMonthRange } from '@/lib/date-range';
import AdminOrderEditor from '@/components/AdminOrderEditor';
import { OrderAttemptRecovery, useAttemptRecovery } from '@/components/OrderAttemptRecovery';
import { serializeAttemptRecovery } from '@/lib/order-attempt-recovery';

type Action = { type: 'status'; status: OrderStatus; ids: string[] } | { type: 'export'; ids: string[]; count: number; filters?: OrderFilters; scope: 'filtered' | 'selected' };
type ExportFile = { content: string; name: string };

function downloadFile(file: ExportFile) {
  const bytes = Uint8Array.from(atob(file.content), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.name.endsWith('.zip') ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url; link.download = file.name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReviewContent() {
  const params = useSearchParams();
  const batchRecovery=useAttemptRecovery('admin-status-batch'),editorRecovery=useAttemptRecovery('admin-editor');
  const [filters, setFilters] = useState<OrderFilters>({ ...(params.get('order') ? {} : recentMonthRange()), status: params.get('status') || '', search: params.get('order') || '' });
  const query = new URLSearchParams({ scope: 'all', startDate: filters.startDate || '', endDate: filters.endDate || '' }).toString();
  const { orders, loading, error, refresh } = useOrders(true, query);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState('asc');
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [returnMode, setReturnMode] = useState<'order' | 'material'>('order');
  const [returnTargets, setReturnTargets] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<OrderGroup | null>(null);
  const [actionError, setActionError] = useState('');
  const [replaceConfirmed,setReplaceConfirmed]=useState(false);
  const [blockedAttempt,setBlockedAttempt]=useState<{ref?:string;message:string}|null>(null);
  const [batchResults,setBatchResults]=useState<Array<{id:string;result:string}>>([]);
  const [individualReasons,setIndividualReasons]=useState<Record<string,string>>({});
  const [file, setFile] = useState<ExportFile | null>(null);
  const [vendorFiles, setVendorFiles] = useState<Array<ExportFile & { vendor: string }>>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const quotationDialog = useRef<HTMLDialogElement>(null);
  const quotationInput = useRef<HTMLTextAreaElement>(null);
  const [quotation, setQuotation] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  useEffect(() => { if (quotation) quotationDialog.current?.showModal(); }, [quotation]);
  const closeQuotation = () => { quotationDialog.current?.close(); setQuotation(''); setCopyNotice(''); };
  const requestQuotation = async () => {
    if (busy) return; setBusy(true);
    try { const response = await fetch('/api/admin/quotation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: selectedGroups.map(group => group.orderId) }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || '無法產生詢價內容。'); setQuotation(body.text); setCopyNotice(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : '無法連線。'); } finally { setBusy(false); }
  };
  const allBox = useRef<HTMLInputElement>(null);
  const mobileMore = useRef<HTMLDetailsElement>(null);
  const invalidRange = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const visible = invalidRange ? [] : filterOrderGroups(groupOrders(orders), filters).sort((a, b) => sort === 'asc' ? a.first.orderDate.localeCompare(b.first.orderDate) : b.first.orderDate.localeCompare(a.first.orderDate));
  const pagination = usePagination(visible, JSON.stringify([filters, sort]));
  const selectable = visible.filter((group) => group.consistent && group.status !== '編輯中');
  const selectedGroups = selectable.filter((group) => selected.has(group.orderId));
  const exportGroups = visible.filter(group => group.consistent && group.status !== '編輯中');
  const canExportSelected = selectedGroups.length > 0 && selectedGroups.length <= 200 && selectedGroups.every(group => group.consistent && group.status !== '編輯中');
  const canApply = (status: OrderStatus) => batchRecovery.ready&&editorRecovery.ready&&!blockedAttempt && selectedGroups.length > 0 && selectedGroups.every((group) => status === '處理中' ? ['處理中', '審核完畢', '準備出貨'].includes(group.status) : !isReturnedOrder(group)&&canAdminMoveStatus(group.status, status));
  const choices = (key: 'reqCompany' | 'reqRegion' | 'vendor' | 'materialName') => [...new Set(orders.filter(row => key !== 'reqCompany' || !filters.region || row.reqRegion === filters.region).map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-TW'));
  const updateFilter = (key: keyof OrderFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value, ...(key === 'region' ? { company: '' } : {}) })); setSelected(new Set()); };
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = selectedGroups.length > 0 && selectedGroups.length < selectable.length;
  }, [selectedGroups.length, selectable.length]);
  useEffect(() => { if (action) dialog.current?.showModal(); }, [action]);
  const open = (next: Action) => { if (mobileMore.current) mobileMore.current.open = false; setNote(''); setDate(''); setReturnMode('order'); setReturnTargets(new Set()); setActionError('');setReplaceConfirmed(false);setIndividualReasons({}); setAction(next); };
  const close = () => { if (!busy) { dialog.current?.close(); setAction(null); } };
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const submit = async () => {
    if (!action || busy) return;
    if(action.type==='status'&&(!batchRecovery.ready||!editorRecovery.ready)){setActionError('待核實作業恢復尚未就緒。');return;}
    if (action.type === 'status' && action.status === '處理中' && !note.trim()) { setActionError('請填寫退回原因，讓工班知道需要修改什麼。'); return; }
    if(action.type==='status'&&blockedAttempt)return;
    if(action.type==='status'&&action.status==='處理中'&&action.ids.some(id=>isReturnedOrder(groupOrders(orders).find(g=>g.orderId===id)!))&&!replaceConfirmed)return setActionError('請明確確認取代目前有效退回。');
    if(action.type==='status'&&action.status==='處理中'&&returnMode==='material'&&action.ids.some(id=>!orders.some(r=>r.orderId===id&&returnTargets.has(r.lineId))))return setActionError('每張需求單至少選取一筆退回材料。');
    setBusy(true); setActionError('');setBatchResults([]);
    try {
      if(action.type==='status'){
        let completed=0;
        for(const id of action.ids){
          const group=groupOrders(orders).find(g=>g.orderId===id);if(!group?.consistent||group.items.some(r=>!r.lineRef||!r.mcf||r.readState!=='verified'))throw Error('需求資料待核實，已停止後續操作。');
          const intent=action.status==='處理中'?(isReturnedOrder(group)?'replace-current-return':'create-return'):action.status==='審核完畢'?'complete-review':action.status==='準備出貨'?'prepare-shipping':'deliver-orders';
          const payload={contractVersion:2,intent,orderId:id,...(action.status==='準備出貨'?{expectedDate:date}:{}),...(action.status==='處理中'?{returnRequest:{contractVersion:2,r2Version:1,intent,orderId:id,expectedActiveReturnRef:group.first.activeReturnRef,scope:returnMode==='material'?'lines':'order',reason:note.trim(),targets:group.items.filter(r=>returnMode==='order'||returnTargets.has(r.lineId)).map(r=>({lineRef:r.lineRef,expectedMcf:r.mcf,reason:individualReasons[r.lineId]?.trim()||null}))}}:{})};
          const preserveStatus=(attemptRef?:string)=>batchRecovery.save(serializeAttemptRecovery(batchRecovery.scope,attemptRef,'edit-pending',`管理員${action.status}；後續 ${action.ids.length-completed-1} 張未執行`,{lines:group.items.map(r=>({uiKey:r.lineId,content:r.content!,confirmed:r.effectiveReview==='confirmed'}))},Object.fromEntries([[id,{result:action.status,reason:note.trim()||`更新為${action.status}；後續 ${action.ids.length-completed-1} 張未執行`}],...group.items.filter(r=>returnTargets.has(r.lineId)).map(r=>[r.lineId,{result:action.status,reason:individualReasons[r.lineId]?.trim()||note.trim()}])])));
          preserveStatus();
          let body;
          try{const response=await fetch('/api/admin/update-status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});body=await response.json();}catch{setBatchResults(current=>[...current,{id,result:'回應遺失，結果待核實；後續未執行'}]);dialog.current?.close();setBlockedAttempt({message:`已完成 ${completed} 張；本次作業回應遺失。請保留選取並交由管理者核實，勿重送。`});return;}
          const disposition=submissionDisposition(body);
          if(disposition==='review-required'){try{preserveStatus(body.attemptRef);}catch{/* Original pre-dispatch display snapshot remains; never permit retry. */}setBatchResults(current=>[...current,{id,result:'結果待核實，後續單據未執行'}]);dialog.current?.close();setBlockedAttempt({ref:body.attemptRef,message:`已完成 ${completed} 張；單號 ${id} 的結果待核實，後續單據尚未執行。`});return;}
          if(disposition==='rejected'){batchRecovery.clear();setBatchResults(current=>[...current,{id,result:'明確拒絕，後續停止'}]);throw Error(`已完成 ${completed} 張；${mutationMessage(body.code)}後續已停止。`);}
          batchRecovery.clear();completed++;setBatchResults(current=>[...current,{id,result:'已確認完成'}]);setSelected(s=>{const next=new Set(s);next.delete(id);return next;});
        }
        setMessage(`已確認更新 ${completed} 張需求單。每張單為獨立的完整業務操作。`);dialog.current?.close();setAction(null);await refresh();setFilters(current=>({...current,status:action.status==='處理中'?'退回待修改':action.status}));return;
      }
      const response = await fetch(action.type === 'export' ? '/api/admin/export' : '/api/admin/update-status', {
        method: action.type === 'export' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: action.scope, filters: action.filters, orderIds: action.ids }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '處理失敗，請稍後再試。');
      if (action.type === 'export') {
        const nextFile = { content: body.archiveContent ?? body.fileContent, name: body.archiveName ?? `材料需求報表_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })}.xlsx` };
        setFile(nextFile);
        setVendorFiles((body.files ?? []).map((item: { vendor: string; filename: string; fileContent: string }) => ({ vendor: item.vendor, name: item.filename, content: item.fileContent })));
        setMessage(`已匯出 ${body.orderIds.length} 張需求單，需求狀態維持不變。可重新下載全部或個別廠商報表。`);
        if (body.quotationText) { setQuotation(body.quotationText); setCopyNotice('Excel 不包含賀冠材料；請另外複製此詢價內容。'); }
        try { downloadFile(nextFile); } catch { /* Retain the generated file for manual download. */ }
      }
      const notice = auditPendingNotice(response); if (notice) setMessage(current => current + ' ' + notice);
      setSelected(new Set()); dialog.current?.close(); setAction(null);
      await refresh();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : '連線失敗，請重新整理後確認狀態。'); }
    finally { setBusy(false); }
  };
  if(batchRecovery.record||batchRecovery.invalid||editorRecovery.record||editorRecovery.invalid)return <main className="page-frame"><h1 className="page-title">管理員原作業待核實</h1><OrderAttemptRecovery recovery={batchRecovery.record||batchRecovery.invalid?batchRecovery:editorRecovery}/></main>;
  return <main className={`page-frame review-frame ${selectedGroups.length ? 'review-has-selection' : ''}`}>
    <div className="page-heading"><div><h1 className="page-title">案件管理</h1><p className="page-subtitle">以整張需求單審核。同一張需求單的材料一起選取、一起更新狀態。</p></div><Link href="/" className="btn btn-secondary">管理工作總覽</Link></div>
    {message && <div role="status" className="feedback-success mb-5">{message}{file && <button className="mt-2 block font-bold underline" onClick={() => downloadFile(file)}>重新下載全部報表</button>}{vendorFiles.map((item) => <button key={item.vendor} className="mr-4 mt-2 font-bold underline" onClick={() => downloadFile(item)}>下載{item.vendor}報表</button>)}</div>}
    {error && <div className="feedback-error mb-5" role="alert">{error}<button className="ml-3 underline" onClick={() => void refresh()}>重新載入</button></div>}

    {blockedAttempt&&<section className="feedback-error" role="alert"><p>{blockedAttempt.message}</p>{blockedAttempt.ref&&<button className="btn btn-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch(`/api/orders/operations?attemptRef=${encodeURIComponent(blockedAttempt.ref!)}`,{cache:'no-store'});const b=await r.json();if(r.ok&&submissionDisposition(b)==='confirmed'){setBlockedAttempt(null);setAction(null);dialog.current?.close();setSelected(new Set());await refresh();setMessage('原作業已核實完成，其餘單據請重新選取。');}else setActionError('原作業仍待核實，請勿重新送出。');}finally{setBusy(false);}}}>查詢原作業結果</button>}</section>}
    <SearchFilterBar label="搜尋需求" count={Object.entries(filters).filter(([key,value])=>key!=='search'&&value).length} search={<input type="search" aria-label="搜尋需求" className="form-control" placeholder="輸入日期或單號" value={filters.search || ''} onChange={event=>updateFilter('search',event.target.value)}/>}><div className="filter-grid">
      {[{ key: 'region', field: 'reqRegion', label: '地區' }, { key: 'company', field: 'reqCompany', label: '工班' }, { key: 'vendor', field: 'vendor', label: '廠商' }].map(({ key, field, label }) => <label key={key}><span className="form-label">{label}</span><select aria-label={label} className="form-control" value={filters[key as keyof OrderFilters] || ''} onChange={(event) => updateFilter(key as keyof OrderFilters, event.target.value)}><option value="">全部{label}</option>{choices(field as 'reqCompany' | 'reqRegion' | 'vendor' | 'materialName').map((value) => <option key={value}>{value}</option>)}</select></label>)}
      <SearchSelect label="材料" value={filters.material || ''} options={choices('materialName').map((name) => ({ value: name, label: name }))} onChange={(value) => updateFilter('material', value)} emptyLabel="全部材料" />
      <label><span className="form-label">需求狀態</span><select className="form-control" value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)}>{FORMAL_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="date-range-fields" role="group" aria-label="需求日期範圍"><label><span className="form-label">開始日期</span><input type="date" className="form-control" value={filters.startDate || ''} max={filters.endDate || undefined} onChange={(event) => updateFilter('startDate', event.target.value)} /></label>
      <label><span className="form-label">結束日期</span><input type="date" className="form-control" value={filters.endDate || ''} min={filters.startDate || undefined} onChange={(event) => updateFilter('endDate', event.target.value)} /></label></div>

      <label><span className="form-label">排序</span><select className="form-control" value={sort} onChange={(event) => setSort(event.target.value)}><option value="asc">最早需求優先</option><option value="desc">最新需求優先</option></select></label>
      <button className="btn btn-quiet self-end" onClick={() => { setFilters({}); setSelected(new Set()); }}>清除篩選</button>
    </div></SearchFilterBar>
    {invalidRange && <p role="alert" className="feedback-error mb-5">開始日期不能晚於結束日期。</p>}
    <div className="filter-chips" aria-label="已套用管理條件">{Object.entries(filters).filter(([,value])=>value).map(([key,value])=><button key={key} aria-label={`移除管理條件 ${value}`} onClick={()=>updateFilter(key as keyof OrderFilters,'')}>{value} ×</button>)}</div>
    <details className="review-tools"><summary>採購工具：匯出與詢價（不改變狀態）</summary><section className="export-strip"><div><h2 className="font-bold">匯出目前範圍</h2><p className="mt-1 text-sm leading-6">目前範圍內有 <strong>{exportGroups.length} 張</strong>正式需求單，共 {exportGroups.reduce((sum, group) => sum + group.items.length, 0)} 筆材料。匯出不改變需求狀態；賀冠材料另以文字詢價。</p></div><button className="btn btn-primary" disabled={!exportGroups.length || busy} onClick={() => open({ type: 'export', ids: exportGroups.map((group) => group.orderId), count: exportGroups.reduce((sum, group) => sum + group.items.length, 0), filters: { ...filters }, scope: 'filtered' })}>匯出篩選範圍</button></section></details>
    <section className="bulk-bar" aria-label="整單批次操作">
      <label className="check-target"><input ref={allBox} type="checkbox" checked={selectable.length > 0 && selectedGroups.length === selectable.length} disabled={!selectable.length || busy} onChange={(event) => setSelected(event.target.checked ? new Set(selectable.map((group) => group.orderId)) : new Set())} /><span>全選本次範圍</span></label>
      <strong aria-live="polite">已選取 {selectedGroups.length} 張單</strong>
      <div className="bulk-actions flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy || !canExportSelected} onClick={() => open({ type: 'export', scope: 'selected', ids: selectedGroups.map((group) => group.orderId), count: selectedGroups.reduce((sum, group) => sum + group.items.length, 0) })}>匯出勾選單據</button>
        <button className="btn btn-secondary" disabled={busy || !canApply('審核完畢')} onClick={() => open({ type: 'status', status: '審核完畢', ids: selectedGroups.map(group => group.orderId) })}>完成審核</button>
        <button className="btn btn-secondary" disabled={busy || !canApply('準備出貨')} onClick={() => open({ type: 'status', status: '準備出貨', ids: selectedGroups.map(group => group.orderId) })}>設為準備出貨</button>
        <button className="btn btn-secondary" disabled={busy || !selectedGroups.some(group => group.items.some(item => canonicalVendor(item.vendor) === '賀冠'))} onClick={() => void requestQuotation()}>賀冠詢價</button>
        <button className="btn btn-secondary" disabled={busy || !canApply('已送達')} onClick={() => open({ type: 'status', status: '已送達', ids: selectedGroups.map((group) => group.orderId) })}>標記已送達</button>
        <button className="btn btn-danger" disabled={busy || !canApply('處理中')} onClick={() => open({ type: 'status', status: '處理中', ids: selectedGroups.map((group) => group.orderId) })}>退回修改</button>
      </div>
    </section>
    {selectedGroups.length > 0 && <div className="mobile-review-actions" aria-label="已選單據操作"><strong>已選 {selectedGroups.length} 張</strong><button className="btn btn-primary" disabled={busy || !canApply('審核完畢')} onClick={() => open({ type: 'status', status: '審核完畢', ids: selectedGroups.map((group) => group.orderId) })}>完成審核</button><details ref={mobileMore} className="mobile-review-more"><summary className="btn btn-secondary">更多操作</summary><div><button className="btn btn-secondary" disabled={busy || !canExportSelected} onClick={() => open({ type: 'export', scope: 'selected', ids: selectedGroups.map((group) => group.orderId), count: selectedGroups.reduce((sum, group) => sum + group.items.length, 0) })}>匯出勾選單據</button><button className="btn btn-secondary" disabled={busy || !canApply('審核完畢')} onClick={() => open({ type: 'status', status: '審核完畢', ids: selectedGroups.map(group => group.orderId) })}>完成審核</button>
        <button className="btn btn-secondary" disabled={busy || !canApply('準備出貨')} onClick={() => open({ type: 'status', status: '準備出貨', ids: selectedGroups.map(group => group.orderId) })}>設為準備出貨</button>
        <button className="btn btn-secondary" disabled={busy || !selectedGroups.some(group => group.items.some(item => canonicalVendor(item.vendor) === '賀冠'))} onClick={() => void requestQuotation()}>賀冠詢價</button><button className="btn btn-secondary" disabled={busy || !canApply('已送達')} onClick={() => open({ type: 'status', status: '已送達', ids: selectedGroups.map((group) => group.orderId) })}>標記已送達</button><button className="btn btn-danger" disabled={busy || !canApply('處理中')} onClick={() => open({ type: 'status', status: '處理中', ids: selectedGroups.map((group) => group.orderId) })}>退回修改</button><p className="field-hint">套用到勾選的完整單據；不符合階段的操作會停用。</p></div></details></div>}
    <p className="mb-5 text-sm leading-6 text-[var(--muted)]">共 {visible.length} 張需求單。材料與廠商篩選會保留符合單據的全部材料；更換篩選後會清除勾選。各正式需求狀態皆可匯出，匯出與詢價不改變需求狀態。每次最多匯出 200 張單。</p>
    {batchResults.length>0&&<section className="surface review-batch-results p-4" aria-label="逐張處理結果"><h2 className="section-title">本次處理結果</h2><ul>{batchResults.map(result=><li key={result.id}>{result.id}：{result.result}</li>)}</ul></section>}
    {loading ? <LoadingState label="正在讀取需求單…" /> : error&&!orders.length?null : !visible.length ? <div className="surface empty-state">目前沒有符合條件的正式需求單。</div> : <div id="review-results" className="space-y-6">{pagination.items.map((group) => <section key={group.orderId} data-order-id={group.orderId} className={`surface order-group ${selected.has(group.orderId) ? 'order-selected' : ''}`}>
      <header className="order-group-heading">
        <label className="check-target order-select"><input type="checkbox" checked={selected.has(group.orderId)} disabled={busy || !group.consistent} onChange={() => toggle(group.orderId)} aria-label={`選取整張需求單 ${group.orderId}，共 ${group.items.length} 筆材料`} /><span className="sr-only">選取整單</span></label>
        <div className="min-w-0 flex-1"><OrderSummary group={group}/></div>
        {group.consistent && <button type="button" className="icon-button" aria-label={`編輯需求單 ${group.orderId}`} title="材料／廠商對應與編輯" disabled={busy} onClick={() => setEditing(group)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m16 3 5 5M4 16 16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>}
      </header>
      <details className="admin-case-details" open={params.get('order')===group.orderId||selected.has(group.orderId)}><summary>查看 {group.items.length} 筆材料、確認與歷史</summary>
      {group.consistent && <div className="px-5 py-3"><button className="btn btn-quiet" disabled={busy} onClick={() => setEditing(group)}>材料／廠商對應</button></div>}
      {group.first.returnNote && <p className="order-return-note">{group.first.returnNote}</p>}<div className="admin-read-content"><h3 className="section-title">需求資料</h3><OrderFacts group={group} admin/></div>
      {!group.consistent && <p className="feedback-error m-4" role="alert">此單的材料狀態或工班不一致，暫停操作，請管理者確認原始資料。</p>}
      <div className="admin-read-content"><h3 className="section-title">材料清單 · {group.items.length} 筆</h3><OrderMaterials group={group} admin/><OrderHistoryPanel group={group}/></div></details>
    </section>)}</div>}
    {editing && <AdminOrderEditor group={editing} onClose={() => setEditing(null)} onSaved={async (notice) => { setSelected(new Set()); setMessage('管理員修改已儲存，單據進度維持不變。' + (notice || '')); await refresh(); }} />}
    <dialog ref={quotationDialog} className="action-dialog quotation-dialog" aria-labelledby="quotation-title" onCancel={closeQuotation}>
      <h2 id="quotation-title" className="section-title">賀冠詢價內容</h2><p className="field-hint mt-3">可編輯後複製，貼至通訊 App。此操作不會傳送訊息或變更需求狀態。</p>
      <label className="mt-4 block"><span className="form-label">詢價文字</span><textarea ref={quotationInput} className="form-control quotation-text" value={quotation} onChange={event => setQuotation(event.target.value)} /></label>
      {copyNotice && <p role="status" className="field-hint mt-3">{copyNotice}</p>}
      <div className="dialog-actions"><button className="btn btn-secondary" onClick={closeQuotation}>關閉</button><button className="btn btn-primary" onClick={async () => { try { await navigator.clipboard.writeText(quotation); setCopyNotice('已複製詢價內容。'); } catch { quotationInput.current?.focus(); quotationInput.current?.select(); setCopyNotice('無法自動複製，已選取文字，請手動複製。'); } }}>複製內容</button></div>
    </dialog>
    <Pagination {...pagination} label="審核需求單" targetId="review-results" /><BackToTop />
    <dialog ref={dialog} className="action-dialog" aria-labelledby="action-title" onCancel={(event) => { if (busy) event.preventDefault(); else setAction(null); }}>
      {action && <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <h2 className="section-title" id="action-title" tabIndex={-1} autoFocus>{action.type === 'export' ? '確認匯出報表' : action.status === '處理中' ? '退回需求單' : `確認變更為${action.status}`}</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{action.type === 'export' ? `將匯出 ${action.ids.length} 張需求單、共 ${action.count} 筆材料，產生伸泰與益詮 Excel，範本外材料追加於材料區末端。賀冠另提供詢價文字。所有需求狀態維持不變。` : `此操作會更新 ${action.ids.length} 張需求單的全部材料。`}</p>
        {action.type === 'status' && action.status === '處理中' && <label className="mt-5 block"><span className="form-label">退回原因（必填）</span><textarea required maxLength={500} name="returnReason" aria-describedby={actionError ? 'review-action-error' : undefined} className="form-control min-h-28" value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="例如：請確認第二筆材料的規格…" /></label>}
        {action.type==='status'&&action.status==='處理中'&&action.ids.some(id=>groupOrders(orders).some(g=>g.orderId===id&&isReturnedOrder(g)))&&<label className="check-target mt-4"><input type="checkbox" checked={replaceConfirmed} disabled={busy} onChange={e=>setReplaceConfirmed(e.target.checked)}/>明確取代目前有效退回，保留舊原因於歷史，不累積原因</label>}
        {action.type==='status'&&action.status==='處理中'&&returnMode==='material'&&orders.filter(r=>action.ids.includes(r.orderId)&&returnTargets.has(r.lineId)).map(r=><label className="block mt-3" key={r.lineId}><span className="form-label">{r.materialName} 的個別原因（空白則使用共用原因）</span><input className="form-control" maxLength={500} disabled={busy} value={individualReasons[r.lineId]??''} onChange={e=>setIndividualReasons(s=>({...s,[r.lineId]:e.target.value}))}/></label>)}
        {action.type === 'status' && action.status === '處理中' && <fieldset className="return-targets"><legend className="form-label">退回原因顯示位置</legend><label className="check-target"><input type="radio" name="return-mode" checked={returnMode === 'order'} onChange={() => setReturnMode('order')} />單據上方顯示一次</label><label className="check-target"><input type="radio" name="return-mode" checked={returnMode === 'material'} onChange={() => setReturnMode('material')} />只顯示在指定材料</label>{returnMode === 'material' && <div className="return-materials">{groupOrders(orders).filter((group) => action.ids.includes(group.orderId)).map((group) => <fieldset key={group.orderId}><legend>{group.first.orderDate} · {group.first.reqCompany}（每單至少選一筆）<span className="order-reference">單號：{group.orderId}</span></legend>{group.items.map((item, index) => <label className="check-target" key={item.lineId}><input type="checkbox" checked={returnTargets.has(item.lineId)} onChange={() => setReturnTargets((current) => { const changed = new Set(current); if (changed.has(item.lineId)) changed.delete(item.lineId); else changed.add(item.lineId); return changed; })} /><span>第 {index + 1} 筆 · {item.materialName} · {item.quantity} {item.unit}</span></label>)}</fieldset>)}</div>}</fieldset>}
        {action.type === 'status' && action.status === '準備出貨' && <label className="mt-5 block"><span className="form-label">預計交期（選填）</span><input type="date" className="form-control" value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} /></label>}
        {actionError && <p id="review-action-error" className="feedback-error mt-4" role="alert">{actionError}</p>}
        <div className="dialog-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>取消</button><button type="submit" className={`btn ${action.type === 'status' && action.status === '處理中' ? 'btn-danger' : 'btn-primary'}`} disabled={busy || Boolean(blockedAttempt)}>{busy ? '處理中…' : action.type === 'export' ? '確認匯出' : '確認更新'}</button></div>
      </form>}
    </dialog>
  </main>;
}

function ReviewEntry() {
  const params = useSearchParams();
  // Client navigation can reuse this route; URL changes start a fresh filter/selection scope.
  return <ReviewContent key={params.toString()} />;
}

export default function AdminReviewWorkbench() { return <Suspense fallback={<p className="page-frame" role="status">正在讀取篩選條件…</p>}><ReviewEntry /></Suspense>; }
