import { randomInt } from 'node:crypto';
import { requireV2 } from './order-v2-schema';

/** Called while holding the existing shared write lock. Never reuse a retired order number. */
export function allocateOrderNumber(used: ReadonlySet<string>, at: string, suffix = randomInt(10000)) {
  requireV2(/^\d{4}-\d{2}-\d{2}/.test(at) && Number.isInteger(suffix) && suffix >= 0 && suffix < 10000, 'ORDER_NUMBER_INVALID');
  const date = at.slice(0, 10).replaceAll('-', '');
  for (let offset = 0; offset < 10000; offset++) {
    const candidate = `ORD-${date}-${String((suffix + offset) % 10000).padStart(4, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  requireV2(false, 'ORDER_NUMBER_EXHAUSTED');
}
