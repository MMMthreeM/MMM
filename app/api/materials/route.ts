import { NextResponse } from 'next/server';
import { apiError, requireAccount } from '@/lib/access';
import { publicMaterials } from '@/lib/material-catalog';

export async function GET() {
  try {
    const { sheets } = await requireAccount();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Materials',
    });

    const materials = publicMaterials(response.data.values || []);

    return NextResponse.json({ data: materials }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error, '讀取材料清單失敗。'); }
}
