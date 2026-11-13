'use client';
import { useCallback, useEffect, useState } from 'react';
import type { OrderRow } from '@/lib/order-view';
import { apiMessage } from '@/lib/api-message';

async function readOrders(url: string, signal?: AbortSignal): Promise<OrderRow[]> {
  const response = await fetch(url, { cache: 'no-store', signal });
  const body = await response.json();
  if (!response.ok) throw new Error(apiMessage(body, '讀取需求單失敗，請稍後重新載入。'));
  if(body.contractVersion!==2||!Array.isArray(body.data))throw Error('需求資料版本不支援。');
  return body.data;
}

export function useOrders(admin = false, query = admin ? 'scope=all' : '') {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const url = (admin ? '/api/admin/orders' : '/api/orders') + (query ? `?${query}` : '');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data=await readOrders(url, signal);setOrders(data); setError('');
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : '無法連線，請稍後再試。');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    readOrders(url, controller.signal).then((data) => { setOrders(data); setError(''); }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '讀取需求單失敗。');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url]);
  return { orders, loading, error, refresh };
}
