import 'server-only';
import { handleOrdersGet } from '@/lib/single-sheet-queries.server';
export const GET = (request: Request) => handleOrdersGet(request, 'admin');
