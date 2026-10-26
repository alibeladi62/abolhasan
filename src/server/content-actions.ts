/**
 * اکشن‌های پنل محتوا — همه سمت سرور، همه با چک نقش مدیر و اعتبارسنجی فیلدها.
 * ترتیب حذف امن: اول ردیف محتوا پاک/جایگزین می‌شود، بعد رسانه با countAssetReferences.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { eq, ne } from 'drizzle-orm';
import { jalaliToGregorianIso, toLatinDigits } from '@/lib/jalali';
import { nextSlugFromCollision, slugify } from '@/lib/slug';
import { getCurrentUser } from './auth';
import { db } from './db';
import {
  albums,
  articles,
  audios,
  categories,
  persons,
  photos,
  programs,
  videos,
  type Category,
} from './db/schema';
import { deleteAssetIfUnused, saveAsset, validateUpload, type AssetKind } from './storage';
import type { ActionState } from './actions';

async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}

const DENIED: ActionState = { ok: false, error: 'فقط مدیر هیئت می‌تواند محتوا را تغییر دهد.' };

/* ─────────────── خواندن فیلدها ─────────────── */

const text = (fd: FormData, name: string) => String(fd.get(name) ?? '').trim();
const latin = (fd: FormData, name: string) => toLatinDigits(text(fd, name));

function int(fd: FormData, name: string): number | null {
  const raw = latin(fd, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** چکباکس‌های HTML مقدار 'on' می‌فرستند؛ گزینه‌های radio/hidden '1' */
const flag = (fd: FormData, name: string) => {
  const value = fd.get(name);
  return value === 'on' || value === '1' ? 1 : 0;
};

function upload(fd: FormData, name: string): File | null {
  const value = fd.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

type AttachResult = { ok: true; assetId: number | null } | { ok: false; error: string };

/** آپلود رسانه جدید برای یک ردیف؛ نبودِ فایل = همان رسانه قبلی می‌ماند */
async function attach(fd: FormData, name: string, kind: AssetKind): Promise<AttachResult> {
  const file = upload(fd, name);
  if (!file) return { ok: true, assetId: null };
  const check = validateUpload(file, kind);
  if (!check.ok) return { ok: false, error: check.error };
  const { asset } = await saveAsset(file, kind, { originalName: file.name });
  return { ok: true, assetId: asset.id };
}

const OCCASIONS = ['moharram', 'ramadan', 'fatimiye', 'other'] as const;
const PROGRAM_KINDS = ['ceremony', 'lecture', 'class', 'other'] as const;
const CATEGORY_KINDS = ['article', 'audio', 'video', 'program'] as const;

function pickEnum<T extends string>(fd: FormData, name: string, allowed: readonly T[], fallback: T): T {
  const value = text(fd, name) as T;
  return allowed.includes(value) ? value : fallback;
}

/** تاریخ انتشار: ورودی مدیر شمسی است، در DB میلادی ذخیره می‌شود (هم‌خانواده با created_at) */
function publicationDate(fd: FormData, current: string | null): { value: string | null; error: string | null } {
  const given = latin(fd, 'published_date');
  if (!given) return { value: current, error: null };
  const gregorian = jalaliToGregorianIso(given);
  if (!gregorian) return { value: current, error: 'تاریخ انتشار شمسی معتبر نیست (روز/ماه/سال را کامل انتخاب کنید).' };
  return { value: gregorian, error: null };
}

const todayGregorian = () => new Date().toISOString().slice(0, 10);

/** مسیر یک فایل آپلودی جدید داخل media_assets؛ در صورت خطا پیام فارسی */
async function resolveAsset(
  fd: FormData,
  field: string,
  kind: AssetKind,
  currentAssetId: number | null,
): Promise<{ assetId: number | null; error: string | null; replacedId: number | null }> {
  const result = await attach(fd, field, kind);
  if (!result.ok) return { assetId: currentAssetId, error: result.error, replacedId: null };
  if (result.assetId === null) return { assetId: currentAssetId, error: null, replacedId: null };
  return { assetId: result.assetId, error: null, replacedId: currentAssetId };
}

/** رسانه‌ی بی‌استفاده را بعد از ذخیره‌ی ردیف پاک کن (فایل روی دیسک هم) */
async function cleanupAsset(previousId: number | null) {
  if (previousId) await deleteAssetIfUnused(previousId);
}

async function slugFor(table: 'articles' | 'persons', base: string, selfId: number | null): Promise<string> {
  const taken =
    table === 'articles'
      ? selfId
        ? await db.select({ slug: articles.slug }).from(articles).where(ne(articles.id, selfId))
        : await db.select({ slug: articles.slug }).from(articles)
      : selfId
        ? await db.select({ slug: persons.slug }).from(persons).where(ne(persons.id, selfId))
        : await db.select({ slug: persons.slug }).from(persons);
  return nextSlugFromCollision(slugify(base), new Set(taken.map((row) => row.slug)));
}

function revalidate() {
  revalidatePath('/admin/content');
  revalidatePath('/', 'layout');
}

/* ─────────────── مقالات ─────────────── */

export async function saveArticleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const title = text(fd, 'title');
  const body = text(fd, 'body_markdown');
  if (title.length < 3) return { ok: false, error: 'عنوان مقاله حداقل ۳ حرف باشد.' };
  if (body.length < 10) return { ok: false, error: 'متن مقاله خیلی کوتاه است؛ متن را بنویسید.' };

  const categoryId = int(fd, 'category_id');
  if (categoryId) {
    const [found] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (!found) return { ok: false, error: 'دسته انتخابی وجود ندارد.' };
  }

  const current = id
    ? await db.select().from(articles).where(eq(articles.id, id)).limit(1).then((rows) => rows[0] ?? null)
    : null;

  const date = publicationDate(fd, current?.publishedAt ?? null);
  if (date.error) return { ok: false, error: date.error };

  const cover = await resolveAsset(fd, 'cover', 'image', current?.coverAssetId ?? null);
  if (cover.error) return { ok: false, error: `فایل جلد: ${cover.error}` };

  const isPublished = flag(fd, 'is_published');
  const publishedAt = isPublished && !date.value ? todayGregorian() : date.value;
  const slug = await slugFor('articles', text(fd, 'slug') || title, id);

  const values = {
    title,
    slug,
    bodyMarkdown: text(fd, 'body_markdown'),
    excerpt: text(fd, 'excerpt') || null,
    coverAssetId: cover.assetId,
    author: text(fd, 'author') || null,
    categoryId,
    tags: text(fd, 'tags') || null,
    publishedAt,
    isPublished,
  };

  let savedId = id;
  if (id) {
    await db.update(articles).set(values).where(eq(articles.id, id));
  } else {
    const [row] = await db.insert(articles).values(values).returning({ id: articles.id });
    savedId = row.id;
  }

  await cleanupAsset(cover.replacedId);
  revalidate();
  return { ok: true, info: `مقاله ذخیره شد (شناسه ${savedId}، نشانی /articles/${slug}).` };
}

/* ─────────────── صوت ─────────────── */

export async function saveAudioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const title = text(fd, 'title');
  if (title.length < 3) return { ok: false, error: 'عنوان صوت حداقل ۳ حرف باشد.' };

  const current = id
    ? await db.select().from(audios).where(eq(audios.id, id)).limit(1).then((rows) => rows[0] ?? null)
    : null;

  const date = publicationDate(fd, current?.publishedAt ?? null);
  if (date.error) return { ok: false, error: date.error };

  const file = await resolveAsset(fd, 'file', 'audio', current?.assetId ?? null);
  if (file.error) return { ok: false, error: `فایل صوت: ${file.error}` };
  if (!file.assetId) return { ok: false, error: 'برای صوت جدید باید فایل صوتی (mp3/wav/m4a) انتخاب کنید.' };

  const isPublished = flag(fd, 'is_published');
  const values = {
    title,
    narrator: text(fd, 'narrator') || null,
    performer: text(fd, 'performer') || null,
    occasion: pickEnum(fd, 'occasion', OCCASIONS, 'other'),
    assetId: file.assetId,
    description: text(fd, 'description') || null,
    publishedAt: isPublished && !date.value ? todayGregorian() : date.value,
    isPublished,
  };

  if (id) await db.update(audios).set(values).where(eq(audios.id, id));
  else await db.insert(audios).values(values);

  await cleanupAsset(file.replacedId);
  revalidate();
  return { ok: true, info: 'صوت ذخیره شد.' };
}

/* ─────────────── آلبوم و عکس ─────────────── */

export async function saveAlbumAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const title = text(fd, 'title');
  if (title.length < 3) return { ok: false, error: 'عنوان آلبوم حداقل ۳ حرف باشد.' };

  const current = id
    ? await db.select().from(albums).where(eq(albums.id, id)).limit(1).then((rows) => rows[0] ?? null)
    : null;

  const cover = await resolveAsset(fd, 'cover', 'image', current?.coverAssetId ?? null);
  if (cover.error) return { ok: false, error: `جلد آلبوم: ${cover.error}` };

  const values = { title, description: text(fd, 'description') || null, coverAssetId: cover.assetId };
  let savedId = id;
  if (id) await db.update(albums).set(values).where(eq(albums.id, id));
  else {
    const [row] = await db.insert(albums).values(values).returning({ id: albums.id });
    savedId = row.id;
  }

  await cleanupAsset(cover.replacedId);
  revalidate();
  return { ok: true, info: `آلبوم ذخیره شد (نشانی /gallery/${savedId}).` };
}

export async function savePhotoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const albumId = int(fd, 'album_id');
  if (!albumId) return { ok: false, error: 'آلبوم مقصد را انتخاب کنید.' };
  const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!album) return { ok: false, error: 'آلبوم انتخابی وجود ندارد.' };

  const current = id
    ? await db.select().from(photos).where(eq(photos.id, id)).limit(1).then((rows) => rows[0] ?? null)
    : null;

  const file = await resolveAsset(fd, 'file', 'image', current?.assetId ?? null);
  if (file.error) return { ok: false, error: `فایل تصویر: ${file.error}` };
  if (!file.assetId) return { ok: false, error: 'برای افزودن عکس باید فایل تصویری (jpg/png/webp) انتخاب کنید.' };

  const sortRaw = latin(fd, 'sort');
  const sort = sortRaw === '' ? 0 : Number(sortRaw);
  const values = {
    albumId,
    assetId: file.assetId,
    caption: text(fd, 'caption') || null,
    sort: Number.isFinite(sort) ? sort : 0,
  };

  if (id) await db.update(photos).set(values).where(eq(photos.id, id));
  else await db.insert(photos).values(values);

  await cleanupAsset(file.replacedId);
  revalidate();
  return { ok: true, info: 'عکس ذخیره شد.' };
}

/* ─────────────── اشخاص ─────────────── */

export async function savePersonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const name = text(fd, 'name');
  if (name.length < 2) return { ok: false, error: 'نام شخص را کامل بنویسید.' };

  const albumId = int(fd, 'album_id');
  if (albumId) {
    const [found] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
    if (!found) return { ok: false, error: 'آلبوم انتخابی وجود ندارد.' };
  }

  const mainPhotoId = int(fd, 'main_photo_id');
  if (mainPhotoId) {
    const [found] = await db.select().from(photos).where(eq(photos.id, mainPhotoId)).limit(1);
    if (!found) return { ok: false, error: 'عکس اصلی انتخابی پیدا نشد.' };
  }

  const slug = await slugFor('persons', text(fd, 'slug') || name, id);
  const values = {
    name,
    slug,
    bio: text(fd, 'bio') || null,
    isDeceased: flag(fd, 'is_deceased'),
    albumId,
    mainPhotoId,
  };

  if (id) await db.update(persons).set(values).where(eq(persons.id, id));
  else await db.insert(persons).values(values);

  revalidate();
  return { ok: true, info: `شخص ذخیره شد (نشانی /gallery/persons/${slug}).` };
}

/* ─────────────── ویدئو ─────────────── */

export async function saveVideoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const title = text(fd, 'title');
  if (title.length < 3) return { ok: false, error: 'عنوان ویدئو حداقل ۳ حرف باشد.' };

  const current = id
    ? await db.select().from(videos).where(eq(videos.id, id)).limit(1).then((rows) => rows[0] ?? null)
    : null;

  const dateRaw = latin(fd, 'program_date_jalali');
  if (dateRaw && !jalaliToGregorianIso(dateRaw)) {
    return { ok: false, error: 'تاریخ برنامه شمسی معتبر نیست.' };
  }

  const file = await resolveAsset(fd, 'file', 'video', current?.assetId ?? null);
  if (file.error) return { ok: false, error: `فایل ویدئو: ${file.error}` };
  const cover = await resolveAsset(fd, 'cover', 'image', current?.coverAssetId ?? null);
  if (cover.error) return { ok: false, error: `تصویر بندانگشتی: ${cover.error}` };

  const values = {
    title,
    occasion: pickEnum(fd, 'occasion', OCCASIONS, 'other'),
    assetId: file.assetId,
    coverAssetId: cover.assetId,
    description: text(fd, 'description') || null,
    programDateJalali: dateRaw || null,
    isPublished: flag(fd, 'is_published'),
  };

  let savedId = id;
  if (id) await db.update(videos).set(values).where(eq(videos.id, id));
  else {
    const [row] = await db.insert(videos).values(values).returning({ id: videos.id });
    savedId = row.id;
  }

  await cleanupAsset(file.replacedId);
  await cleanupAsset(cover.replacedId);
  revalidate();
  return { ok: true, info: `ویدئو ذخیره شد (نشانی /video/${savedId}).` };
}

/* ─────────────── برنامه‌ها ─────────────── */

export async function saveProgramAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const title = text(fd, 'title');
  if (title.length < 3) return { ok: false, error: 'عنوان برنامه حداقل ۳ حرف باشد.' };

  const date = latin(fd, 'date_jalali');
  if (!date || !jalaliToGregorianIso(date)) {
    return { ok: false, error: 'تاریخ شمسی برنامه الزامی است (روز، ماه و سال را انتخاب کنید).' };
  }

  const values = {
    title,
    dateJalali: date,
    startTime: latin(fd, 'start_time') || null,
    place: text(fd, 'place') || null,
    kind: pickEnum(fd, 'kind', PROGRAM_KINDS, 'ceremony'),
    isCancelled: flag(fd, 'is_cancelled'),
    description: text(fd, 'description') || null,
  };

  if (id) await db.update(programs).set(values).where(eq(programs.id, id));
  else await db.insert(programs).values(values);

  revalidate();
  return { ok: true, info: 'برنامه ذخیره شد.' };
}

/* ─────────────── دسته‌ها ─────────────── */

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return DENIED;

  const id = int(fd, 'id');
  const name = text(fd, 'name');
  if (name.length < 2) return { ok: false, error: 'نام دسته را بنویسید.' };

  const kind = pickEnum<Category['kind']>(fd, 'kind', CATEGORY_KINDS, 'article');

  const taken = await db.select({ slug: categories.slug, id: categories.id }).from(categories);
  const others = new Set(taken.filter((row) => row.id !== id).map((row) => row.slug));
  const slug = nextSlugFromCollision(slugify(name), others);

  const values = { name, slug, kind };
  if (id) await db.update(categories).set(values).where(eq(categories.id, id));
  else await db.insert(categories).values(values);

  revalidate();
  return { ok: true, info: `دسته ذخیره شد (slug: ${slug}).` };
}

/* ─────────────── انتشار / حذف ─────────────── */

export type ContentEntity = 'article' | 'audio' | 'album' | 'photo' | 'person' | 'video' | 'program' | 'category';

export async function togglePublishedAction(fd: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const entity = text(fd, 'entity');
  const id = int(fd, 'id');
  const value = flag(fd, 'is_published');
  if (!id) return;

  if (entity === 'article') {
    const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (!row) return;
    await db
      .update(articles)
      .set({ isPublished: value, publishedAt: value && !row.publishedAt ? todayGregorian() : row.publishedAt })
      .where(eq(articles.id, id));
  } else if (entity === 'audio') {
    const [row] = await db.select().from(audios).where(eq(audios.id, id)).limit(1);
    if (!row) return;
    await db
      .update(audios)
      .set({ isPublished: value, publishedAt: value && !row.publishedAt ? todayGregorian() : row.publishedAt })
      .where(eq(audios.id, id));
  } else if (entity === 'video') {
    await db.update(videos).set({ isPublished: value }).where(eq(videos.id, id));
  }
  revalidate();
}

export async function deleteContentAction(fd: FormData): Promise<void> {
  if (!(await isAdmin())) return;
  const entity = text(fd, 'entity') as ContentEntity;
  const id = int(fd, 'id');
  if (!id) return;

  switch (entity) {
    case 'article': {
      const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
      if (!row) return;
      await db.delete(articles).where(eq(articles.id, id));
      await cleanupAsset(row.coverAssetId);
      break;
    }
    case 'audio': {
      const [row] = await db.select().from(audios).where(eq(audios.id, id)).limit(1);
      if (!row) return;
      await db.delete(audios).where(eq(audios.id, id));
      await cleanupAsset(row.assetId);
      break;
    }
    case 'album': {
      const [albumRow] = await db.select().from(albums).where(eq(albums.id, id)).limit(1);
      if (!albumRow) return;
      const photoRows = await db.select().from(photos).where(eq(photos.albumId, id));
      // عکس‌ها با cascade پاک می‌شوند؛ اول ارجاع عکس اصلی اشخاص را آزاد کن
      for (const photo of photoRows) {
        await db.update(persons).set({ mainPhotoId: null }).where(eq(persons.mainPhotoId, photo.id));
      }
      await db.delete(albums).where(eq(albums.id, id));
      for (const photo of photoRows) await cleanupAsset(photo.assetId);
      await cleanupAsset(albumRow.coverAssetId);
      break;
    }
    case 'photo': {
      const [row] = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
      if (!row) return;
      await db.update(persons).set({ mainPhotoId: null }).where(eq(persons.mainPhotoId, id));
      await db.delete(photos).where(eq(photos.id, id));
      await cleanupAsset(row.assetId);
      break;
    }
    case 'person': {
      await db.delete(persons).where(eq(persons.id, id));
      break;
    }
    case 'video': {
      const [row] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
      if (!row) return;
      await db.delete(videos).where(eq(videos.id, id));
      await cleanupAsset(row.assetId);
      await cleanupAsset(row.coverAssetId);
      break;
    }
    case 'program': {
      await db.delete(programs).where(eq(programs.id, id));
      break;
    }
    case 'category': {
      await db.update(articles).set({ categoryId: null }).where(eq(articles.categoryId, id));
      await db.delete(categories).where(eq(categories.id, id));
      break;
    }
  }
  revalidate();
}
