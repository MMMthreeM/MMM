import Link from 'next/link';
import { Fragment, type MouseEvent, type ReactNode } from 'react';
import { isReturnedOrder, orderPresentation, type OrderGroup } from '@/lib/order-view';
import { orderListPreview } from '@/lib/order-list-preview';

type Props = {
  groups: OrderGroup[];
  material?: string;
  search?: string;
  showCompany?: boolean;
  selectedId?: string;
  hrefFor: (group: OrderGroup) => string;
  onOpen?: (event: MouseEvent<HTMLAnchorElement>, group: OrderGroup) => void;
  draftHrefFor?: (group: OrderGroup) => string | undefined;
  selectionFor?: (group: OrderGroup) => ReactNode;
  actionsFor?: (group: OrderGroup) => ReactNode;
  expandedFor?: (group: OrderGroup) => boolean;
  detailsFor?: (group: OrderGroup) => ReactNode;
};

export default function OrderListTable({ groups, material = '', search = '', showCompany = false, selectedId, hrefFor, onOpen, draftHrefFor, selectionFor, actionsFor, expandedFor, detailsFor }: Props) {
  return <div className="order-list-table-wrap table-scroll"><table className={`data-table order-list-table${showCompany ? ' has-company' : ''}`} aria-label="需求單列表">
    <thead><tr><th scope="col" className="order-list-date">送出／更新時間</th>{showCompany && <th scope="col" className="order-list-company">工班</th>}<th scope="col">材料摘要</th><th scope="col" className="order-list-status">需求狀態</th><th scope="col" className="order-list-actions"><span className="sr-only">操作</span></th></tr></thead>
    <tbody>{groups.map(group => {
      const presentation = orderPresentation(group), draftHref = draftHrefFor?.(group);
      const preview = orderListPreview(group, material, search);
      return <Fragment key={group.orderId}><tr data-analytics-order={onOpen || selectionFor ? undefined : group.orderId} data-order-id={group.orderId} className={onOpen ? `order-card${selectedId === group.orderId ? ' is-selected' : ''}` : undefined}>
        <th scope="row" className="order-list-date"><div className="order-list-identity">{selectionFor?.(group)}<time className="order-date">{group.first.orderDate}</time></div>
          {group.status === '編輯中' && group.first.draftName && <span className="order-list-draft-name">{group.first.draftName}</span>}
          <small className="order-reference">{group.orderId}</small>
        </th>
        {showCompany && <td className="order-list-company">{group.first.reqCompany}</td>}
        <td className="order-list-preview">{expandedFor?.(group) ? <p className="order-list-more">{group.items.length} 筆材料</p> : <><ul className="analytics-order-materials">{preview.map((item, index) => <li key={item.lineId || index}>
          <span className="order-list-material-name">{item.materialName}</span><span className="analytics-material-quantity"><strong>{item.quantity.toLocaleString('zh-TW')}</strong> <small>{item.unit}</small></span>
        </li>)}</ul>
          {group.items.length > preview.length && <p className="order-list-more">另 {group.items.length - preview.length} 筆</p>}
        </>}{isReturnedOrder(group) && <p className="card-return">退回原因：{group.first.returnInfo?.reason || group.first.returnNote}</p>}
        </td>
        <td className="order-list-status"><span className={`status status-${presentation.tone}`}>{presentation.label}</span></td>
        <td className="order-list-actions">{actionsFor ? actionsFor(group) : <Link className={onOpen ? 'data-link order-card-link' : 'data-link'} data-order-focus={group.orderId} href={hrefFor(group)} onClick={event => onOpen?.(event, group)} aria-label={`查看 ${group.first.orderDate} 的需求單 ${group.orderId}`} aria-current={selectedId === group.orderId ? 'true' : undefined}>查看單據</Link>}
          {draftHref && <Link className="data-link" href={draftHref}>開啟草稿</Link>}
        </td>
      </tr>{detailsFor && <tr className="order-list-detail-row"><td colSpan={showCompany ? 5 : 4}>{detailsFor(group)}</td></tr>}</Fragment>;
    })}</tbody>
  </table></div>;
}
