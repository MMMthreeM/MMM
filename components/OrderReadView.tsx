import type { OrderGroup } from '@/lib/order-view';
import { isReturnedOrder, orderPresentation } from '@/lib/order-view';

/** Shared reading order for home, history, review and analytics. */
export function OrderSummary({ group, showStatus = true }: { group: OrderGroup; showStatus?: boolean }) {
  const presentation = orderPresentation(group);
  return <div className="request-summary">
    <div className="request-summary-heading"><strong>{group.status === '編輯中' ? group.first.draftName || '工班草稿' : group.first.orderDate}</strong>{showStatus && <span className={`status status-${presentation.tone}`}>{presentation.label}</span>}</div>
    <p className="request-summary-meta">{group.first.reqCompany} · {group.first.reqUser} · {group.items.length} 筆材料</p>
    <p className="request-summary-preview">{group.items.slice(0, 2).map(item => item.materialName).join('、')}{group.items.length > 2 ? `，另 ${group.items.length - 2} 筆` : ''}</p>
    {isReturnedOrder(group) && <p className="card-return">退回原因：{group.first.returnInfo?.reason || group.first.returnNote}</p>}
    <span className="order-reference">單號：{group.orderId}</span>
  </div>;
}

export function OrderFacts({ group, admin = false }: { group: OrderGroup; admin?: boolean }) {
  return <dl className="request-facts">
    <div><dt>需求日期</dt><dd>{group.first.orderDate}</dd></div>
    <div><dt>請購工班</dt><dd>{group.first.reqCompany}</dd></div>
    <div><dt>申請人</dt><dd>{group.first.reqUser}</dd></div>
    {admin && group.first.reqRegion && <div><dt>地區</dt><dd>{group.first.reqRegion}</dd></div>}
    {admin && group.first.adminUser && <div><dt>審核人</dt><dd>{group.first.adminUser}</dd></div>}
    {group.first.expectedDate && <div><dt>預計交期</dt><dd>{group.first.expectedDate}</dd></div>}
    <div className="request-facts-reference"><dt>單號</dt><dd>{group.orderId}</dd></div>
  </dl>;
}

export function OrderMaterials({ group, admin = false, material = '' }: { group: OrderGroup; admin?: boolean; material?: string }) {
  return <ol className="request-materials detail-materials">
    {group.items.map((item, index) => {
      const target = group.first.returnInfo?.targets.find(t => (t.currentLineRef?.lineId ?? t.lineRef.lineId) === item.lineId);
      return <li key={item.lineId} id={`detail-line-${item.lineId}`} className={material && material !== item.materialName ? 'request-material-muted' : undefined}>
        <div className="request-material-main"><strong className="request-material-name"><span className="material-position">{index + 1}.</span> {item.materialName}</strong><p className="request-material-quantity"><span>需求數量</span><strong>{item.quantity.toLocaleString('zh-TW')} <small>{item.unit}</small></strong></p></div>
        {item.remarks && <p className="material-remarks"><span>備註</span>{item.remarks}</p>}
        {target && <p className="material-return-reason">退回原因：{target.reason ?? group.first.returnInfo!.reason}</p>}
        {admin && <div className="request-material-admin"><span>廠商：{item.vendor || '未指定廠商'}</span><span>{item.effectiveReview === 'confirmed' ? '材料已確認' : '確認待處理'}</span>{item.adminNote && <p className="material-return-reason">管理備註：{item.adminNote}</p>}</div>}
      </li>;
    })}
  </ol>;
}
