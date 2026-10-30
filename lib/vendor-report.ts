import { materialColumns } from '@/lib/sheet-table';
import { canonicalMaterialText, canonicalVendor, materialIdentity } from '@/lib/material-identity';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { AccessError } from '@/lib/access';
import { toMaterialRules } from '@/lib/order-domain';
import type { OrderRow } from '@/lib/order-view';
import { taipeiDate } from '@/lib/date-range';
import { materialReportMap } from '@/lib/material-report-map';

type Template = { key: string; vendor: string; sheetName: string; columns: number; rows: number; rowStyles: number[][]; footerFormulas: { address: string; formula: string }[]; materialRows: { row: number; name: string; unit: string | null; vendor: string | null }[]; companies: { name: string; column: number }[] };
export type VendorFile = { vendor: string; filename: string; buffer: Buffer };
const normalized = canonicalMaterialText;
const vendorName = canonicalVendor;
const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const columnName = (column: number) => String.fromCharCode(64 + column);

export async function buildVendorReports(rows: OrderRow[], materialRows: unknown[][]): Promise<VendorFile[]> {
  const reportName = materialReportMap(materialRows);
  const rules = toMaterialRules(materialRows);
  for (const row of rows) {
    const candidates = rules.filter(rule => materialIdentity({ materialName: reportName({ materialName: rule.name, unit: rule.unit, vendor: rule.vendor }), unit: rule.unit, vendor: rule.vendor }) === materialIdentity({ ...row, materialName: reportName(row) }));
    if (candidates.some(rule => row.quantity < rule.minQty || row.quantity % rule.stepQty !== 0 || (rule.requiresRemarks && !row.remarks?.trim()))) throw new AccessError('材料「'+row.materialName+'」不符目前材料庫的數量或備註規則，請先確認需求單。', 409);
  }
  const { name: nameIndex, unit: unitIndex, vendor: vendorIndex, price: priceIndex } = materialColumns(materialRows);
  const prices = new Map<string, number | null>();
  for (const row of materialRows.slice(1)) {
    const key = JSON.stringify([normalized(reportName({ materialName: String(row[nameIndex] ?? ''), unit: String(row[unitIndex] ?? ''), vendor: String(row[vendorIndex] ?? '') })), normalized(String(row[unitIndex] ?? '')), vendorName(String(row[vendorIndex] ?? ''))]);
    const raw = priceIndex < 0 ? '' : String(row[priceIndex] ?? '').replace(/,/g, '').trim();
    const value = raw && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null;
    if (prices.has(key) && prices.get(key) !== value) throw new AccessError(`材料「${row[nameIndex]}」有不同單價，請先確認材料庫。`, 409);
    prices.set(key, value);
  }
  if (rows.some((row) => !['伸泰', '益詮'].includes(vendorName(row.vendor)))) throw new AccessError('部分材料尚未對應伸泰或益詮，請先編輯需求單指定正確材料，避免漏列。', 409);
  const result: VendorFile[] = [];
  for (const key of ['shentai', 'yiquan']) {
    const base = path.join(process.cwd(), 'assets', 'report-templates', key);
    const template = JSON.parse(await fs.readFile(base + '.json', 'utf8')) as Template;
    const zip = await JSZip.loadAsync(await fs.readFile(base + '.xlsx'));
    const source = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    const changes = new Map<string, string>();
    const cell = (row: number, column: number, value: number | string | null, formula?: string) => {
      const address = `${columnName(column)}${row}`;
      const style = template.rowStyles[row - 1]?.[column - 1];
      if (style === undefined) throw new Error('Template cell is missing');
      changes.set(address, `<c r="${address}" s="${style}"${typeof value === 'string' ? formula ? ' t="str"' : ' t="inlineStr"' : ''}>${formula ? `<f>${xml(formula)}</f><v>${value ?? ''}</v>` : value === null ? '' : typeof value === 'number' ? `<v>${value}</v>` : `<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`);
    };
    // Remove sample PR/PO, demand quantities and shipping records, preserving styles.
    for (let row = 4; row <= template.rows; row++) for (let column = 6; column <= template.columns; column++) cell(row, column, null);
    if (template.columns >= 21) cell(1, 21, null);
    cell(2, 10, taipeiDate().replace(/-/g, '/'));
    const totals = new Map<number, Map<number, number>>();
    for (const row of rows.filter((item) => vendorName(item.vendor) === template.vendor)) {
      if (!Number.isSafeInteger(row.quantity) || row.quantity <= 0) throw new AccessError(`${row.orderId} 的材料數量不正確。`, 409);
      const company = template.companies.find((item) => normalized(item.name) === normalized(row.reqCompany));
      if (!company) throw new AccessError(`工班「${row.reqCompany}」未對應${template.vendor}範本欄位，請先確認名稱。`, 409);
      const matches = template.materialRows.filter((item) => normalized(item.name) === normalized(reportName(row)) && normalized(item.unit || '') === normalized(row.unit));
      // The user selected the first same-name, same-unit template row as authoritative.
      const material = matches[0];
      if (!material) throw new AccessError(`「${row.materialName}」（${row.unit}）不在${template.vendor}範本中。請在 Materials 的 Report_Name 填寫範本原始料名；僅調整前端名稱請改 Display_Name。`, 409);
      const byCompany = totals.get(material.row) ?? new Map<number, number>();
      byCompany.set(company.column, (byCompany.get(company.column) ?? 0) + row.quantity); totals.set(material.row, byCompany);
    }
    let grandTotal = 0;
    let hasPricedDemand = false;
    for (const item of template.materialRows) {
      const values = totals.get(item.row);
      const priceKey = JSON.stringify([normalized(item.name), normalized(item.unit || ''), template.vendor]);
      const price = prices.get(priceKey) ?? null;
      cell(item.row, 5, price);
      const total = values ? [...values.values()].reduce((sum, value) => sum + value, 0) : '';
      if (values) for (const [column, quantity] of values) cell(item.row, column, quantity);
      cell(item.row, 15, total, `IF(COUNT(J${item.row}:N${item.row})=0,"",SUM(J${item.row}:N${item.row}))`);
      cell(item.row, 16, total, `IF(O${item.row}="","",O${item.row})`);
      cell(item.row, 8, total, `IF(P${item.row}="","",P${item.row})`);
      cell(item.row, 9, price === null || total === '' ? '' : price * total, `IF(OR(H${item.row}="",NOT(ISNUMBER(E${item.row}))),"",H${item.row}*E${item.row})`);
      if (values && price !== null && total !== '') { grandTotal += price * total; hasPricedDemand = true; }
    }
    for (const footer of template.footerFormulas ?? []) {
      const [, range] = /^SUBTOTAL\(9,(I\d+:I\d+)\)$/.exec(footer.formula) ?? [];
      if (range) cell(Number(footer.address.slice(1)), 9, hasPricedDemand ? grandTotal : '', `IF(COUNT(${range})=0,"",${footer.formula})`);
    }
    const sheet = source.replace(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g, (original, address: string) => changes.get(address) ?? original);
    zip.file('xl/worksheets/sheet1.xml', sheet);
    zip.file('xl/workbook.xml', (await zip.file('xl/workbook.xml')!.async('string')).replace('</workbook>', '<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'));
    result.push({ vendor: template.vendor, filename: `高雄-材料需求-${template.vendor}_${taipeiDate().replace(/-/g, '')}.xlsx`, buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) });
  }
  return result;
}
