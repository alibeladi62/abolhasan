/**
 * Adapter پیامک. در این مرحله هیچ سرویس پولی نصب/خریداری نمی‌شود؛
 * حالت پیش‌فرض `log` است (شبیه‌ساز dev). برای کاوه‌گار/ملی‌پیامک فقط همین فایل تغییر می‌کند.
 */
export type SmsMode = 'log' | 'kaveh' | 'meli';

const mode = (process.env.SMS_MODE ?? 'log') as SmsMode;

export const isSmsSimulator = mode === 'log';

export async function sendSms(phone: string, text: string) {
  if (mode === 'log') {
    console.log(`[sms:simulator] to=${phone} text=${text}`);
    return { ok: true as const, provider: 'log' as SmsMode };
  }

  // مراحل بعد: با کلیدهای واقعی از env پر می‌شود و خرید سرویس نیازمند تأیید کارفرماست.
  const endpoint = process.env.SMS_ENDPOINT;
  const key = process.env.SMS_KEY;
  if (!endpoint || !key) {
    throw new Error('SMS_ENDPOINT/SMS_KEY تنظیم نشده است. در dev از حالت log استفاده کنید.');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ to: phone, text }),
  });
  if (!response.ok) {
    console.error(`[sms:${mode}] failed status=${response.status}`);
    return { ok: false as const, provider: mode };
  }
  return { ok: true as const, provider: mode };
}
