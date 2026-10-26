/**
 * تست سقف‌های امنیتی مرحله ۱ — روی سرور dev در حال اجرا (پورت ۳۲۱۰)
 * سقف IP (۱۰ درخواست/ساعت) در حافظه process نگه داشته می‌شود؛ این اسکریپت
 * بلافاصله بعد از بالا آمدن dev اجرا شود تا نتیجه معتبر بماند.
 * اجرا: node scripts/e2e-limits.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3210';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(tmpdir(), `abol-limits-${process.pid}`);
const PHONE = '09128888888';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: PROFILE,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

const db = new DatabaseSync(path.join('data', 'app.db'));
db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(PHONE);
db.close();

async function requestOtp() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#phone');
  await page.type('#phone', PHONE, { delay: 5 });
  await page.evaluate(() =>
    [...document.querySelectorAll('main form button[type=submit]')].find((b) => b.textContent.includes('دریافت کد')).click(),
  );
  await new Promise((r) => setTimeout(r, 2500));
  return page.evaluate(() => document.querySelector('main')?.innerText ?? '');
}

async function submitCode(value) {
  await page.evaluate(() => {
    const el = document.getElementById('code');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.type('#code', value, { delay: 5 });
  await page.evaluate(() =>
    [...document.querySelectorAll('main form button[type=submit]')].find((b) => b.textContent.trim() === 'ورود').click(),
  );
  await new Promise((r) => setTimeout(r, 2200));
  return page.evaluate(() => document.querySelector('main')?.innerText ?? '');
}

try {
  // ۱) سقف سه کد در ساعت برای هر شماره
  let text = '';
  for (let i = 1; i <= 4; i += 1) {
    text = await requestOtp();
    if (i < 4 && !text.includes('شبیه‌ساز پیامک')) {
      check(`درخواست ${i}ام کد پذیرفته شد`, false, text.slice(0, 120));
      break;
    }
  }
  check('سقف ۳ کد در ساعت برای یک شماره اعمال شد', text.includes('سه کد ارسال شده است'), text.split(String.fromCharCode(10)).pop());

  // ۲) تلاش با کد نادرست تا سقف ۵ بار
  // پیش از آن، یک کد تازه لازم است: رکوردهای قبلی را پاک می‌کنیم تا سقف ساعتی آزاد شود
  const db2 = new DatabaseSync(path.join('data', 'app.db'));
  db2.prepare('DELETE FROM otp_codes WHERE phone = ?').run(PHONE);
  db2.close();
  text = await requestOtp();
  if (!text.includes('شبیه‌ساز پیامک')) {
    check('کد تازه برای آزمایش تلاش ناموفق صادر شد', false, text.slice(0, 120));
  } else {
    let last = '';
    for (let i = 1; i <= 6; i += 1) last = await submitCode('000000');
    check('سقف ۵ تلاش نادرست بسته شد', last.includes('تعداد تلاش‌ها به سقف رسید'), last.split(String.fromCharCode(10)).pop());
  }

  // ۳) انقضای ۲ دقیقه‌ای
  const db3 = new DatabaseSync(path.join('data', 'app.db'));
  db3.prepare('DELETE FROM otp_codes WHERE phone = ?').run(PHONE);
  db3.close();
  await requestOtp();
  const db4 = new DatabaseSync(path.join('data', 'app.db'));
  db4.prepare('UPDATE otp_codes SET expires_at = ? WHERE phone = ?').run(Math.floor(Date.now() / 1000) - 60, PHONE);
  db4.close();
  const expired = await submitCode('123456');
  check('کد منقضی‌شده (بعد از ۲ دقیقه) رد شد', expired.includes('کد منقضی شده است'), expired.split(String.fromCharCode(10)).pop());

  // ۴) پاک‌سازی کاربر تستی
  const db5 = new DatabaseSync(path.join('data', 'app.db'));
  db5.prepare('DELETE FROM otp_codes WHERE phone = ?').run(PHONE);
  db5.prepare('DELETE FROM users WHERE phone = ?').run(PHONE);
  db5.close();
  check('داده‌های تست سقف‌ها پاک شد', true);
} finally {
  await browser.close();
  rmSync(PROFILE, { recursive: true, force: true });
}

console.log(`\nنتیجه: ${failures === 0 ? 'همه PASS' : `${failures} FAIL`}`);
process.exit(failures ? 1 : 0);
