import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin-placeholder';

export const metadata: Metadata = { title: 'پنل مدیریت — گزارش‌ها' };

export default function AdminReportsPage() {
  return (
    <AdminPlaceholder
      title="گزارش‌ها"
      stage="۵"
      note="گزارش‌های مدیریتی (اشغال، درآمد، میهمانان) در مرحله ۵."
      columns={['عنوان گزارش', 'دوره', 'خروجی']}
    />
  );
}
