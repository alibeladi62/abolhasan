import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin-placeholder';

export const metadata: Metadata = { title: 'پنل مدیریت — نقشه' };

export default function AdminMapPage() {
  return (
    <AdminPlaceholder
      title="نقشه"
      stage="۴"
      note="آپلود خروجی اتوکد و رنگ‌آمیزی وضعیت واحدها در مرحله ۴."
      columns={['فایل SVG', 'طبقه', 'واحدهای نشان‌دار']}
    />
  );
}
