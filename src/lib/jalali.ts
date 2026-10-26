/**
 * تقویم جلالی — بدون پکیج اضافه.
 * ساختار سال: جدول BREAKS (چرخه ۲۸۲۰ ساله، همان الگوریتم jalaali-js/MIT) برای کبیسه‌گیری،
 * و لنگر ۱۴۰۵-۰۱-۰۱ = ۲۰۲۶-۰۳-۲۱ (نوروز) برای هم‌ترازی با تقویم رسمی ایران.
 * تبدیل میلادی↔شمارش روز: الگوریتم civil از Hinnant (دقیق، بدون سرریز).
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 683, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2194,
  2456, 3178,
];

const SUPPORTED_FROM = 1300;
const SUPPORTED_TO = 1500;

/** نوروز ۱۴۰۵ */
const ANCHOR_JY = 1405;
const ANCHOR_DAY = daysFromCivil(2026, 3, 21);

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const JALALI_WEEK_DAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

function fdiv(a: number, b: number) {
  return Math.floor(a / b);
}

function fmod(a: number, b: number) {
  return a - Math.floor(a / b) * b;
}

/** روزِ تقویم میلادی (y/m/d) → تعداد روز از ۱۹۷۰-۰۱-۰۱ */
function daysFromCivil(y: number, m: number, d: number) {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = fdiv(yy, 400);
  const yoe = yy - era * 400;
  const doy = fdiv(153 * (m + (m > 2 ? -3 : 9)) + 2, 5) + d - 1;
  const doe = yoe * 365 + fdiv(yoe, 4) - fdiv(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
}

/** تعداد روز از ۱۹۷۰-۰۱-۰۱ → میلادی */
function civilFromDays(z: number) {
  const zz = z + 719468;
  const era = fdiv(zz, 146097);
  const doe = zz - era * 146097;
  const yoe = fdiv(doe - fdiv(doe, 1460) + fdiv(doe, 36524) - fdiv(doe, 146096), 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + fdiv(yoe, 4) - fdiv(yoe, 100));
  const mp = fdiv(5 * doy + 2, 153);
  const gd = doy - fdiv(153 * mp + 2, 5) + 1;
  const gm = mp + (mp < 10 ? 3 : -9);
  return { gy: y + (gm <= 2 ? 1 : 0), gm, gd };
}

/** آیا سال jy جلالی کبیسه است (۳۶۶ روز)؟ */
function jalCalLeap(jy: number) {
  const bl = BREAKS.length;
  if (jy < BREAKS[0] || jy >= BREAKS[bl - 1]) {
    throw new Error(`سال جلالی پشتیبانی نمی‌شود: ${jy}`);
  }
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + fdiv(jump, 33) * 8 + fdiv(fmod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + fdiv(n, 33) * 8 + fdiv(fmod(n, 33) + 3, 4);
  if (fmod(jump, 33) === 4 && jump - n === 6) leapJ += 1;
  const leapG = fdiv(gy, 4) - fdiv((fdiv(gy, 100) + 1) * 3, 4) - 150;
  if (jump - n < 6) n = n - jump + fdiv(jump + 4, 33) * 33;
  let leap = fmod(fmod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return leap === 0;
}

const leapCache = new Map<number, boolean>();
export function isJalaliLeap(jy: number) {
  const cached = leapCache.get(jy);
  if (cached !== undefined) return cached;
  const value = jalCalLeap(jy);
  leapCache.set(jy, value);
  return value;
}

/** روزِ اولین روز هر سال (فروردین ۱) — از لنگر به دو جهت ساخته می‌شود */
const farvardin1Cache = new Map<number, number>([[ANCHOR_JY, ANCHOR_DAY]]);

function farvardin1(jy: number) {
  const known = farvardin1Cache.get(jy);
  if (known !== undefined) return known;
  if (jy < SUPPORTED_FROM || jy > SUPPORTED_TO) {
    throw new Error(`سال جلالی خارج از بازه پشتیبانی: ${jy}`);
  }
  const lengthOf = (y: number) => (isJalaliLeap(y) ? 366 : 365);
  let day = ANCHOR_DAY;
  if (jy > ANCHOR_JY) {
    for (let y = ANCHOR_JY; y < jy; y += 1) day += lengthOf(y);
  } else {
    for (let y = jy; y < ANCHOR_JY; y += 1) day -= lengthOf(y);
  }
  farvardin1Cache.set(jy, day);
  return day;
}

function jalaliToDays(jy: number, jm: number, jd: number) {
  const monthOffset = jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30;
  return farvardin1(jy) + monthOffset + jd - 1;
}

function daysToJalali(day: number) {
  let jy = SUPPORTED_FROM;
  const deltaApprox = day - ANCHOR_DAY;
  jy = ANCHOR_JY + fdiv(deltaApprox, 365.2495);
  while (farvardin1(jy) > day) jy -= 1;
  while (farvardin1(jy + 1) <= day) jy += 1;
  let k = day - farvardin1(jy);
  if (k < 186) return { jy, jm: fdiv(k, 31) + 1, jd: fmod(k, 31) + 1 };
  k -= 186;
  if (k < 180) return { jy, jm: 7 + fdiv(k, 30), jd: fmod(k, 30) + 1 };
  return { jy, jm: 12, jd: k - 180 + 1 };
}

export type JalaliDate = { jy: number; jm: number; jd: number };
export type GregorianDate = { gy: number; gm: number; gd: number };

export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return civilFromDays(jalaliToDays(jy, jm, jd));
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  return daysToJalali(daysFromCivil(gy, gm, gd));
}

export function dateToJalali(date: Date): JalaliDate {
  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayJalali(): JalaliDate {
  return dateToJalali(new Date());
}

export function jalaliDaysInMonth(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

export function isJalaliDateValid(jy: number, jm: number, jd: number) {
  return (
    Number.isInteger(jy) &&
    Number.isInteger(jm) &&
    Number.isInteger(jd) &&
    jy >= SUPPORTED_FROM &&
    jy <= SUPPORTED_TO &&
    jm >= 1 &&
    jm <= 12 &&
    jd >= 1 &&
    jd <= jalaliDaysInMonth(jy, jm)
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "1405-08-02" */
export function formatJalaliISO(jy: number, jm: number, jd: number) {
  return `${jy}-${pad(jm)}-${pad(jd)}`;
}

/** "۲ آبان ۱۴۰۵" */
export function formatJalaliLong(jy: number, jm: number, jd: number) {
  return `${toPersianDigits(String(jd))} ${JALALI_MONTH_NAMES[jm - 1]} ${toPersianDigits(String(jy))}`;
}

/** رشته "1405-08-02" را به اجزای عددی تبدیل می‌کند؛ در نامعتبر مقدار null */
export function parseJalaliISO(value: string): JalaliDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  return isJalaliDateValid(jy, jm, jd) ? { jy, jm, jd } : null;
}

/** رشته "1405-08-05" (شمسی) → «۵ آبان ۱۴۰۵»؛ در نامعتبر null */
export function formatJalaliFromIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseJalaliISO(value);
  return parsed ? formatJalaliLong(parsed.jy, parsed.jm, parsed.jd) : null;
}

/** "1405-08-05" (شمسی) → "2026-10-27" (میلادی)؛ در نامعتبر null */
export function jalaliToGregorianIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseJalaliISO(toLatinDigits(value.trim()));
  if (!parsed) return null;
  const g = jalaliToGregorian(parsed.jy, parsed.jm, parsed.jd);
  return `${String(g.gy).padStart(4, '0')}-${pad(g.gm)}-${pad(g.gd)}`;
}

/**
 * رشته تاریخ میلادی (SQLite `datetime('now')` یا ISO) → برچسب شمسی «۳ آبان ۱۴۰۵».
 * در نامعتبر مقدار null برمی‌گرداند تا UI مجبور به حدس زدن نشود.
 */
export function jalaliLabelFromIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const jalali = gregorianToJalali(jy, jm, jd);
  return formatJalaliLong(jalali.jy, jalali.jm, jalali.jd);
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export function toPersianDigits(input: string | number) {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toLatinDigits(input: string) {
  return input.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}
