'use client';
import { auditPendingNotice } from '@/lib/mutation-notice';


import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useOrders } from '@/components/useOrders';
import { useAccount } from '@/components/AppShell';
import { filterOrderGroups, groupOrders, isReturnedOrder, orderPresentation, type OrderFilters } from '@/lib/order-view';
import FilterPanel from '@/components/FilterPanel';
import Pagination, { usePagination } from '@/components/Pagination';
import LoadingState from '@/components/LoadingState';
import BackToTop from '@/components/BackToTop';

type HistoryAction = { id: string; type: 'delete' | 'submit' };
function HistoryEntry() { const params = useSearchParams(); return <HistoryPage key={params.toString()} />; }
export default function HistoryRoute() { return <Suspense fallback={<LoadingState label="正在讀取需求單…" />}><HistoryEntry /></Suspense>; }
function HistoryPage() {
  const params = useSearchParams();
  const targetOrder = params.get('order') || '';
  const { orders, loading, error, refresh } = useOrders();
  const account = useAccount();
  const [tabOverride, setTab] = useState<'active' | 'archive' | 'draft' | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({ search: targetOrder });
  const [sort, setSort] = useState('priority');
  const [action, setAction] = useState<HistoryAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const groups = groupOrders(orders);
  const targetStatus = groups.find(group => group.orderId === targetOrder)?.status;
  const tab = tabOverride ?? (params.get('tab') === 'draft' || targetStatus === '編輯中' ? 'draft' : ['準備出貨', '已送達'].includes(targetStatus || '') ? 'archive' : 'active');
  const invalidRange = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const tabs = [
    { id: 'active' as const, label: '進行中', matches: (status: string) => !['編輯中', '準備出貨', '已送達'].includes(status) },
    { id: 'draft' as const, label: '草稿', matches: (status: string) => status === '編輯中' },
    { id: 'archive' as const, label: '準備出貨／已送達', matches: (status: string) => ['準備出貨', '已送達'].includes(status) },
  ];
  const tabGroups = groups.filter((group) => tabs.find((entry) => entry.id === tab)!.matches(group.status));
  const priority = (group: (typeof groups)[number]) => !group.consistent ? -1 : isReturnedOrder(group) ? 0 : group.status === '處理中' ? 1 : 2;
  const materialMatches = (name: string) => (filters.material || '').trim().toLowerCase().split(/\s+/).every((token) => name.toLowerCase().includes(token));
  const filtered = invalidRange ? [] : filterOrderGroups(tabGroups.filter((group) => !filters.material || group.items.some((item) => materialMatches(item.materialName))), { ...filters, material: '' }).sort((a, b) => (sort === 'priority' && tab === 'active' ? priority(a) - priority(b) : 0) || (sort === 'asc' ? a.first.orderDate.localeCompare(b.first.orderDate) : b.first.orderDate.localeCompare(a.first.orderDate)) || a.orderId.localeCompare(b.orderId));
  const pagination = usePagination(filtered, JSON.stringify([tab, filters, sort]));
  const update = (key: keyof OrderFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const open = (next: HistoryAction) => { setAction(next); setActionError(''); dialog.current?.showModal(); };
  const execute = async () => {
    if (!action || busy) return;
    setBusy(true); setActionError('');
    try {
      const response = await fetch(action.type === 'delete' ? '/api/orders/delete-item' : '/api/orders/edit-item', {
        method: action.type === 'delete' ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.type === 'delete' ? { orderId: action.id, deleteType: 'order' } : { orderId: action.id, newStatus: '處理中' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '操作失敗，請稍後再試。');
      setFeedback((action.type === 'delete' ? '需求單已刪除。' : '草稿已正式送出。') + auditPendingNotice(response));
      dialog.current?.close(); setAction(null); await refresh();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : '連線失敗，請再試一次。'); }
    finally { setBusy(false); }
  };
  return <main className="page-frame">
    <div className="page-heading"><div><h1 className="page-title">歷史需求單</h1><p className="page-subtitle">{account?.company ? `${account.company}工班共用的需求單與草稿。` : '查看所屬工班的需求單與草稿。'}審核中的單據已鎖定，無法修改。</p></div><Link className="btn btn-primary" href="/request">建立材料需求</Link></div>
    <div className="history-tabs" role="tablist" aria-label="需求單類別">{tabs.map((entry, index) => <button key={entry.id} role="tab" id={`${entry.id}-tab`} tabIndex={tab === entry.id ? 0 : -1} aria-controls="history-panel" aria-selected={tab === entry.id} onClick={() => { setTab(entry.id); setFilters({}); }} onKeyDown={(event) => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
      if (next < 0) return;
      event.preventDefault(); setTab(tabs[next].id); setFilters({}); document.getElementById(`${tabs[next].id}-tab`)?.focus();
    }}>{entry.label}（{groups.filter((group) => entry.matches(group.status)).length}）</button>)}</div>
    {tab === 'active' && <div className="history-status-filters" role="group" aria-label="進行中狀態">{['', '退回待修改', '待審核', '審核中'].map((status) => <button key={status} className="btn btn-secondary" aria-pressed={(filters.status || '') === status} onClick={() => update('status', status)}>{status || '全部進行中'} <span>{status ? tabGroups.filter((group) => orderPresentation(group).label === status).length : tabGroups.length}</span></button>)}</div>}
    <p className="mb-5 text-sm text-[var(--muted)]">{tab === 'active' ? `${sort === 'priority' ? '優先列出退回待修改的需求，其次為待審核、審核中。' : '依送出／更新時間排序。'}準備出貨與已送達請至「準備出貨／已送達」查看。` : tab === 'draft' ? '尚未送出的工班草稿，可繼續修改或正式送出。' : '查看準備出貨與已送達的單據，也可以再訂一次。'}</p>
    {feedback && <p role="status" className="feedback-success mb-5">{feedback}</p>}
    {error && <p role="alert" className="feedback-error mb-5">{error}<button className="ml-3 underline" onClick={() => void refresh()}>重新載入</button></p>}
    <FilterPanel count={Object.values(filters).filter(Boolean).length}><div className="filter-grid">
      {tab === 'archive' && <label><span className="form-label">需求狀態</span><select className="form-control" value={filters.status || ''} onChange={(event) => update('status', event.target.value)}><option value="">全部準備出貨／已送達</option>{['準備出貨', '已送達'].map((value) => <option key={value}>{value}</option>)}</select></label>}
      <label><span className="form-label">搜尋材料</span><input className="form-control" value={filters.material || ''} onChange={(event) => update('material', event.target.value)} placeholder="輸入名稱或規格…" /></label><div className="date-range-fields" role="group" aria-label="需求日期範圍"><label><span className="form-label">開始日期</span><input type="date" className="form-control" value={filters.startDate || ''} max={filters.endDate || undefined} onChange={(event) => update('startDate', event.target.value)} /></label>
      <label><span className="form-label">結束日期</span><input type="date" className="form-control" value={filters.endDate || ''} min={filters.startDate || undefined} onChange={(event) => update('endDate', event.target.value)} /></label></div>
      <label><span className="form-label">日期或單號</span><input className="form-control" value={filters.search || ''} onChange={(event) => update('search', event.target.value)} placeholder="例如 2026/10/29；也可輸入單號" /></label>
      <label><span className="form-label">排序</span><select className="form-control" value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">{tab === 'active' ? '待處理狀態優先（預設）' : '最新需求優先（預設）'}</option><option value="asc">最早需求優先</option><option value="desc">最新需求優先</option></select></label>
      <button className="btn btn-quiet self-end" onClick={() => setFilters({})}>清除篩選</button>
    </div></FilterPanel>
    {invalidRange && <p className="feedback-error mb-5" role="alert">開始日期不能晚於結束日期。</p>}
    <div id="history-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {loading ? <LoadingState label="正在整理工班需求單…" /> : !filtered.length ? <section className="surface empty-state">{tab === 'draft' ? '目前沒有符合條件的草稿。' : '目前沒有符合條件的正式需求單。'}</section> : <div className="space-y-6">{pagination.items.map((group) => {
        const editable = group.consistent && ['編輯中', '處理中'].includes(group.status);
        const presentation = orderPresentation(group);
        return <section className="surface order-group" key={group.orderId} data-order-id={group.orderId}>
          <header className="order-group-heading"><div className="min-w-0 flex-1"><h2 className="order-date font-bold">{group.first.orderDate}</h2><p className="order-reference">單號：{group.orderId}</p><p className="mt-1 text-sm text-[var(--muted)]">{group.first.reqUser} · {group.items.length} 筆材料</p>{group.status === '編輯中' && <p className="mt-2 font-semibold">{group.first.draftName || '未命名草稿'}</p>}</div><span className={`status status-${presentation.tone}`}>{presentation.label}</span></header>
          {group.first.returnNote && <p className="order-return-note">{group.first.returnNote}</p>}
          <ul>{group.items.map((item, index) => <li className="order-item history-material-item" key={index}><div><p className="font-bold leading-6">{item.materialName}：<span className="history-inline-quantity">{item.quantity.toLocaleString('zh-TW')} <small>{item.unit}</small></span></p></div><div className="break-words text-sm leading-6 text-[var(--muted)]"><p>{item.remarks || '無備註'}</p>{item.adminNote && <p className="mt-2 text-[var(--danger)]">{item.adminNote}</p>}</div></li>)}</ul>
          <footer className="flex flex-wrap gap-3 border-t border-[var(--line)] p-4"><Link className="btn btn-secondary" href={`/request?loadOrderId=${encodeURIComponent(group.orderId)}&action=${editable ? 'edit' : 'reorder'}`}>{editable ? '修改單據' : '再訂一次'}</Link>{group.consistent && group.status === '編輯中' && <button className="btn btn-primary" disabled={busy} onClick={() => open({ id: group.orderId, type: 'submit' })}>正式送出</button>}{editable && <button className="btn btn-danger" disabled={busy} onClick={() => open({ id: group.orderId, type: 'delete' })}>刪除單據</button>}{group.first.expectedDate && <p className="self-center text-sm text-[var(--muted)]">預計交期：{group.first.expectedDate}</p>}</footer>
        </section>;
      })}</div>}
    </div>
    <Pagination {...pagination} label="歷史需求單" targetId="history-panel" /><BackToTop />
    <dialog ref={dialog} className="action-dialog" aria-labelledby="history-action-title" onCancel={(event) => { if (busy) event.preventDefault(); else setAction(null); }}>
      <form onSubmit={(event) => { event.preventDefault(); void execute(); }}><h2 className="section-title" id="history-action-title">{action?.type === 'delete' ? '確認刪除需求單' : '確認正式送出草稿'}</h2><p className="mt-3 break-words text-sm leading-7">{groups.find(group => group.orderId === action?.id)?.first.orderDate} 的需求單{action?.type === 'delete' ? '全部材料都會刪除。' : '全部材料將送至管理者審核。'}</p><p className="order-reference">單號：{action?.id}</p>{actionError && <p role="alert" className="feedback-error mt-4">{actionError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { dialog.current?.close(); setAction(null); }}>取消</button><button type="submit" className={`btn ${action?.type === 'delete' ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>{busy ? '處理中…' : action?.type === 'delete' ? '確認刪除' : '確認送出'}</button></div></form>
    </dialog>
  </main>;
}
