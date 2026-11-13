/**
 * Pure identity checks, deliberately not connected to Orders readers or writers.
 * Evidence and order classification must come from a trusted server caller, never
 * from request JSON or an Order_ID prefix. These checks do not grant permission.
 */
declare const identityBrand: unique symbol;
type IdentityString<Name extends string> = string & { readonly [identityBrand]: Name };

export type PermanentLineId = IdentityString<'PermanentLineId'>;
export type MaterialId = IdentityString<'MaterialId'>;
export type ClientKey = IdentityString<'ClientKey'>;
export type UiKey = IdentityString<'UiKey'>;
export type LegacyLineHash = IdentityString<'LegacyLineHash'>;
// Opaque only: no fingerprint algorithm or byte contract is implemented here.
export type MaterialContentFingerprint = IdentityString<'MaterialContentFingerprint'>;

export type PermanentLineRef = Readonly<{
  kind: 'permanent'; orderId: string; lineId: PermanentLineId;
}>;
export type NewLineRef = Readonly<{ kind: 'new'; clientKey: ClientKey }>;
export type IdentityState = 'valid-v2' | 'missing' | 'review-required' | 'integrity-error' | 'unverified';
export type OrderIdentityState = 'valid' | 'review-required' | 'error' | 'unverified';
export type IdentityCoverage = 'all-orders' | 'partial' | 'unknown';
export type IdentityReason =
  | 'LINE_ID_COLUMN_MISSING' | 'LINE_ID_MISSING' | 'LINE_ID_WHITESPACE'
  | 'UNSUPPORTED_LINE_ID_FORMAT' | 'INVALID_LINE_ID_TYPE' | 'FORMULA_LINE_ID'
  | 'DERIVED_LINE_ID' | 'RAW_EVIDENCE_MISSING' | 'GLOBAL_UNIQUENESS_UNVERIFIED'
  | 'DUPLICATE_LINE_ID' | 'INVALID_CONTEXT' | 'ORDER_CLASSIFICATION_UNVERIFIED'
  | 'ORDER_NOT_FOUND' | 'ORDER_NOT_OBSERVED' | 'OWNERSHIP_UNVERIFIED'
  | 'COMPANY_MISMATCH' | 'INVALID_LINE_REF' | 'LINE_ORDER_MISMATCH'
  | 'LINE_NOT_FOUND' | 'LINE_NOT_IN_ORDER' | 'HISTORICAL_READ_ONLY';

/** Only an observed input, not a display value or the legacy computed lineId. */
export type RawLineIdInput =
  | Readonly<{ kind: 'unobserved' | 'column-missing' | 'no-input' | 'derived' }>
  | Readonly<{ kind: 'literal'; value: unknown }>
  | Readonly<{ kind: 'formula'; formula: string }>;

export type LineIdClassification =
  | Readonly<{ kind: 'candidate-v2'; lineId: PermanentLineId }>
  | Readonly<{
      kind: Exclude<IdentityState, 'valid-v2'>;
      reason: IdentityReason;
    }>;

export type IdentityRow = Readonly<{
  orderId: unknown;
  company: unknown;
  lineId: RawLineIdInput;
}>;

export type IdentityEvidence = Readonly<{
  provenance: 'raw-orders' | 'unverified';
  coverage: IdentityCoverage;
  evidenceRef?: string;
}>;

export type TrustedOrderClassification =
  | Readonly<{ kind: 'v2' | 'historical-readonly'; evidenceRef: string }>
  | Readonly<{ kind: 'unverified' }>;

export type IdentityContext = Readonly<{
  orderId: string;
  company: string;
  classification: TrustedOrderClassification;
}>;

export type LineIdentityAssessment = Readonly<{
  // Input-array index for diagnostics only, never a persistent identity.
  rowIndex: number;
  state: IdentityState;
  lineRef: PermanentLineRef | null;
  reasonCodes: readonly IdentityReason[];
}>;

export type OrderIdentityAssessment = Readonly<{
  state: OrderIdentityState;
  classification: 'v2' | 'historical-readonly' | 'unverified';
  coverage: IdentityCoverage;
  // Identity precondition only; not authentication, business validation or permission.
  canReference: boolean;
  lines: readonly LineIdentityAssessment[];
  reasonCodes: readonly IdentityReason[];
}>;

export type LineRefResolution =
  | Readonly<{ ok: true; lineRef: PermanentLineRef }>
  | Readonly<{ ok: false; reasonCodes: readonly IdentityReason[] }>;

export interface IdentityIndex {
  readonly coverage: IdentityCoverage;
  assessOrder(context: IdentityContext): OrderIdentityAssessment;
  resolveLineRef(value: unknown, context: IdentityContext): LineRefResolution;
}

const newLineIdPattern = /^lin_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const nonblank = (value: unknown): value is string => typeof value === 'string' && /\S/u.test(value);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const reasons = (values: readonly IdentityReason[]): readonly IdentityReason[] => Object.freeze([...new Set(values)]);

/** Format only. A true result proves neither ownership nor uniqueness. */
export function isPermanentLineId(value: unknown): value is PermanentLineId {
  // The length check also rejects a trailing newline accepted by JavaScript's $.
  return typeof value === 'string' && value.length === 40 && newLineIdPattern.test(value);
}

export function classifyLineIdValue(input: RawLineIdInput): LineIdClassification {
  if (!record(input)) return { kind: 'unverified', reason: 'RAW_EVIDENCE_MISSING' };
  switch (input.kind) {
    case 'column-missing': return { kind: 'missing', reason: 'LINE_ID_COLUMN_MISSING' };
    case 'no-input': return { kind: 'missing', reason: 'LINE_ID_MISSING' };
    case 'formula': return { kind: 'integrity-error', reason: 'FORMULA_LINE_ID' };
    case 'derived': return { kind: 'integrity-error', reason: 'DERIVED_LINE_ID' };
    case 'literal':
      if (typeof input.value !== 'string') return { kind: 'integrity-error', reason: 'INVALID_LINE_ID_TYPE' };
      if (input.value === '') return { kind: 'missing', reason: 'LINE_ID_MISSING' };
      if (!nonblank(input.value)) return { kind: 'review-required', reason: 'LINE_ID_WHITESPACE' };
      if (isPermanentLineId(input.value)) return { kind: 'candidate-v2', lineId: input.value };
      return { kind: 'review-required', reason: 'UNSUPPORTED_LINE_ID_FORMAT' };
    default: return { kind: 'unverified', reason: 'RAW_EVIDENCE_MISSING' };
  }
}

/**
 * Snapshot the supplied evidence without changing it. Private maps contain only
 * identity data; historical missing IDs do not invalidate unrelated v2 orders.
 * 'all-orders' is a caller attestation, not a database scan performed by this module.
 */
export function buildIdentityIndex(
  rows: readonly IdentityRow[],
  evidence: IdentityEvidence = { provenance: 'unverified', coverage: 'unknown' },
): IdentityIndex {
  const rawVerified = evidence.provenance === 'raw-orders' && nonblank(evidence.evidenceRef);
  const entries = rows.map((row, rowIndex) => ({
    rowIndex,
    orderId: nonblank(row.orderId) ? row.orderId : null,
    company: nonblank(row.company) ? row.company : null,
    value: classifyLineIdValue(row.lineId),
  }));
  // An unobserved ID anywhere could hide a duplicate of an otherwise valid row.
  // Observed historical blanks are different: they do not hide any stored ID.
  const coverage: IdentityCoverage = rawVerified && !entries.some(row => row.value.kind === 'unverified')
    && (evidence.coverage === 'all-orders' || evidence.coverage === 'partial') ? evidence.coverage : 'unknown';
  const byOrder = new Map<string, typeof entries>();
  const byId = new Map<PermanentLineId, typeof entries>();
  for (const entry of entries) {
    if (entry.orderId !== null) {
      const group = byOrder.get(entry.orderId) ?? [];
      group.push(entry); byOrder.set(entry.orderId, group);
    }
    if (entry.value.kind === 'candidate-v2') {
      const group = byId.get(entry.value.lineId) ?? [];
      group.push(entry); byId.set(entry.value.lineId, group);
    }
  }

  const assessOrder = (context: IdentityContext): OrderIdentityAssessment => {
    const contextValid = record(context) && nonblank(context.orderId) && nonblank(context.company);
    const supplied = contextValid && record(context.classification) ? context.classification : null;
    const classification = supplied && (supplied.kind === 'v2' || supplied.kind === 'historical-readonly') && nonblank(supplied.evidenceRef)
      ? supplied.kind : 'unverified';
    const matching = contextValid ? byOrder.get(context.orderId) ?? [] : [];
    const orderReasons: IdentityReason[] = [];
    if (!contextValid) orderReasons.push('INVALID_CONTEXT');
    if (!rawVerified) orderReasons.push('RAW_EVIDENCE_MISSING');
    if (classification === 'unverified') orderReasons.push('ORDER_CLASSIFICATION_UNVERIFIED');
    if (coverage !== 'all-orders') orderReasons.push('GLOBAL_UNIQUENESS_UNVERIFIED');
    if (!matching.length) orderReasons.push(coverage === 'all-orders' && contextValid ? 'ORDER_NOT_FOUND' : 'ORDER_NOT_OBSERVED');
    const companyMismatch = rawVerified && contextValid && matching.some(row => row.company !== null && row.company !== context.company);
    const ownershipUnknown = matching.some(row => row.company === null);
    if (companyMismatch) orderReasons.push('COMPANY_MISMATCH');
    if (ownershipUnknown) orderReasons.push('OWNERSHIP_UNVERIFIED');

    const lines = matching.map((entry): LineIdentityAssessment => {
      const codes: IdentityReason[] = [];
      let state: IdentityState;
      let lineRef: PermanentLineRef | null = null;
      if (!rawVerified) {
        state = 'unverified'; codes.push('RAW_EVIDENCE_MISSING');
      } else if (companyMismatch) {
        state = 'integrity-error'; codes.push('COMPANY_MISMATCH');
      } else if (entry.value.kind === 'candidate-v2' && byId.get(entry.value.lineId)!.length > 1) {
        state = 'integrity-error'; codes.push('DUPLICATE_LINE_ID');
      } else if (entry.value.kind === 'integrity-error') {
        state = 'integrity-error'; codes.push(entry.value.reason);
      } else if (ownershipUnknown || classification === 'unverified') {
        state = 'unverified'; codes.push(ownershipUnknown ? 'OWNERSHIP_UNVERIFIED' : 'ORDER_CLASSIFICATION_UNVERIFIED');
      } else if (entry.value.kind !== 'candidate-v2') {
        state = entry.value.kind; codes.push(entry.value.reason);
      } else if (coverage !== 'all-orders') {
        state = 'unverified'; codes.push('GLOBAL_UNIQUENESS_UNVERIFIED');
      } else {
        state = 'valid-v2';
        lineRef = Object.freeze({ kind: 'permanent', orderId: context.orderId, lineId: entry.value.lineId });
      }
      return Object.freeze({ rowIndex: entry.rowIndex, state, lineRef, reasonCodes: reasons(codes) });
    });
    const state: OrderIdentityState = companyMismatch || (rawVerified && contextValid && coverage === 'all-orders' && !matching.length) || lines.some(line => line.state === 'integrity-error')
      ? 'error'
      : lines.some(line => line.state === 'missing' || line.state === 'review-required') ? 'review-required'
      : !matching.length || orderReasons.length > 0 || lines.some(line => line.state === 'unverified') ? 'unverified' : 'valid';
    return Object.freeze({
      state, classification, coverage,
      canReference: state === 'valid' && classification === 'v2',
      lines: Object.freeze(lines),
      reasonCodes: reasons([...orderReasons, ...lines.flatMap(line => line.reasonCodes)]),
    });
  };

  const resolveLineRef = (value: unknown, context: IdentityContext): LineRefResolution => {
    const fail = (...codes: IdentityReason[]): LineRefResolution => ({ ok: false, reasonCodes: reasons(codes) });
    if (!record(value) || Object.keys(value).length !== 3 || !Object.hasOwn(value, 'kind') || !Object.hasOwn(value, 'orderId') || !Object.hasOwn(value, 'lineId') || value.kind !== 'permanent' || !nonblank(value.orderId) || !isPermanentLineId(value.lineId)) return fail('INVALID_LINE_REF');
    if (!record(context) || value.orderId !== context.orderId) return fail('LINE_ORDER_MISMATCH');
    const order = assessOrder(context);
    if (order.classification === 'historical-readonly') return fail('HISTORICAL_READ_ONLY');
    if (!order.canReference) return { ok: false, reasonCodes: order.reasonCodes };
    const found = byId.get(value.lineId);
    if (!found) return fail('LINE_NOT_FOUND');
    if (found.length !== 1) return fail('DUPLICATE_LINE_ID');
    if (found[0].orderId !== context.orderId) return fail('LINE_ORDER_MISMATCH');
    if (found[0].company !== context.company) return fail('COMPANY_MISMATCH');
    return { ok: true, lineRef: Object.freeze({ kind: 'permanent', orderId: context.orderId, lineId: value.lineId }) };
  };
  return Object.freeze({ coverage, assessOrder, resolveLineRef });
}

export function assessOrderIdentity(index: IdentityIndex, context: IdentityContext): OrderIdentityAssessment {
  return index.assessOrder(context);
}

export function assessLineIdentity(index: IdentityIndex, context: IdentityContext, rowIndex: number): LineIdentityAssessment {
  return index.assessOrder(context).lines.find(line => line.rowIndex === rowIndex)
    ?? { rowIndex, state: 'integrity-error', lineRef: null, reasonCodes: ['LINE_NOT_IN_ORDER'] };
}

export function resolvePermanentLineRef(index: IdentityIndex, value: unknown, context: IdentityContext): LineRefResolution {
  return index.resolveLineRef(value, context);
}
