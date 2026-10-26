import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { mediaAssets } from '@/server/db/schema';
import { absolutePathOf } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ByteRange = { start: number; end: number } | 'invalid' | null;

/** تنها مقدار سادهٔ Range پشتیبانی می‌شود (تک بازه) — همان چیزی که بازیکن‌های HTML5 می‌فرستند */
function parseRange(header: string | null, size: number): ByteRange {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isFinite(start) || start >= size) return 'invalid';
  if (!Number.isFinite(end) || end < start) return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}

function baseHeaders(asset: { mime: string; originalName: string }) {
  const headers: Record<string, string> = {
    'Content-Type': asset.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(asset.originalName))}"`,
  };
  // svg می‌تواند اسکریپت داشته باشد؛ پنل آپلود svg را رد می‌کند و این لایهٔ احتیاطی دوم است
  if (asset.mime === 'image/svg+xml') {
    headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  }
  return headers;
}

type Context = { params: Promise<{ path: string[] }> };

async function serve(request: Request, ctx: Context, streamBody: boolean) {
  const { path: rawSegments } = await ctx.params;
  const segments = rawSegments ?? [];
  const relative = segments.join('/');

  if (!relative || segments.some((s) => s === '' || s === '.' || s === '..')) {
    return new Response('مسیر نامعتبر است.', { status: 400 });
  }

  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.storedPath, relative))
    .limit(1);

  if (!asset) {
    return new Response('این فایل در سیستم ثبت نشده است.', { status: 404 });
  }

  const absolute = absolutePathOf(asset.storedPath);
  if (!absolute) {
    return new Response('مسیر نامعتبر است.', { status: 400 });
  }

  let info;
  try {
    info = await stat(absolute);
  } catch {
    return new Response('فایل روی میزبان موجود نیست؛ از پنل دوباره آپلود کنید.', { status: 404 });
  }

  const size = info.size;
  const headers = baseHeaders(asset);
  const range = parseRange(request.headers.get('range'), size);

  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${size}` },
    });
  }

  if (!streamBody) {
    return new Response(null, {
      status: 200,
      headers: { ...headers, 'Content-Length': String(size) },
    });
  }

  if (range) {
    const length = range.end - range.start + 1;
    const body = Readable.toWeb(createReadStream(absolute, { start: range.start, end: range.end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Content-Length': String(length),
      },
    });
  }

  const body = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
  return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
}

export async function GET(request: Request, ctx: Context) {
  return serve(request, ctx, true);
}

export async function HEAD(request: Request, ctx: Context) {
  return serve(request, ctx, false);
}
