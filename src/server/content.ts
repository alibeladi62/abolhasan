/** پرس‌وجوهای محتوای عمومی — همه سمت سرور، همه فقط ردیف‌های منتشرشده */
import { and, asc, count, desc, eq, gte, inArray, like, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { excerptFromMarkdown } from '@/lib/markdown';
import { formatJalaliISO, todayJalali } from '@/lib/jalali';
import { db } from './db';
import {
  albums,
  articles,
  audios,
  categories,
  mediaAssets,
  persons,
  photos,
  programs,
  videos,
  type Album,
  type Article,
  type Audio,
  type Category,
  type Person,
  type Photo,
  type Program,
  type Video,
} from './db/schema';

const coverAssets = alias(mediaAssets, 'cover_assets');

export const OCCASION_LABELS: Record<string, string> = {
  moharram: 'محرم',
  ramadan: 'ماه رمضان',
  fatimiye: 'ایام فاطمیه',
  other: 'سایر مناسبت‌ها',
};

export const PROGRAM_KIND_LABELS: Record<string, string> = {
  ceremony: 'مراسم',
  lecture: 'سخنرانی',
  class: 'کلاس/جلسه',
  other: 'سایر',
};

export type AssetRef = { id: number; storedPath: string; mime: string; sizeBytes: number; durationSec: number | null };
export const fileUrl = (asset: AssetRef | null | undefined) => (asset ? `/api/files/${asset.storedPath}` : null);

/* ─────────────── صوت ─────────────── */

export type AudioRow = Audio & { asset: AssetRef | null };

export async function listPublicAudios(filters: { occasion?: string; narrator?: string; sort?: 'new' | 'old' } = {}) {
  const conditions = [eq(audios.isPublished, 1)];
  if (filters.occasion && filters.occasion !== 'all') {
    conditions.push(eq(audios.occasion, filters.occasion as 'moharram'));
  }
  if (filters.narrator && filters.narrator !== 'all') {
    conditions.push(eq(audios.narrator, filters.narrator));
  }

  const rows = await db
    .select({
      audio: audios,
      asset: mediaAssets,
    })
    .from(audios)
    .leftJoin(mediaAssets, eq(audios.assetId, mediaAssets.id))
    .where(and(...conditions))
    .orderBy(
      filters.sort === 'old' ? asc(audios.publishedAt) : desc(audios.publishedAt),
      desc(audios.id),
    );

  return rows.map((row) => ({ ...row.audio, asset: row.asset ? pickAsset(row.asset) : null }));
}

export async function listAudioNarrators() {
  const rows = await db
    .selectDistinct({ narrator: audios.narrator })
    .from(audios)
    .where(and(eq(audios.isPublished, 1), sql`${audios.narrator} is not null`));
  return rows.map((r) => r.narrator).filter((n): n is string => Boolean(n));
}

/* ─────────────── تصویر و آلبوم ─────────────── */

export type AlbumRow = Album & { cover: AssetRef | null; photoCount: number };
export type PhotoRow = Photo & { asset: AssetRef | null };

export async function listAlbums() {
  const rows = await db
    .select({ album: albums, cover: coverAssets })
    .from(albums)
    .leftJoin(coverAssets, eq(albums.coverAssetId, coverAssets.id))
    .orderBy(desc(albums.id));

  const counts = await db
    .select({ albumId: photos.albumId, value: count() })
    .from(photos)
    .groupBy(photos.albumId);
  const countOf = new Map(counts.map((row) => [row.albumId, Number(row.value)]));

  return rows.map((row) => ({
    ...row.album,
    cover: row.cover ? pickAsset(row.cover) : null,
    photoCount: countOf.get(row.album.id) ?? 0,
  }));
}

export async function getAlbumWithPhotos(id: number): Promise<{ album: AlbumRow; photos: PhotoRow[] } | null> {
  const [album] = await db
    .select({ album: albums, cover: coverAssets })
    .from(albums)
    .leftJoin(coverAssets, eq(albums.coverAssetId, coverAssets.id))
    .where(eq(albums.id, id))
    .limit(1);
  if (!album) return null;

  const photoRows = await db
    .select({ photo: photos, asset: mediaAssets })
    .from(photos)
    .leftJoin(mediaAssets, eq(photos.assetId, mediaAssets.id))
    .where(eq(photos.albumId, id))
    .orderBy(asc(photos.sort), asc(photos.id));

  return {
    album: {
      ...album.album,
      cover: album.cover ? pickAsset(album.cover) : null,
      photoCount: photoRows.length,
    },
    photos: photoRows.map((row) => ({ ...row.photo, asset: row.asset ? pickAsset(row.asset) : null })),
  };
}

export type PersonRow = Person & { mainPhoto: PhotoRow | null; photoCount: number; albumTitle: string | null };

export async function listPersons() {
  const rows = await db
    .select({ person: persons, albumTitle: albums.title, photo: photos, asset: mediaAssets })
    .from(persons)
    .leftJoin(albums, eq(persons.albumId, albums.id))
    .leftJoin(photos, eq(persons.mainPhotoId, photos.id))
    .leftJoin(mediaAssets, eq(photos.assetId, mediaAssets.id))
    .orderBy(desc(persons.isDeceased), asc(persons.id));

  const albumIds = rows.map((row) => row.person.albumId).filter((id): id is number => Boolean(id));
  const photoCounts = albumIds.length
    ? await db
        .select({ albumId: photos.albumId, value: count() })
        .from(photos)
        .where(inArray(photos.albumId, albumIds))
        .groupBy(photos.albumId)
    : [];
  const countOf = new Map(photoCounts.map((row) => [row.albumId, Number(row.value)]));

  return rows.map((row) => ({
    ...row.person,
    albumTitle: row.albumTitle,
    mainPhoto: row.photo
      ? { ...row.photo, asset: row.asset ? pickAsset(row.asset) : null }
      : null,
    photoCount: row.person.albumId ? countOf.get(row.person.albumId) ?? 0 : 0,
  }));
}

export async function getPersonBySlug(slug: string) {
  const [person] = await db
    .select({ person: persons, album: albums })
    .from(persons)
    .leftJoin(albums, eq(persons.albumId, albums.id))
    .where(eq(persons.slug, slug))
    .limit(1);
  if (!person) return null;

  const photoRows = person.album
    ? await db
        .select({ photo: photos, asset: mediaAssets })
        .from(photos)
        .leftJoin(mediaAssets, eq(photos.assetId, mediaAssets.id))
        .where(eq(photos.albumId, person.album.id))
        .orderBy(asc(photos.sort), asc(photos.id))
    : [];

  const inAlbum = photoRows.find((row) => row.photo.id === person.person.mainPhotoId) ?? null;
  let main = inAlbum ?? photoRows[0] ?? null;
  if (!inAlbum && person.person.mainPhotoId) {
    // عکس اصلی می‌تواند بیرون از آلبوم شخص انتخاب شده باشد
    const [outside] = await db
      .select({ photo: photos, asset: mediaAssets })
      .from(photos)
      .leftJoin(mediaAssets, eq(photos.assetId, mediaAssets.id))
      .where(eq(photos.id, person.person.mainPhotoId))
      .limit(1);
    if (outside) main = outside;
  }

  return {
    person: person.person,
    album: person.album,
    mainPhoto: main ? { ...main.photo, asset: main.asset ? pickAsset(main.asset) : null } : null,
    photoList: photoRows.map((row) => ({ ...row.photo, asset: row.asset ? pickAsset(row.asset) : null })),
  };
}

/* ─────────────── ویدئو ─────────────── */

export type VideoRow = Video & { asset: AssetRef | null; cover: AssetRef | null };

async function videoRows(
  rows: { video: Video; asset: typeof mediaAssets.$inferSelect | null; cover: typeof coverAssets.$inferSelect | null }[],
) {
  return rows.map((row) => ({
    ...row.video,
    asset: row.asset ? pickAsset(row.asset) : null,
    cover: row.cover ? pickAsset(row.cover) : null,
  }));
}

export async function listPublicVideos() {
  const rows = await db
    .select({ video: videos, asset: mediaAssets, cover: coverAssets })
    .from(videos)
    .leftJoin(mediaAssets, eq(videos.assetId, mediaAssets.id))
    .leftJoin(coverAssets, eq(videos.coverAssetId, coverAssets.id))
    .where(eq(videos.isPublished, 1))
    .orderBy(desc(videos.programDateJalali), desc(videos.id));

  return videoRows(rows);
}

export async function getVideoById(id: number): Promise<VideoRow | null> {
  const [row] = await db
    .select({ video: videos, asset: mediaAssets, cover: coverAssets })
    .from(videos)
    .leftJoin(mediaAssets, eq(videos.assetId, mediaAssets.id))
    .leftJoin(coverAssets, eq(videos.coverAssetId, coverAssets.id))
    .where(and(eq(videos.id, id), eq(videos.isPublished, 1)))
    .limit(1);
  if (!row) return null;
  const [result] = await videoRows([row]);
  return result;
}

/* ─────────────── برنامه‌ها ─────────────── */

export type ProgramRow = Program;

export async function listProgramsGrouped(): Promise<{ upcoming: ProgramRow[]; past: ProgramRow[] }> {
  const today = todayIso();
  const rows = await db.select().from(programs).orderBy(asc(programs.dateJalali), asc(programs.startTime));
  const upcoming = rows.filter((row) => row.dateJalali >= today);
  const past = rows.filter((row) => row.dateJalali < today).reverse();
  return { upcoming, past };
}

/* ─────────────── مقالات ─────────────── */

export type ArticleRow = Article & { category: Category | null; asset: AssetRef | null };
export type ArticleCard = ArticleRow & { plainExcerpt: string };

export async function listPublicArticles(filters: { categorySlug?: string; tag?: string } = {}) {
  const conditions = [eq(articles.isPublished, 1)];
  if (filters.categorySlug && filters.categorySlug !== 'all') {
    conditions.push(eq(categories.slug, filters.categorySlug));
  }
  if (filters.tag && filters.tag !== 'all') {
    conditions.push(like(articles.tags, `%${filters.tag}%`));
  }

  const rows = await db
    .select({ article: articles, category: categories, asset: mediaAssets })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(mediaAssets, eq(articles.coverAssetId, mediaAssets.id))
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt), desc(articles.id));

  return rows.map((row) => toArticleCard(row));
}

export async function getArticleBySlug(slug: string, { includeDraft = false } = {}): Promise<ArticleCard | null> {
  const [row] = await db
    .select({ article: articles, category: categories, asset: mediaAssets })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(mediaAssets, eq(articles.coverAssetId, mediaAssets.id))
    .where(includeDraft ? eq(articles.slug, slug) : and(eq(articles.slug, slug), eq(articles.isPublished, 1)))
    .limit(1);
  if (!row) return null;
  return toArticleCard(row);
}

export async function listArticleCategories() {
  return db.select().from(categories).where(eq(categories.kind, 'article')).orderBy(asc(categories.name));
}

export async function listAllTags() {
  const rows = await db
    .select({ tags: articles.tags })
    .from(articles)
    .where(and(eq(articles.isPublished, 1), sql`${articles.tags} is not null`));
  const set = new Set<string>();
  for (const row of rows) {
    for (const tag of (row.tags ?? '').split(',')) {
      const value = tag.trim();
      if (value) set.add(value);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fa'));
}

/* ─────────────── خانه ─────────────── */

export async function getHomeContent() {
  const [latestArticles, latestAudios, upcoming] = await Promise.all([
    db
      .select({ article: articles, category: categories, asset: mediaAssets })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(mediaAssets, eq(articles.coverAssetId, mediaAssets.id))
      .where(eq(articles.isPublished, 1))
      .orderBy(desc(articles.publishedAt), desc(articles.id))
      .limit(3)
      .then((rows) => rows.map(toArticleCard)),
    db
      .select({ audio: audios, asset: mediaAssets })
      .from(audios)
      .leftJoin(mediaAssets, eq(audios.assetId, mediaAssets.id))
      .where(eq(audios.isPublished, 1))
      .orderBy(desc(audios.publishedAt), desc(audios.id))
      .limit(3),
    db
      .select()
      .from(programs)
      .where(gte(programs.dateJalali, todayIso()))
      .orderBy(asc(programs.dateJalali), asc(programs.startTime))
      .limit(3),
  ]);

  const albumsList = await listAlbums();
  const deceased = await db.select({ id: persons.id }).from(persons).where(eq(persons.isDeceased, 1));
  const audioRows = latestAudios.map((row) => ({
    ...row.audio,
    asset: row.asset ? pickAsset(row.asset) : null,
  }));

  return {
    latestArticles,
    latestAudios: audioRows,
    upcomingPrograms: upcoming,
    albumCount: albumsList.length,
    deceasedCount: deceased.length,
  };
}

/* ─────────────── کمک‌ها ─────────────── */

function pickAsset(row: typeof mediaAssets.$inferSelect): AssetRef {
  return {
    id: row.id,
    storedPath: row.storedPath,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    durationSec: row.durationSec,
  };
}

function toArticleCard(row: {
  article: Article;
  category: Category | null;
  asset: typeof mediaAssets.$inferSelect | null;
}): ArticleCard {
  return {
    ...row.article,
    category: row.category,
    asset: row.asset ? pickAsset(row.asset) : null,
    plainExcerpt: row.article.excerpt?.trim() ? row.article.excerpt : excerptFromMarkdown(row.article.bodyMarkdown),
  };
}

export const tagList = (tags: string | null) =>
  (tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/** امروز شمسی به قالب ISO — برای تفکیک برنامه‌های پیش‌رو از برگزارشده */
export const todayIso = () => {
  const t = todayJalali();
  return formatJalaliISO(t.jy, t.jm, t.jd);
};

/* ─────────────── پنل مدیریت (بدون فیلتر انتشار) ─────────────── */

export async function adminArticles() {
  const rows = await db
    .select({ article: articles, category: categories, asset: mediaAssets })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(mediaAssets, eq(articles.coverAssetId, mediaAssets.id))
    .orderBy(desc(articles.id));
  return rows.map(toArticleCard);
}

export async function adminAudios() {
  const rows = await db
    .select({ audio: audios, asset: mediaAssets })
    .from(audios)
    .leftJoin(mediaAssets, eq(audios.assetId, mediaAssets.id))
    .orderBy(desc(audios.id));
  return rows.map((row) => ({ ...row.audio, asset: row.asset ? pickAsset(row.asset) : null }));
}

export async function adminVideos() {
  const rows = await db
    .select({ video: videos, asset: mediaAssets, cover: coverAssets })
    .from(videos)
    .leftJoin(mediaAssets, eq(videos.assetId, mediaAssets.id))
    .leftJoin(coverAssets, eq(videos.coverAssetId, coverAssets.id))
    .orderBy(desc(videos.id));
  return videoRows(rows);
}

export async function adminPrograms() {
  const rows = await db.select().from(programs).orderBy(desc(programs.dateJalali), desc(programs.id));
  return rows;
}

/** گزینه‌های دسته برای منوی کشویی؛ kind خالی = همه دسته‌ها */
export async function adminCategoryOptions(kind?: Category['kind']) {
  const rows = await db
    .select()
    .from(categories)
    .where(kind ? eq(categories.kind, kind) : undefined)
    .orderBy(asc(categories.name));
  return rows;
}

export async function adminAlbumOptions() {
  const rows = await db
    .select({ id: albums.id, title: albums.title, photoCount: count() })
    .from(albums)
    .leftJoin(photos, eq(photos.albumId, albums.id))
    .groupBy(albums.id)
    .orderBy(desc(albums.id));
  return rows;
}

/** همه عکس‌ها با عنوان آلبوم — برای انتخاب «عکس اصلی» شخص */
export async function adminPhotoOptions() {
  const rows = await db
    .select({ photo: photos, albumTitle: albums.title, asset: mediaAssets })
    .from(photos)
    .leftJoin(albums, eq(photos.albumId, albums.id))
    .leftJoin(mediaAssets, eq(photos.assetId, mediaAssets.id))
    .orderBy(desc(photos.id));
  return rows.map((row) => ({
    ...row.photo,
    albumTitle: row.albumTitle,
    asset: row.asset ? pickAsset(row.asset) : null,
  }));
}

export async function adminPersons() {
  return listPersons();
}

export async function adminAlbums() {
  return listAlbums();
}

/** شمارش‌های سربرگ «محتوا» */
export async function contentCounts() {
  const rows = await Promise.all([
    db.select({ value: count() }).from(articles),
    db.select({ value: count() }).from(audios),
    db.select({ value: count() }).from(albums),
    db.select({ value: count() }).from(photos),
    db.select({ value: count() }).from(persons),
    db.select({ value: count() }).from(videos),
    db.select({ value: count() }).from(programs),
    db.select({ value: count() }).from(mediaAssets),
  ]);
  const [a, au, al, ph, pe, vi, pr, ma] = rows.map((row) => Number(row[0]?.value ?? 0));
  return { articles: a, audios: au, albums: al, photos: ph, persons: pe, videos: vi, programs: pr, assets: ma };
}

