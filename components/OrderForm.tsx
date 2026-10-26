'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function OrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadOrderId = searchParams?.get('loadOrderId');
  const action = searchParams?.get('action'); 
  
  const processedOrderId = useRef<string | null>(null);
  
  const [materials, setMaterials] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/materials').then(res => res.json()).then(data => { if (data.data) setMaterials(data.data); });
  }, []);

  useEffect(() => {
    if (loadOrderId && processedOrderId.current !== loadOrderId) {
      processedOrderId.current = loadOrderId; 
      fetch('/api/orders').then(res => res.json()).then(data => {
        if (data.data) {
          const targetOrders = data.data.filter((o: any) => o.orderId === loadOrderId);
          if (targetOrders.length > 0) {
            setCart(targetOrders.map((o: any) => ({
              materialName: o.materialName, quantity: Number(o.quantity), 
              unit: o.unit, vendor: o.vendor, remarks: o.remarks, originalId: o.materialName 
            })));
            if (action === 'edit') {
              setEditingOrderId(loadOrderId); 
              alert('訂單已載入。目前為修改模式，送出將覆蓋原單。');
            } else {
              setEditingOrderId(null); 
              alert('歷史清單已帶入。目前為新單重訂模式，送出將產生全新單號。');
            }
            router.replace('/'); 
          }
        }
      });
    }
  }, [loadOrderId, action, router]);

  const filteredMaterials = materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())));
  const selectedMaterial = materials.find(m => m.id === selectedId);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value; setSelectedId(id);
    if (id === 'other') setQuantity(1); else { const mat = materials.find(m => m.id === id); if (mat) setQuantity(mat.minQty); }
  };

  const adjustQuantity = (amount: number) => {
    const step = selectedMaterial?.stepQty || 1;
    const min = selectedMaterial?.minQty || 1;
    setQuantity(prev => Math.max(min, prev + (amount * step)));
  };

  const handleAddToCart = () => {
    if (!selectedId) return alert("請先選擇材料");
    if (selectedId === 'other' && !customName.trim()) return alert("請填寫材料名稱");
    
    const numQty = Number(quantity);
    if (numQty <= 0 || !Number.isInteger(numQty)) return alert("數量必須是大於 0 的整數");
    
    if (selectedId !== 'other' && selectedMaterial) {
      const step = selectedMaterial.stepQty || 1, min = selectedMaterial.minQty || 1;
      if (numQty < min) return alert(`此材料的最低數量為 ${min}`);
      if (numQty % step !== 0) return alert(`數量必須是 ${step} 的倍數`);
    }
    const newItem = {
      materialName: selectedId === 'other' ? customName : selectedMaterial?.name,
      quantity: numQty, unit: selectedId === 'other' ? '式' : selectedMaterial?.unit, vendor: selectedId === 'other' ? '' : selectedMaterial?.vendor, remarks, originalId: selectedId
    };
    setCart([...cart, newItem]);
    setSelectedId(''); setCustomName(''); setQuantity(0); setRemarks(''); setSearch('');
  };

  const handleEditItem = (index: number) => {
    const item = cart[index];
    const matMatch = materials.find(m => m.name === item.materialName);
    setSelectedId(matMatch ? matMatch.id : 'other');
    if (!matMatch) setCustomName(item.materialName);
    setQuantity(Number(item.quantity)); 
    setRemarks(item.remarks || '');
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleSubmit = async (status: string) => {
    if (cart.length === 0) return alert('清單為空');
    if (isSubmitting) return; 
    let draftName = '';
    if (status === '編輯中') {
      const promptVal = prompt('請為草稿命名 (例如：高鐵A區水電預備)：');
      if (promptVal === null) return; 
      draftName = promptVal || '未命名草稿';
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, status, draftName, existingOrderId: editingOrderId }) 
      });
      const result = await response.json();
      if (response.ok) { 
        alert(`${result.message}\n單號: ${result.orderId}`); 
        setCart([]); setEditingOrderId(null);
      } else alert('發生錯誤: ' + result.error);
    } catch (error) { alert('網路連線錯誤'); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      
      {/* 左側：材料選取 */}
      <section className="surface p-5 sm:p-7">
        <div className="mb-6 border-b border-[var(--line)] pb-4"><h2 className="section-title">選擇材料</h2><p className="mt-1 text-sm text-[var(--muted)]">從材料庫搜尋，或新增臨時需求品項。</p></div>
        <div className="space-y-5">
          <div>
            <label className="form-label">搜尋材料</label>
            <input type="text" placeholder="材料名稱或標籤" className="form-control mb-2" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" value={selectedId} onChange={handleSelectChange}>
              <option value="" disabled>請選擇材料...</option>
              {filteredMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="other">其他 (自填)</option>
            </select>
          </div>
          
          {selectedId === 'other' && (
            <div><label className="form-label">自訂材料名稱</label><input type="text" className="form-control" value={customName} onChange={(e) => setCustomName(e.target.value)} /></div>
          )}
          
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="form-label mb-0">需求數量</label>
              {selectedMaterial && <span className="text-xs text-[var(--muted)]">最小 {selectedMaterial.minQty} · 級距 {selectedMaterial.stepQty}</span>}
            </div>
            <div className="flex h-11">
              <button type="button" onClick={() => adjustQuantity(-1)} className="w-12 rounded-l-lg border border-[#b9c9d4] bg-[#f4f8fa] text-xl font-bold text-[var(--ink)] hover:bg-[#eaf5fb]">−</button>
              <input type="number" className="form-control rounded-none border-x-0 text-center text-lg font-bold" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              <button type="button" onClick={() => adjustQuantity(1)} className="w-12 rounded-r-lg border border-[#b9c9d4] bg-[#f4f8fa] text-xl font-bold text-[var(--ink)] hover:bg-[#eaf5fb]">＋</button>
            </div>
          </div>

          <div><label className="form-label">附加備註</label><textarea className="form-control h-24 resize-none" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="規格、長度或特殊要求" /></div>
          
          <button onClick={handleAddToCart} type="button" className="btn btn-primary w-full">
            加入清單
          </button>
        </div>
      </section>

      {/* 右側：購物車區 */}
      <section className="surface flex min-h-[520px] flex-col p-5 sm:p-7">
        <div className="mb-6 flex items-end justify-between border-b border-[var(--line)] pb-4">
          <div><h2 className="section-title">待送出清單 <span className="text-[var(--delta-blue)]">({cart.length})</span></h2><p className="mt-1 text-sm text-[var(--muted)]">確認各項需求後再儲存或送出。</p></div>
          {editingOrderId && <span className="status status-processing">修改原單</span>}
        </div>
        
        <div className="flex-1 mb-8 max-h-[60vh] overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex h-full min-h-52 items-center justify-center rounded-xl border border-dashed border-[#cbd9e1] bg-[#f8fbfc] px-6 text-center text-sm leading-6 text-[var(--muted)]">
              尚未加入材料。從左側選擇材料並加入清單。
            </div>
          ) : (
            <ul className="space-y-4">
              {cart.map((item, idx) => (
                <li key={idx} className="relative rounded-xl border border-[var(--line)] bg-white p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="pr-16 font-bold text-[var(--ink)]">{item.materialName}</div>
                    <div className="flex gap-2 absolute top-4 right-4">
                      <button onClick={() => handleEditItem(idx)} className="text-sm font-bold text-[var(--delta-blue-strong)] hover:underline">編輯</button>
                      <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-sm font-bold text-[var(--danger)] hover:underline">移除</button>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[var(--ink)]">
                    {item.quantity} <span className="text-sm font-medium text-[var(--muted)]">{item.unit}</span>
                  </div>
                  {item.remarks && <div className="mt-3 border-t border-[#e5edf1] pt-3 text-sm text-[var(--muted)]">備註：{item.remarks}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-auto">
          <button onClick={() => handleSubmit('編輯中')} disabled={cart.length===0 || isSubmitting} className="btn btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50">
            存為草稿
          </button>
          <button onClick={() => handleSubmit('處理中')} disabled={cart.length===0 || isSubmitting} className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50">
            正式送出
          </button>
        </div>
      </section>
    </div>
  );
}
