import { requireAccount, AccessError, apiError } from '@/lib/access';
import { consumeRate } from '@/lib/security-store';
import { readSingleSheet } from '@/lib/single-sheet-store.server';

export async function GET(request:Request){
  try{
    const {account,sheets}=await requireAccount();await consumeRate(account.email,'operation-receipt',20);
    const params=new URL(request.url).searchParams,ref=params.get('attemptRef');
    if([...params.keys()].some(k=>k!=='attemptRef')||params.getAll('attemptRef').length!==1||!ref||!/^attempt_hop_[0-9a-f-]{36}$/.test(ref))throw new AccessError('查詢格式不正確。',400);
    const {db}=await readSingleSheet(sheets),event=db.events.find(e=>e.receipt?.attemptRef===ref);
    if(!event||account.role!=='Admin'&&event.company!==account.company)throw new AccessError('找不到可查閱的作業。',404);
    return Response.json({contractVersion:2,...event.receipt},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return apiError(e,'目前無法核實作業結果，請保留表單。');}
}
