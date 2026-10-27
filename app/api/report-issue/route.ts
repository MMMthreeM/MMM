import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { apiError, requireAccount } from '@/lib/access';
import { escapeTelegramHtml } from '@/lib/telegram-html';

export async function POST(request: Request) {
  try {
    const { account } = await requireAccount();
    const userEmail = account.email;
    
    const body = await request.json();
    const { description, url } = body;

    if (typeof description !== 'string' || !description.trim() || description.length > 1500 || typeof url !== 'string' || url.length > 500) {
      return NextResponse.json({ error: '請填寫問題描述（限 1500 字）。' }, { status: 400 });
    }

    const adminGroupId = process.env.TG_ADMIN_GROUP_ID;
    // 💡 如果你未來有建立專屬的「#系統錯誤」主題，可以在 .env 加 TG_TOPIC_ERROR
    // 這裡預設先推播到原本的「退回紀錄」主題，或者不帶主題 ID (會發到群組預設大廳)
    const topicError = process.env.TG_TOPIC_ERROR || process.env.TG_TOPIC_RETURN;

    if (adminGroupId) {
      const msg = `🐞 <b>使用者問題回報</b>\n回報人：${escapeTelegramHtml(userEmail.split('@')[0])}\n發生頁面：${escapeTelegramHtml(url)}\n\n👉 <b>${escapeTelegramHtml(description)}</b>`;
      await sendTelegramMessage(adminGroupId, msg, topicError);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) { return apiError(error, '問題回報失敗，請稍後再試。'); }
}
