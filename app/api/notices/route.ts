import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';

const findColIdx = (headers: string[], keys: string[]) => {
  return headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
};

export async function GET() {
  try {
    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'System_Notices!A:Z' });
    const rows = response.data.values;
    
    if (!rows || rows.length <= 1) return NextResponse.json({ data: [] });

    const headers = rows[0].map(h => String(h).trim());
    const idx = {
      content: findColIdx(headers, ['content', '內容', '公告內容']),
      isActive: findColIdx(headers, ['is_active', '啟用', '是否啟用'])
    };

    if (idx.content === -1 || idx.isActive === -1) return NextResponse.json({ data: [] });

    // 💡 只抓出 Is_Active 寫著 TRUE 的那一列
    const activeNotices = rows.slice(1)
      .filter(row => String(row[idx.isActive]).toUpperCase() === 'TRUE')
      .map(row => row[idx.content])
      .filter(Boolean); // 過濾掉空行

    return NextResponse.json({ data: activeNotices });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}