import { secureMutation } from '@/lib/mutation-security';
import { ordersExecutor } from '@/lib/order-actions';
export const PATCH = secureMutation(async () => { throw new Error('Order executor is required'); }, { admin: false, action: 'draft-submit', limit: 10, executor: ordersExecutor('draft-submit') });
