import { createHash, randomInt } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from './db';
import { otpCodes } from './db/schema';
import { sendSms } from './sms';

const CODE_TTL_SECONDS = 120; // ۲ دقیقه
const MAX_ATTEMPTS = 5;
const MAX_PER_PHONE_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 10;

const PEPPER = process.env.OTP_SECRET ?? 'dev-only-otp-pepper';

const hashCode = (code: string) => createHash('sha256').update(`${PEPPER}:${code}`).digest('hex');
const nowEpoch = () => Math.floor(Date.now() / 1000);

/** سقف درخواست به‌ازای IP — در dev در حافظه؛ در prod به کش منتقل می‌شود */
const ipHits = new Map<string, number[]>();

function checkIpLimit(ip: string | null) {
  if (!ip) return true;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > nowEpoch() - 3600);
  if (hits.length >= MAX_PER_IP_PER_HOUR) return false;
  hits.push(nowEpoch());
  ipHits.set(ip, hits);
  return true;
}

export type IssueResult =
  | { ok: true; simulatorCode?: string }
  | { ok: false; error: string };

export async function issueOtp(phone: string, ip: string | null): Promise<IssueResult> {
  if (!checkIpLimit(ip)) {
    return { ok: false, error: 'درخواست‌ها از این IP زیاد شده است؛ کمی بعد دوباره تلاش کنید.' };
  }

  // شمارش کدهای صادرشده در یک ساعت گذشته (بر پایه expires_at عددی؛ ساده و بدون وابستگی به قالب تاریخ)
  const recent = await db
    .select({ id: otpCodes.id })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.expiresAt, nowEpoch() - 3600)));
  if (recent.length >= MAX_PER_PHONE_PER_HOUR) {
    return { ok: false, error: 'برای این شماره در یک ساعت گذشته سه کد ارسال شده است.' };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.insert(otpCodes).values({
    phone,
    codeHash: hashCode(code),
    expiresAt: nowEpoch() + CODE_TTL_SECONDS,
    attempts: 0,
  });

  const sent = await sendSms(
    phone,
    `کد ورود به سایت هیئت ابولحسن: ${code} — تا ۲ دقیقه معتبر است.`,
  );
  if (!sent.ok) return { ok: false, error: 'ارسال پیامک ناموفق بود؛ دوباره تلاش کنید.' };

  return sent.provider === 'log' ? { ok: true, simulatorCode: code } : { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyOtp(phone: string, inputCode: string): Promise<VerifyResult> {
  const code = String(inputCode ?? '').trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'کد باید ۶ رقمی باشد.' };

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.id))
    .limit(1);

  if (!row) return { ok: false, error: 'کد فعالی برای این شماره نیست. دوباره کد بگیرید.' };
  if (row.expiresAt < nowEpoch()) return { ok: false, error: 'کد منقضی شده است؛ کد جدید بگیرید.' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'تعداد تلاش‌ها به سقف رسید؛ کد جدید بگیرید.' };

  if (row.codeHash !== hashCode(code)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id));
    return { ok: false, error: 'کد وارد شده صحیح نیست.' };
  }

  await db.update(otpCodes).set({ consumedAt: nowEpoch() }).where(eq(otpCodes.id, row.id));
  return { ok: true };
}
