import { matchMaterial, type MaterialRule, type OrderItemInput } from '@/lib/order-domain';
import type { QuantityPolicy } from './order-change-set';
import { canonicalVendor, canonicalMaterialText, materialIdentity } from '@/lib/material-identity';

export const PROCUREMENT_VENDORS = ['伸泰', '益詮', '賀冠'] as const;
export type ProcurementItem = OrderItemInput & { catalogId?: string };
export const REPORT_QUANTITY_POLICY: QuantityPolicy = Object.freeze({ policyRef: 'mmm-report-quantity:v2', basisRef: 'mmm-report-quantity:v2', scale: 6, minTicks: '1', maxTicks: '9007199254740991', stepTicks: '1', stepAnchor: 'zero' });
export function procurementRule(rules: MaterialRule[], item: ProcurementItem) {
  const id = item.originalId || item.catalogId;
  if (id && id !== 'other') return rules.find(rule => rule.id === id);
  const exact = matchMaterial(rules, item);
  if (exact) return exact;
  const matches = rules.filter(rule => materialIdentity({ materialName: rule.name, unit: rule.unit, vendor: rule.vendor }) === materialIdentity(item));
  return matches.length === 1 ? matches[0] : undefined;
}
export function validateProcurementItems(items: unknown, rules: MaterialRule[], requireVendor = false, exactQuantity?: (value: number, rule?: MaterialRule) => boolean) {
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
    if (typeof item.materialName !== 'string' || !item.materialName.trim() || item.materialName.length > 200 || item.unit.length > 30 || (item.remarks !== undefined && (typeof item.remarks !== 'string' || item.remarks.length > 500))) return '材料名稱、單位或備註格式不正確。';
    if (exactQuantity ? !exactQuantity(item.quantity, rule) : !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || rule && (item.quantity < rule.minQty || item.quantity % rule.stepQty !== 0)) return rule ? `「${rule.name}」數量須至少 ${rule.minQty}，且為 ${rule.stepQty} 的倍數並符合精度規則。` : '材料數量必須為有效正數並符合精度規則。';
    if (rule && (canonicalMaterialText(item.materialName) !== canonicalMaterialText(rule.name) || canonicalMaterialText(item.unit) !== canonicalMaterialText(rule.unit))) return '材料規格已變更，請重新確認。';
    if (rule?.requiresRemarks && !item.remarks?.trim()) return '混合材料請填寫品項與數量備註。';
  }
  return null;
}
