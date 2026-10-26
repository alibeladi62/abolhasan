import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ComingSoon({
  title,
  stage,
  description,
  children,
}: {
  title: string;
  stage: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        <Badge variant="secondary">به‌زودی — مرحله {stage}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">این بخش در همین مرحله ساخته نشده است</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {description ?? (
            <p>
              محتوای این بخش در مراحل بعدی پرامپت افزوده می‌شود. در مرحله ۱ فقط اسکلت سایت، ورود با
              پیامک و پنل مدیریت (پوسته) پیاده شده است.
            </p>
          )}
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
