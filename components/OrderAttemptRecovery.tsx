'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount } from './AppShell';
import { detailHref } from '@/lib/order-navigation';
import { contentText, submissionDisposition } from '@/lib/order-form-state';
import { parseAttemptRecovery, type AttemptRecovery } from '@/lib/order-attempt-recovery';

export function useAttemptRecovery(target: string) {
  const account = useAccount();
  const scope = account ? JSON.stringify([account.email, account.company, account.role, target]) : '';
  const [loaded, setLoaded] = useState<{ scope: string; storageKey: string; record: AttemptRecovery | null; invalid: boolean }>({ scope: '', storageKey: '', record: null, invalid: false });
  useEffect(() => {
    let active = true;
    if (!scope) return;
    void crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope)).then(digest => {
      const storageKey = 'mmm-attempt-display:v1:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      let raw: string | null = null;
      try { raw = sessionStorage.getItem(storageKey); } catch { /* Saving will reject before business submission if storage is unavailable. */ }
      if (active) { const record = raw ? parseAttemptRecovery(raw, storageKey) : null; setLoaded({ scope, storageKey, record, invalid: raw !== null && record === null }); }
    }).catch(() => { if (active) setLoaded({ scope, storageKey: '', record: null, invalid: true }); });
    return () => { active = false; };
  }, [scope]);
  return { scope: loaded.scope === scope ? loaded.storageKey : '', ready: Boolean(scope && loaded.scope === scope), record: loaded.scope === scope ? loaded.record : null, invalid: loaded.scope === scope && loaded.invalid,
    save(text: string) { if (!scope || loaded.scope !== scope || !loaded.storageKey || !parseAttemptRecovery(text, loaded.storageKey)) throw Error('待核實表單的本機恢復尚未就緒。'); try { sessionStorage.setItem(loaded.storageKey, text); } catch { throw Error('此裝置無法保存待核實表單，本次尚未送出。請允許分頁儲存後再試。'); } },
    clear() { if (loaded.scope === scope && loaded.storageKey) try { sessionStorage.removeItem(loaded.storageKey); } catch { /* A stale display record remains conservative, never permission to replay. */ } },
  };
}
export function OrderAttemptRecovery({ recovery }: { recovery: ReturnType<typeof useAttemptRecovery> }) {
  const account=useAccount();
  const router = useRouter(), pathname = usePathname(), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const r = recovery.record;
  return <section className="surface p-5" aria-label="恢復待核實表單"><h2 className="section-title">原作業待核實，已保留唯讀表單</h2><p className="feedback-error" role="alert">{recovery.invalid ? '本機備份無法安全解析。請聯絡管理者核對原作業，勿建立替代需求。' : '刷新不代表作業未執行。請查詢原作業；此畫面不能重新送出。'}</p>{r?.draftName && <p>{['new-draft','edit-draft'].includes(r.mode)?'草稿':'作業'}：{r.draftName}</p>}{r?.attemptRef && <p className="order-reference">作業：{r.attemptRef}</p>}{r && <><p>原表單 {r.lines.length} 筆材料；目前僅供回看，送出結果仍待核實。</p><ol className="detail-materials">{r.lines.map((l, i) => <li key={l.key}><h3>{i + 1}. {contentText(l.content, 'Item_Name')}</h3><p>{l.content.Quantity.kind === 'number' ? l.content.Quantity.value : ''} {contentText(l.content, 'Unit')}{account?.role==='Admin'&&<> · {contentText(l.content, 'Vendor')}</>}</p><p className="whitespace-pre-wrap">{contentText(l.content, 'Remarks')}</p>{account?.role==='Admin'&&<p>{l.checked ? '送出前已勾選核對' : '未勾選核對'}</p>}</li>)}</ol>{r.dispositions.map(d => <p key={d.source}>原目標 {d.source}：{d.reason}（{d.result}）</p>)}</>}{r?.attemptRef ? <button className="btn btn-secondary mt-4" disabled={busy} onClick={async () => { setBusy(true); try { const response = await fetch('/api/orders/operations?attemptRef=' + encodeURIComponent(r.attemptRef!), { cache: 'no-store' }), body = await response.json(); if (response.ok && submissionDisposition(body) === 'confirmed') { recovery.clear(); router.replace(pathname.startsWith('/admin')?'/admin?order='+encodeURIComponent(body.orderId):detailHref(body.orderId)); } else setMessage('原作業仍待核實，未重送、未重新配號。請交由管理者核對。'); } catch { setMessage('目前無法核實原作業。已保留唯讀表單，請勿重送。'); } finally { setBusy(false); } }}>查詢原作業結果</button> : <p>沒有收到作業編號。請由管理者核對原請求與持鎖作業，不可重新建立。</p>}{message && <p role="status" className="feedback-error mt-3">{message}</p>}</section>;
}
