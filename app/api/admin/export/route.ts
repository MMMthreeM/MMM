import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import ExcelJS from 'exceljs';
import { getGoogleSheets } from '@/lib/google-sheets';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const sheets = await getGoogleSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    const userRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:B' });
    const users = userRes.data.values || [];
    if (!users.find(r => r[0] === session.user?.email && r[1] === 'Admin')) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { filteredData } = body;
    if (!filteredData || filteredData.length === 0) return NextResponse.json({ error: '無資料' }, { status: 400 });

    const matRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Materials!A:Z' });
    const matRows = matRes.data.values || [];
    const priceMap = new Map<string, number>();
    
    let priceIdx = 8, nameIdx = 1; 
    if (matRows.length > 0) {
      const headers = matRows[0].map(h => String(h).toLowerCase().trim());
      const pIdx = headers.findIndex(h => h.includes('price') || h.includes('單價') || h.includes('nt'));
      const nIdx = headers.findIndex(h => h.includes('name') || h.includes('名稱') || h.includes('材料'));
      if (pIdx !== -1) priceIdx = pIdx;
      if (nIdx !== -1) nameIdx = nIdx;
    }

    matRows.slice(1).forEach(row => {
      const name = row[nameIdx];
      const priceVal = String(row[priceIdx] || '').replace(/,/g, '').trim();
      if (name && !isNaN(parseFloat(priceVal))) priceMap.set(name, parseFloat(priceVal));
    });

    const companies = Array.from(new Set(filteredData.map((d: any) => d.reqCompany).filter(Boolean))) as string[];
    const companyCount = companies.length;
    const materialMap = new Map();
    filteredData.forEach((d: any) => {
      if (!materialMap.has(d.materialName)) {
        materialMap.set(d.materialName, { name: d.materialName, unit: d.unit, vendor: d.vendor, companyTotals: {} });
        companies.forEach(c => materialMap.get(d.materialName).companyTotals[c] = 0);
      }
      materialMap.get(d.materialName).companyTotals[d.reqCompany] += Number(d.quantity);
    });

    const workbook = new ExcelJS.Workbook();
    const sheet1 = workbook.addWorksheet('維運材料總表');

    sheet1.columns = [
      { width: 6 }, { width: 35 }, { width: 6 }, { width: 12 }, { width: 8 }, { width: 10 }, { width: 12 },
      ...companies.map(() => ({ width: 10 })), { width: 8 }, { width: 8 }
    ];

    const yellowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    const blueFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    const greenFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };
    const redFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    const borderAll: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    sheet1.addRow([]); sheet1.addRow([]);
    for(let i=1; i<=9+companyCount; i++) { sheet1.getCell(1, i).fill = yellowFill; sheet1.getCell(2, i).fill = yellowFill; }

    sheet1.mergeCells('A1:D2');
    sheet1.getCell('A1').value = '高雄PFI維修數量庫存(總表)';
    sheet1.getCell('A1').font = { name: '微軟正黑體', size: 14, bold: true };
    sheet1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

    sheet1.getCell('E1').value = '單價';
    sheet1.getCell('E1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet1.mergeCells('F1:G1');
    sheet1.getCell('F1').value = 'JACK 協助維護';
    sheet1.getCell('F1').fill = blueFill;
    sheet1.getCell('F1').alignment = { vertical: 'middle', horizontal: 'center' };

    sheet1.getCell(1, 8+companyCount).value = '需求總量';
    sheet1.getCell(1, 9+companyCount).value = '需求總量';
    sheet1.getCell(1, 9+companyCount).font = { color: { argb: 'FF0070C0' }, bold: true };

    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    sheet1.getCell(2, 8).value = todayStr;
    sheet1.getCell(2, 8).alignment = { horizontal: 'center' };
    if(companyCount > 1) sheet1.mergeCells(2, 8, 2, 7+companyCount);

    const headers = ['項目', '型號', '單位', '品牌', 'NT', '數量', 'TOTAL NT$', ...companies, '加總', '總數'];
    const headerRow = sheet1.addRow(headers);
    headerRow.eachCell((cell, colNum) => {
      cell.font = { name: '微軟正黑體', size: 11, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderAll;
      if (colNum === 6 || colNum === 7) cell.fill = blueFill; else cell.fill = yellowFill;
      if (colNum === 9+companyCount) cell.font = { color: { argb: 'FF0070C0' }, bold: true };
    });

    let rowIndex = 4, itemIndex = 1;
    materialMap.forEach((mat) => {
      const displayVendor = (mat.vendor && mat.vendor !== '未指定') ? `外購/${mat.vendor}` : (mat.vendor || '');
      const unitPrice = priceMap.has(mat.name) ? priceMap.get(mat.name) : '';
      const rowData = [itemIndex++, mat.name, mat.unit, displayVendor, unitPrice, '', ''];
      companies.forEach(c => rowData.push(mat.companyTotals[c] || 0));
      
      const row = sheet1.addRow(rowData);
      const firstCol = sheet1.getColumn(8).letter;
      const lastCol = sheet1.getColumn(7 + companyCount).letter;
      
      row.getCell(6).value = { formula: `SUM(${firstCol}${rowIndex}:${lastCol}${rowIndex})`, result: 0 };
      row.getCell(6).fill = blueFill;
      row.getCell(7).value = { formula: `IF(ISNUMBER(E${rowIndex}), IF(E${rowIndex}=0, "-", E${rowIndex}*F${rowIndex}), "-")`, result: 0 };
      row.getCell(7).fill = blueFill;
      
      const sumF = `SUM(${firstCol}${rowIndex}:${lastCol}${rowIndex})`;
      row.getCell(8+companyCount).value = { formula: sumF, result: 0 };
      row.getCell(9+companyCount).value = { formula: sumF, result: 0 };

      row.eachCell((cell, colNum) => {
        cell.border = borderAll; cell.font = { name: '微軟正黑體', size: 11 };
        if (colNum === 1) cell.fill = greenFill; else if (colNum === 6 || colNum === 7) cell.fill = blueFill; 
        else cell.alignment = { horizontal: colNum === 2 ? 'left' : 'center' };
        if (colNum === 5 && mat.companyTotals[companies[0]] !== undefined) {
          let t = 0; companies.forEach(c => t += mat.companyTotals[c]);
          if (t === 0) cell.fill = redFill;
        }
      });
      rowIndex++;
    });

    sheet1.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 9 + companyCount } };

    const sheet2 = workbook.addWorksheet('需求原始明細');
    sheet2.columns = [
      { header: '訂單編號', key: 'orderId', width: 18 }, { header: '下單時間', key: 'orderDate', width: 18 },
      { header: '申請人', key: 'reqUser', width: 25 }, { header: '申請工班', key: 'reqCompany', width: 15 },
      { header: '地區', key: 'reqRegion', width: 10 }, { header: '廠商', key: 'vendor', width: 15 }, 
      { header: '材料名稱與規格', key: 'materialName', width: 45 }, { header: '數量', key: 'quantity', width: 10 }, 
      { header: '需求備註', key: 'remarks', width: 35 }, { header: '管理員附註', key: 'adminNote', width: 35 },
      { header: '目前狀態', key: 'status', width: 12 }
    ];
    sheet2.getRow(1).font = { bold: true }; sheet2.getRow(1).fill = blueFill;
    filteredData.forEach((order: any) => sheet2.addRow({ ...order, quantity: Number(order.quantity) }));

    const buffer = await workbook.xlsx.writeBuffer();
    // 💡 核心修正：強制將 buffer 轉為 any，避開 Vercel 的嚴格型別誤判
    return NextResponse.json({ status: 'success', fileContent: (buffer as any).toString('base64') });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}