/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node browser check without a test runner dependency. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_MODULE_DIR, process.cwd()].filter(Boolean) }));

const artifacts = process.env.UI_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'material-management-ui-check');
fs.mkdirSync(artifacts, { recursive: true });
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3000';
const realCatalog = process.env.UI_CATALOG_PATH ? JSON.parse(fs.readFileSync(process.env.UI_CATALOG_PATH, 'utf8')) : [
  { id: 'W1', name: '1.25mm2-2C 單線 /黑色', displayName: '1.25mm2-2C 單線 /黑色', unit: 'M', vendor: '伸泰', minQty: 100, stepQty: 100, tags: ['電線'], aliases: ['黑線'], category: '電線電纜', subcategory: '多芯電纜' },
  { id: 'B1', name: 'LED 35W\nPB5上蓋', displayName: '混合用料（LED／PB5）', unit: '項', vendor: '益詮', minQty: 1, stepQty: 1, tags: ['混合材料'], aliases: ['組合材料'], category: '綜合材料', subcategory: '混合用料', requiresRemarks: true, orderHint: '請確認各項材料與數量' },
];
let nextLine = 0;
const makeRow = (orderId, materialName, quantity, status = '處理中', reqCompany = '甲工班') => ({ lineId: `line-${++nextLine}`, returnNote: '', orderId, orderDate: '2026-10-26 12:56', reqUser: '申請人', reqCompany, reqRegion: '高雄', materialName, quantity, unit: materialName === 'S' ? '式' : 'M', remarks: '需要確認現場規格與交貨時間，這是一段較長的手機版測試備註。', vendor: '材料商', status, adminNote: '', draftName: '', adminUser: '管理者', expectedDate: '' });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const state = { role: 'Admin', failExport: true, exportBody: null, orders: [makeRow('ORD-20261026-9212', '電線', 100), makeRow('ORD-20261026-9212', '電線', 100), makeRow('ORD-20261026-9212', 'S', 1), makeRow('ORD-20261026-9212', '電線', 203), makeRow('ORD-OTHER', '電線', 50, '審核中', '乙工班'), makeRow('ORD-REVIEW', '長名稱材料／測試手機版文字不應將操作按鈕擠出畫面', 20, '審核中'), makeRow('DRAFT-1', '電線', 100, '編輯中')] };
    const errors = [];
    await context.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/auth/session') return json({ user: { name: '測試使用者', email: 'test@example.test' }, expires: '2099-01-01T00:00:00.000Z' });
      if (url.pathname === '/api/me') return json({ account: { role: state.role, company: '甲工班', region: '高雄', name: '測試使用者', email: 'test@example.test' } });
      if (url.pathname === '/api/notices') return json({ data: [] });
      if (url.pathname === '/api/materials') return json({ data: [{ id: 'M1', name: '電線', unit: 'M', vendor: '材料商', minQty: 100, stepQty: 100, tags: [] }, ...Array.from({ length: 240 }, (_, index) => ({ id: `M-${index}`, name: `規格材料 ${index} 長名稱檢查`, unit: '式', vendor: '材料商', minQty: 1, stepQty: 1, tags: ['配件'] })), ...realCatalog.map((material) => ({ ...material, id: `REAL-${material.id}` }))] });
      if (url.pathname === '/api/admin/orders') return json({ data: state.orders.filter((row) => row.status !== '編輯中') });
      if (url.pathname === '/api/orders' && route.request().method() === 'GET') return json({ data: state.orders.filter((row) => row.reqCompany === '甲工班') });
      if (url.pathname === '/api/admin/update-status') {
        const body = route.request().postDataJSON();
        state.orders.forEach((row) => { if (body.orderIds.includes(row.orderId)) { row.status = body.status; row.adminNote = body.targetLineIds?.includes(row.lineId) ? body.adminNote : ''; row.returnNote = body.status === '處理中' && !body.targetLineIds ? body.adminNote : ''; } });
        return json({ orderIds: body.orderIds, status: 'success' });
      }
      if (url.pathname === '/api/admin/edit-order') {
        const body = route.request().postDataJSON();
        const originals = state.orders.filter((row) => row.orderId === body.orderId);
        state.orders = state.orders.filter((row) => row.orderId !== body.orderId).concat(body.items.map((item) => ({ ...(originals.find((row) => row.lineId === item.lineId) || originals[0]), ...item })));
        return json({ status: 'success', orderId: body.orderId });
      }
      if (url.pathname === '/api/admin/export') {
        state.exportBody = route.request().postDataJSON();
        if (state.failExport) { state.failExport = false; return json({ error: '模擬狀態衝突，請確認後再試。' }, 409); }
        const advancedIds = [...new Set(state.orders.filter((row) => state.exportBody.orderIds.includes(row.orderId) && row.status === '審核中').map((row) => row.orderId))];
        state.orders.forEach((row) => { if (advancedIds.includes(row.orderId)) row.status = '準備出貨'; });
        return json({ status: 'success', orderIds: state.exportBody.orderIds, advancedIds, reexportedIds: state.exportBody.orderIds.filter((id) => !advancedIds.includes(id)), archiveName: '廠商報表.zip', archiveContent: Buffer.from('mock archive').toString('base64'), files: ['伸泰', '益詮'].map((vendor) => ({ vendor, filename: `${vendor}.xlsx`, fileContent: Buffer.from('mock report').toString('base64') })) });
      }
      return json({ error: 'Unexpected mocked API request' }, 404);
    });
    page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/');
    await page.getByRole('heading', { name: '管理工作總覽' }).waitFor();
    await page.getByRole('link', { name: '進入審核中心' }).click();
    await page.getByRole('heading', { name: 'ORD-20261026-9212', exact: true }).waitFor();
    const checkbox = page.getByRole('checkbox', { name: '選取整張需求單 ORD-20261026-9212，共 4 筆材料', exact: true });
    await checkbox.check();
    await page.getByText('已選取 1 張單', { exact: true }).waitFor();
    assert.equal(await page.locator('.order-group').filter({ has: page.getByRole('heading', { name: 'ORD-20261026-9212', exact: true }) }).locator('.order-item').count(), 4);
    await page.screenshot({ path: path.join(artifacts, 'admin-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: '退回修改', exact: true }).click();
    await page.locator('dialog[open] textarea').fill('只需修改第二筆材料');
    await page.getByRole('radio', { name: '只顯示在指定材料', exact: true }).check();
    await page.locator('.return-materials input[type=checkbox]').nth(1).check();
    await page.getByRole('button', { name: '確認更新', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '退回待修改' }).waitFor();
    await page.locator('.order-group').filter({ has: page.getByRole('heading', { name: 'ORD-20261026-9212', exact: true }) }).locator('.status-returned').filter({ hasText: '退回待修改' }).waitFor();
    assert.equal(state.orders.filter((row) => row.orderId === 'ORD-20261026-9212' && row.adminNote).length, 1);
    await page.getByRole('button', { name: '編輯需求單 ORD-20261026-9212', exact: true }).click();
    await page.getByRole('spinbutton', { name: '第 1 筆數量', exact: true }).fill('200');
    await page.getByRole('button', { name: '儲存單據', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '管理員修改已儲存' }).waitFor();
    assert.equal(state.orders.find((row) => row.orderId === 'ORD-20261026-9212').quantity, 200);
    await checkbox.check();
    await page.getByRole('button', { name: '開始審核', exact: true }).click();
    await page.getByRole('button', { name: '確認更新', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '已更新 1 張需求單' }).waitFor();
    assert(state.orders.filter((row) => row.orderId === 'ORD-20261026-9212').every((row) => row.status === '審核中'));
    await page.getByLabel('工班', { exact: true }).selectOption('甲工班');
    await page.getByRole('button', { name: '匯出並轉準備出貨', exact: true }).click();
    await page.getByRole('button', { name: '確認匯出並轉準備出貨', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '模擬狀態衝突' }).waitFor();
    assert(state.orders.filter((row) => row.orderId === 'ORD-20261026-9212').every((row) => row.status === '審核中'));
    await page.getByRole('button', { name: '確認匯出並轉準備出貨', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '2 張轉為準備出貨' }).waitFor();
    assert.deepEqual([...state.exportBody.orderIds].sort(), ['ORD-20261026-9212', 'ORD-REVIEW'].sort());
    assert.equal(state.orders.find((row) => row.orderId === 'ORD-OTHER').status, '審核中');
    assert.equal(await page.getByRole('button', { name: '編輯需求單 ORD-20261026-9212', exact: true }).count(), 0);
    await checkbox.check();
    await page.getByRole('button', { name: '匯出勾選單據', exact: true }).click();
    await page.getByRole('button', { name: '確認重新匯出', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '0 張轉為準備出貨，1 張重新匯出' }).waitFor();
    assert.equal(state.exportBody.scope, 'selected');
    assert(state.orders.filter((row) => row.orderId === 'ORD-20261026-9212').every((row) => row.status === '準備出貨'));
    assert.equal(await page.getByRole('button', { name: '下載伸泰報表', exact: true }).count(), 1);

    const assertNoOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'page has horizontal overflow');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const heading = document.querySelector('.order-group-heading');
      return heading && getComputedStyle(heading).display === 'grid';
    });
    await page.screenshot({ path: path.join(artifacts, 'admin-mobile.png'), fullPage: true });
    await assertNoOverflow();
    await page.getByRole('button', { name: '開啟主要選單' }).click();
    await page.getByRole('link', { name: '儀表板', exact: true }).click();
    await page.getByRole('heading', { name: '各工班材料總覽' }).waitFor();
    await page.getByRole('heading', { name: '材料需求明細統計' }).waitFor();
    await assertNoOverflow();
    await page.screenshot({ path: path.join(artifacts, 'analytics-admin-mobile.png'), fullPage: true });

    state.role = 'User';
    state.orders.push({ ...makeRow('RETURNED-1', '需修改材料', 1, '處理中'), returnNote: '請確認材料規格' }, makeRow('PENDING-1', '新送出材料', 1, '處理中'));
    for (let index = 0; index < 25; index++) state.orders.push(makeRow(`PAGE-${index}`, `分頁材料 ${index}`, 1, '已送達'));
    await page.goto(base + '/');
    await page.getByRole('heading', { name: '甲工班材料儀表板' }).waitFor();
    await page.getByRole('heading', { name: '材料需求明細統計' }).waitFor();
    assert.equal(await page.getByText('乙工班', { exact: true }).count(), 0);
    await page.screenshot({ path: path.join(artifacts, 'analytics-user-mobile.png'), fullPage: true });
    await assertNoOverflow();
    const materialPages = page.getByRole('navigation', { name: '材料統計分頁', exact: true });
    await materialPages.getByRole('button', { name: '下一頁', exact: true }).click();
    assert.equal(await materialPages.getByRole('combobox').inputValue(), '2');
    await page.getByRole('button', { name: '開啟主要選單' }).click();
    assert.equal(await page.getByRole('link', { name: '審核中心', exact: true }).count(), 0);
    await page.getByRole('link', { name: '歷史需求單', exact: true }).click();
    await page.getByRole('tab', { name: /^進行中/ }).waitFor();
    assert.equal(await page.getByRole('tab', { name: /^進行中/ }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('heading', { name: 'PAGE-0', exact: true }).count(), 0);
    await page.getByRole('heading', { name: 'RETURNED-1', exact: true }).waitFor();
    assert.equal(await page.locator('.order-group').first().getByRole('heading').textContent(), 'RETURNED-1');
    await page.getByRole('button', { name: /^退回待修改 1$/ }).click();
    assert.equal(await page.locator('.order-group').count(), 1);
    await page.getByRole('button', { name: /^待審核 1$/ }).click();
    await page.getByRole('heading', { name: 'PENDING-1', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'RETURNED-1', exact: true }).count(), 0);
    await page.screenshot({ path: path.join(artifacts, 'history-active-mobile.png'), fullPage: true });
    await assertNoOverflow();
    await page.getByRole('tab', { name: /^出貨與完成/ }).click();
    const historyPages = page.getByRole('navigation', { name: '歷史需求單分頁', exact: true });
    await historyPages.getByRole('button', { name: '下一頁', exact: true }).click();
    assert.equal(await historyPages.getByRole('combobox').inputValue(), '2');
    assert.equal(await page.locator('.order-group').count(), 10);
    await page.getByRole('tab', { name: '草稿（1）' }).click();
    await page.getByRole('heading', { name: 'DRAFT-1', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'ORD-REVIEW', exact: true }).count(), 0);
    await assertNoOverflow();
    await page.goto(base + '/request');
    await page.getByRole('heading', { name: '建立材料需求' }).waitFor();
    const materialSearch = page.getByRole('combobox', { name: '搜尋並選擇材料', exact: true });
    await materialSearch.click();
    assert.equal(await page.getByRole('listbox', { name: '搜尋並選擇材料搜尋結果' }).getByRole('option').count(), 8);
    await materialSearch.fill('電線');
    await page.getByRole('listbox', { name: '搜尋並選擇材料搜尋結果' }).getByRole('button').first().click();
    assert((await page.locator('.quantity-stepper').boundingBox()).width <= 240);
    await page.getByRole('button', { name: '加入待送出清單', exact: true }).click();
    await page.locator('.mobile-cart-bar').getByRole('button', { name: '確認清單並送出（1）', exact: true }).click();
    await page.getByRole('heading', { name: '確認待送出清單' }).waitFor();
    await assertNoOverflow();
    await page.screenshot({ path: path.join(artifacts, 'request-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1652, height: 936 });
    await page.getByRole('button', { name: '新增材料', exact: true }).click();
    assert((await page.locator('.request-frame').boundingBox()).width <= 1080);
    assert.equal(await page.locator('.quantity-stepper').count(), 0);
    await page.screenshot({ path: path.join(artifacts, 'request-desktop.png'), fullPage: true });
    await page.goto(base + '/request');
    await page.getByRole('combobox', { name: '材料分類', exact: true }).selectOption('電線電纜');
    await page.getByRole('combobox', { name: '材料廠商', exact: true }).selectOption('伸泰');
    await materialSearch.fill('1.25黑線');
    const results = page.getByRole('listbox', { name: '搜尋並選擇材料搜尋結果' });
    await results.getByRole('option').first().waitFor();
    assert((await results.innerText()).includes('伸泰'));
    await materialSearch.press('Enter');
    await page.getByRole('button', { name: '加入常用', exact: true }).click();
    await page.getByRole('button', { name: '加入待送出清單', exact: true }).click();
    await page.getByRole('button', { name: '常用材料', exact: true }).click();
    await materialSearch.click();
    assert.equal(await results.getByRole('option').count(), 1);
    await materialSearch.press('Enter');
    assert.equal(await page.getByRole('button', { name: '移除常用', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.reload();
    await page.getByRole('button', { name: '常用材料', exact: true }).click();
    await materialSearch.click();
    await results.getByRole('option').first().waitFor();
    assert.equal(await results.getByRole('option').count(), 1);
    await materialSearch.press('Enter');
    await page.getByRole('button', { name: '最近選用', exact: true }).click();
    await materialSearch.click();
    assert((await results.innerText()).includes('1.25'));
    await materialSearch.press('Escape');
    await page.getByRole('button', { name: '清除篩選', exact: true }).click();
    await page.getByRole('combobox', { name: '材料分類', exact: true }).selectOption('綜合材料');
    await materialSearch.fill('混合');
    await results.getByRole('option').first().waitFor();
    await materialSearch.press('Enter');
    assert.equal(await page.getByRole('textbox', { name: '附加備註', exact: true }).getAttribute('aria-required'), 'true');
    await page.getByRole('button', { name: '加入待送出清單', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '混合材料' }).waitFor();
    await page.getByRole('textbox', { name: '附加備註', exact: true }).fill('LED35W、75W各3箱；灰色電纜10卷；PB5上蓋30只。');
    await page.getByRole('button', { name: '加入待送出清單', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '已加入' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '最近選用', exact: true }).click();
    await materialSearch.fill('混合');
    await materialSearch.press('Enter');
    await page.getByText('查看混合材料完整內容', { exact: true }).click();
    await assertNoOverflow();
    await page.screenshot({ path: path.join(artifacts, 'catalog-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1652, height: 1000 });
    await page.screenshot({ path: path.join(artifacts, 'catalog-desktop.png'), fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'passed', materialCount: 241 + realCatalog.length, checks: ['role homepages', 'whole-order selection', 'targeted material return', 'admin edit icon and save', 'batch review', 'export failure recovery', 'filtered export and shipping', 'selected re-export without state changes', 'individual vendor downloads', 'company isolation', 'dashboard and history pagination', 'draft tab', 'material search limited to 8 results', 'category and vendor filters with alias search', 'favorites persist after reload', 'recent material selection', 'mixed material remarks required', 'quantity controls appear after material selection', 'mobile and 1652px desktop request layout', 'no horizontal overflow'], screenshots: artifacts }, null, 2));
  } catch (error) {
    if (page) { console.error((await page.locator('body').innerText()).slice(0, 1800)); await page.screenshot({ path: path.join(artifacts, 'failed-check.png'), fullPage: true }).catch(() => {}); }
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
