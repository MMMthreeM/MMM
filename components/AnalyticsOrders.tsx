import Link from 'next/link';
import type { OrderGroup } from '@/lib/order-view';
import { OrderSummary, OrderMaterials } from './OrderReadView';

export default function AnalyticsOrders({ groups, admin, material }: { groups: OrderGroup[]; admin: boolean; material: string }) {
  return <div className="request-list analytics-request-list">{groups.map(group => <article key={group.orderId} data-analytics-order={group.orderId}>
    <Link className="order-card-link" href={`${admin ? '/admin' : '/dashboard'}?order=${encodeURIComponent(group.orderId)}`} aria-label={`查看 ${group.first.orderDate} 的需求單 ${group.orderId}`}><OrderSummary group={group}/><span className="card-open">查看單據</span></Link>
    <details className="analytics-material-details"><summary>查看完整材料 · {group.items.length} 筆</summary><OrderMaterials group={group} material={material}/></details>
  </article>)}</div>;
}
