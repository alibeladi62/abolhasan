import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { contentCounts } from '@/server/content';
import {
  ArticlesTab,
  AudioTab,
  CategoriesTab,
  GalleryTab,
  ProgramsTab,
  VideosTab,
} from '@/components/admin/content-sections';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'پنل مدیریت — محتوا' };

const TABS = [
  { key: 'articles', label: 'مقالات' },
  { key: 'audio', label: 'صوت' },
  { key: 'gallery', label: 'تصویر، آلبوم و اشخاص' },
  { key: 'video', label: 'ویدئو' },
  { key: 'programs', label: 'برنامه‌ها' },
  { key: 'categories', label: 'دسته‌ها' },
] as const;

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edit?: string; album?: string }>;
}) {
  const params = await searchParams;
  const tab = TABS.some((item) => item.key === params.tab) ? params.tab! : 'articles';
  const edit = params.edit ?? '';
  const album = params.album ?? '';
  const counts = await contentCounts();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-primary">مدیریت محتوا</h1>
        <Badge variant="secondary">
          مقاله {counts.articles} · صوت {counts.audios} · آلبوم {counts.albums} · عکس {counts.photos}
        </Badge>
        <Badge variant="outline">
          فایل‌های storage: {counts.assets}
        </Badge>
      </div>

      <nav className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-1.5">
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Link
              key={item.key}
              href={`/admin/content?tab=${item.key}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active ? 'bg-jade text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === 'articles' ? <ArticlesTab edit={edit} /> : null}
      {tab === 'audio' ? <AudioTab edit={edit} /> : null}
      {tab === 'gallery' ? <GalleryTab edit={edit} album={album} /> : null}
      {tab === 'video' ? <VideosTab edit={edit} /> : null}
      {tab === 'programs' ? <ProgramsTab edit={edit} /> : null}
      {tab === 'categories' ? <CategoriesTab edit={edit} /> : null}
    </div>
  );
}
