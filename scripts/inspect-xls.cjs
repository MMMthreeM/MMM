/* eslint-disable @typescript-eslint/no-require-imports -- Read-only inspection of legacy XLS templates. */
const fs = require('node:fs');
const XLSX = require('xlsx');
for (const filename of fs.readdirSync('D:/維運材料需求管理/excel範本').filter((name) => name.endsWith('.xls'))) {
  const workbook = XLSX.readFile('D:/維運材料需求管理/excel範本/' + filename, { cellStyles: true, cellNF: true, bookVBA: true });
  console.log(JSON.stringify({ filename, sheets: workbook.SheetNames, styles: workbook.Styles, hasMacros: Boolean(workbook.vbaraw) }));
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    console.log(JSON.stringify({ sheet: name, range: sheet['!ref'], rows: rows.length, sample: rows.slice(0, 8).map((row) => row.slice(0, 18)), merges: sheet['!merges']?.slice(0, 10), columns: sheet['!cols']?.slice(0, 16), exampleStyle: sheet.A1, images: Boolean(sheet['!images']) }));
  }
}
