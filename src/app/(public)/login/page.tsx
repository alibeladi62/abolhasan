import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getCurrentUser } from '@/server/auth';
import { isSmsSimulator } from '@/server/sms';

export const metadata: Metadata = { title: 'ورود' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ logged_out?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/profile');

  const { logged_out } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-3">
        {logged_out === '1' ? (
          <p className="rounded-lg border border-jade/30 bg-secondary px-3 py-2 text-center text-sm text-secondary-foreground">
            از حساب خود خارج شدید. برای ورود مجدد شماره موبایل را وارد کنید.
          </p>
        ) : null}
        <LoginForm simulatorEnabled={isSmsSimulator} />
      </div>
    </main>
  );
}
