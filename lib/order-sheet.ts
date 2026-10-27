import { getGoogleSheets } from '@/lib/google-sheets';
import { findColumn } from '@/lib/order-domain';
import type { OrderRow } from '@/lib/order-view';
import { createHash } from 'node:crypto';

export async function loadOrderSheet(sheets: Awaited<ReturnType<typeof getGoogleSheets>>, users: unknown[][] = []) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Orders!A:AZ' });
  const raw = response.data.values ?? [];
  const headers = (raw[0] ?? []).map(String);
  const userMap = new Map(users.slice(1).map((row) => [String(row[0]), String(row[4] || row[0])]));
  const aliases: Record<keyof OrderRow, string[]> = {
    orderId: ['order_id', '單號'], orderDate: ['order_date', '日期'], reqUser: ['req_user', '申請人'],
    reqCompany: ['req_company', '工班', '公司'], reqRegion: ['req_region', '地區', '區域'],
    materialName: ['item_name', '材料', '品項'], quantity: ['quantity', '數量'], unit: ['unit', '單位'],
    remarks: ['remarks', '備註'], vendor: ['vendor', '廠商'], status: ['status', '狀態'],
    adminNote: ['admin_note', '退回原因', '管理員備註'], draftName: ['draft_name', '草稿名稱'],
    adminUser: ['admin_user', '審核人'], expectedDate: ['expected_date', '預計送達', '交期'],
    returnNote: ['order_return_note', '整單退回原因'], lineId: ['line_id'],
  };
  const columns = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, findColumn(headers, names)])) as Record<keyof OrderRow, number>;
  const occurrences = new Map<string, number>();
  const rows: OrderRow[] = raw.slice(1).map((row) => {
    const value = (key: keyof OrderRow) => columns[key] < 0 ? '' : String(row[columns[key]] ?? '');
    const identity = JSON.stringify([value('orderId'), value('materialName'), value('quantity'), value('unit'), value('vendor'), value('remarks')]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const lineId = createHash('sha256').update(`${identity}:${occurrence}`).digest('hex').slice(0, 24);
    return { lineId, returnNote: value('returnNote'), orderId: value('orderId'), orderDate: value('orderDate'), reqUser: userMap.get(value('reqUser')) ?? value('reqUser'),
      reqCompany: value('reqCompany'), reqRegion: value('reqRegion'), materialName: value('materialName'), quantity: Number(value('quantity')) || 0,
      unit: value('unit'), remarks: value('remarks'), vendor: value('vendor'), status: value('status'), adminNote: value('adminNote'),
      draftName: value('draftName'), adminUser: userMap.get(value('adminUser')) ?? value('adminUser'), expectedDate: value('expectedDate') };
  });
  return { raw, headers, columns, rows };
}
