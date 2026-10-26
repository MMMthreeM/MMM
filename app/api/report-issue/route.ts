import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email || '未登入訪客';
    
    const body = await request.json();
    const { description, url } = body;

    if (!description) {
      return NextResponse.json({ error: '內容不可為空' }, { status: 400 });
    }

    const adminGroupId = process.env.TG_ADMIN_GROUP_ID;
    // 💡 如果你未來有建立專屬的「#系統錯誤」主題，可以在 .env 加 TG_TOPIC_ERROR
    // 這裡預設先推播到原本的「退回紀錄」主題，或者不帶主題 ID (會發到群組預設大廳)
    const topicError = process.env.TG_TOPIC_ERROR || process.env.TG_TOPIC_RETURN;

    if (adminGroupId) {
      const msg = `🐞 <b>使用者問題回報</b>\n回報人：${userEmail.split('@')[0]}\n發生頁面：${url}\n\n👉 <b>${description}</b>`;
      await sendTelegramMessage(adminGroupId, msg, topicError);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}