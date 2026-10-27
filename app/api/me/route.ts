import { NextResponse } from 'next/server';
import { apiError, requireAccount } from '@/lib/access';

export async function GET() {
  try {
    const { account } = await requireAccount();
    return NextResponse.json({ account }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
