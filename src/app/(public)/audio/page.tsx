import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { AudioList, FilterBar, type AudioCardData } from '@/components/audio-list';
import { jalaliLabelFromIso } from '@/lib/jalali';
import { OCCASION_LABELS, fileUrl, listAudioNarrators, listPublicAudios } from '@/server/content';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ occasion?: string }>;
}): Promise<Metadata> {
  const { occasion } = await searchParams;
  const label = occasion && OCCASION_LABELS[occasion] ? ` — ${OCCASION_LABELS[occasion]}` : '';
  return {
    title: `آرشیو صوت${label}`,
    description: 'مداحی‌ها، سخنرانی‌ها و ذکرهای هفتگی هیئت ابولحسن با فیلتر بر اساس روضه‌خوان و مناسبت.',
    openGraph: {
      title: `آرشیو صوت هیئت ابولحسن${label}`,
      description: 'مداحی‌ها و سخنرانی‌های هیئت حیدریه نجف‌اشرف ابولحسن.',
      type: 'website',
      url: '/audio',
      locale: 'fa_IR',
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function AudioPage({
  searchParams,
}: {
  searchParams: Promise<{ occasion?: string; narrator?: string; sort?: string }>;
}) {
  const raw = await searchParams;
  const current: Record<string, string> = {
    occasion: raw.occasion ?? 'all',
    narrator: raw.narrator ?? 'all',
    sort: raw.sort ?? 'new',
  };

  const [rows, narrators] = await Promise.all([
    listPublicAudios({
      occasion: current.occasion,
      narrator: current.narrator,
      sort: current.sort === 'old' ? 'old' : 'new',
    }),
    listAudioNarrators(),
  ]);

  const items: AudioCardData[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    narrator: row.narrator,
    performer: row.performer,
    occasionLabel: OCCASION_LABELS[row.occasion] ?? row.occasion,
    durationSec: row.asset?.durationSec ?? null,
    publishedLabel: jalaliLabelFromIso(row.publishedAt) ?? 'بدون تاریخ',
    url: fileUrl(row.asset),
    description: row.description,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="آرشیو صوت"
        description="مداحی‌ها، سخنرانی‌ها و ذکرهای هفتگی. برای پخش روی دکمه هر فایل بزنید؛ پخش با رفتن به صفحات دیگر ادامه می‌یابد."
        badge={{ label: `${items.length} فایل`, tone: 'secondary' }}
      />

      <FilterBar
        basePath="/audio"
        current={current}
        groups={[
          {
            label: 'مناسبت',
            param: 'occasion',
            options: [
              { value: 'all', label: 'همه' },
              ...Object.entries(OCCASION_LABELS).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            label: 'روضه‌خوان / سخنران',
            param: 'narrator',
            options: [{ value: 'all', label: 'همه' }, ...narrators.map((n) => ({ value: n, label: n }))],
          },
          {
            label: 'ترتیب',
            param: 'sort',
            options: [
              { value: 'new', label: 'جدیدترین' },
              { value: 'old', label: 'قدیمی‌ترین' },
            ],
          },
        ]}
      />

      <AudioList items={items} />
    </div>
  );
}
