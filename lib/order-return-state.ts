import { isPermanentLineId, type PermanentLineRef } from './order-identity';
import { validateMaterialContentFingerprint } from './material-content-fingerprint';
import { canonicalHistory, canonicalHistoryValidatedInput } from './order-history';
import type { SourceRef, ChangeSetRequest } from './order-change-set';
/** T06-R2-Candidate-1. Unwired pure evaluation, never a dispatch capability.
 * Witnesses are reviewed SERVER dependencies, not request data or a production
 * provider implemented here. Types cannot sandbox callbacks or authenticate them.
 * Candidate B1/formal validation requires a controlled confirmation provider;
 * persisted-state witnesses must never be forged for unsaved candidate items.
 */
export type ActiveReturnRef = 'none' | `event:${string}`;
export type R2ErrorCode = 'R2_SCHEMA_INVALID' | 'R2_VERSION_UNSUPPORTED' | 'R2_MIXED_CONTRACT' | 'R2_REF_COLUMN_MISSING' | 'R2_REF_UNOBSERVED' | 'R2_REF_EMPTY' | 'R2_REF_FORMULA' | 'R2_REF_TYPE_INVALID' | 'R2_REF_FORMAT_INVALID' | 'R2_REF_INCONSISTENT' | 'R2_UNAUTHORIZED' | 'R2_SOURCE_NOT_V2' | 'R2_ORDER_NOT_FOUND' | 'R2_OWNERSHIP_MISMATCH' | 'R2_COVERAGE_UNVERIFIED' | 'R2_IDENTITY_INTEGRITY_ERROR' | 'R2_STATE_UNSUPPORTED' | 'R2_STATE_CONFLICT' | 'R2_HISTORY_UNVERIFIED' | 'R2_HISTORY_REFERENCE_MISSING' | 'R2_HISTORY_CONFLICT' | 'R2_ACTIVE_RETURN_CLOSED' | 'R2_ACTIVE_RETURN_EXISTS' | 'R2_NO_ACTIVE_RETURN' | 'R2_ACTIVE_RETURN_CHANGED' | 'R2_TARGET_SET_INVALID' | 'R2_TARGET_NOT_ACTIVE' | 'R2_TARGET_MCF_CHANGED' | 'R2_TARGET_TRACE_UNVERIFIED' | 'R2_RESOLUTION_SET_INVALID' | 'R2_RESOLUTION_EVIDENCE_UNVERIFIED' | 'R2_RESOLUTION_CONFLICT' | 'R2_CHANGESET_UNVERIFIED' | 'R2_FORMAL_VALIDATION_FAILED' | 'R2_B1_UNVERIFIED' | 'R2_B1_CONFIRMATION_REQUIRED' | 'R2_CANDIDATE_BINDINGS_REQUIRED' | 'R2_DEPENDENCY_NOT_READY' | 'R2_EMPTY_ORDER' | 'R2_LIMIT_EXCEEDED' | 'R2_POSTCONDITIONS_UNVERIFIED' | 'R2_INTERNAL_ERROR';
export type ParsedReturnRef = Readonly<{
    kind: 'none-candidate';
}> | Readonly<{
    kind: 'event-candidate';
    eventId: string;
}> | Readonly<{
    kind: 'unverified';
    code: R2ErrorCode;
}>;
export type R2TargetExpectation = Readonly<{
    lineRef: PermanentLineRef;
    expectedMcf: string;
    reason: string | null;
}>;
type RequestBase = Readonly<{
    contractVersion: 2;
    r2Version: 1;
    orderId: string;
}>;
export type CreateReturnRequest = RequestBase & Readonly<{
    intent: 'create-return';
    expectedActiveReturnRef: 'none';
    scope: 'order' | 'lines';
    reason: string;
    targets: readonly R2TargetExpectation[];
}>;
export type ReplaceReturnRequest = RequestBase & Readonly<{
    intent: 'replace-current-return';
    expectedActiveReturnRef: `event:${string}`;
    scope: 'order' | 'lines';
    reason: string;
    targets: readonly R2TargetExpectation[];
}>;
export type ResolutionIntent = Readonly<{
    originalLineRef: PermanentLineRef;
    originalMcf: string;
    reason: string;
}> & (Readonly<{
    action: 'accept-current';
    result: PermanentLineRef;
    expectedResultMcf: string;
}> | Readonly<{
    action: 'withdraw';
    result: null;
    expectedResultMcf: null;
}> | Readonly<{
    action: 'accept-merge';
    result: SourceRef;
    expectedResultMcf: string;
}>);
export type ResubmitRequest = RequestBase & Readonly<{
    intent: 'resubmit-order';
    expectedActiveReturnRef: `event:${string}`;
    changeSet: ChangeSetRequest;
    resolutions: readonly ResolutionIntent[];
}>;
export type R2Request = CreateReturnRequest | ReplaceReturnRequest | ResubmitRequest;
class Rejected extends Error {
    constructor(readonly code: R2ErrorCode) { super(code); }
}
function fail(code: R2ErrorCode): never { throw new Rejected(code); }
const obj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function shape(v: unknown, keys: readonly string[], optional: readonly string[] = []): asserts v is Record<string, unknown> {
    if (!obj(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || keys.some(k => !Object.hasOwn(v, k)))
        fail('R2_SCHEMA_INVALID');
    for (const k of Reflect.ownKeys(v)) {
        if (typeof k !== 'string' || !keys.includes(k) && !optional.includes(k))
            fail('R2_SCHEMA_INVALID');
        const d = Object.getOwnPropertyDescriptor(v, k)!;
        if (!d.enumerable || !('value' in d))
            fail('R2_SCHEMA_INVALID');
    }
}
function list(v: unknown, max = 100, min = 0): asserts v is unknown[] {
    if (!Array.isArray(v))
        fail('R2_SCHEMA_INVALID');
    if (v.length < min || v.length > max)
        fail('R2_LIMIT_EXCEEDED');
}
/** Reject getters, executable/custom objects, symbols, sparse arrays and cycles
 * before reading properties. Fractional raw numbers remain T04's responsibility.
 */
function copy<T>(v: T): T {
    const seen = new Set<object>();
    const walk = (x: unknown, depth: number): unknown => {
        if (depth > 48)
            fail('R2_LIMIT_EXCEEDED');
        if (x === null || typeof x === 'boolean')
            return x;
        if (typeof x === 'string')
            return x;
        if (typeof x === 'number' && Number.isFinite(x))
            return x;
        if (!obj(x) && !Array.isArray(x))
            fail('R2_SCHEMA_INVALID');
        if (seen.has(x))
            fail('R2_SCHEMA_INVALID');
        seen.add(x);
        if (Array.isArray(x)) {
            if (x.length > 250000)
                fail('R2_LIMIT_EXCEEDED');
            if (Object.getPrototypeOf(x) !== Array.prototype || Reflect.ownKeys(x).length !== x.length + 1)
                fail('R2_SCHEMA_INVALID');
            const a = Array.from({ length: x.length }, (_, i) => {
                const d = Object.getOwnPropertyDescriptor(x, String(i));
                if (!d || !('value' in d))
                    fail('R2_SCHEMA_INVALID');
                return walk(d.value, depth + 1);
            });
            seen.delete(x);
            return Object.freeze(a);
        }
        if (Object.getPrototypeOf(x) !== Object.prototype && Object.getPrototypeOf(x) !== null)
            fail('R2_SCHEMA_INVALID');
        const out: Record<string, unknown> = {};
        for (const k of Reflect.ownKeys(x)) {
            if (typeof k !== 'string')
                fail('R2_SCHEMA_INVALID');
            const d = Object.getOwnPropertyDescriptor(x, k)!;
            if (!d.enumerable || !('value' in d))
                fail('R2_SCHEMA_INVALID');
            Object.defineProperty(out, k, { value: walk(d.value, depth + 1), enumerable: true });
        }
        seen.delete(x);
        return Object.freeze(out);
    };
    return walk(v, 0) as T;
}
function text(v: unknown, maxBytes = 256, maxUnits = Infinity): asserts v is string {
    if (typeof v !== 'string' || !/\S/u.test(v) || v.length > maxUnits || Buffer.byteLength(v) > maxBytes || !canonicalHistory(v).ok)
        fail('R2_SCHEMA_INVALID');
}
const reason = (v: unknown) => text(v, 2000, 500);
function mcf(v: unknown) {
    if (!validateMaterialContentFingerprint(v).ok)
        fail('R2_TARGET_MCF_CHANGED');
}
function permanent(v: unknown, orderId?: string): asserts v is PermanentLineRef {
    shape(v, ['kind', 'orderId', 'lineId']);
    text(v.orderId);
    if (v.kind !== 'permanent' || !isPermanentLineId(v.lineId))
        fail('R2_IDENTITY_INTEGRITY_ERROR');
    if (orderId !== undefined && v.orderId !== orderId)
        fail('R2_OWNERSHIP_MISMATCH');
}
function source(v: unknown, orderId: string): asserts v is SourceRef {
    if (obj(v) && v.kind === 'new') {
        shape(v, ['kind', 'clientKey']);
        text(v.clientKey);
        if (isPermanentLineId(v.clientKey))
            fail('R2_MIXED_CONTRACT');
    }
    else
        permanent(v, orderId);
}
const eventPattern = /^hev_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function parseRef(raw: unknown): ParsedReturnRef {
    if (raw === undefined)
        return { kind: 'unverified', code: 'R2_REF_UNOBSERVED' };
    if (obj(raw)) {
        if (raw.kind === 'missing-column') {
            shape(raw, ['kind']);
            return { kind: 'unverified', code: 'R2_REF_COLUMN_MISSING' };
        }
        if (raw.kind === 'unobserved') {
            shape(raw, ['kind']);
            return { kind: 'unverified', code: 'R2_REF_UNOBSERVED' };
        }
        if (raw.kind === 'no-input') {
            shape(raw, ['kind']);
            return { kind: 'unverified', code: 'R2_REF_EMPTY' };
        }
        shape(raw, ['kind', 'value']);
        if (raw.kind === 'formula')
            return { kind: 'unverified', code: 'R2_REF_FORMULA' };
        if (raw.kind !== 'string')
            return { kind: 'unverified', code: 'R2_REF_TYPE_INVALID' };
        raw = raw.value;
    }
    if (typeof raw !== 'string')
        return { kind: 'unverified', code: 'R2_REF_TYPE_INVALID' };
    if (!/\S/u.test(raw))
        return { kind: 'unverified', code: 'R2_REF_EMPTY' };
    if (raw === 'none')
        return { kind: 'none-candidate' };
    if (raw.length === 46 && raw.startsWith('event:') && eventPattern.test(raw.slice(6)))
        return { kind: 'event-candidate', eventId: raw.slice(6) };
    return { kind: 'unverified', code: 'R2_REF_FORMAT_INVALID' };
}
function requiredRef(raw: unknown): ActiveReturnRef {
    const p = parseRef(raw);
    if (p.kind === 'unverified')
        fail(p.code);
    return p.kind === 'none-candidate' ? 'none' : `event:${p.eventId}`;
}
export function parseReturnRequest(value: unknown): R2Request { return request(value); }
function request(value: unknown): R2Request {
    const r = copy(value);
    if (!obj(r))
        fail('R2_SCHEMA_INVALID');
    if (r.contractVersion !== 2 || r.r2Version !== 1)
        fail('R2_VERSION_UNSUPPORTED');
    if (['lineId', 'expectedLineIds', 'targetLineIds'].some(k => Object.hasOwn(r, k)))
        fail('R2_MIXED_CONTRACT');
    const common = ['contractVersion', 'r2Version', 'orderId', 'intent', 'expectedActiveReturnRef'];
    text(r.orderId);
    const ref = requiredRef(r.expectedActiveReturnRef);
    if (r.intent === 'create-return' || r.intent === 'replace-current-return') {
        shape(r, [...common, 'scope', 'reason', 'targets']);
        reason(r.reason);
        if (!['order', 'lines'].includes(String(r.scope)))
            fail('R2_SCHEMA_INVALID');
        if (r.intent === 'create-return' ? ref !== 'none' : ref === 'none')
            fail('R2_ACTIVE_RETURN_CHANGED');
        list(r.targets, 100, 1);
        const ids = new Set<string>();
        for (const t of r.targets) {
            shape(t, ['lineRef', 'expectedMcf', 'reason']);
            permanent(t.lineRef, r.orderId);
            mcf(t.expectedMcf);
            if (t.reason !== null)
                reason(t.reason);
            if (ids.has(t.lineRef.lineId))
                fail('R2_TARGET_SET_INVALID');
            ids.add(t.lineRef.lineId);
        }
    }
    else if (r.intent === 'resubmit-order') {
        shape(r, [...common, 'changeSet', 'resolutions']);
        if (ref === 'none')
            fail('R2_NO_ACTIVE_RETURN');
        const cs = canonicalHistoryValidatedInput(r.changeSet);
        if (!cs.ok)
            fail('R2_CHANGESET_UNVERIFIED');
        const change = r.changeSet as ChangeSetRequest;
        if (change.target.kind !== 'existing-order' || change.target.orderId !== r.orderId)
            fail('R2_CHANGESET_UNVERIFIED');
        list(r.resolutions, 100, 1);
        const ids = new Set<string>();
        for (const i of r.resolutions) {
            shape(i, ['originalLineRef', 'originalMcf', 'reason', 'action', 'result', 'expectedResultMcf']);
            permanent(i.originalLineRef, r.orderId);
            mcf(i.originalMcf);
            reason(i.reason);
            if (ids.has(i.originalLineRef.lineId))
                fail('R2_RESOLUTION_SET_INVALID');
            ids.add(i.originalLineRef.lineId);
            if (i.action === 'withdraw') {
                if (i.result !== null || i.expectedResultMcf !== null)
                    fail('R2_RESOLUTION_CONFLICT');
            }
            else if (i.action === 'accept-current' || i.action === 'accept-merge') {
                source(i.result, r.orderId);
                if (i.action === 'accept-current')
                    permanent(i.result, r.orderId);
                mcf(i.expectedResultMcf);
            }
            else
                fail('R2_RESOLUTION_CONFLICT');
        }
    }
    else
        fail('R2_STATE_UNSUPPORTED');
    return r as R2Request;
}
