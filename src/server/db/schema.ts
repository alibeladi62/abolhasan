import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phone: text('phone').notNull().unique(),
  name: text('name'),
  nationalId: text('national_id'),
  birthDateJalali: text('birth_date_jalali'),
  city: text('city'),
  role: text('role', { enum: ['member', 'operator', 'admin'] })
    .notNull()
    .default('member'),
  profileComplete: integer('profile_complete').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const otpCodes = sqliteTable('otp_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: integer('consumed_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  lastSeenAt: integer('last_seen_at'),
});

export const floors = sqliteTable('floors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  idx: integer('index').notNull(),
});

export const units = sqliteTable('units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  floorId: integer('floor_id')
    .notNull()
    .references(() => floors.id),
  code: text('code').notNull(),
  type: text('type').notNull(),
  capacity: integer('capacity').notNull(),
  nightlyPrice: integer('nightly_price').notNull(),
  status: text('status', {
    enum: ['old_house', 'under_construction', 'planned', 'blocked'],
  })
    .notNull()
    .default('planned'),
  demolitionDate: text('demolition_date'),
  svgPolygon: text('svg_polygon'),
  svgViewbox: text('svg_viewbox'),
});

export type User = typeof users.$inferSelect;
export type Unit = typeof units.$inferSelect;

/* ─────────────────────────── مرحله ۲: محتوای عمومی ─────────────────────────── */

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  kind: text('kind', { enum: ['article', 'audio', 'video', 'program'] })
    .notNull()
    .default('article'),
});

export const mediaAssets = sqliteTable('media_assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['audio', 'image', 'video'] }).notNull(),
  originalName: text('original_name').notNull(),
  /** مسیر نسبی داخل storage/uploads — تنها ورودی مجاز /api/files */
  storedPath: text('stored_path').notNull().unique(),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  durationSec: integer('duration_sec'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const audios = sqliteTable('audios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  narrator: text('narrator'),
  performer: text('performer'),
  occasion: text('occasion', { enum: ['moharram', 'ramadan', 'fatimiye', 'other'] })
    .notNull()
    .default('other'),
  assetId: integer('asset_id').references(() => mediaAssets.id),
  description: text('description'),
  publishedAt: text('published_at'),
  isPublished: integer('is_published').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  coverAssetId: integer('cover_asset_id').references(() => mediaAssets.id),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  albumId: integer('album_id')
    .notNull()
    .references(() => albums.id, { onDelete: 'cascade' }),
  assetId: integer('asset_id').references(() => mediaAssets.id),
  caption: text('caption'),
  sort: integer('sort').notNull().default(0),
});

export const persons = sqliteTable('persons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  bio: text('bio'),
  isDeceased: integer('is_deceased').notNull().default(0),
  mainPhotoId: integer('main_photo_id').references(() => photos.id),
  albumId: integer('album_id').references(() => albums.id),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const videos = sqliteTable('videos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  occasion: text('occasion', { enum: ['moharram', 'ramadan', 'fatimiye', 'other'] })
    .notNull()
    .default('other'),
  assetId: integer('asset_id').references(() => mediaAssets.id),
  coverAssetId: integer('cover_asset_id').references(() => mediaAssets.id),
  description: text('description'),
  programDateJalali: text('program_date_jalali'),
  isPublished: integer('is_published').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  dateJalali: text('date_jalali').notNull(),
  startTime: text('start_time'),
  place: text('place'),
  kind: text('kind', { enum: ['ceremony', 'lecture', 'class', 'other'] })
    .notNull()
    .default('ceremony'),
  isCancelled: integer('is_cancelled').notNull().default(0),
  description: text('description'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  bodyMarkdown: text('body_markdown').notNull().default(''),
  excerpt: text('excerpt'),
  coverAssetId: integer('cover_asset_id').references(() => mediaAssets.id),
  author: text('author'),
  categoryId: integer('category_id').references(() => categories.id),
  /** برچسب‌ها به‌صورت متن کاماجدا */
  tags: text('tags'),
  publishedAt: text('published_at'),
  isPublished: integer('is_published').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Category = typeof categories.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type Audio = typeof audios.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Person = typeof persons.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Article = typeof articles.$inferSelect;
