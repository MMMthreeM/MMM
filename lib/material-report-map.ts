import { materialColumns } from '@/lib/sheet-table';
import { canonicalMaterialText, canonicalVendor } from '@/lib/material-identity';
import { AccessError } from '@/lib/access-error';

// Report names and historic aliases are explicit, server-only mappings; never fuzzy match specifications.
export function materialReportMap(rows: unknown[][]) {
  const c = materialColumns(rows);
  const targets = new Map<string, Set<string>>();
  const key = (name: string, unit: string, vendor: string) => JSON.stringify([canonicalMaterialText(name), canonicalMaterialText(unit), canonicalVendor(vendor)]);
  for (const row of rows.slice(1)) {
    const name = String(row[c.name] || '').trim(), unit = String(row[c.unit] || '').trim(), vendor = String(row[c.vendor] || '').trim();
    if (!name) continue;
    const reportName = String(row[c.report] || name).trim();
    const aliases = String(row[c.exportAliases] || '').split(/[\n;；]/).map(value => value.trim()).filter(Boolean);
    for (const alias of [name, reportName, ...aliases]) {
      const identity = key(alias, unit, vendor);
      const values = targets.get(identity) || new Set<string>();
      values.add(reportName); targets.set(identity, values);
    }
  }
  return (item: { materialName: string; unit: string; vendor: string }) => {
    const values = targets.get(key(item.materialName, item.unit, item.vendor));
    if (values && new Set([...values].map(canonicalMaterialText)).size > 1) throw new AccessError(`材料「${item.materialName}」對應多個報表名稱，請確認 Materials 的 Report_Name 與 Export_Aliases。`, 409);
    return values?.values().next().value || item.materialName;
  };
}
