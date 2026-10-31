import { getGoogleSheets } from '@/lib/google-sheets';
import { orderColumns, readUsers } from '@/lib/sheet-table';
import type { OrderRow } from '@/lib/order-view';
import { createHash } from 'node:crypto';

export async function loadOrderSheet(sheets: Awaited<ReturnType<typeof getGoogleSheets>>, users: unknown[][] = []) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Orders' });
  const raw = response.data.values ?? [];
  const headers = (raw[0] ?? []).map(String);
  const userMap = new Map((users.length ? readUsers(users) : []).map(user => [user.email, user.name]));
  const columns = orderColumns(headers);
  const occurrences = new Map<string, number>();
  const rows: OrderRow[] = raw.slice(1).map((row) => {
    const value = (key: keyof OrderRow) => columns[key] < 0 ? '' : String(row[columns[key]] ?? '');
    const identity = JSON.stringify([value('orderId'), value('materialName'), value('quantity'), value('unit'), value('vendor'), value('remarks'), value('catalogId')]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const lineId = createHash('sha256').update(`${identity}:${occurrence}`).digest('hex').slice(0, 24);
    return { lineId, catalogId: value('catalogId'), originalMaterialName: value('originalMaterialName'), returnNote: value('returnNote'), orderId: value('orderId'), orderDate: value('orderDate'), reqUser: userMap.get(value('reqUser')) ?? value('reqUser'),
      reqCompany: value('reqCompany'), reqRegion: value('reqRegion'), materialName: value('materialName'), quantity: Number(value('quantity')) || 0,
      unit: value('unit'), remarks: value('remarks'), vendor: value('vendor'), status: value('status'), adminNote: value('adminNote'),
      draftName: value('draftName'), adminUser: userMap.get(value('adminUser')) ?? value('adminUser'), expectedDate: value('expectedDate') };
  });
  return { raw, headers, columns, rows };
}
