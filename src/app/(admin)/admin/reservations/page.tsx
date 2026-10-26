import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin-placeholder';

export const metadata: Metadata = { title: 'پنل مدیریت — رزروها' };

export default function AdminReservationsPage() {
  return (
    <AdminPlaceholder
      title="رزروها"
      stage="۳"
      note="موتور رزرو و چک‌این/چک‌اوت در مرحله ۳."
      columns={['شماره رزرو', 'واحد', 'میهمن', 'ورود/خروج', 'وضعیت']}
    />
  );
}
