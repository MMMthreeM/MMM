'use client';
import {useEffect,useState} from 'react';
import MaterialPicker from './MaterialPicker';
import OrderMaterialLine,{editorLineIssues} from './OrderMaterialLine';
import {contentText,textCell,type EditorLine} from '@/lib/order-form-state';
import type {CatalogMaterial} from '@/lib/material-catalog';
import type {SevenContent} from '@/lib/order-change-set';

export default function MaterialEntryForm({materials,editing,disabled,onCommit,onCancel,onPendingChange}:{materials:CatalogMaterial[];editing?:EditorLine;disabled:boolean;onCommit:(line:EditorLine)=>boolean;onCancel:()=>void;onPendingChange:(pending:boolean)=>void}){
 const [line,setLine]=useState<EditorLine|null>(()=>editing?structuredClone(editing):null),[pending,setPending]=useState(false),[showIssues,setShowIssues]=useState(false),[error,setError]=useState('');
 const rule=materials.find(m=>m.id===(line?contentText(line.content,'Material_ID'):''));
 const dirty=Boolean(line&&(!editing||JSON.stringify(line)!==JSON.stringify(editing)))||pending;
 useEffect(()=>{onPendingChange(dirty);return()=>onPendingChange(false);},[dirty,onPendingChange]);
 const update=(content:SevenContent,resolved=false)=>{setLine(old=>old?{...old,content,confirmed:false,...(resolved?{comparison:old.comparison?{...old.comparison,accepted:true}:undefined,textSource:old.textSource?{...old.textSource,resolved:true}:undefined}:{})}:old);setError('');};
 const choose=(id:string)=>{const m=materials.find(m=>m.id===id);if(!m)return;setLine(old=>({...(old??{uiKey:'compose-new',ref:{kind:'new' as const,clientKey:'compose-new'},confirmed:false}),confirmed:false,comparison:undefined,textSource:old?.textSource?{...old.textSource,resolved:true}:undefined,content:{Material_ID:textCell(m.id),Item_Name:textCell(m.name),Original_Item_Name:old?.content.Original_Item_Name??textCell(''),Quantity:{kind:'number',value:old&&contentText(old.content,'Unit')===m.unit&&old.content.Quantity.kind==='number'?old.content.Quantity.value:old?0:m.minQty},Unit:textCell(m.unit),Vendor:textCell(m.vendor),Remarks:old?.content.Remarks??textCell('')}}));setPending(false);setError('');};
 const issues=line?editorLineIssues(line,rule,true,false):[];
 return <section className="crew-entry-panel" aria-label={editing?'修改清單材料':'選擇及加入材料'}><h2 className="section-title">{editing?'修改清單材料':'選擇材料'}</h2><MaterialPicker materials={materials} value={line?contentText(line.content,'Material_ID'):''} disabled={disabled} onChange={choose}/>
 <button type="button" className="btn btn-quiet" disabled={disabled} onClick={()=>{setLine({uiKey:editing?.uiKey??'compose-new',ref:editing?.ref??{kind:'new',clientKey:'compose-new'},confirmed:false,content:{Material_ID:textCell(''),Item_Name:textCell(''),Original_Item_Name:editing?.content.Original_Item_Name??textCell(''),Quantity:{kind:'number',value:1},Unit:textCell('式'),Vendor:textCell(''),Remarks:textCell('')}});setPending(false);}}>找不到材料？改用自填材料</button>
 {line&&<div className="entry-material" data-has-rule={Boolean(rule)}><OrderMaterialLine key={line.uiKey+contentText(line.content,'Material_ID')} line={line} index={0} materials={materials} rule={rule} selected={false} mergeMode={false} admin={false} requireConfirmation={false} quantityStepper hideVendor showIssues={showIssues} disabled={disabled} derived={false} issues={issues} onEdit={(_key,c)=>update(c)} onResolve={(_key,c)=>update(c,true)} onCheck={()=>{}} onSelect={()=>{}} onRemove={()=>{setLine(null);setPending(false);}} onPending={(_key,value)=>setPending(value)}/></div>}
 {error&&<p className="feedback-error" role="alert">{error}</p>}
 {line&&<div className="crew-entry-actions"><button type="button" className="btn btn-primary" disabled={disabled} onClick={()=>{if(pending||issues.length){setShowIssues(true);setError(pending?'請完成數量輸入。':issues[0].message);return;}if(onCommit(line)){setLine(null);setPending(false);setShowIssues(false);}}}>{editing?'儲存材料修改':'加入待送出清單'}</button>{editing&&<button type="button" className="btn btn-secondary" disabled={disabled} onClick={onCancel}>取消修改</button>}</div>}
 </section>;
}
