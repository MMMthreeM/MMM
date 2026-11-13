import 'server-only';
import type { getGoogleSheets } from './google-sheets';
import { readSingleSheet } from './single-sheet-store.server';
import { orderColumns } from './sheet-table';

export async function loadOrderSheet(sheets:Awaited<ReturnType<typeof getGoogleSheets>>){
  const snapshot=await readSingleSheet(sheets),headers=[...snapshot.tables.Orders[0]].map(String);
  return {rows:snapshot.db.rows,raw:snapshot.tables.Orders,headers,columns:orderColumns(headers)};
}
