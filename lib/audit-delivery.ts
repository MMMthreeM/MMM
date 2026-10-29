import type { getGoogleSheets } from '@/lib/google-sheets';
import { acknowledgeAudit, pendingAuditEvents } from '@/lib/security-store';

export async function flushPendingAudits(sheets: Awaited<ReturnType<typeof getGoogleSheets>>) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Audit_Logs!A:F' });
  const rows = response.data.values || [];
  const expected = ['Log_ID', 'Timestamp', 'User_Email', 'Action', 'Target_Order_ID', 'Details'];
  if (expected.some((name, i) => String(rows[0]?.[i] || '').trim().toLowerCase() !== name.toLowerCase())) throw new Error('Audit headers require configuration');
  const ids = new Set(rows.slice(1).map(row => String(row[0])));
  for (const event of await pendingAuditEvents()) {
    if (event.outcome === 'started') continue; // Never acknowledge an operation that has not finished.
    if (!ids.has(event.id)) {
      await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Audit_Logs!A:F', valueInputOption: 'RAW', requestBody: { values: [[event.id, event.timestamp, event.email, event.action, event.target, `[${event.outcome}] ${event.details}`]] } });
      ids.add(event.id);
    }
    await acknowledgeAudit(event.id);
  }
}
