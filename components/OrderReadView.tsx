import type { OrderGroup } from '@/lib/order-view';
import { isReturnedOrder, orderPresentation } from '@/lib/order-view';

/** Shared reading order for home, history, review and analytics. */
export function OrderSummary({ group, showStatus = true, showCompany = true }: { group: OrderGroup; showStatus?: boolean; showCompany?: boolean }) {
  const presentation = orderPresentation(group);
  return <div className="request-summary">
    <div className="request-summary-heading"><strong>{group.status === '編輯中' ? group.first.draftName || '工班草稿' : group.first.orderDate}</strong>{showStatus && <span className={`status status-${presentation.tone}`}>{presentation.label}</span>}</div>
    <p className="request-summary-meta">{showCompany ? group.first.reqCompany + ' · ' : ''}{group.first.reqUser} · {group.items.length} 筆材料</p>
    <p className="request-summary-preview">{group.items.slice(0, 2).map(item => item.materialName).join('、')}{group.items.length > 2 ? `，另 ${group.items.length - 2} 筆` : ''}</p>
    {isReturnedOrder(group) && <p className="card-return">退回原因：{group.first.returnInfo?.reason || group.first.returnNote}</p>}
    <span className="order-reference">單號：{group.orderId}</span>
  </div>;
}

export function OrderIdentity({ group }: { group: OrderGroup }) {
  return <div className="order-identity">
    <p><time>{group.first.orderDate}</time><span>{group.first.reqCompany}</span><span>{group.first.reqUser}</span></p>
    <span className="order-reference">{group.orderId}</span>
    {group.first.expectedDate && <p className="order-expected-date">預計交期 {group.first.expectedDate}</p>}
  </div>;
}

export function OrderAdminFacts({ group }: { group: OrderGroup }) {
  if (!group.first.reqRegion && !group.first.adminUser) return null;
  return <dl className="request-facts admin-extra-facts">
    {group.first.reqRegion && <div><dt>地區</dt><dd>{group.first.reqRegion}</dd></div>}
    {group.first.adminUser && <div><dt>審核人</dt><dd>{group.first.adminUser}</dd></div>}
  </dl>;
}

export function OrderMaterials({ group, admin = false, material = '' }: { group: OrderGroup; admin?: boolean; material?: string }) {
  return <ol className="request-materials detail-materials">
    {group.items.map((item, index) => {
      const target = group.first.returnInfo?.targets.find(t => (t.currentLineRef?.lineId ?? t.lineRef.lineId) === item.lineId);
      return <li key={item.lineId} id={`detail-line-${item.lineId}`} className={material && material !== item.materialName ? 'request-material-muted' : undefined}>
        <div className="request-material-main"><strong className="request-material-name"><span className="material-position">{index + 1}.</span> {item.materialName}</strong><p className="request-material-quantity"><strong>{item.quantity.toLocaleString('zh-TW')} <small>{item.unit}</small></strong></p></div>
        {item.remarks && <p className="material-remarks"><span>備註</span>{item.remarks}</p>}
        {target && <p className="material-return-reason">退回原因：{target.reason ?? group.first.returnInfo!.reason}</p>}
        {admin && <div className="request-material-admin"><span>廠商：{item.vendor || '未指定廠商'}</span><span>{item.effectiveReview === 'confirmed' ? '材料已確認' : '確認待處理'}</span>{item.adminNote && <p className="material-return-reason">管理備註：{item.adminNote}</p>}</div>}
      </li>;
    })}
  </ol>;
}
