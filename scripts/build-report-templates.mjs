import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(path.resolve('package.json'));
const artifactRequire = createRequire(path.join(path.resolve(process.env.ARTIFACT_TOOL_MODULE_DIR || '.tools/artifact/node_modules'), 'package.json'));
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(artifactRequire.resolve('@oai/artifact-tool')).href);
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const { nativeTemplateXml } = require(path.resolve('scripts/template-xml.cjs'));
const output = path.resolve('assets/report-templates');
await fs.mkdir(output, { recursive: true });
for (const key of ['shentai', 'yiquan']) {
  const source = JSON.parse(await fs.readFile(path.resolve('.tools/template-source', `${key}.json`), 'utf8'));
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add(source.sheetName);
  sheet.getRangeByIndexes(0, 0, source.cells.length, source.columns.length).values = source.cells.map((row) => row.map((cell) => cell.value));
  sheet.showGridLines = source.showGridLines;
  for (const column of source.columns) sheet.getRangeByIndexes(0, column.column, source.cells.length, 1).format.columnWidth = column.width;
  for (const row of source.rows) sheet.getRangeByIndexes(row.row, 0, 1, source.columns.length).format.rowHeight = row.height;
  workbook.recalculate();
  const blob = await SpreadsheetFile.exportXlsx(workbook);
  const intermediate = path.resolve('.tools/template-source', `${key}-base.xlsx`);
  await blob.save(intermediate);
  const zip = await JSZip.loadAsync(await fs.readFile(intermediate));
  // Exact XLS formatting, including hidden columns and native number formats, is
  // restored in OOXML because the XLS importer is not supported by Artifact Tool.
  const native = nativeTemplateXml(source);
  zip.file('xl/styles.xml', native.styles); zip.file('xl/worksheets/sheet1.xml', native.sheet);
  // ExcelJS expects the default namespace for workbook element names.
  for (const part of ['xl/workbook.xml', 'xl/sharedStrings.xml']) zip.file(part, (await zip.file(part).async('string')).replace(/(<\/?)x:/g, '$1').replace('xmlns:x=', 'xmlns='));
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(path.join(output, `${key}.xlsx`), bytes);
  const check = new ExcelJS.Workbook(); await check.xlsx.load(bytes);
  const parsed = check.worksheets[0]; let checked = 0;
  for (let row = 0; row < source.cells.length; row++) for (let column = 0; column < source.columns.length; column++) {
    const expected = source.styles[source.cells[row][column].style]; const cell = parsed.getCell(row + 1, column + 1);
    if (cell.isMerged && cell.master.address !== cell.address) continue;
    if (cell.font.name !== expected.font.name || cell.font.size !== expected.font.size || Boolean(cell.font.bold) !== expected.font.bold || (cell.numFmt || 'General').replace(/\\-/g, '-') !== expected.numberFormat.replace(/\\-/g, '-')) throw new Error(`Style mismatch ${key} ${cell.address}`);
    if (expected.fill && cell.fill.fgColor.argb !== `FF${expected.fill.slice(1)}`) throw new Error(`Fill mismatch ${key} ${cell.address}`);
    if (Boolean(cell.font.italic) !== expected.font.italic || Boolean(cell.font.underline) !== expected.font.underline || Boolean(cell.font.strike) !== expected.font.strike) throw new Error(`Font flags mismatch ${key} ${cell.address}`);
    if (expected.font.color && cell.font.color.argb !== `FF${expected.font.color.slice(1)}`) throw new Error(`Font color mismatch ${key} ${cell.address}`);
    if (cell.alignment.horizontal !== ['general', 'left', 'center', 'right'][expected.alignment.horizontal] || cell.alignment.vertical !== ['top', 'middle', 'bottom'][expected.alignment.vertical] || Boolean(cell.alignment.wrapText) !== expected.alignment.wrap) throw new Error(`Alignment mismatch ${key} ${cell.address}`);
    const borderNames = ['none', 'thin', 'medium', 'dashed', 'dotted', 'thick', 'double'];
    for (const side of ['left', 'right', 'top', 'bottom']) if (expected.borders[side].style && cell.border[side]?.style !== borderNames[expected.borders[side].style]) throw new Error(`Border mismatch ${key} ${cell.address}`);
    checked++;
  }
  for (const column of source.columns) if (parsed.getColumn(column.column + 1).width !== column.width || Boolean(parsed.getColumn(column.column + 1).hidden) !== column.hidden) throw new Error(`Column width/visibility mismatch ${key}`);
  for (const row of source.rows) if (parsed.getRow(row.row + 1).height !== row.height || Boolean(parsed.getRow(row.row + 1).hidden) !== row.hidden) throw new Error(`Row height/visibility mismatch ${key}`);
  const materialRows = source.cells.map((cells, row) => ({ row: row + 1, name: cells[1]?.value, unit: cells[2]?.value, vendor: cells[3]?.value, itemNumber: cells[0]?.value })).filter((entry) => entry.row > 3 && /^\d+(\.\d+)?$/.test(String(entry.itemNumber)) && typeof entry.name === 'string');
  const original = XLSX.readFile(path.join('D:/維運材料需求管理/excel範本', source.source));
  const footerFormulas = Object.entries(original.Sheets[original.SheetNames[0]]).filter(([address, value]) => /^I\d+$/.test(address) && /^SUBTOTAL\(9,I\d+:I\d+\)$/.test(value.f || '')).map(([address, value]) => ({ address, formula: value.f }));
  const manifest = { key, vendor: source.vendor, sheetName: source.sheetName, source: source.source, columns: source.columns.length, rows: source.rows.length, materialRows, footerFormulas, companies: source.cells[2].slice(9, 14).map((cell, index) => ({ name: cell.value === '鶴竣' ? '鶴峻' : cell.value, column: index + 10 })), rowStyles: source.cells.map((row) => row.map((cell) => cell.style)) };
  await fs.writeFile(path.join(output, `${key}.json`), JSON.stringify(manifest));
  console.log(JSON.stringify({ key, checkedCells: checked, materialRows: materialRows.length, rows: source.rows.length }));
}
