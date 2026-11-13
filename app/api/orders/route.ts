import 'server-only';
import { secureMutation } from '@/lib/mutation-security';
import { ordersExecutor } from '@/lib/order-actions';
import { handleOrdersGet } from '@/lib/single-sheet-queries.server';
export const GET = (request: Request) => handleOrdersGet(request, 'company');
export const POST = secureMutation(async () => { throw new Error('Order executor is required'); }, { admin: false, action: 'order-save', limit: 20, executor: ordersExecutor('orders-post') });
