import Link from 'next/link';

export default function WorkQueue({ items, label }: { label: string; items: { label: string; count: number; href: string }[] }) {
  return <section className={`work-queue ${items.length === 5 ? 'work-queue-five' : ''}`} aria-label={label}>{items.map(item => <Link key={item.label} href={item.href}>
    <div><span className="work-queue-label">{item.label}</span></div><strong>{item.count}<small> 張</small></strong>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m7 4 6 8-6 8" /></svg>
  </Link>)}</section>;
}
