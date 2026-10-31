import { NextResponse } from 'next/server';
import { secureMutation } from '@/lib/mutation-security';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { loadOrderSheet } from '@/lib/order-sheet';
import { groupOrders } from '@/lib/order-view';
import { toMaterialRules } from '@/lib/order-domain';
import { validateProcurementItems } from '@/lib/procurement';
import { quotationText } from '@/lib/quotation';
import { logAudit } from '@/lib/audit';

export const POST = secureMutation(async (request: Request) => {
  try {
    const { account, sheets, users } = await requireAccount(true);
    const { orderIds } = await request.json();
    if (!Array.isArray(orderIds) || !orderIds.length || orderIds.length > 200 || orderIds.some(id => typeof id !== 'string' || !id) || new Set(orderIds).size !== orderIds.length) throw new AccessError('請選取 1 至 200 張不同的需求單。', 400);
    const groups = groupOrders((await loadOrderSheet(sheets, users)).rows).filter(group => orderIds.includes(group.orderId));
    if (groups.length !== orderIds.length || groups.some(group => !group.consistent || group.status === '編輯中')) throw new AccessError('需求單已變更或仍是草稿，請重新整理。', 409);
    const rules = toMaterialRules((await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Materials' })).data.values || []);
    for (const group of groups) { const issue = validateProcurementItems(group.items, rules, true); if (issue) throw new AccessError(issue, 409); }
    const text = quotationText(groups);
    if (!text) throw new AccessError('所選單據沒有賀冠材料，請先指定供應廠商。', 409);
    await logAudit(account.email, '產生賀冠詢價文字', orderIds.join(', '), '不變更需求狀態；由管理員自行複製傳送。');
    return NextResponse.json({ text }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error, '無法產生詢價內容。'); }
}, { admin: true, action: 'quotation', limit: 10, orderWrite: false });
