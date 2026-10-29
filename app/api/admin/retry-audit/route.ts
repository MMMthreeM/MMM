import { NextResponse } from 'next/server';
import { secureMutation } from '@/lib/mutation-security';
import { requireAccount } from '@/lib/access';
import { flushPendingAudits } from '@/lib/audit-delivery';

export const POST = secureMutation(async () => {
  const { sheets } = await requireAccount(true);
  await flushPendingAudits(sheets);
  return NextResponse.json({ status: 'success' });
}, { admin: true, action: 'audit-retry', limit: 3, orderWrite: false });
