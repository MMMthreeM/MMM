'use client';
import { useSyncExternalStore } from 'react';
import { useAccount } from '@/components/AppShell';
import type { CatalogMaterial } from '@/lib/material-catalog';

type Preferences = { favorites: string[]; recent: string[] };
const memory = new Map<string, string>();
const eventName = 'material-preferences-change';
export const materialIdentity = (material: Pick<CatalogMaterial, 'name' | 'vendor' | 'unit'>) => JSON.stringify([material.name, material.vendor, material.unit]);
function read(key: string) { if (memory.has(key)) return memory.get(key)!; try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function parse(value: string): Preferences { try { const data = JSON.parse(value); return { favorites: Array.isArray(data.favorites) ? data.favorites.filter((v: unknown) => typeof v === 'string').slice(0, 40) : [], recent: Array.isArray(data.recent) ? data.recent.filter((v: unknown) => typeof v === 'string').slice(0, 8) : [] }; } catch { return { favorites: [], recent: [] }; } }
function subscribe(callback: () => void) { const onStorage = (event: StorageEvent) => { if (event.key) memory.delete(event.key); else memory.clear(); callback(); }; window.addEventListener('storage', onStorage); window.addEventListener(eventName, callback); return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(eventName, callback); }; }
export function useMaterialPreferences() {
  const account = useAccount();
  const key = `materials-v1:${encodeURIComponent(account?.email || '')}:${encodeURIComponent(account?.company || '')}`;
  const snapshot = useSyncExternalStore(subscribe, () => read(key), () => '');
  const preferences = parse(snapshot);
  const write = (change: (current: Preferences) => Preferences) => {
    if (!account) return;
    const next = JSON.stringify(change(parse(read(key)))); memory.set(key, next);
    try { localStorage.setItem(key, next); } catch { /* Keep the current session usable when storage is unavailable. */ }
    window.dispatchEvent(new Event(eventName));
  };
  return { ...preferences,
    toggle: (material: CatalogMaterial) => write((current) => { const id = materialIdentity(material); return { ...current, favorites: current.favorites.includes(id) ? current.favorites.filter((value) => value !== id) : [id, ...current.favorites].slice(0, 40) }; }),
    record: (material: CatalogMaterial) => write((current) => { const id = materialIdentity(material); return { ...current, recent: [id, ...current.recent.filter((value) => value !== id)].slice(0, 8) }; }),
  };
}
