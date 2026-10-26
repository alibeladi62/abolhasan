import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { PhotoGrid, type LightboxImage } from '@/components/photo-grid';
import { fileUrl, getAlbumWithPhotos } from '@/server/content';
import { toPersianDigits } from '@/lib/jalali';

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId)) return { title: 'آلبوم' };
  const data = await getAlbumWithPhotos(albumId);
  if (!data) return { title: 'آلبوم پیدا نشد' };
  const cover = data.album.cover ? fileUrl(data.album.cover) : undefined;
  return {
    title: data.album.title,
    description: data.album.description ?? `آلبوم تصویری با ${data.photos.length} عکس`,
    openGraph: {
      title: data.album.title,
      description: data.album.description ?? 'آلبوم تصویری هیئت ابولحسن',
      images: cover ? [{ url: cover }] : undefined,
      type: 'website',
      url: `/gallery/${albumId}`,
      locale: 'fa_IR',
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function AlbumPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId) || albumId <= 0) notFound();

  const data = await getAlbumWithPhotos(albumId);
  if (!data) notFound();

  const images: LightboxImage[] = data.photos
    .filter((photo) => photo.asset)
    .map((photo) => ({ src: fileUrl(photo.asset)!, caption: photo.caption }));

  return (
    <div className="space-y-4">
      <Link href="/gallery" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronRight className="size-4" />
        بازگشت به آرشیو تصویر
      </Link>

      <PageHeader
        title={data.album.title}
        description={data.album.description}
        badge={{ label: `${toPersianDigits(images.length)} عکس`, tone: 'secondary' }}
      />

      <PhotoGrid images={images} />
    </div>
  );
}
