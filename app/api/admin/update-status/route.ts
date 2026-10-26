import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";
import { sendTelegramMessage } from '@/lib/telegram';

const findColIdx = (headers: string[], keys: string[]) => {
  return headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
};

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });
    const adminEmail = session.user.email;

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const userRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:F' });
    const users = userRes.data.values || [];
    const currentUser = users.find(row => row[0] === adminEmail && row[1] === 'Admin');
    if (!currentUser) return NextResponse.json({ error: '權限不足' }, { status: 403 });
    const adminNickname = currentUser[4] || adminEmail.split('@')[0];

    const body = await request.json();
    const { orderId, status, adminNote, targetMaterials, expectedDate } = body;
    const cleanAdminNote = adminNote ? adminNote.replace(/^\[退回原因\]\s*/, '') : '';

    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
    const rows = response.data.values;
    if (!rows) throw new Error("找不到資料");

    const headers = rows[0].map(h => String(h).trim());
    const statusColIdx = findColIdx(headers, ['status', '狀態']);
    const noteColIdx = findColIdx(headers, ['admin_note', '退回原因', '管理員備註']);
    let adminUserColIdx = findColIdx(headers, ['admin_user', '審核人']);
    let expDateColIdx = findColIdx(headers, ['expected_date', '預計送達', '交期']); // 💡 動態抓取交期欄位
    
    if (adminUserColIdx === -1) adminUserColIdx = headers.length; 
    if (expDateColIdx === -1) expDateColIdx = headers.length + 1;
    if (statusColIdx === -1) return NextResponse.json({ error: '找不到狀態欄位' }, { status: 400 });
    
    const getLetter = (idx: number) => String.fromCharCode(65 + idx);
    const matchingIndices: number[] = [];
    rows.forEach((row, idx) => { if (row[0] === orderId) matchingIndices.push(idx + 1); });
    if (matchingIndices.length === 0) return NextResponse.json({ error: '找不到該筆訂單' }, { status: 404 });

    const itemColIdx = findColIdx(headers, ['item_name', '材料', '品項']);
    
    const updateData = matchingIndices.flatMap(rIdx => {
      const rowMaterial = itemColIdx !== -1 ? rows[rIdx - 1][itemColIdx] : '';
      const updates = [
        { range: `Orders!${getLetter(statusColIdx)}${rIdx}`, values: [[status]] },
        { range: `Orders!${getLetter(adminUserColIdx)}${rIdx}`, values: [[adminNickname]] }
      ];
      
      if (noteColIdx !== -1 && cleanAdminNote) {
        const shouldApply = targetMaterials && targetMaterials.length > 0 ? targetMaterials.includes(rowMaterial) : true;
        updates.push({ range: `Orders!${getLetter(noteColIdx)}${rIdx}`, values: [[shouldApply ? cleanAdminNote : '']] });
      }
      
      // 💡 如果有傳入交期，一併更新寫入
      if (expectedDate && expDateColIdx !== -1) {
        updates.push({ range: `Orders!${getLetter(expDateColIdx)}${rIdx}`, values: [[expectedDate]] });
      }
      return updates;
    });
    
    if (headers.indexOf('Admin_User') === -1 && findColIdx(headers, ['admin_user', '審核人']) === -1) {
       updateData.push({ range: `Orders!${getLetter(adminUserColIdx)}1`, values: [['Admin_User']] });
    }
    if (headers.indexOf('Expected_Date') === -1 && findColIdx(headers, ['expected_date', '預計送達', '交期']) === -1) {
       updateData.push({ range: `Orders!${getLetter(expDateColIdx)}1`, values: [['Expected_Date']] });
    }

    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: sheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: updateData } });
    
    try {
      const { logAudit } = await import('@/lib/audit');
      const actionName = status === '處理中' && cleanAdminNote ? '退回訂單' : `更改狀態為 [${status}]`;
      let logDetails = targetMaterials && targetMaterials.length > 0 ? `影響特定項目，備註: ${cleanAdminNote || '無'}` : `整單連動，備註: ${cleanAdminNote || '無'}`;
      if (expectedDate) logDetails += ` | 押定交期: ${expectedDate}`;
      await logAudit(adminEmail, actionName, orderId, logDetails);
    } catch (e) { console.error('寫入 Log 失敗', e); }

    try {
      const reqUserColIdx = findColIdx(headers, ['req_user', '申請人']);
      const reqUserEmail = reqUserColIdx !== -1 ? rows[matchingIndices[0] - 1][reqUserColIdx] : '';
      const targetUser = users.find(u => u[0] === reqUserEmail);
      const userChatId = targetUser?.[5]; 
      const reqUserNickname = (targetUser && targetUser[4]) ? targetUser[4] : reqUserEmail.split('@')[0];
      const adminGroupId = process.env.TG_ADMIN_GROUP_ID;
      const topicReturn = process.env.TG_TOPIC_RETURN;

      if (status === '處理中' && cleanAdminNote) { 
        if (userChatId) await sendTelegramMessage(userChatId, `⚠️ <b>訂單退回通知</b>\n單號：<code>${orderId}</code>\n審核人：${adminNickname}\n\n👉 <b>${cleanAdminNote}</b>\n請登入系統修改後再次送出！`);
        if (adminGroupId) await sendTelegramMessage(adminGroupId, `🔙 <b>退回紀錄備份</b>\n單號：<code>${orderId}</code>\n處理人：${adminNickname}\n原因：${cleanAdminNote}\n通知對象：${reqUserNickname}`, topicReturn);
      } else if (status === '準備出貨' && userChatId) {
        // 💡 交期通知
        await sendTelegramMessage(userChatId, `📦 <b>準備出貨通知</b>\n單號：<code>${orderId}</code>\n您的材料已審核完畢！${expectedDate ? `\n📆 預計送達：<b>${expectedDate}</b>` : ''}`);
      } else if (status === '已送達' && userChatId) {
        await sendTelegramMessage(userChatId, `✅ <b>材料送達通知</b>\n單號：<code>${orderId}</code>\n您的材料已標記為送達！`);
      }
    } catch (e) { console.error("推播發生例外錯誤", e); }

    return NextResponse.json({ status: 'success', adminUser: adminNickname, expectedDate });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}