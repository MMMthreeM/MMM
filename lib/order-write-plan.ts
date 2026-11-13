import 'server-only';
import { createHash } from 'node:crypto';
import { requireV2 } from './order-v2-schema';
/** All numbers are bound by binary64 bits, including -0; no JSON float coercion. */
export function canonicalWriteValue(value: unknown): string {
    const seen = new Set<object>();
    function encode(v: unknown, depth: number): string {
        requireV2(depth < 64, 'WRITE_BINDING_TOO_DEEP');
        if (v === null)
            return '["null"]';
        if (typeof v === 'string')
            return '["string",' + JSON.stringify(v) + ']';
        if (typeof v === 'boolean')
            return '["boolean",' + String(v) + ']';
        if (typeof v === 'number') {
            requireV2(Number.isFinite(v), 'WRITE_BINDING_INVALID');
            const b = Buffer.alloc(8);
            b.writeDoubleBE(v);
            return '["number-binary64",' + JSON.stringify(b.toString('hex')) + ']';
        }
        requireV2(v && typeof v === 'object' && !seen.has(v) && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null), 'WRITE_BINDING_INVALID');
        seen.add(v);
        const descriptors = Object.getOwnPropertyDescriptors(v);
        requireV2(Reflect.ownKeys(v).every(k => typeof k === 'string' && Object.hasOwn(descriptors[k], 'value')), 'WRITE_BINDING_INVALID');
        let out: string;
        if (Array.isArray(v)) {
            requireV2(Object.keys(v).length === v.length, 'WRITE_BINDING_INVALID');
            out = '["array",[' + v.map(x => encode(x, depth + 1)).join(',') + ']]';
        }
        else
            out = '["object",[' + Object.keys(v).sort().map(k => '[' + JSON.stringify(k) + ',' + encode(descriptors[k].value, depth + 1) + ']').join(',') + ']]';
        seen.delete(v);
        return out;
    }
    return encode(value, 0);
}
export const writeDigest = (value: unknown) => createHash('sha256').update(canonicalWriteValue(value)).digest('hex');
