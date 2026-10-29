'use client';
import { auditPendingNotice } from '@/lib/mutation-notice';



import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { useSearchParams } from 'next/navigation';
import { useOrders } from '@/components/useOrders';
import { filterOrderGroups, groupOrders, orderPresentation, waitingDays, type OrderFilters, type OrderGroup } from '@/lib/order-view';
import { canAdminMoveStatus, type OrderStatus } from '@/lib/order-domain';
import FilterPanel from '@/components/FilterPanel';
import Pagination, { usePagination } from '@/components/Pagination';
import LoadingState from '@/components/LoadingState';
import BackToTop from '@/components/BackToTop';
import SearchSelect from '@/components/SearchSelect';
import { recentMonthRange } from '@/lib/date-range';
import AdminOrderEditor from '@/components/AdminOrderEditor';

type Action = { type: 'status'; status: OrderStatus; ids: string[] } | { type: 'export'; ids: string[]; count: number; filters?: OrderFilters; scope: 'filtered' | 'selected'; advanceCount: number };
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
  const [file, setFile] = useState<ExportFile | null>(null);
  const [vendorFiles, setVendorFiles] = useState<Array<ExportFile & { vendor: string }>>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const allBox = useRef<HTMLInputElement>(null);
  const mobileMore = useRef<HTMLDetailsElement>(null);
  const invalidRange = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const visible = invalidRange ? [] : filterOrderGroups(groupOrders(orders), filters).sort((a, b) => sort === 'asc' ? a.first.orderDate.localeCompare(b.first.orderDate) : b.first.orderDate.localeCompare(a.first.orderDate));
  const pagination = usePagination(visible, JSON.stringify([filters, sort]));
  const selectable = visible.filter((group) => group.consistent && group.status !== '編輯中');
  const selectedGroups = selectable.filter((group) => selected.has(group.orderId));
  const exportGroups = visible.filter((group) => group.consistent && group.status === '審核中');
  const canExportSelected = selectedGroups.length > 0 && selectedGroups.length <= 200 && selectedGroups.every((group) => ['審核中', '準備出貨', '已送達'].includes(group.status));
  const canApply = (status: OrderStatus) => selectedGroups.length > 0 && selectedGroups.every((group) => status === '處理中' ? ['處理中', '審核中', '準備出貨'].includes(group.status) : canAdminMoveStatus(group.status, status));
  const choices = (key: 'reqCompany' | 'reqRegion' | 'vendor' | 'materialName') => [...new Set(orders.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-TW'));
  const updateFilter = (key: keyof OrderFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setSelected(new Set()); };
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = selectedGroups.length > 0 && selectedGroups.length < selectable.length;
  }, [selectedGroups.length, selectable.length]);
  useEffect(() => { if (action) dialog.current?.showModal(); }, [action]);
  const open = (next: Action) => { if (mobileMore.current) mobileMore.current.open = false; setNote(''); setDate(''); setReturnMode('order'); setReturnTargets(new Set()); setActionError(''); setAction(next); };
  const close = () => { if (!busy) { dialog.current?.close(); setAction(null); } };
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const submit = async () => {
    if (!action || busy) return;
    if (action.type === 'status' && action.status === '處理中' && !note.trim()) { setActionError('請填寫退回原因，讓工班知道需要修改什麼。'); return; }
    setBusy(true); setActionError('');
    try {
      const response = await fetch(action.type === 'export' ? '/api/admin/export' : '/api/admin/update-status', {
        method: action.type === 'export' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.type === 'export' ? { scope: action.scope, filters: action.filters, orderIds: action.ids, expectedDate: date } : { orderIds: action.ids, status: action.status, adminNote: note.trim(), expectedDate: date, targetLineIds: returnMode === 'material' ? [...returnTargets] : undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '處理失敗，請稍後再試。');
      if (action.type === 'export') {
        const nextFile = { content: body.archiveContent ?? body.fileContent, name: body.archiveName ?? `材料需求報表_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })}.xlsx` };
        setFile(nextFile);
        setVendorFiles((body.files ?? []).map((item: { vendor: string; filename: string; fileContent: string }) => ({ vendor: item.vendor, name: item.filename, content: item.fileContent })));
        setMessage(`已匯出 ${body.orderIds.length} 張需求單；${body.advancedIds?.length ?? body.orderIds.length} 張轉為準備出貨，${body.reexportedIds?.length ?? 0} 張重新匯出並維持原狀態。可重新下載全部或個別廠商報表。`);
        try { downloadFile(nextFile); } catch { /* Retain the generated file for manual download. */ }
      } else setMessage(`已更新 ${body.orderIds.length} 張需求單為「${action.status === '處理中' ? '退回待修改' : action.status}」。`);
      const notice = auditPendingNotice(response); if (notice) setMessage(current => current + ' ' + notice);
      setSelected(new Set()); dialog.current?.close(); setAction(null);
      await refresh();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : '連線失敗，請重新整理後確認狀態。'); }
    finally { setBusy(false); }
  };
  return <main className={`page-frame review-frame ${selectedGroups.length ? 'review-has-selection' : ''}`}>
    <div className="page-heading"><div><h1 className="page-title">材料審核中心</h1><p className="page-subtitle">以整張需求單審核。同一張需求單的材料一起選取、一起更新狀態。</p></div><Link href="/" className="btn btn-secondary">管理工作總覽</Link></div>
    {message && <div role="status" className="feedback-success mb-5">{message}{file && <button className="mt-2 block font-bold underline" onClick={() => downloadFile(file)}>重新下載全部報表</button>}{vendorFiles.map((item) => <button key={item.vendor} className="mr-4 mt-2 font-bold underline" onClick={() => downloadFile(item)}>下載{item.vendor}報表</button>)}</div>}
    {error && <div className="feedback-error mb-5" role="alert">{error}<button className="ml-3 underline" onClick={() => void refresh()}>重新載入</button></div>}
    <FilterPanel count={Object.values(filters).filter(Boolean).length}><div className="filter-grid">
      {[{ key: 'company', field: 'reqCompany', label: '工班' }, { key: 'region', field: 'reqRegion', label: '地區' }, { key: 'vendor', field: 'vendor', label: '廠商' }].map(({ key, field, label }) => <label key={key}><span className="form-label">{label}</span><select aria-label={label} className="form-control" value={filters[key as keyof OrderFilters] || ''} onChange={(event) => updateFilter(key as keyof OrderFilters, event.target.value)}><option value="">全部{label}</option>{choices(field as 'reqCompany' | 'reqRegion' | 'vendor' | 'materialName').map((value) => <option key={value}>{value}</option>)}</select></label>)}
      <SearchSelect label="材料" value={filters.material || ''} options={choices('materialName').map((name) => ({ value: name, label: name }))} onChange={(value) => updateFilter('material', value)} emptyLabel="全部材料" />
      <label><span className="form-label">狀態</span><select className="form-control" value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)}><option value="">全部正式需求</option>{['處理中', '待審核', '退回待修改', '審核中', '準備出貨', '已送達'].map((value) => <option key={value} value={value}>{value === '處理中' ? '全部待處理（含退回）' : value}</option>)}</select></label>
      <label><span className="form-label">開始日期</span><input type="date" className="form-control" value={filters.startDate || ''} max={filters.endDate || undefined} onChange={(event) => updateFilter('startDate', event.target.value)} /></label>
      <label><span className="form-label">結束日期</span><input type="date" className="form-control" value={filters.endDate || ''} min={filters.startDate || undefined} onChange={(event) => updateFilter('endDate', event.target.value)} /></label>
      <label><span className="form-label">日期或單號</span><input className="form-control" placeholder="例如 2026/10/29；也可輸入單號" value={filters.search || ''} onChange={(event) => updateFilter('search', event.target.value)} /></label>
      <label><span className="form-label">排序</span><select className="form-control" value={sort} onChange={(event) => setSort(event.target.value)}><option value="asc">最早需求優先</option><option value="desc">最新需求優先</option></select></label>
      <button className="btn btn-quiet self-end" onClick={() => { setFilters({}); setSelected(new Set()); }}>清除篩選</button>
    </div></FilterPanel>
    {invalidRange && <p role="alert" className="feedback-error mb-5">開始日期不能晚於結束日期。</p>}
    <section className="export-strip"><div><h2 className="font-bold">匯出並準備出貨</h2><p className="mt-1 text-sm leading-6">目前範圍內有 <strong>{exportGroups.length} 張</strong>審核中單據，共 {exportGroups.reduce((sum, group) => sum + group.items.length, 0)} 筆材料。匯出範圍由篩選決定。</p></div><button className="btn btn-primary" disabled={!exportGroups.length || busy} onClick={() => open({ type: 'export', ids: exportGroups.map((group) => group.orderId), count: exportGroups.reduce((sum, group) => sum + group.items.length, 0), filters: { ...filters }, scope: 'filtered', advanceCount: exportGroups.length })}>匯出並轉準備出貨</button></section>
    <section className="bulk-bar" aria-label="整單批次操作">
      <label className="check-target"><input ref={allBox} type="checkbox" checked={selectable.length > 0 && selectedGroups.length === selectable.length} disabled={!selectable.length || busy} onChange={(event) => setSelected(event.target.checked ? new Set(selectable.map((group) => group.orderId)) : new Set())} /><span>全選本次範圍</span></label>
      <strong aria-live="polite">已選取 {selectedGroups.length} 張單</strong>
      <div className="bulk-actions flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy || !canExportSelected} onClick={() => open({ type: 'export', scope: 'selected', ids: selectedGroups.map((group) => group.orderId), count: selectedGroups.reduce((sum, group) => sum + group.items.length, 0), advanceCount: selectedGroups.filter((group) => group.status === '審核中').length })}>匯出勾選單據</button>
        <button className="btn btn-secondary" disabled={busy || !canApply('審核中')} onClick={() => open({ type: 'status', status: '審核中', ids: selectedGroups.map((group) => group.orderId) })}>開始審核</button>
        <button className="btn btn-secondary" disabled={busy || !canApply('已送達')} onClick={() => open({ type: 'status', status: '已送達', ids: selectedGroups.map((group) => group.orderId) })}>標記已送達</button>
        <button className="btn btn-danger" disabled={busy || !canApply('處理中')} onClick={() => open({ type: 'status', status: '處理中', ids: selectedGroups.map((group) => group.orderId) })}>退回修改</button>
      </div>
    </section>
    {selectedGroups.length > 0 && <div className="mobile-review-actions" aria-label="已選單據操作"><strong>已選 {selectedGroups.length} 張</strong><button className="btn btn-primary" disabled={busy || !canApply('審核中')} onClick={() => open({ type: 'status', status: '審核中', ids: selectedGroups.map((group) => group.orderId) })}>開始審核</button><details ref={mobileMore} className="mobile-review-more"><summary className="btn btn-secondary">更多操作</summary><div><button className="btn btn-secondary" disabled={busy || !canExportSelected} onClick={() => open({ type: 'export', scope: 'selected', ids: selectedGroups.map((group) => group.orderId), count: selectedGroups.reduce((sum, group) => sum + group.items.length, 0), advanceCount: selectedGroups.filter((group) => group.status === '審核中').length })}>匯出勾選單據</button><button className="btn btn-secondary" disabled={busy || !canApply('已送達')} onClick={() => open({ type: 'status', status: '已送達', ids: selectedGroups.map((group) => group.orderId) })}>標記已送達</button><button className="btn btn-danger" disabled={busy || !canApply('處理中')} onClick={() => open({ type: 'status', status: '處理中', ids: selectedGroups.map((group) => group.orderId) })}>退回修改</button><p className="field-hint">套用到勾選的完整單據；不符合階段的操作會停用。</p></div></details></div>}
    <p className="mb-5 text-sm leading-6 text-[var(--muted)]">共 {visible.length} 張需求單。材料與廠商篩選會保留符合單據的全部材料；更換篩選後會清除勾選。勾選匯出可重新產生準備出貨、已送達的報表，維持原狀態。每次最多匯出 200 張單。</p>
    {loading ? <LoadingState label="正在讀取需求單…" /> : !visible.length ? <div className="surface empty-state">目前沒有符合條件的正式需求單。</div> : <div id="review-results" className="space-y-6">{pagination.items.map((group) => <section key={group.orderId} data-order-id={group.orderId} className={`surface order-group ${selected.has(group.orderId) ? 'order-selected' : ''}`}>
      <header className="order-group-heading">
        <label className="check-target order-select"><input type="checkbox" checked={selected.has(group.orderId)} disabled={busy || !group.consistent} onChange={() => toggle(group.orderId)} aria-label={`選取整張需求單 ${group.orderId}，共 ${group.items.length} 筆材料`} /><span className="sr-only">選取整單</span></label>
        <div className="min-w-0 flex-1"><h2 className="order-date font-bold">{group.first.orderDate}</h2><p className="order-reference">單號：{group.orderId}</p><p className="mt-1 text-sm text-[var(--muted)]">{group.items.length} 筆材料{orderPresentation(group).label === '待審核' ? ` · 等待 ${waitingDays(group.first.orderDate)} 天` : orderPresentation(group).label === '退回待修改' ? ' · 等待工班補件' : ''}</p></div>
        <div className="order-company"><strong>{[group.first.reqRegion, group.first.reqCompany].filter(Boolean).join(' · ')}</strong><span className="mt-1 block text-sm text-[var(--muted)]">申請人：{group.first.reqUser}</span></div>
        <div><span className={`status status-${orderPresentation(group).tone}`}>{orderPresentation(group).label}</span>{group.first.adminUser && <span className="mt-1 block text-xs text-[var(--muted)]">審核：{group.first.adminUser}</span>}{group.first.expectedDate && <span className="mt-1 block text-xs text-[var(--muted)]">預計交期 {group.first.expectedDate}</span>}</div>
        {group.consistent && ['處理中', '審核中'].includes(group.status) && <button type="button" className="icon-button" aria-label={`編輯需求單 ${group.orderId}`} title="編輯需求單" disabled={busy} onClick={() => setEditing(group)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m16 3 5 5M4 16 16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>}
      </header>
      {group.first.returnNote && <p className="order-return-note">{group.first.returnNote}</p>}
      {!group.consistent && <p className="feedback-error m-4" role="alert">此單的材料狀態或工班不一致，暫停操作，請管理者確認原始資料。</p>}
      <div className="order-items-header" aria-hidden="true"><span>材料品項／廠商</span><span>需求數量</span><span>備註與退回原因</span></div>
      <ul>{group.items.map((item, index) => <li className="order-item" key={index}><div className="min-w-0"><p className="font-bold leading-6">{item.materialName}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.vendor || '未指定廠商'}</p></div><p className="quantity-value">{item.quantity.toLocaleString('zh-TW')} <span>{item.unit}</span></p><div className="min-w-0 text-sm leading-6"><p className="break-words text-[var(--muted)]">{item.remarks || '無備註'}</p>{item.adminNote && <p className="mt-2 break-words text-[var(--danger)]">{item.adminNote}</p>}</div></li>)}</ul>
    </section>)}</div>}
    {editing && <AdminOrderEditor group={editing} onClose={() => setEditing(null)} onSaved={async (notice) => { setSelected(new Set()); setMessage('管理員修改已儲存，單據進度維持不變。' + (notice || '')); await refresh(); }} />}
    <Pagination {...pagination} label="審核需求單" targetId="review-results" /><BackToTop />
    <dialog ref={dialog} className="action-dialog" aria-labelledby="action-title" onCancel={(event) => { if (busy) event.preventDefault(); else setAction(null); }}>
      {action && <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <h2 className="section-title" id="action-title" tabIndex={-1} autoFocus>{action.type === 'export' ? action.advanceCount ? '確認匯出並準備出貨' : '確認重新匯出' : action.status === '處理中' ? '退回需求單' : `確認變更為${action.status}`}</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{action.type === 'export' ? `將匯出 ${action.ids.length} 張需求單、共 ${action.count} 筆材料，分別產生伸泰與益詮報表。其中 ${action.advanceCount} 張審核中單據會轉為「準備出貨」；其他單據維持原狀態。` : `此操作會更新 ${action.ids.length} 張需求單的全部材料。`}</p>
        {action.type === 'status' && action.status === '處理中' && <label className="mt-5 block"><span className="form-label">退回原因（必填）</span><textarea required maxLength={500} name="returnReason" aria-describedby={actionError ? 'review-action-error' : undefined} className="form-control min-h-28" value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="例如：請確認第二筆材料的規格…" /></label>}
        {action.type === 'status' && action.status === '處理中' && <fieldset className="return-targets"><legend className="form-label">退回原因顯示位置</legend><label className="check-target"><input type="radio" name="return-mode" checked={returnMode === 'order'} onChange={() => setReturnMode('order')} />單據上方顯示一次</label><label className="check-target"><input type="radio" name="return-mode" checked={returnMode === 'material'} onChange={() => setReturnMode('material')} />只顯示在指定材料</label>{returnMode === 'material' && <div className="return-materials">{groupOrders(orders).filter((group) => action.ids.includes(group.orderId)).map((group) => <fieldset key={group.orderId}><legend>{group.first.orderDate} · {group.first.reqCompany}（每單至少選一筆）<span className="order-reference">單號：{group.orderId}</span></legend>{group.items.map((item, index) => <label className="check-target" key={item.lineId}><input type="checkbox" checked={returnTargets.has(item.lineId)} onChange={() => setReturnTargets((current) => { const changed = new Set(current); if (changed.has(item.lineId)) changed.delete(item.lineId); else changed.add(item.lineId); return changed; })} /><span>第 {index + 1} 筆 · {item.materialName} · {item.quantity} {item.unit}</span></label>)}</fieldset>)}</div>}</fieldset>}
        {action.type === 'export' && action.advanceCount > 0 && <label className="mt-5 block"><span className="form-label">預計交期（選填）</span><input type="date" className="form-control" value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} /></label>}
        {actionError && <p id="review-action-error" className="feedback-error mt-4" role="alert">{actionError}</p>}
        <div className="dialog-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>取消</button><button type="submit" className={`btn ${action.type === 'status' && action.status === '處理中' ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>{busy ? '處理中…' : action.type === 'export' ? action.advanceCount ? '確認匯出並轉準備出貨' : '確認重新匯出' : '確認更新'}</button></div>
      </form>}
    </dialog>
  </main>;
}

export default function ReviewPage() { return <Suspense fallback={<p className="page-frame" role="status">正在讀取篩選條件…</p>}><ReviewContent /></Suspense>; }
