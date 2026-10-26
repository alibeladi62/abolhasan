import type { Metadata } from 'next';
import Link from 'next/link';
import { Film } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fileUrl, listPublicVideos, OCCASION_LABELS } from '@/server/content';
import { formatJalaliFromIso, toPersianDigits } from '@/lib/jalali';

export const metadata: Metadata = {
  title: 'آرشیو ویدئو',
  description: 'ویدئوهای ضبط‌شده‌ی برنامه‌های هیئت ابولحسن با پخش داخلی.',
  openGraph: {
    title: 'آرشیو ویدئو هیئت ابولحسن',
    description: 'ویدئوهای برنامه‌های حیدریه، سخنرانی‌ها و مراسم.',
    type: 'website',
    url: '/video',
    locale: 'fa_IR',
  },
};

export const dynamic = 'force-dynamic';

export default async function VideoPage() {
  const rows = await listPublicVideos();

  return (
    <div className="space-y-4">
      <PageHeader
        title="آرشیو ویدئو"
        description="برنامه‌های ضبط‌شده؛ میزبانی فایل‌ها روی همین سرور است و پخش زنده در این سایت وجود ندارد."
        badge={{ label: `${toPersianDigits(rows.length)} ویدئو`, tone: 'secondary' }}
      />

      {rows.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((video) => (
            <li key={video.id}>
              <Card className="h-full overflow-hidden transition hover:shadow-md">
                <Link href={`/video/${video.id}`} className="block">
                  <span className="relative block aspect-video w-full bg-secondary">
                    {video.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fileUrl(video.cover) ?? ''}
                        alt={video.title}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center gap-1 text-muted-foreground">
                        <Film className="size-7" />
                        <span className="text-xs">بدون تصویر جلد</span>
                      </span>
                    )}
                    {!video.asset ? (
                      <span className="absolute inset-x-2 bottom-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                        فایل ویدئو هنوز آپلود نشده است
                      </span>
                    ) : null}
                  </span>
                  <CardContent className="space-y-1.5 py-3">
                    <p className="line-clamp-2 text-sm font-bold text-foreground">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="num-latin">{formatJalaliFromIso(video.programDateJalali) ?? 'بدون تاریخ'}</span>
                      {' · '}
                      {OCCASION_LABELS[video.occasion] ?? video.occasion}
                    </p>
                    <Badge variant="secondary">{video.asset ? 'قابل پخش' : 'در انتظار فایل'}</Badge>
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            هنوز ویدئویی منتشر نشده است.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
