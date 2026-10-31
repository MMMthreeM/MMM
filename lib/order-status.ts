// Public labels are separate from persisted state values to preserve existing Sheets and API contracts.
export const FORMAL_STATUS_OPTIONS = [
  { value: '', label: '全部正式需求' },
  { value: '待審核', label: '待審核' },
  { value: '退回待修改', label: '退回待修改' },
  { value: '審核中', label: '審核中' },
  { value: '審核完畢', label: '審核完畢' },
  { value: '準備出貨', label: '準備出貨' },
  { value: '已送達', label: '已送達' },
  { value: '處理中', label: '全部待處理（含退回）' },
] as const;
export function orderStatusLabel(status: string, returned = false) {
  if (status === '處理中') return returned ? '退回待修改' : '待審核';
  return status === '編輯中' ? '草稿' : status;
}
