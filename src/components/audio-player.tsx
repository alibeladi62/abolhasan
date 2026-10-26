'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Volume2, X } from 'lucide-react';
import { toPersianDigits } from '@/lib/jalali';

export type PlayerTrack = { id: number; title: string; subtitle?: string; url: string };

type PlayerContextValue = {
  play: (track: PlayerTrack) => void;
  toggle: (track: PlayerTrack) => void;
  stop: () => void;
  currentId: number | null;
  isPlaying: boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function useAudioPlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('useAudioPlayer باید داخل AudioPlayerProvider استفاده شود');
  return ctx;
}

/**
 * پلیکن چسبان پایین صفحه. عنصر <audio> در layout عمومی نگه داشته می‌شود،
 * پس پخش در جابه‌جایی بین صفحات (client-side navigation) ادامه می‌یابد.
 */
export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setProgress({ current: el.currentTime, duration: el.duration || 0 });
    const onEnd = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  const play = useCallback((next: PlayerTrack) => {
    const el = audioRef.current;
    if (!el) return;
    if (el.dataset.id !== String(next.id)) {
      el.src = next.url;
      el.dataset.id = String(next.id);
      el.load();
    }
    setTrack(next);
    void el.play().catch(() => setIsPlaying(false));
  }, []);

  const toggle = useCallback(
    (next: PlayerTrack) => {
      const el = audioRef.current;
      if (!el) return;
      if (el.dataset.id === String(next.id)) {
        if (el.paused) void el.play().catch(() => setIsPlaying(false));
        else el.pause();
        return;
      }
      play(next);
    },
    [play],
  );

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    delete el.dataset.id;
    el.load();
    setTrack(null);
    setIsPlaying(false);
    setProgress({ current: 0, duration: 0 });
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({ play, toggle, stop, currentId: track?.id ?? null, isPlaying }),
    [play, toggle, stop, track, isPlaying],
  );

  const seek = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = seconds;
    setProgress((p) => ({ ...p, current: seconds }));
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
      {track ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => toggle(track)}
              aria-label={isPlaying ? 'توقف' : 'پخش'}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90"
            >
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{track.title}</p>
              {track.subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{track.subtitle}</p>
              ) : null}
              <div className="mt-1 flex items-center gap-2">
                <span className="num-latin w-12 text-xs text-muted-foreground">
                  {formatTime(progress.current)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(progress.duration, 0.1)}
                  step={0.1}
                  value={progress.current}
                  onChange={(event) => seek(Number(event.target.value))}
                  aria-label="نوار زمان پخش"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-[#0e6b5c]"
                />
                <span className="num-latin w-12 text-left text-xs text-muted-foreground">
                  {formatTime(progress.duration)}
                </span>
              </div>
            </div>

            <label className="hidden items-center gap-1 md:flex" title="بلندی صدا">
              <Volume2 className="size-4 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setVolume(next);
                  if (audioRef.current) audioRef.current.volume = next;
                }}
                aria-label="بلندی صدا"
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-secondary accent-[#0e6b5c]"
              />
            </label>

            <button
              type="button"
              onClick={stop}
              aria-label="بستن پخش‌کننده"
              className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </PlayerContext.Provider>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return toPersianDigits('0:00');
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return toPersianDigits(`${m}:${String(s).padStart(2, '0')}`);
}
