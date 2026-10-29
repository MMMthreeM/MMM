'use client';
export default function LoadingState({ label = '正在載入資料…' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="loading-spinner" aria-hidden="true" /><span>{label}</span><div className="loading-lines" aria-hidden="true"><i /><i /><i /></div></div>;
}
