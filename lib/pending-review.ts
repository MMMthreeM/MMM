import { groupOrders, isReturnedOrder, waitingDays, type OrderRow } from '@/lib/order-view';
import { taipeiDate } from '@/lib/date-range';

export function pendingReviewSummary(rows: OrderRow[], now = Date.now()) {
  const groups = groupOrders(rows).filter((group) => group.status !== '編輯中');
  const processing = groups.filter((group) => group.consistent && group.status === '處理中');
  const returned = processing.filter(isReturnedOrder);
  const returnedIds = new Set(returned.map((group) => group.orderId));
  const pending = processing.filter((group) => !returnedIds.has(group.orderId)).sort((a, b) => a.first.orderDate.localeCompare(b.first.orderDate));
  const inconsistent = groups.filter((group) => !group.consistent).length;
  const message = [`${taipeiDate(now)} 待審需求提醒`, `待審需求：${pending.length} 張`, `退回待補件：${returned.length} 張`, `最久等待：${pending.length ? waitingDays(pending[0].first.orderDate, now) : 0} 天（自最近送出／更新）`, ...(inconsistent ? [`資料狀態待確認：${inconsistent} 張`] : []), ...pending.slice(0, 5).map((group) => `${group.orderId} · ${group.first.reqCompany} · 等待 ${waitingDays(group.first.orderDate, now)} 天`)].join('\n');
  return { pendingCount: pending.length, returnedCount: returned.length, inconsistentCount: inconsistent, message };
}
