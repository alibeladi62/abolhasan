import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownBody } from '@/components/markdown-body';
import { fileUrl, getArticleBySlug, tagList } from '@/server/content';
import { jalaliLabelFromIso } from '@/lib/jalali';

type Params = { slug: string };

async function load(slug: string) {
  return getArticleBySlug(decodeURIComponent(slug));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await load(slug);
  if (!article) return { title: 'مقاله پیدا نشد' };
  const cover = article.asset ? fileUrl(article.asset) : undefined;
  return {
    title: article.title,
    description: article.plainExcerpt,
    authors: article.author ? [{ name: article.author }] : undefined,
    openGraph: {
      title: article.title,
      description: article.plainExcerpt,
      images: cover ? [{ url: cover, alt: article.title }] : undefined,
      type: 'article',
      url: `/articles/${article.slug}`,
      locale: 'fa_IR',
      publishedTime: article.publishedAt ?? undefined,
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title: article.title,
      description: article.plainExcerpt,
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = await load(slug);
  if (!article) notFound();

  const tags = tagList(article.tags);

  return (
    <article className="space-y-4">
      <Link href="/articles" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronRight className="size-4" />
        بازگشت به مقالات
      </Link>

      <header className="space-y-2 border-b border-border pb-4">
        <h1 className="text-2xl font-bold leading-10 text-primary md:text-3xl md:leading-12">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {article.category ? (
            <Link href={`/articles?category=${article.category.slug}`}>
              <Badge variant="secondary">{article.category.name}</Badge>
            </Link>
          ) : null}
          {article.author ? <span>نویسنده: {article.author}</span> : null}
          <span>
            تاریخ انتشار: <span className="num-latin">{jalaliLabelFromIso(article.publishedAt) ?? '—'}</span>
          </span>
        </div>
      </header>

      {article.asset ? (
        <Card className="overflow-hidden">
          <span className="block aspect-[16/9] w-full bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl(article.asset) ?? ''}
              alt={article.title}
              className="size-full object-cover"
            />
          </span>
        </Card>
      ) : null}

      <Card>
        <CardContent className="py-5">
          <MarkdownBody source={article.bodyMarkdown} />
        </CardContent>
      </Card>

      {tags.length ? (
        <footer className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>برچسب‌ها:</span>
          {tags.map((tag) => (
            <Link key={tag} href={`/articles?tag=${encodeURIComponent(tag)}`}>
              <Badge variant="outline">#{tag}</Badge>
            </Link>
          ))}
        </footer>
      ) : null}
    </article>
  );
}
