'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toPersianDigits } from '@/lib/jalali';
import { useAudioPlayer, type PlayerTrack } from './audio-player';

export type AudioCardData = {
  id: number;
  title: string;
  narrator: string | null;
  performer: string | null;
  occasionLabel: string;
  durationSec: number | null;
  publishedLabel: string;
  url: string | null;
  description: string | null;
};

/** ردیف فایل‌های صوتی با دکمه پخش؛ خالی بودن url یعنی فایل هنوز به میزبان نرسیده */
export function AudioList({ items }: { items: AudioCardData[] }) {
  const player = useAudioPlayer();

  if (!items.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          هنوز فایلی در این آرشیو منتشر نشده است.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const track: PlayerTrack | null = item.url
          ? { id: item.id, title: item.title, subtitle: item.narrator ?? item.performer ?? undefined, url: item.url }
          : null;
        const isCurrent = track?.id === player.currentId;

        return (
          <li key={item.id}>
            <Card className={isCurrent ? 'border-primary/60 bg-primary/5' : 'transition hover:shadow-sm'}>
              <CardContent className="flex items-center gap-3 py-3">
                {track ? (
                  <button
                    type="button"
                    onClick={() => player.toggle(track)}
                    aria-label={isCurrent && player.isPlaying ? `توقف ${item.title}` : `پخش ${item.title}`}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Play className="size-4" />
                  </button>
                ) : (
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground"
                    title="فایل این آیتم هنوز آپلود نشده است"
                  >
                    —
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.narrator ?? item.performer ?? 'بدون ذکر گوینده'}
                    {item.durationSec ? ` · ${formatDuration(item.durationSec)}` : ''}
                    {' · '}
                    <span className="num-latin">{item.publishedLabel}</span>
                  </p>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">{item.description}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="secondary">{item.occasionLabel}</Badge>
                  {isCurrent ? (
                    <span className="text-[11px] font-bold text-primary">
                      {player.isPlaying ? 'در حال پخش' : 'متوقف'}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return toPersianDigits(`${m}:${String(s).padStart(2, '0')}`);
}

/** نوار فیلتر/مرتب‌سازی با لینک‌های SSR؛ پارامترهای دیگر حفظ می‌شوند */
export function FilterBar({
  basePath,
  current,
  groups,
}: {
  basePath: string;
  current: Record<string, string>;
  groups: { label: string; param: string; options: { value: string; label: string }[] }[];
}) {
  const href = (param: string, value: string) => {
    const query = new URLSearchParams(current);
    query.set(param, value);
    return `${basePath}?${query.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-3 py-2">
      {groups.map((group) => (
        <div key={group.param} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">{group.label}:</span>
          {group.options.map((option) => {
            const isActive = (current[group.param] ?? 'all') === option.value;
            return (
              <Link
                key={`${group.param}-${option.value}`}
                href={href(group.param, option.value)}
                aria-current={isActive ? 'true' : undefined}
                className={
                  isActive
                    ? 'rounded-full border border-primary bg-primary px-2.5 py-0.5 text-xs text-primary-foreground'
                    : 'rounded-full border border-border px-2.5 py-0.5 text-xs transition hover:bg-secondary'
                }
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
