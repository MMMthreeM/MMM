'use client';
import type { SevenContent } from '@/lib/order-change-set';
export default function MaterialConfirmation({content,checked,disabled,onChange}:{content:SevenContent;checked:boolean;disabled:boolean;onChange:(checked:boolean)=>void}) {
  const name=content.Item_Name.kind==='string'?content.Item_Name.value:'材料';
  return <label className="check-target material-confirmation"><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)} aria-label={`確認 ${name} 的材料、規格、數量、單位、廠商與備註`} /><span>已核對</span></label>;
}
