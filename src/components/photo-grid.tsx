'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toPersianDigits } from '@/lib/jalali';

export type LightboxImage = { src: string; caption?: string | null };

/** نمایشگر تمام‌صفحه ساده: قبلی/بعدی با دکمه و صفحه‌کلید، بستن با Esc */
export function PhotoGrid({ images }: { images: LightboxImage[] }) {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) => setIndex((current) => (current === null ? current : (current + delta + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      // جهت‌ها در چیدمان RTL جابه‌جا می‌شوند: «چپ» یعنی بعدی
      if (event.key === 'ArrowLeft') step(1);
      if (event.key === 'ArrowRight') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, close, step]);

  if (!images.length) {
    return <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      هنوز عکسی در این آلبوم نیست.
    </p>;
  }

  const active = index === null ? null : images[index];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, i) => (
          <li key={image.src}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`نمایش عکس ${toPersianDigits(String(i + 1))}`}
              className="group block w-full overflow-hidden rounded-lg border border-border bg-secondary"
            >
              <span className="block aspect-[4/3] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt={image.caption ?? `عکس ${i + 1}`}
                  loading="lazy"
                  className="size-full object-cover transition group-hover:scale-[1.02]"
                />
              </span>
              {image.caption ? (
                <span className="block truncate px-2 py-1.5 text-start text-xs text-muted-foreground">
                  {image.caption}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="نمایش بزرگ عکس"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.src}
            alt={active.caption ?? 'عکس آلبوم'}
            className="max-h-[78vh] max-w-full rounded-lg bg-card object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="عکس قبلی"
              className="grid size-10 place-items-center rounded-full border border-white/30 text-white"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="text-sm text-white">
              {toPersianDigits(String((index ?? 0) + 1))} از {toPersianDigits(String(images.length))}
              {active.caption ? ` — ${active.caption}` : ''}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="عکس بعدی"
              className="grid size-10 place-items-center rounded-full border border-white/30 text-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="بستن"
              className="grid size-10 place-items-center rounded-full bg-white/15 text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
