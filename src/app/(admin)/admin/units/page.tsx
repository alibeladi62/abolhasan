import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin-placeholder';

export const metadata: Metadata = { title: 'پنل مدیریت — واحدها و تعرفه' };

export default function AdminUnitsPage() {
  return (
    <AdminPlaceholder
      title="واحدها و تعرفه"
      stage="۳"
      note="ویرایش تعرفه و وضعیت واحدها در مرحله ۳."
      columns={['کد واحد', 'طبقه', 'ظرفیت', 'تعرفه شبانه', 'وضعیت']}
    />
  );
}
