import { mutationAudit } from '@/lib/mutation-security';

export async function logAudit(userEmail: string, action: string, orderId: string, details: string) {
  const context = mutationAudit.getStore();
  if (context) { context.details.push(JSON.stringify({ action, orderId, details }).slice(0, 8000)); return; }
  throw new Error('Audit logging must run inside a coordinated mutation');
}
