import { buildIdentityIndex, type PermanentLineRef, type RawLineIdInput, type IdentityContext } from './order-identity';
import { fingerprintMaterialContent, validateMaterialContentFingerprint, MATERIAL_CONTENT_FIELDS } from './material-content-fingerprint';

type Cell = Parameters<typeof fingerprintMaterialContent>[1][number];
export type ProposedCell = Readonly<{ kind: 'no-input' }> | Readonly<{ kind: 'string'; value: string }>
  | Readonly<{ kind: 'number'; value: number }> | Readonly<{ kind: 'boolean'; value: boolean }>;
export type SevenContent = Readonly<Record<typeof MATERIAL_CONTENT_FIELDS[number], ProposedCell>>;
export type SourceRef = PermanentLineRef | Readonly<{ kind: 'new'; clientKey: string }>;
export type ExpectedLine = Readonly<{ lineRef: PermanentLineRef; expectedMcf: string }>;
export type ChangeSetRequest = Readonly<{
  contractVersion: 2; changeSetVersion: 1;
  target: Readonly<{ kind: 'existing-order'; orderId: string }> | Readonly<{ kind: 'create-order' }>;
  expectations: Readonly<{ scope: 'whole-order' | 'touched-lines'; expectedStatus: string; lines: readonly ExpectedLine[] }> | Readonly<{ scope: 'new-order' }>;
  changed: readonly Readonly<{ lineRef: PermanentLineRef; after: SevenContent }>[];
  added: readonly Readonly<{ clientKey: string; purpose: 'new-line' | 'merge-result'; content: SevenContent }>[];
  removed: readonly PermanentLineRef[];
  merged: readonly Readonly<{ sources: readonly SourceRef[]; resultClientKey: string }>[];
}>;
import { checkedPolicy, ticks, numberFromTicks, QuantityError, MAX_TICKS, type QuantityPolicy } from './exact-quantity';
export { validateExactQuantity, sumExactQuantities } from './exact-quantity';
export type { QuantityPolicy } from './exact-quantity';
/** Same public OrderCellValue representation (inferred from T04), AFTER the A0
 * parser and trusted canonical header mapping. Never a business GET/OrderRow.
 * Coverage, classifications, validators and readiness are SERVER dependencies;
 * this pure evaluator cannot authenticate their external origin. No default policy.
 */
export type PlannerSnapshot = Readonly<{
  kind: 'typed-raw-orders'; provenance: 'raw-orders'; snapshotRef: string; coverage: 'all-orders' | 'partial' | 'unknown';
  columns: readonly string[]; rows: readonly (readonly Cell[])[];
}>;
export type SourceQuery = Readonly<{ orderId: string; company: string; snapshot: PlannerSnapshot }>;
export type PlannerDependencies = Readonly<{
  snapshot: PlannerSnapshot;
  coverageEvidence: Readonly<{ observationRef: string; evidenceRef: string }>;
  actor: Readonly<{ authenticated: boolean; principalRef: string; evidenceRef: string; role: 'Admin' | 'User'; scope: 'admin' | 'company'; company: string }>;
  operation: Readonly<{
    kind: 'admin-edit' | 'crew-edit' | 'create-order'; company: string; evidenceRef: string;
    expectedScope: 'whole-order' | 'touched-lines' | 'new-order'; allowedStatuses: readonly string[];
    validation: 'formal' | 'draft-basic'; allowDecimals: boolean;
  }>;
  // Adapter must delegate provenance classification to the existing A0 classifier.
  // We consume its bound result, never implement prefix/status/UUID classification.
  sourceProvider?: Readonly<{ classify(query: SourceQuery): Promise<Readonly<{
    kind: 'v2' | 'historical-readonly' | 'unknown-readonly'; orderId: string; company: string; observationRef: string; evidenceRef: string;
  }>> | Readonly<{ kind: 'v2' | 'historical-readonly' | 'unknown-readonly'; orderId: string; company: string; observationRef: string; evidenceRef: string }> }>;
  creation?: Readonly<{ candidateOrderId: string; company: string; observationRef: string; evidenceRef: string; generation: 'ready'; uniqueness: 'verified-unused' }>;
  readiness: Readonly<{ observationRef: string; b1?: string; h2: string; r2: string; lifecycle: string; materialValidation: string; atomicWrite: string; resultVerification: string }>;
  quantityPolicy(content: SevenContent): QuantityPolicy | null;
  validateContent(content: SevenContent, phase: 'changed' | 'added' | 'merged' | 'final', before?: SevenContent): Readonly<{ ok: boolean; evidenceRef: string }>;
}>;
export type SourceEdit = Readonly<{ lineRef: PermanentLineRef; beforeMcf: string; afterContent: SevenContent; afterMcf: string; outcome: 'survives' | 'consumed-by-merge' }>;
export type FinalLine = Readonly<{ kind: 'existing'; lineRef: PermanentLineRef; disposition: 'preserved' | 'changed'; content: SevenContent }>
  | Readonly<{ kind: 'new'; clientKey: string; content: SevenContent }>;
export type MergeNodePlan = Readonly<{ resultClientKey: string; directSources: readonly SourceRef[]; leafSources: readonly SourceRef[]; content: SevenContent; contentMcf: string; persistence: 'final' | 'temporary-only' }>;
export type PlannedRetirement = Readonly<{ lineRef: PermanentLineRef; beforeMcf: string; reason: 'removed' | 'merged'; finalResultClientKey?: string }>;
export type ChangeSetPlan = Readonly<{
  kind: 'planned'; dispatchPermission: 'not-granted'; allocation: 'not-performed';
  finalLines: readonly FinalLine[]; sourceEdits: readonly SourceEdit[]; mergeNodes: readonly MergeNodePlan[];
  semanticRetirements: readonly PlannedRetirement[];
  allocationSlots: readonly Readonly<{ clientKey: string; state: 'awaiting-server-allocation' }>[];
  nonPersistentClientKeys: readonly string[];
}>;
export type ChangeSetError = 'UNSUPPORTED_CHANGESET_VERSION' | 'INVALID_CHANGESET' | 'MIXED_IDENTITY_CONTRACT'
  | 'CHANGESET_LIMIT_EXCEEDED' | 'UNAUTHORIZED' | 'RAW_COVERAGE_UNVERIFIED' | 'SOURCE_NOT_TRUSTED'
  | 'LINE_ID_INTEGRITY_ERROR' | 'LINE_REF_INVALID' | 'ORDER_STATE_CHANGED' | 'ORDER_CONTENT_CHANGED'
  | 'EXPECTED_SCOPE_INVALID' | 'DEPENDENCIES_NOT_READY' | 'CREATE_PREPARATION_UNVERIFIED'
  | 'DUPLICATE_OPERATION' | 'CHANGESET_CONFLICT' | 'CLIENT_KEY_DUPLICATE' | 'CONTENT_INVALID'
  | 'SOURCE_CHANGE_INVALID' | 'MERGE_RESULT_DEFINITION_INVALID' | 'MERGE_SOURCE_NOT_FOUND'
  | 'MERGE_SELF_REFERENCE' | 'MERGE_CYCLE' | 'MERGE_SOURCE_REUSED' | 'MERGE_CONTENT_INCOMPATIBLE'
  | 'MERGE_ORIGINAL_NAME_CONFLICT' | 'MERGE_RESULT_MISMATCH' | 'QUANTITY_POLICY_NOT_READY'
  | 'QUANTITY_POLICY_CONFLICT' | 'QUANTITY_INVALID' | 'QUANTITY_PRECISION_INVALID'
  | 'QUANTITY_PRECISION_AMBIGUOUS' | 'QUANTITY_OVERFLOW' | 'QUANTITY_RULE_VIOLATION'
  | 'DECIMAL_NOT_ENABLED' | 'PLANNER_INTERNAL_ERROR';
class Rejection extends Error { constructor(readonly code: ChangeSetError) { super(code); } }
function reject(code: ChangeSetError): never { throw new Rejection(code); }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 500 && /\S/u.test(v);
const key = (v: unknown): v is string => typeof v === 'string' && v.length <= 64 && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.exec(v)?.[0] === v;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function shape(v: unknown, names: readonly string[]): asserts v is Record<string, unknown> {
  if (!object(v) || Object.keys(v).length !== names.length || names.some(n => !Object.hasOwn(v, n))) reject('INVALID_CHANGESET');
}
function list(v: unknown, max: number): asserts v is unknown[] {
  if (!Array.isArray(v)) reject('INVALID_CHANGESET');
  if (v.length > max) reject('CHANGESET_LIMIT_EXCEEDED');
  if (Array.from({ length: v.length }, (_, i) => Object.hasOwn(v, i)).some(found => !found)) reject('INVALID_CHANGESET');
}
// Detach data without calling getters/coercion; reject non-JSON structures/cycles.
function cloneData<T>(value: T, depth = 0, path = new Set<object>()): T {
  if (depth > 16) reject('CHANGESET_LIMIT_EXCEEDED');
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
  if (typeof value !== 'object' || !value || path.has(value) || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) reject('INVALID_CHANGESET');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value) && (value.length > 250000 || Reflect.ownKeys(value).length !== value.length + 1
    || Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).some(found => !found))) reject('CHANGESET_LIMIT_EXCEEDED');
  if (Reflect.ownKeys(value).some(k => typeof k !== 'string' || (!Array.isArray(value) || k !== 'length') && !Object.hasOwn(descriptors[k], 'value'))) reject('INVALID_CHANGESET');
  path.add(value);
  const copy = Array.isArray(value) ? value.map(item => cloneData(item, depth + 1, path))
    : Object.fromEntries(Object.entries(descriptors).map(([k, d]) => [k, cloneData(d.value, depth + 1, path)]));
  path.delete(value); return Object.freeze(copy) as T;
}
function fingerprint(content: SevenContent) {
  const result = fingerprintMaterialContent(MATERIAL_CONTENT_FIELDS, MATERIAL_CONTENT_FIELDS.map(name => content[name]));
  if (!result.ok) reject('CONTENT_INVALID');
  return result;
}
function content(v: unknown): asserts v is SevenContent {
  shape(v, MATERIAL_CONTENT_FIELDS);
  for (const name of MATERIAL_CONTENT_FIELDS) {
    const cell = v[name];
    if (!object(cell) || !['no-input', 'string', 'number', 'boolean'].includes(String(cell.kind))) reject('CONTENT_INVALID');
    if (cell.kind === 'string' && (typeof cell.value !== 'string' || cell.value.length > 500)) reject('CONTENT_INVALID');
  }
  fingerprint(v as SevenContent);
}
function idInput(cell: Cell): RawLineIdInput {
  switch (cell.kind) {
    case 'no-input': return { kind: 'no-input' };
    case 'missing-column': return { kind: 'column-missing' };
    case 'unobserved': return { kind: 'unobserved' };
    case 'formula': return { kind: 'formula', formula: cell.value };
    case 'string': case 'number': case 'boolean': return { kind: 'literal', value: cell.value };
    default: return { kind: 'unobserved' };
  }
}
const refKey = (ref: SourceRef) => ref.kind === 'new' ? '1:' + ref.clientKey : '0:' + JSON.stringify([ref.orderId, ref.lineId]);

function quantity(c: SevenContent, p: QuantityPolicy, op: PlannerDependencies['operation']): bigint {
  if (c.Quantity.kind !== 'number') reject('QUANTITY_INVALID');
  const t = ticks(c.Quantity.value, p);
  if (!op.allowDecimals && t % (BigInt(10) ** BigInt(p.scale)) !== BigInt(0)) reject('DECIMAL_NOT_ENABLED');
  if (op.validation === 'formal' && (t < BigInt(p.minTicks) || t % BigInt(p.stepTicks) !== BigInt(0))) reject('QUANTITY_RULE_VIOLATION');
  return t;
}

function deriveMergedContent(contents: readonly SevenContent[], policies: readonly QuantityPolicy[], op: PlannerDependencies['operation']) {
  const common = contents[0];
  for (const c of contents) for (const name of MATERIAL_CONTENT_FIELDS.filter(name => name !== 'Quantity')) {
    const a = c[name], b = common[name];
    if (a.kind !== b.kind || ('value' in a && (!('value' in b) || !Object.is(a.value, b.value)))) reject(name === 'Original_Item_Name' ? 'MERGE_ORIGINAL_NAME_CONFLICT' : 'MERGE_CONTENT_INCOMPATIBLE');
  }
  const p = policies[0], policyKey = (q: QuantityPolicy) => JSON.stringify([q.policyRef, q.basisRef, q.scale, q.minTicks, q.maxTicks, q.stepTicks, q.stepAnchor]);
  if (policies.some(other => policyKey(other) !== policyKey(p))) reject('QUANTITY_POLICY_CONFLICT');
  const sum = contents.reduce((total, c) => total + quantity(c, p, op), BigInt(0));
  if (sum > BigInt(p.maxTicks) || sum > MAX_TICKS) reject('QUANTITY_OVERFLOW');
  const value = numberFromTicks(sum, p.scale);
  if (ticks(value, p) !== sum) reject('QUANTITY_PRECISION_AMBIGUOUS');
  return { derived: cloneData({ ...common, Quantity: { kind: 'number' as const, value } }), p, policyKey };
}
/** Read-only preview uses the SAME frozen merge computation as the Planner.
 * No source authority, allocation, confirmation or dispatch permission is implied.
 */
export function previewExactMerge(contents: readonly SevenContent[], policies: readonly QuantityPolicy[], validation: 'formal' | 'draft-basic') {
  try {
    list(contents, 100); list(policies, 100);
    if (contents.length < 2 || contents.length !== policies.length || !['formal', 'draft-basic'].includes(validation)) reject('MERGE_RESULT_DEFINITION_INVALID');
    const cs = cloneData(contents); cs.forEach(content);
    const { derived } = deriveMergedContent(cs, policies.map(checkedPolicy), { kind: 'crew-edit', company: 'preview-only', evidenceRef: 'preview-only', expectedScope: 'touched-lines', allowedStatuses: [], validation, allowDecimals: validation === 'formal' });
    return { ok: true as const, content: derived, dispatchPermission: 'not-granted' as const };
  } catch (e) { return { ok: false as const, code: e instanceof Rejection || e instanceof QuantityError ? e.code as ChangeSetError : 'CONTENT_INVALID', dispatchPermission: 'not-granted' as const }; }
}

/** Offline semantic planner. Injected providers/validators must be trusted and
 * side-effect free. No freshness/lock/dispatch/retirement persistence is certified.
 */
export async function planOrderChangeSet(input: unknown, deps: PlannerDependencies): Promise<ChangeSetPlan | Readonly<{ kind: 'deny'; code: ChangeSetError; dispatchPermission: 'not-granted' }>> {
  try {
    const request = cloneData(input);
    if (!object(request)) reject('INVALID_CHANGESET');
    if (request.contractVersion !== 2 || request.changeSetVersion !== 1) reject('UNSUPPORTED_CHANGESET_VERSION');
    if (['lineId', 'expectedLineIds', 'targetLineIds', 'role', 'Company', 'source', 'policy', 'readiness'].some(k => Object.hasOwn(request, k))) reject('MIXED_IDENTITY_CONTRACT');
    shape(request, ['contractVersion', 'changeSetVersion', 'target', 'expectations', 'changed', 'added', 'removed', 'merged']);
    list(request.changed, 100); list(request.added, 256); list(request.removed, 100); list(request.merged, 128);
    if (request.changed.length + request.added.length + request.removed.length + request.merged.length > 512 || Buffer.byteLength(JSON.stringify(request), 'utf8') > 524288) reject('CHANGESET_LIMIT_EXCEEDED');
    const snapshot = cloneData(deps.snapshot), actor = cloneData(deps.actor), op = cloneData(deps.operation), readiness = cloneData(deps.readiness), creation = cloneData(deps.creation), coverage = cloneData(deps.coverageEvidence);
    const sourceProvider = deps.sourceProvider, policyFor = deps.quantityPolicy, validator = deps.validateContent;
    if (!actor || actor.authenticated !== true || !text(actor.evidenceRef) || !text(actor.principalRef) || !['Admin', 'User'].includes(actor.role) || !text(op?.company) || !text(op.evidenceRef)
      || (op.kind === 'admin-edit' || op.kind === 'create-order' && actor.role === 'Admin' ? actor.role !== 'Admin' || actor.scope !== 'admin' : actor.scope !== 'company' || actor.company !== op.company)) reject('UNAUTHORIZED');
    if (!['admin-edit', 'crew-edit', 'create-order'].includes(op.kind) || !['formal', 'draft-basic'].includes(op.validation) || typeof op.allowDecimals !== 'boolean' || !Array.isArray(op.allowedStatuses)) reject('DEPENDENCIES_NOT_READY');
    if (op.kind === 'admin-edit' && op.expectedScope !== 'whole-order' || op.kind === 'crew-edit' && op.expectedScope !== 'touched-lines' || op.kind === 'create-order' && op.expectedScope !== 'new-order') reject('EXPECTED_SCOPE_INVALID');
    if (!snapshot || snapshot.kind !== 'typed-raw-orders' || snapshot.provenance !== 'raw-orders' || snapshot.coverage !== 'all-orders' || !text(snapshot.snapshotRef)
      || coverage?.observationRef !== snapshot.snapshotRef || !text(coverage.evidenceRef)) reject('RAW_COVERAGE_UNVERIFIED');
    if (!Array.isArray(snapshot.columns) || !Array.isArray(snapshot.rows) || !snapshot.columns.length || snapshot.columns.length > 1024 || snapshot.rows.length * snapshot.columns.length > 250000
      || snapshot.columns.some(n => typeof n !== 'string') || new Set(snapshot.columns).size !== snapshot.columns.length) reject('RAW_COVERAGE_UNVERIFIED');
    const column = (name: string) => { const i = snapshot.columns.indexOf(name); if (i < 0) reject('RAW_COVERAGE_UNVERIFIED'); return i; };
    const oc = column('Order_ID'), cc = column('Req_Company'), sc = column('Status'), ic = column('Line_ID');
    MATERIAL_CONTENT_FIELDS.forEach(column);
    const literal = (cell: Cell): string | null => cell?.kind === 'string' && text(cell.value) ? cell.value : null;
    const rows = snapshot.rows.map(row => {
      if (!Array.isArray(row) || row.length !== snapshot.columns.length || Array.from(row).some(c => !c || ['unobserved', 'unsupported', 'missing-column'].includes(c.kind))) reject('RAW_COVERAGE_UNVERIFIED');
      const orderId = literal(row[oc]);
      if (!orderId && !row.every(c => c.kind === 'no-input' || c.kind === 'string' && c.value === '')) reject('RAW_COVERAGE_UNVERIFIED');
      return { orderId, company: literal(row[cc]), lineId: idInput(row[ic]), status: literal(row[sc]), cells: row };
    });
    const index = buildIdentityIndex(rows, { provenance: 'raw-orders', coverage: 'all-orders', evidenceRef: snapshot.snapshotRef });
    if (index.coverage !== 'all-orders') reject('RAW_COVERAGE_UNVERIFIED');
    if (!object(request.target) || !object(request.expectations) || request.expectations.scope !== op.expectedScope) reject('EXPECTED_SCOPE_INVALID');
    const isNew = request.target.kind === 'create-order';
    let orderId: string;
    if (isNew) {
      shape(request.target, ['kind']); shape(request.expectations, ['scope']);
      if (op.kind !== 'create-order' || !creation || creation.company !== op.company || creation.observationRef !== snapshot.snapshotRef || !text(creation.evidenceRef) || !text(creation.candidateOrderId) || creation.generation !== 'ready' || creation.uniqueness !== 'verified-unused') reject('CREATE_PREPARATION_UNVERIFIED');
      orderId = creation.candidateOrderId;
      if (!index.assessOrder({ orderId, company: op.company, classification: { kind: 'unverified' } }).reasonCodes.includes('ORDER_NOT_FOUND')) reject('CREATE_PREPARATION_UNVERIFIED');
    } else {
      shape(request.target, ['kind', 'orderId']);
      if (request.target.kind !== 'existing-order' || !text(request.target.orderId) || op.kind === 'create-order') reject('INVALID_CHANGESET');
      orderId = request.target.orderId;
    }
    const originalRows = rows.filter(row => row.orderId === orderId);
    if (originalRows.length > 100) reject('CHANGESET_LIMIT_EXCEEDED');
    let identityContext: IdentityContext = { orderId, company: op.company, classification: { kind: 'unverified' } };
    if (!isNew) {
      if (!originalRows.length || originalRows.some(row => row.company !== op.company)) reject('UNAUTHORIZED');
      if (!sourceProvider || typeof sourceProvider.classify !== 'function') reject('SOURCE_NOT_TRUSTED');
      let source: Awaited<ReturnType<typeof sourceProvider.classify>>;
      try { source = await sourceProvider.classify(Object.freeze({ orderId, company: op.company, snapshot })); }
      catch { reject('SOURCE_NOT_TRUSTED'); }
      if (!source || source.kind !== 'v2' || source.orderId !== orderId || source.company !== op.company || source.observationRef !== snapshot.snapshotRef || !text(source.evidenceRef)) reject('SOURCE_NOT_TRUSTED');
      identityContext = { ...identityContext, classification: { kind: 'v2', evidenceRef: source.evidenceRef } };
      if (!index.assessOrder(identityContext).canReference) reject('LINE_ID_INTEGRITY_ERROR');
      shape(request.expectations, ['scope', 'expectedStatus', 'lines']);
      const status = originalRows[0].status;
      if (!status || originalRows.some(row => row.status !== status) || request.expectations.expectedStatus !== status || !op.allowedStatuses.includes(status)) reject('ORDER_STATE_CHANGED');
    }
    const required = ['h2', 'r2', 'lifecycle', 'materialValidation', 'atomicWrite', 'resultVerification'] as const;
    if (!readiness || readiness.observationRef !== snapshot.snapshotRef || required.some(name => !text(readiness[name])) || (op.validation === 'draft-basic' || originalRows.some(row => row.status === '編輯中')) && !text(readiness.b1)
      || typeof policyFor !== 'function' || typeof validator !== 'function') reject('DEPENDENCIES_NOT_READY');
    type Line = { ref: SourceRef; content: SevenContent; mcf: string; depth: number; leaves: SourceRef[] };
    const existing = new Map<string, Line>(), effective = new Map<string, Line>();
    for (const row of originalRows) {
      const result = index.assessOrder(identityContext).lines.find(line => line.lineRef?.lineId === (row.lineId.kind === 'literal' ? row.lineId.value : null));
      if (!result?.lineRef) reject('LINE_ID_INTEGRITY_ERROR');
      const c = Object.freeze(Object.fromEntries(MATERIAL_CONTENT_FIELDS.map(name => [name, row.cells[column(name)]]))); content(c);
      const line: Line = { ref: result.lineRef, content: c, mcf: fingerprint(c).fingerprint, depth: 0, leaves: [result.lineRef] };
      existing.set(refKey(result.lineRef), line); effective.set(refKey(result.lineRef), line);
    }
    const resolve = (value: unknown): PermanentLineRef => { const r = index.resolveLineRef(value, identityContext); if (!r.ok) reject('LINE_REF_INVALID'); return r.lineRef; };
    const changed = new Map<string, { ref: PermanentLineRef; after: SevenContent }>(), removed = new Map<string, PermanentLineRef>();
    for (const item of request.changed) { shape(item, ['lineRef', 'after']); const ref = resolve(item.lineRef), k = refKey(ref); if (changed.has(k)) reject('DUPLICATE_OPERATION'); content(item.after); changed.set(k, { ref, after: item.after }); }
    for (const item of request.removed) { const ref = resolve(item), k = refKey(ref); if (removed.has(k)) reject('DUPLICATE_OPERATION'); if (changed.has(k)) reject('CHANGESET_CONFLICT'); removed.set(k, ref); }
    const added = new Map<string, { purpose: 'new-line' | 'merge-result'; content: SevenContent }>();
    for (const item of request.added) {
      shape(item, ['clientKey', 'purpose', 'content']); if (!key(item.clientKey) || !['new-line', 'merge-result'].includes(String(item.purpose))) reject('INVALID_CHANGESET');
      if (added.has(item.clientKey)) reject('CLIENT_KEY_DUPLICATE'); content(item.content);
      added.set(item.clientKey, { purpose: item.purpose as 'new-line' | 'merge-result', content: item.content });
    }
    const nodes = new Map<string, SourceRef[]>(), consumed = new Set<string>(), consumer = new Map<string, string>(); let edges = 0;
    for (const node of request.merged) {
      shape(node, ['sources', 'resultClientKey']); if (!key(node.resultClientKey) || nodes.has(node.resultClientKey) || added.get(node.resultClientKey)?.purpose !== 'merge-result') reject('MERGE_RESULT_DEFINITION_INVALID');
      list(node.sources, 100); if (node.sources.length < 2) reject('MERGE_RESULT_DEFINITION_INVALID');
      edges += node.sources.length; if (edges > 512) reject('CHANGESET_LIMIT_EXCEEDED');
      const refs = node.sources.map(v => {
        let ref: SourceRef;
        if (object(v) && v.kind === 'new') { shape(v, ['kind', 'clientKey']); if (!key(v.clientKey) || !added.has(v.clientKey)) reject('MERGE_SOURCE_NOT_FOUND'); if (v.clientKey === node.resultClientKey) reject('MERGE_SELF_REFERENCE'); ref = { kind: 'new', clientKey: v.clientKey }; }
        else ref = resolve(v);
        const k = refKey(ref); if (removed.has(k)) reject('CHANGESET_CONFLICT'); if (consumed.has(k)) reject('MERGE_SOURCE_REUSED');
        consumed.add(k); consumer.set(k, node.resultClientKey as string); return ref;
      }).sort((a, b) => compare(refKey(a), refKey(b)));
      nodes.set(node.resultClientKey, refs);
    }
    for (const [k, item] of added) if (item.purpose === 'merge-result' && !nodes.has(k)) reject('MERGE_RESULT_DEFINITION_INVALID');
    const touched = new Set([...changed.keys(), ...removed.keys(), ...consumed].filter(k => k.startsWith('0:')));
    if (!isNew) {
      list(request.expectations.lines, 100); const expected = new Map<string, string>();
      for (const item of request.expectations.lines) {
        shape(item, ['lineRef', 'expectedMcf']); const ref = resolve(item.lineRef), k = refKey(ref);
        if (expected.has(k)) reject('DUPLICATE_OPERATION'); if (!validateMaterialContentFingerprint(item.expectedMcf).ok || typeof item.expectedMcf !== 'string') reject('ORDER_CONTENT_CHANGED'); expected.set(k, item.expectedMcf);
      }
      const scope = op.expectedScope === 'whole-order' ? new Set(existing.keys()) : touched;
      if (expected.size !== scope.size || [...scope].some(k => !expected.has(k)) || [...expected].some(([k, mcf]) => existing.get(k)?.mcf !== mcf)) reject('ORDER_CONTENT_CHANGED');
    }
    const validate = (c: SevenContent, phase: 'changed' | 'added' | 'merged' | 'final', before?: SevenContent) => {
      const result = validator(c, phase, before); if (!result || result.ok !== true || !text(result.evidenceRef)) reject(phase === 'changed' ? 'SOURCE_CHANGE_INVALID' : 'CONTENT_INVALID');
      const p = checkedPolicy(policyFor(c)); quantity(c, p, op); return p;
    };
    for (const [k, item] of [...changed].sort(([a], [b]) => compare(a, b))) { const old = existing.get(k)!; validate(item.after, 'changed', old.content); effective.set(k, { ...old, content: item.after, mcf: fingerprint(item.after).fingerprint }); }
    for (const [k, item] of [...added].sort(([a], [b]) => compare(a, b))) if (item.purpose === 'new-line') { validate(item.content, 'added'); const ref = { kind: 'new' as const, clientKey: k }; effective.set(refKey(ref), { ref, content: item.content, mcf: fingerprint(item.content).fingerprint, depth: 0, leaves: [ref] }); }
    const mergeNodes: MergeNodePlan[] = [], pending = new Map(nodes);
    while (pending.size) {
      const ready = [...pending].filter(([, sources]) => sources.every(ref => effective.has(refKey(ref)))).map(([k]) => k).sort(compare);
      if (!ready.length) reject('MERGE_CYCLE');
      const k = ready[0], sources = pending.get(k)!, sourceLines = sources.map(ref => effective.get(refKey(ref))!);
      const depth = 1 + Math.max(...sourceLines.map(line => line.depth)); if (depth > 16) reject('CHANGESET_LIMIT_EXCEEDED');
      const { derived, p, policyKey } = deriveMergedContent(sourceLines.map(line => line.content), sourceLines.map(line => checkedPolicy(policyFor(line.content))), op);
      if (fingerprint(derived).canonicalJson !== fingerprint(added.get(k)!.content).canonicalJson) reject('MERGE_RESULT_MISMATCH');
      const resultPolicy = validate(derived, 'merged'); if (policyKey(resultPolicy) !== policyKey(p)) reject('QUANTITY_POLICY_CONFLICT');
      const leaves = sourceLines.flatMap(line => line.leaves).sort((a, b) => compare(refKey(a), refKey(b)));
      const ref = { kind: 'new' as const, clientKey: k }, mcf = fingerprint(derived).fingerprint;
      effective.set(refKey(ref), { ref, content: derived, mcf, depth, leaves }); pending.delete(k);
      mergeNodes.push({ resultClientKey: k, directSources: sources, leafSources: leaves, content: derived, contentMcf: mcf, persistence: consumed.has(refKey(ref)) ? 'temporary-only' : 'final' });
    }
    const final = [...effective].filter(([k]) => !removed.has(k) && !consumed.has(k)).sort(([a], [b]) => compare(a, b));
    if (!final.length || final.length > 100) reject('CHANGESET_LIMIT_EXCEEDED');
    const finalLines: FinalLine[] = final.map(([k, line]) => { validate(line.content, 'final'); return line.ref.kind === 'permanent'
      ? { kind: 'existing', lineRef: line.ref, disposition: changed.has(k) ? 'changed' : 'preserved', content: line.content }
      : { kind: 'new', clientKey: line.ref.clientKey, content: line.content }; });
    const semanticRetirements: PlannedRetirement[] = [];
    for (const [k, line] of [...existing].sort(([a], [b]) => compare(a, b))) {
      if (line.ref.kind !== 'permanent' || !removed.has(k) && !consumed.has(k)) continue;
      let destination = consumer.get(k);
      while (destination && consumer.has('1:' + destination)) destination = consumer.get('1:' + destination);
      semanticRetirements.push({ lineRef: line.ref, beforeMcf: line.mcf, reason: removed.has(k) ? 'removed' : 'merged', ...(destination ? { finalResultClientKey: destination } : {}) });
    }
    const sourceEdits: SourceEdit[] = [...changed].sort(([a], [b]) => compare(a, b)).map(([k, edit]) => ({ lineRef: edit.ref, beforeMcf: existing.get(k)!.mcf, afterContent: edit.after, afterMcf: effective.get(k)!.mcf, outcome: consumed.has(k) ? 'consumed-by-merge' : 'survives' }));
    const allocationSlots = [...added.keys()].filter(k => !consumed.has('1:' + k)).sort(compare).map(clientKey => ({ clientKey, state: 'awaiting-server-allocation' as const }));
    return cloneData({ kind: 'planned', dispatchPermission: 'not-granted', allocation: 'not-performed', finalLines, sourceEdits, mergeNodes, semanticRetirements, allocationSlots, nonPersistentClientKeys: [...added.keys()].filter(k => consumed.has('1:' + k)).sort(compare) } as const);
  } catch (error) {
    return Object.freeze({ kind: 'deny', code: error instanceof Rejection ? error.code : 'PLANNER_INTERNAL_ERROR', dispatchPermission: 'not-granted' });
  }
}
