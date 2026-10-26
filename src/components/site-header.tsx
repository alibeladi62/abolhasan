import Link from 'next/link';
import { PUBLIC_NAV, SITE_NAME } from '@/lib/nav';
import type { User } from '@/server/db/schema';
import { SiteNav } from './site-nav';

export function SiteHeader({ user }: { user: User | null }) {
  const account = user ? { href: '/profile', label: user.name || 'پروفایل من' } : { href: '/login', label: 'ورود' };

  return (
    <header className="relative border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
            ه
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-primary">{SITE_NAME}</span>
            <span className="block text-xs text-muted-foreground">ابولحسن</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <SiteNav account={account} />
        </div>
      </div>
    </header>
  );
}
