import type { Metadata } from 'next';
import { desc, like } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { normalizeMobile } from '@/lib/validate';
import { UserRoleSelect } from '@/components/user-role-select';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const metadata: Metadata = { title: 'پنل مدیریت — کاربران' };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q ? normalizeMobile(q) : '';
  const rows = await db
    .select()
    .from(users)
    .where(term ? like(users.phone, `%${term}%`) : undefined)
    .orderBy(desc(users.id));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-primary">کاربران</h1>
        <Badge variant="secondary">{rows.length} کاربر</Badge>
        {term ? <Badge variant="outline">جستجو: {term}</Badge> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">جستجو با شماره موبایل</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="q">شماره موبایل (کل یا بخشی از آن)</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q ?? ''}
                placeholder="0912"
                className="num-latin text-right"
                dir="ltr"
              />
            </div>
            <Button type="submit">جستجو</Button>
            {q ? (
              <Button variant="ghost" asChild>
                <a href="/admin/users">پاک‌کردن</a>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">فهرست کاربران و تغییر نقش</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              کاربری با این مشخصات پیدا نشد.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>نام</TableHead>
                  <TableHead>موبایل</TableHead>
                  <TableHead>شهر</TableHead>
                  <TableHead>پروفایل</TableHead>
                  <TableHead>عضویت</TableHead>
                  <TableHead>نقش</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="num-latin">{user.id}</TableCell>
                    <TableCell>{user.name || '—'}</TableCell>
                    <TableCell className="num-latin">{user.phone}</TableCell>
                    <TableCell>{user.city || '—'}</TableCell>
                    <TableCell>
                      {user.profileComplete === 1 ? (
                        <Badge className="bg-jade text-white">تکمیل</Badge>
                      ) : (
                        <Badge variant="outline" className="border-gold text-amber-800">
                          پروفایل ناقص
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="num-latin">{user.createdAt.slice(0, 10)}</TableCell>
                    <TableCell>
                      <UserRoleSelect userId={user.id} currentRole={user.role} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
