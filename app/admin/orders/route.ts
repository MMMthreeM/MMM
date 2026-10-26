import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';

export async function GET() {
  try {
    const sheets = await getGoogleSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Orders!A:M',
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return NextResponse.json({ data: [] });

    const allOrders = rows.slice(1).map(row => ({
      orderId: row[0],
      reqUser: row[2],
      reqCompany: row[3],
      materialName: row[5],
      quantity: row[6],
      unit: row[7],
      status: row[10],
    }));

    return NextResponse.json({ data: allOrders.reverse() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}