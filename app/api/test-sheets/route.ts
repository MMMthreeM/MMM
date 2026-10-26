import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';

export async function GET() {
  try {
    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    // 嘗試讀取試算表的 A1 儲存格
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1',
    });

    return NextResponse.json({ 
      status: 'success', 
      message: '成功連線到 Google Sheets!',
      data: response.data.values 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}