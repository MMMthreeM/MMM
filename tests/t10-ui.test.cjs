/* eslint-disable @typescript-eslint/no-require-imports -- pure browser display schema */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadModules: modules } = require('../scripts/migrate-single-sheet.cjs');
const api = modules()('./order-attempt-recovery');
const scope = 'mmm-attempt-display:v1:' + 'a'.repeat(64), attempt = 'attempt_hop_00000000-0000-4000-8000-000000000001';
const state = (n = 1) => ({ lines: Array.from({ length: n }, (_, i) => ({ uiKey: 'c_' + i, ref: { kind: 'new', clientKey: 'c_' + i }, confirmed: true, content: Object.fromEntries(Object.entries({ Material_ID: 'M1', Item_Name: '電線', Original_Item_Name: '', Quantity: 2, Unit: 'M', Vendor: '伸泰', Remarks: i + '料'.repeat(497) }).map(([k, v]) => [k, { kind: typeof v === 'number' ? 'number' : 'string', value: v }])) })), consumed: [], merges: [] });
test('T10 display recovery preserves 100 rows quantity remarks and explicit disposition without private evidence', () => {
  const input = state(100), before = JSON.stringify(input), text = api.serializeAttemptRecovery(scope, attempt, 'resubmit', '合成草稿', input, { source: { result: 'c_1', reason: '已重新核對來源' } }), restored = api.parseAttemptRecovery(text, scope);
  assert.equal(restored.lines.length, 100); assert.equal(restored.lines[99].content.Quantity.value, 2); assert.equal(restored.lines[99].content.Remarks.value, input.lines[99].content.Remarks.value); assert.equal(restored.dispositions[0].reason, '已重新核對來源'); assert.equal(restored.attemptRef, attempt); assert.equal(JSON.stringify(input), before);
  for (const forbidden of ['wireBody', 'token', 'confirmationEvidence', 'dispatchPermission', 'authorshipEvidenceRef', 'owner']) assert(!text.includes('"' + forbidden + '"'));
});
test('T10 tab recovery refuses a different account-target scope and never upgrades display to authority', () => {
  const text = api.serializeAttemptRecovery(scope, attempt, 'new-formal', '', state(), {}); assert.equal(api.parseAttemptRecovery(text, scope + '-other'), null); const v = JSON.parse(text); v.dispatchPermission = 'granted'; assert.equal(api.parseAttemptRecovery(JSON.stringify(v), scope), null);
});
test('T10 malformed recovery version formula non-finite duplicates and excessive rows fail closed', () => {
  const base = JSON.parse(api.serializeAttemptRecovery(scope, attempt, 'new-formal', '', state(), {}));
  for (const mutate of [v => v.version = 2, v => v.attemptRef = 'forged', v => v.lines[0].content.Quantity = { kind: 'formula', value: '=1' }, v => v.lines[0].content.Quantity = { kind: 'number', value: null }, v => v.lines.push(v.lines[0]), v => v.lines = Array(101).fill(v.lines[0])]) { const v = structuredClone(base); mutate(v); assert.equal(api.parseAttemptRecovery(JSON.stringify(v), scope), null); }
});
test('T10 no-receipt recovery remains unverified rather than inventing an Attempt ID', () => {
  const r = api.parseAttemptRecovery(api.serializeAttemptRecovery(scope, undefined, 'new-formal', '', state(), {}), scope); assert.equal(r.attemptRef, null); assert(!Object.hasOwn(r, 'state')); assert(!Object.hasOwn(r, 'mapping'));
});
test('T10 corrupt or oversized local records cannot crash parsing or silently become editable', () => {
  for (const text of ['{', 'null', '[]', '{}', ' '.repeat(api.RECOVERY_MAX_BYTES + 1)]) assert.equal(api.parseAttemptRecovery(text, scope), null);
  assert.throws(() => api.serializeAttemptRecovery(scope, attempt, 'new-formal', '', state(101), {}));
});
