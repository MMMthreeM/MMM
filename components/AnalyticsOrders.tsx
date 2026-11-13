import type { OrderGroup } from '@/lib/order-view';
import OrderListTable from './OrderListTable';

export default function AnalyticsOrders({ groups, admin, material }: { groups: OrderGroup[]; admin: boolean; material: string }) {
  return <OrderListTable groups={groups} showCompany={admin} material={material} hrefFor={group => `${admin ? '/admin' : '/dashboard'}?order=${encodeURIComponent(group.orderId)}`} />;
}
