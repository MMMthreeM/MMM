import { getGoogleSheets } from '@/lib/google-sheets';

export async function logAudit(userEmail: string, action: string, orderId: string, details: string) {
  try {
    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // 取得台灣時間與產生唯一 Log ID
    const now = new Date(); 
    const twTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const timestamp = twTime.toISOString().replace('T', ' ').substring(0, 19);
    const logId = `LOG-${twTime.getTime()}`;

    // 動態抓取表頭
    const headersRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Audit_Logs!1:1' });
    const headers = (headersRes.data.values?.[0] || []).map(h => String(h).trim());

    if (headers.length === 0) return;

    const findColIdx = (keys: string[]) => headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));

    const rowData = new Array(headers.length).fill('');
    const setVal = (keys: string[], val: string) => {
      const idx = findColIdx(keys);
      if (idx !== -1) rowData[idx] = val;
    };

    setVal(['log_id', '編號'], logId);
    setVal(['timestamp', '時間', 'timestamp'], timestamp);
    setVal(['user_email', '操作者', '信箱'], userEmail);
    setVal(['action', '動作'], action);
    setVal(['target_order_id', '關聯單號', '單號'], orderId);
    setVal(['details', '詳細'], details);

    const rangeToAppend = `Audit_Logs!A:${String.fromCharCode(65 + headers.length - 1)}`;
    await sheets.spreadsheets.values.append({ 
      spreadsheetId: sheetId, 
      range: rangeToAppend, 
      valueInputOption: 'USER_ENTERED', 
      requestBody: { values: [rowData] } 
    });
  } catch (error) {
    console.error('❌ Audit Log 寫入失敗:', error);
  }
}