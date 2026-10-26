export async function sendTelegramMessage(chatId: string, message: string, threadId?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.error('❌ TG 推播取消: 缺少 TOKEN 或 ChatID');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const payload: any = {
    chat_id: String(chatId).trim(),
    text: message,
    parse_mode: 'HTML',
  };
  
  if (threadId && !isNaN(Number(threadId))) {
    payload.message_thread_id = Number(threadId);
  }

  // 💡 加入自動重試機制 (最多嘗試 3 次)
  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // 設定 5 秒超時，防止卡死 (Next.js 預設的 fetch 參數)
        signal: AbortSignal.timeout(5000) 
      });
      
      const data = await res.json();
      if (!res.ok) {
        console.error(`❌ TG 推播失敗 (ChatID: ${payload.chat_id}):`, data.description);
      } else {
        console.log(`✅ TG 推播成功 (ChatID: ${payload.chat_id}, Thread: ${threadId || '無'})`);
      }
      return; // 只要有收到 Telegram 伺服器的明確回覆 (不管成功或失敗)，就結束任務
      
    } catch (error: any) {
      retries--;
      console.warn(`⚠️ TG 網路連線異常 (${error.code || error.message})，正在進行第 ${3 - retries} 次重試...`);
      
      if (retries === 0) {
        console.error('❌ TG 發送最終失敗 (網路持續中斷):', error);
      } else {
        // 等待 1.5 秒後再重試一次
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }
}