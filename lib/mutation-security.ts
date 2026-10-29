import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { AccessError, apiError, requireAccount } from '@/lib/access';
import { acquireWriteLock, consumeRate, saveAuditEvent, type AuditEvent } from '@/lib/security-store';
import { flushPendingAudits } from '@/lib/audit-delivery';

export const mutationAudit = new AsyncLocalStorage<{ details: string[] }>();
export async function checkedMutationRequest(request: Request) {
  // Cookies alone do not protect custom route handlers from same-site cross-origin requests.
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) throw new AccessError('平台來源尚未設定。', 503);
  let trusted: string;
  try { trusted = new URL(process.env.NEXTAUTH_URL || request.url).origin; } catch { throw new AccessError('平台來源設定不正確。', 503); }
  if (request.headers.get('origin') !== trusted || request.headers.get('sec-fetch-site') === 'cross-site') throw new AccessError('請求來源不正確，請重新整理平台後再試。', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new AccessError('僅接受 JSON 請求。', 415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 128 * 1024)) throw new AccessError('請求內容過大。', 413);
  const reader = request.body?.getReader();
  const parts: Uint8Array[] = []; let size = 0;
  if (reader) while (true) { const result = await reader.read(); if (result.done) break; size += result.value.length; if (size > 128 * 1024) { await reader.cancel(); throw new AccessError('請求內容過大。', 413); } parts.push(result.value); }
  const text = Buffer.concat(parts).toString('utf8');
  let body; try { body = JSON.parse(text); } catch { throw new AccessError('請求內容格式不正確。', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccessError('請求內容必須為物件。', 400);
  return { request: new Request(request.url, { method: request.method, headers: request.headers, body: text }), body, digest: createHash('sha256').update(text).digest('hex') };
}

export function secureMutation(handler: (request: Request) => Promise<Response>, options: { admin?: boolean; action: string; limit?: number; orderWrite?: boolean }) {
  return async (request: Request): Promise<Response> => {
    let unlock: (() => Promise<void>) | undefined;
    let retainLock = false;
    let event: AuditEvent | undefined;
    let resultResponse: Response | undefined;
    try {
      const checked = await checkedMutationRequest(request);
      const { account, sheets } = await requireAccount(options.admin);
      await consumeRate(account.email, options.action, options.limit ?? 20);
      unlock = await acquireWriteLock();
      event = { id: `SEC-${randomUUID()}`, timestamp: new Date().toISOString(), email: account.email, action: options.action, target: String(checked.body.orderId || checked.body.existingOrderId || (checked.body.orderIds || []).join?.(',') || '').slice(0, 4000), details: `request_sha256=${checked.digest}`, outcome: 'started' };
      // Persist intent BEFORE any business write; interruption leaves a recoverable unknown outcome.
      await saveAuditEvent(event);
      const context = { details: [] as string[] };
      const response = await mutationAudit.run(context, () => handler(checked.request));
      retainLock = response.status >= 500 && options.orderWrite !== false;
      event.outcome = retainLock ? 'unknown' : response.ok ? 'completed' : 'rejected';
      event.details += `; HTTP=${response.status}; ${context.details.join('; ')}`;
      try { await saveAuditEvent(event); await flushPendingAudits(sheets); }
      catch { response.headers.set('X-Audit-Status', 'pending'); console.error('Security audit delivery pending', event.id); }
      if (retainLock) response.headers.set('X-Write-Status', 'review-required');
      resultResponse = response;
      return response;
    } catch (error) {
      if (event) { retainLock = options.orderWrite !== false; try { await saveAuditEvent({ ...event, outcome: 'unknown' }); } catch { /* Intent is already durable; manual reconciliation required. */ } }
      const response = apiError(error, '操作失敗，請稍後再試。');
      if (response.status === 429 || response.status === 423) response.headers.set('Retry-After', '60');
      return response;
    } finally {
      if (unlock && !retainLock) try { await unlock(); } catch { resultResponse?.headers.set('X-Write-Status', 'review-required'); console.error('Write coordination requires administrator review'); }
    }
  };
}
