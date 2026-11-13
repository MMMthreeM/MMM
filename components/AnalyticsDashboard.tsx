'use client';
import { FORMAL_STATUS_OPTIONS } from '@/lib/order-status';
import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from '@/components/AppShell';
import { useOrders } from '@/components/useOrders';
import { summarizeMaterials, groupOrders, filterOrderGroups } from '@/lib/order-view';
import SearchSelect from '@/components/SearchSelect';
import SearchFilterBar from './SearchFilterBar';
import Pagination, { usePagination } from '@/components/Pagination';
import LoadingState from '@/components/LoadingState';
import BackToTop from '@/components/BackToTop';
import MaterialTrend from '@/components/MaterialTrend';
import AnalyticsOrders from '@/components/AnalyticsOrders';

type DrillStep = { view: string; material: string; company: string; region: string; start: string; end: string; status: string; scrollY: number };
const viewLabels: Record<string, string> = { overview: '材料總覽', trend: '材料趨勢', companies: '工班明細', orders: '期間訂單明細' };

export default function AnalyticsDashboard() {
  const account = useAccount(), admin = account?.role === 'Admin';
  const { orders, loading, error, refresh } = useOrders(admin);
  const [material, setMaterial] = useState(''), [company, setCompany] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [region, setRegion] = useState('');
  const [view, setView] = useState('trend');
  const [monthSelection, setMonthSelection] = useState({ scope: '', month: '' });
  const [status, setStatus] = useState('');
  const [steps, setSteps] = useState<DrillStep[]>([]);
  const formal = orders.filter(row => row.status !== '編輯中');
  const invalid = Boolean(start && end && start > end);
  const scopedIds = new Set(filterOrderGroups(groupOrders(formal), { status, region: admin ? region : '', company: admin ? company : '', startDate: start, endDate: end }).map(group => group.orderId));
  const filtered = invalid ? [] : formal.filter(row => scopedIds.has(row.orderId) && (!material || row.materialName === material));
  const summary = summarizeMaterials(filtered);
  const scope = JSON.stringify([material,company,region,start,end,view,status]);
  const materialPage = usePagination(summary, scope, 20);
  const matchingIds = new Set(filtered.map(row => row.orderId));
  const groups = groupOrders(formal).filter(group => matchingIds.has(group.orderId)).sort((a,b) => b.first.orderDate.localeCompare(a.first.orderDate));
  const orderPage = usePagination(groups, scope, 10);
  const companies = [...new Set(formal.filter(row => !region || row.reqRegion === region).map(row => row.reqCompany))].sort();
  const companyPage = usePagination([...new Set(filtered.map(row => row.reqCompany))].sort(), scope, 20);
  const months = new Map<string, typeof filtered>();
  filtered.forEach(row => { const key = row.orderDate.slice(0,7); if (/^\d{4}-\d{2}$/.test(key)) months.set(key,[...(months.get(key)||[]),row]); });
  const keys = [...months.keys()].sort();
  const first = start.slice(0,7) || keys[0], last = end.slice(0,7) || keys[keys.length-1];
  const timeline: string[] = [];
  if (first && last) { let year = Number(first.slice(0,4)), month = Number(first.slice(5)); while (timeline.length < 1200) { const key = `${year}-${String(month).padStart(2,'0')}`; if (key > last) break; timeline.push(key); month++; if(month===13){year++;month=1;} } }
  const series = material ? [...new Set(filtered.map(row=>row.unit))].map(unit=>({ label:`需求量（${unit}）`, values:timeline.map(key=>(months.get(key)||[]).filter(row=>row.unit===unit).reduce((sum,row)=>sum+row.quantity,0)) })) : [{label:'正式需求單數（張）', values:timeline.map(key=>new Set((months.get(key)||[]).map(row=>row.orderId)).size)}];
  const selectedMonth = monthSelection.scope === scope ? monthSelection.month : timeline.at(-1) || '';
  const monthRows = filtered.filter(row => row.orderDate.slice(0,7) === selectedMonth);
  const monthIds = new Set(monthRows.map(row => row.orderId));
  const monthGroups = groups.filter(group => monthIds.has(group.orderId));
  const monthPage = usePagination(monthGroups, JSON.stringify([scope, selectedMonth]), 10);
  const remember = () => setSteps(previous => [...previous, { view, material, company, region, start, end, status, scrollY: window.scrollY }]);
  const drill = (name: string) => { if (view !== 'trend') remember(); setMaterial(name); setView('trend'); };
  const back = () => {
    const previous = steps.at(-1);
    if (previous) {
      setView(previous.view); setMaterial(previous.material); setCompany(previous.company); setRegion(previous.region); setStart(previous.start); setEnd(previous.end); setStatus(previous.status); setSteps(current => current.slice(0, -1));
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: previous.scrollY, behavior: 'instant' })));
    } else { setMaterial(''); setView('overview'); }
  };
  const showPeriodOrders = () => { remember(); setView('orders'); };
  const managementParams = new URLSearchParams(Object.entries({startDate:start,endDate:end,company,region,material,status}).filter(([,value])=>value));
  const managementHref = '/admin' + (managementParams.size ? '?' + managementParams.toString() : '');
  const periodLabel = start || end ? (start || '最早需求') + ' — ' + (end || '最新需求') : '全部已送出的需求';
  return <main className="page-frame analytics-frame">
    <div className="page-heading"><div><h1 className="page-title">用料分析</h1></div><Link href="/request" className="btn btn-primary">建立材料需求</Link></div>
    <SearchFilterBar label="搜尋材料" search={<SearchSelect labelHidden label="材料" value={material} options={[...new Set(formal.map(row=>row.materialName))].map(name=>({value:name,label:name}))} onChange={value=>{if(value)drill(value);else {setMaterial('');setSteps([]);}}} emptyLabel="全部材料" />} count={[region,company,start,end,status].filter(Boolean).length}><div className="filter-grid">
      {admin && <label><span className="form-label">地區</span><select className="form-control" value={region} onChange={event => { setRegion(event.target.value); setCompany(''); }}><option value="">全部地區</option>{[...new Set(formal.map(row => row.reqRegion).filter(Boolean))].sort().map(name => <option key={name}>{name}</option>)}</select></label>}
      {admin && <label><span className="form-label">工班</span><select className="form-control" value={company} onChange={e=>setCompany(e.target.value)}><option value="">全部工班</option>{companies.map(name=><option key={name}>{name}</option>)}</select></label>}
      <div className="date-range-fields" role="group" aria-label="需求日期範圍"><label><span className="form-label">開始日期</span><input type="date" className="form-control" value={start} onChange={e=>setStart(e.target.value)} /></label>
      <label><span className="form-label">結束日期</span><input type="date" className="form-control" value={end} onChange={e=>setEnd(e.target.value)} /></label></div>
      <label><span className="form-label">需求狀態</span><select className="form-control" value={status} onChange={e=>setStatus(e.target.value)}>{FORMAL_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <button className="btn btn-quiet" onClick={()=>{setMaterial('');setCompany('');setRegion('');setStart('');setEnd('');setStatus('');setView('overview');setSteps([]);}}>清除篩選</button>
    </div></SearchFilterBar>
    {invalid && <p role="alert" className="feedback-error">開始日期不能晚於結束日期。</p>}
    {error && <p role="alert" className="feedback-error">{error}<button className="btn btn-quiet" onClick={()=>void refresh()}>重新載入</button></p>}
    <div className="history-tabs" role="group" aria-label="統計層級">{[['overview','材料總覽'],['trend','材料趨勢'],...(admin?[['companies','工班明細']]:[]),['orders','期間訂單明細']].map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setSteps([]);}}>{label}</button>)}</div>
    {(steps.length > 0 || (view === 'trend' && material)) && <div className="analytics-drill-navigation"><button type="button" className="btn btn-secondary" onClick={back}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18" /></svg>返回{steps.length ? viewLabels[steps.at(-1)!.view] : '材料總覽'}</button><span className="field-hint">{company ? company + ' / ' : ''}{viewLabels[view]}</span></div>}
    {loading ? <LoadingState label="正在整理材料需求…" /> : error&&!orders.length?null : <>
      {view !== 'trend' && <div className="summary-strip"><div><span>需求單</span><strong>{groups.length} 張</strong></div><div><span>材料種類</span><strong>{summary.length} 種</strong></div><div><span>統計範圍</span><strong>{company || (admin?'全部工班':account?.company)}</strong></div></div>}
      <details className="statistics-help"><summary>統計說明</summary><p>不含草稿。頻率按需求單計算，數量依單位分開；日期以最近送出／更新時間為準。</p></details>
      {!filtered.length ? <div className="surface empty-state">沒有符合條件的需求，請調整材料或日期。</div> : <>
        {view==='overview' && <section id="material-statistics" className="surface"><div className="p-5"><h2 className="section-title">材料需求明細統計</h2></div><div className="table-scroll"><table className="data-table statistics-table w-full text-left"><thead><tr><th>材料</th><th>叫料次數</th><th>需求量</th><th>單位</th></tr></thead><tbody>{materialPage.items.map(row=><tr key={JSON.stringify([row.name,row.unit])}><th className="material-name"><button className="data-link" onClick={()=>drill(row.name)}>{row.name}</button></th><td>{row.frequency} 次</td><td>{row.quantity.toLocaleString('zh-TW')}</td><td>{row.unit}</td></tr>)}</tbody></table></div><Pagination {...materialPage} label="材料統計" targetId="material-statistics" /></section>}
        {view==='trend' && <>
          <MaterialTrend key={JSON.stringify([material,company,region,start,end,status])} timeline={timeline} series={series} material={material} selectedMonth={selectedMonth} onSelect={month => setMonthSelection({ scope, month })} />
          <section className="surface trend-orders" id="trend-orders" aria-labelledby="trend-orders-title">
            <div className="trend-order-heading"><div><h2 id="trend-orders-title" className="section-title">{selectedMonth.replace('-', ' 年 ')} 月的需求單</h2><p className="field-hint">{monthGroups.length} 張需求單</p></div><div className="trend-order-tools"><div className="trend-month-totals">{(material ? summarizeMaterials(monthRows) : []).map(row => <span key={JSON.stringify([row.name,row.unit])}>{material ? '' : row.name+'：'}<strong>{row.quantity.toLocaleString('zh-TW')} {row.unit}</strong></span>)}</div><button type="button" className="btn btn-secondary" onClick={showPeriodOrders}>查看整段期間訂單</button></div></div>
            {!monthGroups.length ? <p className="empty-state">這個月沒有符合條件的需求單，可選擇其他月份。</p> : <AnalyticsOrders groups={monthPage.items} admin={admin} material={material} />}
            <Pagination {...monthPage} label="月份需求單" targetId="trend-orders" />
          </section>
        </>}
        {view==='companies' && <section id="company-statistics" className="surface"><div className="p-5"><h2 className="section-title">各工班彙總</h2></div><div className="table-scroll"><table className="data-table statistics-table w-full text-left"><thead><tr><th>工班</th><th>需求單數</th><th>材料種類</th><th>最近需求</th></tr></thead><tbody>{companyPage.items.map(name=>{const rows=filtered.filter(row=>row.reqCompany===name);return <tr key={name}><th><button className="data-link" onClick={()=>{remember();setCompany(name);setView(material?'trend':'overview');}}>{name}</button></th><td>{new Set(rows.map(row=>row.orderId)).size} 張</td><td>{summarizeMaterials(rows).length} 種</td><td>{rows.map(row=>row.orderDate).sort().at(-1)?.slice(0,10)}</td></tr>;})}</tbody></table></div><Pagination {...companyPage} label="工班統計" /></section>}
        {view==='orders' && <section className="surface trend-orders" id="period-orders" aria-labelledby="period-orders-title"><div className="trend-order-heading"><div><h2 className="sr-only" id="period-orders-title">期間訂單明細</h2><p className="field-hint">{periodLabel}</p></div><div className="trend-order-tools">{admin&&<Link className="btn btn-secondary" href={managementHref}>在案件管理處理</Link>}</div></div><AnalyticsOrders groups={orderPage.items} admin={admin} material={material} /><Pagination {...orderPage} label="需求訂單" targetId="period-orders" /></section>}
      </>}
    </>}<BackToTop />
  </main>;
}
