'use client';
export default function BackToTop() {
  return <div className="back-to-top"><button type="button" className="btn btn-secondary" onClick={() => { document.getElementById('app-top')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 12 6-6 6 6M12 6v14" /></svg>返回最上方</button></div>;
}
