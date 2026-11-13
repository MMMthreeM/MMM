import { isPermanentLineId, type PermanentLineRef } from './order-identity';
import { fingerprintMaterialContent, MATERIAL_CONTENT_FIELDS } from './material-content-fingerprint';
import { canonicalB1, type B1MaterialPreimage } from './order-item-state';
export type HistoryError = 'H2_SCHEMA_INVALID' | 'H2_VERSION_UNSUPPORTED' | 'H2_CELL_TYPE_INVALID' | 'H2_JSON_INVALID' | 'H2_NON_CANONICAL_JSON' | 'H2_LIMIT_EXCEEDED' | 'H2_DIGEST_MISMATCH' | 'H2_CHUNK_MISSING' | 'H2_CHUNK_DUPLICATE' | 'H2_EVENT_ID_CONFLICT' | 'H2_OPERATION_INCOMPLETE' | 'H2_STATE_CONFLICT' | 'H2_OWNERSHIP_MISMATCH' | 'H2_ID_REINTRODUCED' | 'H2_RETIRED_ID_REUSED' | 'H2_REFERENCE_CONFLICT' | 'H2_LINEAGE_SOURCE_MISSING' | 'H2_LINEAGE_CONFLICT' | 'H2_HISTORY_SCOPE_UNVERIFIED' | 'H2_RETENTION_UNVERIFIED' | 'H2_RETENTION_CONFLICT' | 'H2_AUTHORSHIP_UNVERIFIED' | 'H2_HANDOFF_UNVERIFIED';
export type HistoryFailure = Readonly<{
    ok: false;
    code: HistoryError;
    dispatchPermission: 'not-granted';
}>;
export type HistoryResult<T> = Readonly<{
    ok: true;
    value: T;
}> | HistoryFailure;
class Rejection extends Error {
    constructor(readonly code: HistoryError) { super(code); }
}
function deny(code: HistoryError): never { throw new Rejection(code); }
function run<T>(fn: () => T, detachedFrozenResult = false): HistoryResult<T> {
    try {
        const value = fn();
        return Object.freeze({ ok: true, value: detachedFrozenResult ? value : copy(value) });
    }
    catch (e) {
        return Object.freeze({ ok: false, code: e instanceof Rejection ? e.code : 'H2_SCHEMA_INVALID', dispatchPermission: 'not-granted' });
    }
}
function obj(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v)); }
function shape(v: unknown, keys: readonly string[]): asserts v is Record<string, unknown> {
    if (!obj(v) || Reflect.ownKeys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k)))
        deny('H2_SCHEMA_INVALID');
}
function arr(v: unknown, max = 100, min = 0): asserts v is unknown[] {
    if (!Array.isArray(v) || v.length < min || v.length > max || Reflect.ownKeys(v).length !== v.length + 1)
        deny('H2_LIMIT_EXCEEDED');
}
// Pure representation memoization only. A source enters this weak cache ONLY
// after its complete descendant graph was checked and proved deeply frozen.
// No retention, actor, freshness, authorization or business verdict is cached.
type FrozenCopy = {
    value: object;
    height: number;
};
const frozenCopies = new WeakMap<object, FrozenCopy>();
const canonicalProjection = new Map<object, string>();
let canonicalProjectionBytes = 0;
const CANONICAL_PROJECTION_BYTES = 16 * 1024 * 1024;
function copy<T>(v: T, depth = 0, path = new Set<object>(), scan = { deeplyFrozen: true, height: 0 }): T {
    scan.height = Math.max(scan.height, depth);
    if (depth > 48)
        deny('H2_LIMIT_EXCEEDED');
    if (v === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof v))
        return v;
    if (!v || typeof v !== 'object' || path.has(v) || !Array.isArray(v) && !obj(v))
        deny('H2_SCHEMA_INVALID');
    const cached = depth === 0 ? frozenCopies.get(v) : undefined;
    if (cached) {
        if (depth + cached.height > 48)
            deny('H2_LIMIT_EXCEEDED');
        return cached.value as T;
    }
    if (Array.isArray(v))
        arr(v, 250000);
    const ds = Object.getOwnPropertyDescriptors(v);
    if (Reflect.ownKeys(v).some(k => typeof k !== 'string' || !Object.hasOwn(ds[k], 'value')))
        deny('H2_SCHEMA_INVALID');
    scan.deeplyFrozen &&= Object.isFrozen(v);
    path.add(v);
    const out = Array.isArray(v) ? v.map(x => copy(x, depth + 1, path, scan)) : Object.fromEntries(Object.entries(ds).map(([k, d]) => [k, copy(d.value, depth + 1, path, scan)]));
    path.delete(v);
    Object.freeze(out);
    // Root-only entries avoid a WeakMap entry for every transient nested cell.
    if (depth === 0) {
        const record = { value: out, height: scan.height };
        frozenCopies.set(out, record);
        if (scan.deeplyFrozen)
            frozenCopies.set(v, record);
    }
    return out as T;
}
function cjson(v: unknown) {
    const key = v && typeof v === 'object' && frozenCopies.has(v) ? v : null;
    if (key && canonicalProjection.has(key))
        return canonicalProjection.get(key)!;
    const r = canonicalB1(v);
    if (!r.ok)
        deny('H2_SCHEMA_INVALID');
    const bytes = key ? Buffer.byteLength(r.value, 'utf8') : 0;
    if (key && bytes <= CANONICAL_PROJECTION_BYTES) {
        while (canonicalProjection.size && (canonicalProjection.size >= 128 || canonicalProjectionBytes + bytes > CANONICAL_PROJECTION_BYTES)) {
            const oldest = canonicalProjection.keys().next().value!;
            canonicalProjectionBytes -= Buffer.byteLength(canonicalProjection.get(oldest)!, 'utf8');
            canonicalProjection.delete(oldest);
        }
        canonicalProjection.set(key, r.value);
        canonicalProjectionBytes += bytes;
    }
    return r.value;
}
function ref(v: unknown, maxBytes = 256, maxUnits = Infinity): asserts v is string {
    if (typeof v !== 'string' || !/\S/u.test(v) || v.length > maxUnits || Buffer.byteLength(v, 'utf8') > maxBytes)
        deny('H2_SCHEMA_INVALID');
    cjson(v);
}
function key(v: unknown): asserts v is string {
    if (typeof v !== 'string' || v.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v) || /\s/.test(v))
        deny('H2_SCHEMA_INVALID');
}
function lineRef(v: unknown): asserts v is PermanentLineRef {
    shape(v, ['kind', 'orderId', 'lineId']);
    if (v.kind !== 'permanent' || !isPermanentLineId(v.lineId))
        deny('H2_SCHEMA_INVALID');
    ref(v.orderId);
}
export function canonicalHistory(value: unknown): HistoryResult<string> { return run(() => cjson(copy(value))); }
// Duplicate-aware parser; JSON.parse is used ONLY on individual string tokens.
function parseJson(text: string): unknown {
    let p = 0;
    const ws = () => {
        while (p < text.length && /[\x20\t\n\r]/.test(text[p]))
            p++;
    };
    const str = (): string => {
        const start = p++;
        while (p < text.length) {
            const c = text[p++];
            if (c === '\\')
                p++;
            else if (c === '"') {
                try {
                    return JSON.parse(text.slice(start, p));
                }
                catch {
                    deny('H2_JSON_INVALID');
                }
            }
        }
        return deny('H2_JSON_INVALID');
    };
    function val(depth: number): unknown {
        if (depth > 48)
            deny('H2_LIMIT_EXCEEDED');
        ws();
        if (text[p] === '"')
            return str();
        if (text[p] === '{') {
            p++;
            ws();
            const pairs: [
                string,
                unknown
            ][] = [], keys = new Set<string>();
            if (text[p] === '}') {
                p++;
                return {};
            }
            while (p < text.length) {
                ws();
                if (text[p] !== '"')
                    deny('H2_JSON_INVALID');
                const k = str();
                if (keys.has(k))
                    deny('H2_JSON_INVALID');
                keys.add(k);
                ws();
                if (text[p++] !== ':')
                    deny('H2_JSON_INVALID');
                pairs.push([k, val(depth + 1)]);
                ws();
                if (text[p] === '}') {
                    p++;
                    return Object.fromEntries(pairs);
                }
                if (text[p++] !== ',')
                    deny('H2_JSON_INVALID');
            }
            deny('H2_JSON_INVALID');
        }
        if (text[p] === '[') {
            p++;
            ws();
            const a: unknown[] = [];
            if (text[p] === ']') {
                p++;
                return a;
            }
            while (p < text.length) {
                a.push(val(depth + 1));
                ws();
                if (text[p] === ']') {
                    p++;
                    return a;
                }
                if (text[p++] !== ',')
                    deny('H2_JSON_INVALID');
            }
            deny('H2_JSON_INVALID');
        }
        for (const [s, v] of [['null', null], ['true', true], ['false', false]] as const)
            if (text.startsWith(s, p)) {
                p += s.length;
                return v;
            }
        const n = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(p));
        if (!n)
            deny('H2_JSON_INVALID');
        p += n[0].length;
        return Number(n[0]);
    }
    const out = val(0);
    ws();
    if (p !== text.length)
        deny('H2_JSON_INVALID');
    if (cjson(out) !== text)
        deny('H2_NON_CANONICAL_JSON');
    return out;
}
function seven(v: unknown) {
    shape(v, MATERIAL_CONTENT_FIELDS);
    const result = fingerprintMaterialContent(MATERIAL_CONTENT_FIELDS, MATERIAL_CONTENT_FIELDS.map(k => v[k]) as Parameters<typeof fingerprintMaterialContent>[1]);
    if (!result.ok)
        deny('H2_SCHEMA_INVALID');
    return { preimage: parseJson(result.canonicalJson) as B1MaterialPreimage, mcf: result.fingerprint };
}
/** For the SERVER handoff only: convert already T05-validated material cells to
 * T04 snapshots without inventing another number encoder or accepting authority.
 */
export function canonicalHistoryValidatedInput(request: unknown): HistoryResult<string> {
    return run(() => {
        const r = copy(request);
        shape(r, ['contractVersion', 'changeSetVersion', 'target', 'expectations', 'changed', 'added', 'removed', 'merged']);
        if (r.contractVersion !== 2 || r.changeSetVersion !== 1)
            deny('H2_VERSION_UNSUPPORTED');
        for (const k of ['changed', 'added', 'removed', 'merged'])
            arr(r[k], 512);
        const changed = (r.changed as unknown[]).map(e => { shape(e, ['lineRef', 'after']); lineRef(e.lineRef); return { ...e, after: seven(e.after).preimage }; });
        const added = (r.added as unknown[]).map(e => {
            shape(e, ['clientKey', 'purpose', 'content']);
            key(e.clientKey);
            if (!['new-line', 'merge-result'].includes(String(e.purpose)))
                deny('H2_SCHEMA_INVALID');
            return { ...e, content: seven(e.content).preimage };
        });
        return cjson({ ...r, changed, added });
    });
}
