import Link from 'next/link';
import { orderPresentation, type OrderGroup } from '@/lib/order-view';

export default function AnalyticsOrders({ groups, admin, material }: { groups: OrderGroup[]; admin: boolean; material: string }) {
  return <div className="table-scroll"><table className="data-table trend-order-table analytics-orders-table">
    <thead><tr><th scope="col">送出／更新時間</th><th scope="col">材料需求</th><th scope="col">目前進度</th><th scope="col">操作</th></tr></thead>
    <tbody>{groups.map(group => {
      const presentation = orderPresentation(group);
      return <tr key={group.orderId} data-analytics-order={group.orderId}>
        <th scope="row"><time className="order-date">{group.first.orderDate}</time><small className="order-reference">單號：{group.orderId}</small>{admin && <small className="order-reference analytics-order-company">{group.first.reqCompany}</small>}<small className="order-reference">{group.items.length} 筆材料</small></th>
        <td><ul className="analytics-order-materials">{group.items.map((row, index) => <li key={index} className={material && row.materialName !== material ? 'analytics-material-muted' : ''}><span>{row.materialName}：<span className="analytics-material-quantity"><strong>{row.quantity.toLocaleString('zh-TW')}</strong> <small>{row.unit}</small></span></span></li>)}</ul></td>
        <td><span className={`status status-${presentation.tone}`}>{presentation.label}</span></td>
        <td><Link className="btn btn-quiet" href={`${admin ? '/admin' : '/dashboard'}?order=${encodeURIComponent(group.orderId)}`} aria-label={`查看 ${group.first.orderDate} 的需求單 ${group.orderId}`}>查看單據</Link></td>
      </tr>;
    })}</tbody>
  </table></div>;
}
