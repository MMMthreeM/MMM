import { secureMutation } from '@/lib/mutation-security';
import { NextResponse } from 'next/server';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { loadOrderSheet } from '@/lib/order-sheet';
import { toMaterialRules, type OrderItemInput } from '@/lib/order-domain';
import { procurementRule, validateProcurementItems } from '@/lib/procurement';
import { groupOrders, orderPresentation } from '@/lib/order-view';

type EditItem = OrderItemInput & { lineId?: string };

async function handleMutation(request: Request) {
  try {
    const { account, sheets } = await requireAccount(true);
    const body = await request.json();
    if (typeof body.orderId !== 'string' || !Array.isArray(body.expectedLineIds) || body.expectedLineIds.some((id: unknown) => typeof id !== 'string') || typeof body.expectedStatus !== 'string') throw new AccessError('編輯資料格式不正確。', 400);
    const sheet = await loadOrderSheet(sheets);
    const group = groupOrders(sheet.rows).find((item) => item.orderId === body.orderId);
    if (!group) throw new AccessError('找不到此需求單。', 404);
    if (!group.consistent || !['處理中', '審核中'].includes(group.status)) throw new AccessError('管理員只能修改待審核、退回待修改或審核中的完整需求單。', 409);
    if (group.status !== body.expectedStatus || JSON.stringify(group.items.map((item) => item.lineId).sort()) !== JSON.stringify([...body.expectedLineIds].sort())) throw new AccessError('需求單已被更新，請重新整理後再編輯。', 409);
    const materials = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Materials' });
    const rules = toMaterialRules(materials.data.values ?? []);
    const validation = validateProcurementItems(body.items, rules);
    if (validation) throw new AccessError(validation, 400);
    const items = body.items as EditItem[];
    const ids = new Map(group.items.map((item) => [item.lineId, item]));
    if (items.some((item) => item.lineId !== undefined && !ids.has(item.lineId))) throw new AccessError('材料列不屬於此需求單。', 400);
    const presentIds = items.map((item) => item.lineId).filter(Boolean);
    if (new Set(presentIds).size !== presentIds.length) throw new AccessError('同一材料列不可重複提交。', 400);
    const matching = sheet.rows.map((row, index) => ({ row, index })).filter(({ row }) => row.orderId === body.orderId);
    const indexById = new Map(matching.map(({ row, index }) => [row.lineId, index]));
    if (['materialName', 'quantity', 'unit', 'vendor', 'remarks'].some((key) => sheet.columns[key as keyof typeof sheet.columns] < 0)) throw new AccessError('材料欄位設定不完整。', 409);
    const headers = [...sheet.headers];
    const catalogColumn = sheet.columns.catalogId < 0 ? headers.push('Material_ID') - 1 : sheet.columns.catalogId;
    const originalColumn = sheet.columns.originalMaterialName < 0 ? headers.push('Original_Item_Name') - 1 : sheet.columns.originalMaterialName;
    const newRows = items.map((item) => {
      const original = item.lineId ? indexById.get(item.lineId) : undefined;
      const source = sheet.raw[(original ?? matching[0].index) + 1];
      const row = Array.from({ length: headers.length }, (_, index) => source[index] ?? '');
      row[sheet.columns.materialName] = item.materialName.trim(); row[sheet.columns.quantity] = item.quantity;
      row[sheet.columns.unit] = item.unit || '式'; row[sheet.columns.vendor] = item.vendor || '未指定'; row[sheet.columns.remarks] = item.remarks || '';
      row[catalogColumn] = procurementRule(rules, item)?.id || '';
      row[originalColumn] = original === undefined ? item.materialName : source[originalColumn] || source[sheet.columns.materialName] || item.materialName;
      if (sheet.columns.adminUser >= 0) row[sheet.columns.adminUser] = account.name;
      if (original === undefined && sheet.columns.adminNote >= 0) row[sheet.columns.adminNote] = '';
      return row;
    });
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, fields: 'sheets.properties' });
    const sheetId = metadata.data.sheets?.find((item) => item.properties?.title === 'Orders')?.properties?.sheetId;
    if (sheetId == null) throw new AccessError('找不到需求單工作表。', 409);
    const cells = (row: (string | number | boolean)[]) => ({ values: row.map((value) => ({ userEnteredValue: typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value ?? '') } })) });
    const firstRow = matching[0].index + 1;
    const requests = newRows.length === matching.length
      ? newRows.map((row, index) => ({ updateCells: { start: { sheetId, rowIndex: matching[index].index + 1, columnIndex: 0 }, rows: [cells(row)], fields: 'userEnteredValue' } }))
      : [
          ...[...matching].reverse().map(({ index }) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: index + 1, endIndex: index + 2 } } })),
          { insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: firstRow, endIndex: firstRow + newRows.length }, inheritFromBefore: true } },
          { updateCells: { start: { sheetId, rowIndex: firstRow, columnIndex: 0 }, rows: newRows.map(cells), fields: 'userEnteredValue' } },
        ];
    if (headers.length !== sheet.headers.length) requests.unshift({ updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [cells(headers)], fields: 'userEnteredValue' } });
    // A single Sheets batch validates all changes before applying the edit.
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: process.env.GOOGLE_SHEET_ID, requestBody: { requests } });
    try { const { logAudit } = await import('@/lib/audit'); await logAudit(account.email, '管理員編輯需求單', body.orderId, `材料筆數 ${matching.length} → ${newRows.length}；維持${orderPresentation(group).label}`); }
    catch (error) { console.error('編輯稽核紀錄失敗', error); }
    return NextResponse.json({ status: 'success', orderId: body.orderId });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: '編輯內容格式不正確。' }, { status: 400 });
    return apiError(error, '儲存需求單失敗，請重新整理後再試。');
  }
}

export const PATCH = secureMutation(handleMutation, { admin: true, action: 'admin-edit', limit: 20 });
