'use client';
import {useEffect,useRef,useState} from 'react';
import type {OrderGroup} from '@/lib/order-view';
import type {CatalogMaterial} from '@/lib/material-catalog';
import {V2OrderEditor} from '@/components/OrderForm';
import {useUnsavedChanges} from '@/components/NavigationGuard';
export default function AdminOrderEditor({group,onClose,onSaved}:{group:OrderGroup;onClose:()=>void;onSaved:(notice?:string)=>Promise<void>}) {
  const dialog=useRef<HTMLDialogElement>(null);const [materials,setMaterials]=useState<CatalogMaterial[]|null>(null);const [error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal();const controller=new AbortController();fetch('/api/materials',{cache:'no-store',signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error('材料庫無法載入。');setMaterials(b.data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[]);
  const requestLeave=useUnsavedChanges(false);
  const close=()=>requestLeave(onClose);
  return <dialog ref={dialog} className="action-dialog order-editor" aria-label="材料／廠商對應與編輯" onCancel={e=>{e.preventDefault();close();}}><button type="button" className="btn btn-secondary mb-4" onClick={close}>關閉編輯器</button>{error&&<p role="alert" className="feedback-error">{error}</p>}{materials?<V2OrderEditor materials={materials} group={group} initialMode="edit-pending" admin onSaved={async notice=>{await onSaved(notice);onClose();}}/>:<p role="status">正在載入材料…</p>}</dialog>;
}
