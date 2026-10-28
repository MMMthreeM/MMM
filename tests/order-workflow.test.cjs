/* eslint-disable @typescript-eslint/no-require-imports -- This Node test harness loads compiled CommonJS modules. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ExcelJS = require('exceljs');

const headers = ['Order_ID', 'Order_Date', 'Req_User', 'Req_Company', 'Req_Region', 'Item_Name', 'Quantity', 'Unit', 'Remarks', 'Vendor', 'Status', 'Admin_Note', 'Draft_Name'];
const materialRows = [['ID', 'Name', 'Tags', 'Vendor', 'Unit', 'Min', 'Step', 'Extra', 'Price'], ['M1', '電線', '', '材料商', 'M', 100, 100, '', 5], ['M2', '1.25mm2-1C絞線(綠色)', '', '伸泰', 'M', 1, 1, '', 5], ['M3', '1.25mm2-2C 單線 /黑色 (100M/丸)', '', '伸泰', 'M', 1, 1, '', 8]];
const row = (id, name, quantity, status = '處理中', company = '甲工班', unit = 'M') => [id, '2026-10-26 12:56', 'user@example.test', company, '南區', name, quantity, unit, '', name === '電線' ? '材料商' : '未指定', status, '', ''];

function harness(options = {}) {
  const state = { email: 'admin@example.test', writes: [], notifications: [], orders: [headers.slice(), row('O1', '電線', 100), row('O1', '電線', 200), row('O1', 'S', 1, '處理中', '甲工班', '式'), row('O2', '電線', 100, '審核中', '乙工班'), row('D1', '電線', 100, '編輯中')] };
  const users = [['Email', 'Role', 'Company', 'Region', 'Name', 'Chat'], ['admin@example.test', 'Admin', '甲工班', '南區', '管理者'], ['user@example.test', 'User', '甲工班', '南區', '申請人', 'user-chat']];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sheets = { spreadsheets: {
    get: async () => ({ data: { sheets: [{ properties: { title: 'Orders', sheetId: 0 } }] } }),
    batchUpdate: async ({ requestBody }) => {
      if (options.failEditBatch) throw new Error('Simulated atomic edit failure');
      const updated = clone(state.orders);
      for (const request of requestBody.requests) {
        if (request.deleteDimension) { const range = request.deleteDimension.range; updated.splice(range.startIndex, range.endIndex - range.startIndex); }
        if (request.insertDimension) { const range = request.insertDimension.range; updated.splice(range.startIndex, 0, ...Array.from({ length: range.endIndex - range.startIndex }, () => [])); }
        if (request.updateCells) { const change = request.updateCells; change.rows.forEach((row, index) => { updated[change.start.rowIndex + index] = row.values.map((cell) => cell.userEnteredValue.stringValue ?? cell.userEnteredValue.numberValue ?? cell.userEnteredValue.boolValue); }); }
      }
      state.orders = updated; state.writes.push(clone(requestBody)); return { data: {} };
    },
    values: {
    get: async ({ range }) => ({ data: { values: clone(range.startsWith('Users!') ? users : range.startsWith('Materials!') ? materialRows : range === 'Orders!1:1' ? [state.orders[0]] : state.orders) } }),
    batchUpdate: async ({ requestBody }) => {
      state.writes.push(clone(requestBody));
      for (const update of requestBody.data) {
        const [, letters, line] = /!([A-Z]+)(\d+)/.exec(update.range);
        const column = [...letters].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
        state.orders[Number(line) - 1][column] = update.values[0][0];
      }
      return { data: {} };
    },
    append: async ({ requestBody, valueInputOption }) => { state.writes.push({ valueInputOption }); state.orders.push(...requestBody.values); return { data: {} }; },
  } } };
  const cache = new Map();
  function load(name) {
    if (name === 'next/server') return { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }) } };
    if (name === 'next-auth/next') return { getServerSession: async () => state.email ? { user: { email: state.email } } : null };
    if (name === 'next/navigation') return { unstable_rethrow: () => {} };
    if (name === '@/lib/google-sheets') return { getGoogleSheets: async () => sheets };
    if (name === '@/lib/audit') return { logAudit: async () => {} };
    if (name === '@/lib/telegram') return { sendTelegramMessage: async (...args) => { state.notifications.push(args); return !options.failTelegram; } };
    if (name === '@/lib/vendor-report' && options.failWorkbook) return { buildVendorReports: async () => { throw new Error('Simulated workbook failure'); } };
    if (name === 'exceljs' && options.failWorkbook) return { Workbook: class { constructor() { throw new Error('Simulated workbook failure'); } } };
    if (!name.startsWith('@/')) return require(name);
    const file = path.join(__dirname, '..', name.slice(2) + '.ts');
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} }; cache.set(file, loadedModule);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInThisContext(`(function(require,module,exports,console){${code}\n})`, { filename: file })(load, loadedModule, loadedModule.exports, { ...console, error: () => {} });
    return loadedModule.exports;
  }
  return { state, load, sheets, users };
}

const request = (body, method = 'POST') => new Request('http://localhost/api/test', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('catalog metadata remains compatible with old sheets and never exposes prices', () => {
  const { load } = harness(); const { publicMaterials } = load('@/lib/material-catalog');
  const legacy = publicMaterials(materialRows);
  assert.equal(legacy[0].name, '電線'); assert.equal(legacy[0].category, '其他材料');
  const data = publicMaterials([['Item_ID','Item_Name','Tags','Vendor','Unit','Min_Qty','Step_Qty','Price','Category','Subcategory','Search_Aliases','Order_Hint','Requires_Remarks','Display_Name'],['M8','LED 35W\nPB5上蓋','混合材料, PB5','益詮','項',1,1,987654,'綜合材料','混合用料','組合,用料','請確認明細',true,'混合用料']]);
  assert.equal(data[0].requiresRemarks, true); assert.equal(data[0].displayName, '混合用料');
  assert.equal(data[0].aliases.join(','), '組合,用料'); assert(!JSON.stringify(data).includes('987654')); assert(!Object.hasOwn(data[0], 'price'));
  const { validateItems, toMaterialRules } = load('@/lib/order-domain');
  const rules = toMaterialRules([['ID','Name','Tags','Vendor','Unit','Min','Step','Price','Requires_Remarks'],['M8','混合材料','','益詮','項',1,1,500,'TRUE']]);
  const item={materialName:'混合材料',quantity:1,unit:'項',vendor:'益詮',originalId:'M8'};
  assert.match(validateItems([item], rules), /備註/); assert.match(validateItems([{...item,remarks:'   '}], rules), /備註/);
  assert.equal(validateItems([{...item,remarks:'LED與PB5依清單確認'}], rules), null);
});

test('material search matches attached Chinese/specs, inch notation and ranks exact names first', () => {
  const { load } = harness(); const { rankSearchOptions } = load('@/lib/material-catalog');
  const options=[{value:'M1',label:'1.25mm2-2C 單線 /黑色',keywords:'黑線 電線'},{value:'M2',label:'1.25mm2-3C 電纜 灰色',keywords:'灰線'},{value:'M3',label:'2.5英吋管夾片',keywords:'歐姆夾'},{value:'M4',label:'防水型ELCB 2P15AT30mA',keywords:'漏電斷路器'},{value:'M5',label:'管夾片（大型）'},{value:'M6',label:'管夾片'}];
  assert.equal(rankSearchOptions(options,'1.25黑線')[0].value,'M1');
  assert.equal(rankSearchOptions(options,'1.25*3C 灰')[0].value,'M2');
  assert.equal(rankSearchOptions(options,'２.５吋 歐姆夾')[0].value,'M3');
  assert.equal(rankSearchOptions(options,'漏電 15AT')[0].value,'M4');
  assert.equal(rankSearchOptions(options,'管夾片')[0].value,'M6');
  assert.equal(rankSearchOptions(options,'M3')[0].value,'M3');
  assert.equal(rankSearchOptions(options,'不存在的規格').length,0);
});

test('returned order presentation and filters agree for order and material reasons', () => {
  const { load } = harness();
  const { groupOrders, orderPresentation, filterOrderGroups } = load('@/lib/order-view');
  const line = { orderId: 'R1', status: '處理中', reqCompany: '甲', orderDate: '2026-10-26', returnNote: '', adminNote: '' };
  for (const reason of [{ returnNote: '請修改' }, { adminNote: '只改這項' }]) {
    const groups = groupOrders([{ ...line }, { ...line, ...reason }]);
    assert.equal(orderPresentation(groups[0]).label, '退回待修改');
    assert.equal(filterOrderGroups(groups, { status: '退回待修改' }).length, 1);
    assert.equal(filterOrderGroups(groups, { status: '待審核' }).length, 0);
  }
  const resubmitted = groupOrders([{ ...line, returnNote: '[已重送] 請修改' }]);
  assert.equal(orderPresentation(resubmitted[0]).label, '待審核');
});

test('same-name materials are matched by vendor and unit without ambiguous fallback', () => {
  const { load } = harness();
  const { matchMaterial, validateItems } = load('@/lib/order-domain');
  const rules = [
    { id: 'ST1', name: '電線', vendor: '伸泰', unit: 'M', minQty: 100, stepQty: 100 },
    { id: 'YQ1', name: '電線', vendor: '益詮', unit: 'M', minQty: 1, stepQty: 1 },
  ];
  const item = { materialName: '電線', vendor: '益詮', unit: 'M', quantity: 3 };
  assert.equal(matchMaterial(rules, item).id, 'YQ1');
  assert.equal(validateItems([item], rules), null);
  assert.match(validateItems([{ ...item, originalId: 'ST1' }], rules), /數量須至少|資料已更新/);
  assert.equal(matchMaterial(rules, { materialName: '電線' }), undefined);
  assert.equal(matchMaterial([...rules, { ...rules[1], id: 'YQ2' }], item), undefined);
});

test('same-order duplicate materials group once; material filters preserve every line', () => {
  const { load } = harness();
  const { groupOrders, filterOrderGroups, summarizeMaterials } = load('@/lib/order-view');
  const lines = [{ orderId: 'O1', materialName: '電線', unit: 'M', quantity: 100, status: '審核中', reqCompany: '甲', orderDate: '2026-10-26' }, { orderId: 'O1', materialName: '電線', unit: 'M', quantity: 200, status: '審核中', reqCompany: '甲', orderDate: '2026-10-26' }, { orderId: 'O1', materialName: 'S', unit: '式', quantity: 1, status: '審核中', reqCompany: '甲', orderDate: '2026-10-26' }];
  const groups = filterOrderGroups(groupOrders(lines), { material: '電線' });
  assert.equal(groups.length, 1); assert.equal(groups[0].items.length, 3);
  const wire = summarizeMaterials(lines).find((item) => item.name === '電線');
  assert.equal(wire.quantity, 300); assert.equal(wire.frequency, 1);
});

test('anonymous and normal users cannot access current or legacy admin APIs', async () => {
  for (const email of [null, 'user@example.test']) {
    const { state, load } = harness(); state.email = email;
    for (const route of ['@/app/api/admin/orders/route', '@/app/admin/orders/route', '@/app/api/test-sheets/route']) assert.equal((await load(route).GET()).status, email ? 403 : 401);
    assert.equal((await load('@/app/api/admin/export/route').POST(request({ filters: {}, orderIds: ['O2'] }))).status, email ? 403 : 401);
    assert.equal((await load('@/app/api/admin/update-status/route').PATCH(request({ orderIds: ['O1'], status: '審核中' }, 'PATCH'))).status, email ? 403 : 401);
    assert.equal(state.writes.length, 0);
  }
});

test('user history exposes only the whole assigned company; admin list omits drafts and prices', async () => {
  const { state, load } = harness(); state.email = 'user@example.test';
  const body = await (await load('@/app/api/orders/route').GET()).json();
  assert(body.data.every((item) => item.reqCompany === '甲工班'));
  assert.equal(body.data.filter((item) => item.orderId === 'O1').length, 3);
  assert.equal(body.data.filter((item) => item.orderId === 'D1').length, 1);
  state.email = 'admin@example.test';
  const admin = await (await load('@/app/api/admin/orders/route').GET(new Request('http://localhost/api/admin/orders?scope=all'))).json();
  assert(!admin.data.some((item) => item.status === '編輯中'));
  assert(!JSON.stringify(admin).includes('Price'));
});

test('batch operation updates all same-order materials together', async () => {
  const { state, load } = harness();
  const response = await load('@/app/api/admin/update-status/route').PATCH(request({ orderIds: ['O1'], status: '審核中' }, 'PATCH'));
  assert.equal(response.status, 200);
  assert(state.orders.slice(1).filter((item) => item[0] === 'O1').every((item) => item[10] === '審核中'));
  assert.equal(state.orders.find((item) => item[0] === 'D1')[10], '編輯中');
});

test('invalid batches, inconsistent order states, and completed returns produce no writes', async () => {
  const { state, load } = harness();
  const patch = load('@/app/api/admin/update-status/route').PATCH;
  assert.equal((await patch(request({ orderIds: ['O1', 'O2'], status: '已送達' }, 'PATCH'))).status, 409);
  state.orders[2][10] = '審核中';
  assert.equal((await patch(request({ orderIds: ['O1'], status: '審核中' }, 'PATCH'))).status, 409);
  state.orders.filter((item) => item[0] === 'O1').forEach((item) => { item[10] = '已送達'; });
  assert.equal((await patch(request({ orderIds: ['O1'], status: '處理中', adminNote: '測試原因' }, 'PATCH'))).status, 409);
  assert.equal(state.writes.length, 0);
});

test('export preserves both vendor templates, aggregates duplicate order lines and transitions only reviewed orders', async () => {
  const { state, load } = harness();
  const target = state.orders.filter((item) => item[0] === 'O1');
  target.forEach((item, index) => { item[10] = '審核中'; item[3] = '昇毅'; item[9] = '伸泰'; item[7] = 'M'; item[5] = index < 2 ? '1.25mm2-1C絞線(綠色)' : '1.25mm2-2C 單線 /黑色 (100M/丸)'; });
  const response = await load('@/app/api/admin/export/route').POST(request({ filters: { company: '昇毅', material: target[0][5] }, orderIds: ['O1'], expectedDate: '2026-11-01' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.files.length, 2);
  const file = body.files.find((item) => item.vendor === '伸泰');
  if (process.env.REPORT_QA_DIR) {
    fs.mkdirSync(process.env.REPORT_QA_DIR, { recursive: true });
    for (const output of body.files) fs.writeFileSync(path.join(process.env.REPORT_QA_DIR, path.basename(output.filename)), Buffer.from(output.fileContent, 'base64'));
  }
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(file.fileContent, 'base64'));
  const sheet = workbook.getWorksheet('維運材料總表');
  assert.equal(workbook.worksheets.length, 1); assert.equal(sheet.rowCount, 119);
  assert.equal(sheet.getCell('H4').result, 300); assert.equal(sheet.getCell('I4').result, 1500);
  assert.equal(sheet.getCell('J4').value, 300); assert.equal(sheet.getCell('H5').result, 1);
  assert.equal(sheet.getCell('H6').result ?? '', ''); assert.equal(sheet.getCell('J6').value, null);
  assert.equal(sheet.getColumn(6).hidden, true);
  const JSZip = require('jszip');
  const generated = await JSZip.loadAsync(Buffer.from(file.fileContent, 'base64'));
  const template = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, '..', 'assets/report-templates/shentai.xlsx')));
  assert.equal(await generated.file('xl/styles.xml').async('string'), await template.file('xl/styles.xml').async('string'));
  assert.equal(Object.keys((await JSZip.loadAsync(Buffer.from(body.archiveContent, 'base64'))).files).length, 2);
  assert(target.every((item) => item[10] === '準備出貨'));
  assert.equal(state.orders.find((item) => item[0] === 'O2')[10], '審核中');
  const writes = state.writes.length;
  assert.equal((await load('@/app/api/admin/export/route').POST(request({ filters: { company: '昇毅' }, orderIds: ['O1'] }))).status, 409);
  assert.equal(state.writes.length, writes);
  const repeat = await load('@/app/api/admin/export/route').POST(request({ scope: 'selected', orderIds: ['O1'] }));
  assert.equal(repeat.status, 200); assert.equal(state.writes.length, writes);
  assert.equal((await repeat.json()).advancedIds.length, 0);
});

test('forged/stale export and workbook generation failure never advance order states', async () => {
  for (const failWorkbook of [false, true]) {
    const { state, load } = harness({ failWorkbook });
    const post = load('@/app/api/admin/export/route').POST;
    assert.equal((await post(request({ filteredData: [{ orderId: 'FORGED', quantity: 999 }] }))).status, 400);
    assert.equal((await post(request({ filters: {}, orderIds: ['O1'] }))).status, 409);
    if (failWorkbook) assert.equal((await post(request({ filters: { company: '乙工班' }, orderIds: ['O2'] }))).status, 500);
    assert.equal(state.writes.length, 0);
    assert.equal(state.orders.find((item) => item[0] === 'O2')[10], '審核中');
  }
});

test('draft submission validates materials and cannot be used to resubmit a formal order', async () => {
  const { state, load } = harness(); state.email = 'user@example.test';
  const patch = load('@/app/api/orders/edit-item/route').PATCH;
  assert.equal((await patch(request({ orderId: 'O1', newStatus: '處理中' }, 'PATCH'))).status, 409);
  state.orders.find((item) => item[0] === 'D1')[6] = 0;
  assert.equal((await patch(request({ orderId: 'D1', newStatus: '處理中' }, 'PATCH'))).status, 400);
  assert.equal(state.writes.length, 0);
  state.orders.find((item) => item[0] === 'D1')[6] = 100;
  assert.equal((await patch(request({ orderId: 'D1', newStatus: '處理中' }, 'PATCH'))).status, 200);
});

test('new requests accept a null existing ID and preserve text as RAW rather than formulas', async () => {
  const { state, load } = harness(); state.email = 'user@example.test';
  const post = load('@/app/api/orders/route').POST;
  const response = await post(request({ existingOrderId: null, status: '處理中', items: [{ originalId: 'M1', materialName: '電線', quantity: 100, unit: 'M', vendor: '材料商', remarks: '=1+1' }] }));
  assert.equal(response.status, 200);
  assert.equal(state.writes[0].valueInputOption, 'RAW');
  assert.equal(state.orders.at(-1)[8], '=1+1');
});

test('targeted return marks only the chosen material, including duplicate names, while returning the whole order', async () => {
  const { state, load, sheets } = harness();
  const { rows } = await load('@/lib/order-sheet').loadOrderSheet(sheets);
  const targets = rows.filter((item) => item.orderId === 'O1');
  assert.notEqual(targets[0].lineId, targets[1].lineId);
  const response = await load('@/app/api/admin/update-status/route').PATCH(request({ orderIds: ['O1'], status: '處理中', adminNote: '只修改這筆規格', targetLineIds: [targets[1].lineId] }, 'PATCH'));
  assert.equal(response.status, 200);
  const updated = (await load('@/lib/order-sheet').loadOrderSheet(sheets)).rows.filter((item) => item.orderId === 'O1');
  assert(updated.every((item) => item.status === '處理中'));
  assert.equal(updated.filter((item) => item.adminNote).length, 1);
  assert.equal(updated[1].adminNote, '只修改這筆規格');
  assert(updated.every((item) => !item.returnNote));
  const writes = state.writes.length;
  assert.equal((await load('@/app/api/admin/update-status/route').PATCH(request({ orderIds: ['O1'], status: '處理中', adminNote: '過期材料識別', targetLineIds: ['missing'] }, 'PATCH'))).status, 409);
  assert.equal(state.writes.length, writes);
});

test('whole-order return stores one shared reason rather than repeating item reasons', async () => {
  const { load, sheets } = harness();
  assert.equal((await load('@/app/api/admin/update-status/route').PATCH(request({ orderIds: ['O1'], status: '處理中', adminNote: '整單請確認' }, 'PATCH'))).status, 200);
  const items = (await load('@/lib/order-sheet').loadOrderSheet(sheets)).rows.filter((item) => item.orderId === 'O1');
  assert(items.every((item) => item.returnNote === '整單請確認' && !item.adminNote));
});

test('delivery notifications include vendor caveat only when an estimate is provided', async () => {
  const { state, load, sheets, users } = harness();
  const { rows } = await load('@/lib/order-sheet').loadOrderSheet(sheets);
  const groups = load('@/lib/order-view').groupOrders(rows).filter((group) => group.orderId === 'O1');
  const notify = load('@/lib/order-notifications').notifyOrderProgress;
  await notify(groups, rows, users, '準備出貨', '管理者', '', '2026-11-01');
  assert(state.notifications[0][1].includes('預計交期：2026-11-01'));
  assert(state.notifications[0][1].includes('依廠商回覆為主'));
  await notify(groups, rows, users, '準備出貨', '管理者');
  assert(!state.notifications[1][1].includes('預計交期'));
});

test('admin date filtering is enforced before returning data; recent-month helper clamps month ends', async () => {
  const { load } = harness();
  const route = load('@/app/api/admin/orders/route');
  const response = await route.GET(new Request('http://localhost/api/admin/orders?startDate=2026-10-27&endDate=2026-10-28'));
  assert.equal((await response.json()).data.length, 0);
  assert.equal((await route.GET(new Request('http://localhost/api/admin/orders?startDate=2026-11-01&endDate=2026-10-01'))).status, 400);
  const range = load('@/lib/date-range').recentMonthRange(Date.parse('2026-03-31T00:00:00+08:00'));
  assert.equal(range.startDate, '2026-02-28'); assert.equal(range.endDate, '2026-03-31');
});

test('admin editing preserves ownership, date and stage and applies material changes as one batch', async () => {
  const { state, load, sheets } = harness();
  const rows = (await load('@/lib/order-sheet').loadOrderSheet(sheets)).rows.filter((item) => item.orderId === 'O1');
  const items = rows.map((item) => ({ ...item, originalId: item.materialName === '電線' ? 'M1' : 'other' }));
  items[0].quantity = 300; items[0].remarks = '=literal-not-a-formula';
  items.push({ materialName: '新材料', quantity: 1, unit: '式', vendor: '', remarks: '', originalId: 'other' });
  const response = await load('@/app/api/admin/edit-order/route').PATCH(request({ orderId: 'O1', expectedStatus: '處理中', expectedLineIds: rows.map((item) => item.lineId), items }, 'PATCH'));
  assert.equal(response.status, 200);
  const updated = state.orders.filter((item) => item[0] === 'O1');
  assert.equal(updated.length, 4); assert.equal(updated[0][6], 300); assert.equal(updated[0][8], '=literal-not-a-formula');
  assert(updated.every((item) => item[2] === 'user@example.test' && item[3] === '甲工班' && item[1] === '2026-10-26 12:56' && item[10] === '處理中'));
  assert.equal(state.writes.length, 1); assert(state.writes[0].requests.some((item) => item.insertDimension));
  assert.equal(state.orders.find((item) => item[0] === 'O2')[10], '審核中');
});

test('admin editing blocks users, locked stages, stale line versions and failed atomic writes', async () => {
  for (const mode of ['user', 'locked', 'stale', 'failure']) {
    const { state, load, sheets } = harness({ failEditBatch: mode === 'failure' });
    const rows = (await load('@/lib/order-sheet').loadOrderSheet(sheets)).rows.filter((item) => item.orderId === 'O1');
    const body = { orderId: 'O1', expectedStatus: '處理中', expectedLineIds: rows.map((item) => item.lineId), items: rows.map((item) => ({ ...item, originalId: item.materialName === '電線' ? 'M1' : 'other' })) };
    if (mode === 'user') state.email = 'user@example.test';
    if (mode === 'locked') state.orders.filter((item) => item[0] === 'O1').forEach((item) => { item[10] = '準備出貨'; });
    if (mode === 'stale') state.orders[1][6] = 200;
    const before = JSON.stringify(state.orders);
    const response = await load('@/app/api/admin/edit-order/route').PATCH(request(body, 'PATCH'));
    assert.equal(response.status, mode === 'user' ? 403 : mode === 'failure' ? 500 : 409);
    assert.equal(JSON.stringify(state.orders), before); assert.equal(state.writes.length, 0);
  }
});

test('vendor mapping uses the first duplicate template row and maps 鶴峻 to original template columns', async () => {
  const { load } = harness();
  const reports = await load('@/lib/vendor-report').buildVendorReports([{ orderId: 'DUP', materialName: '小基座桶維修孔蓋板', unit: '個', vendor: '益詮', reqCompany: '鶴峻', quantity: 2 }], []);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(reports.find((file) => file.vendor === '益詮').buffer);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getCell('N63').value, 2); assert.equal(sheet.getCell('N108').value, null);
  assert.equal(sheet.getCell('H63').result, 2); assert.equal(sheet.getCell('H108').result ?? '', '');
  assert.equal(sheet.rowCount, 181);
  await assert.rejects(load('@/lib/vendor-report').buildVendorReports([{ orderId: 'BAD', materialName: '不存在', unit: '個', vendor: '益詮', reqCompany: '鶴峻', quantity: 2 }], []), /不在益詮範本/);
});

test('daily review endpoint authenticates, separates returned orders and sends to topic 30', async (context) => {
  const keys = ['CRON_SECRET', 'TG_ADMIN_GROUP_ID', 'TELEGRAM_BOT_TOKEN', 'TG_TOPIC_PENDING_REVIEW'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  context.after(() => keys.forEach((key) => { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }));
  const { state, load } = harness();
  const cron = load('@/app/api/cron/pending-review/route').GET;
  delete process.env.CRON_SECRET;
  assert.equal((await cron(new Request('http://localhost/api/cron/pending-review'))).status, 503);
  process.env.CRON_SECRET = 'test-secret-for-cron-authentication'; process.env.TG_ADMIN_GROUP_ID = 'test-group'; process.env.TELEGRAM_BOT_TOKEN = 'test-token'; delete process.env.TG_TOPIC_PENDING_REVIEW;
  assert.equal((await cron(new Request('http://localhost/api/cron/pending-review', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
  const returned = row('RETURNED', '電線', 100); returned[11] = '需補規格'; state.orders.push(returned);
  const response = await cron(new Request('http://localhost/api/cron/pending-review', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.pendingCount, 1); assert.equal(body.returnedCount, 1);
  assert.equal(state.notifications.length, 1); assert.equal(state.notifications[0][2], '30');
  assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')).crons[0].schedule, '0 1 * * *');
  const failed = harness({ failTelegram: true });
  assert.equal((await failed.load('@/app/api/cron/pending-review/route').GET(new Request('http://localhost/api/cron/pending-review', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))).status, 502);
});
