import 'server-only';
import { requireAccount, apiError, AccessError } from './access';
import { loadOrderSheet } from './order-sheet';
import { recentMonthRange } from './date-range';
import { isQueryDate } from './date-range';
import { displayOrderPeople, userNicknames } from './order-people';

export async function handleOrdersGet(request:Request,scope:'company'|'admin'):Promise<Response>{
  try{
    const {account,sheets,users}=await requireAccount(scope==='admin'),params=new URL(request.url).searchParams;
    const allowed=scope==='admin'?['scope','startDate','endDate']:[];
    if([...params.keys()].some(k=>!allowed.includes(k)||params.getAll(k).length!==1)||params.has('scope')&&params.get('scope')!=='all')throw new AccessError('查詢條件不正確。',400);
    const defaults=scope==='admin'&&params.get('scope')!=='all'?recentMonthRange():{startDate:'',endDate:''};
    const start=params.get('startDate')??defaults.startDate,end=params.get('endDate')??defaults.endDate;
    if(start&&!isQueryDate(start)||end&&!isQueryDate(end)||start&&end&&start>end)throw new AccessError('日期範圍不正確。',400);
    const {rows}=await loadOrderSheet(sheets);
    const data=rows.filter(r=>scope==='company'?account.role==='Admin'||r.reqCompany===account.company:r.status!=='編輯中'&&(!start||r.orderDate.slice(0,10)>=start)&&(!end||r.orderDate.slice(0,10)<=end));
    return Response.json({contractVersion:2,data:displayOrderPeople(data,userNicknames(users))},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return apiError(e,'無法讀取需求資料，請確認新版資料庫設定。');}
}
