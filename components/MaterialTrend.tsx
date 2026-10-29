'use client';
import { useEffect, useId, useRef, useState } from 'react';

type Series = { label: string; values: number[] };
type Props = { timeline: string[]; series: Series[]; material: string; selectedMonth: string; onSelect: (month: string) => void };

export default function MaterialTrend({ timeline, series, material, selectedMonth, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [initialMonth] = useState(selectedMonth);
  const [width, setWidth] = useState(720);
  const [windowState, setWindowState] = useState({ scope: '', end: 0 });
  const titleId = useId();
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const size = width < 600 ? 6 : Math.max(6, Math.min(18, Math.floor((width - 60) / 48)));
  const scope = JSON.stringify([timeline, size, material]);
  const preferredEnd = Math.max(Math.min(size, timeline.length), timeline.indexOf(initialMonth) + 1);
  const end = windowState.scope === scope ? Math.min(timeline.length, windowState.end) : preferredEnd;
  const start = Math.max(0, end - size);
  const visible = timeline.slice(start, end);
  const move = (direction: number) => setWindowState({ scope, end: Math.max(Math.min(size, timeline.length), Math.min(timeline.length, end + direction * size)) });
  const chartWidth = Math.max(260, width), height = 270, left = 42, right = 26, top = 35, bottom = 220;
  const x = (index: number) => visible.length === 1 ? (chartWidth + left - right) / 2 : left + index / (visible.length - 1) * (chartWidth - left - right);
  return <section className="surface material-trend" aria-labelledby={titleId}>
    <div className="trend-heading"><div><h2 className="section-title" id={titleId}>{material || '全部材料'}叫料趨勢</h2><p className="field-hint">{material ? '依單位分開統計，點選月份查看相關需求單。' : '每月正式需求單數；選取材料後查看需求數量。'}</p></div><span className="trend-period">逐月</span></div>
    <div className={`trend-window ${timeline.length <= size ? 'trend-window-complete' : ''}`} aria-label="圖表月份範圍">
      {timeline.length > size && (start > 0 ? <button type="button" className="btn btn-secondary" onClick={() => move(-1)} aria-label="查看較早月份">前 {size} 個月</button> : <span className="trend-window-boundary">已到最早月份</span>)}
      <div className="trend-window-label"><strong aria-live="polite">{visible[0]?.replace('-', '/')} — {visible.at(-1)?.replace('-', '/')}</strong><span>{timeline.length <= size ? `已顯示全部 ${timeline.length} 個月` : `顯示第 ${start + 1}–${end} 個月，共 ${timeline.length} 個月`}</span></div>
      {timeline.length > size && (end < timeline.length ? <button type="button" className="btn btn-secondary" onClick={() => move(1)} aria-label="查看較晚月份">後 {size} 個月</button> : <span className="trend-window-boundary">已到最新月份</span>)}
    </div>
    <div ref={container} className="trend-plots">{series.map((entry, seriesIndex) => {
      const values = entry.values.slice(start, end);
      const largest = Math.max(1, ...entry.values);
      const rough = largest / 5, power = 10 ** Math.floor(Math.log10(rough));
      const step = Math.max(1, [1, 2, 2.5, 5, 10].map(n => n * power).find(n => n >= rough) || power * 10);
      const max = Math.ceil(largest / step) * step;
      const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
      const y = (value: number) => bottom - value / max * (bottom - top);
      const chosen = selectedMonth || timeline.at(-1) || '';
      return <div className="trend-chart" key={entry.label}>
        <div className="trend-statline"><h3>{entry.label}</h3><span>期間合計 <strong>{entry.values.reduce((sum, value) => sum + value, 0).toLocaleString('zh-TW')}</strong></span><span>有需求月份 <strong>{entry.values.filter(value => value > 0).length} / {timeline.length}</strong></span></div>
        <svg viewBox={`0 0 ${chartWidth} ${height}`} style={{ height }} role="group" aria-label={`${entry.label}，可選取月份`}>
          {ticks.map(value => <g key={value}><line x1={left} x2={chartWidth - right} y1={y(value)} y2={y(value)} stroke="var(--line)" /><text x={left - 9} y={y(value) + 4} textAnchor="end">{value.toLocaleString('zh-TW', { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 })}</text></g>)}
          <polyline points={values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} fill="none" stroke="var(--delta-blue)" strokeWidth="2.2" strokeLinejoin="round" />
          {visible.map((month, index) => <g key={month}>
            {chosen === month && <line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="var(--delta-blue)" strokeDasharray="3 4" opacity=".5" />}
            <circle cx={x(index)} cy={y(values[index])} r={chosen === month ? 4.5 : 3} fill={chosen === month ? 'var(--delta-blue)' : 'white'} stroke="var(--delta-blue)" strokeWidth="1.7" />
            {chosen === month && <text className="trend-value" x={x(index)} y={Math.max(17, y(values[index]) - 13)} textAnchor="middle">{values[index].toLocaleString('zh-TW')}</text>}
            <text x={x(index)} y="242" textAnchor="middle">{month.slice(5)}月</text>
            {(index === 0 || month.endsWith('-01')) && <text x={x(index)} y="261" textAnchor="middle">{month.slice(0, 4)}</text>}
            <rect x={x(index) - 22} y={top - 16} width="44" height={height - top + 16} fill="transparent" role="button" tabIndex={0} aria-label={`${month}：${values[index].toLocaleString('zh-TW')}，${entry.label}，查看訂單`} aria-pressed={chosen === month} onClick={() => onSelect(month)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(month); } }}><title>{month}：{values[index]}，點選查看訂單</title></rect>
          </g>)}
        </svg>
        {seriesIndex === series.length - 1 && <p className="field-hint trend-zero-note">無需求的月份以 0 顯示。可使用鍵盤選取圖中月份。</p>}
        <details className="trend-data"><summary>查看逐月數據與訂單</summary><div className="month-grid">{timeline.map((month, index) => <button type="button" className="btn btn-secondary" aria-pressed={chosen === month} key={month} onClick={() => onSelect(month)}>{month}：{entry.values[index].toLocaleString('zh-TW')}</button>)}</div></details>
      </div>;
    })}</div>
  </section>;
}
