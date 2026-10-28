'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MaterialPicker from '@/components/MaterialPicker';
import { useMaterialPreferences } from '@/components/useMaterialPreferences';
import type { CatalogMaterial } from '@/lib/material-catalog';
import { isUserEditableStatus, matchMaterial } from '@/lib/order-domain';

type Material = CatalogMaterial;
type CartItem = { materialName: string; quantity: number; unit: string; vendor: string; remarks: string; originalId: string };

export default function OrderForm() {
  const router = useRouter();
  const params = useSearchParams();
  const processed = useRef<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const preferences = useMaterialPreferences();
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState<{ orderId: string; message: string } | null>(null);
  const selected = materials.find((material) => material.id === selectedId);
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
      const rows = (data.data as Array<CartItem & { orderId: string; draftName: string; status: string }>).filter((row) => row.orderId === id);
      if (!rows.length) throw new Error('找不到可載入的需求單。');
      if (action === 'edit' && rows.some((row) => !isUserEditableStatus(row.status))) throw new Error('此單已進入審核，無法修改。可從歷史需求單選擇整單重訂。');
      setCart(rows.map((row) => ({ materialName: row.materialName, quantity: Number(row.quantity), unit: row.unit, vendor: row.vendor, remarks: row.remarks ?? '', originalId: matchMaterial(materials, row)?.id ?? 'other' })));
      setEditingOrderId(action === 'edit' ? id : null); setDraftName(action === 'edit' ? rows[0].draftName || '' : '');
      setMessage(action === 'edit' ? '已載入需求單，儲存後才會更新原單。' : '已帶入歷史材料，送出後會建立新單。');
      setStep(2); processed.current = id; router.replace('/request');
    }).catch((reason) => { if (active) setError(reason.message || '載入失敗，請稍後再試。'); });
    return () => { active = false; };
  }, [catalogLoaded, materials, params, router]);
  const select = (id: string) => { if (id !== selectedId) { setSelectedId(id); setQuantity(id === 'other' ? 1 : materials.find((entry) => entry.id === id)?.minQty ?? 1); setRemarks(''); } setError(''); };
  const itemLabel = (item: CartItem) => materials.find((material) => material.id === item.originalId)?.displayName || item.materialName;
  const reset = () => { setSelectedId(''); setCustomName(''); setQuantity(1); setRemarks(''); setEditIndex(null); };
  const add = () => {
    if (!selectedId) return setError('請先選擇材料。');
    if (selectedId === 'other' && !customName.trim()) return setError('請填寫自訂材料名稱。');
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return setError('數量必須是正整數。');
    if (selected && (quantity < selected.minQty || quantity % selected.stepQty !== 0)) return setError(`數量須至少 ${selected.minQty}，且為 ${selected.stepQty} 的倍數。`);
    if (selected?.requiresRemarks && !remarks.trim()) return setError('混合材料請在備註確認各項品項、規格與數量。');
    const item = { materialName: selectedId === 'other' ? customName.trim() : selected!.name, quantity, unit: selectedId === 'other' ? '式' : selected!.unit, vendor: selectedId === 'other' ? '' : selected!.vendor, remarks: remarks.trim(), originalId: selectedId };
    setCart((items) => editIndex === null ? [...items, item] : items.map((entry, index) => index === editIndex ? item : entry));
    if (selected) preferences.record(selected);
    setMessage(editIndex === null ? `已加入「${selected?.displayName || item.materialName}」，可以繼續新增或確認送出。` : '材料修改已儲存到待送出清單。');
    setError(''); reset();
  };
  const edit = (index: number) => { const item = cart[index]; select(item.originalId); setCustomName(item.originalId === 'other' ? item.materialName : ''); setQuantity(item.quantity); setRemarks(item.remarks); setEditIndex(index); setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const submit = async (status: '編輯中' | '處理中') => {
    if (submitting) return;
    if (!cart.length) return setError('請至少加入一項材料。');
    if (editIndex !== null) return setError('請先儲存或取消正在修改的材料。');
    if (status === '編輯中' && !draftName.trim()) return setError('請為草稿填寫名稱。');
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart, status, draftName: draftName.trim(), existingOrderId: editingOrderId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '送出失敗。');
      setComplete({ orderId: data.orderId, message: data.message }); setCart([]); setEditingOrderId(null); setDraftName('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '網路連線錯誤。'); }
    finally { setSubmitting(false); }
  };
  if (complete) return <section className="surface mx-auto max-w-xl p-7 text-center sm:p-9"><svg className="mx-auto text-[var(--delta-green)]" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m7 12 3 3 7-7" /></svg><h2 className="mt-5 text-2xl font-bold">{complete.message}</h2><p className="mt-2 text-sm text-[var(--muted)]">單號：<strong>{complete.orderId}</strong></p><div className="mt-7 grid gap-3 sm:grid-cols-2"><button className="btn btn-primary" onClick={() => { setComplete(null); setStep(1); }}>繼續建立需求</button><button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>查看歷史需求單</button></div></section>;
  return <div className="request-flow">
    <ol className="request-steps" aria-label="建立需求步驟">{['選擇材料', '確認並送出'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
    {message && <p className="feedback-success mb-5" role="status">{message}</p>}{error && <p className="feedback-error mb-5" role="alert">{error}</p>}
    {step === 1 ? <div className="request-compose"><section className="surface p-5 sm:p-7"><h2 className="section-title">{editIndex === null ? '選擇材料' : '修改清單材料'}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">先選分類縮小範圍，也可直接輸入名稱、規格或常用叫法。</p>
      <div className="mt-6 space-y-5">
        <MaterialPicker materials={materials} value={selectedId} onChange={select} disabled={!catalogLoaded} preferences={preferences} />
        <button type="button" className="btn btn-quiet px-0" onClick={() => select('other')}>找不到材料？改用自填材料</button>
        {selectedId === 'other' && <label className="block"><span className="form-label">自填材料名稱</span><input className="form-control" aria-label="自填材料名稱" value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={200} /></label>}
        {selectedId && <><div><label className="form-label" htmlFor="request-quantity">需求數量{selected ? `（${selected.unit}）` : ''}</label><div className="quantity-stepper"><button type="button" aria-label="減少數量" disabled={submitting} onClick={() => setQuantity((value) => Math.max(selected?.minQty ?? 1, value - (selected?.stepQty ?? 1)))}>−</button><input id="request-quantity" inputMode="numeric" value={quantity || ''} onChange={(event) => setQuantity(Number(event.target.value))} /><button type="button" aria-label="增加數量" onClick={() => setQuantity((value) => value + (selected?.stepQty ?? 1))}>＋</button></div>{selected && <p className="mt-2 text-xs text-[var(--muted)]">最少 {selected.minQty}，每次增加 {selected.stepQty} {selected.unit}。</p>}</div>
        <label className="block"><span className="form-label">附加備註（{selected?.requiresRemarks ? '必填：確認各項材料與數量' : '選填'}）</span><textarea className="form-control h-24 resize-y" aria-label="附加備註" aria-required={Boolean(selected?.requiresRemarks)} value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={500} placeholder={selected?.requiresRemarks ? '請填寫各項材料、規格與數量' : '規格、長度或特殊要求'} /></label>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn btn-primary flex-1" onClick={add}>{editIndex === null ? '加入待送出清單' : '儲存材料修改'}</button>{editIndex !== null && <button type="button" className="btn btn-secondary" onClick={reset}>取消修改</button>}</div></>}
      </div></section>
      <aside className="request-cart surface p-5 sm:p-6"><h2 className="section-title">待送出清單 <span className="text-base text-[var(--muted)]">({cart.length})</span></h2>{!cart.length ? <p className="mt-4 text-sm leading-7 text-[var(--muted)]">加入材料後會顯示在這裡。數量與備註可在送出前確認。</p> : <><ul className="mt-4 divide-y divide-[var(--line)]">{cart.slice(-5).map((item, index) => <li className="py-3" key={index}><p className="text-sm font-bold leading-6">{itemLabel(item)}</p><p className="text-sm text-[var(--muted)]">{item.quantity} {item.unit}</p></li>)}</ul>{cart.length > 5 && <p className="mt-2 text-xs text-[var(--muted)]">顯示最近 5 筆；確認頁可查看完整清單。</p>}<button className="btn btn-primary mt-5 w-full" disabled={editIndex !== null} onClick={() => setStep(2)}>確認清單並送出（{cart.length}）</button></>}</aside></div>
      : <section className="surface request-confirm p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="section-title">確認待送出清單</h2><p className="mt-1 text-sm text-[var(--muted)]">共 {cart.length} 筆材料{editingOrderId ? `，更新單號：${editingOrderId}` : ''}。</p></div><button className="btn btn-secondary" disabled={submitting} onClick={() => setStep(1)}>新增材料</button></div>
        <ul className="mt-5 divide-y divide-[var(--line)]">{cart.map((item, index) => <li className="cart-line" key={index}><div className="min-w-0"><p className="break-words font-bold leading-6">{item.materialName}</p><p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">{item.quantity} {item.unit}{item.remarks ? ` · ${item.remarks}` : ''}</p></div><div className="cart-line-actions"><button disabled={submitting} onClick={() => edit(index)}>修改</button><button disabled={submitting} className="text-[var(--danger)]" onClick={() => setCart((items) => items.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div></li>)}</ul>
        <label className="mt-6 block"><span className="form-label">草稿名稱（僅暫存時必填）</span><input className="form-control" aria-label="草稿名稱" value={draftName} disabled={submitting} onChange={(event) => setDraftName(event.target.value)} maxLength={100} placeholder="例如：高鐵 A 區水電預備" /></label>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="btn btn-secondary" disabled={submitting || !cart.length} onClick={() => void submit('編輯中')}>儲存草稿</button><button className="btn btn-primary" disabled={submitting || !cart.length} onClick={() => void submit('處理中')}>{submitting ? '送出中…' : editingOrderId ? '更新並重新送出' : '正式送出'}</button></div></section>}
    {cart.length > 0 && step === 1 && <div className="mobile-cart-bar"><button className="btn btn-primary w-full" disabled={editIndex !== null} onClick={() => setStep(2)}>確認清單並送出（{cart.length}）</button></div>}
  </div>;
}
