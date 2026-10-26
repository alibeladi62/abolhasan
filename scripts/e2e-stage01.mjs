/**
 * تست پایانی مرحله ۱ — مرورگر واقعی (Chrome) روی پورت ۳۲۱۰
 * اجرا: node scripts/e2e-stage01.mjs   (نرم‌افزار `npm run dev` باید بالا باشد)
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import puppeteer from 'puppeteer-core';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3210';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ASSETS = path.join('reports', 'assets');
const PROFILE = path.join(tmpdir(), `abolhasan-e2e-${process.pid}`);

mkdirSync(ASSETS, { recursive: true });

const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

/** کد ملی معتبر ( checksum ) از ۹ رقم پایه */
function nationalId(base9) {
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(base9[i]) * (10 - i);
  const rem = sum % 11;
  const checkDigit = rem < 2 ? rem : 11 - rem;
  return base9 + String(checkDigit);
}

const consoleErrors = [];

function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const url = res.url();
      if (!/\/nazardanideh/.test(url)) consoleErrors.push(`[${label}] http ${res.status()} ${url}`);
    }
  });
}

async function clickButtonByText(page, text, scope = 'body') {
  const handle = await page.evaluateHandle(
    ({ needle, root }) => {
      const buttons = [...document.querySelectorAll(`${root} button, ${root} a`)];
      return buttons.find((el) => (el.textContent || '').includes(needle)) ?? null;
    },
    { needle: text, root: scope },
  );
  const element = handle.asElement();
  if (!element) throw new Error(`دکمه با متن «${text}» در ${scope} پیدا نشد`);
  await element.click();
  return element;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openBrowser(headless = true) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless,
    userDataDir: PROFILE,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 },
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

async function shot(page, file) {
  await page.screenshot({ path: path.join(ASSETS, file), fullPage: false });
}

/** ورود با پیامک شبیه‌ساز: شماره را می‌دهد، کد را از صفحه می‌خواند و وارد می‌شود */
async function loginWithOtp(page, phone) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#phone');
  await page.click('#phone');
  await page.type('#phone', phone, { delay: 8 });
  await clickButtonByText(page, 'دریافت کد پیامکی', 'main');
  await page.waitForSelector('#code', { timeout: 15000 });
  // کد را از باکس شبیه‌ساز می‌خوانیم (نه از نمایش شماره)
  const code = await page.$eval('div.border-dashed .num-latin', (el) => el.textContent.trim());
  await page.evaluate(() => {
    const el = document.getElementById('code');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#code');
  await page.type('#code', code, { delay: 8 });
  await clickButtonByText(page, 'ورود', 'main form');
  try {
    await page.waitForFunction(() => location.pathname !== '/login', { timeout: 15000 });
  } catch (err) {
    const text = await page.evaluate(() => document.body.innerText);
    throw new Error(`ورود با ${phone} / ${code} ناموفق بود — صفحه:
${text}`);
  }
  return code;
}

async function main() {
  // حالت اولیه‌ی قابل تکرار: کاربر نمونه دوباره «ناقص» می‌شود
  const reset = new DatabaseSync(path.join('data', 'app.db'));
  reset
    .prepare("UPDATE users SET name = NULL, national_id = NULL, city = NULL, birth_date_jalali = NULL, profile_complete = 0, role = 'member' WHERE phone = '09121111111'")
    .run();
  reset
    .prepare(
      "UPDATE users SET name = NULL, national_id = NULL, city = NULL, birth_date_jalali = NULL, profile_complete = 0, role = 'member' WHERE phone = '09129999999'",
    )
    .run();
  reset.prepare("DELETE FROM otp_codes WHERE phone IN ('09121111111','09120000000','09129999999')").run();
  reset.close();

  let browser = await openBrowser();
  try {
    const page = await browser.newPage();
    watch(page, 'desktop');

    // ۱) خانه: RTL، فونت وزیرمتن، منوی ۱۰ بخشه
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
    const html = await page.$eval('html', (el) => ({ dir: el.dir, lang: el.lang }));
    check('html dir=rtl و lang=fa', html.dir === 'rtl' && html.lang === 'fa', JSON.stringify(html));

    const fontInfo = await page.evaluate(() => ({
      family: getComputedStyle(document.body).fontFamily,
      vazirmatn: document.fonts.check('16px Vazirmatn'),
      loaded: [...document.fonts].some((f) => f.family.includes('Vazirmatn') && f.status === 'loaded'),
    }));
    check('فونت وزیرمتن از فایل محلی بارگذاری شد', fontInfo.vazirmatn && fontInfo.loaded, JSON.stringify(fontInfo));
    check('وزیرمتن اولین فونت body است', /Vazirmatn/.test(fontInfo.family), fontInfo.family);

    const menu = await page.$$eval('header a', (links) =>
      links.map((a) => (a.textContent || '').trim()).filter(Boolean));
    const needed = ['خانه', 'صوت', 'تصویر', 'ویدئو', 'برنامه‌ها', 'مقالات', 'مهمانسرا', 'پیشرفت ساخت', 'نذورات', 'ورود'];
    const missing = needed.filter((label) => !menu.some((text) => text.includes(label)));
    check('منوی ۱۰ بخشه در هدر', missing.length === 0, `کمبود: ${missing.join(',') || '—'} | ${menu.length} لینک`);
    await shot(page, '01-home.png');

    // ۲) صفحه ورود بدون خطای کنسول + OTP شبیه‌ساز
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#phone');
    await shot(page, '02-login.png');

    const code = await loginWithOtp(page, '09121111111');
    check('کد ۶ رقمی در شبیه‌ساز نمایش داده شد', /^\d{6}$/.test(code), code);
    const modalShown = await page
      .waitForSelector('[role="dialog"]', { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check('مودال تکمیل پروفایل پس از ورود نمایش داده شد', modalShown, page.url());
    await shot(page, '03-profile-modal.png');

    // ۳) کد ملی نامعتبر رد شود
    await page.type('#name', 'تست کاربر', { delay: 5 });
    await page.type('#national_id', '1234567890', { delay: 5 });
    await page.type('#city', 'نجف‌اشرف', { delay: 5 });
    await page.select('select[aria-label="سال"]', '1370');
    await page.select('select[aria-label="ماه"]', '1');
    await page.select('select[aria-label="روز"]', '1');
    await clickButtonByText(page, 'ذخیره', '[role="dialog"]');
    let rejected = false;
    try {
      await page.waitForFunction(
        () => !!document.querySelector('[role="dialog"]')?.textContent.includes('کد ملی معتبر نیست'),
        { timeout: 15000 },
      );
      rejected = true;
    } catch {
      /* در ادامه گزارش می‌شود */
    }
    const dialogText = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
    check('کد ملی نامعتبر رد شد', rejected, dialogText.split(String.fromCharCode(10)).slice(-3).join(' | '));
    await shot(page, '04-invalid-national-id.png');

    // بستن مودال نباید مانع محتوا شود
    await clickButtonByText(page, 'بعداً', '[role="dialog"]');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 8000 });
    const contentAfterClose = await page.evaluate(() => ({
      path: location.pathname,
      hasContent: document.body.innerText.includes('رزروهای من'),
    }));
    check(
      'بستن مودال مانع مشاهده محتوا نشد',
      contentAfterClose.hasContent,
      `${contentAfterClose.path} | رزروهای من: ${contentAfterClose.hasContent}`,
    );

    // ۴) تکمیل با کد ملی معتبر (بدون ریلود؛ مودال را با دکمه «تکمیل پروفایل» دوباره باز می‌کنیم)
    await clickButtonByText(page, 'تکمیل پروفایل', 'main');
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(async () => {
      const text = await page.evaluate(() => `${location.pathname} :: ${document.body.innerText.slice(0, 300)}`);
      throw new Error(`مودال دوباره باز نشد — ${text}`);
    });
    // فرم پس از ریلود دوباره خالی است؛ همه فیلدها را پر می‌کنیم
    await page.type('#name', 'تست کاربر', { delay: 5 });
    await page.type('#city', 'نجف‌اشرف', { delay: 5 });
    await page.select('[role="dialog"] select[aria-label="سال"]', '1370');
    await page.select('[role="dialog"] select[aria-label="ماه"]', '1');
    await page.select('[role="dialog"] select[aria-label="روز"]', '1');
    await page.evaluate(() => {
      const el = document.getElementById('national_id');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.type('#national_id', nationalId('001882095'), { delay: 5 });
    await clickButtonByText(page, 'ذخیره', '[role="dialog"]');
    try {
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 15000 });
      check('پس از کد ملی معتبر، مودال بسته شد', true);
    } catch (err) {
      const text = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '(بدون مودال)');
      check('پس از کد ملی معتبر، مودال بسته شد', false, text.split(String.fromCharCode(10)).join(' | '));
    }

    const db = new DatabaseSync(path.join('data', 'app.db'));
    const row = db.prepare('SELECT name, national_id, city, birth_date_jalali, profile_complete FROM users WHERE phone = ?').get('09121111111');
    check(
      'profile_complete=1 در دیتابیس ذخیره شد',
      row?.profile_complete === 1 && !!row.national_id && !!row.birth_date_jalali,
      JSON.stringify(row),
    );
    db.close();

    // ۵) نشست ماندگار: بستن و بازکردن مرورگر
    const sessionCookie = (await page.cookies()).find((c) => c.name === 'abol_session');
    check(
      'کوکی نشست: HttpOnly + SameSite=Lax + عمر ۳۰ روز',
      sessionCookie?.httpOnly === true && sessionCookie?.sameSite === 'Lax'
        && Math.abs(sessionCookie.expires * 1000 - Date.now() - 30 * 86400e3) < 3600e3,
      sessionCookie ? `httpOnly=${sessionCookie.httpOnly} sameSite=${sessionCookie.sameSite} days=${((sessionCookie.expires * 1000 - Date.now()) / 86400e3).toFixed(2)}` : 'بدون کوکی',
    );

    await browser.close();
    browser = await openBrowser();
    const page2 = await browser.newPage();
    watch(page2, 'reopen');
    await page2.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
    const stillLoggedIn = await page2.evaluate(() => ({
      path: location.pathname,
      text: document.body.innerText,
    }));
    check(
      'پس از بستن و بازکردن مرورگر همچنان وارد است',
      stillLoggedIn.path === '/profile' && stillLoggedIn.text.includes('تست کاربر'),
      `${stillLoggedIn.path} | ${stillLoggedIn.text.split('\n')[0]}`,
    );
    await shot(page2, '05-profile.png');

    // ۶) گیت /admin برای کاربر عادی
    await page2.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
    const memberAdmin = await page2.evaluate(() => document.body.innerText);
    check('کاربر عادی به پنل مدیریت دسترسی ندارد', memberAdmin.includes('دسترسی به پنل مدیریت ندارید'));
    await shot(page2, '06-admin-blocked.png');

    // ۷) خروج از حساب
    await page2.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
    await clickButtonByText(page2, 'خروج', 'main form');
    await page2.waitForFunction(() => location.pathname === '/login', { timeout: 15000 });
    const loggedOut = await page2.evaluate(() => document.body.innerText);
    check('خروج انجام شد و پیام تأیید نمایش داده شد', loggedOut.includes('از حساب خود خارج شدید'));
    const backToProfile = await page2.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
    check('پس از خروج، /profile به /login برمی‌گردد', new URL(backToProfile.url()).pathname === '/login', backToProfile.url());

    // ۸) ادمین seed: پنل باز، داشبورد، کاربران
    await loginWithOtp(page2, '09120000000');
    await page2.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
    const adminText = await page2.evaluate(() => document.body.innerText);
    check('ادمین seed وارد /admin شد', adminText.includes('داشبورد') && !adminText.includes('دسترسی به پنل مدیریت ندارید'));
    check('داشبورد، تعداد واحدها (۱۱) را نشان می‌دهد', /واحدهای تعریف‌شده[\s\S]{0,40}11/.test(adminText), adminText.match(/واحدهای تعریف‌شده[\s\S]{0,40}/)?.[0].replace(/\n/g, ' '));
    await shot(page2, '07-admin-dashboard.png');

    await page2.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle2' });
    const usersText = await page2.evaluate(() => document.body.innerText);
    check('کاربران واقعی در پنل لیست شدند', usersText.includes('09120000000') && usersText.includes('09121111111'));
    check('برچسب «پروفایل ناقص» برای کاربر بدون پروفایل', usersText.includes('پروفایل ناقص'));

    // جستجو با شماره موبایل
    await page2.goto(`${BASE}/admin/users?q=09121111`, { waitUntil: 'networkidle2' });
    const searchOnly = await page2.evaluate(() => ({
      text: document.body.innerText,
      rows: document.querySelectorAll('tbody tr').length,
    }));
    check('جستجوی موبایل فقط کاربر مربوط را نشان می‌دهد', searchOnly.rows === 1 && searchOnly.text.includes('09121111111'), `rows=${searchOnly.rows}`);
    await shot(page2, '08-admin-users.png');

    // تغییر نقش
    await page2.select('tbody tr select', 'operator');
    await clickButtonByText(page2, 'ذخیره', 'tbody form');
    await page2.waitForFunction(() => document.body.innerText.includes('نقش ذخیره شد'), { timeout: 15000 });
    const db2 = new DatabaseSync(path.join('data', 'app.db'));
    const role = db2.prepare('SELECT role FROM users WHERE phone = ?').get('09121111111')?.role;
    db2.close();
    check('تغییر نقش به اپراتور در دیتابیس نوشته شد', role === 'operator', `role=${role}`);

    // بازگشت نقش به عضو
    const db3 = new DatabaseSync(path.join('data', 'app.db'));
    db3.prepare("UPDATE users SET role = 'member' WHERE phone = '09121111111'").run();
    db3.close();

    // ۹) صفحه ۴۰۴ (در تبی بدون ثبت خطای کنسول، چون ۴۰۴ عمدی است)
    const page404 = await browser.newPage();
    await page404.goto(`${BASE}/nazardanideh`, { waitUntil: 'networkidle2' });
    check('صفحه ۴۰۴ فارسی نمایش داده شد', (await page404.evaluate(() => document.body.innerText)).includes('۴۰۴'));
    await page404.close();

    for (const [route, label] of [['/guesthouse', 'مهمانسرا'], ['/donations', 'نذورات']]) {
      await page2.goto(`${BASE}${route}`, { waitUntil: 'networkidle2' });
      const text = await page2.evaluate(() => document.body.innerText);
      check(`placeholder ${label} با تیتر «به‌زودی»`, text.includes(label) && text.includes('به‌زودی'));
    }

    // مرحله ۲ بخش صوت را زنده کرد؛ جای placeholder قبلی این ادعا می‌آید
    await page2.goto(`${BASE}/audio`, { waitUntil: 'networkidle2' });
    const audioText = await page2.evaluate(() => document.body.innerText);
    check('صوت پس از مرحله ۲ دیگر placeholder نیست', audioText.includes('صوت') && !audioText.includes('به‌زودی'));
    await browser.close();

    // ۱۰) موبایل (mobile-first) — همان مسیر با ویوپورت کوچک
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      userDataDir: `${PROFILE}-mobile`,
      defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      args: ['--no-sandbox'],
    });
    const mobile = await browser.newPage();
    watch(mobile, 'mobile');
    await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
    await shot(mobile, '09-home-mobile.png');
    const menuButton = await mobile.evaluate(() => {
      const button = [...document.querySelectorAll('header button')].at(-1);
      button?.click();
      return [...document.querySelectorAll('header a')].length;
    });
    check('منوی موبایل بازشونده همه بخش‌ها را دارد', menuButton >= 10, `لینک‌ها پس از بازکردن: ${menuButton}`);
    await shot(mobile, '10-menu-mobile.png');
    await browser.close();
  } finally {
    await browser?.close().catch(() => {});
    rmSync(PROFILE, { recursive: true, force: true });
    rmSync(`${PROFILE}-mobile`, { recursive: true, force: true });
  }

  // ۱۱) seed واحدها با پلیگون Plan.html
  const db = new DatabaseSync(path.join('data', 'app.db'), { readOnly: true });
  const unitRows = db.prepare('SELECT code, svg_polygon, svg_viewbox, status FROM units ORDER BY id').all();
  const floors = db.prepare('SELECT count(*) c FROM floors').get().c;
  const admins = db.prepare("SELECT count(*) c FROM users WHERE role = 'admin'").get().c;
  db.close();
  const expected = JSON.parse(readFileSync(path.join('drizzle', 'seed', 'units.json'), 'utf8'));
  const polygonsMatch = unitRows.length === expected.units.length && expected.units.every(
    (u) => unitRows.find((r) => r.code === u.code)?.svg_polygon?.trim() === u.points.trim(),
  );
  check('۱۱ واحد با پلیگون‌های Plan.html seed شد', polygonsMatch && unitRows.length === 11, `units=${unitRows.length} floors=${floors} admins=${admins}`);
  check('همه پلیگون‌ها viewBox مشترک دارند', unitRows.every((r) => r.svg_viewbox === expected.viewBox), expected.viewBox);

  // ۱۲) خطاهای کنسول
  const realErrors = consoleErrors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
  check('هیچ خطای کنسولی در صفحه ورود و پنل ثبت نشد', realErrors.length === 0, realErrors.slice(0, 3).join(' || '));

  console.log(`\nنتیجه: ${results.filter((r) => r.ok).length}/${results.length} PASS`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('E2E ERROR:', err);
  process.exit(2);
});
