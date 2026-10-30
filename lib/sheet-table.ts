import { AccessError } from '@/lib/access-error';

const normalized = (value: unknown) => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/[\s_-]+/g, '');
export function headerColumn(headers: unknown[], aliases: string[], sheet = '資料表') {
  const names = headers.map(normalized);
  const seen = new Set<string>();
  names.forEach(name => { if (name && seen.has(name)) throw new AccessError(`${sheet} 表頭重複：${name}。請保留唯一欄位。`, 409); if (name) seen.add(name); });
  const matches = names.flatMap((name, index) => name && aliases.some(alias => normalized(alias) === name) ? [index] : []);
  if (matches.length > 1) throw new AccessError(`${sheet} 的 ${aliases[0]} 有多個同義表頭，請確認欄位。`, 409);
  return matches[0] ?? -1;
}
export function sheetColumns<T extends Record<string, string[]>>(headers: unknown[], schema: T, required: (keyof T)[], sheet: string) {
  const columns = Object.fromEntries(Object.entries(schema).map(([key, aliases]) => [key, headerColumn(headers, aliases, sheet)])) as Record<keyof T, number>;
  for (const key of required) if (columns[key] < 0) throw new AccessError(`${sheet} 缺少必要表頭：${schema[key][0]}。`, 409);
  return columns;
}
export const userSchema = {
  email: ['Email','User_Email','信箱'], role: ['Role','角色','身分'], company: ['Company','Req_Company','工班','公司'],
  region: ['Region','地區','區域'], name: ['Nickname','Name','暱稱','姓名'], chat: ['Telegram_Chat_ID','Chat_ID','Chat','TG_Chat_ID'],
};
export const materialSchema = {
  id: ['Item_ID','Material_ID','ID'], name: ['Item_Name','Name','材料名稱','名稱','材料'], tags: ['Tags','標籤'],
  vendor: ['Vendor','廠商'], unit: ['Unit','單位'], min: ['Min_Qty','Min','最低數量'], step: ['Step_Qty','Step','級距'],
  price: ['Price','單價'], category: ['Category'], subcategory: ['Subcategory'], aliases: ['Search_Aliases'],
  hint: ['Order_Hint'], remarks: ['Requires_Remarks'], display: ['Display_Name'], report: ['Report_Name'], exportAliases: ['Export_Aliases'],
};
export const orderSchema = {
  orderId: ['Order_ID','單號'], orderDate: ['Order_Date','日期','時間'], reqUser: ['Req_User','申請人','信箱'],
  reqCompany: ['Req_Company','工班','公司'], reqRegion: ['Req_Region','地區','區域'], materialName: ['Item_Name','材料','品項'],
  quantity: ['Quantity','數量'], unit: ['Unit','單位'], remarks: ['Remarks','備註'], vendor: ['Vendor','廠商'], status: ['Status','狀態'],
  adminNote: ['Admin_Note','退回原因','管理員備註'], draftName: ['Draft_Name','草稿名稱'], adminUser: ['Admin_User','審核人'],
  expectedDate: ['Expected_Date','預計送達','交期'], returnNote: ['Order_Return_Note','整單退回原因'], lineId: ['Line_ID'],
};
export const materialColumns = (rows: unknown[][]) => sheetColumns(rows[0] || [], materialSchema, ['id','name','vendor','unit','min','step'], 'Materials');
export const orderColumns = (headers: unknown[]) => sheetColumns(headers, orderSchema, ['orderId','orderDate','reqUser','reqCompany','materialName','quantity','unit','vendor','status'], 'Orders');
export function readUsers(rows: unknown[][]) {
  const c = sheetColumns(rows[0] || [], userSchema, ['email','role','company'], 'Users');
  return rows.slice(1).map(row => ({ email: String(row[c.email] ?? '').trim(), role: String(row[c.role] ?? '').trim(), company: String(row[c.company] ?? '').trim(), region: String(row[c.region] ?? ''), name: String(row[c.name] || row[c.email] || ''), chat: String(row[c.chat] || '') })).filter(user => user.email);
}
