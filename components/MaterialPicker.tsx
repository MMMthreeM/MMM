'use client';
import { useState } from 'react';
import SearchSelect from '@/components/SearchSelect';
import { materialOption, type CatalogMaterial } from '@/lib/material-catalog';

export default function MaterialPicker({ materials, value, onChange, disabled }: { materials: CatalogMaterial[]; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [category, setCategory] = useState(''), [subcategory, setSubcategory] = useState('');
  const selected = materials.find((material) => material.id === value);
  const categories = [...new Set(materials.map((material) => material.category || '其他材料'))];
  const subcategories = [...new Set(materials.filter((material) => (material.category || '其他材料') === category).map((material) => material.subcategory).filter(Boolean))];
  const filtered = materials.filter((material) => (!category || (material.category || '其他材料') === category) && (!subcategory || material.subcategory === subcategory));
  return <div className="material-picker">
    <div className="material-filter-grid">
      <label><span className="form-label">材料分類</span><select className="form-control" aria-label="材料分類" disabled={disabled} value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory(''); }}><option value="">全部分類</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
      {category && subcategories.length > 1 && <label><span className="form-label">細分類</span><select className="form-control" aria-label="材料細分類" value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="">全部細分類</option>{subcategories.map((name) => <option key={name}>{name}</option>)}</select></label>}
    </div>
    <SearchSelect key={`${category}:${subcategory}`} label="搜尋並選擇材料" value={value} valueLabel={selected?.displayName || selected?.name} options={filtered.map((material) => ({ ...materialOption(material), detail: `${material.unit} · ${material.subcategory || material.category || '材料'}` }))} onChange={onChange} emptyLabel="" placeholder={disabled ? '正在載入材料…' : '例如：1.25 黑線、75W E27、歐姆夾'} disabled={disabled} />
    <div className="material-result-summary"><span>{disabled ? '材料載入中' : `目前範圍 ${filtered.length} 種材料`}</span>{(category || subcategory) && <button type="button" onClick={() => { setCategory(''); setSubcategory(''); }}>清除篩選</button>}</div>
    {selected && <div className="material-selected"><div className="material-selected-heading"><div><p className="font-bold leading-6">{selected.displayName || selected.name}</p><dl className="material-facts"><div><dt>下訂單位</dt><dd>{selected.unit}</dd></div></dl></div></div>{selected.orderHint && <p className="mt-3 text-sm leading-6">{selected.orderHint}</p>}{selected.name.includes('\n') && <details className="mt-3 text-sm leading-6"><summary>查看混合材料完整內容</summary><p className="whitespace-pre-line mt-2">{selected.name}</p></details>}</div>}
  </div>;
}
