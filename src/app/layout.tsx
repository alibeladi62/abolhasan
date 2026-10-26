import type { Metadata } from 'next';
import './globals.css';

/** پایهٔ URL برای تگ‌های OG؛ در prod با NEXT_PUBLIC_BASE_URL ست می‌شود */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3210';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'هیئت حیدریه نجف‌اشرف ابولحسن',
    template: '%s | هیئت ابولحسن',
  },
  description:
    'وب‌سایت رسمی هیئت حیدریه نجف‌اشرف ابولحسن — آرشیو برنامه‌ها، مقالات مذهبی و قرآنی و مهمانسرای امام علی(ع).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
