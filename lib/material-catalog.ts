import { materialColumns } from '@/lib/sheet-table';
import { toMaterialRules, type MaterialRule } from '@/lib/order-domain';

export type CatalogMaterial = MaterialRule & { tags: string[]; category: string; subcategory: string; aliases: string[]; orderHint: string; displayName: string; packUnit?: string; unitsPerPack?: number };
const splitWords = (value: unknown) => String(value ?? '').split(/[,，\n]/).map((word) => word.trim()).filter(Boolean);

// Explicitly whitelist public fields: Price stays on the server.
export function publicMaterials(rows: unknown[][]): CatalogMaterial[] {
  const c = materialColumns(rows);
  const read = (row: unknown[], column: number) => String(row[column] ?? '').trim();
  const rules = new Map(toMaterialRules(rows).map((rule) => [rule.id, rule]));
  return rows.slice(1).flatMap((row) => {
    const rule = rules.get(String(row[c.id] ?? ''));
    if (!rule) return [];
    const packUnit = read(row, c.packUnit), unitsPerPack = Number(read(row, c.unitsPerPack));
    const packaging = packUnit && Number.isFinite(unitsPerPack) && unitsPerPack > 0 ? { packUnit, unitsPerPack } : {};
    return [{ ...rule, ...packaging, tags: splitWords(row[c.tags]), category: read(row, c.category) || '其他材料', subcategory: read(row, c.subcategory), aliases: splitWords(read(row, c.aliases)), orderHint: read(row, c.hint), displayName: read(row, c.display) || rule.name }];
  });
}

export type SearchableOption = { value: string; label: string; detail?: string; keywords?: string };
const fold = (text: string) => text.normalize('NFKC').toLowerCase().replace(/平方/g, 'mm2').replace(/英吋|吋|["”″]/g, 'in');
export const normalizeSearchText = (text: string) => fold(text).replace(/[^\p{L}\p{N}.]/gu, '');
export function searchTokens(query: string) {
  return fold(query).replace(/([0-9a-z.])([\p{Script=Han}])/gu, '$1 $2').replace(/([\p{Script=Han}])([0-9a-z.])/gu, '$1 $2').split(/[\s*×/()（）、,，-]+/).map(normalizeSearchText).filter(Boolean);
}
export function rankSearchOptions<T extends SearchableOption>(options: T[], query: string): T[] {
  const tokens = searchTokens(query);
  if (!tokens.length) return options;
  const whole = normalizeSearchText(query);
  return options.map((option, index) => {
    const name = normalizeSearchText(option.label), id = normalizeSearchText(option.value);
    const aliases = normalizeSearchText(option.keywords || ''), detail = normalizeSearchText(option.detail || '');
    const haystack = `${name} ${aliases} ${detail} ${id}`;
    if (!tokens.every((token) => haystack.includes(token))) return { option, index, score: -1 };
    const score = (id === whole ? 600 : 0) + (name === whole ? 500 : name.startsWith(whole) ? 150 : 0) + tokens.reduce((sum, token) => sum + (name.includes(token) ? 30 : aliases.includes(token) ? 16 : 4), 0);
    return { option, index, score };
  }).filter((entry) => entry.score >= 0).sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.option);
}

export function materialOption(material: CatalogMaterial): SearchableOption {
  return { value: material.id, label: material.displayName || material.name, detail: `${material.unit} · ${material.subcategory || material.category || '材料'}`, keywords: [material.name, ...(material.tags || []), ...(material.aliases || []), material.category, material.subcategory].filter(Boolean).join(' ') };
}
