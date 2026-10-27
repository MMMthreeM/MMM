import { NextResponse } from 'next/server';
import { apiError, requireAccount } from '@/lib/access';

export async function GET() {
  try {
    const { sheets } = await requireAccount();
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
      name: String(row[1] ?? '').trim(),
      tags: row[2]?.split(',').map((t: string) => t.trim()) || [],
      vendor: String(row[3] ?? '').trim(),
      unit: String(row[4] ?? '').trim(),
      minQty: parseInt(row[5], 10) || 1,
      stepQty: parseInt(row[6], 10) || 1,
    }));

    return NextResponse.json({ data: materials }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error, '讀取材料清單失敗。'); }
}
