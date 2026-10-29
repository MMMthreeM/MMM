import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { getGoogleSheets } from '@/lib/google-sheets';
import type { Account } from '@/lib/order-view';
import { consumeRate } from '@/lib/security-store';
import { AccessError } from '@/lib/access-error';
export { AccessError } from '@/lib/access-error';



export async function requireAccount(adminOnly = false) {
  const session = await getServerSession();
  const email = session?.user?.email;
  if (!email) throw new AccessError('請先登入。', 401);
  // Bound authenticated traffic before every request can consume a Sheets lookup.
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) await consumeRate(email, 'authenticated', 120);
  const sheets = await getGoogleSheets();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Users!A:F' });
  const users = response.data.values ?? [];
  const row = users.slice(1).find((user) => String(user[0]).toLowerCase() === email.toLowerCase());
  if (!row || !['Admin', 'User'].includes(String(row[1]))) throw new AccessError('此帳號尚未取得平台使用權限。', 403);
  if (adminOnly && row[1] !== 'Admin') throw new AccessError('此功能僅供管理者使用。', 403);
  if (row[1] === 'User' && !row[2]) throw new AccessError('此帳號尚未設定所屬工班。', 403);
  const account: Account = { email, role: row[1] as Account['role'], company: String(row[2] ?? ''), region: String(row[3] ?? ''), name: String(row[4] || email.split('@')[0]) };
  return { account, sheets, users };
}

export function apiError(error: unknown, fallback = '作業失敗，請稍後再試。') {
  unstable_rethrow(error);
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
