import 'server-only';
import { createHash } from 'node:crypto';
import type { getGoogleSheets } from './google-sheets';
import { ORDERS_V2_COLUMNS, requireV2 } from './order-v2-schema';
import { B1_COLUMNS } from './order-item-state';
import { MATERIAL_CONTENT_FIELDS, fingerprintMaterialContent } from './material-content-fingerprint';
import type { OrderRow, PublicHistoryEvent } from './order-view';
import type { SevenContent } from './order-change-set';
import type { SubmissionResult } from './order-v2-contract';

// A single, explicit storage contract. There is no automatic v1/v2 adoption.
export const SINGLE_SHEET_VERSION = 3;
export const SINGLE_SHEET_HISTORY_COLUMNS = ['Schema_Version','Event_ID','Order_ID','Event_At','Actor','Event_Type','Part_Index','Part_Count','Payload_Digest','Payload_Part'] as const;
export const SINGLE_SHEET_SCHEMAS = { Orders: ORDERS_V2_COLUMNS, Draft_Item_State: B1_COLUMNS, Order_History: SINGLE_SHEET_HISTORY_COLUMNS } as const;
export type SheetTable = keyof typeof SINGLE_SHEET_SCHEMAS;
export type SheetAtom = string | number | boolean;
export type SheetEvent = {
  id: string; orderId: string; at: string; actor: string; company: string; type: string;
  publicEvent: PublicHistoryEvent;
  returnInfo?: OrderRow['returnInfo'];
  receipt?: Extract<SubmissionResult, {state:'confirmed'}>;
  postDigest?: string;
  retiredIds?: string[];
  importSource?: { spreadsheetId:string; headers:string[]; rows:SheetAtom[][]; digest:string };
};
export type SheetDatabase = { rows: OrderRow[]; events: SheetEvent[] };
export type SheetSnapshot = { db: SheetDatabase; tables: Record<SheetTable, SheetAtom[][]>; ids: Record<SheetTable, number>; capacity: Record<SheetTable, {rows:number;columns:number}> };
export const sheetDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function materialFingerprint(content: SevenContent) {
  const result = fingerprintMaterialContent(MATERIAL_CONTENT_FIELDS, MATERIAL_CONTENT_FIELDS.map(k=>content[k]));
  requireV2(result.ok,'MATERIAL_CONTENT_INVALID'); return result.fingerprint;
}
const text = (v: unknown) => typeof v === 'string' ? v : '';
function parseJson<T>(v: SheetAtom | undefined): T { requireV2(typeof v==='string','SHEETS_STATE_INVALID'); try{return JSON.parse(v) as T;}catch{throw Error('SHEETS_STATE_INVALID');} }
export function encodeSheetDatabase(db: SheetDatabase): Record<SheetTable,SheetAtom[][]> {
  const orders: SheetAtom[][] = [[...ORDERS_V2_COLUMNS]], states: SheetAtom[][] = [[...B1_COLUMNS]], history: SheetAtom[][] = [[...SINGLE_SHEET_HISTORY_COLUMNS]];
  for(const r of db.rows){
    requireV2(r.content && r.mcf===materialFingerprint(r.content),'SHEETS_CONTENT_INVALID');
    const fields: Record<string,SheetAtom> = { Order_ID:r.orderId,Line_ID:r.lineId,Order_Date:r.orderDate,Req_User:r.reqUser,Req_Company:r.reqCompany,Req_Region:r.reqRegion,Material_ID:r.catalogId||'',Item_Name:r.materialName,Original_Item_Name:r.originalMaterialName||'',Quantity:r.quantity,Unit:r.unit,Vendor:r.vendor,Remarks:r.remarks,Status:r.status,Draft_Name:r.draftName,Admin_User:r.adminUser,Expected_Date:r.expectedDate,Active_Return_Ref:r.activeReturnRef||'none',Schema_Version:SINGLE_SHEET_VERSION,Namespace_ID:'single-sheet',Created_Event_Ref:'single-sheet:import-or-create' };
    orders.push(ORDERS_V2_COLUMNS.map(k=>fields[k]));
    const state: Record<string,SheetAtom> = { Schema_Version:SINGLE_SHEET_VERSION,Record_Type:'ITEM',Order_ID:r.orderId,Company:r.reqCompany,Line_ID:r.lineId,Source_State_JSON:JSON.stringify({version:3,confirmed:r.effectiveReview==='confirmed'}),Original_Data:JSON.stringify(r.originalContent||r.content),Saved_Content_Fingerprint:r.mcf,Updated_At:r.orderDate };
    states.push(B1_COLUMNS.map(k=>state[k]??''));
  }
  for(const e of db.events){
    const payload=JSON.stringify(e), digest=sheetDigest(e), parts:string[]=[];
    // UTF-16 slicing is rejoined before JSON parsing; literal cells retain pairs.
    for(let i=0;i<payload.length;){let end=Math.min(i+8000,payload.length);if(end<payload.length && /[\uD800-\uDBFF]/u.test(payload[end-1]))end--;parts.push(payload.slice(i,end));i=end;}
    parts.forEach((part,i)=>history.push([3,e.id,e.orderId,e.at,e.actor,e.type,i,parts.length,digest,part]));
  }
  return {Orders:orders,Draft_Item_State:states,Order_History:history};
}
export function decodeSheetDatabase(tables: Record<SheetTable,SheetAtom[][]>): SheetDatabase {
  for(const key of Object.keys(SINGLE_SHEET_SCHEMAS) as SheetTable[]) requireV2(JSON.stringify(tables[key][0])===JSON.stringify(SINGLE_SHEET_SCHEMAS[key]),'SINGLE_SHEET_SCHEMA_NOT_READY',503);
  const eventParts=new Map<string,SheetAtom[][]>();
  for(const r of tables.Order_History.slice(1)){requireV2(r[0]===3 && typeof r[1]==='string','SHEETS_HISTORY_INVALID');const list=eventParts.get(String(r[1]))||[];list.push(r);eventParts.set(String(r[1]),list);}
  const events:SheetEvent[]=[];
  for(const [id,parts]of eventParts){
    parts.sort((a,b)=>Number(a[6])-Number(b[6]));const count=parts[0][7];
    requireV2(Number.isSafeInteger(count)&&parts.length===count&&parts.every((p,i)=>p[6]===i&&p[7]===count&&p[8]===parts[0][8]),'SHEETS_HISTORY_INCOMPLETE');
    const e=parseJson<SheetEvent>(parts.map(p=>p[9]).join(''));
    requireV2(e.id===id&&sheetDigest(e)===parts[0][8]&&e.orderId===parts[0][2]&&e.actor===parts[0][4]&&e.type===parts[0][5]&&Array.isArray(e.publicEvent?.targetResolutions),'SHEETS_HISTORY_INVALID');events.push(e);
  }
  const states=new Map<string,{confirmed:boolean;original:SevenContent;mcf:string;company:string;orderId:string}>();
  for(const r of tables.Draft_Item_State.slice(1)){
    requireV2(r[0]===3&&r[1]==='ITEM'&&typeof r[4]==='string'&&!states.has(r[4]),'SHEETS_STATE_INVALID');
    const state=parseJson<{version:number;confirmed:boolean}>(r[6]);requireV2(state.version===3&&typeof state.confirmed==='boolean','SHEETS_STATE_INVALID');
    states.set(r[4],{confirmed:state.confirmed,original:parseJson<SevenContent>(r[7]),mcf:text(r[8]),company:text(r[3]),orderId:text(r[2])});
  }
  const ids=new Set<string>();
  const rows=tables.Orders.slice(1).map(r=>{
    const get=(k:typeof ORDERS_V2_COLUMNS[number])=>r[ORDERS_V2_COLUMNS.indexOf(k)];
    const id=text(get('Line_ID')),orderId=text(get('Order_ID')),company=text(get('Req_Company')),state=states.get(id);
    requireV2(get('Schema_Version')===3&&get('Namespace_ID')==='single-sheet'&&/^lin_[0-9a-f-]{36}$/.test(id)&&!ids.has(id)&&orderId&&company&&state&&state.company===company&&state.orderId===orderId,'SHEETS_IDENTITY_INVALID');ids.add(id);
    const content=Object.fromEntries(MATERIAL_CONTENT_FIELDS.map(k=>{const v=get(k);requireV2(typeof v==='string'||typeof v==='number','SHEETS_CONTENT_INVALID');return [k,{kind:typeof v,value:v}];})) as SevenContent;
    const mcf=materialFingerprint(content);requireV2(mcf===state.mcf,'SHEETS_CONTENT_CHANGED');
    const activeReturnRef=text(get('Active_Return_Ref')),orderEvents=events.filter(e=>e.orderId===orderId),active=orderEvents.find(e=>'event:'+e.id===activeReturnRef);
    requireV2(activeReturnRef==='none'||Boolean(active?.returnInfo),'SHEETS_RETURN_INVALID');
    const row:OrderRow={lineId:id,lineRef:{kind:'permanent',orderId,lineId:id},orderId,reqCompany:company,orderDate:text(get('Order_Date')),reqUser:text(get('Req_User')),reqRegion:text(get('Req_Region')),materialName:text(get('Item_Name')),catalogId:text(get('Material_ID')),originalMaterialName:text(get('Original_Item_Name')),quantity:Number(get('Quantity')),unit:text(get('Unit')),vendor:text(get('Vendor')),remarks:text(get('Remarks')),status:text(get('Status')),draftName:text(get('Draft_Name')),adminUser:text(get('Admin_User')),expectedDate:text(get('Expected_Date')),activeReturnRef,returnInfo:active?.returnInfo,returnNote:active?.returnInfo?.reason||'',adminNote:active?.returnInfo?.targets.find(t=>t.lineRef.lineId===id)?.reason||'',content,originalContent:state.original,mcf,readState:'verified',effectiveReview:state.confirmed?'confirmed':'unconfirmed',history:orderEvents.map(e=>e.publicEvent)};
    requireV2(Number.isFinite(row.quantity)&&row.quantity>0&&['編輯中','處理中','審核完畢','準備出貨','已送達'].includes(row.status),'SHEETS_CONTENT_INVALID');return row;
  });
  requireV2(states.size===rows.length,'SHEETS_STATE_ORPHAN');
  const groups=new Map<string,OrderRow[]>();for(const row of rows){const g=groups.get(row.orderId)||[];g.push(row);groups.set(row.orderId,g);}
  for(const g of groups.values()) requireV2(g.every(r=>r.reqCompany===g[0].reqCompany&&r.status===g[0].status&&r.activeReturnRef===g[0].activeReturnRef),'SHEETS_ORDER_INCONSISTENT');
  return {rows,events};
}
export async function readSingleSheet(sheets:Awaited<ReturnType<typeof getGoogleSheets>>,spreadsheetId=process.env.GOOGLE_SHEET_ID):Promise<SheetSnapshot>{
  requireV2(spreadsheetId,'SHEETS_NOT_CONFIGURED',503);
  const result=await sheets.spreadsheets.get({spreadsheetId,ranges:Object.keys(SINGLE_SHEET_SCHEMAS).map(k=>`'${k}'`),includeGridData:true,fields:'spreadsheetId,sheets(properties(sheetId,title,gridProperties),data(startRow,startColumn,rowData(values(userEnteredValue))))'},{retry:false,timeout:15000});
  requireV2(result.data.spreadsheetId===spreadsheetId,'SHEETS_SOURCE_MISMATCH');
  const tables={} as SheetSnapshot['tables'],ids={} as SheetSnapshot['ids'],capacity={} as SheetSnapshot['capacity'];
  for(const key of Object.keys(SINGLE_SHEET_SCHEMAS) as SheetTable[]){
    const matches=result.data.sheets?.filter(s=>s.properties?.title===key)||[];requireV2(matches.length===1,'SINGLE_SHEET_SCHEMA_NOT_READY',503);const sheet=matches[0],data=sheet.data;
    requireV2(data?.length===1&&!data[0].startRow&&!data[0].startColumn&&sheet.properties?.sheetId!==undefined,'SHEETS_COVERAGE_INVALID');
    ids[key]=sheet.properties!.sheetId!;capacity[key]={rows:sheet.properties!.gridProperties!.rowCount!,columns:sheet.properties!.gridProperties!.columnCount!};
    tables[key]=(data![0].rowData||[]).map(r=>(r.values||[]).map(c=>{const v=c.userEnteredValue;if(!v)return '';requireV2(!v.formulaValue,'SHEETS_FORMULA_NOT_ALLOWED');return v.stringValue??v.numberValue??v.boolValue??'';})).filter(r=>r.some(v=>v!==''));
    tables[key]=tables[key].map(r=>{const width=SINGLE_SHEET_SCHEMAS[key].length;requireV2(r.slice(width).every(v=>v===''),'SHEETS_EXTRA_DATA');return Array.from({length:width},(_,i)=>r[i]??'');});
  }
  return {db:decodeSheetDatabase(tables),tables,ids,capacity};
}
export function singleSheetWriteRequests(before:SheetSnapshot,after:SheetDatabase){
  const tables=encodeSheetDatabase(after),requests:object[]=[];
  for(const key of Object.keys(tables) as SheetTable[]){const data=tables[key],width=SINGLE_SHEET_SCHEMAS[key].length,height=Math.max(data.length,before.tables[key].length);
    if(height>before.capacity[key].rows)requests.push({appendDimension:{sheetId:before.ids[key],dimension:'ROWS',length:height-before.capacity[key].rows}});
    requests.push({updateCells:{range:{sheetId:before.ids[key],startRowIndex:0,endRowIndex:height,startColumnIndex:0,endColumnIndex:width},rows:Array.from({length:height},(_,i)=>({values:Array.from({length:width},(_,j)=>{const v=data[i]?.[j];return v===undefined?{}:{userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v}};})})),fields:'userEnteredValue'}});
  }
  return {tables,requests};
}
