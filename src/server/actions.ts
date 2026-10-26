'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';
import { issueOtp, verifyOtp } from './otp';
import {
  SESSION_COOKIE,
  endSession,
  findOrCreateUserByPhone,
  getCurrentUser,
  setSessionCookie,
  startSession,
} from './auth';
import { isValidMobile, isValidNationalId, normalizeMobile } from '@/lib/validate';
import { isJalaliDateValid, parseJalaliISO, toLatinDigits } from '@/lib/jalali';

async function clientIp() {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return (forwarded?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || null;
}

export type ActionState = { ok: boolean; error?: string; info?: string; code?: string };

export async function requestOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const phone = normalizeMobile(String(formData.get('phone') ?? ''));
  if (!isValidMobile(phone)) {
    return { ok: false, error: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.' };
  }
  const result = await issueOtp(phone, await clientIp());
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    info: 'کد پیامک شد. تا ۲ دقیقه وقت دارید.',
    code: result.simulatorCode,
  };
}

export async function verifyOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const phone = normalizeMobile(String(formData.get('phone') ?? ''));
  const code = toLatinDigits(String(formData.get('code') ?? ''));
  if (!isValidMobile(phone)) return { ok: false, error: 'شماره موبایل نامعتبر است.' };

  const result = await verifyOtp(phone, code);
  if (!result.ok) return { ok: false, error: result.error };

  const user = await findOrCreateUserByPhone(phone);
  const token = await startSession(user.id);
  await setSessionCookie(token);
  revalidatePath('/', 'layout');
  return { ok: true, info: 'خوش آمدید.' };
}

export async function logoutAction() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await endSession(token);
  redirect('/login?logged_out=1');
}

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'برای تکمیل پروفایل باید وارد شوید.' };

  const name = String(formData.get('name') ?? '').trim();
  const nationalId = toLatinDigits(String(formData.get('national_id') ?? '')).trim();
  const city = String(formData.get('city') ?? '').trim();
  const birth = String(formData.get('birth_date_jalali') ?? '');

  if (name.length < 2) return { ok: false, error: 'نام را کامل وارد کنید.' };
  if (!isValidNationalId(nationalId)) return { ok: false, error: 'کد ملی معتبر نیست (۱۰ رقم با کنترل رقم صحیح).' };
  if (city.length < 2) return { ok: false, error: 'شهر را وارد کنید.' };
  const parsed = parseJalaliISO(birth);
  if (!parsed || !isJalaliDateValid(parsed.jy, parsed.jm, parsed.jd)) {
    return { ok: false, error: 'تاریخ تولد شمسی معتبر نیست.' };
  }

  await db
    .update(users)
    .set({
      name,
      nationalId,
      city,
      birthDateJalali: birth,
      profileComplete: 1,
    })
    .where(eq(users.id, user.id));

  revalidatePath('/', 'layout');
  return { ok: true, info: 'پروفایل شما تکمیل شد.' };
}

export async function updateUserRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (actor?.role !== 'admin') return { ok: false, error: 'فقط مدیر می‌تواند نقش را تغییر دهد.' };

  const userId = Number(formData.get('user_id'));
  const role = String(formData.get('role'));
  if (!Number.isInteger(userId) || !['member', 'operator', 'admin'].includes(role)) {
    return { ok: false, error: 'داده نامعتبر است.' };
  }
  if (userId === actor.id && role !== 'admin') {
    return { ok: false, error: 'نقش خودتان را نمی‌توانید کاهش دهید.' };
  }

  await db.update(users).set({ role: role as 'member' | 'operator' | 'admin' }).where(eq(users.id, userId));
  revalidatePath('/admin/users');
  return { ok: true };
}
