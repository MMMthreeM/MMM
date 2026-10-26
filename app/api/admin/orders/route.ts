import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google-sheets';
import { getServerSession } from "next-auth/next";

const findColIdx = (headers: string[], keys: string[]) => {
  return headers.findIndex(h => keys.some(k => h.toLowerCase().includes(k.toLowerCase())));
};

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    const userRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:E' });
    const users = userRes.data.values || [];
    if (!users.find(row => row[0] === session.user?.email && row[1] === 'Admin')) return NextResponse.json({ error: '權限不足' }, { status: 403 });
    
    const userMap = new Map();
    users.forEach(u => {
       const email = u[0];
       const prefix = email.split('@')[0];
       const nickname = u[4] || prefix; 
       userMap.set(email, nickname);
       userMap.set(prefix, nickname);
    });

    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Orders!A:Z' });
    const rows = response.data.values;
    if (!rows || rows.length <= 1) return NextResponse.json({ data: [] });

    const headers = rows[0].map(h => String(h).trim());
    const idx = {
      id: findColIdx(headers, ['order_id', '單號']),
      date: findColIdx(headers, ['order_date', '日期']),
      user: findColIdx(headers, ['req_user', '申請人']),
      company: findColIdx(headers, ['req_company', '工班', '公司']),
      region: findColIdx(headers, ['req_region', '地區']),
      item: findColIdx(headers, ['item_name', '材料']),
      qty: findColIdx(headers, ['quantity', '數量']),
      unit: findColIdx(headers, ['unit', '單位']),
      remarks: findColIdx(headers, ['remarks', '備註']),
      vendor: findColIdx(headers, ['vendor', '廠商']),
      status: findColIdx(headers, ['status', '狀態']),
      adminNote: findColIdx(headers, ['admin_note', '退回原因', '管理員']),
      draftName: findColIdx(headers, ['draft_name', '草稿名稱']),
      adminUser: findColIdx(headers, ['admin_user', '審核人'])
    };

    const allOrders = rows.slice(1).map(row => ({
      orderId: idx.id !== -1 ? row[idx.id] : '', 
      orderDate: idx.date !== -1 ? row[idx.date] : '', 
      reqUser: idx.user !== -1 ? (userMap.get(row[idx.user]) || row[idx.user]) : '', 
      reqCompany: idx.company !== -1 ? row[idx.company] : '', 
      reqRegion: idx.region !== -1 ? row[idx.region] : '',
      materialName: idx.item !== -1 ? row[idx.item] : '', 
      quantity: idx.qty !== -1 ? row[idx.qty] : 0, 
      unit: idx.unit !== -1 ? row[idx.unit] : '',
      remarks: idx.remarks !== -1 ? row[idx.remarks] : '', 
      vendor: idx.vendor !== -1 ? row[idx.vendor] : '未指定',
      status: idx.status !== -1 ? row[idx.status] : '', 
      adminNote: idx.adminNote !== -1 ? (row[idx.adminNote] || '') : '',
      draftName: idx.draftName !== -1 ? (row[idx.draftName] || '') : '',
      adminUser: idx.adminUser !== -1 ? (userMap.get(row[idx.adminUser]) || row[idx.adminUser]) : ''
    }));

    return NextResponse.json({ data: allOrders.reverse() });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}