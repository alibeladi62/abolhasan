import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin-placeholder';

export const metadata: Metadata = { title: 'پنل مدیریت — پیشرفت ساخت' };

export default function AdminConstructionPage() {
  return (
    <AdminPlaceholder
      title="پیشرفت ساخت"
      stage="۵"
      note="تعریف فازها و درصد پیشرفت در مرحله ۵."
      columns={['فاز', 'درصد', 'تاریخ شروع', 'تاریخ پایان', 'گزارش تصویری']}
    />
  );
}
