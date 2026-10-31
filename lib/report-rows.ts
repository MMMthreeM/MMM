export function insertReportRows(sheet: string, workbook: string, at: number, count: number, rows: string[]) {
  if (!count) return { sheet, workbook };
  const references = (value: string) => value.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, (_, column, number) => column + (Number(number) >= at ? Number(number) + count : number));
  // Only transform address/formula attributes, never user-visible strings or shared string indexes.
  sheet = sheet.replace(/(<row\b[^>]*\br=")(\d+)(")/g, (_, before, row, after) => before + (Number(row) >= at ? Number(row) + count : row) + after)
    .replace(/\b(r|ref|sqref)="([A-Z$][A-Z$\d: ]*)"/g, (_, key, value) => `${key}="${references(value)}"`)
    .replace(/<f([^>]*)>([\s\S]*?)<\/f>/g, (_, attributes, formula) => `<f${attributes}>${references(formula)}</f>`);
  const marker = new RegExp(`<row\\b[^>]*\\br="${at + count}"`);
  const found = marker.exec(sheet);
  if (found) sheet = sheet.slice(0, found.index) + rows.join('') + sheet.slice(found.index);
  else sheet = sheet.replace('</sheetData>', rows.join('') + '</sheetData>');
  workbook = workbook.replace(/(<definedName\b[^>]*>)([\s\S]*?)(<\/definedName>)/g, (_, before, value, after) => before + references(value) + after);
  return { sheet, workbook };
}
