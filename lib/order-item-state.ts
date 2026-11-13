import { createHash } from 'node:crypto';
import { isPermanentLineId, type PermanentLineRef } from './order-identity';
import { MATERIAL_CONTENT_FIELDS, validateMaterialContentFingerprint, type MaterialContentAtom } from './material-content-fingerprint';
import type { QuantityPolicy } from './order-change-set';
export type B1Origin = Readonly<{
    kind: 'catalog-selection';
    materialIdAtSelection: string;
    selectionEvidenceRef: string;
}> | Readonly<{
    kind: 'manual-entry';
    inputEvidenceRef: string;
}> | Readonly<{
    kind: 'reorder-copy';
    sourceOrderId: string;
    sourceCompany: string;
    sourceLine: Readonly<{
        kind: 'permanent';
        lineRef: PermanentLineRef;
    }> | Readonly<{
        kind: 'historical-record';
        snapshotRef: string;
        recordRef: string;
    }>;
    copyEvidenceRef: string;
}> | Readonly<{
    kind: 'merge-result';
    lineageEventRef: string;
    resultNodeRef: string;
}>;
export type B1Resolution = Readonly<{
    kind: 'catalog-resolved';
    materialId: string;
    catalogBasisDigest: string;
}> | Readonly<{
    kind: 'custom-resolved';
    selectionEvidenceRef: string;
    catalogBasisDigest: string;
}> | Readonly<{
    kind: 'unresolved';
    reason: 'new-unresolved' | 'catalog-missing' | 'catalog-ambiguous' | 'legacy-unresolved';
}>;
export type B1CatalogBasis = Readonly<{
    schemaVersion: 1;
    mode: 'catalog' | 'custom' | 'unresolved';
    authorityRef: string;
    basisVersion: string;
    materialFacts: null | Readonly<{
        materialId: string;
        itemName: string;
        unit: string;
        vendor: string;
        requiresRemarks: boolean;
    }>;
    quantityPolicy: QuantityPolicy;
    validationPolicyVersion: string;
}>;
/** Field order/root/atoms are validated by T04, not a second material encoder. */
export type B1MaterialPreimage = readonly [
    'mmm.material-content',
    1,
    readonly (readonly [
        typeof MATERIAL_CONTENT_FIELDS[number],
        MaterialContentAtom
    ])[]
];
export type B1ConfirmationData = Readonly<{
    schemaVersion: 1;
    identity: Readonly<{
        orderId: string;
        lineId: string;
        company: string;
    }>;
    contentMcf: string;
    originSnapshot: B1Origin;
    resolutionSnapshot: B1Resolution;
    catalogBasisSnapshot: B1CatalogBasis;
    quantityPolicySnapshot: QuantityPolicy;
    originDigest: string;
    resolutionDigest: string;
    catalogBasisDigest: string;
    quantityPolicyDigest: string;
    actor: Readonly<{
        actorRef: string;
        roleAtConfirmation: 'User' | 'Admin';
        authorityRef: string;
    }>;
    confirmedAt: string;
    kind: 'human-material-confirmation';
    validatorVersion: string;
    authorshipEvidenceRef: string;
}>;
export type B1ErrorCode = 'B1_SCHEMA_INVALID' | 'B1_VERSION_UNSUPPORTED' | 'B1_CELL_TYPE_INVALID' | 'B1_JSON_INVALID' | 'B1_NON_CANONICAL_JSON' | 'B1_MARKER_MISSING' | 'B1_MARKER_DUPLICATE' | 'B1_ITEM_MISSING' | 'B1_ITEM_DUPLICATE' | 'B1_ORPHAN_ITEM' | 'B1_MEMBERSHIP_MISMATCH' | 'B1_OWNERSHIP_MISMATCH' | 'B1_RETIRED_ITEM_ACTIVE' | 'B1_SAVED_MCF_MISMATCH' | 'B1_ORIGINAL_DATA_INVALID' | 'B1_CONFIRMATION_MISSING' | 'B1_CONFIRMATION_INVALID' | 'B1_BASIS_UNVERIFIED' | 'B1_AUTHORSHIP_UNVERIFIED' | 'B1_PHASE_STATE_MISMATCH' | 'B1_HISTORY_DEPENDENCY_NOT_READY';
export type B1Failure = Readonly<{
    ok: false;
    code: B1ErrorCode;
    dispatchPermission: 'not-granted';
}>;
type Result<T> = Readonly<{
    ok: true;
    value: T;
}> | B1Failure;
class Rejected extends Error {
    constructor(readonly code: B1ErrorCode) { super(code); }
}
function fail(code: B1ErrorCode): never { throw new Rejected(code); }
function attempt<T>(run: () => T): Result<T> {
    try {
        return Object.freeze({ ok: true, value: detach(run()) });
    }
    catch (e) {
        return Object.freeze({ ok: false, code: e instanceof Rejected ? e.code : 'B1_SCHEMA_INVALID', dispatchPermission: 'not-granted' });
    }
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function scalar(s: string) {
    for (let i = 0; i < s.length; i++) {
        const n = s.charCodeAt(i);
        if (n >= 0xd800 && n <= 0xdbff) {
            const next = s.charCodeAt(++i);
            if (!(next >= 0xdc00 && next <= 0xdfff))
                return false;
        }
        else if (n >= 0xdc00 && n <= 0xdfff)
            return false;
    }
    return true;
}
function ref(v: unknown): asserts v is string {
    if (typeof v !== 'string' || !scalar(v) || !/\S/u.test(v) || Buffer.byteLength(v, 'utf8') > 256)
        fail('B1_SCHEMA_INVALID');
}
function plain(v: unknown): v is Record<string, unknown> { return v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v)); }
function shape(v: unknown, keys: readonly string[]): asserts v is Record<string, unknown> {
    if (!plain(v) || Reflect.ownKeys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k)))
        fail('B1_SCHEMA_INVALID');
}
function version(v: unknown) {
    if (v !== 1)
        fail('B1_VERSION_UNSUPPORTED');
}
function date(v: unknown) {
    if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v)
        fail('B1_SCHEMA_INVALID');
}
function list(v: unknown, max = 100): asserts v is unknown[] {
    if (!Array.isArray(v) || v.length > max || Reflect.ownKeys(v).length !== v.length + 1)
        fail('B1_SCHEMA_INVALID');
}
/** Reject accessors, prototypes, holes, cycles and symbols BEFORE executing validators/witnesses. */
function detach<T>(v: T, depth = 0, ancestors = new Set<object>()): T {
    if (depth > 32)
        fail('B1_SCHEMA_INVALID');
    if (v === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof v))
        return v;
    if (typeof v !== 'object' || !v || ancestors.has(v) || (!Array.isArray(v) && !plain(v)))
        fail('B1_SCHEMA_INVALID');
    const ds = Object.getOwnPropertyDescriptors(v);
    if (Array.isArray(v))
        list(v, 250000);
    if (Reflect.ownKeys(v).some(k => typeof k !== 'string' || !Object.hasOwn(ds[k], 'value')))
        fail('B1_SCHEMA_INVALID');
    ancestors.add(v);
    const out = Array.isArray(v) ? v.map(x => detach(x, depth + 1, ancestors))
        : Object.fromEntries(Object.entries(ds).map(([k, d]) => [k, detach(d.value, depth + 1, ancestors)]));
    ancestors.delete(v);
    return Object.freeze(out) as T;
}
function quote(s: string) {
    if (!scalar(s))
        fail('B1_SCHEMA_INVALID');
    const short: Readonly<Record<string, string>> = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' };
    return '"' + s.replace(/["\\\u0000-\u001f]/g, c => short[c] ?? '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '"';
}
function encode(v: unknown): string {
    if (v === null)
        return 'null';
    if (typeof v === 'string')
        return quote(v);
    if (typeof v === 'boolean')
        return v ? 'true' : 'false'; // T04 typed boolean atoms/material facts.
    if (typeof v === 'number') {
        if (!Number.isSafeInteger(v) || v < 0 || Object.is(v, -0))
            fail('B1_SCHEMA_INVALID');
        return String(v);
    }
    if (Array.isArray(v))
        return '[' + v.map(encode).join(',') + ']';
    if (!plain(v))
        fail('B1_SCHEMA_INVALID');
    const keys = Object.keys(v).sort(compare);
    if (keys.some(k => !/^[\x20-\x7e]+$/.test(k)))
        fail('B1_SCHEMA_INVALID');
    return '{' + keys.map(k => quote(k) + ':' + encode(v[k])).join(',') + '}';
}
/** Byte encoder only. Domain APIs below additionally enforce exact schema/allowed nulls. */
export function canonicalB1(value: unknown): Result<string> { return attempt(() => encode(detach(value))); }
function permanent(v: unknown): asserts v is PermanentLineRef {
    shape(v, ['kind', 'orderId', 'lineId']);
    if (v.kind !== 'permanent' || !isPermanentLineId(v.lineId))
        fail('B1_SCHEMA_INVALID');
    ref(v.orderId);
}
function origin(v: unknown): asserts v is B1Origin {
    if (!plain(v))
        fail('B1_SCHEMA_INVALID');
    switch (v.kind) {
        case 'catalog-selection':
            shape(v, ['kind', 'materialIdAtSelection', 'selectionEvidenceRef']);
            ref(v.materialIdAtSelection);
            ref(v.selectionEvidenceRef);
            break;
        case 'manual-entry':
            shape(v, ['kind', 'inputEvidenceRef']);
            ref(v.inputEvidenceRef);
            break;
        case 'merge-result':
            shape(v, ['kind', 'lineageEventRef', 'resultNodeRef']);
            ref(v.lineageEventRef);
            ref(v.resultNodeRef);
            break;
        case 'reorder-copy': {
            shape(v, ['kind', 'sourceOrderId', 'sourceCompany', 'sourceLine', 'copyEvidenceRef']);
            ref(v.sourceOrderId);
            ref(v.sourceCompany);
            ref(v.copyEvidenceRef);
            const s = v.sourceLine;
            if (!plain(s))
                fail('B1_SCHEMA_INVALID');
            if (s.kind === 'permanent') {
                shape(s, ['kind', 'lineRef']);
                permanent(s.lineRef);
                if (s.lineRef.orderId !== v.sourceOrderId)
                    fail('B1_OWNERSHIP_MISMATCH');
            }
            else {
                shape(s, ['kind', 'snapshotRef', 'recordRef']);
                if (s.kind !== 'historical-record')
                    fail('B1_SCHEMA_INVALID');
                ref(s.snapshotRef);
                ref(s.recordRef);
            }
            break;
        }
        default: fail('B1_SCHEMA_INVALID');
    }
}
function digestFormat(v: unknown, prefix: string) {
    if (typeof v !== 'string' || v.length !== prefix.length + 64 || !v.startsWith(prefix) || !/^[0-9a-f]{64}$/.test(v.slice(prefix.length)))
        fail('B1_SCHEMA_INVALID');
}
function resolution(v: unknown): asserts v is B1Resolution {
    if (!plain(v))
        fail('B1_SCHEMA_INVALID');
    if (v.kind === 'catalog-resolved') {
        shape(v, ['kind', 'materialId', 'catalogBasisDigest']);
        ref(v.materialId);
        digestFormat(v.catalogBasisDigest, 'b1b:v1:');
    }
    else if (v.kind === 'custom-resolved') {
        shape(v, ['kind', 'selectionEvidenceRef', 'catalogBasisDigest']);
        ref(v.selectionEvidenceRef);
        digestFormat(v.catalogBasisDigest, 'b1b:v1:');
    }
    else {
        shape(v, ['kind', 'reason']);
        if (v.kind !== 'unresolved' || !['new-unresolved', 'catalog-missing', 'catalog-ambiguous', 'legacy-unresolved'].includes(String(v.reason)))
            fail('B1_SCHEMA_INVALID');
    }
}
function policy(v: unknown): asserts v is QuantityPolicy {
    shape(v, ['policyRef', 'basisRef', 'scale', 'minTicks', 'maxTicks', 'stepTicks', 'stepAnchor']);
    ref(v.policyRef);
    ref(v.basisRef);
    if (!Number.isInteger(v.scale) || (v.scale as number) < 0 || (v.scale as number) > 6 || Object.is(v.scale, -0) || v.stepAnchor !== 'zero')
        fail('B1_SCHEMA_INVALID');
    for (const k of ['minTicks', 'maxTicks', 'stepTicks'])
        if (typeof v[k] !== 'string' || !/^[1-9]\d{0,15}$/.test(v[k] as string) || BigInt(v[k] as string) > BigInt(Number.MAX_SAFE_INTEGER))
            fail('B1_SCHEMA_INVALID');
    if (BigInt(v.minTicks as string) > BigInt(v.maxTicks as string))
        fail('B1_SCHEMA_INVALID');
    // Structural policy validation only: T05 ticks/business checks remain with the trusted validator.
}
function basis(v: unknown): asserts v is B1CatalogBasis {
    shape(v, ['schemaVersion', 'mode', 'authorityRef', 'basisVersion', 'materialFacts', 'quantityPolicy', 'validationPolicyVersion']);
    version(v.schemaVersion);
    ref(v.authorityRef);
    ref(v.basisVersion);
    ref(v.validationPolicyVersion);
    policy(v.quantityPolicy);
    if (v.mode === 'catalog') {
        shape(v.materialFacts, ['materialId', 'itemName', 'unit', 'vendor', 'requiresRemarks']);
        for (const k of ['materialId', 'itemName', 'unit', 'vendor'])
            ref(v.materialFacts[k]);
        if (typeof v.materialFacts.requiresRemarks !== 'boolean')
            fail('B1_SCHEMA_INVALID');
    }
    else if (!['custom', 'unresolved'].includes(String(v.mode)) || v.materialFacts !== null)
        fail('B1_SCHEMA_INVALID');
}
const domains = { origin: ['mmm.b1.origin', 'b1o:v1:'], resolution: ['mmm.b1.resolution', 'b1r:v1:'], catalog: ['mmm.b1.catalog-basis', 'b1b:v1:'], quantity: ['mmm.b1.quantity-policy', 'b1q:v1:'], confirmation: ['mmm.b1.confirmation', 'b1c:v1:'] } as const;
export type B1DigestDomain = keyof typeof domains;
export type B1Digest = Readonly<{
    canonicalJson: string;
    utf8Hex: string;
    digest: string;
    fingerprint: string;
}>;
function hash(root: unknown, prefix: string): B1Digest {
    const canonicalJson = encode(root), bytes = Buffer.from(canonicalJson, 'utf8'), digest = createHash('sha256').update(bytes).digest('hex');
    return { canonicalJson, utf8Hex: bytes.toString('hex'), digest, fingerprint: prefix + digest };
}
function dg(domain: B1DigestDomain, data: unknown) { return hash([domains[domain][0], 1, data], domains[domain][1]); }
function aligned(r: B1Resolution, b: B1CatalogBasis) {
    if (r.kind === 'unresolved') {
        if (b.mode !== 'unresolved')
            fail('B1_SCHEMA_INVALID');
    }
    else if (r.catalogBasisDigest !== dg('catalog', b).fingerprint || r.kind === 'catalog-resolved' && (b.mode !== 'catalog' || b.materialFacts?.materialId !== r.materialId) || r.kind === 'custom-resolved' && b.mode !== 'custom')
        fail('B1_SCHEMA_INVALID');
}
function identity(v: unknown): asserts v is {
    orderId: string;
    lineId: string;
    company: string;
} {
    shape(v, ['orderId', 'lineId', 'company']);
    ref(v.orderId);
    ref(v.company);
    if (!isPermanentLineId(v.lineId))
        fail('B1_SCHEMA_INVALID');
}
function mcf(v: unknown) {
    if (!validateMaterialContentFingerprint(v).ok)
        fail('B1_SAVED_MCF_MISMATCH');
}
function confirmation(v: unknown): asserts v is B1ConfirmationData {
    try {
        shape(v, ['schemaVersion', 'identity', 'contentMcf', 'originSnapshot', 'resolutionSnapshot', 'catalogBasisSnapshot', 'quantityPolicySnapshot', 'originDigest', 'resolutionDigest', 'catalogBasisDigest', 'quantityPolicyDigest', 'actor', 'confirmedAt', 'kind', 'validatorVersion', 'authorshipEvidenceRef']);
        version(v.schemaVersion);
        identity(v.identity);
        mcf(v.contentMcf);
        origin(v.originSnapshot);
        resolution(v.resolutionSnapshot);
        basis(v.catalogBasisSnapshot);
        policy(v.quantityPolicySnapshot);
        if (v.resolutionSnapshot.kind === 'unresolved')
            fail('B1_CONFIRMATION_INVALID');
        aligned(v.resolutionSnapshot, v.catalogBasisSnapshot);
        if (encode(v.quantityPolicySnapshot) !== encode(v.catalogBasisSnapshot.quantityPolicy))
            fail('B1_CONFIRMATION_INVALID');
        for (const [k, domain, data] of [['originDigest', 'origin', v.originSnapshot], ['resolutionDigest', 'resolution', v.resolutionSnapshot], ['catalogBasisDigest', 'catalog', v.catalogBasisSnapshot], ['quantityPolicyDigest', 'quantity', v.quantityPolicySnapshot]] as const)
            if (v[k] !== dg(domain, data).fingerprint)
                fail('B1_CONFIRMATION_INVALID');
        shape(v.actor, ['actorRef', 'roleAtConfirmation', 'authorityRef']);
        ref(v.actor.actorRef);
        ref(v.actor.authorityRef);
        if (!['User', 'Admin'].includes(String(v.actor.roleAtConfirmation)) || v.kind !== 'human-material-confirmation')
            fail('B1_CONFIRMATION_INVALID');
        date(v.confirmedAt);
        ref(v.validatorVersion);
        ref(v.authorshipEvidenceRef);
    }
    catch (e) {
        if (e instanceof Rejected && e.code === 'B1_VERSION_UNSUPPORTED')
            throw e;
        fail('B1_CONFIRMATION_INVALID');
    }
}
export function digestB1(domain: B1DigestDomain, value: unknown): Result<B1Digest> {
    return attempt(() => {
        const data = detach(value);
        switch (domain) {
            case 'origin':
                origin(data);
                break;
            case 'resolution':
                resolution(data);
                break;
            case 'catalog':
                basis(data);
                break;
            case 'quantity':
                policy(data);
                break;
            case 'confirmation':
                confirmation(data);
                break;
            default: fail('B1_VERSION_UNSUPPORTED');
        }
        return dg(domain, data);
    });
}
export const B1_COLUMNS = Object.freeze(['Schema_Version', 'Record_Type', 'Order_ID', 'Company', 'Line_ID', 'Marker_JSON', 'Source_State_JSON', 'Original_Data', 'Saved_Content_Fingerprint', 'Catalog_Basis', 'Confirmation_Data', 'Pending_Reasons', 'Updated_At'] as const);
export type B1CurrentBasis = Readonly<{
    state: 'verified';
    evidenceRef: string;
    origin: B1Origin;
    resolution: B1Resolution;
    catalogBasis: B1CatalogBasis;
    validatorVersion: string;
    businessValid: boolean;
}> | Readonly<{
    state: 'unavailable';
}>;
