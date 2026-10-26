import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin-placeholder';

export const metadata: Metadata = { title: 'پنل مدیریت — نذورات' };

export default function AdminDonationsPage() {
  return (
    <AdminPlaceholder
      title="نذورات"
      stage="۳"
      note="درگاه نذورات و تفکیک صندوق‌ها در مرحله ۳."
      columns={['تاریخ', 'مقصد صندوق', 'هدیه‌دهنده', 'مبلغ', 'رسید']}
    />
  );
}
