import { toLatinDigits } from './jalali';

/**
 * slug فارسی ساده: یکسان‌سازی حروف عربی/فارسی، اعداد لاتین، جداکننده خط تیره.
 * بدون پکیج ترانویس — slug همان خوانایی فارسی را در آدرس نگه می‌دارد.
 */

const LETTERS = /[؀-ۿa-z0-9-]/;

export function slugify(raw: string): string {
  let v = toLatinDigits((raw ?? '').trim().toLowerCase());
  v = v
    .replace(/\u200c/g, ' ') // نیم‌فاصله
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[\u064B-\u0652]/g, '') // اعراب
    .replace(/[\u0670]/g, '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, ''); // نشانه‌های جهت

  let out = '';
  let pendingDash = false;
  for (const ch of v) {
    if (LETTERS.test(ch) && ch !== '-') {
      out += pendingDash && out ? '-' : '';
      pendingDash = false;
      out += ch;
    } else {
      pendingDash = out.length > 0;
    }
  }
  out = out.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  return out || 'bedoon-slug';
}

/** «سلام-۱» + وجود «سلام-۱» در DB → «سلام-۱-۲» — collision با پسوند عددی حل می‌شود */
export function nextSlugFromCollision(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
