import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCompletionOpener } from '@/components/profile-completion-opener';
import { Separator } from '@/components/ui/separator';
import { formatJalaliLong, parseJalaliISO } from '@/lib/jalali';
import { maskMobile, maskNationalId } from '@/lib/validate';
import { logoutAction } from '@/server/actions';
import { getCurrentUser } from '@/server/auth';

export const metadata: Metadata = { title: 'پروفایل من' };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const birth = user.birthDateJalali ? parseJalaliISO(user.birthDateJalali) : null;
  const completedAt = user.createdAt.slice(0, 10);

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>پروفایل من</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="نام و نام خانوادگی" value={user.name || '—'} />
            <Field label="شماره موبایل" value={maskMobile(user.phone)} latin />
            <Field label="کد ملی" value={user.nationalId ? maskNationalId(user.nationalId) : '—'} latin />
            <Field label="شهر" value={user.city || '—'} />
            <Field
              label="تاریخ تولد (شمسی)"
              value={birth ? formatJalaliLong(birth.jy, birth.jm, birth.jd) : '—'}
            />
            <Field label="تاریخ عضویت" value={completedAt} latin />
          </dl>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">وضعیت پروفایل:</span>
            {user.profileComplete === 1 ? (
              <Badge className="bg-jade text-white">تکمیل‌شده</Badge>
            ) : (
              <>
                <Badge variant="outline" className="border-gold text-amber-800">
                  ناقص
                </Badge>
                <ProfileCompletionOpener />
              </>
            )}
            {user.role === 'admin' ? <Badge variant="secondary">مدیر هیئت</Badge> : null}
            {user.role === 'operator' ? <Badge variant="secondary">اپراتور</Badge> : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>رزروهای من</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              بخش رزرو مهمانسرا در مرحله ۳ فعال می‌شود؛ پس از آن، فهرست رزروها و فاکتورهای شما همین‌جا
              نمایش داده می‌شود.
            </p>
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              هنوز رزروی ثبت نشده است
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>خروج از حساب</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {user.role === 'admin' ? (
              <Button variant="outline" asChild>
                <a href="/admin">پنل مدیریت</a>
              </Button>
            ) : null}
            <form action={logoutAction}>
              <Button type="submit" variant="destructive">
                خروج
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, latin }: { label: string; value: string; latin?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={latin ? 'num-latin mt-1 font-medium' : 'mt-1 font-medium'}>{value}</dd>
    </div>
  );
}
