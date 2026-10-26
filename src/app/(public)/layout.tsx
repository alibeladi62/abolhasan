import { ProfileCompletionDialog } from '@/components/profile-completion-dialog';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { AudioPlayerProvider } from '@/components/audio-player';
import { getCurrentUser } from '@/server/auth';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <AudioPlayerProvider>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader user={user} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {/* فضای پایین صفحه برای پلیکن چسبان صوت */}
          <div className="pb-16">{children}</div>
        </main>
        <SiteFooter />
        {user && user.profileComplete === 0 ? (
          <ProfileCompletionDialog
            defaultName={user.name ?? ''}
            defaultNationalId={user.nationalId ?? ''}
            defaultCity={user.city ?? ''}
            defaultBirth={user.birthDateJalali ?? ''}
          />
        ) : null}
      </div>
    </AudioPlayerProvider>
  );
}
