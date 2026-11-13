import { orderStatusLabel } from '@/lib/order-status';
import type { SevenContent } from './order-change-set';
import type { PermanentLineRef } from './order-identity';
export type PublicHistoryEvent = { eventId: string; eventType: string; actor: string; at: string; statusBefore: string | null; statusAfter: string | null; reason: string | null; returnTargets?:{lineRef:PermanentLineRef;mcf:string;name:string|null;reason:string}[]; closureCause?: 'replaced'|'resubmitted'; introducedCount?:number;retiredCount?:number; targetResolutions: { outcome: string; sourceLineRef: PermanentLineRef; resultLineRefs: readonly PermanentLineRef[]; reason: string }[] };
export type CrewOption = { company: string; region: string };
export type Account = { email: string; role: 'Admin' | 'User'; company: string; region: string; name: string; crews?: CrewOption[] };

export type OrderRow = {
  lineId: string; returnNote: string;
  orderId: string; orderDate: string; reqUser: string; reqCompany: string; reqRegion: string;
  materialName: string; quantity: number; unit: string; remarks: string; vendor: string;
  status: string; adminNote: string; draftName: string; adminUser: string; expectedDate: string;
  catalogId?: string; originalMaterialName?: string;
  mcf?: string; lineRef?: { kind: 'permanent'; orderId: string; lineId: string }; content?: SevenContent;
  originalContent?:SevenContent;
  activeReturnRef?: string; effectiveReview?: string; sourceKind?: string; resolutionKind?: string;
  returnInfo?: { eventId: string; reason: string; scope: string; targets: { lineRef: PermanentLineRef; mcf: string; reason: string | null; name?: string; currentLineRef?: PermanentLineRef | null }[] };
  history?: PublicHistoryEvent[];
  readState?: 'verified' | 'unverified';
};
export type OrderGroup = { orderId: string; items: OrderRow[]; status: string; consistent: boolean; first: OrderRow };
export type OrderFilters = { company?: string; region?: string; vendor?: string; material?: string; status?: string; startDate?: string; endDate?: string; search?: string };

export function isReturnedOrder(group: OrderGroup) {
  return group.consistent && group.status === '處理中' && group.items.every(item => item.readState !== 'unverified' && item.activeReturnRef?.startsWith('event:'));
}

export function orderPresentation(group: OrderGroup) {
  if (!group.consistent) return { label: group.items.some(i => i.readState === 'unverified') ? '資料待核實' : '資料狀態不一致', tone: 'returned' };
  if (isReturnedOrder(group)) return { label: orderStatusLabel(group.status, true), tone: 'returned' };
  const statuses: Record<string, { label: string; tone: string }> = {
    編輯中: { label: '草稿', tone: 'draft' }, 處理中: { label: '待審核', tone: 'processing' },
    審核中: { label: '審核中', tone: 'review' }, 準備出貨: { label: '準備出貨', tone: 'shipping' },
    審核完畢: { label: '審核完畢', tone: 'review' },
    已送達: { label: '已送達', tone: 'delivered' },
  };
  return { label: orderStatusLabel(group.status), tone: statuses[group.status]?.tone || 'draft' };
}

export function groupOrders(rows: OrderRow[]): OrderGroup[] {
  const groups = new Map<string, OrderRow[]>();
  for (const row of rows) {
    if (!row.orderId) continue;
    const items = groups.get(row.orderId) ?? [];
    items.push(row);
    groups.set(row.orderId, items);
  }
  return [...groups].map(([orderId, items]) => ({ orderId, items, first: items[0], status: items[0].status, consistent: items.every((item) => item.readState !== 'unverified' && item.status === items[0].status && item.reqCompany === items[0].reqCompany && item.activeReturnRef === items[0].activeReturnRef) }));
}

// Select complete orders, so a material search never hides selected order lines.
export function filterOrderGroups(groups: OrderGroup[], filters: OrderFilters) {
  return groups.filter((group) => {
    const { first, items, orderId } = group;
    const date = first.orderDate.slice(0, 10);
    const search = (filters.search || '').trim().toLowerCase();
    const dateQuery = search.replace(/[/.]/g, '-');
    const isDateQuery = /^\d{4}-\d{2}(?:-\d{2})?$/.test(dateQuery) || /^\d{6}(?:\d{2})?$/.test(search);
    const matchesSearch = !search || (isDateQuery
      ? date.includes(dateQuery) || date.replace(/-/g, '').includes(search)
      : orderId.toLowerCase().includes(search) || first.orderDate.toLowerCase().includes(dateQuery) || items.some(item => item.materialName.toLowerCase().includes(search)));
    return (!filters.company || first.reqCompany === filters.company)
      && (!filters.region || first.reqRegion === filters.region)
      && (!filters.status || (['待審核', '退回待修改'].includes(filters.status) ? orderPresentation(group).label === filters.status : items.every((item) => item.status === filters.status)))
      && (!filters.vendor || items.some((item) => item.vendor === filters.vendor))
      && (!filters.material || items.some((item) => item.materialName === filters.material))
      && (!filters.startDate || date >= filters.startDate)
      && (!filters.endDate || date <= filters.endDate)
      && matchesSearch;
  });
}

export function waitingDays(date: string, now = Date.now()) {
  const time = Date.parse(`${date.replace(' ', 'T')}${date.includes('+') || date.endsWith('Z') ? '' : '+08:00'}`);
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 86400000)) : 0;
}

export function summarizeMaterials(rows: OrderRow[]) {
  const map = new Map<string, { name: string; unit: string; quantity: number; orders: Set<string> }>();
  for (const row of rows) {
    const key = JSON.stringify([row.materialName, row.unit]);
    const entry = map.get(key) ?? { name: row.materialName, unit: row.unit, quantity: 0, orders: new Set<string>() };
    entry.quantity += Number(row.quantity) || 0;
    entry.orders.add(row.orderId);
    map.set(key, entry);
  }
  return [...map.values()].map(({ orders, ...entry }) => ({ ...entry, frequency: orders.size })).sort((a, b) => b.frequency - a.frequency || a.name.localeCompare(b.name, 'zh-TW'));
}
