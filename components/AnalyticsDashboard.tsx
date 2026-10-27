'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from '@/components/AppShell';
import { useOrders } from '@/components/useOrders';
import { summarizeMaterials } from '@/lib/order-view';
import FilterPanel from '@/components/FilterPanel';
import Pagination, { usePagination } from '@/components/Pagination';
import BackToTop from '@/components/BackToTop';
import SearchSelect from '@/components/SearchSelect';

export default function AnalyticsDashboard() {
  const account = useAccount();
  const admin = account?.role === 'Admin';
  const { orders, loading, error, refresh } = useOrders(admin);
  const [material, setMaterial] = useState('');
  const [company, setCompany] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState('');
  const formal = orders.filter((row) => row.status !== '編輯中');
  const materials = [...new Set(formal.map((row) => row.materialName))].sort((a, b) => a.localeCompare(b, 'zh-TW'));
  const companies = [...new Set(formal.map((row) => row.reqCompany))].sort();
  const invalidRange = Boolean(start && end && start > end);
  const filtered = invalidRange ? [] : formal.filter((row) => (!material || row.materialName === material) && (!admin || !company || row.reqCompany === company) && (!start || row.orderDate.slice(0, 10) >= start) && (!end || row.orderDate.slice(0, 10) <= end) && (!status || row.status === status));
  const summary = summarizeMaterials(filtered);
  const summaryPage = usePagination(summary, JSON.stringify([material, company, start, end, status]), 20);
  const companyNames = [...new Set(filtered.map((row) => row.reqCompany))].sort();
  const companyPage = usePagination(companyNames, JSON.stringify([material, company, start, end, status]), 20);
  const orderCount = new Set(filtered.map((row) => row.orderId)).size;
  const trendMap = new Map<string, Set<string>>();
  filtered.forEach((row) => { const month = row.orderDate.slice(0, 7); const ids = trendMap.get(month) ?? new Set<string>(); ids.add(row.orderId); trendMap.set(month, ids); });
  const trend = [...trendMap].sort(([a], [b]) => a.localeCompare(b));
  const maxTrend = Math.max(1, ...trend.map(([, ids]) => ids.size));
  const maxFrequency = Math.max(1, ...summary.map((row) => row.frequency));

  return <main className="page-frame">
    <div className="page-heading"><div><h1 className="page-title">{admin ? '各工班材料總覽' : `${account?.company || '工班'}材料儀表板`}</h1><p className="page-subtitle">掌握材料的叫料頻率與需求數量，找出常用料件和需求變化。</p></div><Link href="/request" className="btn btn-primary">建立訂單</Link></div>
    <FilterPanel count={[material, company, start, end, status].filter(Boolean).length}><div className="filter-grid">
      <SearchSelect label="材料" value={material} options={materials.map((name) => ({ value: name, label: name }))} onChange={setMaterial} emptyLabel="全部材料" />
      {admin && <label><span className="form-label">工班</span><select className="form-control" value={company} onChange={(event) => setCompany(event.target.value)}><option value="">全部工班</option>{companies.map((name) => <option key={name}>{name}</option>)}</select></label>}
      <label><span className="form-label">開始日期</span><input type="date" className="form-control" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} /></label>
      <label><span className="form-label">結束日期</span><input type="date" className="form-control" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></label>
      <label><span className="form-label">需求狀態</span><select className="form-control" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部正式需求</option>{['處理中', '審核中', '準備出貨', '已送達'].map((name) => <option key={name}>{name}</option>)}</select></label>
      <button className="btn btn-quiet self-end" onClick={() => { setMaterial(''); setCompany(''); setStart(''); setEnd(''); setStatus(''); }}>清除篩選</button>
    </div></FilterPanel>
    {invalidRange && <p role="alert" className="feedback-error mb-5">開始日期不能晚於結束日期。</p>}
    {error && <div className="feedback-error mb-5" role="alert">{error}<button className="ml-3 underline" onClick={() => void refresh()}>重新載入</button></div>}
    {loading ? <p role="status" className="py-10">正在整理材料統計…</p> : <>
      <div className="summary-strip" aria-live="polite"><div><span>正式需求單</span><strong>{orderCount}<small> 張</small></strong></div><div><span>材料種類</span><strong>{summary.length}<small> 種</small></strong></div><div><span>{admin ? '申請工班' : '統計範圍'}</span><strong className={admin ? '' : 'scope-label'}>{admin ? `${new Set(filtered.map((row) => row.reqCompany)).size} 家` : '整個工班'}</strong></div></div>
      <p className="mb-7 text-sm leading-6 text-[var(--muted)]">草稿不列入統計。叫料頻率以含有該材料的需求單數計算，同單重複材料只計一次；數量則逐筆加總，依單位分開。日期以最近送出／更新時間為準。</p>
      {!filtered.length ? <section className="surface empty-state"><h2 className="section-title">目前沒有符合範圍的正式需求</h2><p className="mt-2 text-[var(--muted)]">可以調整材料、日期或狀態篩選，或建立第一張需求單。</p></section> : <>
        <div className="analytics-grid">
          <section className="surface p-5 sm:p-6"><h2 className="section-title">常用材料</h2><p className="mt-1 text-sm text-[var(--muted)]">依叫料次數排序，顯示前 8 種材料。</p><ol className="mt-6 space-y-5">{summary.slice(0, 8).map((row) => <li key={JSON.stringify([row.name, row.unit])}><div className="mb-2 flex items-start justify-between gap-4 text-sm"><span className="min-w-0 font-semibold leading-6">{row.name} <span className="text-[var(--muted)]">({row.unit})</span></span><span className="shrink-0 tabular-nums">{row.frequency} 次</span></div><div className="chart-track" aria-hidden="true"><div className="chart-bar" style={{ width: `${row.frequency / maxFrequency * 100}%` }} /></div></li>)}</ol></section>
          <section className="surface p-5 sm:p-6"><h2 className="section-title">每月叫料趨勢</h2><p className="mt-1 text-sm text-[var(--muted)]">每月正式需求單數；沒有列出的月份為 0 張。</p><div className="mt-6 max-h-[440px] space-y-4 overflow-y-auto pr-1">{trend.map(([month, ids]) => <div className="trend-row" key={month}><span className="text-sm tabular-nums">{month}</span><div className="chart-track" aria-hidden="true"><div className="chart-bar chart-bar-green" style={{ width: `${ids.size / maxTrend * 100}%` }} /></div><strong className="text-right text-sm tabular-nums">{ids.size} 張</strong></div>)}</div></section>
        </div>
        <section id="material-statistics" className="surface mt-7 overflow-hidden"><div className="p-5 sm:p-6"><h2 className="section-title">材料需求明細統計</h2></div><p className="table-hint">左右滑動表格，查看完整欄位。</p><div className="table-scroll"><table className="data-table w-full text-left"><thead><tr><th scope="col">材料名稱</th><th scope="col">叫料次數</th><th scope="col">需求數量</th><th scope="col">單位</th></tr></thead><tbody>{summaryPage.items.map((row) => <tr key={JSON.stringify([row.name, row.unit])}><th scope="row" className="material-name">{row.name}</th><td className="tabular-nums">{row.frequency} 次</td><td className="tabular-nums font-bold">{row.quantity.toLocaleString('zh-TW')}</td><td>{row.unit}</td></tr>)}</tbody></table></div><Pagination {...summaryPage} label="材料統計" targetId="material-statistics" /></section>
        {admin && <section id="company-statistics" className="surface mt-7 overflow-hidden"><div className="p-5 sm:p-6"><h2 className="section-title">各工班彙總</h2></div><p className="table-hint">左右滑動表格，查看完整欄位。</p><div className="table-scroll"><table className="data-table w-full text-left"><thead><tr><th scope="col">工班</th><th scope="col">需求單數</th><th scope="col">材料種類</th><th scope="col">各單位需求量</th></tr></thead><tbody>{companyPage.items.map((name) => { const rows = filtered.filter((row) => row.reqCompany === name); const units = new Map<string, number>(); rows.forEach((row) => units.set(row.unit, (units.get(row.unit) ?? 0) + row.quantity)); return <tr key={name}><th scope="row" className="material-name">{name}</th><td>{new Set(rows.map((row) => row.orderId)).size} 張</td><td>{summarizeMaterials(rows).length} 種</td><td>{[...units].map(([unit, quantity]) => `${quantity.toLocaleString('zh-TW')} ${unit}`).join('、')}</td></tr>; })}</tbody></table></div><Pagination {...companyPage} label="工班統計" targetId="company-statistics" /></section>}
      </>}
    </>}
    <BackToTop />
  </main>;
}
