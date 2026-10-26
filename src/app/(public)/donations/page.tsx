import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'نذورات' };

export default function DonationsPage() {
  return (
    <ComingSoon
      title="نذورات"
      stage="۳"
      description="واریز به صندوق‌های مشخص، بدون نیاز به ورود کاربر."
    />
  );
}
