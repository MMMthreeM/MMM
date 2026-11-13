import 'server-only';
import { randomUUID } from 'node:crypto';
import { parseV2Mutation, authorizeV2Intent, confirmationRequestBinding, type WriterActor } from './order-v2-contract';
import { planOrderChangeSet, type SevenContent } from './order-change-set';
import { materialBasis, createConfirmationService, type CatalogMaterial } from './order-confirmation.server';
import { encodeSheetDatabase, materialFingerprint, sheetDigest, type SheetDatabase, type SheetEvent } from './single-sheet-store.server';
import { ORDERS_V2_COLUMNS, requireV2 } from './order-v2-schema';
import type { PermanentLineRef } from './order-identity';
import type { OrderRow } from './order-view';
import { parseReturnRequest } from './order-return-state';
import { taipeiDateTime } from './date-range';
import { allocateOrderNumber } from './order-number';
import { nicknameForStoredPerson } from './order-people';

export function singleSheetBasis(c:SevenContent,catalog:readonly CatalogMaterial[],mode:'formal'|'draft-basic',allowPendingVendor=false){
  const materialId=c.Material_ID.kind==='string'?c.Material_ID.value:'';
  return materialBasis(c,catalog,sheetDigest(catalog),materialId?{kind:'catalog-selection',materialIdAtSelection:materialId,selectionEvidenceRef:'single-sheet-selection'}:{kind:'manual-entry',inputEvidenceRef:'single-sheet-entry'},mode,allowPendingVendor);
}
export async function planSingleSheetMutation(db:SheetDatabase,actor:WriterActor,body:unknown,catalog:readonly CatalogMaterial[],secret:string,options:{confirmOnly?:boolean;now?:()=>string;uuid?:()=>string;orderSuffix?:number;userNicknames?:ReadonlyMap<string,string>}={}){
  const request=parseV2Mutation(body),uid=options.uuid||randomUUID,at=options.now?.()||taipeiDateTime();
  const create=['create-formal','create-draft'].includes(request.intent),orderId=create?allocateOrderNumber(new Set([...db.rows.map(r=>r.orderId),...db.events.map(e=>e.orderId)]),at,options.orderSuffix):request.orderId!;
  const targetCrew=create&&actor.role==='Admin'?actor.crews?.find(crew=>crew.company===request.company):undefined;
  if(create&&actor.role==='Admin')requireV2(targetCrew,'INVALID_COMPANY',400);
  const previous=db.rows.filter(r=>r.orderId===orderId),company=create?(actor.role==='Admin'?targetCrew!.company:actor.company):previous[0]?.reqCompany;
  requireV2(company&&((create&&!previous.length)||(!create&&previous.length)),'UNAUTHORIZED',403);
  requireV2(!request.company||request.company===company,'UNAUTHORIZED',403);
  const status=previous[0]?.status||null,active=Boolean(previous[0]?.activeReturnRef?.startsWith('event:'));
  authorizeV2Intent(actor,request,company,status,active);
  const nickname=actor.name?.trim();
  requireV2(nickname, 'NICKNAME_REQUIRED', 400);
  const names=options.userNicknames||new Map<string,string>();
  if(request.reorderFrom){const source=db.rows.filter(r=>r.orderId===request.reorderFrom!.orderId);requireV2(source.length&&(actor.role==='Admin'||source.every(r=>r.reqCompany===actor.company))&&request.reorderFrom.lines.every(l=>source.some(r=>r.lineId===l.lineRef.lineId&&r.orderId===l.lineRef.orderId)),'UNAUTHORIZED',403);}
  const draft=['create-draft','save-draft'].includes(request.intent),mode=draft?'draft-basic':'formal';
  const allowPendingVendor=actor.role==='User'||create||request.intent==='submit-draft';
  const basis=(c:SevenContent)=>singleSheetBasis(c,catalog,mode,allowPendingVendor);
  const change=request.intent==='resubmit-order'&&request.returnRequest?.intent==='resubmit-order'?request.returnRequest.changeSet:request.changeSet;
  const contents=new Map<string,{content:SevenContent;old?:OrderRow;clientKey?:string}>();
  const touched=['create-formal','create-draft','save-draft','amend-order','resubmit-order'].includes(request.intent);
  let allocation:string[]=[];
  if(touched){
    requireV2(change,'CHANGESET_REQUIRED',400);
    const tables=encodeSheetDatabase(db),snapshot={kind:'typed-raw-orders' as const,provenance:'raw-orders' as const,snapshotRef:sheetDigest(tables.Orders),coverage:'all-orders' as const,columns:ORDERS_V2_COLUMNS,rows:tables.Orders.slice(1).map(row=>row.map(value=>({kind:typeof value,value})) as never)};
    const evidence='single-sheet:'+snapshot.snapshotRef;
    const planned=await planOrderChangeSet(change,{snapshot,coverageEvidence:{observationRef:snapshot.snapshotRef,evidenceRef:evidence},actor:{authenticated:true,principalRef:actor.email,evidenceRef:actor.authorityRef,role:actor.role,scope:actor.role==='Admin'?'admin':'company',company:actor.company},operation:{kind:create?'create-order':actor.role==='Admin'?'admin-edit':'crew-edit',company,evidenceRef:evidence,expectedScope:create?'new-order':actor.role==='Admin'?'whole-order':'touched-lines',allowedStatuses:status?[status]:[],validation:mode,allowDecimals:!draft},sourceProvider:{classify:q=>({kind:'v2',orderId:q.orderId,company:q.company,observationRef:snapshot.snapshotRef,evidenceRef:evidence})},...(create?{creation:{candidateOrderId:orderId,company,observationRef:snapshot.snapshotRef,evidenceRef:evidence,generation:'ready' as const,uniqueness:'verified-unused' as const}}:{}),readiness:{observationRef:snapshot.snapshotRef,b1:evidence,h2:evidence,r2:evidence,lifecycle:evidence,materialValidation:evidence,atomicWrite:'single-business-request',resultVerification:'exact-write-set'},quantityPolicy:c=>{const b=basis(c);return b.state==='verified'?b.catalogBasis.quantityPolicy:null;},validateContent:c=>{try{const b=basis(c);return {ok:b.state==='verified'&&b.businessValid,evidenceRef:evidence};}catch{return {ok:false,evidenceRef:evidence};}}});
    requireV2(planned.kind==='planned',planned.kind==='deny'?planned.code:'CHANGESET_INVALID');
    for(const line of planned.finalLines){const key=line.kind==='new'?line.clientKey:line.lineRef.lineId;contents.set(key,{content:line.content,...(line.kind==='new'?{clientKey:key}:{old:previous.find(r=>r.lineId===key)})});}
    allocation=planned.allocationSlots.map(s=>s.clientKey);
  }else{
    requireV2(!change,'UNEXPECTED_CHANGESET',400);for(const old of previous)contents.set(old.lineId,{content:old.content!,old});
  }
  requireV2(request.intent==='delete-order'||contents.size>0&&contents.size<=100,'INVALID_ORDER_SIZE');
  const formalConfirmation=touched&&!draft||request.intent==='submit-draft';
  const service=createConfirmationService(secret),binding=confirmationRequestBinding(request);
  const confirmations=[...contents].map(([key,{content}])=>({key,content}));
  if(formalConfirmation){for(const {key,content}of confirmations){const b=singleSheetBasis(content,catalog,'formal',allowPendingVendor);requireV2(b.state==='verified'&&b.businessValid,'CONTENT_INVALID');if(!options.confirmOnly){const token=request.confirmations?.find(t=>t.key===key)?.token;service.verify(token,actor,company,request.intent,create?'new':orderId,key,content,b,binding);}}}
  if(options.confirmOnly)return {request,orderId,company,confirmations:confirmations.map(({key,content})=>({key,token:service.issue(actor,company,request.intent,create?'new':orderId,key,content,singleSheetBasis(content,catalog,'formal',allowPendingVendor),binding)}))};
  if(['complete-review','prepare-shipping'].includes(request.intent))for(const old of previous){const b=singleSheetBasis(old.content!,catalog,'formal');requireV2(old.effectiveReview==='confirmed'&&b.state==='verified'&&b.businessValid,'CONFIRMATION_REQUIRED');}
  const mapping: {clientKey:string;lineId:string}[]=[],used=new Set([...db.rows.map(r=>r.lineId),...db.events.flatMap(e=>e.retiredIds||[])]);
  for(const clientKey of allocation){const lineId='lin_'+uid();requireV2(!used.has(lineId),'ALLOCATION_COLLISION');used.add(lineId);mapping.push({clientKey,lineId});}
  const eventId='hev_'+uid(),attemptRef='attempt_hop_'+uid();
  const nextStatus=request.intent==='amend-order'&&actor.role==='Admin'?status!:request.intent==='complete-review'?'審核完畢':request.intent==='prepare-shipping'?'準備出貨':request.intent==='deliver-orders'?'已送達':draft?'編輯中':touched||request.intent==='submit-draft'||['create-return','replace-current-return'].includes(request.intent)?'處理中':status!;
  const final:OrderRow[]=[...contents].map(([, {content,old,clientKey}])=>{
    const lineId=old?.lineId||mapping.find(m=>m.clientKey===clientKey)?.lineId;requireV2(lineId,'MAPPING_MISSING');
    const s=(k:keyof SevenContent)=>content[k].kind==='string'?content[k].value:'';
    return {...(old||previous[0]),lineId,lineRef:{kind:'permanent',orderId,lineId},orderId,orderDate:previous[0]?.orderDate||at,reqCompany:company,reqRegion:create?(targetCrew?.region??actor.region):previous[0].reqRegion,reqUser:previous[0]?.reqUser?nicknameForStoredPerson(previous[0].reqUser,names):nickname,status:nextStatus,draftName:draft?request.draftName!:previous[0]?.draftName||'',adminUser:actor.role==='Admin'?nickname:nicknameForStoredPerson(previous[0]?.adminUser||'',names),expectedDate:request.intent==='prepare-shipping'?request.expectedDate||'':previous[0]?.expectedDate||'',materialName:s('Item_Name'),catalogId:s('Material_ID'),originalMaterialName:s('Original_Item_Name'),quantity:content.Quantity.kind==='number'?content.Quantity.value:0,unit:s('Unit'),vendor:s('Vendor'),remarks:s('Remarks'),content,originalContent:old?.originalContent||content,mcf:materialFingerprint(content),readState:'verified',effectiveReview:formalConfirmation?'confirmed':old&&old.mcf===materialFingerprint(content)?old.effectiveReview:'unconfirmed',activeReturnRef:previous[0]?.activeReturnRef||'none',returnNote:'',adminNote:''};
  });
  let returnInfo:OrderRow['returnInfo'];
  if(request.returnRequest){const r=parseReturnRequest(request.returnRequest);requireV2(r.expectedActiveReturnRef===(previous[0]?.activeReturnRef||'none'),'ACTIVE_RETURN_CHANGED');
    if(r.intent==='resubmit-order'){
      const targets=previous[0].returnInfo?.targets;requireV2(targets&&r.resolutions.length===targets.length&&new Set(r.resolutions.map(d=>d.originalLineRef.lineId)).size===targets.length,'R2_RESOLUTIONS_REQUIRED');
      for(const d of r.resolutions){const target=targets.find(t=>t.lineRef.lineId===d.originalLineRef.lineId);requireV2(target&&d.originalLineRef.orderId===orderId&&target.mcf===d.originalMcf&&d.reason.trim()&&d.reason.length<=500,'R2_RESOLUTION_INVALID');if(d.action==='withdraw')requireV2(!final.some(l=>l.lineId===target.lineRef.lineId),'R2_WITHDRAW_CONFLICT');else {const chosen=d.result;const result=chosen?.kind==='new'?mapping.find(m=>m.clientKey===chosen.clientKey)?.lineId:chosen?.lineId;requireV2(final.some(l=>l.lineId===result&&l.mcf===d.expectedResultMcf),'R2_RESULT_CHANGED');}}
      final.forEach(l=>{l.activeReturnRef='none';l.returnInfo=undefined;});
    }else{
      requireV2(r.reason.trim()&&r.reason.length<=500&&r.targets.length>0&&new Set(r.targets.map(t=>t.lineRef.lineId)).size===r.targets.length,'R2_TARGETS_INVALID');
      requireV2(r.scope!=='order'||r.targets.length===previous.length,'R2_TARGETS_INVALID');
      const targets=r.targets.map(t=>{const old=previous.find(l=>l.lineId===t.lineRef.lineId&&l.orderId===t.lineRef.orderId&&l.mcf===t.expectedMcf);requireV2(old&&(!t.reason||t.reason.length<=500),'R2_TARGET_CHANGED');return {lineRef:old.lineRef! as PermanentLineRef,mcf:old.mcf!,reason:t.reason,name:old.materialName};});
      returnInfo={eventId,reason:r.reason,scope:r.scope,targets};final.forEach(l=>{l.activeReturnRef='event:'+eventId;l.returnInfo=returnInfo;});
    }
  }
  const type:Record<string,string>={'create-formal':'ORDER_CREATED','create-draft':'DRAFT_CREATED','save-draft':'DRAFT_SAVED','submit-draft':'DRAFT_SUBMITTED','amend-order':'ORDER_AMENDED','delete-order':'ORDER_DELETED','complete-review':'REVIEW_COMPLETED','prepare-shipping':'SHIPPING_PREPARED','deliver-orders':'ORDER_DELIVERED','create-return':'RETURN_CREATED','replace-current-return':'RETURN_CREATED','resubmit-order':'ORDER_RESUBMITTED'};
  const rows=[...db.rows.filter(r=>r.orderId!==orderId),...(request.intent==='delete-order'?[]:final)];
  const receipt={state:'confirmed' as const,attemptRef,orderId,mapping,warnings:[] as string[]};
  const event:SheetEvent={id:eventId,orderId,company,actor:actor.email,at,type:type[request.intent],publicEvent:{eventId,eventType:type[request.intent],actor:actor.email,at,statusBefore:status,statusAfter:request.intent==='delete-order'?null:nextStatus,reason:returnInfo?.reason||null,targetResolutions:[],...(returnInfo?{returnTargets:returnInfo.targets.map(t=>({...t,reason:t.reason||returnInfo!.reason,name:t.name||null}))}:{})},returnInfo,receipt,retiredIds:previous.filter(r=>!rows.some(l=>l.lineId===r.lineId)).map(r=>r.lineId),postDigest:sheetDigest(rows.filter(r=>r.orderId===orderId).map(r=>[r.lineId,r.mcf,r.status,r.activeReturnRef]))};
  return {request,orderId,company,confirmations:[],receipt,db:{rows,events:[...db.events,event]}};
}
