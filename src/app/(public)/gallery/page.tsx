import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fileUrl, listAlbums } from '@/server/content';
import { toPersianDigits } from '@/lib/jalali';

export const metadata: Metadata = {
  title: 'آرشیو تصویر',
  description: 'آلبوم‌های تصویری برنامه‌های هیئت و آلبوم افراد قدیمی و مرحوم هیئت ابولحسن.',
  openGraph: {
    title: 'آرشیو تصویر هیئت ابولحسن',
    description: 'آلبوم‌های تصویری برنامه‌ها و آلبوم اشخاص هیئت.',
    type: 'website',
    url: '/gallery',
    locale: 'fa_IR',
  },
};

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const albumsList = await listAlbums();

  return (
    <div className="space-y-4">
      <PageHeader
        title="آرشیو تصویر"
        description="دو زیربخش: آلبوم برنامه‌های هیئت و آلبوم افراد قدیمی و مرحوم هیئت (با معرفی‌نامه)."
        badge={{ label: `${toPersianDigits(albumsList.length)} آلبوم`, tone: 'secondary' }}
      />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Users className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">آلبوم افراد قدیمی و مرحوم هیئت</p>
              <p className="text-xs text-muted-foreground">معرفی‌نامه و تصاویر هر شخص</p>
            </div>
          </div>
          <Link
            href="/gallery/persons"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition hover:bg-primary/90"
          >
            مشاهده اشخاص
          </Link>
        </CardContent>
      </Card>

      {albumsList.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albumsList.map((album) => (
            <li key={album.id}>
              <Card className="h-full overflow-hidden transition hover:shadow-md">
                <Link href={`/gallery/${album.id}`} className="block">
                  <span className="block aspect-[16/10] w-full bg-secondary">
                    {album.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fileUrl(album.cover) ?? ''}
                        alt={album.title}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-sm text-muted-foreground">
                        بدون جلد
                      </span>
                    )}
                  </span>
                  <CardContent className="space-y-1 py-3">
                    <p className="text-sm font-bold text-foreground">{album.title}</p>
                    {album.description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{album.description}</p>
                    ) : null}
                    <Badge variant="secondary">{toPersianDigits(album.photoCount)} عکس</Badge>
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            هنوز آلبومی ساخته نشده است. از پنل مدیریت می‌توانید آلبوم و عکس اضافه کنید.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
