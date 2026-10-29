import { secureMutation } from '@/lib/mutation-security';
import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";
import { canUserMoveStatus, columnLetter, findColumn, isOrderStatus, isUserEditableStatus, toMaterialRules, validateItems } from '@/lib/order-domain';
import { apiError, requireAccount } from '@/lib/access';
import { loadOrderSheet } from '@/lib/order-sheet';
import { orderItemMessages } from '@/lib/order-message';
import { escapeTelegramHtml } from '@/lib/telegram-html';

const findColIdx = (headers: string[], keys: string[]) => {
  return headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
};

export async function GET() {
  try {
    const { account, sheets, users } = await requireAccount();
    const { rows } = await loadOrderSheet(sheets, users);
    return NextResponse.json({ data: rows.filter((row) => row.reqCompany === account.company && account.company).reverse() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error, '讀取工班需求單失敗，請稍後再試。'); }
}

async function handleMutation(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });
    const userEmail = session.user.email;
    const body = await request.json();
    const { items, status, draftName, existingOrderId } = body;
    if (!isOrderStatus(status) || !['編輯中', '處理中'].includes(status)) return NextResponse.json({ error: '不允許的訂單狀態。' }, { status: 400 });
    if (existingOrderId != null && typeof existingOrderId !== 'string') return NextResponse.json({ error: '申請單編號格式不正確。' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: '清單不可為空' }, { status: 400 });
    if (status === '編輯中' && (typeof draftName !== 'string' || !draftName.trim() || draftName.length > 100)) return NextResponse.json({ error: '草稿名稱必填，且限 100 字內。' }, { status: 400 });

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const userResponse = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:F' });
    const currentUser = (userResponse.data.values || []).find(row => row[0] === userEmail);
    if (!currentUser || !['Admin', 'User'].includes(String(currentUser[1])) || !currentUser[2]) return NextResponse.json({ error: '您的帳號尚未完成工班權限設定。' }, { status: 403 });
    const company = currentUser[2], region = currentUser[3] || '';
    const materialsResponse = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Materials!A:N' });
    const itemError = validateItems(items, toMaterialRules(materialsResponse.data.values || []));
    if (itemError) return NextResponse.json({ error: itemError }, { status: 400 });
    
    // 💡 修正 1：嚴格去除空白，防止推播出現申請人空白的狀況
    const reqUserNickname = (currentUser && currentUser[4] && String(currentUser[4]).trim() !== '') 
      ? String(currentUser[4]).trim() 
      : userEmail.split('@')[0];
    
    const now = new Date(); const twTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const orderId = existingOrderId || `ORD-${twTime.toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
    const orderDate = twTime.toISOString().replace('T', ' ').substring(0, 16);
    
    let preservedReturnNote = '';
    const returnNotes = new Set<string>();
    let isFromDraft = false;

    const headersRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!1:1' });
    const headers = (headersRes.data.values?.[0] || []).map(h => String(h).trim());
    if ([['order_id', '單號'], ['req_company', '公司', '工班'], ['status', '狀態'], ['item_name', '材料', '品項'], ['quantity', '數量']].some((aliases) => findColumn(headers, aliases) < 0)) return NextResponse.json({ error: '訂單工作表欄位設定不完整，請聯絡管理者。' }, { status: 409 });

    const deletes: number[] = [];
    if (existingOrderId) {
      const allRowsRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
      const rows = allRowsRes.data.values || [];
      const adminNoteIdx = findColumn(headers, ['admin_note', '退回原因', '管理員備註']);
      const orderNoteIdx = findColumn(headers, ['order_return_note', '整單退回原因']);
      const statusIdx = findColumn(headers, ['status', '狀態']);
      const idIdx = findColumn(headers, ['order_id', '單號']);
      const companyIdx = findColumn(headers, ['req_company', '公司', '工班']);
      
      const gid = (await sheets.spreadsheets.get({ spreadsheetId: sheetId })).data.sheets?.find(s => s.properties?.title === 'Orders')?.properties?.sheetId;
      const rowsToDelete = [];
      
      for (let i = 1; i < rows.length; i++) {
        if (idIdx !== -1 && rows[i][idIdx] === existingOrderId) {
          if (companyIdx === -1 || rows[i][companyIdx] !== company) return NextResponse.json({ error: '您沒有修改此訂單的權限。' }, { status: 403 });
          if (statusIdx === -1 || !isUserEditableStatus(String(rows[i][statusIdx] || ''))) return NextResponse.json({ error: '此訂單目前不可修改。' }, { status: 409 });
          if (!canUserMoveStatus(String(rows[i][statusIdx]), status)) return NextResponse.json({ error: '目前狀態不允許此操作。' }, { status: 409 });
          rowsToDelete.push(i);
          for (const noteIdx of [adminNoteIdx, orderNoteIdx]) {
            if (noteIdx >= 0 && rows[i][noteIdx]) returnNotes.add(String(rows[i][noteIdx]).replace(/^\[(退回原因|已重送)\]\s*/, '').trim());
          }
          if (statusIdx !== -1 && rows[i][statusIdx] === '編輯中') isFromDraft = true;
        }
      }
      
      if (rowsToDelete.length === 0) return NextResponse.json({ error: '找不到要更新的申請單。' }, { status: 404 });
      if (gid === undefined) return NextResponse.json({ error: '無法取得申請單工作表。' }, { status: 500 });
      preservedReturnNote = [...returnNotes].filter(Boolean).join('；');
      if (preservedReturnNote && status === '處理中') preservedReturnNote = '[已重送] ' + preservedReturnNote;

      rowsToDelete.sort((a, b) => b - a);
      deletes.push(...rowsToDelete);
    }

    const newRows = items.map((item: { materialName: string; quantity: number; unit?: string; vendor?: string; remarks?: string }, itemIndex: number) => {
      const rowData = new Array(headers.length).fill('');
      const setVal = (keys: string[], val: string | number) => {
        const idx = findColIdx(headers, keys);
        if (idx !== -1) rowData[idx] = val;
      };

      setVal(['Order_ID', '單號'], orderId);
      setVal(['Order_Date', '日期', '時間'], orderDate);
      setVal(['Req_User', '申請人', '信箱'], userEmail);
      setVal(['Req_Company', '公司', '工班'], company);
      setVal(['Req_Region', '地區', '區域'], region);
      setVal(['Item_Name', '材料', '品項', '名稱'], item.materialName);
      setVal(['Quantity', '數量'], item.quantity);
      setVal(['Unit', '單位'], item.unit || '式');
      setVal(['Remarks', '備註', 'remark'], item.remarks || ''); 
      setVal(['Vendor', '廠商'], item.vendor || '未指定');
      setVal(['Status', '狀態'], status || '處理中');
      setVal(['Admin_Note', '退回原因', '管理員備註'], findColumn(headers, ['order_return_note', '整單退回原因']) < 0 && itemIndex === 0 ? preservedReturnNote : '');
      setVal(['Order_Return_Note', '整單退回原因'], preservedReturnNote);
      setVal(['Draft_Name', '草稿名稱'], status === '編輯中' && draftName ? draftName : ''); 

      return rowData;
    });

    const rangeToAppend = `Orders!A:${columnLetter(headers.length - 1)}`;
    if (deletes.length) {
      const metadata = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties' });
      const gid = metadata.data.sheets?.find(s => s.properties?.title === 'Orders')?.properties?.sheetId;
      if (gid === undefined) throw new Error('Orders sheet missing');
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: [
        ...deletes.map(index => ({ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: index, endIndex: index + 1 } } })),
        { appendCells: { sheetId: gid, fields: 'userEnteredValue', rows: newRows.map(values => ({ values: values.map(value => ({ userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value) } })) })) } },
      ] } });
    } else await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: rangeToAppend, valueInputOption: 'RAW', requestBody: { values: newRows } });
    
    try {
      const { logAudit } = await import('@/lib/audit');
      let actionName = '新增訂單';
      if (status === '編輯中') {
        actionName = existingOrderId ? '更新草稿' : '新增草稿';
      } else if (existingOrderId) {
        actionName = isFromDraft ? '草稿轉正式單' : '修改後重送單';
      }
      await logAudit(userEmail, actionName, orderId, `共 ${items.length} 項材料 (狀態: ${status})`);
    } catch (e) { console.error('寫入 Log 失敗', e); }

    if (status === '處理中') {
      try {
        const { sendTelegramMessage } = await import('@/lib/telegram');
        const adminGroupId = process.env.TG_ADMIN_GROUP_ID;
        const topicNewOrder = process.env.TG_TOPIC_NEW_ORDER;
        
        if (adminGroupId) {
          const isUpdate = existingOrderId && !isFromDraft;
          const titleIcon = isUpdate ? '🔄' : '🆕';
          const titleText = isUpdate ? '訂單更新 / 重送通知' : '新單進件通知';
          
          const msg = `${titleIcon} <b>${titleText}</b>\n單號：<code>${escapeTelegramHtml(orderId)}</code>\n工班：${escapeTelegramHtml(company)}\n申請人：${escapeTelegramHtml(reqUserNickname)}\n品項數：${items.length} 項`;
          
          for (const message of orderItemMessages(msg, items, '請至管理後台進行審核。')) await sendTelegramMessage(adminGroupId, message, topicNewOrder);
        }
      } catch (e) { console.error('新單推播失敗', e); }
    }

    return NextResponse.json({ status: 'success', message: status === '編輯中' ? '草稿已儲存' : '訂單已送出', orderId });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: '請求內容格式不正確。' }, { status: 400 });
    return apiError(error, '建立訂單失敗，請稍後再試。');
  }
}

export const POST = secureMutation(handleMutation, { admin: false, action: 'order-save', limit: 20 });
