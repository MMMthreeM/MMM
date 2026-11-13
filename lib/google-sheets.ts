import 'server-only';
import { google } from 'googleapis';
export interface SingleDispatchPort { dispatch(wireBody:string):Promise<void>; }

export async function getGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

/** Acquire OAuth BEFORE the business dispatch boundary. Native fetch is used to
 * avoid OAuth/Gaxios automatic replay on 401/403. No retries or redirects here.
 */
export async function prepareSingleSheetsDispatch(spreadsheetId: string): Promise<SingleDispatchPort> {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_CLIENT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient(), token = await client.getAccessToken();
  if (!token.token) throw new Error('Sheets authorization unavailable');
  let used = false;
  return { async dispatch(wireBody) {
    if (used) throw new Error('Business dispatch already attempted'); used = true;
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' }, body: wireBody,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(185000),
    });
    if (!response.ok) throw new Error('Sheets acknowledgement not observed');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('spreadsheetId' in body) || body.spreadsheetId !== spreadsheetId || !('replies' in body) || !Array.isArray(body.replies) || body.replies.length !== JSON.parse(wireBody).requests.length) throw new Error('Sheets acknowledgement invalid');
  } };
}
