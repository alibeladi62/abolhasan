import { toLatinDigits } from './jalali';

/** ^09\d{9}$ — با پذیرش ورودی‌های رایج (+98، 0098، اعداد فارسی) */
export function normalizeMobile(raw: string) {
  let v = toLatinDigits((raw ?? '').trim()).replace(/[\s()-]/g, '');
  if (v.startsWith('+98')) v = '0' + v.slice(3);
  else if (v.startsWith('0098')) v = '0' + v.slice(4);
  else if (/^98\d{9}$/.test(v)) v = '0' + v.slice(2);
  else if (/^9\d{9}$/.test(v)) v = '0' + v;
  return v;
}

export function isValidMobile(raw: string) {
  return /^09\d{9}$/.test(normalizeMobile(raw));
}

/** ماسک نمایشی: 0912***678 */
export function maskMobile(mobile: string) {
  if (mobile.length < 11) return mobile;
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}

/** کد ملی ایران با checksum */
export function isValidNationalId(raw: string) {
  const v = toLatinDigits((raw ?? '').trim()).replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(v)) return false;
  if (/^(\d)\1{9}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(v[i]) * (10 - i);
  const check = Number(v[9]);
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

export function maskNationalId(nationalId: string) {
  if (!nationalId || nationalId.length < 10) return nationalId ?? '';
  return `${nationalId.slice(0, 4)}***${nationalId.slice(-3)}`;
}

export function isNonEmptyString(value: unknown, min = 1) {
  return typeof value === 'string' && value.trim().length >= min;
}
