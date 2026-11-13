/* eslint-disable @typescript-eslint/no-require-imports -- local browser + synthetic external ports */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.PLAYWRIGHT_MODULE_DIR,path.resolve('.tools/artifact/node_modules'),process.cwd()].filter(Boolean)}));
const artifacts=process.env.UI_ARTIFACT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'mmm-v2-ui-'));
fs.mkdirSync(artifacts,{recursive:true});
const base=process.env.UI_BASE_URL||'http://127.0.0.1:3107';
const parsed=new URL(base);assert(['127.0.0.1','localhost'].includes(parsed.hostname),'Local mock UI only');
let dev,browser,page,devOutput='';



async function startDev(){
  if(process.env.UI_START_DEV==='0')return;
  // Temporary preload is outside the repository. All child workers inherit the
  // same no-dotenv / loopback-only network fence; no formal credentials are read.
  const preload=path.join(artifacts,'local-only-preload.cjs');
  fs.writeFileSync(preload,`const env=require(${JSON.stringify(require.resolve('@next/env'))});env.loadEnvConfig=()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]});
const fs=require('node:fs'),p=require('node:path'),protectedPath=p.resolve(process.cwd(),'AGENTS.md');const originalWrite=fs.writeFile,originalSync=fs.writeFileSync,originalPromise=fs.promises.writeFile;const protectedFile=x=>typeof x==='string'&&p.resolve(x)===protectedPath;fs.writeFile=function(file,...args){if(protectedFile(file)){const cb=args.at(-1);if(typeof cb==='function')queueMicrotask(()=>cb(null));return;}return originalWrite.call(this,file,...args);};fs.writeFileSync=function(file,...args){if(!protectedFile(file))return originalSync.call(this,file,...args);};fs.promises.writeFile=async function(file,...args){if(!protectedFile(file))return originalPromise.call(this,file,...args);};
const net=require('node:net'),connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){let a=args[0];if(Array.isArray(a))a=a[0];const host=typeof a==='object'?a.host:typeof args[1]==='string'?args[1]:'localhost';const pipe=typeof a==='string'&&!/^\\d+$/.test(a)||a&&typeof a==='object'&&a.path;if(!pipe&&!['localhost','127.0.0.1','::1','[::1]'].includes(host||'localhost'))throw Error('Synthetic UI prohibits external network');return connect.apply(this,args);};
const fetch=globalThis.fetch;globalThis.fetch=(url,...args)=>{const target=new URL(typeof url==='string'?url:url.url||url.toString());if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname))return Promise.reject(Error('Synthetic UI prohibits external fetch'));return fetch(url,...args);};
`);
  const env={};for(const key of ['PATH','Path','SYSTEMROOT','SystemRoot','COMSPEC','ComSpec','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','PATHEXT','PROCESSOR_ARCHITECTURE'])if(process.env[key])env[key]=process.env[key];
  Object.assign(env,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:`--require "${preload.replaceAll('\\','/')}"`,NEXTAUTH_URL:base,NEXTAUTH_SECRET:'synthetic-local-browser-secret-no-real-account'});
  dev=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',parsed.port],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  dev.stdout.on('data',b=>{devOutput+=b;});dev.stderr.on('data',b=>{devOutput+=b;});
  for(let i=0;i<150;i++){if(dev.exitCode!==null)throw Error('Local server stopped: '+devOutput.slice(-3000));try{const r=await fetch(base);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,400));}
  throw Error('Local server not ready: '+devOutput.slice(-3000));
}
(async()=>{
 let role='User'; const adminWrites=[],createdRequests=[]; const evidence=[];const errors=[];
 const names=['XLPE耐燃電纜 600V 3.5mm²×3C（黑色，戶外照明設備及管線更新工程使用）','LED路燈電源供應器 150W／全電壓 AC100–240V 防水 IP67（含原廠接頭及固定螺絲）','PVC硬質塑膠電線管 3/4吋（厚管，現場須與既有接頭規格確認）'];
 const catalog=names.map((name,i)=>({id:'M'+(i+1),name,displayName:name,unit:i===0?'公尺':'個',vendor:i===1?'益詮':'伸泰',minQty:1,stepQty:1,requiresRemarks:i===1,tags:[],aliases:[],category:i===0?'電線電纜':'照明設備',subcategory:'工程常用材料'}));
 const t=value=>({kind:'string',value});
 const makeRow=(i,orderId,status='處理中')=>{const material=catalog[i%catalog.length],lineId='lin_'+require('node:crypto').randomUUID(),content={Material_ID:t(material.id),Item_Name:t(material.name),Original_Item_Name:t(''),Quantity:{kind:'number',value:23+i},Unit:t(material.unit),Vendor:t(material.vendor),Remarks:t(i===1?'高雄市維運區域：請先聯絡現場工班，交貨前確認包裝與施工位置。\n材料必須與原有接頭相容。':'')};return {lineId,orderId,orderDate:'2026-11-10 14:35:20',reqUser:'王工程',reqCompany:'高雄維運工程工班',reqRegion:'高雄',materialName:material.name,quantity:23+i,unit:material.unit,remarks:content.Remarks.value,vendor:material.vendor,status,adminNote:'',returnNote:'',draftName:status==='編輯中'?'路燈維運備料草稿':'',adminUser:'',expectedDate:'',catalogId:material.id,originalMaterialName:'',lineRef:{kind:'permanent',orderId,lineId},content,originalContent:content,mcf:'mcf:syn-'+i,activeReturnRef:'none',history:[],readState:'verified'};};
 let rows=[...Array.from({length:8},(_,i)=>makeRow(i,'UIUX-20261110-001')),...Array.from({length:3},(_,i)=>makeRow(i,'UIUX-20261109-002','編輯中')),...Array.from({length:3},(_,i)=>makeRow(i,'UIUX-20261108-003','已送達'))];
 const checkPairing=async()=>{
   const issues=await page.evaluate(()=>{
     const failures=[];
     for(const line of document.querySelectorAll('.analytics-order-materials > li,.request-material-main,.crew-review-material,.paired-material')){
       if(!line.checkVisibility())continue;
       const label=line.querySelector('.order-list-material-name,.request-material-name,strong'),quantity=line.querySelector('.analytics-material-quantity,.request-material-quantity')||line.querySelector(':scope > span');
       if(!label||!quantity)continue;
       const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);let node,last;while((node=walker.nextNode()))if(node.textContent.trim())last=node;
       if(!last)continue;const range=document.createRange();range.setStart(last,Math.max(0,last.length-1));range.setEnd(last,last.length);
       const end=range.getBoundingClientRect(),q=quantity.getBoundingClientRect(),r=line.getBoundingClientRect();
       if(Math.abs(q.top-end.top)<8){if(q.left-end.right>20)failures.push('Name and quantity separated');}
       else if(q.left-r.left>24)failures.push('Wrapped quantity lost its row');
     }
     for(const row of document.querySelectorAll('.order-list-table > tbody > tr:not(.order-list-detail-row)')){
       if(innerWidth<1100||getComputedStyle(row).display==='grid')continue;
       const targets=['.order-date','.order-list-company','.order-list-material-name,.order-list-preview > .order-list-more','.status','.order-list-actions .data-link'].map(sel=>row.querySelector(sel)).filter(Boolean);
       const tops=targets.map(e=>{const range=document.createRange();range.selectNodeContents(e);return range.getClientRects()[0]?.top;}).filter(Number.isFinite);
       if(Math.max(...tops)-Math.min(...tops)>4)failures.push('Desktop first lines misaligned '+JSON.stringify(tops));
     }
     for(const row of document.querySelectorAll('.statistics-table tbody tr')){
       if(innerWidth<1100)continue;
       const tops=[...row.children].map(cell=>{const range=document.createRange();range.selectNodeContents(cell.querySelector('button')||cell);return range.getClientRects()[0]?.top;}).filter(Number.isFinite);
       if(Math.max(...tops)-Math.min(...tops)>4)failures.push('Statistics row alignment '+JSON.stringify(tops));
     }
     return failures;
   });assert.deepEqual(issues,[],'Material pairing and desktop row alignment');
 };
 const shot=async(name)=>{await checkPairing();assert(await page.locator('.order-list-table-wrap').evaluateAll(items=>items.every(item=>item.scrollWidth<=item.clientWidth+1)),'Order tables fit their pane: '+name);assert(await page.locator('.order-list-table .analytics-order-materials > li').evaluateAll(items=>items.every(item=>item.scrollWidth<=item.clientWidth+1)),'Complete material lines fit their column: '+name);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(artifacts,name+'.png'),fullPage:!name.startsWith('hundred-lines')});const geometry=await page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {tag:e.tagName,cls:e.className,text:(e.innerText||'').slice(0,75),x:r.x,y:r.y,w:r.width,h:r.height,display:c.display,grid:c.gridTemplateColumns,position:c.position,overflow:c.overflow};};return {viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,boxes:[...document.querySelectorAll('.v2-material-line,.material-line-heading,.material-line-tools,.material-confirmation,.v2-submit-actions,.order-group-heading,.order-item,.order-card,.order-detail,.notice-banner-inner,.home-create,.bulk-bar,.order-editor,dialog[open],.search-select-popup')].filter(e=>e.getBoundingClientRect().height).map(box),overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return e.checkVisibility()&&r.width&&r.height&&(r.right>innerWidth+1||r.x<-1)&&getComputedStyle(e).position!=='fixed';}).slice(0,30).map(box)};});evidence.push({name,url:page.url(),...geometry});console.log('CAPTURE '+name);};
 const goto=async(url)=>{await page.goto(base+url);await page.locator('.page-title').waitFor();await page.locator('.loading-state').first().waitFor({state:'hidden'});await page.waitForTimeout(500);};
 try {
  await startDev();browser=await chromium.launch({headless:true,channel:'msedge'});
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==parsed.origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();const json=body=>route.fulfill({status:200,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(url.pathname==='/api/auth/session')return json({user:{name:'王工程',email:'uiux@example.test'},expires:'2099-01-01T00:00:00Z'});if(url.pathname==='/api/me')return json({account:{email:'uiux@example.test',name:'王工程',company:'高雄維運工程工班',region:'高雄',role,crews:[{company:'高雄維運工程工班',region:'高雄'},{company:'北區工班',region:'台北'}]}});if(url.pathname==='/api/notices')return json({data:['系統測試中！請確認材料名稱、數量與交貨備註，若有異常請透過問題回報聯絡管理員。']});if(url.pathname==='/api/materials')return json({data:catalog});if(['/api/orders','/api/admin/orders'].includes(url.pathname)&&req.method()==='GET')return json({contractVersion:2,data:rows});if(url.pathname==='/api/orders/confirmation')return json({confirmations:[]});if(url.pathname==='/api/admin/edit-order'&&req.method()==='PATCH'){const body=req.postDataJSON();adminWrites.push(body);rows=rows.map(row=>{const change=body.changeSet?.changed.find(c=>c.lineRef.lineId===row.lineId);if(row.orderId!==body.orderId||!change)return row;const c=change.after;return {...row,content:c,quantity:c.Quantity.value,materialName:c.Item_Name.value,catalogId:c.Material_ID.value,vendor:c.Vendor.value,unit:c.Unit.value,remarks:c.Remarks.value,effectiveReview:'confirmed'};});return json({state:'confirmed',attemptRef:'attempt_mock',orderId:body.orderId,mapping:[],warnings:[]});}if(url.pathname==='/api/orders'&&req.method()==='POST'){const body=req.postDataJSON();createdRequests.push(body);if(body.company){const c=body.changeSet.added[0].content;rows=[{...makeRow(0,'ADMIN-DELEGATED'),reqCompany:body.company,reqRegion:'台北',content:c,quantity:c.Quantity.value,materialName:c.Item_Name.value,catalogId:c.Material_ID.value,vendor:c.Vendor.value,unit:c.Unit.value,remarks:c.Remarks.value}];return json({state:'confirmed',attemptRef:'attempt_mock',orderId:'ADMIN-DELEGATED',mapping:[],warnings:[]});}return json({state:'confirmed',attemptRef:'attempt_mock',orderId:'UIUX-20261110-001',mapping:[],warnings:[]});}return route.fulfill({status:503,body:JSON.stringify({error:'Read-only synthetic review; mutations disabled'})});});
  page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());


  const checkFilterIcon=async()=>{
    const input=page.locator('.search-filter-field input').first(),toggle=page.getByRole('button',{name:'進階篩選',exact:true});
    const field=await input.boundingBox(),icon=await toggle.boundingBox();
    assert(icon.x>=field.x&&icon.x+icon.width<=field.x+field.width+1&&icon.y>=field.y&&icon.y+icon.height<=field.y+field.height+1,'Filter icon is inside the input at its right edge');
    assert(field.x+field.width-icon.x-icon.width<=4,'Filter is at the far right');
    await toggle.click();await page.getByRole('region',{name:'進階篩選條件',exact:true}).waitFor();
    await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert(await toggle.evaluate(e=>e===document.activeElement),'Escape restores trigger focus');
  };
  const initialReadingRows=rows;role='Admin';rows=Array.from({length:3},(_,i)=>makeRow(i,'ALIGN-'+i));
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});await goto('/');assert.equal(await page.locator('.pending-order').count(),3);assert.equal(await page.locator('.pending-order .request-summary .status').count(),0);const rights=await page.locator('.pending-order-actions > .status,.pending-order-actions > .card-open').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().right)));assert.equal(new Set(rights).size,1,'Pending status and actions share a right edge');await shot('pending-alignment-'+width);}rows=initialReadingRows;
  const longArchive=rows.find(r=>r.orderId==='UIUX-20261108-003');longArchive.remarks='歷史匯入｜來源報價單.pdf｜'+('材料規格與交貨備註確認').repeat(18)+' https://example.test/'+('long-path-').repeat(12);longArchive.content.Remarks=t(longArchive.remarks);
  // Shared reading surfaces: verify both roles, complete materials and narrow screens.
  for (const readingRole of (process.env.UI_ROLE?[process.env.UI_ROLE]:['User','Admin'])) {
    role=readingRole;
    for (const width of (process.env.UI_WIDTH?[Number(process.env.UI_WIDTH)]:[1920,1440,768,390,320])) {
      await page.setViewportSize({width,height:900});
      await goto('/');assert.equal(await page.locator('.work-queue').count(),1);if(width<=390){const titleBox=await page.locator('h1').boundingBox(),createBox=await page.locator('main > .page-heading').getByRole('link',{name:role==='User'?'建立需求':'前往案件管理',exact:true}).boundingBox();assert(Math.abs(titleBox.y-createBox.y)<28,'Mobile page heading keeps its action on the same row');}await shot('reading-home-'+role+'-'+width);
      if(role==='User') {
        await goto('/dashboard?tab=archive');assert.equal(await page.locator('h1').innerText(),'歷史需求明細');assert.equal(await page.locator('.history-tabs .btn').count(),0);await checkFilterIcon();assert.equal(await page.locator('.order-card').count(),1);assert.equal(await page.locator('.order-card .analytics-order-materials > li').count(),2);await shot('reading-history-'+width);if(width===1440){await goto('/dashboard?tab=archive&order=UIUX-20261108-003');await page.locator('.orders-workspace.has-detail').waitFor();assert.equal(await page.locator('.order-card.is-selected').evaluate(e=>getComputedStyle(e).outlineStyle),'none');assert.equal(await page.locator('.order-list-material-name').first().evaluate(e=>getComputedStyle(e).whiteSpace),'normal');await shot('history-split-long-materials');}
        await goto('/dashboard/detail?order=UIUX-20261110-001&returnTo=%2Fdashboard');
        assert.equal(await page.locator('.request-materials > li').count(),8);assert.equal(await page.locator('.order-other-facts').count(),0);
        assert(!(await page.locator('.request-materials').innerText()).includes('伸泰'));
        const order=await page.locator('.detail-content').evaluate(e=>[...e.children].map(x=>x.className));
        assert(order.indexOf('request-progress')<order.indexOf('request-section'));assert.equal(await page.locator('.detail-page a').filter({hasText:'返回列表'}).count(),1);assert.equal(await page.locator('.request-materials').getByText('需求數量',{exact:true}).count(),0);
        assert.equal(new Set(await page.locator('.request-progress-stages > li').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().top)))).size,1,'Progress stages stay on one horizontal row');await shot('reading-detail-'+width);
      } else {
        await goto('/admin?order=UIUX-20261110-001');await checkFilterIcon();assert.equal(await page.locator('.review-tools').count(),0);assert.equal(await page.locator('.admin-order-list .analytics-order-materials > li').count(),0);
        assert.equal(await page.locator('.admin-case-details[open] .request-materials > li').count(),8);assert.equal(await page.locator('.admin-case-details .order-identity,.admin-case-details .order-other-facts').count(),0);
        assert((await page.locator('.admin-case-details[open] .request-material-admin').first().innerText()).includes('伸泰'));
        if(width===1440){await page.getByRole('button',{name:'收合單據',exact:true}).click();assert.equal(await page.locator('.admin-case-details[open]').count(),0);await shot('reading-review-collapsed-1440');await page.getByRole('button',{name:'查看單據',exact:true}).click();assert.equal(await page.locator('.admin-case-details[open]').count(),1);await page.getByRole('checkbox',{name:'全選本次範圍',exact:true}).check();await page.getByRole('button',{name:'匯出勾選單據',exact:true}).first().click();await page.getByRole('heading',{name:'確認匯出報表',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('checkbox',{name:'全選本次範圍',exact:true}).uncheck();}await shot('reading-review-'+width);
      }
      await goto('/analytics');assert.equal(await page.locator('h1').innerText(),'用料分析');await checkFilterIcon();if(width>=1440){await page.getByRole('button',{name:'材料總覽',exact:true}).click();await shot('statistics-'+role+'-'+width);await page.locator('#material-statistics .data-link').first().click();await page.locator('.trend-orders').waitFor();await shot('monthly-material-'+role+'-'+width);if(role==='Admin'){await page.getByRole('button',{name:'工班明細',exact:true}).click();await shot('company-statistics-'+width);}}await page.getByRole('button',{name:'期間訂單明細',exact:true}).click();
      assert.equal(await page.locator('[data-analytics-order]').count(),2);
      assert.equal(await page.locator('[data-analytics-order]').first().locator('.analytics-order-materials > li').count(),2);
      assert.equal(await page.locator('.analytics-material-details').count(),0);
      await shot('reading-analytics-'+role+'-'+width);
    }
  }
  role='Admin';await page.setViewportSize({width:1440,height:900});await goto('/admin');assert.equal(await page.locator('.date-range-chip').count(),1);const rangeBox=await page.locator('.date-range-chip').boundingBox(),bulkBox=await page.locator('.bulk-bar').boundingBox();assert(bulkBox.y-rangeBox.y-rangeBox.height>=12,'Date range and bulk actions have separate spacing');assert.equal(await page.locator('.selection-actions').count(),0);await page.getByRole('checkbox',{name:'全選本次範圍',exact:true}).check();assert((await page.locator('.selection-reason').innerText()).includes('階段不同'));await page.getByRole('button',{name:'更多操作',exact:true}).click();await page.getByRole('button',{name:'賀冠詢價',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('checkbox',{name:'全選本次範圍',exact:true}).uncheck();await shot('admin-filters-spacing-1440');await page.getByRole('button',{name:/^移除日期區間/}).click();assert.equal(await page.locator('.date-range-chip').count(),0);
  const previewRows=structuredClone(rows);
  for(const width of [1440,390,320]) {
    role='User';rows=Array.from({length:8},(_,i)=>makeRow(i,'PREVIEW-ORDER'));rows[7].materialName='最後一筆獨特材料';rows[7].content.Item_Name=t(rows[7].materialName);
    await page.setViewportSize({width,height:900});await goto('/dashboard?q='+encodeURIComponent('獨特材料'));
    assert.equal(await page.locator('.order-list-table').count(),1);
    assert((await page.locator('.order-list-material-name').first().innerText()).includes('獨特材料'));
    assert.equal(await page.locator('.order-list-more').innerText(),'另 6 筆');
    await page.locator('.order-card-link').click();await page.locator('.order-detail').waitFor();
    assert.equal(await page.locator('.request-materials > li').count(),8);assert.equal(await page.locator('.order-other-facts').count(),0);
    assert((await page.locator('.request-materials').innerText()).includes('交貨前確認包裝'));
    await shot('preview-search-detail-'+width);
    role='Admin';await goto('/admin?order=PREVIEW-ORDER');await page.getByRole('checkbox',{name:'全選本次範圍',exact:true}).check();
    assert(await page.getByRole('button',{name:'完成審核',exact:true}).isDisabled());
    assert((await page.locator('.selection-reason').innerText()).includes('材料與廠商核對'));
    await shot('selection-unconfirmed-'+width);
    rows=rows.map(r=>({...r,effectiveReview:'confirmed'}));await goto('/admin?order=PREVIEW-ORDER');await page.getByRole('checkbox',{name:'全選本次範圍',exact:true}).check();
    assert(await page.getByRole('button',{name:'完成審核',exact:true}).isEnabled());
    await page.getByRole('button',{name:'更多操作',exact:true}).click();await page.getByRole('button',{name:'退回修改',exact:true}).waitFor();const popover=await page.locator('#review-more-actions').boundingBox();assert(popover.x>=0&&popover.x+popover.width<=width,'More actions stay within the viewport');assert(popover.y>=0&&popover.y+popover.height<=900,'More actions remain visible');await shot('selection-more-'+width);await page.keyboard.press('Escape');
    for(const [status,label] of [['審核完畢','設為準備出貨'],['準備出貨','標記已送達']]) {
      rows=rows.map(r=>({...r,status}));await goto('/admin?order=PREVIEW-ORDER');await page.getByRole('checkbox',{name:'全選本次範圍',exact:true}).check();assert(await page.getByRole('button',{name:label,exact:true}).isEnabled());
    }
  }
  rows=previewRows;role='Admin';
  const savedAdminRows=structuredClone(rows),savedMinimum=catalog[0].minQty,savedStep=catalog[0].stepQty;
  role='Admin';catalog[0].minQty=100;catalog[0].stepQty=100;
  for(const status of ['審核完畢','準備出貨','已送達']) {
    rows=[{...makeRow(0,'ADMIN-LATE-EDIT',status),quantity:100}];rows[0].content.Quantity={kind:'number',value:100};
    await page.setViewportSize({width:390,height:900});await goto('/admin?order=ADMIN-LATE-EDIT');
    await page.getByRole('button',{name:'編輯需求單 ADMIN-LATE-EDIT',exact:true}).click();
    const editor=page.locator('.order-editor[open]');await editor.waitFor();
    const picker=editor.locator('.admin-material-picker').first();await picker.getByRole('combobox',{name:'材料分類',exact:true}).selectOption('電線電纜');
    await picker.getByRole('combobox',{name:'搜尋並選擇材料',exact:true}).fill('XLPE');await picker.getByRole('listbox').getByRole('option').first().click();
    const quantity=editor.getByRole('spinbutton',{name:'第 1 筆數量',exact:true});await quantity.fill('150');await quantity.press('Tab');
    assert((await editor.locator('.line-issues').innerText()).includes('倍數'));
    await quantity.fill('200');await quantity.press('Tab');await editor.locator('.material-confirmation input').check();
    await shot('admin-edit-stage-'+status);await editor.getByRole('button',{name:'下一步：確認需求',exact:true}).click();
    await editor.getByRole('button',{name:'確認儲存修改',exact:true}).click();await editor.waitFor({state:'hidden'});
    assert.equal(rows[0].status,status);assert.equal(rows[0].quantity,200);assert.equal(adminWrites.at(-1).intent,'amend-order');
  }
  rows=savedAdminRows;
  await goto('/request');await page.getByRole('combobox',{name:'代下單工班',exact:true}).selectOption('北區工班');
  await page.getByRole('combobox',{name:'搜尋並選擇材料',exact:true}).fill('XLPE');await page.getByRole('listbox').getByRole('option').first().click();
  await page.getByRole('button',{name:'加入待送出清單',exact:true}).click();await page.getByRole('button',{name:'下一步：確認清單（1）',exact:true}).click();
  assert((await page.locator('.crew-final-review').innerText()).includes('北區工班'));await shot('admin-delegated-order-390');
  await page.getByRole('button',{name:'確認送出',exact:true}).click();await page.locator('.request-complete').waitFor();
  assert.equal(createdRequests.at(-1).company,'北區工班');await page.getByRole('link',{name:'查看需求',exact:true}).click();await page.waitForURL(url=>url.pathname==='/dashboard/detail');await page.locator('.order-detail').waitFor();
  catalog[0].minQty=savedMinimum;catalog[0].stepQty=savedStep;rows=savedAdminRows;
  role='User';
  const originalRows=structuredClone(rows);
  await page.setViewportSize({width:390,height:900});
  for(const status of ['處理中','審核完畢','準備出貨','已送達']) {
    rows=originalRows.filter(r=>r.orderId==='UIUX-20261110-001').map(r=>({...r,status}));
    await goto('/dashboard/detail?order=UIUX-20261110-001&returnTo=%2Fdashboard');
    assert.deepEqual(await page.locator('.request-progress-stages strong').allTextContents(),['待審核','審核完畢','準備出貨','已送達']);
    assert.equal(await page.locator('.request-progress-stages [aria-current=step] strong').innerText(),status==='處理中'?'待審核':status);
  }
  rows=originalRows;
  await goto('/dashboard');await page.getByRole('button',{name:'進階篩選',exact:true}).click();
  await page.getByLabel('開始日期',{exact:true}).fill('2026-01-01');assert.equal(new URL(page.url()).searchParams.get('start'),'2026-01-01');
  await page.getByRole('button',{name:'進階篩選',exact:true}).click();assert.equal(await page.locator('.filter-active-dot').count(),1);
  await goto('/');const notice=page.getByRole('complementary',{name:'系統公告',exact:true});
  await notice.waitFor();assert((await notice.innerText()).includes('交貨備註'));assert.equal(await notice.locator('.notice-preview').count(),0);
  await page.getByRole('button',{name:'關閉公告',exact:true}).click();await goto('/analytics');assert.equal(await page.locator('.notice-banner').count(),0);
  await page.locator('.system-tools > summary').click();await page.getByRole('button',{name:'查看系統公告',exact:true}).click();await notice.waitFor();await page.getByRole('button',{name:'關閉公告',exact:true}).click();

  if(process.env.UI_READING_ONLY!=='1') {
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});await goto('/request?loadOrderId=UIUX-20261110-001&action=edit');await page.locator('.crew-final-review').waitFor();await shot('crew-editor-'+width);await page.locator('.crew-final-review li').first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(artifacts,'crew-editor-viewport-'+width+'.png')});}
  await page.setViewportSize({width:390,height:844});await goto('/request');await page.getByRole('button',{name:'搜尋選料',exact:true}).click();await page.getByRole('combobox',{name:'搜尋並選擇材料'}).fill('XLPE');await page.getByRole('listbox').getByRole('option').filter({hasText:'XLPE'}).first().click();assert.equal(await page.locator('.material-vendor:visible').count(),0);assert(!(await page.locator('.crew-input-panel').innerText()).includes('伸泰'));await shot('new-request-one-390');await page.locator('.crew-entry-actions').scrollIntoViewIfNeeded();await shot('new-request-one-actions-390');
  role='Admin';for(const width of [1440,390]){await page.setViewportSize({width,height:900});await goto('/admin');await shot('admin-review-'+width);await page.getByRole('button',{name:'編輯需求單 UIUX-20261110-001',exact:true}).click();await page.locator('.order-editor[open]').waitFor();if(width===1440){const qtyBox=await page.locator('.order-editor .material-line-quantity input').first().boundingBox();assert(qtyBox.width>=140,'Desktop quantity input fits long integers');}assert(await page.locator('input[type=number]').evaluateAll(es=>es.every(e=>getComputedStyle(e).appearance==='textfield')),'Only explicit plus and minus controls are visible');await shot('admin-editor-'+width);await page.keyboard.press('Escape');}
  role='User';await page.setViewportSize({width:390,height:844});await goto('/request');
  await page.getByRole('button',{name:'找不到材料？改用自填材料',exact:true}).click();
  assert.equal(await page.locator('.material-vendor:visible').count(),0);
  await page.getByRole('textbox',{name:'第 1 筆名稱',exact:true}).fill('現場自填配件');
  await page.getByRole('button',{name:'加入待送出清單',exact:true}).click();
  assert.equal(await page.locator('.crew-cart li').count(),1);
  await shot('crew-custom-no-vendor-390');await goto('/request');

  await page.getByRole('button',{name:'貼上叫料文字',exact:true}).click();await page.getByRole('textbox',{name:'叫料文字',exact:true}).fill('維運材料測試 3 個');await page.getByRole('button',{name:'分析叫料文字',exact:true}).click();await page.getByRole('button',{name:'找不到材料？自行填寫',exact:true}).click();await page.getByRole('textbox',{name:'第 1 筆名稱',exact:true}).fill('維運材料測試');await page.getByRole('textbox',{name:'第 1 筆單位',exact:true}).fill('個');assert.equal(await page.locator('.material-vendor:visible').count(),0);assert(!(await page.locator('.crew-text-import').innerText()).includes('伸泰'));assert.equal(await page.locator('.material-confirmation:visible').count(),0);const textQuantityInput=page.getByRole('spinbutton',{name:'第 1 筆數量',exact:true});assert.equal(await textQuantityInput.getAttribute('inputmode'),'numeric');assert.equal(await textQuantityInput.getAttribute('step'),'1');await page.getByRole('button',{name:'增加數量',exact:true}).click();assert.equal(await textQuantityInput.inputValue(),'4');await page.getByRole('button',{name:'減少數量',exact:true}).click();assert.equal(await textQuantityInput.inputValue(),'3');await textQuantityInput.fill('3.5');assert.equal(await textQuantityInput.inputValue(),'');await textQuantityInput.fill('3');await shot('text-import-stepper-390');await page.getByRole('button',{name:'加入待送出清單（1 筆）',exact:true}).click();await page.getByRole('button',{name:'下一步：確認清單（1）',exact:true}).click();await shot('text-import-single-final-390');assert.equal(await page.locator('.crew-final-review li').count(),1);assert.equal(await page.locator('.crew-final-review input[type=checkbox]').count(),0);assert(!(await page.locator('.crew-final-review').innerText()).includes('伸泰'));
  catalog[0].minQty=100;catalog[0].stepQty=100;await goto('/request');await page.getByRole('combobox',{name:'搜尋並選擇材料'}).fill('XLPE');await page.getByRole('listbox').getByRole('option').filter({hasText:'XLPE'}).first().click();await page.getByRole('spinbutton',{name:'第 1 筆數量',exact:true}).fill('150');await page.getByRole('button',{name:'加入待送出清單',exact:true}).click();assert.equal(await page.locator('.crew-cart li').count(),0);assert((await page.getByRole('alert').allTextContents()).some(s=>s.includes('倍數')));await shot('step-quantity-150-of-100-blocked');
  catalog[0].minQty=1;catalog[0].stepQty=1;rows=rows.slice(0,1);await page.setViewportSize({width:1440,height:900});await goto('/dashboard?q=XLPE');await page.locator('.order-card-link').first().click();await page.getByRole('link',{name:'修改需求',exact:true}).click();await page.getByRole('button',{name:'修改第 1 筆材料',exact:true}).click();await page.getByRole('spinbutton',{name:'第 1 筆數量',exact:true}).fill('151');await page.getByRole('button',{name:'儲存材料修改',exact:true}).click();await page.getByRole('button',{name:'確認送出',exact:true}).click();await page.waitForURL(url=>url.pathname==='/dashboard'&&url.searchParams.has('order'));await shot('amend-result-1440');assert((await page.locator('.feedback-success').allTextContents()).includes('需求已確認更新。'));
  rows=Array.from({length:100},(_,i)=>makeRow(i,'UIUX-100-LINES'));rows[99].remarks='清單最後驗證材料';rows[99].content.Remarks=t('清單最後驗證材料');
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});await goto('/request?loadOrderId=UIUX-100-LINES&action=edit');assert.equal(await page.locator('.crew-final-review li').count(),100);await shot('hundred-lines-'+width);await page.getByRole('button',{name:'修改第 100 筆材料',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'第 1 筆數量',exact:true}).inputValue(),'122');await page.getByRole('button',{name:'取消修改',exact:true}).click();assert.equal(await page.locator('.crew-final-review li').count(),100);}
  }
  assert.equal(errors.length,0,'No client exceptions');for(const e of evidence)if(e.viewport)assert.equal(e.pageWidth,e.viewport.width,'No horizontal overflow: '+e.name);
  fs.writeFileSync(path.join(artifacts,'geometry.json'),JSON.stringify({evidence,errors,network:'synthetic loopback only; no external business writes; final amendment receipt explicitly mocked'},null,2));
 }catch(e){if(page)await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(artifacts,'failure.txt'),String(e.stack)+'\n'+devOutput.slice(-5000));fs.writeFileSync(path.join(artifacts,'geometry.json'),JSON.stringify({evidence,errors},null,2));console.error(e);process.exitCode=1;}
 finally{if(browser)await browser.close();if(dev?.exitCode===null)spawnSync('taskkill',['/pid',String(dev.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync(path.join(artifacts,'server-log.txt'),devOutput);}
})();
