import { sheetColumns } from '@/lib/sheet-table';
import type { getGoogleSheets } from '@/lib/google-sheets';
import { acknowledgeAudit, pendingAuditEvents } from '@/lib/security-store';
import { taipeiDateTime } from '@/lib/date-range';

export async function flushPendingAudits(sheets: Awaited<ReturnType<typeof getGoogleSheets>>) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Audit_Logs' });
  const rows = response.data.values || [];
  const expected = ['Log_ID', 'Timestamp', 'User_Email', 'Action', 'Target_Order_ID', 'Details'];
  const c = sheetColumns(rows[0] || [], Object.fromEntries(expected.map(name => [name, [name]])), expected, 'Audit_Logs');
  const ids = new Set(rows.slice(1).map(row => String(row[c.Log_ID])));
  for (const event of await pendingAuditEvents()) {
    if (event.outcome === 'started') continue; // Never acknowledge an operation that has not finished.
    if (!ids.has(event.id)) {
      const timestamp = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(event.timestamp) && Number.isFinite(Date.parse(event.timestamp)) ? taipeiDateTime(Date.parse(event.timestamp)) : event.timestamp;
      const values = new Array(rows[0].length).fill('');
      [event.id, timestamp, event.email, event.action, event.target, `[${event.outcome}] ${event.details}`].forEach((value, index) => { values[c[expected[index]]] = value; });
      await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Audit_Logs', valueInputOption: 'RAW', requestBody: { values: [values] } });
      ids.add(event.id);
    }
    await acknowledgeAudit(event.id);
  }
}
