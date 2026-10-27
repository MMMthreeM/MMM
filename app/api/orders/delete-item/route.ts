import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";
import { findColumn, isUserEditableStatus } from '@/lib/order-domain';
import { apiError } from '@/lib/access';

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });
    const userEmail = session.user.email;

    const body = await request.json();
    const { orderId, materialName, deleteType } = body;
    if (typeof orderId !== 'string' || !['order', 'single'].includes(deleteType) || (deleteType === 'single' && typeof materialName !== 'string')) return NextResponse.json({ error: '刪除資料不完整。' }, { status: 400 });

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
    const rows = response.data.values;
    if (!rows) return NextResponse.json({ error: '找不到資料' }, { status: 404 });

    const headers = rows[0].map(h => String(h).trim());
    const idIdx = findColumn(headers, ['order_id', '單號']);
    const itemIdx = findColumn(headers, ['item_name', '材料', '品項']);
    const companyIdx = findColumn(headers, ['req_company', '工班', '公司']);
    const statusIdx = findColumn(headers, ['status', '狀態']);

    if (idIdx === -1) return NextResponse.json({ error: '找不到單號欄位' }, { status: 400 });

    const users = (await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:D' })).data.values || [];
    const currentUser = users.find((row) => row[0] === userEmail);
    const company = currentUser?.[2];
    if (!currentUser || !['Admin', 'User'].includes(String(currentUser[1])) || !company) return NextResponse.json({ error: '您的帳號尚未完成工班權限設定。' }, { status: 403 });
    const orderRows = rows.slice(1).filter((row) => row[idIdx] === orderId);
    if (!orderRows.length) return NextResponse.json({ error: '找不到該筆訂單。' }, { status: 404 });
    if (companyIdx === -1 || orderRows.some((row) => row[companyIdx] !== company)) return NextResponse.json({ error: '您沒有刪除此訂單的權限。' }, { status: 403 });
    if (statusIdx === -1 || orderRows.some((row) => !isUserEditableStatus(String(row[statusIdx] || '')))) return NextResponse.json({ error: '此訂單目前不可刪除。' }, { status: 409 });
    if (deleteType === 'single' && orderRows.filter((row) => row[itemIdx] === materialName).length > 1) return NextResponse.json({ error: '同單包含多筆同名材料，請透過修改單據選擇要移除的項目。' }, { status: 409 });
    const gid = (await sheets.spreadsheets.get({ spreadsheetId: sheetId })).data.sheets?.find(s => s.properties?.title === 'Orders')?.properties?.sheetId;
    if (gid === undefined) return NextResponse.json({ error: '找不到 Orders 資料表。' }, { status: 500 });
    const rowsToDelete: number[] = [];

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] === orderId) {
        if (deleteType === 'order') {
          rowsToDelete.push(i);
        } else if (deleteType === 'single' && itemIdx !== -1 && rows[i][itemIdx] === materialName) {
          rowsToDelete.push(i);
        }
      }
    }

    rowsToDelete.sort((a, b) => b - a);
    if (rowsToDelete.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: rowsToDelete.map(rIdx => ({
            deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: rIdx, endIndex: rIdx + 1 } }
          }))
        }
      });

      // 💡 寫入 Audit Log
      try {
        const { logAudit } = await import('@/lib/audit');
        const actionName = deleteType === 'order' ? '刪除整筆訂單' : '刪除單項材料';
        const details = deleteType === 'order' ? '使用者自行刪除整單' : `刪除項目: ${materialName}`;
        await logAudit(userEmail, actionName, orderId, details);
      } catch (e) { console.error('寫入 Delete Log 失敗', e); }
    }

    if (!rowsToDelete.length) return NextResponse.json({ error: '找不到要刪除的材料。' }, { status: 404 });
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return apiError(error, '刪除訂單失敗，請重新整理後再試。');
  }
}
