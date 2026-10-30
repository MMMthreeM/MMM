'use client';
import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function ReportIssueButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(false), 6000);
    return () => window.clearTimeout(timer);
  }, [sent]);
  useEffect(() => { if (isOpen) dialog.current?.showModal(); else dialog.current?.close(); }, [isOpen]);
  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!description.trim()) { setError('請描述遇到的問題。'); descriptionInput.current?.focus(); return; }
    setIsSubmitting(true); setError('');
    try {
      const currentUrl = window.location.href;
      Sentry.captureMessage(`[使用者回報] ${description}`, { level: 'warning', extra: { url: currentUrl } });
      const response = await fetch('/api/report-issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description, url: currentUrl }) });
      if (!response.ok) throw new Error('回報未送出，請保留內容並稍後重試。');
      setSent(true); setIsOpen(false); setDescription('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '連線中斷，請稍後重試。');
      descriptionInput.current?.focus();
    } finally { setIsSubmitting(false); }
  };
  return <>
    <div className="footer-tool">
      {sent && <p className="report-sent" role="status">問題回報已送出。</p>}
      <button type="button" className="report-issue-trigger" onClick={() => { setError(''); setSent(false); setIsOpen(true); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" /></svg>
        回報問題
      </button>
    </div>
    <dialog ref={dialog} className="action-dialog report-dialog" aria-labelledby="report-title" onCancel={(event) => { if (isSubmitting) event.preventDefault(); else setIsOpen(false); }}>
      <form noValidate onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
        <h2 id="report-title" className="section-title" tabIndex={-1} autoFocus>回報系統問題</h2>
        <p className="field-hint mt-3">請寫下操作步驟與遇到的狀況，系統會附上目前頁面。</p>
        <label className="mt-5 block"><span className="form-label">問題描述</span><textarea ref={descriptionInput} className="form-control h-32" name="description" autoComplete="off" maxLength={1500} aria-invalid={Boolean(error)} aria-describedby={error ? 'report-error' : undefined} placeholder="例如：送出草稿後，畫面沒有更新…" value={description} disabled={isSubmitting} onChange={(event) => setDescription(event.target.value)} /></label>
        {error && <p id="report-error" className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" className="btn btn-secondary" disabled={isSubmitting} onClick={() => setIsOpen(false)}>取消</button><button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? '傳送中…' : '送出回報'}</button></div>
      </form>
    </dialog>
  </>;
}
