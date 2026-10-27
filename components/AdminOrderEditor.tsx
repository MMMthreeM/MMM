'use client';
import { useEffect, useRef, useState } from 'react';
import { matchMaterial } from '@/lib/order-domain';
import SearchSelect from '@/components/SearchSelect';
import type { OrderGroup } from '@/lib/order-view';

type Material = { id: string; name: string; vendor: string; unit: string; minQty: number; stepQty: number; tags: string[] };
type EditLine = { lineId?: string; materialName: string; quantity: number; unit: string; vendor: string; remarks: string; originalId?: string };

export default function AdminOrderEditor({ group, onClose, onSaved }: { group: OrderGroup; onClose: () => void; onSaved: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<EditLine[]>(() => group.items.map((item) => ({ ...item })));
  const [materials, setMaterials] = useState<Material[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); fetch('/api/materials').then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setMaterials(body.data ?? []); setReady(true); }).catch(() => setError('材料庫無法載入，請關閉後重試。')); }, []);
  const update = (index: number, changes: Partial<EditLine>) => setItems((current) => current.map((item, row) => row === index ? { ...item, ...changes } : item));
  const save = async () => {
    if (busy || !ready) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/edit-order', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: group.orderId, expectedStatus: group.status, expectedLineIds: group.items.map((item) => item.lineId), items: items.map((item) => ({ ...item, originalId: item.originalId || matchMaterial(materials, item)?.id || 'other' })) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || '儲存失敗。');
      await onSaved(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '連線失敗，請稍後再試。'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="action-dialog order-editor" aria-labelledby="edit-order-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}><form onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <h2 id="edit-order-title" className="section-title">編輯需求單</h2><p className="mt-2 break-words text-sm text-[var(--muted)]">{group.orderId} · {group.first.reqCompany} · 儲存後維持「{group.status}」</p>
    {error && <p role="alert" className="feedback-error mt-4">{error}</p>}
    <div className="editor-lines">{items.map((item, index) => <fieldset className="editor-line" key={index}><legend>第 {index + 1} 筆材料</legend><div className="editor-material"><SearchSelect label={`第 ${index + 1} 筆材料`} value={item.originalId || matchMaterial(materials, item)?.id || 'other'} options={[...materials.map((material) => ({ value: material.id, label: material.name, detail: `${material.vendor} · ${material.unit}`, keywords: material.tags.join(' ') })), { value: 'other', label: '其他（自填）' }]} emptyLabel="" disabled={busy || !ready} onChange={(id) => { const material = materials.find((row) => row.id === id); update(index, material ? { originalId: id, materialName: material.name, unit: material.unit, vendor: material.vendor, quantity: material.minQty } : { originalId: 'other', materialName: '', unit: '式', vendor: '' }); }} />
      {(item.originalId === 'other' || !matchMaterial(materials, item)) && <label className="mt-3 block"><span className="form-label">自填材料名稱</span><input className="form-control" value={item.materialName} maxLength={200} disabled={busy} onChange={(event) => update(index, { materialName: event.target.value })} /></label>}</div>
      <label><span className="form-label">數量（{item.unit}）</span><input type="number" min={1} className="form-control" aria-label={`第 ${index + 1} 筆數量`} value={item.quantity || ''} disabled={busy} onChange={(event) => update(index, { quantity: Number(event.target.value) })} /></label>
      <label className="editor-remarks"><span className="form-label">材料備註</span><input className="form-control" value={item.remarks} maxLength={500} disabled={busy} onChange={(event) => update(index, { remarks: event.target.value })} /></label>
      <button type="button" className="btn btn-danger editor-remove" disabled={busy || items.length <= 1} onClick={() => setItems((current) => current.filter((_, row) => row !== index))}>移除</button>
    </fieldset>)}</div>
    <button type="button" className="btn btn-secondary" disabled={busy || items.length >= 100} onClick={() => setItems((current) => [...current, { materialName: '', quantity: 1, unit: '式', vendor: '', remarks: '', originalId: 'other' }])}>新增材料</button>
    <div className="editor-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>取消</button><button type="submit" className="btn btn-primary" disabled={busy || !ready}>{busy ? '儲存中…' : '儲存單據'}</button></div>
  </form></dialog>;
}
