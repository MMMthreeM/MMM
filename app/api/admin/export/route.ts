import { secureMutation } from '@/lib/mutation-security';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { loadOrderSheet } from '@/lib/order-sheet';
import { filterOrderGroups, groupOrders, type OrderFilters } from '@/lib/order-view';
import { buildVendorReports } from '@/lib/vendor-report';
import { quotationText } from '@/lib/quotation';
import { taipeiDate } from '@/lib/date-range';

async function handleMutation(request: Request) {
  try {
    const { account, sheets, users } = await requireAccount(true);
    const body = await request.json();
    const scope = body.scope ?? 'filtered';
    if (!['filtered', 'selected'].includes(scope) || !Array.isArray(body.orderIds) || !body.orderIds.length || body.orderIds.length > 200 || body.orderIds.some((id: unknown) => typeof id !== 'string' || !id)) throw new AccessError('請選取 1 至 200 張需求單。', 400);
    const requested = new Set<string>(body.orderIds);
    if (requested.size !== body.orderIds.length) throw new AccessError('匯出單據不可重複。', 400);
    const filters: OrderFilters = {};
    if (scope === 'filtered') {
      if (!body.filters || typeof body.filters !== 'object' || Array.isArray(body.filters)) throw new AccessError('請先確認匯出範圍。', 400);
      for (const key of ['company', 'region', 'vendor', 'material', 'status', 'startDate', 'endDate', 'search'] as const) {
        if (body.filters[key] !== undefined && typeof body.filters[key] !== 'string') throw new AccessError('篩選格式不正確。', 400);
        filters[key] = body.filters[key];
      }
    }
    const { rows } = await loadOrderSheet(sheets, users);
    const all = groupOrders(rows);
    const groups = scope === 'selected' ? all.filter((group) => requested.has(group.orderId)) : filterOrderGroups(all, filters).filter((group) => group.status !== '編輯中');
    if (groups.length !== requested.size || groups.some((group) => !requested.has(group.orderId))) throw new AccessError('匯出範圍或狀態已變更，請重新整理並確認。', 409);
    if (groups.some((group) => !group.consistent || group.status === '編輯中')) throw new AccessError('僅能匯出狀態一致的正式需求單，草稿不列入匯出。', 409);
    const materials = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Materials' });
    const files = await buildVendorReports(groups.flatMap((group) => group.items), materials.data.values ?? []);
    if (!files.length) throw new AccessError('所選需求只有賀冠材料，請使用「賀冠詢價」複製文字。', 409);
    const archive = new JSZip();
    files.forEach((file) => archive.file(file.filename, file.buffer));
    const archiveBuffer = await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const latest = groupOrders((await loadOrderSheet(sheets)).rows);
    for (const original of groups) {
      const fresh = latest.find(group => group.orderId === original.orderId);
      if (!fresh?.consistent || fresh.status !== original.status || JSON.stringify(fresh.items.map(item => item.lineId).sort()) !== JSON.stringify(original.items.map(item => item.lineId).sort())) throw new AccessError('需求單已變更，請重新整理後再次匯出。', 409);
    }
    const orderIds = groups.map((group) => group.orderId);
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit(account.email, '分廠商匯出報表', orderIds.join(', '), `共 ${groups.length} 張，不變更需求狀態`);
    } catch (error) { console.error('匯出稽核紀錄失敗', error); }
    return NextResponse.json({ status: 'success', orderIds, advancedIds: [], reexportedIds: orderIds, quotationText: quotationText(groups), archiveName: `高雄-材料需求_${taipeiDate().replace(/-/g, '')}.zip`, archiveContent: archiveBuffer.toString('base64'), files: files.map((file) => ({ vendor: file.vendor, filename: file.filename, fileContent: file.buffer.toString('base64') })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: '請求內容格式不正確。' }, { status: 400 });
    return apiError(error, '報表產生失敗，請重新整理後再試。');
  }
}

export const POST = secureMutation(handleMutation, { admin: true, action: 'admin-export', limit: 3, orderWrite: false });
