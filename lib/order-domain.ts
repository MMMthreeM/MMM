import { headerColumn, materialColumns } from '@/lib/sheet-table';
import { materialIdentity } from '@/lib/material-identity';
export const ORDER_STATUSES = ['編輯中', '處理中', '審核中', '準備出貨', '已送達'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type MaterialRule = {
  id: string;
  name: string;
  vendor: string;
  unit: string;
  minQty: number;
  stepQty: number;
  requiresRemarks?: boolean;
};

export type OrderItemInput = {
  materialName: string;
  quantity: number;
  unit?: string;
  vendor?: string;
  remarks?: string;
  originalId?: string;
};

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && ORDER_STATUSES.includes(value as OrderStatus);

export const isUserEditableStatus = (status: string) => status === '編輯中' || status === '處理中';

export const canUserMoveStatus = (from: string, to: string) =>
  (from === '編輯中' && (to === '編輯中' || to === '處理中')) ||
  (from === '處理中' && to === '處理中');

export const canAdminMoveStatus = (from: string, to: OrderStatus) => {
  if (to === '處理中') return from === '審核中' || from === '準備出貨';
  if (to === '審核中') return from === '處理中';
  if (to === '準備出貨') return from === '審核中';
  if (to === '已送達') return from === '準備出貨';
  return false;
};

export function findColumn(headers: string[], aliases: string[]) {
  return headerColumn(headers, aliases);
}

export function columnLetter(index: number) {
  let output = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

export function toMaterialRules(rows: unknown[][]): MaterialRule[] {
  const c = materialColumns(rows);
  return rows.slice(1).map((row) => ({
    id: String(row[c.id] ?? ''), name: String(row[c.name] ?? '').trim(), vendor: String(row[c.vendor] ?? '').trim(),
    unit: String(row[c.unit] ?? '').trim(), minQty: Number.parseInt(String(row[c.min] ?? ''), 10) || 1,
    stepQty: Number.parseInt(String(row[c.step] ?? ''), 10) || 1,
    requiresRemarks: c.remarks >= 0 && ['true', '1', 'yes'].includes(String(row[c.remarks]).trim().toLowerCase()),
  })).filter((material) => material.id && material.name);
}

export function matchMaterial<T extends MaterialRule>(rules: T[], item: { materialName: string; vendor?: string; unit?: string }) {
  const matches = rules.filter((rule) => rule.name === item.materialName && rule.vendor === item.vendor && rule.unit === item.unit);
  return matches.length === 1 ? matches[0] : undefined;
}

export function validateItems(items: unknown, rules: MaterialRule[]) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) return '請至少提供一項、至多 100 項材料。';
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  for (const item of items as OrderItemInput[]) {
    if (!item || typeof item.materialName !== 'string' || !item.materialName.trim() || item.materialName.length > 200) return '材料名稱必填，且限 200 字內。';
    const quantity = Number(item.quantity);
    if (typeof item.quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0) return `「${item.materialName}」的數量必須是正整數。`;
    if ((item.unit !== undefined && (typeof item.unit !== 'string' || item.unit.length > 30)) || (item.vendor !== undefined && (typeof item.vendor !== 'string' || item.vendor.length > 100))) return '單位或廠商資料格式不正確。';
    if (item.originalId !== undefined && typeof item.originalId !== 'string') return '材料識別格式不正確。';
    const isCustom = item.originalId === 'other';
    if (isCustom && rules.some(rule => materialIdentity({ materialName: rule.name, unit: rule.unit, vendor: rule.vendor }) === materialIdentity(item))) return '此材料已列於材料清單，請從清單選取以套用正確規格。';
    const material = item.originalId ? byId.get(item.originalId) : matchMaterial(rules, item);
    if (!isCustom && !material) return `找不到「${item.materialName}」的材料資料。請重新選擇材料。`;
    if (material) {
      if (material.requiresRemarks && (typeof item.remarks !== 'string' || !item.remarks.trim())) return '混合材料請填寫各項品項、規格與數量備註。';
      if (quantity < material.minQty || quantity % material.stepQty !== 0) {
        return `「${material.name}」數量須至少 ${material.minQty}，且為 ${material.stepQty} 的倍數。`;
      }
      if (item.materialName !== material.name || item.unit !== material.unit || item.vendor !== material.vendor) {
        return `「${material.name}」資料已更新，請重新加入清單。`;
      }
    }
    if (typeof item.remarks !== 'undefined' && (typeof item.remarks !== 'string' || item.remarks.length > 500)) return '備註限 500 字內。';
  }
  return null;
}
