import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";

const findColIdx = (headers: string[], keys: string[]) => {
  return headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
};

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });
    const userEmail = session.user.email;

    const body = await request.json();
    const { orderId, materialName, deleteType } = body;

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
    const rows = response.data.values;
    if (!rows) return NextResponse.json({ error: '找不到資料' }, { status: 404 });

    const headers = rows[0].map(h => String(h).trim());
    const idIdx = findColIdx(headers, ['order_id', '單號']);
    const itemIdx = findColIdx(headers, ['item_name', '材料', '品項']);

    if (idIdx === -1) return NextResponse.json({ error: '找不到單號欄位' }, { status: 400 });

    const gid = (await sheets.spreadsheets.get({ spreadsheetId: sheetId })).data.sheets?.find(s => s.properties?.title === 'Orders')?.properties?.sheetId;
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

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}