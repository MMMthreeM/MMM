import { NextResponse } from 'next/server';
import { apiError, requireAccount } from '@/lib/access';

export async function GET() {
  try {
    await requireAccount(true);
    return NextResponse.json({ status: 'success', message: '資料來源連線正常。' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error, '無法連線至資料來源。'); }
}
