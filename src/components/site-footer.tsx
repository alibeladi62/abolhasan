import Link from 'next/link';
import { PUBLIC_NAV, SITE_NAME } from '@/lib/nav';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-secondary/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-primary">{SITE_NAME}</p>
          <p className="text-muted-foreground">
            تماس: <span className="num-latin">۰۳۱۵۵۵۵۵۵۵۵</span> (شماره نمونه — مرحله ۲)
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {PUBLIC_NAV.slice(1).map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-primary">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
