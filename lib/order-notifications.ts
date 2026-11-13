import { orderStatusLabel } from '@/lib/order-status';
import { requesterForNotification } from '@/lib/order-people';
import { sendTelegramMessage } from '@/lib/telegram';
import { escapeTelegramHtml } from '@/lib/telegram-html';
import type { OrderGroup, OrderRow } from '@/lib/order-view';

export async function notifyOrderProgress(groups: OrderGroup[], originalRows: OrderRow[], users: unknown[][], status: string, admin: string, note = '', expectedDate = '') {
  let delivered = true;
  for (const group of groups) {
    try {
      const owner = originalRows.find((row) => row.orderId === group.orderId) || group.first;
      const user = requesterForNotification(owner, users);
      const message = status === '處理中' ? `需求狀態：退回待修改。請修改後重新送出。\n原因：${note}` : `需求狀態：${orderStatusLabel(status)}${expectedDate ? `\n預計交期：${expectedDate}\n交期依廠商回覆為主。` : ''}`;
      if (user?.chat) delivered = await sendTelegramMessage(String(user.chat), `<b>${escapeTelegramHtml(group.orderId)}</b>\n${escapeTelegramHtml(message)}`) && delivered;
      if (status === '處理中' && process.env.TG_ADMIN_GROUP_ID) delivered = await sendTelegramMessage(process.env.TG_ADMIN_GROUP_ID, `<b>需求單退回紀錄</b>\n${escapeTelegramHtml(group.orderId)}\n處理人：${escapeTelegramHtml(admin)}\n原因：${escapeTelegramHtml(note)}`, process.env.TG_TOPIC_RETURN) && delivered;
    } catch { delivered = false; }
  }
  return delivered;
}

/** Called only after durable complete business verification. Notification failure
 * never changes the business result and never replays the Writer.
 */
export async function notifyV2Mutation(group: OrderGroup, users: unknown[][], intent: string, actor: string, note = ''): Promise<boolean> {
  if (['create-formal', 'submit-draft', 'resubmit-order'].includes(intent)) {
    if (!process.env.TG_ADMIN_GROUP_ID) return false;
    const { orderItemMessages } = await import('./order-message');
    const title = intent === 'resubmit-order' ? '需求單重新送出' : '新材料需求';
    let ok = true;
    for (const message of orderItemMessages(`<b>${title}</b>\n單號：${escapeTelegramHtml(group.orderId)}\n工班：${escapeTelegramHtml(group.first.reqCompany)}\n申請人：${escapeTelegramHtml(actor)}\n需求狀態：待審核`, group.items)) ok = await sendTelegramMessage(process.env.TG_ADMIN_GROUP_ID, message, process.env.TG_TOPIC_NEW_ORDER) && ok;
    return ok;
  }
  if (['create-return', 'replace-current-return', 'complete-review', 'prepare-shipping', 'deliver-orders'].includes(intent)) return notifyOrderProgress([group], group.items, users, group.status, actor, note, group.first.expectedDate);
  return true;
}
