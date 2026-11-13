import type { OrderGroup } from './order-view';

/** A preview never changes the complete order used by selection or mutations. */
export function orderListPreview(group: OrderGroup, material = '', search = '') {
  const tokens = search.trim().toLocaleLowerCase('zh-TW').split(/\s+/).filter(Boolean);
  const ranked = group.items.map((item, index) => {
    const name = item.materialName.toLocaleLowerCase('zh-TW');
    const score = (material && item.materialName === material ? tokens.length + 1 : 0)
      + tokens.filter(token => name.includes(token)).length;
    return { item, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, 2).map(({ item }) => item);
}
