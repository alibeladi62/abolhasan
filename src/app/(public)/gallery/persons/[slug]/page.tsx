import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownBody } from '@/components/markdown-body';
import { PageHeader } from '@/components/page-header';
import { PhotoGrid, type LightboxImage } from '@/components/photo-grid';
import { fileUrl, getPersonBySlug } from '@/server/content';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPersonBySlug(slug);
  if (!data) return { title: 'شخص پیدا نشد' };
  const cover = data.mainPhoto?.asset ? fileUrl(data.mainPhoto.asset) : undefined;
  return {
    title: data.person.name,
    description: `معرفی‌نامه‌ی ${data.person.name} از اشخاص هیئت ابولحسن`,
    openGraph: {
      title: `${data.person.name} — هیئت ابولحسن`,
      description: `معرفی‌نامه و تصاویر ${data.person.name}`,
      images: cover ? [{ url: cover }] : undefined,
      type: 'profile',
      url: `/gallery/persons/${slug}`,
      locale: 'fa_IR',
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function PersonPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = await getPersonBySlug(decodeURIComponent(slug));
  if (!data) notFound();

  const images: LightboxImage[] = data.photoList
    .filter((photo) => photo.asset)
    .map((photo) => ({ src: fileUrl(photo.asset)!, caption: photo.caption }));

  return (
    <div className="space-y-4">
      <Link href="/gallery/persons" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronRight className="size-4" />
        بازگشت به آلبوم اشخاص
      </Link>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <PageHeader
            title={data.person.name}
            badge={
              data.person.isDeceased
                ? { label: 'متوفی — روحش شاد', tone: 'default' }
                : { label: 'از اشخاص هیئت', tone: 'secondary' }
            }
          />

          {data.person.bio ? (
            <Card>
              <CardContent className="py-4">
                <MarkdownBody source={data.person.bio} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                معرفی‌نامه این شخص هنوز نوشته نشده است.
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit overflow-hidden">
          <span className="block aspect-[4/3] w-full bg-secondary">
            {data.mainPhoto?.asset ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUrl(data.mainPhoto.asset) ?? ''}
                alt={data.person.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="grid size-full place-items-center text-sm text-muted-foreground">بدون عکس</span>
            )}
          </span>
          {data.album ? (
            <CardContent className="py-3 text-sm">
              <p className="text-muted-foreground">آلبوم تصاویر</p>
              <Link href={`/gallery/${data.album.id}`} className="font-bold text-primary hover:underline">
                {data.album.title}
              </Link>
            </CardContent>
          ) : (
            <CardContent className="py-3 text-sm text-muted-foreground">
              <Badge variant="secondary">بدون آلبوم</Badge>
            </CardContent>
          )}
        </Card>
      </div>

      {images.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">تصاویر</h2>
          <PhotoGrid images={images} />
        </section>
      ) : null}
    </div>
  );
}
