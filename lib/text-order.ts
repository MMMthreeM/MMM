import { normalizeSearchText, searchTokens, type CatalogMaterial } from '@/lib/material-catalog';

export type TextOrderLine = { source: string; name: string; quantity: number | null; unit: string; calculation: string; candidates: string[] };
const unitPattern = '公尺|公斤|米|kg|m|個|只|支|條|片|組|套|式|箱|卷|捲|丸|包|盒';
const numberPattern = '\\d+(?:,\\d{3})*(?:\\.\\d+)?';
const quantityPattern = new RegExp(`(${numberPattern})\\s*(${unitPattern})(?:\\s*[×*x]\\s*(${numberPattern})\\s*(箱|卷|捲|丸|包|盒))?\\s*[)）]?\\s*$`, 'i');
export function equivalentUnit(unit: string) {
  const key = unit.normalize('NFKC').trim().toLowerCase();
  return ['m', '米', '公尺'].includes(key) ? 'm' : ['個', '只'].includes(key) ? '個' : ['卷', '捲', '丸'].includes(key) ? '卷' : key;
}
export function multiplyTextQuantity(a:number,b:number):number {
  const decimal=(value:number)=>{const [coefficient,exponent='0']=String(value).toLowerCase().split('e'),[whole,fraction='']=coefficient.split('.');return {n:BigInt(whole+fraction),scale:fraction.length-Number(exponent)};};
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)return 0;
  const x=decimal(a),y=decimal(b),digits=(x.n*y.n).toString(),scale=x.scale+y.scale;
  const padded=digits.padStart(Math.max(1,scale+1),'0');
  return Number(scale<=0?digits+'0'.repeat(-scale):padded.slice(0,-scale)+'.'+padded.slice(-scale));
}
export function textQuantity(material: CatalogMaterial, line: Pick<TextOrderLine, 'quantity' | 'unit'>): {amount:string; issue:string} {
  if (line.quantity === null) return {amount:'',issue:'請填數量'};
  if (equivalentUnit(material.unit) === equivalentUnit(line.unit)) return {amount:String(line.quantity),issue:''};
  if (material.packUnit && equivalentUnit(material.packUnit) === equivalentUnit(line.unit) && Number.isFinite(material.unitsPerPack) && material.unitsPerPack! > 0) {
    const amount = multiplyTextQuantity(line.quantity,material.unitsPerPack!);
    return Number.isFinite(amount) && amount > 0 ? {amount:String(amount),issue:''} : {amount:'',issue:'請核對包裝換算數量'};
  }
  return {amount:'',issue:line.unit==='箱'?'請補每箱數量':`請將原文「${line.quantity} ${line.unit}」換算為 ${material.unit}`};
}
export function suggestedTextQuantity(material: CatalogMaterial, line: Pick<TextOrderLine, 'quantity' | 'unit'>) { return textQuantity(material,line).amount; }
export function exactTextMaterial(line:TextOrderLine,materials:CatalogMaterial[]) {
  const matches=materials.filter(m=>[m.name,m.displayName,...(m.aliases||[])].some(n=>normalizeSearchText(n||'')===normalizeSearchText(line.name)));
  return matches.length===1?matches[0]:undefined;
}
export function parseTextOrder(text: string, materials: CatalogMaterial[]) {
  if (text.length > 12000) throw new Error('叫料文字最多 12,000 字，請分批處理。');
  const notes: string[] = [], lines: TextOrderLine[] = [];
  let noteContinuation=false;
  for (const raw of text.split(/\r?\n/)) {
    const source = raw.trim();
    if (!source || /^[-－—_=＊*\s]{3,}$/.test(source)) {noteContinuation=false;continue;}
    if (/^(?:鶴峻維運材料|叫料清單|材料清單)[：:：\s]*$/.test(source)) continue;
    const clean = source.normalize('NFKC').replace(/^(?:\d+[、．)]|\d+\.\s+|[（(]\d+[)）])\s*/, '');
    if(!clean.trim()||/^\d+[.)、]$/.test(clean))continue;
    const match = quantityPattern.exec(clean);
    // A trailing length is a quantity only when separated from the material.
    // In particular mm², 120CM, wattage and pole counts are specifications.
    const validMatch = match && !/[\da-z.]$/i.test(clean.slice(0,match.index)) && !/(?:規格|長度)\s*[:：]?\s*$/i.test(clean.slice(0,match.index)) ? match : null;
    if (/^(?:【|備註[：:]|注意[：:]|交貨[：:]|以上.*(?:電線|電纜)|每棧|搬運|堆疊)/.test(source) || noteContinuation&&!validMatch) {notes.push(source);noteContinuation=true;continue;}
    noteContinuation=false;
    const name = validMatch ? clean.slice(0, validMatch.index).replace(/[\s:：*×=／/-]+$/, '') : clean;
    const base = validMatch ? Number(validMatch[1].replaceAll(',', '')) : null;
    const multiplier = validMatch?.[3] ? Number(validMatch[3].replaceAll(',', '')) : 1;
    const quantity = base === null ? null : base * multiplier;
    const query = normalizeSearchText(name), tokens = searchTokens(name);
    const candidates = materials.map(material => {
      const names = [material.name, material.displayName, ...(material.aliases || [])].filter(Boolean).map(normalizeSearchText);
      return { id: material.id, score: names.includes(query) ? 1000 : tokens.filter(token => names.some(value => value.includes(token))).length };
    }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map(entry => entry.id);
    lines.push({ source, name: name || clean, quantity: quantity !== null && Number.isFinite(quantity) && quantity > 0 ? quantity : null, unit: validMatch?.[2] || '', calculation: validMatch?.[3] ? `${validMatch[1]} ${validMatch[2]} × ${validMatch[3]} ${validMatch[4]} = ${quantity} ${validMatch[2]}` : '', candidates });
  }
  if (lines.length > 100) throw new Error('一次最多整理 100 筆材料，請分批貼上。');
  return { lines, notes: notes.join('\n'), noteTargets: lines.flatMap((line,index)=>/電線|電纜|線材/.test(line.name)?[index]:[]) };
}
export function textLineError(material: CatalogMaterial | undefined, quantity: number | null, remarks: string) {
  if (!material) return '請選材料';
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) return '請填有效數量';
  if (quantity < material.minQty || quantity % material.stepQty !== 0) return `數量須至少 ${material.minQty}，且為 ${material.stepQty} 的倍數。`;
  if (material.requiresRemarks && !remarks.trim()) return '請補備註';
  if (remarks.length > 500) return '備註最多 500 字';
  return '';
}
