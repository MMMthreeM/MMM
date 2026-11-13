import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { acquireWriteLock, consumeRate, saveAuditEvent, type AuditEvent } from '@/lib/security-store';
import { flushPendingAudits } from '@/lib/audit-delivery';
import { taipeiDateTime } from '@/lib/date-range';
import type { SubmissionResult } from './order-v2-contract';

export type WriterLock = Readonly<{owner:Readonly<{key:string;token:string}>;verifyOwner():Promise<boolean>}>;
export type WriterResult = Readonly<{result:SubmissionResult;coordination:'release-owner-only'|'retain';dispatch:'not-dispatched'|'attempted';acknowledgement:'observed'|'not-observed'}>;
type AccountContext = Awaited<ReturnType<typeof requireAccount>>;
export type OrderExecutor = (context:Readonly<AccountContext & {executionRef:string;actor:Readonly<{email:string;role:'Admin'|'User';company:string}>;untrustedBody:Readonly<Record<string,unknown>>;lock:WriterLock}>)=>Promise<WriterResult>;
export const mutationAudit = new AsyncLocalStorage<{details:string[]}>();
function freezeBody(body:Record<string,unknown>){
  const copy=structuredClone(body),pending:object[]=[copy];
  while(pending.length){const value=pending.pop()!;for(const child of Object.values(value))if(child&&typeof child==='object')pending.push(child);Object.freeze(value);}
  return copy;
}
export async function checkedMutationRequest(request: Request, maxBytes: 131072 | 524288 = 131072) {
  if (maxBytes !== 131072 && maxBytes !== 524288) throw new AccessError('請求容量設定不正確。', 503);
  // Cookies alone do not protect custom route handlers from same-site cross-origin requests.
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) throw new AccessError('平台來源尚未設定。', 503);
  let trusted: string;
  try { trusted = new URL(process.env.NEXTAUTH_URL || request.url).origin; } catch { throw new AccessError('平台來源設定不正確。', 503); }
  if (request.headers.get('origin') !== trusted || request.headers.get('sec-fetch-site') === 'cross-site') throw new AccessError('請求來源不正確，請重新整理平台後再試。', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new AccessError('僅接受 JSON 請求。', 415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new AccessError('請求內容過大。', 413);
  const reader = request.body?.getReader();
  const parts: Uint8Array[] = []; let size = 0;
  if (reader) while (true) { const result = await reader.read(); if (result.done) break; size += result.value.length; if (size > maxBytes) { await reader.cancel(); throw new AccessError('請求內容過大。', 413); } parts.push(result.value); }
  const text = Buffer.concat(parts).toString('utf8');
  let body; try { body = JSON.parse(text); } catch { throw new AccessError('請求內容格式不正確。', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccessError('請求內容必須為物件。', 400);
  return { request: new Request(request.url, { method: request.method, headers: request.headers, body: text }), body, digest: createHash('sha256').update(text).digest('hex') };
}

export function secureMutation(handler:(request:Request)=>Promise<Response>,options:{admin?:boolean;action:string;limit?:number;orderWrite?:boolean;executor?:OrderExecutor}){
  return async(request:Request):Promise<Response>=>{
    let unlock:Awaited<ReturnType<typeof acquireWriteLock>>|undefined,event:AuditEvent|undefined;
    let retain=false,started=false,intentSaved=false,intentUncertain=false,acquireUncertain=false,response:Response|undefined;
    try{
      const checked=await checkedMutationRequest(request,options.executor?524288:131072);
      const auth=await requireAccount(options.admin);
      await consumeRate(auth.account.email,options.action,options.limit??20);
      acquireUncertain=true;unlock=await acquireWriteLock();acquireUncertain=false;
      event={id:'SEC-'+randomUUID(),timestamp:taipeiDateTime(),email:auth.account.email,action:options.action,target:String(checked.body.orderId||'').slice(0,4000),details:'request_sha256='+checked.digest,outcome:'started'};
      intentUncertain=true;await saveAuditEvent(event);intentSaved=true;intentUncertain=false;
      const context={details:[] as string[]};
      if(options.executor){
        if(!unlock.owner||typeof unlock.verifyOwner!=='function')throw new AccessError('寫入鎖缺少核對資訊。',503);
        started=true;
        const receipt=await mutationAudit.run(context,()=>options.executor!(Object.freeze({...auth,executionRef:event!.id,actor:Object.freeze({email:auth.account.email,role:auth.account.role,company:auth.account.company}),untrustedBody:freezeBody(checked.body),lock:{owner:unlock!.owner,verifyOwner:unlock!.verifyOwner}})));
        retain=receipt.coordination==='retain';
        const result=receipt.result;
        event.outcome=result.state==='confirmed'?'completed':result.state==='not-applied'?'rejected':'unknown';
        event.details+='; result='+result.state+'; dispatch='+receipt.dispatch+'; ack='+receipt.acknowledgement+'; '+context.details.join('; ');
        const status=result.state==='confirmed'?200:result.state==='acknowledged-unverified'?202:result.state!=='not-applied'?503:/UNAUTHORIZED|FORBIDDEN|CREW_REQUIRED/.test(result.code)?403:/NOT_CONFIGURED|NOT_READY|UNAVAILABLE/.test(result.code)?503:/CONTRACT|REQUEST|INTENT/.test(result.code)?400:409;
        response=Response.json({contractVersion:2,...result},{status,headers:{'Cache-Control':'private, no-store'}});
      }else{
        // Auxiliary actions only: order writes always use the verified executor.
        if(options.orderWrite!==false)throw new AccessError('需求寫入流程尚未設定。',503);
        started=true;response=await mutationAudit.run(context,()=>handler(checked.request));
        event.outcome=response.ok?'completed':'rejected';event.details+='; HTTP='+response.status+'; '+context.details.join('; ');
      }
      try{await saveAuditEvent(event);await flushPendingAudits(auth.sheets);}catch{response.headers.set('X-Audit-Status','pending');}
    }catch(error){
      if(error instanceof AccessError&&error.status===423)acquireUncertain=false;
      retain=started&&options.orderWrite!==false;
      if(event&&intentSaved)try{await saveAuditEvent({...event,outcome:started?'unknown':'rejected'});}catch{/* Keep the original durable intent for manual reconciliation. */}
      const status=error instanceof AccessError?error.status:503;
      response=options.executor?Response.json({contractVersion:2,state:started?'unknown':'not-applied',code:status===401?'AUTH_REQUIRED':status===403?'FORBIDDEN':status===429?'RATE_LIMITED':acquireUncertain?'COORDINATION_UNVERIFIED':'PREPARATION_UNAVAILABLE',retry:started?'prohibited':acquireUncertain?'review-required':'new-request-after-correction',error:started?'結果待核實，請保留表單，勿重新送出。':'本次尚未寫入，請確認權限與系統連線。'},{status,headers:{'Cache-Control':'private, no-store'}}):apiError(error,'操作未完成，請稍後再試。');
      if([423,429].includes(response.status))response.headers.set('Retry-After','60');
      if(intentUncertain)response.headers.set('X-Audit-Status','pending');
    }finally{
      if(unlock&&!retain){try{const result=await unlock();if(result.kind!=='released-confirmed')response?.headers.set('X-Write-Status','review-required');}catch{response?.headers.set('X-Write-Status','review-required');}}
      if(retain||acquireUncertain)response?.headers.set('X-Write-Status','review-required');
    }
    if(!response)throw Error('Mutation response unavailable');
    return response;
  };
}
