import { normalizeSearchText, searchTokens, type CatalogMaterial } from '@/lib/material-catalog';

export type TextOrderLine = { source: string; name: string; quantity: number | null; unit: string; calculation: string; candidates: string[] };
const unitPattern = '公尺|毫米|公斤|米|mm|kg|m|個|只|支|條|片|組|套|式|箱|卷|捲|丸|包|盒';
const numberPattern = '\\d+(?:,\\d{3})*(?:\\.\\d+)?';
const quantityPattern = new RegExp(`(?:[：:×*＝=]|[-－]\\s*|\\s+)?(${numberPattern})\\s*(${unitPattern})(?:\\s*[×*x]\\s*(${numberPattern})\\s*(箱|卷|捲|丸|包|盒))?\\s*$`, 'i');
export function equivalentUnit(unit: string) {
  const key = unit.normalize('NFKC').trim().toLowerCase();
  return ['m', '米', '公尺'].includes(key) ? 'm' : ['個', '只'].includes(key) ? '個' : ['卷', '捲', '丸'].includes(key) ? '卷' : key;
}

export function suggestedTextQuantity(material: CatalogMaterial, line: Pick<TextOrderLine, 'quantity' | 'unit'>) {
  const quantity = line.quantity === null ? material.minQty : equivalentUnit(material.unit) === equivalentUnit(line.unit) ? line.quantity : material.minQty * line.quantity;
  return Number.isSafeInteger(quantity) && quantity > 0 ? String(quantity) : '';
}

export function parseTextOrder(text: string, materials: CatalogMaterial[]) {
  if (text.length > 12000) throw new Error('叫料文字最多 12,000 字，請分批處理。');
  const notes: string[] = [];
  const lines: TextOrderLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const source = raw.trim();
    if (!source || /^[-－—_=＊*\s]{3,}$/.test(source)) continue;
    if (/^(【|備註[：:]|注意[：:]|交貨[：:])/.test(source)) { notes.push(source); continue; }
    const clean = source.normalize('NFKC').replace(/^(?:\d+[、．]|\d+\.\s+)\s*/, '');
    const match = quantityPattern.exec(clean);
    const name = match ? clean.slice(0, match.index).replace(/[\s:：*×-]+$/, '') : clean;
    const base = match ? Number(match[1].replaceAll(',', '')) : null;
    const multiplier = match?.[3] ? Number(match[3].replaceAll(',', '')) : 1;
    const quantity = base === null ? null : base * multiplier;
    const query = normalizeSearchText(name);
    const tokens = searchTokens(name);
    const candidates = materials.map(material => {
      const names = [material.name, material.displayName, ...(material.aliases || [])].filter(Boolean).map(normalizeSearchText);
      const exact = names.includes(query);
      const score = exact ? 1000 : tokens.filter(token => names.some(value => value.includes(token))).length;
      return { id: material.id, score };
    }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map(entry => entry.id);
    lines.push({ source, name: name || clean, quantity: quantity !== null && Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null, unit: match?.[2] || '', calculation: match?.[3] ? `${match[1]} ${match[2]} × ${match[3]} ${match[4]} = ${quantity?.toLocaleString('zh-TW')} ${match[2]}` : '', candidates });
  }
  if (lines.length > 100) throw new Error('一次最多分析 100 筆材料，請分批貼上。');
  return { lines, notes: notes.join('\n') };
}

export function textLineError(material: CatalogMaterial | undefined, quantity: number | null, remarks: string) {
  if (!material) return '請選擇對應材料；無符合項目時可略過，稍後用自填材料加入。';
  if (quantity === null || !Number.isSafeInteger(quantity) || quantity <= 0) return '請確認並填寫正整數數量。';
  if (quantity < material.minQty || quantity % material.stepQty !== 0) return `數量須至少 ${material.minQty}，且為 ${material.stepQty} 的倍數。`;
  if (material.requiresRemarks && !remarks.trim()) return '此材料須填寫規格與數量備註。';
  if (remarks.length > 500) return '備註最多 500 字，請縮短交貨備註或本筆備註。';
  return '';
}
