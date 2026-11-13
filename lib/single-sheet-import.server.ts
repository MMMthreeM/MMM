import 'server-only';
import { randomUUID } from 'node:crypto';
import { requireV2 } from './order-v2-schema';
import { taipeiDateTime } from './date-range';
import { materialFingerprint, sheetDigest, encodeSheetDatabase, decodeSheetDatabase, type SheetAtom, type SheetDatabase, type SheetEvent } from './single-sheet-store.server';
import type { SevenContent } from './order-change-set';
import type { OrderRow } from './order-view';

/** Offline one-time conversion. No credentials, network, schema repair or apply. */
export function prepareSingleSheetImport(source:SheetAtom[][],sourceSpreadsheetId:string,options:{uuid?:()=>string;at?:string}={}){
  requireV2(source.length>0&&sourceSpreadsheetId,'IMPORT_SOURCE_REQUIRED');
  const headers=source[0].map(String),required=['Order_ID','Order_Date','Req_User','Req_Company','Req_Region','Item_Name','Quantity','Unit','Remarks','Vendor','Status','Draft_Name','Admin_Note','Admin_User','Expected_Date','Order_Return_Note','Material_ID','Original_Item_Name'];
  requireV2(headers.length===required.length&&new Set(headers).size===headers.length&&required.every(k=>headers.includes(k)),'IMPORT_HEADERS_INVALID');
  const uid=options.uuid||randomUUID,at=options.at||taipeiDateTime(),digest=sheetDigest(source),groups=new Map<string,{row:SheetAtom[];sourceRow:number}[]>();
  for(const [index,row]of source.slice(1).entries()){
    if(!row.some(v=>v!==''))continue;
    requireV2(row.length<=headers.length,'IMPORT_EXTRA_DATA');
    const id=row[headers.indexOf('Order_ID')];requireV2(typeof id==='string'&&id.trim(),'IMPORT_ORDER_ID_INVALID');
    const list=groups.get(id)||[];list.push({row,sourceRow:index+2});groups.set(id,list);
  }
  const rows:OrderRow[]=[],events:SheetEvent[]=[],used=new Set<string>();
  const date=(v:SheetAtom|undefined)=>{
    if(typeof v==='string'){requireV2(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(v),'IMPORT_DATE_INVALID');return v.replace('T',' ');}
    requireV2(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<2958466,'IMPORT_DATE_INVALID');
    return new Date(Date.UTC(1899,11,30)+Math.round(v*86400000)).toISOString().slice(0,19).replace('T',' ');
  };
  for(const [orderId,lines]of groups){
    requireV2(lines.length<=100,'IMPORT_ORDER_SIZE_INVALID');
    const value=(row:SheetAtom[],key:string)=>row[headers.indexOf(key)]??'';
    const company=value(lines[0].row,'Req_Company'),status=value(lines[0].row,'Status');
    requireV2(typeof company==='string'&&company.trim()&&['已送達','審核完畢'].includes(String(status)),'IMPORT_STATUS_REQUIRES_DECISION');
    requireV2(lines.every(l=>value(l.row,'Req_Company')===company&&value(l.row,'Status')===status),'IMPORT_ORDER_INCONSISTENT');
    // No synthetic historical returns. Those require an explicit resolution plan.
    requireV2(lines.every(l=>!value(l.row,'Admin_Note')&&!value(l.row,'Order_Return_Note')),'IMPORT_RETURN_REQUIRES_DECISION');
    for(const {row}of lines){
      const s=(k:string)=>{const v=value(row,k);requireV2(typeof v==='string','IMPORT_TEXT_TYPE_INVALID');return v;};
      const quantity=value(row,'Quantity');requireV2(typeof quantity==='number'&&Number.isFinite(quantity)&&quantity>0,'IMPORT_QUANTITY_INVALID');
      const lineId='lin_'+uid();requireV2(!used.has(lineId),'IMPORT_ID_COLLISION');used.add(lineId);
      const content:SevenContent={Material_ID:{kind:'string',value:s('Material_ID')},Item_Name:{kind:'string',value:s('Item_Name')},Original_Item_Name:{kind:'string',value:s('Original_Item_Name')},Quantity:{kind:'number',value:quantity},Unit:{kind:'string',value:s('Unit')},Vendor:{kind:'string',value:s('Vendor')},Remarks:{kind:'string',value:s('Remarks')}};
      requireV2(s('Item_Name').trim()&&s('Unit').trim(),'IMPORT_CONTENT_INVALID');
      rows.push({orderId,lineId,lineRef:{kind:'permanent',orderId,lineId},orderDate:date(value(row,'Order_Date')),reqUser:s('Req_User'),reqCompany:company,reqRegion:s('Req_Region'),materialName:s('Item_Name'),catalogId:s('Material_ID'),originalMaterialName:s('Original_Item_Name'),quantity,unit:s('Unit'),vendor:s('Vendor'),remarks:s('Remarks'),status:String(status),draftName:s('Draft_Name'),adminUser:s('Admin_User'),expectedDate:value(row,'Expected_Date')===''?'':date(value(row,'Expected_Date')),activeReturnRef:'none',returnNote:'',adminNote:'',readState:'verified',content,originalContent:content,mcf:materialFingerprint(content),effectiveReview:'confirmed'});
    }
    const eventId='hev_'+uid();
    events.push({id:eventId,orderId,company,actor:'database-import',at,type:'DATABASE_IMPORTED',publicEvent:{eventId,eventType:'DATABASE_IMPORTED',actor:'database-import',at,statusBefore:null,statusAfter:String(status),reason:'由舊庫搬移；保留原狀態，此紀錄不代表重新審核。',targetResolutions:[]},importSource:{spreadsheetId:sourceSpreadsheetId,headers,rows:lines.map(l=>l.row),digest}});
  }
  const db:SheetDatabase={rows,events},tables=encodeSheetDatabase(db),decoded=decodeSheetDatabase(tables);
  requireV2(decoded.rows.length===rows.length&&decoded.events.length===groups.size,'IMPORT_ROUND_TRIP_FAILED');
  return {db,tables,sourceDigest:digest,summary:{orders:groups.size,lines:rows.length,deliveredOrders:events.filter(e=>e.publicEvent.statusAfter==='已送達').length,continuingOrders:events.filter(e=>e.publicEvent.statusAfter==='審核完畢').length}};
}
