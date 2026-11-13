import { secureMutation } from '@/lib/mutation-security';
import { ordersExecutor } from '@/lib/order-actions';
export const DELETE = secureMutation(async () => { throw new Error('Order executor is required'); }, { admin: false, action: 'order-delete', limit: 10, executor: ordersExecutor('delete-item') });
