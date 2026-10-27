import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { loadOrderSheet } from '@/lib/order-sheet';
import { pendingReviewSummary } from '@/lib/pending-review';
import { sendTelegramMessage } from '@/lib/telegram';
import { escapeTelegramHtml } from '@/lib/telegram-html';

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: '排程驗證尚未設定。' }, { status: 503 });
  const supplied = Buffer.from(authorization || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: '未授權' }, { status: 401 });
  if (!process.env.TG_ADMIN_GROUP_ID || !process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: '管理員推播尚未設定。' }, { status: 503 });
  try {
    const sheets = await getGoogleSheets();
    const { rows } = await loadOrderSheet(sheets);
    const summary = pendingReviewSummary(rows);
    const sent = await sendTelegramMessage(process.env.TG_ADMIN_GROUP_ID, escapeTelegramHtml(summary.message), process.env.TG_TOPIC_PENDING_REVIEW || '30');
    if (!sent) return NextResponse.json({ error: '每日提醒傳送失敗。' }, { status: 502 });
    return NextResponse.json({ status: 'success', pendingCount: summary.pendingCount, returnedCount: summary.returnedCount }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('每日待審提醒失敗', error); return NextResponse.json({ error: '每日提醒失敗，請檢查排程紀錄。' }, { status: 500 }); }
}
