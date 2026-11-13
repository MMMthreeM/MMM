import { Suspense } from 'react';
import OrderForm, {RequestHeading} from '@/components/OrderForm';

export default function RequestPage() {
  return <main className="page-frame request-frame"><Suspense fallback={<p role="status">正在載入申請表…</p>}><RequestHeading/><OrderForm /></Suspense></main>;
}
