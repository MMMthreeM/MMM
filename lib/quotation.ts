import { canonicalVendor } from '@/lib/material-identity';
import type { OrderGroup } from '@/lib/order-view';

export function quotationText(groups: OrderGroup[]) {
  const selected = groups.filter(group => group.items.some(item => canonicalVendor(item.vendor) === '賀冠'));
  if (!selected.length) return '';
  return ['賀冠詢價需求', ...selected.map(group => [
    `工班：${group.first.reqCompany}`, `單號：${group.orderId}`,
    ...group.items.filter(item => canonicalVendor(item.vendor) === '賀冠').map((item, index) => `${index + 1}. ${item.materialName}：${item.quantity.toLocaleString('zh-TW')} ${item.unit}${item.remarks ? `\n備註：${item.remarks}` : ''}`),
  ].join('\n'))].join('\n\n');
}
