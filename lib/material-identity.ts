// Validation and export must agree on aliases, or custom items can evade catalog rules.
export const canonicalMaterialText = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export const canonicalVendor = (value: string) => canonicalMaterialText(value).replace(/^外購\//, '');
export const materialIdentity = (item: { materialName: string; unit?: string; vendor?: string }) => JSON.stringify([canonicalMaterialText(item.materialName), canonicalMaterialText(item.unit || ''), canonicalVendor(item.vendor || '')]);
