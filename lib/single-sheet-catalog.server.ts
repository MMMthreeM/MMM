import 'server-only';
import { getGoogleSheets } from './google-sheets';
import { requireV2, plainObject, typedGridCell } from './order-v2-schema';
import { writeDigest } from './order-write-plan';
import { materialColumns } from './sheet-table';
import type { CatalogMaterial } from './order-confirmation.server';
export async function readV2Catalog(sheets: Awaited<ReturnType<typeof getGoogleSheets>>, spreadsheetId: string): Promise<Readonly<{ materials: readonly CatalogMaterial[]; digest: string }>> {
  const response = await sheets.spreadsheets.get({ spreadsheetId, ranges: ["'Materials'"], includeGridData: true, fields: 'spreadsheetId,sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue))))' });
  const data: unknown = response.data;
  requireV2(plainObject(data) && data.spreadsheetId === spreadsheetId && Array.isArray(data.sheets) && data.sheets.length === 1, 'CATALOG_COVERAGE_UNVERIFIED');
  const sheet = data.sheets[0]; requireV2(plainObject(sheet) && plainObject(sheet.properties) && sheet.properties.title === 'Materials' && Array.isArray(sheet.data) && sheet.data.length === 1, 'CATALOG_COVERAGE_UNVERIFIED');
  const grid = sheet.data[0]; requireV2(plainObject(grid) && (grid.startRow ?? 0) === 0 && (grid.startColumn ?? 0) === 0 && Array.isArray(grid.rowData) && grid.rowData.length <= 100001, 'CATALOG_COVERAGE_UNVERIFIED');
  const rows = grid.rowData.map((r: unknown) => { requireV2(plainObject(r) && (r.values === undefined || Array.isArray(r.values)), 'CATALOG_RAW_INVALID'); return ((r.values ?? []) as unknown[]).map(c => typedGridCell(c)); });
  requireV2(rows.length > 0, 'CATALOG_SCHEMA_INVALID');
  const headers = rows[0].map(c => { requireV2(c.kind === 'string', 'CATALOG_SCHEMA_INVALID'); return c.value; });
  const columns = materialColumns([headers]);
  const materials = rows.slice(1).filter(r => r.some(c => c.kind !== 'no-input')).map(r => {
    const s = (i: number) => { const c = r[i]; requireV2(c?.kind === 'string' && /\S/u.test(c.value), 'CATALOG_RAW_INVALID'); return c.value; };
    const n = (i: number) => { const c = r[i]; requireV2(c?.kind === 'number' && c.value > 0 && Number.isFinite(c.value), 'CATALOG_RAW_INVALID'); return c.value; };
    const remarks = columns.remarks < 0 ? undefined : r[columns.remarks];
    requireV2(!remarks || remarks.kind === 'no-input' || remarks.kind === 'boolean' || remarks.kind === 'string' && ['true', 'false', '1', '0', 'yes', 'no', ''].includes(remarks.value.toLowerCase()), 'CATALOG_RAW_INVALID');
    return { id: s(columns.id), name: s(columns.name), unit: s(columns.unit), vendor: s(columns.vendor), minimum: n(columns.min), step: n(columns.step), requiresRemarks: remarks?.kind === 'boolean' ? remarks.value : remarks?.kind === 'string' && ['true', '1', 'yes'].includes(remarks.value.toLowerCase()) };
  });
  requireV2(new Set(materials.map(m => m.id)).size === materials.length, 'CATALOG_DUPLICATE_ID');
  return { materials, digest: writeDigest(materials) };
}

