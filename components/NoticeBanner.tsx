'use client';
import { useState, useEffect } from 'react';

export default function NoticeBanner() {
  const [notices, setNotices] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetch('/api/notices')
      .then(res => res.json())
      .then(data => {
        if (data.data && data.data.length > 0) {
          setNotices(data.data);
        }
      })
      .catch(err => console.error('無法載入公告', err));
  }, []);

  // 如果沒有公告，或者使用者按了關閉，就不顯示
  if (!isVisible || notices.length === 0) return null;

  return (
    <div className="notice-banner"><div className="notice-banner-inner">
      <div className="flex flex-col gap-1 flex-1">
        {notices.map((notice, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm font-bold">
            <span className="h-2 w-2 rounded-full bg-[#d9a300]" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        ))}
      </div>
      <button 
        onClick={() => setIsVisible(false)} 
        className="ml-4 px-2 font-bold text-[#9a7000] hover:text-[#5d4300]"
        title="關閉公告"
        aria-label="關閉公告"
      >
        ✕
      </button>
    </div></div>
  );
}
