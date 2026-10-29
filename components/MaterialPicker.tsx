'use client';
import { useState } from 'react';
import SearchSelect from '@/components/SearchSelect';
import { materialIdentity, type useMaterialPreferences } from '@/components/useMaterialPreferences';
import { materialOption, type CatalogMaterial } from '@/lib/material-catalog';

export default function MaterialPicker({ materials, value, onChange, disabled, preferences }: { materials: CatalogMaterial[]; value: string; onChange: (value: string) => void; disabled: boolean; preferences: ReturnType<typeof useMaterialPreferences> }) {
  const [category, setCategory] = useState(''), [subcategory, setSubcategory] = useState('');
  const [scope, setScope] = useState<'all' | 'favorites' | 'recent'>('all');
  const selected = materials.find((material) => material.id === value);
  const categories = [...new Set(materials.map((material) => material.category || '其他材料'))];
  const subcategories = [...new Set(materials.filter((material) => (material.category || '其他材料') === category).map((material) => material.subcategory).filter(Boolean))];
  const ids = scope === 'favorites' ? preferences.favorites : preferences.recent;
  const pool = scope === 'all' ? materials : ids.flatMap((id) => materials.filter((material) => materialIdentity(material) === id));
  const filtered = pool.filter((material) => (!category || (material.category || '其他材料') === category) && (!subcategory || material.subcategory === subcategory));
  const favorite = selected && preferences.favorites.includes(materialIdentity(selected));
  return <div className="material-picker">
    <div className="material-scope" role="group" aria-label="材料快速入口">{[{ id: 'all' as const, label: '全部材料' }, { id: 'favorites' as const, label: '常用材料' }, { id: 'recent' as const, label: '最近選用' }].map((entry) => <button type="button" key={entry.id} aria-pressed={scope === entry.id} onClick={() => { setScope(entry.id); setCategory(''); setSubcategory(''); }}>{entry.label}</button>)}</div>
    <div className="material-filter-grid">
      <label><span className="form-label">材料分類</span><select className="form-control" aria-label="材料分類" disabled={disabled} value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory(''); }}><option value="">全部分類</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
      {category && subcategories.length > 1 && <label><span className="form-label">細分類</span><select className="form-control" aria-label="材料細分類" value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="">全部細分類</option>{subcategories.map((name) => <option key={name}>{name}</option>)}</select></label>}
    </div>
    <SearchSelect key={`${scope}:${category}:${subcategory}`} label="搜尋並選擇材料" value={value} valueLabel={selected?.displayName || selected?.name} options={filtered.map((material) => ({ ...materialOption(material), detail: `${material.unit} · ${material.subcategory || material.category || '材料'}` }))} onChange={onChange} emptyLabel="" placeholder={disabled ? '正在載入材料…' : '例如：1.25 黑線、75W E27、歐姆夾'} disabled={disabled} />
    <div className="material-result-summary"><span>{disabled ? '材料載入中' : `目前範圍 ${filtered.length} 種材料`}</span>{(category || subcategory || scope !== 'all') && <button type="button" onClick={() => { setCategory(''); setSubcategory(''); setScope('all'); }}>清除篩選</button>}</div>
    {scope !== 'all' && !pool.length && <p className="material-empty">{scope === 'favorites' ? '選取材料後按「加入常用」，下次就能從這裡快速找到。' : '加入清單的材料會保留在此裝置，最多顯示最近 8 種。'}</p>}
    {selected && <div className="material-selected"><div className="material-selected-heading"><div><p className="font-bold leading-6">{selected.displayName || selected.name}</p><dl className="material-facts"><div><dt>下訂單位</dt><dd>{selected.unit}</dd></div></dl></div><button type="button" className="favorite-button" aria-pressed={Boolean(favorite)} onClick={() => preferences.toggle(selected)}><svg width="19" height="19" viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9Z" /></svg>{favorite ? '移除常用' : '加入常用'}</button></div>{selected.orderHint && <p className="mt-3 text-sm leading-6">{selected.orderHint}</p>}{selected.name.includes('\n') && <details className="mt-3 text-sm leading-6"><summary>查看混合材料完整內容</summary><p className="whitespace-pre-line mt-2">{selected.name}</p></details>}</div>}
  </div>;
}
