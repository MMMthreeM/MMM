'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const getStatusStyle = (status: string, isReturned: boolean, isDraft: boolean) => {
  if (isDraft) return 'status-draft';
  if (isReturned) return 'status-returned';
  switch (status) {
    case '處理中': return 'status-processing';
    case '審核中': return 'status-review';
    case '準備出貨': return 'status-shipping';
    case '已送達': return 'status-delivered';
    default: return 'status-draft';
  }
};

export default function Dashboard() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); 

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/orders').then(res => res.json()).then(data => { if (data.data) setOrders(data.data); setLoading(false); });
    } else if (status === 'unauthenticated') setLoading(false);
  }, [status]);

  const handleLoadToCart = (orderId: string, action: 'edit' | 'reorder') => router.push(`/?loadOrderId=${orderId}&action=${action}`);
  const handleSubmitDraft = async (orderId: string) => {
    if (!confirm(`確定送出草稿 ${orderId}？`)) return;
    try {
      const res = await fetch('/api/orders/edit-item', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, newStatus: '處理中' }) });
      if (res.ok) { alert('送出成功'); setOrders(orders.map(o => o.orderId === orderId ? { ...o, status: '處理中', draftName: '' } : o)); }
    } catch (err) { alert('網路錯誤'); }
  };
  const handleDelete = async (orderId: string, deleteType: 'single' | 'order', materialName?: string) => {
    let actualDeleteType = deleteType;
    let msg = deleteType === 'single' ? (orders.filter(o => o.orderId === orderId).length === 1 ? `此為該訂單最後一項，將強制刪除整筆訂單，確定？` : `確定刪除 ${materialName}？`) : `確定刪除整筆訂單 ${orderId}？`;
    if (deleteType === 'single' && orders.filter(o => o.orderId === orderId).length === 1) actualDeleteType = 'order';
    if (!confirm(msg)) return;
    try {
      const res = await fetch('/api/orders/delete-item', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, materialName, deleteType: actualDeleteType }) });
      if (res.ok) {
        alert('刪除成功');
        setOrders(actualDeleteType === 'order' ? orders.filter(o => o.orderId !== orderId) : orders.filter(o => !(o.orderId === orderId && o.materialName === materialName)));
      }
    } catch (err) {}
  };

  if (status === 'loading' || loading) return <div className="page-frame text-center text-[var(--muted)]">正在整理您的需求單…</div>;

  const filteredOrders = orders.filter(o => {
    if (searchId && !o.orderId.toLowerCase().includes(searchId.toLowerCase())) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    const oDate = o.orderDate?.split(' ')[0] || '';
    if (startDate && oDate < startDate) return false;
    if (endDate && oDate > endDate) return false;
    return true;
  });

  const groupedOrders = filteredOrders.reduce((acc, o) => {
    if (!acc[o.orderId]) acc[o.orderId] = { orderDate: o.orderDate, reqUser: o.reqUser, status: o.status, adminNote: o.adminNote, draftName: o.draftName, items: [] };
    acc[o.orderId].items.push(o);
    if (o.adminNote) acc[o.orderId].adminNote = o.adminNote;
    if (o.draftName) acc[o.orderId].draftName = o.draftName;
    return acc;
  }, {} as Record<string, any>);

  return (
    <main className="app-shell"><div className="page-frame">
      <div className="mb-7 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div><Link href="/" className="mb-3 inline-block text-sm font-bold text-[var(--delta-blue-strong)] hover:underline">← 返回建立需求</Link><h1 className="page-title">歷史需求單</h1><p className="page-subtitle">查看目前進度、修改可編輯單據，或重用既有需求。</p></div>
        <Link href="/" className="btn btn-primary">建立新單</Link>
      </div>
      
      <section className="surface mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
        <div><label className="form-label">搜尋單號</label><input type="text" placeholder="輸入單號" className="form-control" value={searchId} onChange={e => setSearchId(e.target.value)} /></div>
        <div><label className="form-label">狀態</label>
          <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">全部</option><option value="編輯中">草稿</option><option value="處理中">處理中</option><option value="審核中">審核中</option><option value="準備出貨">準備出貨</option><option value="已送達">已送達</option>
          </select>
        </div>
        <div><label className="form-label">申請日期</label><div className="flex items-center gap-2"><input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} /><span className="text-sm text-[var(--muted)]">至</span><input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>
      </section>

      <div className="space-y-8">
        {Object.keys(groupedOrders).length === 0 ? <div className="surface p-12 text-center text-[var(--muted)]">目前沒有符合條件的需求單。</div> : 
          Object.keys(groupedOrders).map(orderId => {
            const group = groupedOrders[orderId];
            const isEditable = group.status === '編輯中' || group.status === '處理中';
            const isReturned = group.adminNote && group.status === '處理中' && !group.adminNote.includes('[已重送]');
            const statusStyle = getStatusStyle(group.status, isReturned, group.status === '編輯中');
            
            return (
              <section key={orderId} className="surface overflow-hidden">
                <div className="flex flex-col items-start justify-between gap-4 border-b border-[var(--line)] bg-[#fbfdfe] p-4 md:flex-row md:items-center md:p-5">
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-lg font-bold text-[var(--ink)]">{orderId}</span>
                      <span className={`status ${statusStyle}`}>
                        {group.status === '編輯中' ? `草稿: ${group.draftName || '未命名'}` : isReturned ? '退回需修改' : group.status}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--muted)]">{group.orderDate} · 申請人：{group.reqUser}</div>
                  </div>
                  <div className="flex flex-wrap gap-3 w-full md:w-auto mt-2 md:mt-0">
                    <button onClick={() => handleLoadToCart(orderId, isEditable ? 'edit' : 'reorder')} className="btn btn-secondary">
                      {isEditable ? '修改單據' : '整單重訂'}
                    </button>
                    {group.status === '編輯中' && <button onClick={() => handleSubmitDraft(orderId)} className="btn btn-primary">正式送出</button>}
                    {isEditable && <button onClick={() => handleDelete(orderId, 'order')} className="btn btn-danger">刪除單據</button>}
                  </div>
                </div>
                
                <div className="p-0">
                  <table className="data-table w-full text-left text-sm">
                    <tbody className="divide-y divide-gray-200">
                      {group.items.map((o: any, idx: number) => (
                        <tr key={idx}>
                          <td className="w-1/3 font-bold text-[var(--ink)]">{o.materialName}</td>
                          <td className="w-1/6 text-lg font-bold text-[var(--ink)]">{o.quantity} <span className="text-sm font-medium text-[var(--muted)]">{o.unit}</span></td>
                          <td className="w-1/3 text-[var(--muted)]">
                            <span className={!o.remarks ? 'text-[#94a4b0]' : ''}>{o.remarks || '無備註'}</span>
                            {o.adminNote && (
                              <div className={`mt-2 rounded-md p-2 text-sm font-bold ${o.adminNote.includes('[已重送]') ? 'bg-[#e4f4fc] text-[#075a92]' : 'bg-[#fff0f0] text-[#a32e33]'}`}>
                                {!o.adminNote.includes('[已重送]') && '退回原因: '}
                                {o.adminNote}
                              </div>
                            )}
                          </td>
                          <td className="w-1/6 text-right">
                            {isEditable && <button onClick={() => handleDelete(orderId, 'single', o.materialName)} className="text-xs font-bold text-[var(--danger)] hover:underline">移除</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        }
      </div>
    </div></main>
  );
}
