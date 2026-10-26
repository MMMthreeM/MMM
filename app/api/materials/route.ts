import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';

export async function GET() {
  try {
    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Materials!A:G',
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ data: [] });
    }

    // 略過第一列標題，將資料轉換為物件陣列
    const materials = rows.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      tags: row[2]?.split(',').map((t: string) => t.trim()) || [],
      vendor: row[3],
      unit: row[4],
      minQty: parseInt(row[5], 10) || 1,
      stepQty: parseInt(row[6], 10) || 1,
    }));

    return NextResponse.json({ data: materials });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}