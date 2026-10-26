'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { PUBLIC_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

export function SiteNav({ account }: { account: { href: string; label: string } }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = [...PUBLIC_NAV, account];

  return (
    <>
      <nav className="hidden items-center gap-1 lg:flex">
        {items.map((item) => (
          <NavLink key={item.href} {...item} active={pathname === item.href} />
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="منو"
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-md border border-border bg-card text-foreground lg:hidden"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open ? (
        <nav className="absolute inset-x-0 top-full z-50 border-b border-border bg-card px-4 py-3 shadow-lg lg:hidden">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink {...item} active={pathname === item.href} block onNavigate={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}

function NavLink({
  href,
  label,
  stage,
  active,
  block,
  onNavigate,
}: {
  href: string;
  label: string;
  stage?: string;
  active: boolean;
  block?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-colors',
        block && 'block w-full',
        active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary',
      )}
    >
      {label}
      {stage ? (
        <span className={cn('ms-1 text-[10px]', active ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
          مرحله {stage}
        </span>
      ) : null}
    </Link>
  );
}
