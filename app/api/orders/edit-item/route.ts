import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const body = await request.json();
    const { orderId, materialName, newQuantity, newRemarks, newStatus } = body;
    const sheets = await getGoogleSheets(); const sheetId = process.env.GOOGLE_SHEET_ID;

    // 取得使用者工班
    const uRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:D' });
    const myCompany = (uRes.data.values || []).find(r => r[0] === session.user?.email)?.[2];

    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
    const rows = response.data.values;
    if (!rows) throw new Error("找不到資料");

    const headers = rows[0].map(h => String(h).trim());
    const getCol = (name: string) => headers.indexOf(name) !== -1 ? String.fromCharCode(65 + headers.indexOf(name)) : '';
    
    const qtyCol = getCol('Quantity'), remarkCol = getCol('Remarks'), statusCol = getCol('Status'), noteCol = getCol('Admin_Note');

    const updateData: any[] = [];
    rows.forEach((row, idx) => {
      // 💡 同工班的人都可以修改
      if (row[0] === orderId && row[headers.indexOf('Req_Company')] === myCompany) {
        if (newStatus) { // 如果是點擊「送出」，整單狀態改變
          updateData.push({ range: `Orders!${statusCol}${idx + 1}`, values: [[newStatus]] });
        } else if (row[headers.indexOf('Item_Name')] === materialName) {
          if (newQuantity !== undefined) updateData.push({ range: `Orders!${qtyCol}${idx + 1}`, values: [[newQuantity]] });
          if (newRemarks !== undefined) updateData.push({ range: `Orders!${remarkCol}${idx + 1}`, values: [[newRemarks]] });
          if (noteCol) updateData.push({ range: `Orders!${noteCol}${idx + 1}`, values: [['']] }); // 清空退回原因
        }
      }
    });

    if (updateData.length === 0) return NextResponse.json({ error: '找不到項目' }, { status: 404 });
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: sheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: updateData } });
    return NextResponse.json({ status: 'success' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}