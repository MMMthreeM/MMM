import { secureMutation } from '@/lib/mutation-security';
import { ordersExecutor } from '@/lib/order-actions';
export const PATCH = secureMutation(async () => { throw new Error('Order executor is required'); }, { admin: true, action: 'admin-edit', limit: 20, executor: ordersExecutor('admin-edit') });
