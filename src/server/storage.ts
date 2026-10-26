/**
 * سرویس فایل: اعتبارسنجی، ذخیره در storage/uploads/<kind>/ و حذف امن.
 * هیچ فایل خامی از مسیر درخواستی خوانده نمی‌شود؛ مرجع واقعی، ستون stored_path در DB است.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, count, eq, ne, or } from 'drizzle-orm';
import { db } from './db';
import { albums, articles, audios, mediaAssets, photos, videos, type MediaAsset } from './db/schema';

export type AssetKind = 'audio' | 'image' | 'video';

export const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'uploads');

const MB = 1024 * 1024;

/** سقف‌ها از پرامپت مرحله ۲: صوت ۵۰MB، تصویر ۱۰MB، ویدئو ۵۰۰MB */
export const UPLOAD_RULES: Record<
  AssetKind,
  { maxBytes: number; extensions: string[]; mimes: string[] }
> = {
  audio: {
    maxBytes: 50 * MB,
    extensions: ['mp3', 'wav', 'm4a'],
    mimes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a'],
  },
  image: {
    maxBytes: 10 * MB,
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  video: {
    maxBytes: 500 * MB,
    extensions: ['mp4', 'webm'],
    mimes: ['video/mp4', 'video/webm'],
  },
};

export function formatBytes(bytes: number) {
  if (bytes < MB) return `${Math.round(bytes / 1024)} کیلوبایت`;
  return `${(bytes / MB).toFixed(1)} مگابایت`;
}

export function extensionOf(name: string) {
  return path.extname(name ?? '').toLowerCase().replace('.', '');
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateUpload(file: File, kind: AssetKind): ValidateResult {
  const rules = UPLOAD_RULES[kind];
  const ext = extensionOf(file.name);
  if (!rules.extensions.includes(ext)) {
    return { ok: false, error: `پسوند مجاز نیست. پسوند‌های قبولی این نوع: ${rules.extensions.join('، ')}` };
  }
  const declaredMime = (file.type || '').toLowerCase();
  // مرورگرهای ایرانی گاهی mime را خالی می‌فرستند؛ در آن حالت پسوند ملاک است
  if (declaredMime && !rules.mimes.includes(declaredMime)) {
    return { ok: false, error: `نوع فایل مجاز نیست (${declaredMime}).` };
  }
  if (file.size > rules.maxBytes) {
    return {
      ok: false,
      error: `حجم فایل از سقف ${kind === 'video' ? '۵۰۰' : kind === 'image' ? '۱۰' : '۵۰'} مگابایت بیشتر است (${formatBytes(file.size)}).`,
    };
  }
  if (file.size === 0) return { ok: false, error: 'فایل خالی است.' };
  return { ok: true };
}

export type SavedAsset = {
  asset: MediaAsset;
  /** فایل در دیسک وجود دارد؟ (asset بی‌فایل برای ویدئوی در انتظار آپلود) */
  hasFile: boolean;
};

/**
 * ذخیره فایل آپلودی + ثبت رسانه.
 * اگر file=null باشد فقط رکورد DB ساخته می‌شود (برای ویدئویی که فایلش هنوزرسیده نیست)؛
 * در آن حالت با suggestedStem مسیر باثبات و قابل پیش‌بینی می‌ماند تا کارفرما همان فایل را بگذارد.
 */
export async function saveAsset(
  file: File | null,
  kind: AssetKind,
  options: { originalName?: string; suggestedStem?: string; extension?: string } = {},
): Promise<SavedAsset> {
  const ext = file ? extensionOf(file.name) : (options.extension ?? 'bin');
  const stem = options.suggestedStem ?? randomBytes(12).toString('hex');
  const storedPath = `${kind}/${stem}.${ext}`;

  if (file) {
    const target = path.join(STORAGE_ROOT, storedPath);
    if (!target.startsWith(STORAGE_ROOT)) throw new Error('مسیر نامعتبر');
    await mkdir(path.dirname(target), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(target, buffer, { mode: 0o644 });
  }

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      kind,
      originalName: (options.originalName || file?.name || storedPath).slice(0, 240),
      storedPath,
      mime: file?.type || mimeForExtension(kind, ext),
      sizeBytes: file?.size ?? 0,
    })
    .returning();

  return { asset, hasFile: Boolean(file) };
}

function mimeForExtension(kind: AssetKind, ext: string) {
  const table: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    svg: 'image/svg+xml',
    bin: 'application/octet-stream',
  };
  return table[ext] ?? (kind === 'image' ? 'image/jpeg' : 'application/octet-stream');
}

/** مسیر مطلق یک رسانه، فقط برای فایل‌های ثبت‌شده در DB */
export function absolutePathOf(storedPath: string) {
  const abs = path.resolve(STORAGE_ROOT, storedPath);
  return abs.startsWith(STORAGE_ROOT) ? abs : null;
}

export async function fileExists(asset: { storedPath: string }) {
  const abs = absolutePathOf(asset.storedPath);
  if (!abs) return false;
  try {
    const info = await stat(abs);
    return info.isFile();
  } catch {
    return false;
  }
}

/** همه‌ی ارجاع‌های ممکن به یک رسانه در جدول‌های محتوا */
export type RefTable = 'audios' | 'videos' | 'albums' | 'photos' | 'articles';

export async function countAssetReferences(assetId: number, ignore?: { table: RefTable; id: number }) {
  const byId = (table: RefTable) => ignore?.table === table ? ignore.id : null;

  const queries = [
    db
      .select({ value: count() })
      .from(audios)
      .where(
        byId('audios') === null
          ? eq(audios.assetId, assetId)
          : and(eq(audios.assetId, assetId), ne(audios.id, byId('audios')!)),
      ),
    db
      .select({ value: count() })
      .from(videos)
      .where(
        and(
          or(eq(videos.assetId, assetId), eq(videos.coverAssetId, assetId)),
          byId('videos') === null ? undefined : ne(videos.id, byId('videos')!),
        ),
      ),
    db
      .select({ value: count() })
      .from(albums)
      .where(
        byId('albums') === null
          ? eq(albums.coverAssetId, assetId)
          : and(eq(albums.coverAssetId, assetId), ne(albums.id, byId('albums')!)),
      ),
    db
      .select({ value: count() })
      .from(photos)
      .where(
        byId('photos') === null
          ? eq(photos.assetId, assetId)
          : and(eq(photos.assetId, assetId), ne(photos.id, byId('photos')!)),
      ),
    db
      .select({ value: count() })
      .from(articles)
      .where(
        byId('articles') === null
          ? eq(articles.coverAssetId, assetId)
          : and(eq(articles.coverAssetId, assetId), ne(articles.id, byId('articles')!)),
      ),
  ];

  const rows = await Promise.all(queries);
  return rows.reduce((total, row) => total + Number(row[0]?.value ?? 0), 0);
}

/** حذف رسانه فقط وقتی هیچ ردیف دیگری مرجعش نباشد؛ فایل روی دیسک هم پاک می‌شود */
export async function deleteAssetIfUnused(assetId: number): Promise<{ deleted: boolean; reason?: string }> {
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
  if (!asset) return { deleted: false, reason: 'رسانه پیدا نشد.' };

  const refs = await countAssetReferences(assetId);
  if (refs > 0) {
    return { deleted: false, reason: `این فایل هنوز در ${refs} جای دیگر استفاده شده است.` };
  }

  const abs = absolutePathOf(asset.storedPath);
  if (abs) {
    try {
      await unlink(abs);
    } catch {
      /* فایل از قبل روی دیسک نبود (مثلاً ویدئوی نمونه) */
    }
  }
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  return { deleted: true };
}

export const publicUrlFor = (asset: Pick<MediaAsset, 'storedPath'>) => `/api/files/${asset.storedPath}`;
