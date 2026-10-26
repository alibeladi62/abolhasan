import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/audio-list';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fileUrl, listAllTags, listArticleCategories, listPublicArticles } from '@/server/content';
import { jalaliLabelFromIso, toPersianDigits } from '@/lib/jalali';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}): Promise<Metadata> {
  const { category, tag } = await searchParams;
  const parts = [category && category !== 'all' ? `دسته: ${category}` : '', tag && tag !== 'all' ? `برچسب: ${tag}` : '']
    .filter(Boolean)
    .join(' · ');
  const title = parts ? `مقالات — ${parts}` : 'مقالات مذهبی و قرآنی';
  return {
    title,
    description: 'مقالات مذهبی و قرآنی هیئت حیدریه نجف‌اشرف ابولحسن.',
    openGraph: {
      title,
      description: 'مجموعه مقالات و نوشته‌های هیئت.',
      type: 'website',
      url: '/articles',
      locale: 'fa_IR',
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  const raw = await searchParams;
  const current: Record<string, string> = { category: raw.category ?? 'all', tag: raw.tag ?? 'all' };

  const [items, categoriesList, tags] = await Promise.all([
    listPublicArticles({ categorySlug: current.category, tag: current.tag }),
    listArticleCategories(),
    listAllTags(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="مقالات"
        description="نوشته‌های مذهبی و قرآنی؛ برای فیلتر می‌توانید دسته یا برچسب را انتخاب کنید."
        badge={{ label: `${toPersianDigits(items.length)} مقاله`, tone: 'secondary' }}
      />

      <FilterBar
        basePath="/articles"
        current={current}
        groups={[
          {
            label: 'دسته',
            param: 'category',
            options: [
              { value: 'all', label: 'همه' },
              ...categoriesList.map((c) => ({ value: c.slug, label: c.name })),
            ],
          },
          {
            label: 'برچسب',
            param: 'tag',
            options: [{ value: 'all', label: 'همه' }, ...tags.map((t) => ({ value: t, label: t }))],
          },
        ]}
      />

      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((article) => (
            <li key={article.id}>
              <Card className="h-full overflow-hidden transition hover:shadow-md">
                <Link href={`/articles/${article.slug}`} className="block">
                  {article.asset ? (
                    <span className="block aspect-[16/9] w-full bg-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileUrl(article.asset) ?? ''}
                        alt={article.title}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </span>
                  ) : null}
                  <CardContent className="space-y-2 py-3">
                    <p className="text-sm font-bold leading-6 text-foreground">{article.title}</p>
                    <p className="line-clamp-3 text-xs text-muted-foreground">{article.plainExcerpt}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {article.category ? <Badge variant="secondary">{article.category.name}</Badge> : null}
                      <span>
                        {article.author ? `${article.author} · ` : ''}
                        <span className="num-latin">{jalaliLabelFromIso(article.publishedAt) ?? '—'}</span>
                      </span>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            مقاله‌ای با این فیلترها منتشر نشده است.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
