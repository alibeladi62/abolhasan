import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Film } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { fileUrl, getVideoById, OCCASION_LABELS } from '@/server/content';
import { fileExists } from '@/server/storage';
import { formatJalaliFromIso } from '@/lib/jalali';

type Params = { id: string };

async function load(id: string) {
  const videoId = Number(id);
  if (!Number.isInteger(videoId) || videoId <= 0) return null;
  return getVideoById(videoId);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const video = await load(id);
  if (!video) return { title: 'ویدئو پیدا نشد' };
  const cover = video.cover ? fileUrl(video.cover) : undefined;
  return {
    title: video.title,
    description: video.description ?? `ویدئوی برنامه‌ی هیئت ابولحسن — ${OCCASION_LABELS[video.occasion]}`,
    openGraph: {
      title: video.title,
      description: video.description ?? 'ویدئوی برنامه‌ی هیئت ابولحسن',
      images: cover ? [{ url: cover }] : undefined,
      type: 'video.other',
      url: `/video/${video.id}`,
      locale: 'fa_IR',
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function VideoPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const video = await load(id);
  if (!video) notFound();

  // رکورد می‌تواند فایلِ نرسیده داشته باشد؛ آن‌وقت به‌جای منبع شکسته پیام فارسی نشان داده می‌شود
  const hasFile = video.asset ? await fileExists(video.asset) : false;
  const url = hasFile ? fileUrl(video.asset) : null;

  return (
    <div className="space-y-4">
      <Link href="/video" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronRight className="size-4" />
        بازگشت به آرشیو ویدئو
      </Link>

      <PageHeader
        title={video.title}
        description={video.description}
        badge={{ label: OCCASION_LABELS[video.occasion] ?? video.occasion, tone: 'secondary' }}
      />

      <Card className="overflow-hidden">
        {url ? (
          <video
            src={url}
            controls
            preload="metadata"
            poster={video.cover ? (fileUrl(video.cover) ?? undefined) : undefined}
            className="aspect-video w-full bg-black"
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-secondary text-muted-foreground">
            <Film className="size-8" />
            <p className="text-sm font-bold">فایل این ویدئو هنوز روی میزبان نیست</p>
            <p className="max-w-md px-4 text-center text-xs">
              رکورد این ویدئو در دیتابیس ثبت شده تا محل آن مشخص باشد. پس از آپلود فایل از پنل مدیریت
              (بخش ویدئوها) همین کارت قابل پخش می‌شود.
            </p>
          </div>
        )}
        <CardContent className="space-y-2 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <Badge variant="outline">
              تاریخ برنامه: <span className="num-latin ms-1">{formatJalaliFromIso(video.programDateJalali) ?? '—'}</span>
            </Badge>
            <Badge variant="outline">
              {video.asset ? (hasFile ? 'فایل ثبت‌شده و موجود' : 'فایل هنوز به میزبان نرسیده') : 'بدون فایل'}
            </Badge>
            {hasFile ? (
              <Badge variant="outline">
                حجم: <span className="num-latin ms-1">{(video.asset!.sizeBytes / (1024 * 1024)).toFixed(1)}MB</span>
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
