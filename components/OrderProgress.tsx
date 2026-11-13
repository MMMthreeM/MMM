const stages = ['待審核', '審核完畢', '準備出貨', '已送達'];

export default function OrderProgress({ status, returned, verified }: { status: string; returned: boolean; verified: boolean }) {
  const current = verified ? ['處理中', '審核完畢', '準備出貨', '已送達'].indexOf(status) : -1;
  return <section className="request-progress" aria-label="需求進度">
    <h3 className="section-title">處理進度</h3>
    <ol className="request-progress-stages">{stages.map((label, index) => {
      const active = current === index, completed = current > index;
      return <li key={label} className={active ? returned ? 'is-returned' : 'is-current' : completed ? 'is-complete' : ''} aria-current={active ? 'step' : undefined}>
        <span className="progress-marker" aria-hidden="true">{completed ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg> : index + 1}</span>
        <div><strong>{label}</strong><span>{active ? returned ? '退回待修改' : '目前階段' : completed ? '已完成' : '尚未到此階段'}</span></div>
      </li>;
    })}</ol>
    {returned && <p className="field-hint">修改並重新送出後，回到待審核。</p>}
    <p className="field-hint">審核完畢表示材料已核對完成；準備出貨表示等待交貨安排。</p>
  </section>;
}
