import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SITE_NAME } from '@/lib/nav';
import { logoutAction } from '@/server/actions';
import { getCurrentUser } from '@/server/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (user.role !== 'admin') {
    return (
      <div className="mx-auto grid min-h-dvh max-w-xl place-items-center px-4">
        <Card>
          <CardHeader>
            <CardTitle>دسترسی به پنل مدیریت ندارید</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              این حساب ({user.phone}) نقش «{user.role === 'operator' ? 'اپراتور' : 'زائر'}» دارد و در
              مرحله ۱ تنها نقش مدیر به پنل دسترسی دارد.
            </p>
            <Button asChild>
              <Link href="/">بازگشت به سایت</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-jade-dark text-white text-sm font-bold">
              پ
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-primary">پنل مدیریت — {SITE_NAME}</p>
              <p className="text-xs text-muted-foreground">
                کاربر: {user.name || user.phone} <Badge variant="secondary">مدیر</Badge>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">مشاهده سایت</Link>
            </Button>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                خروج
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="self-start rounded-xl border border-border bg-card p-2 lg:sticky lg:top-4">
          <AdminNav />
        </aside>
        <main className="min-w-0 space-y-5">{children}</main>
      </div>
    </div>
  );
}
