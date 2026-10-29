import { createHash, randomUUID } from 'node:crypto';
import { AccessError } from '@/lib/access-error';

export function securityPrefix() {
  if (!process.env.GOOGLE_SHEET_ID) throw new AccessError('資料來源尚未設定。', 503);
  return `mmm:{${createHash('sha256').update(process.env.GOOGLE_SHEET_ID).digest('hex').slice(0, 24)}}`;
}
export async function redisCommand<T>(...command: (string | number)[]): Promise<T> {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) throw new AccessError('安全協調服務尚未設定，暫時無法寫入。', 503);
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new AccessError('安全協調服務設定不正確。', 503);
  try {
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (!response.ok || !data || typeof data !== 'object' || data.error || !Object.hasOwn(data, 'result')) throw new Error('Redis command rejected');
    return data.result as T;
  } catch { throw new AccessError('安全協調服務無法連線，暫時無法寫入。', 503); }
}
export async function consumeRate(email: string, action: string, limit: number) {
  const bucket = Math.floor(Date.now() / 60000);
  const identity = createHash('sha256').update(email.toLowerCase()).digest('hex');
  const count = await redisCommand<number>('EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n", 1, `${securityPrefix()}:rate:${identity}:${action}:${bucket}`);
  if (!Number.isSafeInteger(count) || count < 1) throw new AccessError('安全限制服務回應異常。', 503);
  if (count > limit) throw new AccessError('操作過於頻繁，請稍後再試。', 429);
}
export async function acquireWriteLock() {
  const key = `${securityPrefix()}:orders-lock`, token = randomUUID();
  // No lease expiry: a paused/late Sheets writer must never overlap a new owner.
  const acquired = await redisCommand<string | null>('SET', key, token, 'NX');
  if (acquired !== 'OK') throw new AccessError('目前有其他資料作業或待確認的操作，請稍後重試或聯絡管理員。', 423);
  return async () => { await redisCommand('EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, key, token); };
}

export type AuditEvent = { id: string; timestamp: string; email: string; action: string; target: string; details: string; outcome: string };
export async function saveAuditEvent(event: AuditEvent) {
  const base = securityPrefix();
  await redisCommand('EVAL', "redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]); redis.call('ZADD',KEYS[2],ARGV[3],ARGV[1]); return 1", 2, `${base}:audit-events`, `${base}:audit-pending`, event.id, JSON.stringify(event), Date.now());
}
export async function pendingAuditEvents(): Promise<AuditEvent[]> {
  const base = securityPrefix();
  // Read pending IDs and payloads in one leader-executed script, not separate replica reads.
  const raw = await redisCommand<string[]>('EVAL', "redis.call('INCR',KEYS[3]); local out={}; for _,id in ipairs(redis.call('ZRANGE',KEYS[1],0,9)) do local item=redis.call('HGET',KEYS[2],id); if item then table.insert(out,item) end end; return out", 3, `${base}:audit-pending`, `${base}:audit-events`, `${base}:audit-read-sequence`);
  return raw.map(value => JSON.parse(value) as AuditEvent);
}
export async function acknowledgeAudit(id: string) { await redisCommand('ZREM', `${securityPrefix()}:audit-pending`, id); }
