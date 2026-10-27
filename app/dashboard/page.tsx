'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useOrders } from '@/components/useOrders';
import { useAccount } from '@/components/AppShell';
import { filterOrderGroups, groupOrders, isReturnedOrder, orderPresentation, type OrderFilters } from '@/lib/order-view';
import FilterPanel from '@/components/FilterPanel';
import Pagination, { usePagination } from '@/components/Pagination';
import BackToTop from '@/components/BackToTop';

type HistoryAction = { id: string; type: 'delete' | 'submit' };
export default function HistoryPage() {
  const { orders, loading, error, refresh } = useOrders();
  const account = useAccount();
  const [tab, setTab] = useState<'active' | 'archive' | 'draft'>('active');
  const [filters, setFilters] = useState<OrderFilters>({});
  const [action, setAction] = useState<HistoryAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const groups = groupOrders(orders);
  const invalidRange = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const tabs = [
    { id: 'active' as const, label: '進行中', matches: (status: string) => !['編輯中', '準備出貨', '已送達'].includes(status) },
    { id: 'draft' as const, label: '草稿', matches: (status: string) => status === '編輯中' },
    { id: 'archive' as const, label: '出貨與完成', matches: (status: string) => ['準備出貨', '已送達'].includes(status) },
  ];
  const tabGroups = groups.filter((group) => tabs.find((entry) => entry.id === tab)!.matches(group.status));
  const priority = (group: (typeof groups)[number]) => !group.consistent ? -1 : isReturnedOrder(group) ? 0 : group.status === '處理中' ? 1 : 2;
  const filtered = invalidRange ? [] : filterOrderGroups(tabGroups, filters).sort((a, b) => (tab === 'active' ? priority(a) - priority(b) : 0) || b.first.orderDate.localeCompare(a.first.orderDate));
  const pagination = usePagination(filtered, JSON.stringify([tab, filters]));
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
      setFeedback(action.type === 'delete' ? '需求單已刪除。' : '草稿已正式送出。');
      dialog.current?.close(); setAction(null); await refresh();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : '連線失敗，請再試一次。'); }
    finally { setBusy(false); }
  };
  return <main className="page-frame">
    <div className="page-heading"><div><h1 className="page-title">歷史需求單</h1><p className="page-subtitle">{account?.company ? `${account.company}工班共用的需求單與草稿。` : '查看所屬工班的需求單與草稿。'}審核中的單據已鎖定，無法修改。</p></div><Link className="btn btn-primary" href="/request">建立訂單</Link></div>
    <div className="history-tabs" role="tablist" aria-label="需求單類別">{tabs.map((entry) => <button key={entry.id} role="tab" id={`${entry.id}-tab`} aria-controls="history-panel" aria-selected={tab === entry.id} onClick={() => { setTab(entry.id); setFilters({}); }}>{entry.label}（{groups.filter((group) => entry.matches(group.status)).length}）</button>)}</div>
    {tab === 'active' && <div className="history-status-filters" role="group" aria-label="進行中狀態">{['', '退回待修改', '待審核', '審核中'].map((status) => <button key={status} className="btn btn-secondary" aria-pressed={(filters.status || '') === status} onClick={() => update('status', status)}>{status || '全部進行中'} <span>{status ? tabGroups.filter((group) => orderPresentation(group).label === status).length : tabGroups.length}</span></button>)}</div>}
    <p className="mb-5 text-sm text-[var(--muted)]">{tab === 'active' ? '優先列出退回待修改的需求，其次為待審核、審核中。準備出貨與已送達請至「出貨與完成」查看。' : tab === 'draft' ? '尚未送出的工班草稿，可繼續修改或正式送出。' : '查看準備出貨與已送達的單據，也可以整單重訂。'}</p>
    {feedback && <p role="status" className="feedback-success mb-5">{feedback}</p>}
    {error && <p role="alert" className="feedback-error mb-5">{error}<button className="ml-3 underline" onClick={() => void refresh()}>重新載入</button></p>}
    <FilterPanel count={Object.values(filters).filter(Boolean).length}><div className="filter-grid">
      <label><span className="form-label">搜尋單號</span><input className="form-control" value={filters.search || ''} onChange={(event) => update('search', event.target.value)} placeholder="輸入單號" /></label>
      {tab === 'archive' && <label><span className="form-label">狀態</span><select className="form-control" value={filters.status || ''} onChange={(event) => update('status', event.target.value)}><option value="">全部出貨與完成</option>{['準備出貨', '已送達'].map((value) => <option key={value}>{value}</option>)}</select></label>}
      <label><span className="form-label">開始日期</span><input type="date" className="form-control" value={filters.startDate || ''} max={filters.endDate || undefined} onChange={(event) => update('startDate', event.target.value)} /></label>
      <label><span className="form-label">結束日期</span><input type="date" className="form-control" value={filters.endDate || ''} min={filters.startDate || undefined} onChange={(event) => update('endDate', event.target.value)} /></label>
      <button className="btn btn-quiet self-end" onClick={() => setFilters({})}>清除篩選</button>
    </div></FilterPanel>
    {invalidRange && <p className="feedback-error mb-5" role="alert">開始日期不能晚於結束日期。</p>}
    <div id="history-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {loading ? <p role="status">正在整理工班需求單…</p> : !filtered.length ? <section className="surface empty-state">{tab === 'draft' ? '目前沒有符合條件的草稿。' : '目前沒有符合條件的正式需求單。'}</section> : <div className="space-y-6">{pagination.items.map((group) => {
        const editable = group.consistent && ['編輯中', '處理中'].includes(group.status);
        const presentation = orderPresentation(group);
        return <section className="surface order-group" key={group.orderId}>
          <header className="order-group-heading"><div className="min-w-0 flex-1"><h2 className="order-number font-bold">{group.orderId}</h2><p className="mt-1 text-sm text-[var(--muted)]">{group.first.orderDate} · {group.first.reqUser} · {group.items.length} 筆材料</p>{group.status === '編輯中' && <p className="mt-2 font-semibold">{group.first.draftName || '未命名草稿'}</p>}</div><span className={`status status-${presentation.tone}`}>{presentation.label}</span></header>
          {group.first.returnNote && <p className="order-return-note">{group.first.returnNote}</p>}
          <ul>{group.items.map((item, index) => <li className="order-item" key={index}><div><p className="font-bold leading-6">{item.materialName}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.vendor || '未指定廠商'}</p></div><p className="quantity-value">{item.quantity.toLocaleString('zh-TW')} <span>{item.unit}</span></p><div className="break-words text-sm leading-6 text-[var(--muted)]"><p>{item.remarks || '無備註'}</p>{item.adminNote && <p className="mt-2 text-[var(--danger)]">{item.adminNote}</p>}</div></li>)}</ul>
          <footer className="flex flex-wrap gap-3 border-t border-[var(--line)] p-4"><Link className="btn btn-secondary" href={`/request?loadOrderId=${encodeURIComponent(group.orderId)}&action=${editable ? 'edit' : 'reorder'}`}>{editable ? '修改單據' : '整單重訂'}</Link>{group.consistent && group.status === '編輯中' && <button className="btn btn-primary" disabled={busy} onClick={() => open({ id: group.orderId, type: 'submit' })}>正式送出</button>}{editable && <button className="btn btn-danger" disabled={busy} onClick={() => open({ id: group.orderId, type: 'delete' })}>刪除單據</button>}{group.first.expectedDate && <p className="self-center text-sm text-[var(--muted)]">預計送達：{group.first.expectedDate}</p>}</footer>
        </section>;
      })}</div>}
    </div>
    <Pagination {...pagination} label="歷史需求單" targetId="history-panel" /><BackToTop />
    <dialog ref={dialog} className="action-dialog" aria-labelledby="history-action-title" onCancel={(event) => { if (busy) event.preventDefault(); else setAction(null); }}>
      <form onSubmit={(event) => { event.preventDefault(); void execute(); }}><h2 className="section-title" id="history-action-title">{action?.type === 'delete' ? '確認刪除需求單' : '確認正式送出草稿'}</h2><p className="mt-3 break-words text-sm leading-7">{action?.id}{action?.type === 'delete' ? ' 的全部材料都會刪除。' : ' 的全部材料將送至管理者審核。'}</p>{actionError && <p role="alert" className="feedback-error mt-4">{actionError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { dialog.current?.close(); setAction(null); }}>取消</button><button type="submit" className={`btn ${action?.type === 'delete' ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>{busy ? '處理中…' : action?.type === 'delete' ? '確認刪除' : '確認送出'}</button></div></form>
    </dialog>
  </main>;
}
