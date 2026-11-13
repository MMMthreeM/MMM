import { createHash } from 'node:crypto';
import type { OrderCellValue } from './order-read-model';

/** T04-MCF-Candidate-1 frozen bytes contract. No I/O or authorization is performed.
 * Callers must obtain these typed observations through trusted raw-data mapping;
 * a JSON object/cast cannot prove observation, ownership or business validity.
 */
export const MATERIAL_CONTENT_FIELDS = Object.freeze([
  'Material_ID', 'Item_Name', 'Original_Item_Name', 'Quantity', 'Unit', 'Vendor', 'Remarks',
] as const);
export type MaterialContentAtom = readonly ['e'] | readonly ['s', string] | readonly ['n', string] | readonly ['b', boolean];
export type McfErrorCode = 'MISSING_FIELD' | 'DUPLICATE_FIELD' | 'MISSING_VALUE' | 'UNOBSERVED'
  | 'NULL_INPUT' | 'FORMULA' | 'UNSUPPORTED_TYPE' | 'INVALID_UNICODE' | 'NON_FINITE_NUMBER'
  | 'INVALID_ATOM' | 'INVALID_PREIMAGE' | 'UNSUPPORTED_VERSION' | 'INVALID_FINGERPRINT';
export type McfFailure = Readonly<{ ok: false; code: McfErrorCode }>;
export type McfSuccess = Readonly<{
  ok: true; version: 'mcf:v1'; canonicalJson: string;
  // Detached bytes, never cached or used as an authorization capability.
  utf8Bytes: Uint8Array; digest: string; fingerprint: `mcf:v1:${string}`;
}>;
export type McfResult = McfSuccess | McfFailure;
const fail = (code: McfErrorCode): McfFailure => Object.freeze({ ok: false, code });
const isAtom = (value: MaterialContentAtom | McfFailure): value is MaterialContentAtom => Array.isArray(value);

function scalarString(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
function quote(value: string): string {
  // Do not delegate canonical string escaping to environment-specific serializers.
  const short: Readonly<Record<string, string>> = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' };
  return '"' + value.replace(/["\\\u0000-\u001f]/g, char => short[char] ?? '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')) + '"';
}
function denseArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Reflect.ownKeys(value).length === value.length + 1
    && Array.from({ length: value.length }, (_, index) => Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(index)) ?? {}, 'value')).every(Boolean);
}
function fields(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key, item]) => [key, item.value]));
}
function cellAtom(value: unknown): MaterialContentAtom | McfFailure {
  if (value === null) return fail('NULL_INPUT');
  if (value === undefined) return fail('MISSING_VALUE');
  const cell = fields(value);
  if (!cell) return fail('UNSUPPORTED_TYPE');
  if (cell.kind === 'missing-column') return fail('MISSING_FIELD');
  if (cell.kind === 'unobserved') return fail('UNOBSERVED');
  if (cell.kind === 'formula') return fail('FORMULA');
  if (cell.kind === 'unsupported') return fail('UNSUPPORTED_TYPE');
  if (cell.kind === 'no-input') return Object.keys(cell).length === 1 ? ['e'] : fail('UNSUPPORTED_TYPE');
  if (typeof cell.kind !== 'string' || !['string', 'number', 'boolean'].includes(cell.kind)) return fail('UNSUPPORTED_TYPE');
  if (cell.value === null) return fail('NULL_INPUT');
  if (cell.value === undefined) return fail('MISSING_VALUE');
  if (Object.keys(cell).length !== 2) return fail('UNSUPPORTED_TYPE');
  switch (cell.kind) {
    case 'string': return typeof cell.value !== 'string' ? fail('UNSUPPORTED_TYPE') : scalarString(cell.value) ? ['s', cell.value] : fail('INVALID_UNICODE');
    case 'boolean': return typeof cell.value === 'boolean' ? ['b', cell.value] : fail('UNSUPPORTED_TYPE');
    case 'number': {
      if (typeof cell.value !== 'number') return fail('UNSUPPORTED_TYPE');
      if (!Number.isFinite(cell.value)) return fail('NON_FINITE_NUMBER');
      const bytes = Buffer.alloc(8); bytes.writeDoubleBE(cell.value);
      return ['n', bytes.toString('hex')];
    }
    default: return fail('UNSUPPORTED_TYPE');
  }
}
function atomJson(value: unknown): string | McfFailure {
  if (!denseArray(value)) return fail('INVALID_ATOM');
  if (value[0] === 'e' && value.length === 1) return '["e"]';
  if (value.length !== 2) return fail('INVALID_ATOM');
  if (value[0] === 's' && typeof value[1] === 'string') return scalarString(value[1]) ? '["s",' + quote(value[1]) + ']' : fail('INVALID_UNICODE');
  if (value[0] === 'b' && typeof value[1] === 'boolean') return '["b",' + (value[1] ? 'true' : 'false') + ']';
  if (value[0] === 'n' && typeof value[1] === 'string' && value[1].length === 16 && /^[0-9a-f]{16}$/.test(value[1])) {
    if (!Number.isFinite(Buffer.from(value[1], 'hex').readDoubleBE())) return fail('NON_FINITE_NUMBER');
    return '["n","' + value[1] + '"]';
  }
  return fail('INVALID_ATOM');
}

/** Also validates external atoms/root/order; never hashes arbitrary bytes as mcf:v1. */
export function fingerprintMaterialPreimage(preimage: unknown): McfResult {
  if (!denseArray(preimage) || preimage.length !== 3 || preimage[0] !== 'mmm.material-content') return fail('INVALID_PREIMAGE');
  if (preimage[1] !== 1) return fail('UNSUPPORTED_VERSION');
  const pairs = preimage[2];
  if (!denseArray(pairs) || pairs.length !== MATERIAL_CONTENT_FIELDS.length) return fail('INVALID_PREIMAGE');
  const encoded: string[] = [];
  for (let i = 0; i < MATERIAL_CONTENT_FIELDS.length; i++) {
    const pair = pairs[i];
    if (!denseArray(pair) || pair.length !== 2 || pair[0] !== MATERIAL_CONTENT_FIELDS[i]) return fail('INVALID_PREIMAGE');
    const atom = atomJson(pair[1]);
    if (typeof atom !== 'string') return atom;
    encoded.push('[' + quote(MATERIAL_CONTENT_FIELDS[i]) + ',' + atom + ']');
  }
  const canonicalJson = '["mmm.material-content",1,[' + encoded.join(',') + ']]';
  const utf8Bytes = Uint8Array.from(Buffer.from(canonicalJson, 'utf8'));
  const digest = createHash('sha256').update(utf8Bytes).digest('hex');
  return Object.freeze({ ok: true, version: 'mcf:v1', canonicalJson, utf8Bytes, digest, fingerprint: `mcf:v1:${digest}` });
}

/** Canonical field names supplied AFTER trusted, unique Sheet-header mapping.
 * Non-content columns are ignored. Never fill missing observations or use OrderRow.
 */
export function fingerprintMaterialContent(columns: readonly string[], cells: readonly OrderCellValue[]): McfResult {
  if (!denseArray(columns) || columns.some(name => typeof name !== 'string') || !Array.isArray(cells) || cells.length > columns.length) return fail('UNSUPPORTED_TYPE');
  const pairs: (readonly [string, MaterialContentAtom])[] = [];
  for (const name of MATERIAL_CONTENT_FIELDS) {
    const matches = columns.flatMap((column, index) => column === name ? [index] : []);
    if (!matches.length) return fail('MISSING_FIELD');
    if (matches.length !== 1) return fail('DUPLICATE_FIELD');
    const descriptor = Object.getOwnPropertyDescriptor(cells, String(matches[0]));
    if (descriptor && !Object.hasOwn(descriptor, 'value')) return fail('UNSUPPORTED_TYPE');
    const atom = cellAtom(descriptor?.value);
    if (!isAtom(atom)) return atom;
    pairs.push([name, atom]);
  }
  return fingerprintMaterialPreimage(['mmm.material-content', 1, pairs]);
}

/** Format/version validation only, not proof of material content or authorization. */
export function validateMaterialContentFingerprint(value: unknown): Readonly<{ ok: true; fingerprint: `mcf:v1:${string}` }> | McfFailure {
  if (typeof value !== 'string') return fail('INVALID_FINGERPRINT');
  if (value.startsWith('mcf:') && !value.startsWith('mcf:v1:')) return fail('UNSUPPORTED_VERSION');
  if (value.length !== 71 || !/^mcf:v1:[0-9a-f]{64}$/.test(value)) return fail('INVALID_FINGERPRINT');
  return Object.freeze({ ok: true, fingerprint: value as `mcf:v1:${string}` });
}
