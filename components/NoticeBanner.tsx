'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from './AppShell';
// UI preference only. Exact content digests do not authorize business actions.
async function preferenceKey(value:string) {const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');}
export default function NoticeBanner() {
  const account=useAccount(),path=usePathname();
  const [state,setState]=useState<{account:string;notices:{text:string;key:string}[];closed:string[]}|null>(null);
  const [showAll,setShowAll]=useState(false);
  useEffect(()=>{if(!account)return;let active=true;const email=account.email;Promise.all([fetch('/api/notices',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}),preferenceKey(email)]).then(async([body,owner])=>{const texts:unknown=body.data;if(!Array.isArray(texts))return;const notices=await Promise.all([...new Set(texts.filter((n):n is string=>typeof n==='string'))].map(async text=>({text,key:'mmm-notice:'+owner+':'+await preferenceKey(text)})));let closed:string[]=[];try{closed=notices.filter(n=>localStorage.getItem(n.key)==='closed').map(n=>n.key);}catch{}if(active)setState({account:email,notices,closed});}).catch(()=>{});return()=>{active=false;};},[account]);
  useEffect(()=>{const show=()=>{setShowAll(true);};window.addEventListener('mmm-show-notices',show);return()=>window.removeEventListener('mmm-show-notices',show);},[]);
  if(!state||state.account!==account?.email||path.startsWith('/request')&&!showAll)return null;
  const visible=state.notices.filter(n=>showAll||!state.closed.includes(n.key));if(!visible.length)return null;
  const close=(key:string)=>{try{localStorage.setItem(key,'closed');}catch{}setState(s=>s?{...s,closed:[...s.closed,key]}:s);};
  return <aside className="notice-banner" aria-label="系統公告"><div className="notice-banner-inner">
    <ul className="notice-lines">{visible.map(n=><li key={n.key}><span className="notice-bullet" aria-hidden="true"/><p>{n.text}</p></li>)}</ul>
    <button type="button" className="notice-close" title="關閉公告" aria-label="關閉公告" onClick={()=>{visible.forEach(n=>close(n.key));setShowAll(false);}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
  </div></aside>;
}
