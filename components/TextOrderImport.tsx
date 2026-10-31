'use client';
import { useEffect, useRef, useState } from 'react';
import SearchSelect from '@/components/SearchSelect';
import { useUnsavedChanges } from '@/components/NavigationGuard';
import { normalizeSearchText, type CatalogMaterial } from '@/lib/material-catalog';
import { equivalentUnit, parseTextOrder, suggestedTextQuantity, textLineError, type TextOrderLine } from '@/lib/text-order';

export type ImportedItem = { materialName: string; quantity: number; unit: string; vendor: string; remarks: string; originalId: string };
type ReviewLine = TextOrderLine & { materialId: string; amount: string; remarks: string; included: boolean; confirmed: boolean; customName: string; customUnit: string; applyNotes: boolean };

export default function TextOrderImport({ materials, remaining, onAdd, onPendingChange }: { materials: CatalogMaterial[]; remaining: number; onAdd: (items: ImportedItem[]) => void; onPendingChange: (pending: boolean) => void }) {
  const [text, setText] = useState('');
  const root = useRef<HTMLDetailsElement>(null);
  const focusLine = (index: number, message: string) => {
    setError(`第 ${index + 1} 筆：${message}`);
    requestAnimationFrame(() => {
      const row = root.current?.querySelector<HTMLElement>(`[data-text-line="${index}"]`);
      row?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      row?.focus({ preventScroll: true });
    });
  };
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  useUnsavedChanges(Boolean(text.trim()));
  useEffect(() => { onPendingChange(Boolean(text.trim())); }, [text, onPendingChange]);
  const analyze = () => {
    try {
      const parsed = parseTextOrder(text, materials);
      if (!parsed.lines.length) throw new Error('沒有可分析的材料行，請每行填寫一種材料及數量。');
      setLines(parsed.lines.map(line => {
        // Only exact names/aliases may be preselected; suggestions always need user selection.
        const matches = materials.filter(material => [material.name, material.displayName, ...(material.aliases || [])].some(name => normalizeSearchText(name || '') === normalizeSearchText(line.name)));
        const candidate = matches.length === 1 ? matches[0] : undefined;
        return { ...line, materialId: candidate?.id || '', amount: candidate ? suggestedTextQuantity(candidate, line) : '', remarks: '', included: true, confirmed: false, customName: line.name, customUnit: line.unit || '式', applyNotes: false };
      }));
      setNotes(parsed.notes); setReviewing(true); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '無法分析文字。'); }
  };
  const update = (index: number, patch: Partial<ReviewLine>) => { setError(''); setLines(current => current.map((line, i) => i === index ? { ...line, ...patch, confirmed: false } : line)); };
  const remarksFor = (line: ReviewLine) => [line.applyNotes ? notes.trim() : '', line.remarks.trim()].filter(Boolean).join('\n');
  const materialFor = (line: ReviewLine): CatalogMaterial | undefined => line.materialId === 'other' ? { id: 'other', name: line.customName.trim(), displayName: line.customName.trim(), unit: line.customUnit.trim(), vendor: '', minQty: 1, stepQty: 1, tags: [], aliases: [], category: '', subcategory: '', orderHint: '' } : materials.find(entry => entry.id === line.materialId);
  const issueFor = (line: ReviewLine) => {
    if (line.materialId === 'other' && (!line.customName.trim() || line.customName.trim().length > 200 || !line.customUnit.trim() || line.customUnit.trim().length > 30)) return '請填寫材料名稱（最多 200 字）及單位（最多 30 字）。';
    return textLineError(materialFor(line), line.amount.trim() ? Number(line.amount) : null, remarksFor(line));
  };
  const included = lines.filter(line => line.included);
  const confirmedCount = included.filter(line => line.confirmed && !issueFor(line)).length;
  const add = () => {
    if (!included.length) return setError('請至少保留一筆材料。');
    if (included.length > remaining) return setError(`待送出清單還能加入 ${remaining} 筆，請減少本次加入的材料。`);
    if (notes.trim() && !included.some(line => line.applyNotes)) {
      setError('請選擇交貨備註要套用的材料，或清除不需要的交貨備註。');
      const target = root.current?.querySelector<HTMLElement>('#text-order-notes'); target?.scrollIntoView({ block: 'center' }); target?.focus(); return;
    }
    for (const line of included) {
      const issue = issueFor(line);
      if (issue || !line.confirmed) return focusLine(lines.indexOf(line), issue || '請確認這筆材料、單位、數量及備註，再勾選已確認。');
    }
    onAdd(included.map(line => {
      const material = materialFor(line)!;
      return { materialName: material.name, originalId: material.id, vendor: material.vendor, unit: material.unit, quantity: Number(line.amount), remarks: remarksFor(line) };
    }));
    setText(''); setLines([]); setNotes(''); setReviewing(false); setError('');
  };
  return <details ref={root} className="text-order-import"><summary>文字叫料：貼上清單批次填入</summary><div className="text-order-body">
    <p className="field-hint">每行一項材料。系統協助整理，請逐筆確認規格、顏色、單位與數量；確認後才加入待送出清單。</p>
    <label className="block mt-4"><span className="form-label">叫料文字</span><textarea className="form-control text-order-source" maxLength={12000} value={text} onChange={event => { setText(event.target.value); setReviewing(false); }} placeholder={'例如：\n8mm2 -1C 電線/白色 (100M/丸)\n2mm2 -2C 電纜/黑色 (100M/丸)\nLED燈泡(E40) 75W 白光\n防水型ELCB 2P 15AT 30mA 0.1S*50只\n【交貨備註】'} /></label>
    <button type="button" className="btn btn-secondary mt-3" disabled={!text.trim() || !materials.length} onClick={analyze}>分析叫料文字</button>
    {text && <button type="button" className="btn btn-quiet mt-3" onClick={() => { setText(''); setLines([]); setNotes(''); setReviewing(false); setError(''); }}>清除叫料文字</button>}
    {reviewing && <div className="text-order-review"><h3 className="section-title">確認文字叫料清單</h3><p className="field-hint">辨識 {lines.length} 筆，保留 {included.length} 筆。找不到的材料可直接自填；不需要的項目可略過。每筆只需確認一次。</p>
      <ol>{lines.map((line, index) => {
        const material = materialFor(line);
        const issue = issueFor(line);
        const options = materials.map(entry => ({ value: entry.id, label: entry.displayName || entry.name, keywords: [entry.name, ...(entry.aliases || [])].join(' '), detail: `單位：${entry.unit}` }));
        const sorted = [...options].sort((a, b) => Number(line.candidates.includes(b.value)) - Number(line.candidates.includes(a.value)));
        return <li key={index} data-text-line={index} tabIndex={-1} className="text-order-line"><div className="text-order-line-heading"><strong>第 {index + 1} 筆</strong></div><p className="text-order-original">原文：{line.source}</p>{line.calculation && <p className="field-hint">數量解析：{line.calculation}</p>}
          {line.included && <><SearchSelect label={`第 ${index + 1} 筆對應材料`} options={sorted} value={line.materialId === 'other' ? '' : line.materialId} disabled={line.materialId === 'other'} emptyLabel="請選擇對應材料" onChange={id => {
            const selected = materials.find(entry => entry.id === id);
            update(index, { materialId: id, amount: selected ? suggestedTextQuantity(selected, line) : '' });
          }} />
          <button type="button" className="btn btn-quiet" onClick={() => update(index, { materialId: line.materialId === 'other' ? '' : 'other', amount: line.quantity !== null ? String(line.quantity) : '1' })}>{line.materialId === 'other' ? '改從材料庫選擇' : '找不到材料？自行填寫'}</button>
          {line.materialId === 'other' && <div className="text-custom-fields"><label><span className="form-label">第 {index + 1} 筆自填材料名稱</span><input className="form-control" maxLength={200} value={line.customName} onChange={event => update(index, { customName: event.target.value })} /></label><label><span className="form-label">第 {index + 1} 筆自填單位</span><input className="form-control" maxLength={30} value={line.customUnit} onChange={event => update(index, { customUnit: event.target.value })} /></label></div>}
          <label className="block mt-3"><span className="form-label">第 {index + 1} 筆需求數量{material ? `（${material.unit}）` : ''}</span><input className="form-control text-order-quantity" inputMode="numeric" aria-describedby={`text-quantity-help-${index}`} aria-invalid={Boolean(issue)} value={line.amount} onChange={event => update(index, { amount: event.target.value })} /></label>
          {material && <p id={`text-quantity-help-${index}`} className="field-hint">最低數量 {material.minQty.toLocaleString('zh-TW')} {material.unit}；數量須為 {material.stepQty.toLocaleString('zh-TW')} 的倍數。</p>}
          {material && line.materialId !== 'other' && line.unit && equivalentUnit(material.unit) !== equivalentUnit(line.unit) && <p className="field-hint">原文單位「{line.unit}」與材料單位「{material.unit}」不同，依你的設定建議：最低數量 {material.minQty} × 原文數量 {line.quantity ?? 1} = {suggestedTextQuantity(material, line)} {material.unit}。請核對後確認，可自行修改。</p>}
          <label className="block mt-3"><span className="form-label">第 {index + 1} 筆備註{material?.requiresRemarks ? '（必填）' : '（選填）'}</span><textarea className="form-control" maxLength={500} value={line.remarks} onChange={event => update(index, { remarks: event.target.value })} /></label>
          {issue && <p className="field-hint text-[var(--warning)]">{issue}</p>}
          <div className="text-line-actions"><label className="check-target"><input type="checkbox" checked={line.confirmed} onChange={event => { if (event.target.checked && issue) return focusLine(index, issue); setError(''); setLines(current => current.map((entry, i) => i === index ? { ...entry, confirmed: event.target.checked } : entry)); }} />已確認第 {index + 1} 筆材料、單位、數量及備註</label><button type="button" className="btn btn-quiet" onClick={() => update(index, { included: !line.included })}>{line.included ? `略過第 ${index + 1} 筆` : `恢復第 ${index + 1} 筆`}</button></div></>}
          {!line.included && <div className="text-line-actions"><button type="button" className="btn btn-quiet" onClick={() => update(index, { included: !line.included })}>{line.included ? `略過第 ${index + 1} 筆` : `恢復第 ${index + 1} 筆`}</button></div>}
        </li>;
      })}</ol>
      <label className="block mt-4"><span className="form-label">交貨備註（指定材料後套用）</span><textarea id="text-order-notes" className="form-control" maxLength={500} value={notes} onChange={event => { setError(''); setNotes(event.target.value);  }} /></label>
      {notes.trim() && <fieldset className="text-note-targets"><legend className="form-label">交貨備註要填在哪些材料？</legend><div className="text-note-options">{lines.map((line, index) => line.included && <label className="check-target" key={index}><input type="checkbox" checked={line.applyNotes} onChange={event => { setError(''); setLines(current => current.map((entry, i) => i === index ? { ...entry, applyNotes: event.target.checked } : entry)); }} /><span>第 {index + 1} 筆 · {materialFor(line)?.displayName || line.name}</span></label>)}</div></fieldset>}
      <button type="button" className="btn btn-primary mt-4" onClick={add}>加入清單（已確認 {confirmedCount}／{included.length} 筆）</button>
    </div>}
    {error && <p role="alert" className="feedback-error mt-3">{error}</p>}
  </div></details>;
}
