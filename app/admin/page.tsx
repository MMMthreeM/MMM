import AdminReviewWorkbench from '@/components/AdminReviewWorkbench';

// AppShell intentionally waits for the client session and admin role before
// mounting this workbench. It cannot promise an instant server-rendered UI.
export const instant = false;

export default function ReviewPage() {
  return <AdminReviewWorkbench />;
}
