import Link from 'next/link';
import { Fragment, type MouseEvent, type ReactNode } from 'react';
import { isReturnedOrder, orderPresentation, type OrderGroup } from '@/lib/order-view';

type Props = {
  groups: OrderGroup[];
  material?: string;
  showCompany?: boolean;
  selectedId?: string;
  hrefFor: (group: OrderGroup) => string;
  onOpen?: (event: MouseEvent<HTMLAnchorElement>, group: OrderGroup) => void;
  draftHrefFor?: (group: OrderGroup) => string | undefined;
  selectionFor?: (group: OrderGroup) => ReactNode;
  actionsFor?: (group: OrderGroup) => ReactNode;
  detailsFor?: (group: OrderGroup) => ReactNode;
};

export default function OrderListTable({ groups, material = '', showCompany = false, selectedId, hrefFor, onOpen, draftHrefFor, selectionFor, actionsFor, detailsFor }: Props) {
  return <div className="order-list-table-wrap table-scroll"><table className="data-table trend-order-table analytics-orders-table order-list-table">
    <thead><tr><th scope="col">送出／更新時間</th><th scope="col">材料需求</th><th scope="col">需求狀態</th><th scope="col"><span className="sr-only">操作</span></th></tr></thead>
    <tbody>{groups.map(group => {
      const presentation = orderPresentation(group), draftHref = draftHrefFor?.(group);
      return <Fragment key={group.orderId}><tr data-analytics-order={onOpen || selectionFor ? undefined : group.orderId} data-order-id={group.orderId} className={onOpen ? `order-card${selectedId === group.orderId ? ' is-selected' : ''}` : undefined}>
        <th scope="row">{selectionFor?.(group)}<time className="order-date">{group.first.orderDate}</time>
          {group.status === '編輯中' && group.first.draftName && <span className="order-list-draft-name">{group.first.draftName}</span>}
          <small className="order-reference">{group.orderId}</small>
          {showCompany && <small className="order-reference">{group.first.reqCompany}</small>}
        </th>
        <td><ul className="analytics-order-materials">{group.items.map((item, index) => <li key={item.lineId || index} className={material && item.materialName !== material ? 'analytics-material-muted' : undefined}>
          <span>{item.materialName}：<span className="analytics-material-quantity"><strong>{item.quantity.toLocaleString('zh-TW')}</strong> <small>{item.unit}</small></span></span>
          {item.remarks && <p className="order-list-remarks">{item.remarks}</p>}
        </li>)}</ul>
          {isReturnedOrder(group) && <p className="card-return">退回原因：{group.first.returnInfo?.reason || group.first.returnNote}</p>}
        </td>
        <td><span className={`status status-${presentation.tone}`}>{presentation.label}</span></td>
        <td className="order-list-actions">{actionsFor ? actionsFor(group) : <Link className={onOpen ? 'data-link order-card-link' : 'data-link'} data-order-focus={group.orderId} href={hrefFor(group)} onClick={event => onOpen?.(event, group)} aria-label={`查看 ${group.first.orderDate} 的需求單 ${group.orderId}`} aria-current={selectedId === group.orderId ? 'true' : undefined}>查看單據</Link>}
          {draftHref && <Link className="data-link" href={draftHref}>開啟草稿</Link>}
        </td>
      </tr>{detailsFor && <tr className="order-list-detail-row"><td colSpan={4}>{detailsFor(group)}</td></tr>}</Fragment>;
    })}</tbody>
  </table></div>;
}
