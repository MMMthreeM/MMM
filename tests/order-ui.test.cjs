/* eslint-disable @typescript-eslint/no-require-imports -- synthetic frontend-only harness */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache=new Map();
function load(name){
  if(name==='react')return require('react');
  if(name.startsWith('@/components/')||['./MaterialConfirmation','./MaterialPicker'].includes(name))return ()=>null;
  const relative=name.startsWith('@/lib/')?'lib/'+name.slice(6):name.startsWith('./')?'lib/'+name.slice(2):name;
  const file=path.resolve(__dirname,'..',relative+(/\.[tc]sx?$/.test(relative)?'':'.ts'));
  if(cache.has(file))return cache.get(file).exports;
  const loaded={exports:{}};cache.set(file,loaded);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(dep=>dep==='react/jsx-runtime'?require(dep):load(dep),loaded,loaded.exports);return loaded.exports;
}
const ui=load('lib/order-form-state'),nav=load('lib/order-navigation'),view=load('lib/order-view'),validation=load('components/OrderMaterialLine.tsx');
const id=n=>`lin_00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const content=(quantity=10)=>({Material_ID:ui.textCell('M1'),Item_Name:ui.textCell('電線'),Original_Item_Name:ui.textCell(''),Quantity:{kind:'number',value:quantity},Unit:ui.textCell('M'),Vendor:ui.textCell('伸泰'),Remarks:ui.textCell('A 棟施工')});
const row=(n=1,status='處理中')=>({orderId:'O1',lineId:id(n),lineRef:{kind:'permanent',orderId:'O1',lineId:id(n)},content:content(),mcf:'mcf:v1:'+'a'.repeat(64),readState:'verified',effectiveReview:'confirmed',orderDate:'2026-11-02 09:30',reqCompany:'合成工班',reqUser:'Synthetic',status,activeReturnRef:'none',materialName:'電線',quantity:10,unit:'M',remarks:'A 棟施工',vendor:'伸泰',draftName:''});
const material={id:'M1',name:'電線',unit:'M',vendor:'伸泰',minQty:10,stepQty:5,requiresRemarks:false};
test('T09 shipping belongs to active and only delivered belongs to archive',()=>{for(const [status,tab]of[['編輯中','draft'],['處理中','active'],['準備出貨','active'],['審核完畢','active'],['已送達','archive']])assert.equal(nav.crewTab(view.groupOrders([row(1,status)])[0]),tab);});
for(const query of ['電線','O1','2026/11/02','20261102','電線 O1'])test('T09 intelligent search preserves complete order: '+query,()=>{const rows=[row(),{...row(2),materialName:'開關'}],g=view.groupOrders(rows)[0];assert(nav.orderMatches(g,query));assert.equal(g.items.length,2);assert.equal(g.items[1].materialName,'開關');});
test('T09 return priority is derived, remaining orders sort by actual date',()=>{const normal=view.groupOrders([row()])[0],returned=view.groupOrders([{...row(),orderId:'O2',activeReturnRef:'event:synthetic'}])[0];assert(nav.crewOrderSort(returned,normal,'priority')<0);assert.equal(nav.crewOrderSort(normal,normal,'desc'),0);});
for(const unsafe of ['https://external.test','//external.test','/api/orders','/dashboard\\evil','/admin\nInjected','javascript:alert(1)'])test('T09 return URL rejects unsafe destination '+JSON.stringify(unsafe),()=>assert.equal(nav.safeReturnTo(unsafe),'/dashboard'));
test('T09 nested detail and list query round-trip retains filters and page',()=>{const back='/dashboard?tab=archive&q=電線&start=2026-01-01&page=3',url=new URL(nav.detailHref('O1',back),'http://localhost');assert.equal(url.searchParams.get('returnTo'),back);assert.equal(nav.safeReturnTo(url.searchParams.get('returnTo')),back);assert.equal(new URL(nav.editHref('O1','edit',url.pathname+url.search),'http://localhost').searchParams.get('action'),'edit');});
test('T09 reorder uses only client keys, preserves quantity and remarks, never mutates source',()=>{const rows=[row(),row(2)],before=structuredClone(rows);let i=0;const state=ui.reorderEditorRows(rows,[material],()=>`new-${++i}`);assert(state.lines.every(l=>l.ref.kind==='new'&&!l.confirmed));assert.deepEqual(state.lines.map(l=>l.content.Quantity.value),[10,10]);assert.equal(ui.contentText(state.lines[0].content,'Remarks'),'A 棟施工');assert.deepEqual(rows,before);assert.notEqual(state.lines[0].ref.clientKey,state.lines[1].ref.clientKey);});
for(const [field,value]of[['name','新電線'],['vendor','益詮']])test('T09 reorder '+field+' difference requires explicit acceptance without changing quantity',()=>{const state=ui.reorderEditorRows([row()],[{...material,[field]:value}],()=> 'new');assert.equal(state.lines[0].comparison.kind,'changed');assert.equal(state.lines[0].comparison.accepted,false);assert.equal(state.lines[0].content.Quantity.value,10);assert.equal(ui.contentText(state.lines[0].comparison.original,'Item_Name'),'電線');});
test('T09 unit change does not carry 10 M as 10 boxes',()=>{const l=ui.reorderEditorRows([row()],[{...material,unit:'盒'}],()=> 'new').lines[0];assert.equal(l.content.Quantity.value,10);assert.equal(ui.contentText(l.content,'Unit'),'M');assert.equal(l.comparison.proposed.Quantity.value,0);assert.equal(ui.contentText(l.comparison.proposed,'Unit'),'盒');assert.equal(l.comparison.kind,'unit-changed');assert.equal(l.comparison.original.Quantity.value,10);assert.equal(ui.contentText(l.comparison.original,'Unit'),'M');});
test('T09 unmatched reorder stays unresolved with original material ID',()=>{const l=ui.reorderEditorRows([row()],[],()=> 'new').lines[0];assert.equal(l.comparison.kind,'unmatched');assert.equal(ui.contentText(l.content,'Material_ID'),'M1');assert(validation.editorLineIssues(l,undefined,true).some(i=>i.field==='source'));});
test('T09 draft allows minimum violation but formal review blocks it',()=>{const l=ui.editableRows([{...row(),content:content(7)}],false,()=> 'unused').lines[0];assert.equal(validation.editorLineIssues(l,material,false).length,0);assert(validation.editorLineIssues(l,material,true).some(i=>i.field==='quantity'));});
for(const quantity of [0,-1,1.5,NaN,Infinity])test('T09 draft rejects invalid integer quantity '+quantity,()=>{const l=ui.editableRows([{...row(),content:content(quantity)}],false,()=> 'unused').lines[0];assert(validation.editorLineIssues(l,material,false).some(i=>i.field==='quantity'));});
test('T09 mandatory remarks and confirmation cannot be bypassed by view filtering',()=>{const l=ui.editableRows([{...row(),content:{...content(),Remarks:ui.textCell('')},effectiveReview:'pending'}],false,()=> 'unused').lines[0];const issues=validation.editorLineIssues(l,{...material,requiresRemarks:true},true);assert(issues.some(i=>i.field==='remarks'));assert(issues.some(i=>i.field==='confirmation'));});
test('T09 HTTP success without receipt cannot clear editor',()=>{for(const body of[{ok:true},{state:'confirmed'},{state:'acknowledged-unverified'},{state:'unknown'}])assert.equal(ui.submissionDisposition(body),'review-required');});
test('T09 reopened draft preserves original content until catalog differences are explicitly accepted',()=>{const r={...row(),originalContent:content(),effectiveReview:'unconfirmed'};const before=structuredClone(r);const l=ui.reorderEditorRows([r],[{...material,name:'現行電線',vendor:'益詮'}],()=> 'unused',false).lines[0];assert.equal(l.ref.kind,'permanent');assert.equal(l.ref.lineId,r.lineId);assert.equal(ui.contentText(l.content,'Item_Name'),'電線');assert.equal(ui.contentText(l.comparison.proposed,'Item_Name'),'現行電線');assert.equal(l.comparison.accepted,false);assert.deepEqual(l.initialContent,r.originalContent);assert.equal(l.confirmed,false);assert.deepEqual(r,before);});

const textOrder=load('lib/text-order'),catalogApi=load('lib/material-catalog'),fixture=require('./order-entry-fixture.cjs');
test('Entry specification: 13 candidates retain specifications, length and targeted delivery note',()=>{
  const parsed=textOrder.parseTextOrder('鶴峻維運材料\n--------------\n'+fixture.text,fixture.catalog);
  assert.equal(parsed.lines.length,13);assert.deepEqual(parsed.lines.slice(0,5).map(l=>l.quantity),[500,500,500,500,500]);assert.equal(parsed.lines[3].name,fixture.names[3].normalize('NFKC'));assert.deepEqual(parsed.noteTargets,[0,1,2,3,4]);assert.equal(parsed.notes,fixture.note);
  assert.deepEqual(parsed.lines.slice(8).map(l=>l.quantity),[50,50,80,50,100]);assert(parsed.lines[8].name.includes('0.1S'));assert(parsed.lines[9].name.includes('120CM'));
  assert.equal(textOrder.exactTextMaterial(parsed.lines[5],fixture.catalog),undefined);assert.equal(parsed.lines[5].name,'LED 40公園燈 75W 白光');
});
test('Entry conversion only uses explicit source length or reliable packaging, never minimum times packages',()=>{
  const p=textOrder.parseTextOrder(fixture.text,fixture.catalog);
  assert.equal(textOrder.suggestedTextQuantity({...fixture.catalog[0],minQty:200},p.lines[0]),'500');
  assert.equal(textOrder.suggestedTextQuantity(fixture.catalog[5],p.lines[5]),'');
  assert.equal(textOrder.textQuantity(fixture.catalog[5],p.lines[5]).issue,'請補每箱數量');
  assert.equal(textOrder.suggestedTextQuantity(fixture.catalog[6],p.lines[6]),'12');assert.equal(textOrder.suggestedTextQuantity(fixture.catalog[7],p.lines[7]),'24');
  assert.equal(textOrder.suggestedTextQuantity({...fixture.catalog[6],unit:'箱'},p.lines[6]),'1');
});
for(const spec of ['2 mm2','1C','75W','2P','15AT','30mA','0.1S','120CM'])test('Entry specification numbers are not quantities: '+spec,()=>assert.equal(textOrder.parseTextOrder('材料 '+spec,[]).lines[0].quantity,null));
test('Entry partial recognition retains unknown lines and never selects ambiguous exact aliases',()=>{
  assert.equal(textOrder.parseTextOrder('無法辨識內容\n電線 5M',[]).lines.length,2);
  const line=textOrder.parseTextOrder('共用別名 2個',[]).lines[0];assert.equal(textOrder.exactTextMaterial(line,fixture.catalog.slice(5,7).map(m=>({...m,aliases:['共用別名']}))),undefined);
});
test('Entry packaging columns are optional, reordered and do not expose price or infer min quantity',()=>{
  const rows=[['Item_Name','Material_ID','Vendor','Unit','Min_Qty','Step_Qty','Price','Units_Per_Pack','Pack_Unit'],['燈泡','B1','伸泰','個',100,1,999,12,'箱'],['燈泡2','B2','伸泰','個',100,1,999,0,'箱']];
  const [a,b]=catalogApi.publicMaterials(rows);assert.equal(a.unitsPerPack,12);assert.equal(a.packUnit,'箱');assert(!('Price'in a));assert.equal(b.unitsPerPack,undefined);
  assert.equal(catalogApi.publicMaterials([rows[0].slice(0,7),rows[1].slice(0,7)])[0].unitsPerPack,undefined);
});
test('Entry confirmation changes only with actual outgoing fields and shared note targets',()=>{
  const base=ui.editableRows([row(),row(2),row(3)],false,()=> 'unused');
  assert.equal(ui.updateEditorLine(base,base.lines[0].uiKey,structuredClone(base.lines[0].content),[]).lines[0].confirmed,true);
  const changed=ui.updateEditorLine(base,base.lines[0].uiKey,{...base.lines[0].content,Remarks:ui.textCell('新備註')},[]);assert.deepEqual(changed.lines.map(l=>l.confirmed),[false,true,true]);
  const withNote={...base,lines:base.lines.map((l,i)=>({...l,deliveryNote:{batch:'b',text:'交貨',applied:i<2},content:{...l.content,Remarks:ui.textCell(i<2?'交貨\n個別':'個別')}}))};
  const updated=ui.setDeliveryNote(withNote,'b','新交貨',new Set(withNote.lines.slice(0,2).map(l=>l.uiKey)));assert.deepEqual(updated.lines.map(l=>l.confirmed),[false,false,true]);assert.equal(ui.ownRemarks(updated.lines[0]),'個別');assert.equal(ui.contentText(updated.lines[0].content,'Remarks'),'新交貨\n個別');
  const cs=ui.editorChangeSet(updated,[]);assert(cs.added.every(l=>!('deliveryNote'in l.content))); // metadata is never a business field
});
test('Entry unresolved source blocks formal confirmation but permits a basic draft',()=>{
  const l={...ui.editableRows([row()],false,()=> 'unused').lines[0],textSource:{batch:'b',resolved:false,quantityIssue:'',parsed:{source:'40公園燈 1箱',name:'40公園燈',quantity:1,unit:'箱',calculation:'',candidates:[]}}};assert(validation.editorLineIssues(l,material,true).some(i=>i.field==='source'));assert.equal(validation.editorLineIssues(l,material,false).length,0);
});

test('Entry decimal packaging conversion preserves values without silently rounding policy precision',()=>{assert.equal(textOrder.multiplyTextQuantity(0.1,3),0.3);assert.equal(textOrder.multiplyTextQuantity(1.25,12),15);assert.equal(textOrder.multiplyTextQuantity(1e-7,2),2e-7);assert.equal(textOrder.suggestedTextQuantity({...fixture.catalog[6],unitsPerPack:0.1234567},{quantity:1,unit:'箱'}),'0.1234567');assert.equal(textOrder.parseTextOrder('1.\n2、\n--------',[]).lines.length,0);});

// Crew now confirms the complete order with the final submit action; admin still checks each row.
test('Two-step crew validation omits only checkbox requirements, retaining quantity, source and remarks rules',()=>{
 const line={...ui.editableRows([row()],false,()=> 'unused').lines[0],confirmed:false};
 assert(!validation.editorLineIssues(line,material,true,false).some(i=>i.field==='confirmation'));
 assert(validation.editorLineIssues(line,material,true).some(i=>i.field==='confirmation'));
 const invalid={...line,content:{...line.content,Quantity:{kind:'number',value:7}}};
 assert(validation.editorLineIssues(invalid,material,true,false).some(i=>i.field==='quantity'));
 const missing={...line,content:{...line.content,Vendor:ui.textCell(''),Remarks:ui.textCell('')}};
 assert(validation.editorLineIssues(missing,{...material,requiresRemarks:true},true,false).some(i=>i.field==='source'));
 assert(validation.editorLineIssues(missing,{...material,requiresRemarks:true},true,false).some(i=>i.field==='remarks'));
});
