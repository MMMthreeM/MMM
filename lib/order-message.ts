import { escapeTelegramHtml } from '@/lib/telegram-html';
export function orderItemMessages(header: string, items: { materialName: string; quantity: number; unit?: string }[], footer = '') {
  const messages: string[] = [];
  let message = header;
  items.forEach((item, index) => {
    const line = `\n${index + 1}. ${escapeTelegramHtml(item.materialName)}：${item.quantity} ${escapeTelegramHtml(item.unit || '式')}`;
    if (message.length + line.length > 3800) { messages.push(message); message = '<b>需求材料（續）</b>'; }
    message += line;
  });
  if (footer) {
    if (message.length + footer.length + 2 > 3800) { messages.push(message); message = footer; }
    else message += '\n\n' + footer;
  }
  messages.push(message); return messages;
}
