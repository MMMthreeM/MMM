export type OrderRole = 'USER' | 'ADMIN';

export const ORDER_STATES = {
  DRAFT: 'DRAFT',                 // 編輯中 (草稿)
  PENDING: 'PENDING',             // 處理中 (待審核)
  REVIEWING: 'REVIEWING',         // 審核中
  READY: 'READY',                 // 準備出貨
  COMPLETED: 'COMPLETED',         // 已送達 (完成)
  REJECTED: 'REJECTED',           // 退回 (需補件)
} as const;

export type OrderState = keyof typeof ORDER_STATES;

// 狀態機轉換規則矩陣：定義 [角色] 在 [當前狀態] 可以轉換到哪些 [目標狀態]
const TRANSITIONS: Record<OrderRole, Record<OrderState, OrderState[]>> = {
  USER: {
    DRAFT: ['PENDING'],
    PENDING: ['DRAFT'], // 送出後但在管理員處理前，允許自行收回修改
    REVIEWING: [],
    READY: [],
    COMPLETED: [],
    REJECTED: ['PENDING', 'DRAFT'], // 被退回後可重新送出，或先轉回草稿
  },
  ADMIN: {
    DRAFT: [], // 管理員不應主動操作使用者的草稿
    PENDING: ['REVIEWING', 'REJECTED'],
    REVIEWING: ['READY', 'REJECTED', 'PENDING'],
    READY: ['COMPLETED', 'REVIEWING'],
    COMPLETED: ['READY'], // 容錯：標示完成後若發現問題可退回準備出貨
    REJECTED: ['PENDING'], // 容錯：誤退回時可手動拉回待審核
  }
};

/**
 * 驗證訂單狀態轉換是否合法
 * @param currentState 目前訂單狀態
 * @param nextState 預期轉換的新狀態
 * @param role 操作者角色
 * @returns boolean
 */
export function canTransition(currentState: OrderState, nextState: OrderState, role: OrderRole): boolean {
  if (currentState === nextState) return true; // 狀態未改變視為合法
  const allowedNextStates = TRANSITIONS[role][currentState];
  return allowedNextStates.includes(nextState);
}

/**
 * 獲取狀態的語意化標籤與設計色彩 (符合 UI/UX Design Tokens 規範)
 * 供前端元件統一呼叫，確保全站視覺一致
 */
export function getStateTokens(state: OrderState) {
  switch (state) {
    case 'DRAFT':
      return { label: '編輯中', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'PENDING':
      return { label: '待審核', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'REVIEWING':
      return { label: '審核中', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'READY':
      return { label: '準備出貨', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'COMPLETED':
      return { label: '已送達', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'REJECTED':
      return { label: '已退回', className: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold' };
    default:
      return { label: '未知狀態', className: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
}