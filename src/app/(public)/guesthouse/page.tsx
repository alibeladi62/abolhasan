import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'مهمانسرای امام علی(ع)' };

export default function GuesthousePage() {
  return (
    <ComingSoon
      title="مهمانسرای امام علی(ع)"
      stage="۳"
      description="معرفی واحدها، تعرفه‌ها، نقشه و رزرو — در مرحله ۳ و ۴."
    />
  );
}
