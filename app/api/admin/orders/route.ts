import { NextResponse } from 'next/server';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { loadOrderSheet } from '@/lib/order-sheet';
import { recentMonthRange } from '@/lib/date-range';

export async function GET(request?: Request) {
  try {
    const { sheets, users } = await requireAccount(true);
    const { rows } = await loadOrderSheet(sheets, users);
    const params = new URL(request?.url ?? 'http://localhost').searchParams;
    const defaults = params.get('scope') === 'all' ? { startDate: '', endDate: '' } : recentMonthRange();
    const start = params.get('startDate') ?? defaults.startDate;
    const end = params.get('endDate') ?? defaults.endDate;
    if ((start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) || (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) || (start && end && start > end)) throw new AccessError('請提供有效的日期範圍。', 400);
    const data = rows.filter((row) => row.status !== '編輯中' && (!start || row.orderDate.slice(0, 10) >= start) && (!end || row.orderDate.slice(0, 10) <= end)).reverse();
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error, '讀取需求單失敗，請重新整理。'); }
}
