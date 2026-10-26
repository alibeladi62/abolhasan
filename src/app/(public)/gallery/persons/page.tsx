import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fileUrl, listPersons } from '@/server/content';
import { toPersianDigits } from '@/lib/jalali';

export const metadata: Metadata = {
  title: 'افراد قدیمی و مرحوم هیئت',
  description: 'آلبوم اشخاص هیئت حیدریه نجف‌اشرف ابولحسن با معرفی‌نامه و تصاویر.',
  openGraph: {
    title: 'افراد قدیمی و مرحوم هیئت ابولحسن',
    description: 'معرفی‌نامه و تصاویر اشخاصی که در تاریخ این هیئت نقش داشتند.',
    type: 'website',
    url: '/gallery/persons',
    locale: 'fa_IR',
  },
};

export const dynamic = 'force-dynamic';

export default async function PersonsPage() {
  const people = await listPersons();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader
          title="افراد قدیمی و مرحوم هیئت"
          description="یاد کسانی که این هیئت را نگهداشتند؛ برای هر شخص معرفی‌نامه و گالری عکس دارد."
          badge={{ label: `${toPersianDigits(people.length)} شخص`, tone: 'secondary' }}
        />
        <Link href="/gallery" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ChevronLeft className="size-4" />
          آرشیو تصویر
        </Link>
      </div>

      {people.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => (
            <li key={person.id}>
              <Card className="h-full overflow-hidden transition hover:shadow-md">
                <Link href={`/gallery/persons/${person.slug}`} className="block">
                  <span className="block aspect-[4/3] w-full bg-secondary">
                    {person.mainPhoto?.asset ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fileUrl(person.mainPhoto.asset) ?? ''}
                        alt={person.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-3xl font-bold text-muted-foreground">
                        {person.name.slice(0, 1)}
                      </span>
                    )}
                  </span>
                  <CardContent className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{person.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {toPersianDigits(person.photoCount)} عکس ثبت‌شده
                      </p>
                    </div>
                    {person.isDeceased ? <Badge variant="destructive">متوفی</Badge> : null}
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            هنوز شخصی در این آلبوم ثبت نشده است.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
