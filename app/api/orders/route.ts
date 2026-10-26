import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";

const findColIdx = (headers: string[], keys: string[]) => {
  return headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });
    const userEmail = session.user.email;
    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    const uRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:F' });
    const users = uRes.data.values || [];
    const myCompany = users.find(r => r[0] === userEmail)?.[2];
    const userMap = new Map(users.map(u => [u[0], u[4] || u[0].split('@')[0]])); 

    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
    const rows = response.data.values;
    if (!rows || rows.length <= 1) return NextResponse.json({ data: [] });

    const headers = rows[0].map(h => String(h).trim());
    const idx = {
      id: findColIdx(headers, ['order_id', '單號']), date: findColIdx(headers, ['order_date', '日期']),
      user: findColIdx(headers, ['req_user', '申請人']), company: findColIdx(headers, ['req_company', '工班', '公司']),
      item: findColIdx(headers, ['item_name', '材料', '品項']), qty: findColIdx(headers, ['quantity', '數量']),
      unit: findColIdx(headers, ['unit', '單位']), remarks: findColIdx(headers, ['remarks', '備註']),
      vendor: findColIdx(headers, ['vendor', '廠商']), status: findColIdx(headers, ['status', '狀態']),
      adminNote: findColIdx(headers, ['admin_note', '退回原因', '管理員']),
      draftName: findColIdx(headers, ['draft_name', '草稿名稱']), adminUser: findColIdx(headers, ['admin_user', '審核人'])
    };

    const companyOrders = rows.slice(1).filter(row => idx.company !== -1 && row[idx.company] === myCompany).map(row => ({
      orderId: idx.id !== -1 ? row[idx.id] : '', orderDate: idx.date !== -1 ? row[idx.date] : '', 
      reqUser: idx.user !== -1 ? (userMap.get(row[idx.user]) || row[idx.user]) : '', 
      originalUserEmail: idx.user !== -1 ? row[idx.user] : '', materialName: idx.item !== -1 ? row[idx.item] : '', 
      vendor: idx.vendor !== -1 ? row[idx.vendor] : '', quantity: idx.qty !== -1 ? row[idx.qty] : 0, 
      unit: idx.unit !== -1 ? row[idx.unit] : '', remarks: idx.remarks !== -1 ? row[idx.remarks] : '',
      status: idx.status !== -1 ? row[idx.status] : '', 
      adminNote: idx.adminNote !== -1 ? String(row[idx.adminNote] || '').replace(/^\[退回原因\]\s*/, '') : '',
      draftName: idx.draftName !== -1 ? (row[idx.draftName] || '') : '',
      adminUser: idx.adminUser !== -1 ? (userMap.get(row[idx.adminUser]) || row[idx.adminUser]) : ''
    }));

    return NextResponse.json({ data: companyOrders.reverse() });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });
    const userEmail = session.user.email;
    const body = await request.json();
    const { items, status, draftName, existingOrderId } = body; 
    if (!items || items.length === 0) return NextResponse.json({ error: '清單不可為空' }, { status: 400 });

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const userResponse = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:F' });
    const currentUser = (userResponse.data.values || []).find(row => row[0] === userEmail);
    const company = currentUser ? currentUser[2] : '未知', region = currentUser ? currentUser[3] : '未知';
    
    // 💡 修正 1：嚴格去除空白，防止推播出現申請人空白的狀況
    const reqUserNickname = (currentUser && currentUser[4] && String(currentUser[4]).trim() !== '') 
      ? String(currentUser[4]).trim() 
      : userEmail.split('@')[0];
    
    const now = new Date(); const twTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const orderId = existingOrderId || `ORD-${twTime.toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
    const orderDate = twTime.toISOString().replace('T', ' ').substring(0, 16);
    
    let preservedReturnNote = '';
    let isFromDraft = false;

    const headersRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!1:1' });
    const headers = (headersRes.data.values?.[0] || []).map(h => String(h).trim());

    if (existingOrderId) {
      const allRowsRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
      const rows = allRowsRes.data.values || [];
      const adminNoteIdx = findColIdx(headers, ['admin_note', '退回原因', '管理員備註']);
      const statusIdx = findColIdx(headers, ['status', '狀態']);
      const idIdx = findColIdx(headers, ['order_id', '單號']); 
      
      const gid = (await sheets.spreadsheets.get({ spreadsheetId: sheetId })).data.sheets?.find(s => s.properties?.title === 'Orders')?.properties?.sheetId;
      const rowsToDelete = [];
      
      for (let i = 1; i < rows.length; i++) {
        if (idIdx !== -1 && rows[i][idIdx] === existingOrderId) {
          rowsToDelete.push(i);
          if (adminNoteIdx !== -1 && rows[i][adminNoteIdx]) {
            let oldNote = String(rows[i][adminNoteIdx]).replace(/^\[退回原因\]\s*/, '').trim();
            // 💡 修正 2：如果工班編輯後重新送出，自動加上 [已重送] 的標籤
            if (oldNote && !oldNote.startsWith('[已重送]') && status === '處理中') {
              preservedReturnNote = '[已重送] ' + oldNote;
            } else {
              preservedReturnNote = oldNote;
            }
          }
          if (statusIdx !== -1 && rows[i][statusIdx] === '編輯中') isFromDraft = true;
        }
      }
      
      rowsToDelete.sort((a, b) => b - a);
      if (rowsToDelete.length > 0) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: rowsToDelete.map(rIdx => ({ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: rIdx, endIndex: rIdx + 1 } } })) } });
      }
    }

    const newRows = items.map((item: any) => {
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
      setVal(['Admin_Note', '退回原因', '管理員備註'], preservedReturnNote); 
      setVal(['Draft_Name', '草稿名稱'], status === '編輯中' && draftName ? draftName : ''); 

      return rowData;
    });

    const rangeToAppend = `Orders!A:${String.fromCharCode(65 + headers.length - 1)}`;
    await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: rangeToAppend, valueInputOption: 'USER_ENTERED', requestBody: { values: newRows } });
    
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
          
          const msg = `${titleIcon} <b>${titleText}</b>\n單號：<code>${orderId}</code>\n工班：${company}\n申請人：${reqUserNickname}\n品項數：${items.length} 項\n\n👉 請至管理後台進行審核。`;
          
          await sendTelegramMessage(adminGroupId, msg, topicNewOrder);
        }
      } catch (e) { console.error('新單推播失敗', e); }
    }

    return NextResponse.json({ status: 'success', message: status === '編輯中' ? '草稿已儲存' : '訂單已送出', orderId });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}