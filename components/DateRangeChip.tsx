export default function DateRangeChip({ start, end, onClear }: { start?: string; end?: string; onClear: () => void }) {
  if (!start && !end) return null;
  const label = `${start || '不限起日'} — ${end || '不限迄日'}`;
  return <button type="button" className="date-range-chip" aria-label={`移除日期區間 ${label}`} onClick={onClear}>
    <span>{start || '不限起日'}</span><span aria-hidden="true">—</span><span>{end || '不限迄日'}</span><span aria-hidden="true">×</span>
  </button>;
}
