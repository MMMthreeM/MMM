'use client';
import { useState } from 'react';

export default function SecurityAuditPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const retry = async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/retry-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '補寫失敗，請稍後重試。');
      setMessage(response.headers.get('X-Audit-Status') === 'pending' ? '仍有紀錄待補寫，請確認稽核工作表與服務連線。' : '已完成本次待處理稽核補寫；較多紀錄可再次執行，不會重做訂單操作。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '連線失敗。'); }
    finally { setBusy(false); }
  };
  return <section className="surface mt-8 p-5" aria-labelledby="audit-retry-title"><h2 className="section-title" id="audit-retry-title">稽核紀錄維護</h2><p className="field-hint mt-2">僅補寫待處理紀錄，不會重新送單、變更狀態或再次匯出報表。</p><button type="button" className="btn btn-secondary mt-4" disabled={busy} onClick={() => void retry()}>{busy ? '正在補寫…' : '補寫待處理稽核紀錄'}</button>{message && <p role="status" className="feedback-success mt-3">{message}</p>}{error && <p role="alert" className="feedback-error mt-3">{error}</p>}</section>;
}
