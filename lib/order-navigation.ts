// Presentation/navigation only. These values never authorize a mutation.
import { isReturnedOrder, type OrderGroup } from './order-view';
// Ephemeral client toast, populated only after the caller receives confirmed.
// Never used as writer evidence or persisted as business state.
let confirmedFeedback:string|null=null;
const feedbackListeners=new Set<()=>void>();
export function publishConfirmedFeedback(message:string){confirmedFeedback=message;feedbackListeners.forEach(listener=>listener());}
export function subscribeConfirmedFeedback(listener:()=>void){feedbackListeners.add(listener);return()=>{feedbackListeners.delete(listener);};}
export function readConfirmedFeedback(){return confirmedFeedback;}
export function takeConfirmedFeedback(){const result=confirmedFeedback;confirmedFeedback=null;return result;}
export type CrewTab = 'active' | 'draft' | 'archive';
export function crewTab(group: OrderGroup): CrewTab { return group.status === '編輯中' ? 'draft' : group.status === '已送達' ? 'archive' : 'active'; }
export function safeReturnTo(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !/^\/(?:dashboard(?:\/detail)?|request|admin)?(?:\?|$)/.test(value) || /[\\\r\n]/.test(value)) return fallback;
  return value;
}
export function orderMatches(group: OrderGroup, query: string): boolean {
  const tokens = query.trim().toLocaleLowerCase('zh-TW').split(/\s+/).filter(Boolean);
  const text = [group.orderId, group.first.orderDate, group.first.orderDate.replaceAll('-', '/'), group.first.orderDate.slice(0,10).replaceAll('-',''), group.first.draftName, ...group.items.map(i => i.materialName)].join(' ').toLocaleLowerCase('zh-TW');
  return tokens.every(token => text.includes(token));
}
export function crewOrderSort(a: OrderGroup, b: OrderGroup, sort: string): number {
  if (sort === 'priority') {
    const priority = (g: OrderGroup) => !g.consistent ? 0 : isReturnedOrder(g) ? 1 : 2;
    const difference = priority(a) - priority(b); if (difference) return difference;
  }
  return (sort === 'asc' ? 1 : -1) * a.first.orderDate.localeCompare(b.first.orderDate) || a.orderId.localeCompare(b.orderId);
}
export function detailHref(orderId: string, returnTo = '/dashboard'): string { return `/dashboard/detail?order=${encodeURIComponent(orderId)}&returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`; }
export function editHref(orderId: string, action: 'edit' | 'reorder', returnTo: string): string { return `/request?loadOrderId=${encodeURIComponent(orderId)}&action=${action}&returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`; }
export function completedOrderHref(orderId:string,returnTo:string,resubmitted=false):string {
  const source=new URL(safeReturnTo(returnTo),'http://local.invalid');
  const query=source.pathname==='/dashboard'?new URLSearchParams(source.search):new URLSearchParams();
  query.set('order',orderId);if(resubmitted){query.set('tab','active');query.delete('status');query.set('resubmitted','1');}
  return '/dashboard?'+query.toString();
}
export function saveListPosition(url: string, focus: string) {
  try { sessionStorage.setItem('mmm-list-position:' + url, JSON.stringify({ y: window.scrollY, focus })); } catch { /* UI preference storage can be unavailable. */ }
}
export function restoreListPosition(url: string) {
  try { const item = JSON.parse(sessionStorage.getItem('mmm-list-position:' + url) || 'null'); if (!item || !Number.isFinite(item.y)) return;
    requestAnimationFrame(() => { const element = Array.from(document.querySelectorAll<HTMLElement>('[data-order-focus]')).find(e => e.dataset.orderFocus === item.focus); element?.focus({ preventScroll: true }); window.scrollTo({ top: Math.max(0, item.y), behavior: 'instant' }); });
  } catch { /* Not business data. */ }
}
