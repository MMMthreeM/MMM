import { sendTelegramMessage } from '@/lib/telegram';
import { escapeTelegramHtml } from '@/lib/telegram-html';
import type { OrderGroup, OrderRow } from '@/lib/order-view';

export async function notifyOrderProgress(groups: OrderGroup[], originalRows: OrderRow[], users: unknown[][], status: string, admin: string, note = '', expectedDate = '') {
  for (const group of groups) {
    try {
      const owner = originalRows.find((row) => row.orderId === group.orderId)?.reqUser;
      const user = users.find((row) => row[0] === owner);
      const message = status === '處理中' ? `需求單已退回，請修改後重新送出。\n原因：${note}` : `需求單進度已更新：${status}${expectedDate ? `\n預計交期：${expectedDate}\n交期依廠商回覆為主。` : ''}`;
      if (user?.[5]) await sendTelegramMessage(String(user[5]), `<b>${escapeTelegramHtml(group.orderId)}</b>\n${escapeTelegramHtml(message)}`);
      if (status === '處理中' && process.env.TG_ADMIN_GROUP_ID) await sendTelegramMessage(process.env.TG_ADMIN_GROUP_ID, `<b>需求單退回紀錄</b>\n${escapeTelegramHtml(group.orderId)}\n處理人：${escapeTelegramHtml(admin)}\n原因：${escapeTelegramHtml(note)}`, process.env.TG_TOPIC_RETURN);
    } catch (error) { console.error('傳送需求單通知失敗', error); }
  }
}
