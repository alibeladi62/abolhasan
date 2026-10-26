import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PUBLIC_NAV, SITE_NAME } from '@/lib/nav';
import { formatJalaliFromIso, jalaliLabelFromIso, todayJalali, formatJalaliLong, toPersianDigits } from '@/lib/jalali';
import { getCurrentUser } from '@/server/auth';
import { db } from '@/server/db';
import { units } from '@/server/db/schema';
import { fileUrl, getHomeContent, OCCASION_LABELS, PROGRAM_KIND_LABELS } from '@/server/content';
import { count } from 'drizzle-orm';

const LIVE_SECTIONS = new Set(['/audio', '/gallery', '/video', '/programs', '/articles']);

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const today = todayJalali();
  const [unitCountRow, content] = await Promise.all([
    db.select({ value: count() }).from(units),
    getHomeContent(),
  ]);

  const sections = PUBLIC_NAV.filter((item) => item.href !== '/' && item.href !== '/construction');

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-primary px-6 py-8 text-primary-foreground md:px-10 md:py-10">
        <p className="text-sm opacity-90">بسم الله الرحمن الرحیم</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">{SITE_NAME}</h1>
        <p className="mt-3 max-w-2xl text-sm opacity-95 md:text-base">
          آرشیو برنامه‌های حیدریه، مقالات قرآنی و مهمانسرای امام علی(ع) برای پذیرایی از زائران.
        </p>
        <p className="mt-4 text-sm opacity-90">
          امروز: {formatJalaliLong(today.jy, today.jm, today.jd)}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((item) => (
          <Card key={item.href} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <Link href={item.href} className="text-primary hover:underline">
                  {item.label}
                </Link>
                {LIVE_SECTIONS.has(item.href) ? null : <Badge variant="secondary">مرحله {item.stage}</Badge>}
              </CardTitle>
              <CardDescription>
                {item.href === '/audio'
                  ? `مداحی‌ها و سخنرانی‌ها با فیلتر روضه‌خوان و مناسبت`
                  : item.href === '/gallery'
                    ? `آلبوم برنامه‌ها و آلبوم اشخاص`
                    : item.href === '/video'
                      ? 'پخش داخلی ویدئوهای برنامه‌ها'
                      : item.href === '/programs'
                        ? 'تقویم برنامه‌های پیش‌رو و برگزارشده'
                        : item.href === '/articles'
                          ? 'نوشته‌های مذهبی و قرآنی'
                          : 'این بخش در مرحله‌های بعد فعال می‌شود.'}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">تازه‌ترین مقاله‌ها</CardTitle>
            <Link href="/articles" className="text-sm text-primary hover:underline">
              همه مقالات
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.latestArticles.length ? (
              content.latestArticles.map((article) => (
                <article key={article.id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  {article.asset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fileUrl(article.asset) ?? ''}
                      alt={article.title}
                      loading="lazy"
                      className="size-20 shrink-0 rounded-md object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 space-y-1">
                    <Link href={`/articles/${article.slug}`} className="block text-sm font-bold hover:text-primary">
                      {article.title}
                    </Link>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{article.plainExcerpt}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {article.category ? `${article.category.name} · ` : ''}
                      <span className="num-latin">{jalaliLabelFromIso(article.publishedAt) ?? '—'}</span>
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">هنوز مقاله‌ای منتشر نشده است.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">آخرین صوت‌ها</CardTitle>
            <Link href="/audio" className="text-sm text-primary hover:underline">
              آرشیو
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {content.latestAudios.length ? (
              content.latestAudios.map((audio) => (
                <div key={audio.id} className="rounded-md border border-border px-3 py-2">
                  <p className="truncate text-sm font-bold">{audio.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {audio.narrator ?? audio.performer ?? '—'} · {OCCASION_LABELS[audio.occasion]}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">هنوز فایلی منتشر نشده است.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">برنامه‌های پیش‌رو</CardTitle>
            <Link href="/programs" className="text-sm text-primary hover:underline">
              تقویم کامل
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {content.upcomingPrograms.length ? (
              content.upcomingPrograms.map((program) => (
                <div key={program.id} className="rounded-md border border-border p-3">
                  <p className="text-sm font-bold leading-6">{program.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatJalaliFromIso(program.dateJalali)}
                    {program.startTime ? ` · ${toPersianDigits(program.startTime)}` : ''}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {PROGRAM_KIND_LABELS[program.kind] ?? program.kind}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">برنامه‌ی پیش‌رویی ثبت نشده است.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-1 py-4">
              <CardTitle className="text-base">آلبوم افراد قدیمی و مرحوم</CardTitle>
              <p className="text-xs text-muted-foreground">
                {toPersianDigits(content.deceasedCount)} شخص متوفی با معرفی‌نامه و {toPersianDigits(content.albumCount)}{' '}
                آلبوم تصویری.
              </p>
              <Link href="/gallery/persons" className="inline-block pt-1 text-sm font-bold text-primary hover:underline">
                مشاهده آلبوم اشخاص
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 py-4">
              <CardTitle className="text-base">پیشرفت ساخت زائرسرا</CardTitle>
              <p className="text-xs text-muted-foreground">
                تایم‌لاین درصد پیشرفت فازها در مرحله ۵ ساخته می‌شود؛ لینک زیر فعلاً صفحه اطلاع‌رسانی است.
              </p>
              <Link
                href="/construction"
                className="inline-flex items-center gap-1 pt-1 text-sm font-bold text-primary hover:underline"
              >
                صفحه پیشرفت ساخت
                <Badge variant="secondary">مرحله ۵</Badge>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">وضعیت فعلی سایت (مرحله ۲ از ۵)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            پنج بخش عمومی محتوا (صوت، تصویر و اشخاص، ویدئو، برنامه‌ها، مقالات) با پنل مدیریت و داده نمونه
            فعال شده است.{' '}
            {user ? (
              <>
                در حال حاضر با حساب <b className="text-foreground">{user.name || user.phone}</b> وارد شده‌اید.
              </>
            ) : (
              <Link href="/login" className="text-primary underline">
                برای ورود یا ساخت محتوا از پنل اینجا کلیک کنید
              </Link>
            )}
          </p>
          <p>
            تعداد واحدهای ثبت‌شده در دیتابیس:{' '}
            <b className="text-foreground">{toPersianDigits(unitCountRow[0].value)}</b> (پلیگون‌های Plan.html برای
            نقشه مرحله ۴ ذخیره شده‌اند).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
