import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { floors, otpCodes, sessions, units, users } from '@/server/db/schema';
import { db } from '@/server/db';

export const metadata: Metadata = { title: 'پنل مدیریت — داشبورد' };

const countOf = async (query: PromiseLike<{ value: number }[]>) =>
  Number((await query)[0]?.value ?? 0);

const countUsers = () => countOf(db.select({ value: sql<number>`count(*)` }).from(users));
const countSessions = () => countOf(db.select({ value: sql<number>`count(*)` }).from(sessions));
const countFloors = () => countOf(db.select({ value: sql<number>`count(*)` }).from(floors));
const countUnits = () => countOf(db.select({ value: sql<number>`count(*)` }).from(units));
const countOtps = () => countOf(db.select({ value: sql<number>`count(*)` }).from(otpCodes));

export default async function AdminDashboard() {
  const [userCount, sessionCount, floorCount, unitCount, otpCount] = await Promise.all([
    countUsers(),
    countSessions(),
    countFloors(),
    countUnits(),
    countOtps(),
  ]);

  const stats = [
    { label: 'کاربران ثبت‌شده', value: userCount },
    { label: 'نشست‌های فعال', value: sessionCount },
    { label: 'طبقات مهمانسرا', value: floorCount },
    { label: 'واحدهای تعریف‌شده', value: unitCount },
    { label: 'کدهای پیامکی ثبت‌شده', value: otpCount },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-primary">داشبورد</h1>
        <Badge variant="secondary">مرحله ۱ — پوسته</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-xs font-normal text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="num-latin text-2xl font-bold text-jade-dark">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">وضعیت بخش‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            در این مرحله فقط پایگاه داده (کاربران،واحدها، طبقات)، ورود با پیامک و پوسته پنل ساخته شده
            است. سرفصل‌های منوی کناری — محتوا، واحدها و تعرفه، رزروها، نذورات، گزارش‌ها، پیشرفت ساخت و
            نقشه — در مراحل ۲ تا ۵ پر می‌شوند.
          </p>
          <p>
            واحد نمونه ادمین با شماره <span className="num-latin">09120000000</span> ساخته شده است؛ با
            همان شماره وارد شوید تا دسترسی پنل را آزمایش کنید.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
