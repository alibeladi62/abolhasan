'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <span>{item.label}</span>
            {item.stage ? (
              <span
                className={cn(
                  'rounded-full px-2 text-[11px]',
                  active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                )}
              >
                مرحله {item.stage}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
