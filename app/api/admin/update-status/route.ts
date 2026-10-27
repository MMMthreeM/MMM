import { NextResponse } from 'next/server';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { isOrderStatus } from '@/lib/order-domain';
import { updateOrderStatuses } from '@/lib/order-actions';
import { notifyOrderProgress } from '@/lib/order-notifications';

export async function PATCH(request: Request) {
  try {
    const { account, sheets, users } = await requireAccount(true);
    const body = await request.json();
    const ids = body.orderIds ?? (typeof body.orderId === 'string' ? [body.orderId] : []);
    if (body.targetLineIds !== undefined && (!Array.isArray(body.targetLineIds) || body.targetLineIds.some((id: unknown) => typeof id !== 'string'))) throw new AccessError('退回材料格式不正確。', 400);
    if (!Array.isArray(ids) || !isOrderStatus(body.status) || (body.adminNote !== undefined && typeof body.adminNote !== 'string') || (body.expectedDate !== undefined && typeof body.expectedDate !== 'string')) throw new AccessError('狀態更新格式不正確。', 400);
    const note = (body.adminNote ?? '').replace(/^\[退回原因\]\s*/, '').trim();
    const { groups, rows } = await updateOrderStatuses(sheets, ids, body.status, account.name, note, body.expectedDate ?? '', undefined, body.targetLineIds);
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit(account.email, body.status === '處理中' ? '退回需求單' : '批次更新狀態', ids.join(', '), `共 ${groups.length} 張單 → ${body.status}${note ? `；原因：${note}` : ''}`);
    } catch (error) { console.error('寫入稽核紀錄失敗', error); }
    await notifyOrderProgress(groups, rows, users, body.status, account.name, note, body.expectedDate ?? '');
    return NextResponse.json({ status: 'success', orderIds: ids, adminUser: account.name });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: '請求內容格式不正確。' }, { status: 400 });
    return apiError(error, '更新狀態失敗，請重新整理後再試。');
  }
}
