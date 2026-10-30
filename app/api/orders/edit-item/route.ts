import { secureMutation } from '@/lib/mutation-security';
import { NextResponse } from 'next/server';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { loadOrderSheet } from '@/lib/order-sheet';
import { columnLetter, matchMaterial, toMaterialRules, validateItems } from '@/lib/order-domain';
import { sendTelegramMessage } from '@/lib/telegram';
import { orderItemMessages } from '@/lib/order-message';
import { escapeTelegramHtml } from '@/lib/telegram-html';

async function handleMutation(request: Request) {
  try {
    const { account, sheets } = await requireAccount();
    const body = await request.json();
    if (typeof body.orderId !== 'string' || body.newStatus !== '處理中') throw new AccessError('此操作僅能正式送出草稿。', 400);
    const { rows, columns } = await loadOrderSheet(sheets);
    const matching = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.orderId === body.orderId);
    if (!matching.length) throw new AccessError('找不到此草稿。', 404);
    if (!account.company || matching.some(({ row }) => row.reqCompany !== account.company)) throw new AccessError('您沒有操作此草稿的權限。', 403);
    if (matching.some(({ row }) => row.status !== '編輯中')) throw new AccessError('此單已非草稿，請重新整理。', 409);
    if (columns.status < 0 || columns.orderDate < 0) throw new AccessError('訂單欄位設定不完整。', 409);
    const materials = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Materials' });
    const rules = toMaterialRules(materials.data.values ?? []);
    const items = matching.map(({ row }) => ({ ...row, originalId: matchMaterial(rules, row)?.id ?? 'other' }));
    const validation = validateItems(items, rules);
    if (validation) throw new AccessError(validation, 400);
    const submitted = new Date(Date.now() + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 16);
    const data = matching.flatMap(({ index }) => [
      { range: `Orders!${columnLetter(columns.status)}${index + 2}`, values: [['處理中']] },
      { range: `Orders!${columnLetter(columns.orderDate)}${index + 2}`, values: [[submitted]] },
      ...(columns.draftName < 0 ? [] : [{ range: `Orders!${columnLetter(columns.draftName)}${index + 2}`, values: [['']] }]),
    ]);
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: process.env.GOOGLE_SHEET_ID, requestBody: { valueInputOption: 'RAW', data } });
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit(account.email, '草稿正式送出', body.orderId, `共 ${matching.length} 筆材料`);
      if (process.env.TG_ADMIN_GROUP_ID) for (const message of orderItemMessages( `<b>草稿正式送出</b>\n單號：${escapeTelegramHtml(body.orderId)}\n工班：${escapeTelegramHtml(account.company)}\n申請人：${escapeTelegramHtml(account.name)}\n需求狀態：待審核`, items, '請至管理後台進行審核。')) await sendTelegramMessage(process.env.TG_ADMIN_GROUP_ID, message, process.env.TG_TOPIC_NEW_ORDER);
    } catch (error) { console.error('草稿送出通知失敗', error); }
    return NextResponse.json({ status: 'success' });
  } catch (error) { return apiError(error, '送出草稿失敗，請重新整理後再試。'); }
}

export const PATCH = secureMutation(handleMutation, { admin: false, action: 'draft-submit', limit: 10 });
