import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const orderId = id;
    const body = await request.json();
    const { status } = body;

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // 1. 抓取所有資料
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Orders!A:M',
    });
    
    const rows = response.data.values;
    if (!rows) throw new Error("找不到訂單資料");

    // 2. 找出「所有」符合這個單號的行數 (Row Index)
    const matchingRowIndices: number[] = [];
    rows.forEach((row, index) => {
      if (row[0] === orderId) {
        // index 0 是表頭，但 get 回來的 rows 是從 0 開始算，Google Sheets 的列是從 1 開始算
        // 所以實際對應到 Excel 裡的行數是 index + 1
        matchingRowIndices.push(index + 1);
      }
    });

    if (matchingRowIndices.length === 0) {
      return NextResponse.json({ error: '找不到該筆訂單' }, { status: 404 });
    }

    // 3. 準備批次更新的資料
    const updateData = matchingRowIndices.map(rowIndex => ({
      range: `Orders!K${rowIndex}`, // 狀態在 K 欄
      values: [[status]],
    }));

    // 4. 執行批次更新
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updateData,
      },
    });

    return NextResponse.json({ status: 'success', message: '狀態批次更新成功' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}