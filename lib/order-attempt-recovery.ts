import type { EditorState, FormMode } from './order-form-state';

// Untrusted, tab-local DISPLAY recovery. Never a mutation request, confirmation
// token, private Attempt, identity witness or permission to retry.
export type AttemptRecovery = Readonly<{ version: 1; scope: string; attemptRef: string | null; mode: FormMode; draftName: string; lines: readonly Readonly<{ key: string; content: EditorState['lines'][number]['content']; checked: boolean }>[]; dispositions: readonly Readonly<{ source: string; result: string; reason: string }>[] }>;
export const RECOVERY_MAX_BYTES = 1024 * 1024;
const fields = ['Material_ID', 'Item_Name', 'Original_Item_Name', 'Quantity', 'Unit', 'Vendor', 'Remarks'] as const;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const shape = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const modes = ['new-formal', 'new-draft', 'edit-draft', 'edit-pending', 'resubmit', 'reorder'];
export function parseAttemptRecovery(text: string, scope: string): AttemptRecovery | null {
  try {
    if (new TextEncoder().encode(text).length > RECOVERY_MAX_BYTES) return null;
    const v: unknown = JSON.parse(text);
    if (!shape(v, ['version', 'scope', 'attemptRef', 'mode', 'draftName', 'lines', 'dispositions']) || v.version !== 1 || v.scope !== scope || typeof v.mode !== 'string' || !modes.includes(v.mode) || typeof v.draftName !== 'string' || v.draftName.length > 100 || !(v.attemptRef === null || typeof v.attemptRef === 'string' && /^attempt_hop_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.attemptRef)) || !Array.isArray(v.lines) || !v.lines.length || v.lines.length > 100 || !Array.isArray(v.dispositions) || v.dispositions.length > 101) return null;
    for (const line of v.lines) {
      if (!shape(line, ['key', 'content', 'checked']) || typeof line.key !== 'string' || line.key.length > 128 || typeof line.checked !== 'boolean' || !shape(line.content, fields)) return null;
      for (const field of fields) {
        const c = line.content[field];
        if (shape(c, ['kind']) && c.kind === 'no-input') continue;
        if (!shape(c, ['kind', 'value']) || !(c.kind === 'string' && typeof c.value === 'string' && c.value.length <= 4096 || c.kind === 'number' && typeof c.value === 'number' && Number.isFinite(c.value))) return null;
      }
    }
    for (const d of v.dispositions) if (!shape(d, ['source', 'result', 'reason']) || ![d.source, d.result, d.reason].every(x => typeof x === 'string' && x.length <= 2000)) return null;
    if (new Set(v.lines.map(l => l.key)).size !== v.lines.length) return null;
    return v as unknown as AttemptRecovery;
  } catch { return null; }
}
export function serializeAttemptRecovery(scope: string, attemptRef: string | undefined, mode: FormMode, draftName: string, state: { lines: readonly Pick<EditorState['lines'][number], 'uiKey' | 'content' | 'confirmed'>[] }, dispositions: Record<string, { result: string; reason: string }>): string {
  const text = JSON.stringify({ version: 1, scope, attemptRef: attemptRef ?? null, mode, draftName, lines: state.lines.map(l => ({ key: l.uiKey, content: Object.fromEntries(fields.map(k => [k, l.content[k]])), checked: l.confirmed })), dispositions: Object.entries(dispositions).map(([source, d]) => ({ source, result: d.result, reason: d.reason })) });
  if (!parseAttemptRecovery(text, scope)) throw Error('本機待核實表單超出安全恢復範圍，本次尚未送出。');
  return text;
}
