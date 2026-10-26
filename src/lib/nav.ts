export const SITE_NAME = 'حیدریه نجف‌اشرف ابولحسن';

export const PUBLIC_NAV: { href: string; label: string; stage?: string }[] = [
  { href: '/', label: 'خانه' },
  { href: '/audio', label: 'صوت' },
  { href: '/gallery', label: 'تصویر' },
  { href: '/video', label: 'ویدئو' },
  { href: '/programs', label: 'برنامه‌ها' },
  { href: '/articles', label: 'مقالات' },
  { href: '/guesthouse', label: 'مهمانسرا', stage: '۳' },
  { href: '/construction', label: 'پیشرفت ساخت', stage: '۵' },
  { href: '/donations', label: 'نذورات', stage: '۳' },
];

export const ADMIN_NAV: { href: string; label: string; stage?: string }[] = [
  { href: '/admin', label: 'داشبورد' },
  { href: '/admin/users', label: 'کاربران' },
  { href: '/admin/content', label: 'محتوا' },
  { href: '/admin/units', label: 'واحدها و تعرفه', stage: '۳' },
  { href: '/admin/reservations', label: 'رزروها', stage: '۳' },
  { href: '/admin/donations', label: 'نذورات', stage: '۳' },
  { href: '/admin/reports', label: 'گزارش‌ها', stage: '۵' },
  { href: '/admin/construction', label: 'پیشرفت ساخت', stage: '۵' },
  { href: '/admin/map', label: 'نقشه', stage: '۴' },
];
