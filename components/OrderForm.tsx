'use client';
import { auditPendingNotice } from '@/lib/mutation-notice';



import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MaterialPicker from '@/components/MaterialPicker';
import TextOrderImport from '@/components/TextOrderImport';
import LoadingState from '@/components/LoadingState';
import type { CatalogMaterial } from '@/lib/material-catalog';
import { isUserEditableStatus, matchMaterial } from '@/lib/order-domain';
import { useUnsavedChanges } from '@/components/NavigationGuard';

type Material = CatalogMaterial;
type CartItem = { materialName: string; quantity: number; unit: string; vendor: string; remarks: string; originalId: string };

export default function OrderForm() {
  const router = useRouter();
  const params = useSearchParams();
  const processed = useRef<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [textPending, setTextPending] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState('');
  const [originalDate, setOriginalDate] = useState('');
  const [baseline, setBaseline] = useState(JSON.stringify({ items: [], draftName: '' }));
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const fieldFocus = useRef<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState<{ orderId: string; message: string; completedAt: string; notice?: string } | null>(null);
  const selected = materials.find((material) => material.id === selectedId);
  const canSaveDraft = originalStatus !== '處理中';
  useUnsavedChanges(!complete && (Boolean(selectedId || customName || remarks || editIndex !== null) || JSON.stringify({ items: cart, draftName }) !== baseline));
  useEffect(() => {
    if (fieldError && fieldFocus.current) {
      const field = document.getElementById(fieldFocus.current);
      field?.focus(); field?.scrollIntoView({ block: 'center', behavior: 'instant' });
      fieldFocus.current = null;
    }
  }, [fieldError]);
  const invalid = (field: string, message: string) => { fieldFocus.current = field; setFieldError({ field, message }); setError(''); };
  useEffect(() => {
    fetch('/api/materials').then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setMaterials(data.data ?? []); setCatalogLoaded(true); }).catch(() => setError('材料庫暫時無法載入，請重新整理後再試。'));
  }, []);
  useEffect(() => {
    const id = params.get('loadOrderId');
    const action = params.get('action');
    if (!id || !catalogLoaded || processed.current === id) return;
    let active = true;
    fetch('/api/orders').then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法載入需求單。');
      if (!active) return;
      const rows = (data.data as Array<CartItem & { orderId: string; orderDate: string; draftName: string; status: string; catalogId?: string }>).filter((row) => row.orderId === id);
      if (!rows.length) throw new Error('找不到可載入的需求單。');
      if (action === 'edit' && rows.some((row) => !isUserEditableStatus(row.status))) throw new Error('此單已進入審核，無法修改。可從歷史需求單選擇再訂一次。');
      const loaded = rows.map((row) => {
        const material = materials.find(item => item.id === row.catalogId) || matchMaterial(materials, row);
        return { materialName: material?.name || row.materialName, quantity: Number(row.quantity), unit: material?.unit || row.unit, vendor: material?.vendor || row.vendor, remarks: row.remarks ?? '', originalId: material?.id ?? 'other' };
      });
      setBaseline(JSON.stringify({ items: action === 'edit' ? loaded : [], draftName: action === 'edit' ? rows[0].draftName || '' : '' }));
      setOriginalDate(rows[0].orderDate || ''); setCart(loaded); setOriginalStatus(action === 'edit' ? rows[0].status : '');
      setEditingOrderId(action === 'edit' ? id : null); setDraftName(action === 'edit' ? rows[0].draftName || '' : '');
      setMessage(action === 'edit' ? '已載入需求單，儲存後才會更新原單。' : '已帶入歷史材料，送出後會建立新單。');
      setStep(2); processed.current = id;
    }).catch((reason) => { if (active) setError(reason.message || '載入失敗，請稍後再試。'); });
    return () => { active = false; };
  }, [catalogLoaded, materials, params, router]);
  const select = (id: string) => { if (id !== selectedId) { setSelectedId(id); setQuantity(id === 'other' ? 1 : materials.find((entry) => entry.id === id)?.minQty ?? 1); setRemarks(''); } setError(''); setFieldError(null); };
  const itemLabel = (item: CartItem) => materials.find((material) => material.id === item.originalId)?.displayName || item.materialName;
  const reset = () => { setSelectedId(''); setCustomName(''); setQuantity(1); setRemarks(''); setEditIndex(null); };
  const add = () => {
    if (!selectedId) return setError('請先選擇材料。');
    if (selectedId === 'other' && !customName.trim()) return invalid('custom-material', '請填寫自訂材料名稱。');
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return invalid('request-quantity', '數量必須是正整數。');
    if (selected && (quantity < selected.minQty || quantity % selected.stepQty !== 0)) return invalid('request-quantity', `數量須至少 ${selected.minQty}，且為 ${selected.stepQty} 的倍數。`);
    if (selected?.requiresRemarks && !remarks.trim()) return invalid('request-remarks', '混合材料請在備註確認各項品項、規格與數量。');
    if (cart.length >= 100 && editIndex === null) return setError('每張需求單最多 100 筆材料，請先確認清單。');
    const item = { materialName: selectedId === 'other' ? customName.trim() : selected!.name, quantity, unit: selectedId === 'other' ? '式' : selected!.unit, vendor: selectedId === 'other' ? '' : selected!.vendor, remarks: remarks.trim(), originalId: selectedId };
    setCart((items) => editIndex === null ? [...items, item] : items.map((entry, index) => index === editIndex ? item : entry));
    setMessage(editIndex === null ? `已加入：${selected?.displayName || item.materialName}` : '已更新清單中的材料。');
    setError(''); setFieldError(null); reset();
  };
  const edit = (index: number) => { const item = cart[index]; select(item.originalId); setCustomName(item.originalId === 'other' ? item.materialName : ''); setQuantity(item.quantity); setRemarks(item.remarks); setEditIndex(index); setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const submit = async (status: '編輯中' | '處理中') => {
    if (submitting) return;
    if (!cart.length) return setError('請至少加入一項材料。');
    if (textPending) { setStep(1); return setError('還有文字叫料未加入清單，請先確認加入或清除叫料文字。'); }
    if (editIndex !== null) return setError('請先儲存或取消正在修改的材料。');
    if (status === '編輯中' && !canSaveDraft) return;
    if (status === '編輯中' && !draftName.trim()) return invalid('draft-name', '請為工班共享草稿填寫名稱。');
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart, status, draftName: draftName.trim(), existingOrderId: editingOrderId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '送出失敗。');
      setComplete({ orderId: data.orderId, message: data.message, notice: auditPendingNotice(response), completedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) }); setCart([]); setEditingOrderId(null); setDraftName('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '網路連線錯誤。'); }
    finally { setSubmitting(false); }
  };
  if (complete) return <section className="surface request-complete"><span className="success-symbol" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg></span><h2 className="mt-5 text-2xl font-bold">{complete.message}</h2>{complete.notice && <p role="status" className="mt-3 text-sm text-[var(--warning)]">{complete.notice}</p>}<p className="mt-3 font-semibold">本次完成時間：{complete.completedAt}</p><p className="order-reference">單號：{complete.orderId}</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><button className="btn btn-primary" onClick={() => { setBaseline(JSON.stringify({ items: [], draftName: '' })); processed.current = params.get('loadOrderId'); setOriginalStatus(''); setComplete(null); setStep(1); router.replace('/request'); }}>繼續建立需求</button><button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>查看歷史需求單</button></div></section>;
  return <div className="request-flow" onChangeCapture={() => { if (message) setMessage(''); }} onClickCapture={event => { if (message && event.target instanceof Element && event.target.closest('button,input,select,textarea,summary')) setMessage(''); }}>
    <ol className="request-steps" aria-label="建立需求步驟">{['選擇材料', '確認並送出'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
    {message && <p className="feedback-success mb-5" role="status"><svg className="request-feedback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg><span>{message}</span></p>}{error && <p className="feedback-error mb-5" role="alert">{error}</p>}
    <div hidden={step !== 1 || editIndex !== null}><TextOrderImport materials={materials} remaining={100 - cart.length} onPendingChange={setTextPending} onAdd={items => { setCart(current => [...current, ...items]); setMessage(`已從文字叫料加入 ${items.length} 筆材料，請於送出前確認完整清單。`); setError(''); }} /></div>
    {step === 1 ? <div className="request-compose"><section className="surface p-5 sm:p-7"><h2 className="section-title">{editIndex === null ? '選擇材料' : '修改清單材料'}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">先選分類縮小範圍，也可直接輸入名稱、規格或常用叫法。</p>
      <div className="mt-6 space-y-5">
        {!catalogLoaded && !error && <LoadingState label="正在載入材料…" />}<MaterialPicker materials={materials} value={selectedId} onChange={select} disabled={!catalogLoaded} />
        <button type="button" className="btn btn-quiet px-0" onClick={() => select('other')}>找不到材料？改用自填材料</button>
        {selectedId === 'other' && <label className="block"><span className="form-label">自填材料名稱</span><input id="custom-material" name="customMaterial" autoComplete="off" className="form-control" aria-label="自填材料名稱" aria-invalid={fieldError?.field === 'custom-material'} aria-describedby={fieldError?.field === 'custom-material' ? 'custom-error' : undefined} value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={200} />{fieldError?.field === 'custom-material' && <span id="custom-error" className="field-error" role="alert">{fieldError.message}</span>}</label>}
        {selectedId && <><div><label className="form-label" htmlFor="request-quantity">需求數量{selected ? `（${selected.unit}）` : ''}</label><div className="quantity-stepper"><button type="button" aria-label="減少數量" disabled={submitting || quantity <= (selected?.minQty ?? 1)} onClick={() => setQuantity((value) => Math.max(selected?.minQty ?? 1, value - (selected?.stepQty ?? 1)))}>−</button><input id="request-quantity" name="quantity" autoComplete="off" inputMode="numeric" aria-invalid={fieldError?.field === 'request-quantity'} aria-describedby="quantity-help quantity-error" value={quantity || ''} onChange={(event) => setQuantity(Number(event.target.value))} /><button type="button" aria-label="增加數量" onClick={() => setQuantity((value) => value + (selected?.stepQty ?? 1))}>＋</button></div><p id="quantity-help" className="field-hint">最少 {selected?.minQty ?? 1}，每次增加 {selected?.stepQty ?? 1} {selected?.unit || '式'}。</p><p id="quantity-error" className="field-error" role={fieldError?.field === 'request-quantity' ? 'alert' : undefined}>{fieldError?.field === 'request-quantity' ? fieldError.message : ''}</p></div>
        <label className="block"><span className="form-label">附加備註（{selected?.requiresRemarks ? '必填：確認各項材料與數量' : '選填'}）</span><textarea id="request-remarks" name="remarks" autoComplete="off" className="form-control h-24 resize-y" aria-label="附加備註" aria-required={Boolean(selected?.requiresRemarks)} aria-invalid={fieldError?.field === 'request-remarks'} aria-describedby={fieldError?.field === 'request-remarks' ? 'remarks-error' : undefined} value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={500} placeholder={selected?.requiresRemarks ? '請填寫各項材料、規格與數量…' : '例如：規格、長度或特殊要求…'} />{fieldError?.field === 'request-remarks' && <span id="remarks-error" className="field-error" role="alert">{fieldError.message}</span>}</label>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn btn-primary flex-1" onClick={add}>{editIndex === null ? '加入待送出清單' : '儲存材料修改'}</button>{editIndex !== null && <button type="button" className="btn btn-secondary" onClick={reset}>取消修改</button>}</div></>}
      </div></section>
      <aside className="request-cart surface p-5 sm:p-6" aria-label="待送出清單摘要"><h2 className="section-title">待送出清單 <span className="text-base text-[var(--muted)]">({cart.length})</span></h2>{!cart.length ? <p className="mt-4 text-sm leading-7 text-[var(--muted)]">加入材料後會顯示在這裡。數量與備註可在送出前確認。</p> : <><ul className="mt-4 divide-y divide-[var(--line)]">{cart.slice(-5).map((item, index) => <li className="py-3" key={index}><p className="text-sm font-bold leading-6">{itemLabel(item)}</p><div className="cart-summary-meta"><span>需求數量</span><strong>{item.quantity.toLocaleString('zh-TW')} {item.unit}</strong></div></li>)}</ul>{cart.length > 5 && <p className="mt-2 text-xs text-[var(--muted)]">顯示最近 5 筆；確認頁可查看完整清單。</p>}<button className="btn btn-primary mt-5 w-full" disabled={editIndex !== null} onClick={() => setStep(2)}>確認清單並送出（{cart.length}）</button></>}</aside></div>
      : <section className="surface request-confirm p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="section-title">確認待送出清單</h2><p className="mt-1 text-sm text-[var(--muted)]">共 {cart.length} 筆材料{editingOrderId ? `，修改 ${originalDate} 的需求單` : ''}。</p>{editingOrderId && <p className="order-reference">單號：{editingOrderId}</p>}</div></div>
        <ul className="mt-5 divide-y divide-[var(--line)]">{cart.map((item, index) => <li className="cart-line" key={index}><div className="min-w-0"><p className="material-title font-bold leading-6">{itemLabel(item)}</p><p className="cart-confirm-quantity">{item.quantity.toLocaleString('zh-TW')} <span>{item.unit}</span></p>{item.remarks && <p className="cart-remark">{item.remarks}</p>}</div><div className="cart-line-actions"><button disabled={submitting} onClick={() => edit(index)}>修改</button><button disabled={submitting} className="text-[var(--danger)]" onClick={() => setCart((items) => items.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div></li>)}</ul>
        {canSaveDraft && <label className="mt-6 block"><span className="form-label">工班共享草稿名稱（儲存草稿時必填）</span><input id="draft-name" name="draftName" autoComplete="off" className="form-control" aria-label="草稿名稱" aria-invalid={fieldError?.field === 'draft-name'} aria-describedby={fieldError?.field === 'draft-name' ? 'draft-error' : 'draft-help'} value={draftName} disabled={submitting} onChange={(event) => setDraftName(event.target.value)} maxLength={100} placeholder="例如：高鐵 A 區水電預備…" /><span id="draft-help" className="field-hint">儲存後，同工班成員都可以接續修改。</span>{fieldError?.field === 'draft-name' && <span id="draft-error" className="field-error" role="alert">{fieldError.message}</span>}</label>}
        <div className="request-submit-actions"><button className="btn btn-secondary" disabled={submitting} onClick={() => setStep(1)}>新增材料</button>{canSaveDraft && <button className="btn btn-secondary" disabled={submitting || !cart.length} onClick={() => void submit('編輯中')}>儲存草稿</button>}<button className="btn btn-primary" disabled={submitting || !cart.length} onClick={() => void submit('處理中')}>{submitting ? '送出中…' : editingOrderId ? '更新並重新送出' : '正式送出'}</button></div></section>}
    {cart.length > 0 && step === 1 && <div className="mobile-cart-bar"><span className="mobile-cart-count">已加入 <strong>{cart.length}</strong> 筆</span><button className="btn btn-primary" disabled={editIndex !== null} onClick={() => setStep(2)}>確認清單並送出（{cart.length}）</button></div>}
  </div>;
}
