// Browser-safe editor intentions. No allocator, hash implementation or authority.
import type { ChangeSetRequest, SevenContent, SourceRef } from './order-change-set';
import {isPermanentLineId,type PermanentLineRef} from './order-identity';
import type { OrderRow } from './order-view';
import type { SubmissionResult } from './order-v2-contract';
import type { TextOrderLine } from './text-order';
import type { CatalogMaterial } from './material-catalog';
export type FormMode = 'new-formal' | 'new-draft' | 'edit-draft' | 'edit-pending' | 'resubmit' | 'reorder';
export type EditorLine = { uiKey: string; ref: SourceRef; content: SevenContent; confirmed: boolean; textSource?: {batch:string; parsed:TextOrderLine; resolved:boolean; quantityIssue:string}; deliveryNote?: {batch:string; text:string; applied:boolean}; initialContent?:SevenContent; copiedFrom?: PermanentLineRef; comparison?: { original: SevenContent; proposed?:SevenContent; kind: 'changed'|'unit-changed'|'unmatched'; accepted: boolean } };
export type EditorState = { lines: EditorLine[]; consumed: EditorLine[]; merges: ChangeSetRequest['merged'] };
export const textCell = (value: string) => ({ kind: 'string' as const, value });
export const contentText = (content: SevenContent, key: keyof SevenContent) => content[key].kind === 'string' ? content[key].value : '';
function displayRef(row:OrderRow):PermanentLineRef {
  const r=row.lineRef;if(!r||r.kind!=='permanent'||r.orderId!==row.orderId||r.lineId!==row.lineId||!isPermanentLineId(r.lineId))throw Error('材料參照格式無效。');
  // Format for editor intentions only; every mutation revalidates raw ownership.
  return {kind:'permanent',orderId:r.orderId,lineId:r.lineId};
}
export function editableRows(rows: readonly OrderRow[], reorder = false, key: () => string): EditorState {
  if (!rows.length || rows.some(r => r.readState !== 'verified' || !r.lineRef || !r.mcf || !r.content)) throw Error('資料尚未核實，無法開啟編輯。');
  return { lines: rows.map(r => { const uiKey = reorder ? key() : r.lineId; return { uiKey, ref: reorder ? { kind: 'new' as const, clientKey: uiKey } : displayRef(r), content: structuredClone(r.content!), ...(r.originalContent?{initialContent:structuredClone(r.originalContent)}:{}), confirmed: !reorder && r.effectiveReview === 'confirmed', ...(r.resolutionKind==='unresolved'?{comparison:{original:structuredClone(r.content!),kind:'unmatched' as const,accepted:false}}:{}), ...(reorder ? { copiedFrom: displayRef(r) } : {}) }; }), consumed: [], merges: [] };
}
export function reorderEditorRows(rows:readonly OrderRow[],materials:readonly CatalogMaterial[],key:()=>string,reorder=true):EditorState {
  const next=editableRows(rows,reorder,key);
  next.lines=next.lines.map(line=>{
    const c=line.content, material=materials.find(m=>m.id===contentText(c,'Material_ID'));
    if(!material)return {...line,comparison:{original:structuredClone(c),kind:'unmatched' as const,accepted:false}};
    if(material.name===contentText(c,'Item_Name')&&material.unit===contentText(c,'Unit')&&material.vendor===contentText(c,'Vendor'))return line;
    const sameUnit=material.unit===contentText(c,'Unit');
    // Preserve the old seven fields until the user accepts the current catalog.
    // In particular a draft can retain 100 M while a new-box quantity is pending.
    return {...line,confirmed:false,comparison:{original:structuredClone(c),proposed:{...c,Item_Name:textCell(material.name),Unit:textCell(material.unit),Vendor:textCell(material.vendor),Quantity:sameUnit?c.Quantity:{kind:'number' as const,value:0}},kind:sameUnit?'changed' as const:'unit-changed' as const,accepted:false}};
  });
  return next;
}
export function updateEditorLine(state: EditorState, key: string, content: SevenContent, originals: readonly OrderRow[]): EditorState {
  return { ...state, lines: state.lines.map(l => {
    if (l.uiKey !== key) return l;
    const old = l.ref.kind === 'permanent' ? originals.find(r => r.lineId === (l.ref as PermanentLineRef).lineId)?.content : undefined;
    const originalName = old ? contentText(old, 'Original_Item_Name') ? old.Original_Item_Name : JSON.stringify(old.Item_Name) !== JSON.stringify(content.Item_Name) ? old.Item_Name : old.Original_Item_Name : content.Original_Item_Name;
    const nextContent = { ...content, Original_Item_Name: originalName };
    return JSON.stringify(nextContent) === JSON.stringify(l.content) ? l : { ...l, content: nextContent, confirmed: false };
  }) };
}
export function mergeEditorLines(state: EditorState, keys: readonly string[], key: string, serverContent: SevenContent): EditorState {
  const sources = state.lines.filter(l => keys.includes(l.uiKey));
  if (sources.length !== keys.length || sources.length < 2 || new Set(keys).size !== keys.length || state.lines.some(l=>l.uiKey===key)) throw Error('請選擇至少兩筆不同材料。');
  return { lines: [...state.lines.filter(l => !keys.includes(l.uiKey)), { uiKey: key, ref: { kind: 'new', clientKey: key }, content: structuredClone(serverContent), confirmed: false }], consumed: [...state.consumed, ...sources], merges: [...state.merges, { sources: sources.map(l => l.ref), resultClientKey: key }] };
}
export function editorChangeSet(state: EditorState, originals: readonly OrderRow[], admin = false): ChangeSetRequest {
  const all = [...state.lines, ...state.consumed];
  const changed = all.filter(l => l.ref.kind === 'permanent' && JSON.stringify(l.content) !== JSON.stringify(originals.find(r=>r.lineId===(l.ref as PermanentLineRef).lineId)?.content)).map(l => ({lineRef:l.ref as PermanentLineRef,after:l.content}));
  const removed = originals.filter(r => !all.some(l=>l.ref.kind==='permanent'&&l.ref.lineId===r.lineId)).map(displayRef);
  const added = all.filter(l=>l.ref.kind==='new').map(l=>({clientKey:(l.ref as Extract<SourceRef,{kind:'new'}>).clientKey,purpose:state.merges.some(m=>m.resultClientKey===l.uiKey)?'merge-result' as const:'new-line' as const,content:l.content}));
  const touched = new Set<string>([...changed.map(c=>c.lineRef.lineId),...removed.map(r=>r.lineId),...state.consumed.flatMap(l=>l.ref.kind==='permanent'?[l.ref.lineId]:[])]);
  return {contractVersion:2,changeSetVersion:1,target:originals.length?{kind:'existing-order',orderId:originals[0].orderId}:{kind:'create-order'},expectations:originals.length?{scope:admin?'whole-order':'touched-lines',expectedStatus:originals[0].status,lines:originals.filter(r=>admin||touched.has(r.lineId)).map(r=>({lineRef:displayRef(r),expectedMcf:r.mcf!}))}:{scope:'new-order'},changed,added,removed,merged:state.merges};
}
/** An HTTP 2xx alone cannot clear a form. Malformed or missing receipts freeze it. */
export function submissionDisposition(body: unknown): 'confirmed' | 'rejected' | 'review-required' {
  if (!body || typeof body!=='object') return 'review-required';
  const b=body as Partial<SubmissionResult>;
  if(b.state==='confirmed' && typeof b.attemptRef==='string' && typeof b.orderId==='string' && Array.isArray(b.mapping) && Array.isArray(b.warnings)) return 'confirmed';
  if(b.state==='not-applied' && b.retry==='new-request-after-correction' && typeof b.code==='string') return 'rejected';
  return 'review-required';
}
export function mutationMessage(code:unknown):string {
  if(code==='INVALID_COMPANY')return '請選擇已登錄的代下單工班；若工班地區設定不一致，請先修正 Users。';
  if(code==='NICKNAME_REQUIRED')return '請先在 Users 設定您的 Nickname，再重新操作；本次尚未寫入。';
  if(code==='ORDER_NUMBER_EXHAUSTED')return '當日可用單號已用完，請聯絡管理者；本次尚未寫入。';
  if(typeof code!=='string')return '本次未套用，請檢查資料或聯絡管理者。';
  if(code==='H2_LIMIT_EXCEEDED'||code==='WRITE_REQUEST_TOO_LARGE')return '材料與確認紀錄超出本次可保存容量。請縮小需求範圍；本次尚未寫入。';
  if(/NOT_CONFIGURED|GENESIS_NOT_READY|SCHEMA_NOT_READY|DEPENDENC|NOT_READY/.test(code))return '此環境尚未具備安全保存條件，請聯絡管理者。';
  if(/UNAUTHORIZED|CREW_REQUIRED|FORBIDDEN|OWNERSHIP/.test(code))return '此帳號沒有操作這張需求單的權限。';
  if(/QUANTITY|CONTENT_INVALID|MATERIAL_CONTENT_INVALID/.test(code))return '請核對材料欄位及數量的最低量、級距與精度。';
  if(/CONFIRMATION|B1_/.test(code))return '材料確認尚未完成或已失效，請逐筆核對後重新確認。';
  if(/CATALOG|SOURCE/.test(code))return '材料來源或材料庫規則已變動，請重新選料並確認。';
  if(/R2_|ACTIVE_RETURN/.test(code))return '有效退回與處置尚未通過核實，請重新載入需求單確認。';
  if(/CHANGED|CONFLICT|HISTORY|INTEGRITY|UNACCOUNTED/.test(code))return '需求資料已變動或尚未核實，請重新載入核對後操作。';
  return '本次未套用，請檢查資料或聯絡管理者。';
}

// Shared notes are editor metadata; only the composed seven-field Remarks are saved.
export function ownRemarks(line:EditorLine):string {
  const remarks=contentText(line.content,'Remarks'),note=line.deliveryNote;
  return note?.applied&&note.text&&(remarks===note.text||remarks.startsWith(note.text+'\n'))?remarks.slice(note.text.length).replace(/^\n/,''):remarks;
}
export function setDeliveryNote(state:EditorState,batch:string,text:string,targets:ReadonlySet<string>):EditorState {
  return {...state,lines:state.lines.map(line=>{
    if(line.deliveryNote&&line.deliveryNote.batch!==batch||line.deliveryNote?.batch!==batch&&!targets.has(line.uiKey))return line;
    const applied=targets.has(line.uiKey),remarks=[applied?text:'',ownRemarks(line)].filter(Boolean).join('\n');
    return {...line,deliveryNote:{batch,text,applied},content:{...line.content,Remarks:textCell(remarks)},confirmed:contentText(line.content,'Remarks')===remarks?line.confirmed:false};
  })};
}
