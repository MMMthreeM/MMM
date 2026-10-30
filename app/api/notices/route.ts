import { sheetColumns } from '@/lib/sheet-table';
import { NextResponse } from 'next/server';
import { apiError, requireAccount } from '@/lib/access';

export async function GET() {
  try {
    const { sheets } = await requireAccount();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'System_Notices' });
    const rows = response.data.values;
    
    if (!rows) throw new Error('System_Notices headers missing');

    const headers = rows[0].map(h => String(h).trim());
    const idx = sheetColumns(headers, { content: ['Content','內容','公告內容'], isActive: ['Is_Active','啟用','是否啟用'] }, ['content','isActive'], 'System_Notices');

    // 💡 只抓出 Is_Active 寫著 TRUE 的那一列
    const activeNotices = rows.slice(1)
      .filter(row => String(row[idx.isActive]).toUpperCase() === 'TRUE')
      .map(row => row[idx.content])
      .filter(Boolean); // 過濾掉空行

    return NextResponse.json({ data: activeNotices });
  } catch (error) { return apiError(error, '讀取公告失敗。'); }
}
