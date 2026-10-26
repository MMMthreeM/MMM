'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const getStatusStyle = (status: string) => {
  switch (status) {
    case '編輯中': return 'bg-[#edf1f4] text-[#536575]';
    case '處理中': return 'bg-[#e4f4fc] text-[#075a92]';
    case '審核中': return 'bg-[#fff4df] text-[#985600]';
    case '準備出貨': return 'bg-[#eff6e8] text-[#49623e]';
    case '已送達': return 'bg-[#e6f8ed] text-[#0b7540]';
    default: return 'bg-white text-[var(--ink)]';
  }
};

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [vendorFilter, setVendorFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateSort, setDateSort] = useState('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetch('/api/admin/orders').then(async res => {
      if (res.status === 403) { alert('權限不足'); window.location.href = '/'; return null; }
      return res.json();
    }).then(data => { if (data?.data) setOrders(data.data); setLoading(false); });
  }, []);

  const uniqueVendors = Array.from(new Set(orders.map(o => o.vendor).filter(Boolean)));
  const uniqueCompanies = Array.from(new Set(orders.map(o => o.reqCompany).filter(Boolean)));
  const uniqueRegions = Array.from(new Set(orders.map(o => o.reqRegion).filter(Boolean)));

  const handleStatusChange = async (orderId: string, materialName: string, newStatus: string) => {
    let finalStatus = newStatus; let adminNote = ''; let targetMaterials: string[] = []; let expectedDate = '';

    if (newStatus === '退回') {
      const reason = prompt(`輸入退回原因 [${materialName}]：`);
      if (!reason?.trim()) return alert('必須輸入原因');
      finalStatus = '處理中'; adminNote = reason; targetMaterials = [materialName];
    } else if (newStatus === '準備出貨') {
      const date = prompt(`輸入 [${orderId}] 預計交期 (略過請直接確定)：`);
      if (date) expectedDate = date.trim();
    } else if (!confirm(`確定變更單號 ${orderId} 狀態為「${newStatus}」？`)) return;

    try {
      const res = await fetch(`/api/admin/update-status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, status: finalStatus, adminNote, targetMaterials, expectedDate }) });
      const data = await res.json();
      if (res.ok) {
        setOrders(orders.map(o => o.orderId === orderId ? { ...o, status: finalStatus, adminUser: data.adminUser, adminNote: targetMaterials.includes(o.materialName) ? adminNote : '' } : o));
      }
    } catch (err) { alert('連線錯誤'); }
  };

  const handleBatchAction = async (actionStatus: string) => {
    if (selectedItems.size === 0) return;
    let finalStatus = actionStatus, adminNote = '';

    if (actionStatus === '退回') {
      const reason = prompt('輸入批次退回原因：');
      if (!reason?.trim()) return alert('必須輸入原因');
      finalStatus = '處理中'; adminNote = reason;
    } else if (!confirm(`確定將所選項目批次變更為「${actionStatus}」？`)) return;

    const grouped = Array.from(selectedItems).reduce((acc, item) => {
      const [oId, mName] = item.split('|||');
      if (!acc[oId]) acc[oId] = []; acc[oId].push(mName); return acc;
    }, {} as Record<string, string[]>);

    try {
      const results = await Promise.all(Object.entries(grouped).map(([oId, targetMaterials]) => 
        fetch(`/api/admin/update-status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: oId, status: finalStatus, adminNote, targetMaterials: actionStatus === '退回' ? targetMaterials : [] }) }).then(r => r.json())
      ));
      const adminUser = results[0]?.adminUser || '';
      setOrders(orders.map(o => grouped[o.orderId] ? { ...o, status: finalStatus, adminUser, adminNote: grouped[o.orderId].includes(o.materialName) && actionStatus === '退回' ? adminNote : '' } : o));
      setSelectedItems(new Set());
    } catch (err) { alert('連線錯誤'); }
  };

  const handleExport = async () => { 
     if (filteredOrders.length === 0) return alert('無資料匯出');
     try {
       const res = await fetch('/api/admin/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filteredData: filteredOrders }) });
       const data = await res.json();
       if (res.ok && data.fileContent) {
         const byteChars = atob(data.fileContent); const byteNums = new Array(byteChars.length);
         for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
         const link = document.createElement('a'); link.href = window.URL.createObjectURL(new Blob([new Uint8Array(byteNums)]));
         link.setAttribute('download', '材料需求報表.xlsx'); document.body.appendChild(link); link.click(); document.body.removeChild(link);
       }
     } catch (err) {}
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (vendorFilter && o.vendor !== vendorFilter) return false;
    if (companyFilter && o.reqCompany !== companyFilter) return false;
    if (regionFilter && o.reqRegion !== regionFilter) return false;
    const oDate = o.orderDate?.split(' ')[0] || '';
    if (startDate && oDate < startDate) return false;
    if (endDate && oDate > endDate) return false;
    return true;
  }).sort((a, b) => dateSort === 'desc' ? (b.orderDate || '').localeCompare(a.orderDate || '') : (a.orderDate || '').localeCompare(b.orderDate || ''));

  return (
    <main className="app-shell"><div className="page-frame max-w-[1600px] pb-32">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><Link href="/" className="mb-3 inline-block text-sm font-bold text-[var(--delta-blue-strong)] hover:underline">← 返回申請端</Link><h1 className="page-title">材料審核中心</h1><p className="page-subtitle">篩選需求、批次調整進度，並匯出供廠商下單的報表。</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="btn btn-primary">匯出報表</button>
          <Link href="/" className="btn btn-secondary">返回前台</Link>
        </div>
      </div>
      
      {/* 💡 Sticky Bulk Action Bar */}
      <section className="sticky top-3 z-30 mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-[#0c659e] bg-[#075f9a] p-3.5 text-white shadow-[0_10px_24px_rgba(0,83,143,.18)]">
        <div className="rounded-lg bg-white/15 px-3 py-2 text-sm font-bold">已選取 {selectedItems.size} 項</div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => handleBatchAction('審核中')} disabled={selectedItems.size===0} className="rounded-lg border border-white/70 px-3 py-2 text-sm font-bold hover:bg-white hover:text-[#075f9a] disabled:cursor-not-allowed disabled:opacity-35">設為審核中</button>
          <button onClick={() => handleBatchAction('準備出貨')} disabled={selectedItems.size===0} className="rounded-lg border border-white/70 px-3 py-2 text-sm font-bold hover:bg-white hover:text-[#075f9a] disabled:cursor-not-allowed disabled:opacity-35">設為準備出貨</button>
          <button onClick={() => handleBatchAction('已送達')} disabled={selectedItems.size===0} className="rounded-lg border border-white/70 px-3 py-2 text-sm font-bold hover:bg-white hover:text-[#075f9a] disabled:cursor-not-allowed disabled:opacity-35">設為已送達</button>
          <button onClick={() => handleBatchAction('退回')} disabled={selectedItems.size===0} className="ml-auto rounded-lg bg-white px-3 py-2 text-sm font-bold text-[var(--danger)] hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-35">退回項目</button>
        </div>
      </section>

      <section className="surface mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="form-label">廠商</label><select className="form-control" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}><option value="">全部廠商</option>{uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
        <div><label className="form-label">工班</label><select className="form-control" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}><option value="">全部工班</option>{uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label className="form-label">狀態</label><select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">全部狀態</option><option value="編輯中">草稿</option><option value="處理中">處理中</option><option value="審核中">審核中</option><option value="準備出貨">準備出貨</option><option value="已送達">已送達</option></select></div>
        <div><label className="form-label">排序</label><select className="form-control" value={dateSort} onChange={e => setDateSort(e.target.value)}><option value="desc">最新優先</option><option value="asc">最早優先</option></select></div>
      </section>

      <div className="surface overflow-x-auto">
        <table className="data-table w-full text-left border-collapse whitespace-nowrap text-sm">
          <thead>
            <tr>
              <th className="p-3 border-b-2 border-gray-900 text-center w-12"><input type="checkbox" className="rounded-none border-0 text-blue-600 focus:ring-0 bg-white" onChange={(e) => { if (e.target.checked) { const newSet = new Set(selectedItems); filteredOrders.forEach(o => newSet.add(`${o.orderId}|||${o.materialName}`)); setSelectedItems(newSet); } else setSelectedItems(new Set()); }} /></th>
              <th className="p-3 border-b-2 border-gray-900 font-bold">單據識別</th>
              <th className="p-3 border-b-2 border-gray-900 font-bold">請購單位</th>
              <th className="p-3 border-b-2 border-gray-900 font-bold">品項細節</th>
              <th className="p-3 border-b-2 border-gray-900 font-bold">數量</th>
              <th className="p-3 border-b-2 border-gray-900 font-bold min-w-[200px]">附加資訊</th>
              <th className="p-3 border-b-2 border-gray-900 font-bold">狀態核定</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {filteredOrders.map((o, idx) => (
              <tr key={`${o.orderId}-${idx}`} className={`hover:bg-gray-50 ${o.status === '編輯中' ? 'bg-gray-100 opacity-60' : ''}`}>
                <td className="p-3 border-r border-gray-300 text-center"><input type="checkbox" className="rounded-none border-gray-400 text-black focus:ring-0 cursor-pointer" checked={selectedItems.has(`${o.orderId}|||${o.materialName}`)} onChange={() => { const k = `${o.orderId}|||${o.materialName}`; const s = new Set(selectedItems); s.has(k) ? s.delete(k) : s.add(k); setSelectedItems(s); }} /></td>
                <td className="p-3 border-r border-gray-300"><div className="font-mono font-bold text-gray-900">{o.orderId}</div><div className="text-xs text-gray-500 mt-1">{o.orderDate}</div></td>
                <td className="p-3 border-r border-gray-300"><div className="font-bold text-gray-900">{o.reqRegion} - {o.reqCompany}</div><div className="text-xs text-gray-500 mt-1">{o.reqUser.split('@')[0]}</div></td>
                <td className="p-3 border-r border-gray-300"><div className="font-bold text-gray-900">{o.materialName}</div><div className="inline-block mt-1 text-[10px] font-bold border border-gray-900 px-1 py-0.5 uppercase tracking-wide">{o.vendor || '未指定'}</div></td>
                <td className="p-3 border-r border-gray-300 font-mono font-bold text-lg text-gray-900">{o.quantity} <span className="text-xs font-sans font-medium text-gray-500">{o.unit}</span></td>
                <td className="p-3 border-r border-gray-300">
                  <div className="text-gray-700 truncate max-w-[200px]">{o.remarks || '-'}</div>
                  {o.adminNote && (
                    <div className={`mt-2 p-1.5 text-xs font-bold border-l-4 whitespace-normal max-w-[200px] ${o.adminNote.includes('[已重送]') ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-red-600 bg-red-50 text-red-900'}`}>
                      {!o.adminNote.includes('[已重送]') && '退回: '}
                      {o.adminNote}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-2 items-center flex-wrap">
                    <select className={`border-2 p-1.5 font-bold text-xs outline-none focus:border-black rounded-none cursor-pointer ${getStatusStyle(o.status)}`} value={o.status} onChange={(e) => handleStatusChange(o.orderId, o.materialName, e.target.value)}>
                      <option value="編輯中" disabled>編輯中 (草稿)</option>
                      <option value="處理中">處理中</option><option value="審核中">審核中</option><option value="準備出貨">準備出貨</option><option value="已送達">已送達</option><option value="退回">退回修改</option>
                    </select>
                    {o.adminUser && <span className="text-[10px] font-mono font-bold bg-gray-200 text-gray-800 px-2 py-1">審: {o.adminUser}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div></main>
  );
}
