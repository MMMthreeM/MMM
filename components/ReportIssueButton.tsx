'use client';
import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function ReportIssueButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return alert('請填寫問題描述！');
    setIsSubmitting(true);

    try {
      const currentUrl = window.location.href;

      // 1. 靜靜地寫入 Sentry 後台，方便開發者查閱 Log
      Sentry.captureMessage(`[使用者回報] ${description}`, {
        level: 'warning',
        extra: { url: currentUrl }
      });

      // 2. 呼叫後端 API，推播至 Telegram 管理員群組
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, url: currentUrl })
      });

      if (res.ok) {
        alert('✅ 感謝您的回報！開發團隊已收到通知。');
        setIsOpen(false);
        setDescription('');
      } else {
        alert('❌ 傳送失敗，請稍後再試。');
      }
    } catch {
      alert('❌ 發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 💡 右下角懸浮按鈕 */}
      <button 
        onClick={() => setIsOpen(true)} 
        className="report-issue-trigger fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#163047] px-4 py-3 text-white shadow-[0_8px_20px_rgba(22,48,71,.24)] transition-colors hover:bg-[#0c2437]"
        title="回報系統問題"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
        <span className="hidden pr-1 text-sm font-bold md:inline">回報問題</span>
      </button>

      {/* 💡 回報彈出視窗 (Modal) */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between bg-[#163047] p-4 text-white">
              <h2 className="text-lg font-bold">系統問題回報</h2>
              <button onClick={() => setIsOpen(false)} className="text-xl font-bold text-white/70 hover:text-white" aria-label="關閉">×</button>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-3">
                如果您遇到畫面卡住、錯誤訊息，或有任何建議，請在下方描述您的狀況：
              </p>
              <textarea
                className="form-control h-32 resize-none"
                placeholder="例如：我在送出草稿時，畫面一直轉圈圈..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div className="flex justify-end gap-2 border-t border-[var(--line)] bg-[#f7fafb] p-4">
              <button 
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="btn btn-secondary disabled:opacity-50"
              >
                取消
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || !description.trim()}
                className="btn btn-primary disabled:opacity-50"
              >
                {isSubmitting ? '傳送中...' : '送出回報'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
