import 'server-only';
import type { ChangeSetRequest } from './order-change-set';
import type { R2Request } from './order-return-state';
import { plainObject, requireV2 } from './order-v2-schema';
import { writeDigest } from './order-write-plan';
import { isQueryDate } from './date-range';

export const V2_INTENTS = ['create-formal', 'create-draft', 'save-draft', 'submit-draft', 'amend-order', 'delete-order', 'create-return', 'replace-current-return', 'resubmit-order', 'complete-review', 'prepare-shipping', 'deliver-orders'] as const;
export type V2Intent = typeof V2_INTENTS[number];
export type MaterialDecision = Readonly<{ key: string; token: string | null }>;
export type V2MutationRequest = Readonly<{
  contractVersion: 2; intent: V2Intent; orderId?: string; company?: string;
  draftName?: string; expectedDate?: string; changeSet?: ChangeSetRequest;
  confirmations?: readonly MaterialDecision[]; returnRequest?: R2Request;
  reorderFrom?: Readonly<{ orderId: string; lines: readonly Readonly<{ clientKey: string; lineRef: import('./order-identity').PermanentLineRef }>[] }>;
}>;
export type SubmissionResult =
  | Readonly<{ state: 'confirmed'; attemptRef: string; orderId: string; mapping: readonly Readonly<{ clientKey: string; lineId: string }>[]; warnings: readonly string[] }>
  | Readonly<{ state: 'not-applied'; code: string; retry: 'new-request-after-correction' | 'review-required'; attemptRef?: string }>
  | Readonly<{ state: 'unknown' | 'acknowledged-unverified'; attemptRef: string; orderId: string; retry: 'prohibited'; message: string }>;
export type WriterActor = Readonly<{ email: string; name?: string; role: 'Admin' | 'User'; company: string; region: string; authorityRef: string; crews?: readonly {company:string;region:string}[] }>;
export function confirmationRequestBinding(request: V2MutationRequest): string {
  const copy = structuredClone(request);
  const { confirmations: _confirmations, ...intent } = copy; void _confirmations;
  return writeDigest(intent);
}
export function parseV2Mutation(input: unknown): V2MutationRequest {
  requireV2(plainObject(input), 'INVALID_REQUEST', 400);
  // Reject non-JSON objects, accessors, symbols and cyclic input before reading
  // fields. HTTP JSON cannot carry these, but public server APIs also fail closed.
  writeDigest(input);
  const allowed = ['contractVersion', 'intent', 'orderId', 'company', 'draftName', 'expectedDate', 'changeSet', 'confirmations', 'returnRequest', 'reorderFrom'];
  requireV2(Object.keys(input).every(k => allowed.includes(k)) && input.contractVersion === 2 && V2_INTENTS.includes(input.intent as V2Intent), 'UNSUPPORTED_CONTRACT', 400);
  for (const k of ['orderId', 'company', 'draftName', 'expectedDate']) if (input[k] !== undefined) requireV2(typeof input[k] === 'string' && (input[k] as string).length <= 256, 'INVALID_REQUEST', 400);
  const create = input.intent === 'create-formal' || input.intent === 'create-draft';
  requireV2(create ? input.orderId === undefined : typeof input.orderId === 'string' && /\S/u.test(input.orderId), 'INVALID_ORDER_INTENT', 400);
  if (input.expectedDate !== undefined) requireV2(input.intent === 'prepare-shipping' && (input.expectedDate === '' || isQueryDate(input.expectedDate)), 'INVALID_EXPECTED_DATE', 400);
  if (input.draftName !== undefined) requireV2(['create-draft', 'save-draft'].includes(input.intent as string) && typeof input.draftName === 'string' && /\S/u.test(input.draftName) && input.draftName.length <= 100, 'INVALID_DRAFT_NAME', 400);
  if (input.confirmations !== undefined) requireV2(Array.isArray(input.confirmations) && input.confirmations.length <= 100 && input.confirmations.every(d => plainObject(d) && Object.keys(d).length === 2 && typeof d.key === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(d.key) && (d.token === null || typeof d.token === 'string' && d.token.length <= 4096)), 'INVALID_CONFIRMATIONS', 400);
  const returnIntent = ['create-return', 'replace-current-return', 'resubmit-order'].includes(input.intent as string);
  requireV2(returnIntent ? plainObject(input.returnRequest) && input.returnRequest.intent === input.intent && input.returnRequest.orderId === input.orderId : input.returnRequest === undefined, 'INVALID_RETURN_REQUEST', 400);
  if (input.reorderFrom !== undefined) {
    const source = input.reorderFrom;
    requireV2(create && plainObject(source) && Object.keys(source).length === 2 && typeof source.orderId === 'string' && /\S/u.test(source.orderId) && Array.isArray(source.lines) && source.lines.length > 0 && source.lines.length <= 100, 'INVALID_REORDER_SOURCE', 400);
    requireV2(source.lines.every(l => plainObject(l) && Object.keys(l).length === 2 && typeof l.clientKey === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(l.clientKey) && plainObject(l.lineRef)) && new Set(source.lines.map(l => l.clientKey)).size === source.lines.length, 'INVALID_REORDER_SOURCE', 400);
  }
  return structuredClone(input) as V2MutationRequest;
}
export function authorizeV2Intent(actor: WriterActor, request: V2MutationRequest, company: string, status: string | null, active: boolean) {
  requireV2(actor && /\S/u.test(actor.email) && /\S/u.test(actor.authorityRef) && ['Admin', 'User'].includes(actor.role), 'UNAUTHORIZED', 403);
  requireV2(actor.role === 'Admin' || actor.company === company, 'UNAUTHORIZED', 403);
  const admin = ['create-return', 'replace-current-return', 'complete-review', 'prepare-shipping', 'deliver-orders'].includes(request.intent);
  requireV2(!admin || actor.role === 'Admin', 'UNAUTHORIZED', 403);
  requireV2(request.intent !== 'resubmit-order' || actor.role === 'User', 'CREW_REQUIRED', 403);
  const allowed: Record<V2Intent, readonly (string | null)[]> = {
    'create-formal': [null], 'create-draft': [null], 'save-draft': ['編輯中'], 'submit-draft': ['編輯中'],
    'amend-order': actor.role === 'Admin' ? ['編輯中', '處理中', '審核完畢', '準備出貨', '已送達'] : ['處理中'], 'delete-order': ['編輯中', '處理中'],
    'create-return': ['處理中', '審核完畢', '準備出貨'], 'replace-current-return': ['處理中'],
    'resubmit-order': ['處理中'], 'complete-review': ['處理中'], 'prepare-shipping': ['審核完畢'], 'deliver-orders': ['準備出貨'],
  };
  requireV2(allowed[request.intent].includes(status), 'ORDER_STATE_CHANGED');
  if (active) requireV2(['replace-current-return', 'resubmit-order'].includes(request.intent) || actor.role === 'Admin' && request.intent === 'amend-order', 'ACTIVE_RETURN_REQUIRES_RESUBMISSION');
  else requireV2(!['replace-current-return', 'resubmit-order'].includes(request.intent), 'ACTIVE_RETURN_REQUIRED');
}
