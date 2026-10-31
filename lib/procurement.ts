import { matchMaterial, validateItems, type MaterialRule, type OrderItemInput } from '@/lib/order-domain';
import { canonicalVendor, materialIdentity } from '@/lib/material-identity';

export const PROCUREMENT_VENDORS = ['伸泰', '益詮', '賀冠'] as const;
export type ProcurementItem = OrderItemInput & { catalogId?: string };
export function procurementRule(rules: MaterialRule[], item: ProcurementItem) {
  const id = item.originalId || item.catalogId;
  if (id && id !== 'other') return rules.find(rule => rule.id === id);
  const exact = matchMaterial(rules, item);
  if (exact) return exact;
  const matches = rules.filter(rule => materialIdentity({ materialName: rule.name, unit: rule.unit, vendor: rule.vendor }) === materialIdentity(item));
  return matches.length === 1 ? matches[0] : undefined;
}
export function validateProcurementItems(items: unknown, rules: MaterialRule[], requireVendor = false) {
  if (!Array.isArray(items) || !items.length || items.length > 100) return '請提供 1 至 100 筆材料。';
  for (const item of items as ProcurementItem[]) {
    if (!item || typeof item.vendor !== 'string') return '請確認材料與供應廠商資料。';
    const vendor = canonicalVendor(item.vendor);
    if (vendor && vendor !== '未指定' && !PROCUREMENT_VENDORS.some(value => value === vendor)) return '供應廠商僅能選擇伸泰、益詮或賀冠。';
    if (requireVendor && !PROCUREMENT_VENDORS.some(value => value === vendor)) return `「${item.materialName}」尚未指定供應廠商，請使用材料／廠商對應。`;
    const id = item.originalId || item.catalogId;
    const rule = procurementRule(rules, item);
    if (id && id !== 'other' && !rule) return '材料資料已變更，請重新對應材料。';
    if (typeof item.unit !== 'string' || !item.unit.trim()) return `「${item.materialName}」請填寫材料單位。`;
    const error = validateItems([{ ...item, materialName: rule && !id ? rule.name : item.materialName, unit: rule && !id ? rule.unit : item.unit, originalId: rule?.id || 'other', vendor: rule?.vendor || item.vendor }], rules);
    if (error) return error;
  }
  return null;
}
