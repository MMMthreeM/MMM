'use client';
import { auditPendingNotice } from '@/lib/mutation-notice';


import { useEffect, useRef, useState } from 'react';
import { matchMaterial, validateItems } from '@/lib/order-domain';
import { materialOption, type CatalogMaterial } from '@/lib/material-catalog';
import { orderPresentation, type OrderGroup } from '@/lib/order-view';
import { useUnsavedChanges } from '@/components/NavigationGuard';
import SearchSelect from '@/components/SearchSelect';

type EditLine = { lineId?: string; materialName: string; quantity: number; unit: string; vendor: string; remarks: string; originalId?: string };

export default function AdminOrderEditor({ group, onClose, onSaved }: { group: OrderGroup; onClose: () => void; onSaved: (notice?: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<EditLine[]>(() => group.items.map((item) => ({ ...item })));
  const [initial, setInitial] = useState(JSON.stringify(items));
  const requestLeave = useUnsavedChanges(JSON.stringify(items) !== initial);
  const [materials, setMaterials] = useState<CatalogMaterial[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lineErrors, setLineErrors] = useState<Array<string | null>>([]);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch('/api/materials', { signal: controller.signal }).then(async (response) => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setMaterials(body.data ?? []); setReady(true);
    }).catch(() => { if (!controller.signal.aborted) setError('材料庫無法載入，請關閉後重試。'); });
    return () => controller.abort();
  }, []);
  const update = (index: number, changes: Partial<EditLine>) => {
    setItems((current) => current.map((item, row) => row === index ? { ...item, ...changes } : item));
    setLineErrors((current) => current.map((error, row) => row === index ? null : error));
  };
  const close = () => { if (!busy) requestLeave(onClose); };
  const save = async () => {
    if (busy || !ready) return;
    const payload = items.map((item) => ({ ...item, originalId: item.originalId || matchMaterial(materials, item)?.id || 'other' }));
    const errors = payload.map((item) => validateItems([item], materials));
    setLineErrors(errors);
    const invalid = errors.findIndex(Boolean);
    if (invalid >= 0) {
      const line = dialog.current?.querySelectorAll<HTMLFieldSetElement>('.editor-line')[invalid];
      const field = line?.querySelector<HTMLElement>(errors[invalid]?.includes('數量') ? 'input[type=number]' : errors[invalid]?.includes('備註') ? 'textarea' : 'input');
      requestAnimationFrame(() => { field?.focus(); field?.scrollIntoView({ block: 'center', behavior: 'instant' }); }); return;
    }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/edit-order', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: group.orderId, expectedStatus: group.status, expectedLineIds: group.items.map((item) => item.lineId), items: payload }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || '儲存失敗。');
      setInitial(JSON.stringify(items));
      await onSaved(auditPendingNotice(response)); onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '連線失敗，請稍後再試。');
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>('[data-editor-error]')?.focus());
    } finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="action-dialog order-editor" aria-labelledby="edit-order-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <header className="editor-heading"><div><h2 id="edit-order-title" className="section-title" tabIndex={-1} autoFocus>編輯需求單</h2><p className="mt-2 font-semibold">{group.first.orderDate}　{group.first.reqCompany}</p><p className="order-reference">單號：{group.orderId}</p></div><span className={`status status-${orderPresentation(group).tone}`}>{orderPresentation(group).label}</span></header>
      <p className="field-hint mt-3">儲存材料、數量與備註，保留目前需求狀態及原申請資料。</p>
      {error && <p role="alert" tabIndex={-1} data-editor-error className="feedback-error mt-4">{error}</p>}
      <div className="editor-lines">{items.map((item, index) => {
        const rule = matchMaterial(materials, item);
        const errorId = `edit-line-${index}-error`;
        return <fieldset className="editor-line" key={index}><legend>第 {index + 1} 筆材料</legend>
          <div className="editor-material"><SearchSelect label={`第 ${index + 1} 筆材料`} value={item.originalId || rule?.id || 'other'} options={[...materials.map(materialOption), { value: 'other', label: '其他（自填）' }]} emptyLabel="" disabled={busy || !ready} onChange={(id) => {
            const material = materials.find((row) => row.id === id);
            update(index, material ? { originalId: id, materialName: material.name, unit: material.unit, vendor: material.vendor, quantity: material.minQty } : { originalId: 'other', materialName: '', unit: '式', vendor: '' });
          }} />
          {(item.originalId === 'other' || !rule) && <label className="mt-3 block"><span className="form-label">自填材料名稱</span><input name={`material-${index}`} autoComplete="off" className="form-control" value={item.materialName} maxLength={200} disabled={busy} aria-invalid={Boolean(lineErrors[index])} aria-describedby={lineErrors[index] ? errorId : undefined} onChange={(event) => update(index, { materialName: event.target.value })} /></label>}
          {rule && <p className="field-hint">{rule.vendor}　{rule.unit}</p>}</div>
          <label className="editor-quantity"><span className="form-label">數量（{item.unit}）</span><input type="number" inputMode="numeric" name={`quantity-${index}`} min={rule?.minQty ?? 1} step={rule?.stepQty ?? 1} className="form-control" aria-label={`第 ${index + 1} 筆數量`} aria-invalid={Boolean(lineErrors[index])} aria-describedby={`edit-rule-${index}${lineErrors[index] ? ' ' + errorId : ''}`} value={item.quantity || ''} disabled={busy} onChange={(event) => update(index, { quantity: Number(event.target.value) })} /><span id={`edit-rule-${index}`} className="field-hint">最少 {rule?.minQty ?? 1}，{rule?.stepQty ?? 1} 的倍數</span></label>
          <label className="editor-remarks"><span className="form-label">材料備註{rule?.requiresRemarks ? '（必填）' : '（選填）'}</span><textarea name={`remarks-${index}`} autoComplete="off" className="form-control" rows={2} value={item.remarks} maxLength={500} aria-required={Boolean(rule?.requiresRemarks)} aria-invalid={Boolean(lineErrors[index])} aria-describedby={lineErrors[index] ? errorId : undefined} disabled={busy} onChange={(event) => update(index, { remarks: event.target.value })} /></label>
          <button type="button" className="btn btn-danger editor-remove" disabled={busy || items.length <= 1} onClick={() => { setItems((current) => current.filter((_, row) => row !== index)); setLineErrors([]); }}>移除</button>
          {lineErrors[index] && <p id={errorId} className="field-error editor-line-error" role="alert">{lineErrors[index]}</p>}
        </fieldset>;
      })}</div>
      <button type="button" className="btn btn-secondary" disabled={busy || items.length >= 100} onClick={() => setItems((current) => [...current, { materialName: '', quantity: 1, unit: '式', vendor: '', remarks: '', originalId: 'other' }])}>新增材料</button>
      <div className="editor-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>取消</button><button type="submit" className="btn btn-primary" disabled={busy || !ready}>{busy ? '儲存中…' : '儲存單據'}</button></div>
    </form>
  </dialog>;
}
