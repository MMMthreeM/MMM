import 'server-only';
import { checkedMutationRequest } from '@/lib/mutation-security';
import { requireAccount, AccessError } from '@/lib/access';
import { consumeRate } from '@/lib/security-store';
import { readV2Catalog } from '@/lib/single-sheet-catalog.server';
import { readSingleSheet, sheetDigest } from '@/lib/single-sheet-store.server';
import { planSingleSheetMutation } from '@/lib/single-sheet-mutations.server';
import { materialBasis } from '@/lib/order-confirmation.server';
import { plainObject, requireV2, V2Error } from '@/lib/order-v2-schema';
import type { SevenContent } from '@/lib/order-change-set';
import { previewExactMerge } from '@/lib/order-change-set';
import { fingerprintMaterialContent, MATERIAL_CONTENT_FIELDS } from '@/lib/material-content-fingerprint';

/** Authenticated human confirmation challenge. No Orders write or ID allocation. */
export async function POST(request: Request) {
  try {
    const checked = await checkedMutationRequest(request, 524288), { account, sheets, users } = await requireAccount();
    await consumeRate(account.email, 'material-confirmation', 100);
    const b = checked.body;
    if (b.action === 'content-fingerprints') {
      requireV2(Object.keys(b).every(k=>['contractVersion','action','items'].includes(k)) && b.contractVersion===2 && Array.isArray(b.items) && b.items.length>0 && b.items.length<=100, 'INVALID_CONTENT_REQUEST',400);
      const items=b.items.map((item:unknown)=>{
        requireV2(plainObject(item)&&Object.keys(item).length===2&&typeof item.key==='string'&&plainObject(item.content)&&Object.keys(item.content).length===7,'INVALID_CONTENT_REQUEST',400);
        const fp=fingerprintMaterialContent(MATERIAL_CONTENT_FIELDS,MATERIAL_CONTENT_FIELDS.map(k=>(item.content as SevenContent)[k]));requireV2(fp.ok,'MATERIAL_CONTENT_INVALID',400);
        return {key:item.key,mcf:fp.fingerprint};
      });
      return Response.json({contractVersion:2,items},{headers:{'Cache-Control':'private, no-store'}});
    }
    if (b.action === 'preview-merge') {
      requireV2(Object.keys(b).every(k => ['contractVersion', 'action', 'sources', 'validation'].includes(k)) && b.contractVersion === 2 && Array.isArray(b.sources) && b.sources.length >= 2 && b.sources.length <= 100 && ['formal', 'draft-basic'].includes(b.validation), 'INVALID_MERGE_PREVIEW', 400);
      const spreadsheetId = process.env.GOOGLE_SHEET_ID; requireV2(spreadsheetId, 'CATALOG_NOT_READY', 503);
      const catalog = await readV2Catalog(sheets, spreadsheetId);
      const policies = b.sources.map((content: SevenContent) => {
        const origin = content?.Material_ID?.kind === 'string' && content.Material_ID.value ? { kind: 'catalog-selection' as const, materialIdAtSelection: content.Material_ID.value, selectionEvidenceRef: 'preview-only' } : { kind: 'manual-entry' as const, inputEvidenceRef: 'preview-only' };
        const basis = materialBasis(content, catalog.materials, catalog.digest, origin, b.validation);
        requireV2(basis.state === 'verified' && basis.businessValid, 'MERGE_CONTENT_INVALID'); return basis.catalogBasis.quantityPolicy;
      });
      const preview = previewExactMerge(b.sources, policies, b.validation); requireV2(preview.ok, preview.ok ? '' : preview.code);
      return Response.json({ contractVersion: 2, ...preview }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    requireV2(Object.keys(b).every(k => ['contractVersion', 'request', 'items', 'confirm'].includes(k)) && b.contractVersion === 2 && b.confirm === true && Array.isArray(b.items) && b.items.length > 0 && b.items.length <= 100 && b.items.every((i: unknown) => plainObject(i) && Object.keys(i).length === 2 && typeof i.key === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(i.key) && plainObject(i.content)) && new Set(b.items.map((i: { key: string }) => i.key)).size === b.items.length, 'INVALID_CONFIRMATION_REQUEST', 400);
    const spreadsheetId=process.env.GOOGLE_SHEET_ID,secret=process.env.SHEETS_CONFIRMATION_SECRET||process.env.NEXTAUTH_SECRET;
    requireV2(spreadsheetId&&secret,'SHEETS_WRITER_NOT_CONFIGURED',503);
    const [snapshot,catalog]=await Promise.all([readSingleSheet(sheets,spreadsheetId),readV2Catalog(sheets,spreadsheetId)]);
    const plan=await planSingleSheetMutation(snapshot.db,{...account,authorityRef:'users:'+sheetDigest(users)},b.request,catalog.materials,secret,{confirmOnly:true});
    const confirmations=plan.confirmations;
    return Response.json({ contractVersion: 2, confirmations }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ state: 'not-applied', code: error instanceof V2Error ? error.code : 'CONFIRMATION_UNAVAILABLE', error: '材料確認未完成，請檢查材料與權限。' }, { status: error instanceof V2Error || error instanceof AccessError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
