/* eslint-disable @typescript-eslint/no-require-imports -- offline synthetic migration tests */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadModules}=require('../scripts/migrate-single-sheet.cjs');
const load=loadModules(),store=load('./single-sheet-store.server'),migration=load('./single-sheet-import.server'),mutations=load('./single-sheet-mutations.server');
const headers=['Order_ID','Order_Date','Req_User','Req_Company','Req_Region','Item_Name','Quantity','Unit','Remarks','Vendor','Status','Draft_Name','Admin_Note','Admin_User','Expected_Date','Order_Return_Note','Material_ID','Original_Item_Name'];
function source(status='審核完畢'){return [headers,['O1',45839,'crew@example.test','Crew','South','Wire',100,'M','=literal note','伸泰',status,'','','admin@example.test','','','M1','']];}
const catalog=[{id:'M1',name:'Wire',unit:'M',vendor:'伸泰',minimum:100,step:100,requiresRemarks:false}];
const actor={name:'管理暱稱',email:'admin@example.test',company:'Admin',region:'South',role:'Admin',authorityRef:'synthetic-users',crews:[{company:'Crew',region:'South'},{company:'Other Crew',region:'North'}]};
const secret='synthetic-local-test-secret-32-bytes-only';
const imported=()=>migration.prepareSingleSheetImport(source(),'synthetic-source',{at:'2026-11-11 10:00:00'});
test('import preserves original order and material fields; civil serial date becomes readable text',()=>{const p=imported(),r=p.db.rows[0];assert.equal(r.orderId,'O1');assert.equal(r.orderDate,'2025-07-01 00:00:00');assert.equal(r.status,'審核完畢');assert.equal(r.quantity,100);assert.equal(r.remarks,'=literal note');assert.match(r.lineId,/^lin_/);assert.equal(p.db.events[0].type,'DATABASE_IMPORTED');assert.deepEqual(p.db.events[0].importSource.rows,source().slice(1));});
test('approved imported order can prepare shipping and deliver without changing permanent IDs or materials',async()=>{const p=imported(),original=p.db.rows[0];const a=await mutations.planSingleSheetMutation(p.db,actor,{contractVersion:2,intent:'prepare-shipping',orderId:'O1',expectedDate:'2026-11-20'},catalog,secret);assert.equal(a.db.rows[0].status,'準備出貨');assert.equal(a.db.rows[0].lineId,original.lineId);assert.equal(a.db.rows[0].mcf,original.mcf);const b=await mutations.planSingleSheetMutation(a.db,actor,{contractVersion:2,intent:'deliver-orders',orderId:'O1'},catalog,secret);assert.equal(b.db.rows[0].status,'已送達');assert.equal(b.db.rows[0].expectedDate,'2026-11-20');assert.deepEqual(store.decodeSheetDatabase(store.encodeSheetDatabase(b.db)).rows[0].content,original.content);});
test('crew cannot ship and cross-company actor cannot edit imported order',async()=>{const db=imported().db;await assert.rejects(mutations.planSingleSheetMutation(db,{...actor,role:'User',company:'Other'},{contractVersion:2,intent:'prepare-shipping',orderId:'O1'},catalog,secret),/UNAUTHORIZED/);});
test('import refuses mixed companies/statuses, bad quantities and active return notes',()=>{for(const change of [r=>r[6]=0,r=>r[10]='審核中',r=>r[12]='needs correction']){const s=source();change(s[1]);assert.throws(()=>migration.prepareSingleSheetImport(s,'synthetic'));}const s=source();s.push([...s[1]]);s[2][3]='Other';assert.throws(()=>migration.prepareSingleSheetImport(s,'synthetic'),/INCONSISTENT/);});
test('duplicate materials remain distinct; source is not mutated',()=>{const s=source(),before=JSON.stringify(s);s.push([...s[1]]);const frozen=JSON.stringify(s),p=migration.prepareSingleSheetImport(s,'synthetic');assert.equal(new Set(p.db.rows.map(r=>r.lineId)).size,2);assert.equal(JSON.stringify(s),frozen);assert.notEqual(before,frozen);});
test('history chunk corruption, source changes and orphan state are refused',()=>{const p=imported();for(const change of [t=>t.Order_History[1][9]+='x',t=>t.Orders[1][9]=200,t=>t.Draft_Item_State.push([...t.Draft_Item_State[1]])]){const t=structuredClone(p.tables);change(t);assert.throws(()=>store.decodeSheetDatabase(t));}});
test('large unicode import history is chunked and losslessly reassembled',()=>{const s=source();s[1][8]='材料😀'.repeat(4500);const p=migration.prepareSingleSheetImport(s,'synthetic');assert(p.tables.Order_History.length>2);assert.equal(store.decodeSheetDatabase(p.tables).events[0].importSource.rows[0][8],s[1][8]);});
test('unconfirmed imported material cannot be shipped after catalog rules change',async()=>{await assert.rejects(mutations.planSingleSheetMutation(imported().db,actor,{contractVersion:2,intent:'prepare-shipping',orderId:'O1'},[{...catalog[0],minimum:200}],secret),/CONFIRMATION_REQUIRED/);});
test('writes use literal typed values, cover three tables in one batch and clear removed trailing rows',()=>{const p=imported(),before={tables:p.tables,ids:{Orders:10,Draft_Item_State:11,Order_History:12},capacity:{Orders:{rows:1000,columns:26},Draft_Item_State:{rows:1000,columns:26},Order_History:{rows:1000,columns:26}}};const plan=store.singleSheetWriteRequests(before,{rows:[],events:p.db.events});assert.equal(plan.requests.length,3);assert.equal(plan.requests[0].updateCells.rows[1].values[0].userEnteredValue,undefined);const literal=store.singleSheetWriteRequests({...before,tables:store.encodeSheetDatabase({rows:[],events:[]})},p.db);assert(literal.requests[0].updateCells.rows[1].values.some(c=>c.userEnteredValue?.stringValue==='=literal note'));});

function createBody(intent='create-formal',quantity=100){const content={Material_ID:{kind:'string',value:'M1'},Item_Name:{kind:'string',value:'Wire'},Original_Item_Name:{kind:'string',value:''},Quantity:{kind:'number',value:quantity},Unit:{kind:'string',value:'M'},Vendor:{kind:'string',value:'伸泰'},Remarks:{kind:'string',value:''}};return {contractVersion:2,intent,company:'Crew',...(intent==='create-draft'?{draftName:'shared draft'}:{}),changeSet:{contractVersion:2,changeSetVersion:1,target:{kind:'create-order'},expectations:{scope:'new-order'},changed:[],added:[{clientKey:'c_1',purpose:'new-line',content}],removed:[],merged:[]}};}
test('new formal request requires bound human confirmation, then round-trips single-Sheets schema',async()=>{const db={rows:[],events:[]},body=createBody();await assert.rejects(mutations.planSingleSheetMutation(db,actor,body,catalog,secret),/CONFIRMATION_REQUIRED/);const signed=await mutations.planSingleSheetMutation(db,actor,body,catalog,secret,{confirmOnly:true});const done=await mutations.planSingleSheetMutation(db,actor,{...body,confirmations:signed.confirmations},catalog,secret);assert.equal(done.db.rows[0].status,'處理中');assert.equal(store.decodeSheetDatabase(store.encodeSheetDatabase(done.db)).rows[0].effectiveReview,'confirmed');const changed=createBody('create-formal',200);await assert.rejects(mutations.planSingleSheetMutation(db,actor,{...changed,confirmations:signed.confirmations},catalog,secret),/MISMATCH/);});
test('draft can save sub-minimum integer without human confirmation; cannot be submitted unchanged',async()=>{const p=await mutations.planSingleSheetMutation({rows:[],events:[]},actor,createBody('create-draft',7),catalog,secret);assert.equal(p.db.rows[0].status,'編輯中');assert.equal(p.db.rows[0].quantity,7);await assert.rejects(mutations.planSingleSheetMutation(p.db,actor,{contractVersion:2,intent:'submit-draft',orderId:p.orderId},catalog,secret,{confirmOnly:true}),/CONTENT_INVALID/);});

test('crew custom materials submit without a vendor; admin must assign one before review and shipping',async()=>{
  const db={rows:[],events:[]},crew={...actor,role:'User',company:'Crew'},body=createBody('create-formal',3);
  Object.assign(body.changeSet.added[0].content,{Material_ID:{kind:'string',value:''},Item_Name:{kind:'string',value:'Custom fitting'},Unit:{kind:'string',value:'個'},Vendor:{kind:'string',value:''}});
  const signed=await mutations.planSingleSheetMutation(db,crew,body,catalog,secret,{confirmOnly:true});
  const submitted=await mutations.planSingleSheetMutation(db,crew,{...body,confirmations:signed.confirmations},catalog,secret);
  const row=submitted.db.rows[0];assert.equal(row.vendor,'');assert.equal(row.status,'處理中');
  for(const intent of ['complete-review','prepare-shipping'])await assert.rejects(mutations.planSingleSheetMutation(submitted.db,actor,{contractVersion:2,intent,orderId:row.orderId},catalog,secret));
  const amendment={contractVersion:2,intent:'amend-order',orderId:row.orderId,changeSet:{contractVersion:2,changeSetVersion:1,target:{kind:'existing-order',orderId:row.orderId},expectations:{scope:'whole-order',expectedStatus:row.status,lines:[{lineRef:row.lineRef,expectedMcf:row.mcf}]},changed:[{lineRef:row.lineRef,after:{...row.content,Vendor:{kind:'string',value:'益詮'}}}],added:[],removed:[],merged:[]}};
  const assignment=await mutations.planSingleSheetMutation(submitted.db,actor,amendment,catalog,secret,{confirmOnly:true});
  const assigned=await mutations.planSingleSheetMutation(submitted.db,actor,{...amendment,confirmations:assignment.confirmations},catalog,secret);
  const reviewed=await mutations.planSingleSheetMutation(assigned.db,actor,{contractVersion:2,intent:'complete-review',orderId:row.orderId},catalog,secret);
  const shipping=await mutations.planSingleSheetMutation(reviewed.db,actor,{contractVersion:2,intent:'prepare-shipping',orderId:row.orderId},catalog,secret);
  assert.equal(shipping.db.rows[0].vendor,'益詮');assert.equal(shipping.db.rows[0].status,'準備出貨');
});

test('new and deleted order numbers use the short date format without reusing a number',async()=>{
  const options={now:()=> '2026-11-13 08:10:00',orderSuffix:9668};
  const first=await mutations.planSingleSheetMutation({rows:[],events:[]},actor,createBody('create-draft'),catalog,secret,options);
  assert.equal(first.orderId,'ORD-20261113-9668');
  const active=await mutations.planSingleSheetMutation(first.db,actor,createBody('create-draft'),catalog,secret,options);
  assert.equal(active.orderId,'ORD-20261113-9669');
  const deleted=await mutations.planSingleSheetMutation(first.db,actor,{contractVersion:2,intent:'delete-order',orderId:first.orderId},catalog,secret);
  const next=await mutations.planSingleSheetMutation(deleted.db,actor,createBody('create-draft'),catalog,secret,options);
  assert.equal(next.orderId,'ORD-20261113-9669');assert.equal(first.db.rows[0].reqUser,actor.name);assert.equal(first.db.rows[0].adminUser,actor.name);
  assert.equal(first.db.events[0].actor,actor.email);assert.equal(first.db.events[0].publicEvent.actor,actor.email);
});

test('short order allocation handles wraparound and refuses an exhausted day',()=>{
  const {allocateOrderNumber}=load('./order-number');
  assert.equal(allocateOrderNumber(new Set(['ORD-20261113-9999']),'2026-11-13 01:00',9999),'ORD-20261113-0000');
  assert.throws(()=>allocateOrderNumber(new Set(Array.from({length:10000},(_,i)=>`ORD-20261113-${String(i).padStart(4,'0')}`)),'2026-11-13',0),/ORDER_NUMBER_EXHAUSTED/);
});

const peopleUsers=[['Email','Role','Company','Nickname','Telegram_Chat_ID'],['admin@example.test','Admin','Admin','管理暱稱','1'],['crew@example.test','User','Crew','工班暱稱','2']];
test('admin creates for a registered crew and stores that crew region instead of the admin region',async()=>{
  const result=await mutations.planSingleSheetMutation({rows:[],events:[]},actor,{...createBody('create-draft'),company:'Other Crew'},catalog,secret);
  assert.equal(result.db.rows[0].reqCompany,'Other Crew');assert.equal(result.db.rows[0].reqRegion,'North');assert.equal(result.db.rows[0].reqUser,actor.name);
  const missing=createBody('create-draft');delete missing.company;
  await assert.rejects(mutations.planSingleSheetMutation({rows:[],events:[]},actor,missing,catalog,secret),/INVALID_COMPANY/);
  await assert.rejects(mutations.planSingleSheetMutation({rows:[],events:[]},actor,{...createBody('create-draft'),company:'Unregistered'},catalog,secret),/INVALID_COMPANY/);
  await assert.rejects(mutations.planSingleSheetMutation({rows:[],events:[]},{...actor,role:'User',company:'Crew'}, {...createBody('create-draft'),company:'Other Crew'},catalog,secret),/UNAUTHORIZED/);
});

for(const status of ['編輯中','處理中','審核完畢','準備出貨','已送達'])test('admin amendment preserves progress, date and identity at stage '+status,async()=>{
  const db=imported().db;db.rows[0].status=status;db.rows[0].expectedDate='2026-11-20';db.rows[0].draftName=status==='編輯中'?'Shared draft':'';
  const row=db.rows[0],request={contractVersion:2,intent:'amend-order',orderId:row.orderId,changeSet:{contractVersion:2,changeSetVersion:1,target:{kind:'existing-order',orderId:row.orderId},expectations:{scope:'whole-order',expectedStatus:status,lines:[{lineRef:row.lineRef,expectedMcf:row.mcf}]},changed:[{lineRef:row.lineRef,after:{...row.content,Quantity:{kind:'number',value:200}}}],added:[],removed:[],merged:[]}};
  const signed=await mutations.planSingleSheetMutation(db,actor,request,catalog,secret,{confirmOnly:true});
  const result=await mutations.planSingleSheetMutation(db,actor,{...request,confirmations:signed.confirmations},catalog,secret);
  const changed=store.decodeSheetDatabase(store.encodeSheetDatabase(result.db)).rows[0];
  assert.equal(changed.quantity,200);assert.equal(changed.status,status);assert.equal(changed.expectedDate,'2026-11-20');assert.equal(changed.lineId,row.lineId);assert.equal(changed.orderId,row.orderId);assert.equal(result.db.events.at(-1).publicEvent.statusAfter,status);
  const invalid=structuredClone(request);invalid.changeSet.changed[0].after.Quantity.value=150;
  await assert.rejects(mutations.planSingleSheetMutation(db,actor,invalid,catalog,secret,{confirmOnly:true}),/SOURCE_CHANGE_INVALID/);
  if(['審核完畢','準備出貨','已送達'].includes(status))await assert.rejects(mutations.planSingleSheetMutation(db,{...actor,role:'User',company:'Crew'},request,catalog,secret,{confirmOnly:true}),/ORDER_STATE_CHANGED/);
});

test('crew directory contains only registered crew users and excludes conflicting regions',()=>{
  const {registeredCrews}=load('./order-people');
  const users=[['Email','Role','Company','Region','Nickname'],['a@example.test','User','Crew','South','A'],['b@example.test','User','Crew','South','B'],['c@example.test','Admin','Admin company','Central','C'],['d@example.test','User','Conflict','East','D'],['e@example.test','User','Conflict','West','E']];
  assert.deepEqual(registeredCrews(users),[{company:'Crew',region:'South'}]);
});

test('admin can edit a returned request without closing or replacing the crew return',async()=>{
  const initial=imported().db,row=initial.rows[0];
  const returned=await mutations.planSingleSheetMutation(initial,actor,{contractVersion:2,intent:'create-return',orderId:row.orderId,returnRequest:{contractVersion:2,r2Version:1,intent:'create-return',orderId:row.orderId,expectedActiveReturnRef:'none',scope:'order',reason:'Check specification',targets:[{lineRef:row.lineRef,expectedMcf:row.mcf,reason:null}]}},catalog,secret);
  const db=store.decodeSheetDatabase(store.encodeSheetDatabase(returned.db)),current=db.rows[0];
  const request={contractVersion:2,intent:'amend-order',orderId:row.orderId,changeSet:{contractVersion:2,changeSetVersion:1,target:{kind:'existing-order',orderId:row.orderId},expectations:{scope:'whole-order',expectedStatus:current.status,lines:[{lineRef:current.lineRef,expectedMcf:current.mcf}]},changed:[{lineRef:current.lineRef,after:{...current.content,Quantity:{kind:'number',value:200}}}],added:[],removed:[],merged:[]}};
  const signed=await mutations.planSingleSheetMutation(db,actor,request,catalog,secret,{confirmOnly:true});
  const next=await mutations.planSingleSheetMutation(db,actor,{...request,confirmations:signed.confirmations},catalog,secret);
  const actual=store.decodeSheetDatabase(store.encodeSheetDatabase(next.db)).rows[0];
  assert.equal(actual.activeReturnRef,current.activeReturnRef);assert.equal(actual.returnInfo.reason,'Check specification');assert.equal(actual.status,'處理中');assert.equal(actual.quantity,200);
});
test('Orders save nicknames while preserving original material and authenticated audit identity',async()=>{
  const {userNicknames}=load('./order-people'),db=imported().db;
  const done=await mutations.planSingleSheetMutation(db,actor,{contractVersion:2,intent:'prepare-shipping',orderId:'O1'},catalog,secret,{userNicknames:userNicknames(peopleUsers)});
  const stored=store.decodeSheetDatabase(store.encodeSheetDatabase(done.db)).rows[0];
  assert.equal(stored.reqUser,'工班暱稱');assert.equal(stored.adminUser,'管理暱稱');assert.deepEqual(stored.content,db.rows[0].content);
  assert.equal(done.db.events.at(-1).actor,actor.email);assert.equal(db.rows[0].reqUser,'crew@example.test');
  await assert.rejects(mutations.planSingleSheetMutation(db,{...actor,name:''},{contractVersion:2,intent:'prepare-shipping',orderId:'O1'},catalog,secret),/NICKNAME_REQUIRED/);
});

test('legacy nickname display is read-only and notification recipients are unambiguous',()=>{
  const people=load('./order-people'),rows=imported().db.rows,names=people.userNicknames(peopleUsers);
  assert.equal(people.displayOrderPeople(rows,names)[0].reqUser,'工班暱稱');assert.equal(rows[0].reqUser,'crew@example.test');
  const duplicate=[...peopleUsers,['other@example.test','User','Crew','工班暱稱','3']];
  const row={...rows[0],reqUser:'工班暱稱',history:[]};
  assert.equal(people.requesterForNotification(row,peopleUsers).email,'crew@example.test');
  assert.equal(people.requesterForNotification(row,duplicate),undefined);
  row.history=[{eventType:'ORDER_CREATED',actor:'crew@example.test'}];assert.equal(people.requesterForNotification(row,duplicate).email,'crew@example.test');
  row.history=[{eventType:'ORDER_CREATED',actor:'removed@example.test'}];assert.equal(people.requesterForNotification(row,duplicate),undefined);
});

test('orders endpoint returns nickname display only within the authenticated company',async()=>{
  const original=imported().db.rows;
  const queries=loadModules({
    './access':{requireAccount:async()=>({account:{company:'Crew'},users:peopleUsers,sheets:{}}),apiError:error=>{throw error;},AccessError:class extends Error{}},
    './order-sheet':{loadOrderSheet:async()=>({rows:[...original,{...original[0],orderId:'PRIVATE',reqCompany:'Other'}]})},
  })('./single-sheet-queries.server');
  const response=await queries.handleOrdersGet(new Request('http://localhost/api/orders'),'company'),body=await response.json();
  assert.equal(body.data.length,1);assert.equal(body.data[0].reqUser,'工班暱稱');assert.equal(body.data[0].adminUser,'管理暱稱');assert.equal(original[0].reqUser,'crew@example.test');
});

test('admin can reload delegated drafts and other crews without granting that access to users',async()=>{
  const original=imported().db.rows;
  const queries=loadModules({
    './access':{requireAccount:async()=>({account:{company:'Admin',role:'Admin'},users:peopleUsers,sheets:{}}),apiError:error=>{throw error;},AccessError:class extends Error{}},
    './order-sheet':{loadOrderSheet:async()=>({rows:[...original,{...original[0],orderId:'DELEGATED-DRAFT',reqCompany:'Other Crew',status:'編輯中'}]})},
  })('./single-sheet-queries.server');
  const body=await (await queries.handleOrdersGet(new Request('http://localhost/api/orders'),'company')).json();
  assert.equal(body.data.length,2);assert.equal(body.data[1].status,'編輯中');assert.equal(body.data[1].reqCompany,'Other Crew');
});
test('import preserves different per-line historical dates instead of silently changing an old record',()=>{const s=source('已送達');s.push([...s[1]]);s[2][1]=45840;const p=migration.prepareSingleSheetImport(s,'synthetic');assert.notEqual(p.db.rows[0].orderDate,p.db.rows[1].orderDate);assert.deepEqual(p.db.events[0].importSource.rows,s.slice(1));});
test('return requires correct material fingerprint, stays explicit and preserves imported source',async()=>{const db=imported().db,r=db.rows[0],request={contractVersion:2,intent:'create-return',orderId:r.orderId,returnRequest:{contractVersion:2,r2Version:1,intent:'create-return',orderId:r.orderId,expectedActiveReturnRef:'none',scope:'order',reason:'Please check',targets:[{lineRef:r.lineRef,expectedMcf:r.mcf,reason:null}]}};const next=await mutations.planSingleSheetMutation(db,actor,request,catalog,secret);assert.equal(next.db.rows[0].status,'處理中');const decoded=store.decodeSheetDatabase(store.encodeSheetDatabase(next.db));assert.equal(decoded.rows[0].returnInfo.reason,'Please check');assert.equal(decoded.events[0].type,'DATABASE_IMPORTED');const bad=structuredClone(request);bad.returnRequest.targets[0].expectedMcf='mcf:v1:'+'0'.repeat(64);await assert.rejects(mutations.planSingleSheetMutation(db,actor,bad,catalog,secret),/R2_TARGET_CHANGED/);});

async function runtimeFixture(fault){
  const originalEnv={id:process.env.GOOGLE_SHEET_ID,secret:process.env.NEXTAUTH_SECRET};process.env.GOOGLE_SHEET_ID='synthetic-only';process.env.NEXTAUTH_SECRET=secret;
  const p=imported(),tables=structuredClone(p.tables),names=Object.keys(tables);let dispatches=0,owner=true,after=false;
  const catalogRows=[['Item_ID','Item_Name','Unit','Vendor','Min_Qty','Step_Qty'],['M1','Wire','M','伸泰',100,100]];
  const sheet=(title,data)=>({properties:{title,sheetId:names.indexOf(title)+10,gridProperties:{rowCount:1000,columnCount:26}},data:[{startRow:0,startColumn:0,rowData:data.map(r=>({values:r.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v)}}))}))}]});
  const sheets={spreadsheets:{get:async args=>{if(after&&fault==='readback')throw Error('readback unavailable');const selected=args.ranges.map(r=>r.replaceAll("'",''));return {data:{spreadsheetId:'synthetic-only',sheets:selected.map(t=>sheet(t,t==='Materials'?catalogRows:tables[t]))}};}}};
  const runtimeLoad=loadModules({'./google-sheets':{prepareSingleSheetsDispatch:async()=>({dispatch:async wire=>{dispatches++;const payload=JSON.parse(wire);for(const req of payload.requests){if(!req.updateCells)continue;const u=req.updateCells,name=names[u.range.sheetId-10];tables[name]=u.rows.map(r=>r.values.map(c=>c.userEnteredValue?.stringValue??c.userEnteredValue?.numberValue??c.userEnteredValue?.boolValue??'')).filter(r=>r.some(v=>v!==''));}after=true;if(fault==='ack')throw Error('lost acknowledgement');}})},'./order-notifications':{notifyV2Mutation:async()=>true}});
  const execute=runtimeLoad('./order-actions').ordersExecutor('admin-status');
  return {tables,get dispatches(){return dispatches;},set owner(v){owner=v;},async run(){return execute({account:{...actor,name:'Synthetic'},users:[['Email','Role','Company','Nickname'],['admin@example.test','Admin','Admin','管理暱稱'],['crew@example.test','User','Crew','工班暱稱']],sheets,actor,executionRef:'synthetic-sec',untrustedBody:{contractVersion:2,intent:'prepare-shipping',orderId:'O1'},lock:{owner:{key:'synthetic-lock',token:'synthetic'},verifyOwner:async()=>owner}});},restore(){if(originalEnv.id===undefined)delete process.env.GOOGLE_SHEET_ID;else process.env.GOOGLE_SHEET_ID=originalEnv.id;if(originalEnv.secret===undefined)delete process.env.NEXTAUTH_SECRET;else process.env.NEXTAUTH_SECRET=originalEnv.secret;}};
}
test('actual executor verifies one business batch without PostgreSQL or external network',async()=>{const f=await runtimeFixture();try{const r=await f.run();assert.equal(r.result.state,'confirmed');assert.equal(f.dispatches,1);assert.equal(store.decodeSheetDatabase(f.tables).rows[0].status,'準備出貨');assert.equal(r.coordination,'release-owner-only');}finally{f.restore();}});
for(const fault of ['ack','readback'])test('uncertain '+fault+' retains lock and never replays business dispatch',async()=>{const f=await runtimeFixture(fault);try{const r=await f.run();assert(['unknown','acknowledged-unverified'].includes(r.result.state));assert.equal(r.coordination,'retain');assert.equal(f.dispatches,1);assert(store.decodeSheetDatabase(f.tables).events.some(e=>e.receipt?.attemptRef===r.result.attemptRef));}finally{f.restore();}});
test('lost lock ownership prevents dispatch',async()=>{const f=await runtimeFixture();f.owner=false;try{const r=await f.run();assert.equal(r.result.state,'not-applied');assert.equal(f.dispatches,0);}finally{f.restore();}});


test('browser and server share precise minimum and increment rules including decimals',()=>{
 const q=loadModules()('./exact-quantity');
 for(const [value,min,step,ok]of [[150,100,100,false],[200,100,100,true],[0.3,0.1,0.1,true],[0.31,0.1,0.1,false],[0.30000000000000004,0.1,0.1,false],[NaN,1,1,false],[Infinity,1,1,false],[1,2,1,false]])assert.equal(q.validateMaterialQuantity(value,min,step).ok,ok,String(value));
 const p={policyRef:'test',basisRef:'test',scale:6,minTicks:'1',maxTicks:'9007199254740991',stepTicks:'1',stepAnchor:'zero'};
 assert.equal(q.sumExactQuantities([0.1,0.2],p).value,0.3);
});
test('structured API errors render actionable text instead of object coercion',()=>{
 const {apiMessage}=loadModules()('./api-message');
 assert.equal(apiMessage({error:{message:'資料尚未核實'}},'重新載入'),'資料尚未核實');assert.equal(apiMessage({error:{code:'SECRET_INTERNAL'}},'重新載入'),'重新載入');
});
