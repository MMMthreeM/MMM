import 'server-only';
import { materialColumns } from '@/lib/sheet-table';
import { canonicalMaterialText, canonicalVendor } from '@/lib/material-identity';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { AccessError } from '@/lib/access';
import { toMaterialRules } from '@/lib/order-domain';
import type { OrderRow } from '@/lib/order-view';
import { taipeiDate } from '@/lib/date-range';
import { procurementRule, validateProcurementItems, REPORT_QUANTITY_POLICY } from '@/lib/procurement';
import { procurementQuantityPolicy, validateProcurementQuantity } from './order-confirmation.server';
import { sumExactQuantities, validateExactQuantity } from './order-change-set';
import { insertReportRows } from '@/lib/report-rows';
import { materialReportMap } from '@/lib/material-report-map';

type Template = { key: string; vendor: string; sheetName: string; columns: number; rows: number; rowStyles: number[][]; footerFormulas: { address: string; formula: string }[]; materialRows: { row: number; name: string; unit: string | null; vendor: string | null; itemNumber?: string }[]; companies: { name: string; column: number }[] };
export type VendorFile = { vendor: string; filename: string; buffer: Buffer };
const normalized = canonicalMaterialText;
const vendorName = canonicalVendor;
const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const columnName = (column: number) => String.fromCharCode(64 + column);

export async function buildVendorReports(rows: OrderRow[], materialRows: unknown[][]): Promise<VendorFile[]> {
  const reportName = materialReportMap(materialRows);
  const rules = toMaterialRules(materialRows);
  const exportName = (row: OrderRow) => {
    const assigned = reportName(row);
    const base = procurementRule(rules, row);
    return assigned !== row.materialName || !base ? assigned : reportName({ materialName: base.name, unit: base.unit, vendor: base.vendor });
  };
  for (const row of rows) {
    const issue = validateProcurementItems([row], rules, true, validateProcurementQuantity);
    if (issue) throw new AccessError(`${row.orderId} 的材料「${row.materialName}」：${issue}`, 409);
    const aliases = rules.filter(rule => vendorName(rule.vendor) === vendorName(row.vendor) && normalized(rule.unit) === normalized(row.unit) && normalized(reportName({ materialName: rule.name, unit: rule.unit, vendor: rule.vendor })) === normalized(reportName(row)));
    if (aliases.some(rule => { const policy = procurementQuantityPolicy(rule); return !policy || !validateExactQuantity(row.quantity, policy).ok || rule.requiresRemarks && !row.remarks?.trim(); })) throw new AccessError(`材料「${row.materialName}」不符目前材料庫的數量或備註規則，請先確認需求單。`, 409);
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
  if (!rows.some(row => ['伸泰', '益詮'].includes(vendorName(row.vendor)))) return [];
  const result: VendorFile[] = [];
  for (const key of ['shentai', 'yiquan']) {
    const base = path.join(process.cwd(), 'assets', 'report-templates', key);
    const template = JSON.parse(await fs.readFile(base + '.json', 'utf8')) as Template;
    const zip = await JSZip.loadAsync(await fs.readFile(base + '.xlsx'));
    let source = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    let workbook = await zip.file('xl/workbook.xml')!.async('string');
    const vendorRows = rows.filter(item => vendorName(item.vendor) === template.vendor);
    const additions = new Map<string, { name: string; unit: string }>();
    for (const row of vendorRows) {
      const name = exportName(row);
      if (!template.materialRows.some(item => normalized(item.name) === normalized(name) && normalized(item.unit || '') === normalized(row.unit))) additions.set(JSON.stringify([normalized(name), normalized(row.unit)]), { name, unit: row.unit });
    }
    const originalLast = Math.max(...template.materialRows.map(item => item.row));
    const lastItemNumber = Math.max(0, ...template.materialRows.map(item => Number(item.itemNumber) || 0));
    const insertAt = originalLast + 1, count = additions.size;
    const rowStyles = template.rowStyles[originalLast - 1];
    const rowAttributes = new RegExp(`<row\\b[^>]*\\br="${originalLast}"([^>]*)>`).exec(source)?.[1] || '';
    const newRows = [...additions.values()].map((item, index) => ({ row: insertAt + index, name: item.name, unit: item.unit, vendor: template.vendor }));
    if (count) {
      const shifted = insertReportRows(source, workbook, insertAt, count, newRows.map(item => `<row r="${item.row}"${rowAttributes}>${rowStyles.map((style, column) => `<c r="${columnName(column + 1)}${item.row}" s="${style}"/>`).join('')}</row>`));
      source = shifted.sheet; workbook = shifted.workbook;
      template.rowStyles.splice(insertAt - 1, 0, ...newRows.map(() => [...rowStyles]));
      template.rows += count;
      template.footerFormulas = template.footerFormulas.map(footer => ({ address: footer.address.replace(/(\d+)$/, number => String(Number(number) >= insertAt ? Number(number) + count : number)), formula: footer.formula.replace(/([A-Z]+)(\d+)/g, (_, column, number) => column + (Number(number) >= insertAt ? Number(number) + count : Number(number) === originalLast ? Number(number) + count : number)) }));
      template.materialRows.push(...newRows);
    }
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
    newRows.forEach((item, index) => { cell(item.row, 1, String(lastItemNumber + index + 1)); cell(item.row, 2, item.name); cell(item.row, 3, item.unit); cell(item.row, 4, template.vendor); });
    const totals = new Map<number, Map<number, number>>();
    for (const row of vendorRows) {
      if (!validateExactQuantity(row.quantity, REPORT_QUANTITY_POLICY).ok) throw new AccessError(`${row.orderId} 的材料數量不正確。`, 409);
      const company = template.companies.find((item) => normalized(item.name) === normalized(row.reqCompany));
      if (!company) throw new AccessError(`工班「${row.reqCompany}」未對應${template.vendor}範本欄位，請先確認名稱。`, 409);
      const matches = template.materialRows.filter((item) => normalized(item.name) === normalized(exportName(row)) && normalized(item.unit || '') === normalized(row.unit));
      // The user selected the first same-name, same-unit template row as authoritative.
      const material = matches[0];
      if (!material) throw new AccessError(`「${row.materialName}」（${row.unit}）不在${template.vendor}範本中。請在 Materials 的 Report_Name 填寫範本原始料名；僅調整前端名稱請改 Display_Name。`, 409);
      const byCompany = totals.get(material.row) ?? new Map<number, number>();
      const previous = byCompany.get(company.column);
      const sum = sumExactQuantities(previous === undefined ? [row.quantity] : [previous, row.quantity], REPORT_QUANTITY_POLICY);
      if (!sum.ok) throw new AccessError('報表數量加總超出可驗證範圍。', 409);
      byCompany.set(company.column, sum.value); totals.set(material.row, byCompany);
    }
    let grandTotal = 0;
    let hasPricedDemand = false;
    for (const item of template.materialRows) {
      const values = totals.get(item.row);
      const priceKey = JSON.stringify([normalized(item.name), normalized(item.unit || ''), template.vendor]);
      const price = prices.get(priceKey) ?? null;
      cell(item.row, 5, price);
      const exactTotal = values ? sumExactQuantities([...values.values()], REPORT_QUANTITY_POLICY) : null;
      if (exactTotal && !exactTotal.ok) throw new AccessError('報表數量加總超出可驗證範圍。', 409);
      const total = exactTotal?.ok ? exactTotal.value : '';
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
    const sheet = source.replace(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (original, address: string) => changes.get(address) ?? original);
    zip.file('xl/worksheets/sheet1.xml', sheet);
    zip.file('xl/workbook.xml', workbook.replace('</workbook>', '<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'));
    result.push({ vendor: template.vendor, filename: `高雄-材料需求-${template.vendor}_${taipeiDate().replace(/-/g, '')}.xlsx`, buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) });
  }
  return result;
}
