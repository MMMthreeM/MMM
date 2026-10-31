import { orderStatusLabel } from '@/lib/order-status';
import { AccessError } from '@/lib/access';
import { canAdminMoveStatus, columnLetter, type OrderStatus } from '@/lib/order-domain';
import { loadOrderSheet } from '@/lib/order-sheet';
import { groupOrders } from '@/lib/order-view';
import type { getGoogleSheets } from '@/lib/google-sheets';
import { toMaterialRules } from '@/lib/order-domain';
import { validateProcurementItems } from '@/lib/procurement';

export async function updateOrderStatuses(sheets: Awaited<ReturnType<typeof getGoogleSheets>>, orderIds: string[], status: OrderStatus, admin: string, note = '', expectedDate = '', requiredFrom?: string, targetLineIds?: string[], expectedLineIds?: string[]) {
  if (!orderIds.length || orderIds.length > 200 || orderIds.some((id) => typeof id !== 'string' || !id.trim())) throw new AccessError('請選取 1 至 200 張需求單。', 400);
  if (status === '處理中' && !note.trim()) throw new AccessError('退回時必須填寫原因。', 400);
  if (note.length > 500) throw new AccessError('退回原因限 500 字內。', 400);
  if (expectedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate) || !Number.isFinite(Date.parse(expectedDate)) || new Date(expectedDate).toISOString().slice(0, 10) !== expectedDate)) throw new AccessError('請填寫有效的預計送達日期。', 400);
  const { rows, headers, columns } = await loadOrderSheet(sheets);
  if (columns.orderId < 0 || columns.status < 0) throw new AccessError('訂單欄位設定不完整。', 409);
  const ids = new Set(orderIds);
  const groups = groupOrders(rows).filter((group) => ids.has(group.orderId));
  if (groups.length !== ids.size) throw new AccessError('部分需求單已不存在，請重新整理。', 409);
  if (expectedLineIds && JSON.stringify(groups.flatMap((group) => group.items.map((item) => item.lineId)).sort()) !== JSON.stringify([...expectedLineIds].sort())) throw new AccessError('需求單材料已被更新，請重新整理後再次匯出。', 409);
  const targets = targetLineIds === undefined ? null : new Set(targetLineIds);
  if (targets && (status !== '處理中' || targets.size === 0 || [...targets].some((id) => !groups.some((group) => group.items.some((item) => item.lineId === id))) || groups.some((group) => !group.items.some((item) => targets.has(item.lineId))))) throw new AccessError('請為每張退回單選擇至少一筆材料；資料異動後請重新整理。', 409);
  for (const group of groups) {
    if (!group.consistent) throw new AccessError(`${group.orderId} 的狀態或工班不一致，請先確認資料。`, 409);
    if (requiredFrom && group.status !== requiredFrom) throw new AccessError(`${group.orderId} 的狀態已變更，請重新整理。`, 409);
    const allowed = status === '處理中'
      ? ['處理中', '審核中', '審核完畢', '準備出貨'].includes(group.status)
      : canAdminMoveStatus(group.status, status);
    if (!allowed) throw new AccessError(`${group.orderId} 無法由「${orderStatusLabel(group.status)}」變更為「${orderStatusLabel(status)}」。`, 409);
  }
  if (status === '審核完畢' || status === '準備出貨') {
    const catalog = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Materials' });
    const rules = toMaterialRules(catalog.data.values || []);
    for (const group of groups) {
      const issue = validateProcurementItems(group.items, rules, true);
      if (issue) throw new AccessError(`${group.orderId}：${issue}`, 409);
    }
  }
  let nextColumn = headers.length;
  const adminColumn = columns.adminUser < 0 ? nextColumn++ : columns.adminUser;
  const dateColumn = columns.expectedDate < 0 ? nextColumn++ : columns.expectedDate;
  const noteColumn = columns.adminNote < 0 ? nextColumn++ : columns.adminNote;
  const returnColumn = columns.returnNote < 0 ? nextColumn++ : columns.returnNote;
  const data: { range: string; values: string[][] }[] = [];
  const add = (column: number, row: number, value: string) => data.push({ range: `Orders!${columnLetter(column)}${row}`, values: [[value]] });
  if (columns.adminUser < 0) add(adminColumn, 1, 'Admin_User');
  if (columns.expectedDate < 0) add(dateColumn, 1, 'Expected_Date');
  if (columns.adminNote < 0) add(noteColumn, 1, 'Admin_Note');
  if (columns.returnNote < 0) add(returnColumn, 1, 'Order_Return_Note');
  rows.forEach((row, index) => {
    if (!ids.has(row.orderId)) return;
    add(columns.status, index + 2, status);
    add(adminColumn, index + 2, admin);
    // Clear obsolete return reasons when an order progresses again.
    add(noteColumn, index + 2, status === '處理中' && targets?.has(row.lineId) ? note.trim() : '');
    add(returnColumn, index + 2, status === '處理中' && !targets ? note.trim() : '');
    if (status === '準備出貨' || status === '處理中') add(dateColumn, index + 2, status === '處理中' ? '' : expectedDate);
  });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: process.env.GOOGLE_SHEET_ID, requestBody: { valueInputOption: 'RAW', data } });
  return { groups, rows };
}
