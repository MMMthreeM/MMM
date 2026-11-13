import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { digestB1, type B1CatalogBasis, type B1CurrentBasis, type B1Origin, type B1Resolution } from './order-item-state';
import { MATERIAL_CONTENT_FIELDS, fingerprintMaterialContent } from './material-content-fingerprint';
import { validateExactQuantity, type QuantityPolicy, type SevenContent } from './order-change-set';

import { plainObject, requireV2 } from './order-v2-schema';
import type { WriterActor } from './order-v2-contract';
import type { MaterialRule } from './order-domain';
import { REPORT_QUANTITY_POLICY } from './procurement';
import { canonicalMaterialText } from './material-identity';
export function procurementQuantityPolicy(rule?: MaterialRule): QuantityPolicy | null {
  if (!rule) return REPORT_QUANTITY_POLICY;
  const min = validateExactQuantity(rule.minQty, REPORT_QUANTITY_POLICY), step = validateExactQuantity(rule.stepQty, REPORT_QUANTITY_POLICY);
  return min.ok && step.ok ? { ...REPORT_QUANTITY_POLICY, basisRef: `material:${rule.id}`, minTicks: min.ticks, stepTicks: step.ticks } : null;
}
export function validateProcurementQuantity(value: number, rule?: MaterialRule): boolean {
  const policy = procurementQuantityPolicy(rule); return policy !== null && validateExactQuantity(value, policy).ok;
}

export type CatalogMaterial = Readonly<{ id: string; name: string; unit: string; vendor: string; minimum: number; step: number; requiresRemarks: boolean }>;
export type ControlledConfirmation = Readonly<{ version: 1; actorRef: string; role: 'User' | 'Admin'; company: string; intent: string; target: string; key: string; mcf: string; basisDigest: string; requestDigest: string; expiresAt: number; confirmedAt: string }>;


const value = (c: SevenContent, key: keyof SevenContent) => c[key]?.kind === 'string' ? c[key].value : '';
const dg = (domain: Parameters<typeof digestB1>[0], v: unknown) => { const r = digestB1(domain, v); requireV2(r.ok, 'B1_DIGEST_INVALID'); return r.value.fingerprint; };
function positiveTicks(value: number): string {
  requireV2(typeof value === 'number' && Number.isFinite(value) && value > 0, 'CATALOG_QUANTITY_INVALID');
  const neutral: QuantityPolicy = { policyRef: 'catalog-quantity-input', basisRef: 'catalog-quantity-input', scale: 6, minTicks: '1', maxTicks: '9007199254740991', stepTicks: '1', stepAnchor: 'zero' };
  const q = validateExactQuantity(value, neutral); requireV2(q.ok, 'CATALOG_QUANTITY_PRECISION_INVALID'); return q.ticks;
}
/** The catalog is a complete server-side raw observation, not request JSON. */
export function materialBasis(content: SevenContent, catalog: readonly CatalogMaterial[], catalogDigest: string, origin: B1Origin, mode: 'formal' | 'draft-basic', allowPendingVendor = false): B1CurrentBasis {
  const fp = fingerprintMaterialContent(MATERIAL_CONTENT_FIELDS, MATERIAL_CONTENT_FIELDS.map(k => content[k]));
  requireV2(fp.ok, 'MATERIAL_CONTENT_INVALID');
  for (const [k, max] of [['Item_Name', 200], ['Unit', 30], ['Vendor', 100], ['Remarks', 500], ['Material_ID', 256], ['Original_Item_Name', 200]] as const) requireV2(content[k].kind === 'no-input' || content[k].kind === 'string' && content[k].value.length <= max, 'MATERIAL_CONTENT_INVALID');
  requireV2(/\S/u.test(value(content, 'Item_Name')) && /\S/u.test(value(content, 'Unit')), 'MATERIAL_CONTENT_INVALID');
  const materialId = value(content, 'Material_ID'), matches = catalog.filter(m => m.id === materialId);
  requireV2(!materialId || matches.length === 1 || mode === 'draft-basic', 'CATALOG_SOURCE_UNRESOLVED');
  const m = matches[0];
  if (m) requireV2(m.name === value(content, 'Item_Name') && m.unit === value(content, 'Unit'), 'CATALOG_CONTENT_CHANGED');
  if (!m && !materialId) requireV2(!catalog.some(m => canonicalMaterialText(m.name) === canonicalMaterialText(value(content, 'Item_Name')) && canonicalMaterialText(m.unit) === canonicalMaterialText(value(content, 'Unit'))), 'CATALOG_SELECTION_REQUIRED');
  const unresolved = Boolean(materialId && !m);
  const quantityPolicy: QuantityPolicy = { policyRef: 'mmm-quantity:v2', basisRef: `catalog:${catalogDigest}:${materialId || 'custom'}`, scale: 6,
    minTicks: m ? positiveTicks(m.minimum) : '1', maxTicks: '9007199254740991', stepTicks: m ? positiveTicks(m.step) : '1', stepAnchor: 'zero' };
  const q = content.Quantity.kind === 'number' ? validateExactQuantity(content.Quantity.value, quantityPolicy, mode) : { ok: false };
  const businessValid = q.ok && (mode !== 'draft-basic' || content.Quantity.kind === 'number' && Number.isSafeInteger(content.Quantity.value))
    && (mode === 'draft-basic' || allowPendingVendor && !materialId && !value(content, 'Vendor') || ['伸泰', '益詮', '賀冠'].includes(value(content, 'Vendor')))
    && (!m?.requiresRemarks || mode === 'draft-basic' || /\S/u.test(value(content, 'Remarks')));
  const catalogBasis: B1CatalogBasis = { schemaVersion: 1, mode: unresolved ? 'unresolved' : m ? 'catalog' : 'custom', authorityRef: `catalog:${catalogDigest}`, basisVersion: 'mmm-catalog:v2',
    materialFacts: m ? { materialId: m.id, itemName: m.name, unit: m.unit, vendor: m.vendor, requiresRemarks: m.requiresRemarks } : null,
    quantityPolicy, validationPolicyVersion: 'mmm-material:v2' };
  const resolution: B1Resolution = unresolved ? { kind: 'unresolved', reason: 'catalog-missing' } : m ? { kind: 'catalog-resolved', materialId: m.id, catalogBasisDigest: dg('catalog', catalogBasis) }
    : { kind: 'custom-resolved', selectionEvidenceRef: `custom:${fp.fingerprint}`, catalogBasisDigest: dg('catalog', catalogBasis) };
  return { state: 'verified', evidenceRef: `catalog:${catalogDigest}`, origin, resolution, catalogBasis, validatorVersion: 'mmm-material:v2', businessValid };
}
function sign(payload: string, secret: string) { return createHmac('sha256', secret).update(payload).digest(); }
export function createConfirmationService(secret: string, now: () => number = Date.now) {
  requireV2(typeof secret === 'string' && Buffer.byteLength(secret) >= 32, 'CONFIRMATION_AUTHORITY_NOT_READY', 503);
  return {
    issue(actor: WriterActor, company: string, intent: string, target: string, key: string, content: SevenContent, basis: B1CurrentBasis, requestDigest: string): string {
      requireV2(basis.state === 'verified' && basis.businessValid && (actor.role === 'Admin' || actor.company === company), 'CONFIRMATION_NOT_ALLOWED', 403);
      requireV2(/^[0-9a-f]{64}$/.test(requestDigest), 'CONFIRMATION_REQUEST_BINDING_REQUIRED');
      const fp = fingerprintMaterialContent(MATERIAL_CONTENT_FIELDS, MATERIAL_CONTENT_FIELDS.map(k => content[k])); requireV2(fp.ok, 'MATERIAL_CONTENT_INVALID');
      const at = now();
      const p: ControlledConfirmation = { version: 1, actorRef: actor.email, role: actor.role, company, intent, target, key, mcf: fp.fingerprint, basisDigest: dg('catalog', basis.catalogBasis), requestDigest, expiresAt: at + 10 * 60 * 1000, confirmedAt: new Date(at).toISOString() };
      const payload = Buffer.from(JSON.stringify(['mmm.material-confirmation', p.version, p.actorRef, p.role, p.company, p.intent, p.target, p.key, p.mcf.slice(7), p.basisDigest.slice(7), p.requestDigest, p.expiresAt, p.confirmedAt])).toString('base64url');
      return `${payload}.${sign(payload, secret).toString('base64url')}`;
    },
    verify(token: unknown, actor: WriterActor, company: string, intent: string, target: string, key: string, content: SevenContent, basis: B1CurrentBasis, requestDigest: string): ControlledConfirmation {
      requireV2(typeof token === 'string' && token.length <= 4096, 'CONFIRMATION_REQUIRED');
      const parts = token.split('.'); requireV2(parts.length === 2, 'CONFIRMATION_INVALID');
      const expected = sign(parts[0], secret), actual = Buffer.from(parts[1], 'base64url');
      requireV2(actual.length === expected.length && timingSafeEqual(actual, expected), 'CONFIRMATION_INVALID');
      const data: unknown = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      requireV2(Array.isArray(data) && data.length === 13 && data[0] === 'mmm.material-confirmation' && data[1] === 1 && [2,3,4,5,6,7,8,9,10,12].every(i => typeof data[i] === 'string') && Number.isSafeInteger(data[11]), 'CONFIRMATION_INVALID');
      const p = { version: data[1], actorRef: data[2], role: data[3], company: data[4], intent: data[5], target: data[6], key: data[7], mcf: `mcf:v1:${data[8]}`, basisDigest: `b1b:v1:${data[9]}`, requestDigest: data[10], expiresAt: data[11], confirmedAt: data[12] };
      const fp = fingerprintMaterialContent(MATERIAL_CONTENT_FIELDS, MATERIAL_CONTENT_FIELDS.map(k => content[k]));
      requireV2(plainObject(p) && Object.keys(p).length === 12 && p.version === 1 && p.actorRef === actor.email && p.role === actor.role && p.company === company && p.intent === intent && p.target === target && p.key === key && fp.ok && p.mcf === fp.fingerprint && basis.state === 'verified' && p.basisDigest === dg('catalog', basis.catalogBasis) && p.requestDigest === requestDigest && /^[0-9a-f]{64}$/.test(requestDigest) && typeof p.expiresAt === 'number' && now() <= p.expiresAt && p.expiresAt <= now() + 10 * 60 * 1000 && typeof p.confirmedAt === 'string', 'CONFIRMATION_STALE_OR_MISMATCH');
      const verified = Object.freeze(p) as ControlledConfirmation;
      return verified;
    },
  };
}
