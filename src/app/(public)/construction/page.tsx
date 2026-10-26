import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'پیشرفت پروژه ساخت' };

export default function ConstructionPage() {
  return (
    <ComingSoon
      title="پیشرفت پروژه ساخت"
      stage="۵"
      description="فازهای ساخت، درصد پیشرفت و گزارش تصویری قبل/بعد."
    />
  );
}
