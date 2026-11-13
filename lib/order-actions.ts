import 'server-only';
import type { OrderExecutor } from './mutation-security';
import { prepareSingleSheetsDispatch } from './google-sheets';
import { readSingleSheet, singleSheetWriteRequests, sheetDigest } from './single-sheet-store.server';
import { planSingleSheetMutation } from './single-sheet-mutations.server';
import { readV2Catalog } from './single-sheet-catalog.server';
import { requireV2, V2Error } from './order-v2-schema';
import { notifyV2Mutation } from './order-notifications';
import { groupOrders } from './order-view';
import { userNicknames } from './order-people';

// HTTP DTO version 2 is retained; storage has ONE single-Sheets schema (3).
export function ordersExecutor(entry:'orders-post'|'draft-submit'|'delete-item'|'admin-edit'|'admin-status'):OrderExecutor{
  const allowed:Record<typeof entry,string[]>={'orders-post':['create-formal','create-draft','save-draft','amend-order','resubmit-order'],'draft-submit':['submit-draft'],'delete-item':['delete-order','amend-order'],'admin-edit':['amend-order'],'admin-status':['create-return','replace-current-return','complete-review','prepare-shipping','deliver-orders']};
  return async context=>{
    let attempted=false,ack=false,prepared:Awaited<ReturnType<typeof planSingleSheetMutation>>|undefined;
    try{
      const id=process.env.GOOGLE_SHEET_ID,secret=process.env.SHEETS_CONFIRMATION_SECRET||process.env.NEXTAUTH_SECRET;
      requireV2(id&&secret&&Buffer.byteLength(secret)>=32,'SHEETS_WRITER_NOT_CONFIGURED',503);
      requireV2(allowed[entry].includes(String(context.untrustedBody.intent)),'ENDPOINT_INTENT_MISMATCH',400);
      const before=await readSingleSheet(context.sheets,id),catalog=await readV2Catalog(context.sheets,id);
      const actor={...context.account,authorityRef:'users:'+sheetDigest(context.users)};
      prepared=await planSingleSheetMutation(before.db,actor,context.untrustedBody,catalog.materials,secret,{userNicknames:userNicknames(context.users)});
      requireV2(prepared.db&&prepared.receipt,'SHEETS_PLAN_INVALID');
      const write=singleSheetWriteRequests(before,prepared.db),wire=JSON.stringify({requests:write.requests});
      requireV2(Buffer.byteLength(wire)<=2000000,'WRITE_REQUEST_TOO_LARGE',413);
      const dispatcher=await prepareSingleSheetsDispatch(id);
      const [fresh,currentCatalog]=await Promise.all([readSingleSheet(context.sheets,id),readV2Catalog(context.sheets,id)]);
      requireV2(sheetDigest(fresh.tables)===sheetDigest(before.tables)&&currentCatalog.digest===catalog.digest,'ORDER_CONTENT_CHANGED');
      requireV2(await context.lock.verifyOwner(),'LOCK_OWNERSHIP_LOST',503);
      attempted=true;await dispatcher.dispatch(wire);ack=true;
      const after=await readSingleSheet(context.sheets,id);
      requireV2(sheetDigest(after.tables)===sheetDigest(write.tables),'SHEETS_POSTCONDITIONS_UNVERIFIED');
      const warnings:string[]=[];
      if(!['create-draft','save-draft','amend-order','delete-order'].includes(prepared.request.intent)){
        try{const group=groupOrders(after.db.rows).find(g=>g.orderId===prepared!.orderId);if(!group||!await notifyV2Mutation(group,context.users,prepared.request.intent,context.account.name,group.first.returnInfo?.reason||''))warnings.push('NOTIFICATION_PENDING');}catch{warnings.push('NOTIFICATION_PENDING');}
      }
      return {result:{...prepared.receipt,warnings},coordination:'release-owner-only',dispatch:'attempted',acknowledgement:'observed'};
    }catch(e){
      if(attempted&&prepared?.receipt)return {result:{state:ack?'acknowledged-unverified':'unknown',attemptRef:prepared.receipt.attemptRef,orderId:prepared.orderId,retry:'prohibited',message:'結果待核實，請保留表單，勿重新送出。'},coordination:'retain',dispatch:'attempted',acknowledgement:ack?'observed':'not-observed'};
      return {result:{state:'not-applied',code:e instanceof V2Error?e.code:'SHEETS_PREPARATION_UNAVAILABLE',retry:'new-request-after-correction'},coordination:'release-owner-only',dispatch:'not-dispatched',acknowledgement:'not-observed'};
    }
  };
}
