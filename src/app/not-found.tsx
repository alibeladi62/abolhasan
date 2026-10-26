import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-3xl text-primary">۴۰۴</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            صفحه‌ای که دنبال آن بودید پیدا نشد. ممکن است آدرس تغییر کرده یا هنوز ساخته نشده باشد.
          </p>
          <Button asChild>
            <Link href="/">بازگشت به خانه</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
