import type { Metadata } from 'next';
import { CalendarDays, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { listProgramsGrouped, PROGRAM_KIND_LABELS, todayIso } from '@/server/content';
import { formatJalaliFromIso, jalaliToGregorian, parseJalaliISO, toPersianDigits } from '@/lib/jalali';

export const metadata: Metadata = {
  title: 'برنامه‌های جاری هیئت',
  description: 'تقویم برنامه‌های هفتگی و مناسبتی هیئت حیدریه نجف‌اشرف ابولحسن.',
  openGraph: {
    title: 'برنامه‌های جاری هیئت ابولحسن',
    description: 'برنامه‌های پیش‌رو و برگزارشده، به همراه زمان و مکان هر مراسم.',
    type: 'website',
    url: '/programs',
    locale: 'fa_IR',
  },
};

/** «سه‌شنبه ۵ آبان ۱۴۰۵» — روز هفته از تقویم میلادی گرفته می‌شود */
function longLabel(iso: string) {
  const parsed = parseJalaliISO(iso);
  if (!parsed) return iso;
  const g = jalaliToGregorian(parsed.jy, parsed.jm, parsed.jd);
  const weekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(
    new Date(Date.UTC(g.gy, g.gm - 1, g.gd)),
  );
  return `${weekday} ${formatJalaliFromIso(iso) ?? ''}`.trim();
}

function ProgramCard({ program }: { program: Awaited<ReturnType<typeof listProgramsGrouped>>['upcoming'][number] }) {
  return (
    <Card className={program.isCancelled ? 'border-dashed opacity-75' : 'transition hover:shadow-sm'}>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-foreground">{program.title}</p>
          <Badge variant={program.isCancelled ? 'destructive' : 'secondary'}>
            {program.isCancelled ? 'لغوشده' : PROGRAM_KIND_LABELS[program.kind] ?? program.kind}
          </Badge>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {longLabel(program.dateJalali)}
          {program.startTime ? (
            <>
              {' · '}
              <span className="num-latin">{toPersianDigits(program.startTime)}</span>
            </>
          ) : null}
        </p>
        {program.place ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {program.place}
          </p>
        ) : null}
        {program.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground/90">{program.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const { upcoming, past } = await listProgramsGrouped();

  return (
    <div className="space-y-5">
      <PageHeader
        title="برنامه‌های جاری"
        description={`تفکیک بر اساس امروز شمسی (${longLabel(todayIso())}).`}
        badge={{
          label: `${toPersianDigits(upcoming.length)} پیش‌رو · ${toPersianDigits(past.length)} برگزارشده`,
          tone: 'secondary',
        }}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="border-inline-start-4 border-s-4 border-primary ps-3 text-lg font-bold text-primary">
            پیش‌رو
          </h2>
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.map((program) => (
                <li key={program.id}>
                  <ProgramCard program={program} />
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                برنامه‌ی پیش‌رویی ثبت نشده است.
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="border-s-4 border-s-border ps-3 text-lg font-bold text-muted-foreground">برگزارشده</h2>
          {past.length ? (
            <ul className="space-y-3">
              {past.map((program) => (
                <li key={program.id}>
                  <ProgramCard program={program} />
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                هنوز برنامه‌ای برگزار نشده است.
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
