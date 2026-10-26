/**
 * تست پایانی مرحله ۲ — مرورگر واقعی (Chrome) روی پورت ۳۲۱۰
 * اجرا: node scripts/e2e-stage02.mjs   (نرم‌افزار `npm run dev` باید بالا باشد)
 * پوشه‌ی اسکرین‌شات: reports/assets/stage-02/
 */
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import puppeteer from 'puppeteer-core';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3210';
const HOST = 'localhost';
const PORT = Number(new URL(BASE).port || 80);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ASSETS = path.join('reports', 'assets', 'stage-02');
const PROFILE = path.join(tmpdir(), `abol-stage02-${process.pid}`);
const ADMIN_PHONE = '09120000000';
const LIVE = ['/audio', '/gallery', '/video', '/programs', '/articles'];

mkdirSync(ASSETS, { recursive: true });

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─────────────۱) ابزار HTTP خام: مسیر را دست‌نخورده می‌فرستد (بدون نرمال‌سازی curl/URL) ───────────── */

/**
 * note: `socket.end(payload)` (نیم‌بستن) باعث می‌شود سرور dev پاسخ را بفرستد و ما صفر بایت بگیریم؛
 * می‌نویسیم و تا کامل شدن بدنه اتصال را باز نگه می‌داریم.
 */
function rawRequest(urlPath, { headers = {}, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, '127.0.0.1');
    let buffer = '';
    let settled = false;
    const request = [`${method} ${urlPath} HTTP/1.1`, `Host: ${HOST}:${PORT}`, 'Connection: close', 'Accept: */*'];
    for (const [key, value] of Object.entries(headers)) request.push(`${key}: ${value}`);

    const parse = () => {
      const split = buffer.indexOf('\r\n\r\n');
      if (split < 0) return null;
      const head = buffer.slice(0, split);
      const body = buffer.slice(split + 4);
      const status = Number(/^HTTP\/1\.\d (\d{3})/.exec(head)?.[1] ?? 0);
      const map = {};
      for (const line of head.split('\r\n').slice(1)) {
        const i = line.indexOf(':');
        if (i > 0) map[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
      }
      return { status, headers: map, body };
    };

    const done = () => {
      if (settled) return;
      settled = true;
      const parsed = parse() ?? { status: 0, headers: {}, body: '' };
      socket.destroy();
      resolve({ status: parsed.status, headers: parsed.headers, bodyBytes: parsed.body.length });
    };

    const complete = () => {
      const parsed = parse();
      if (!parsed) return false;
      if (parsed.status === 204 || parsed.status === 304) return true;
      if (/chunked/i.test(parsed.headers['transfer-encoding'] ?? '')) return /(^|\r\n)0\r\n\r\n$/.test(parsed.body);
      const length = Number(parsed.headers['content-length']);
      return Number.isFinite(length) ? parsed.body.length >= length : false;
    };

    socket.setTimeout(20000);
    socket.on('error', reject);
    socket.on('timeout', done);
    socket.on('end', done);
    socket.on('close', done);
    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');
      if (complete()) done();
    });
    socket.write(`${request.join('\r\n')}\r\n\r\n`);
  });
}

/** redirectionهای نرمال‌سازی Next را یک بار دنبال می‌کنیم تا وضعیت نهایی (۴xx) سنجیده شود */
async function rawFollow(urlPath, max = 3) {
  let res = await rawRequest(urlPath);
  let current = urlPath;
  for (let i = 0; i < max && [301, 302, 303, 307, 308].includes(res.status) && res.headers.location; i += 1) {
    current = new URL(res.headers.location, `http://${HOST}:${PORT}`).pathname + new URL(res.headers.location, `http://${HOST}:${PORT}`).search;
    res = await rawRequest(current);
  }
  return { ...res, via: current === urlPath ? null : current };
}

/* ─────────────۲) PNG ساز (برای آپلود واقعی در پنل) ───────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])));
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, crc]);
}

/** PNG رنگی ۸ بیتی؛ رنگ jade تا لبه‌ها طلایی */
function makePng(width, height) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o++] = 0;
    for (let x = 0; x < width; x += 1) {
      const edge = x < 6 || y < 6 || x >= width - 6 || y >= height - 6;
      const [r, g, b] = edge ? [0xc8, 0xa4, 0x5c] : [0x0e, 0x6b, 0x5c];
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ─────────────۳) مرورگر ───────────── */

const consoleErrors = [];
/** پاسخ‌های ۴۰۴ که خودِ داده نمونه (ویدئوی بی‌فایل) عمدی می‌سازد در شمارش خطا نمی‌آیند */
const EXPECTED_FAILURES = [/favicon/i, /Download the React DevTools/i, /\/api\/files\/video\/sample-video-/];

function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) consoleErrors.push(`[${label}] http ${res.status()} ${res.url()}`);
  });
}

function trackResponse(page, sink) {
  page.on('response', (res) => sink.push({ url: res.url(), status: res.status(), headers: res.headers() }));
}

async function openBrowser() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: PROFILE,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  });
}

/** در حالت dev ممکن است اولین درخواست یک route درست بعد از compile خطای موقت بدهد؛ یک بار تکرار می‌کنیم */
async function gotoPage(target, urlPath) {
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await target.goto(`${BASE}${urlPath}`, { waitUntil: 'networkidle2' });
    if (!response || response.status() < 500) return response;
    await sleep(1500);
  }
  return response;
}

async function shot(page, file) {
  await page.screenshot({ path: path.join(ASSETS, file), fullPage: false });
}

/** انتخاب فایل برای input نوع file (نسخه puppeteer-core این متد را روی Page ندارد) */
async function upload(page, selector, file) {
  const handle = await page.waitForSelector(selector);
  await handle.uploadFile(file);
}

/** کلیک با ماوس روی دکمه ذخیره‌ی فرمی که فیلد #title در آن قرار دارد (رویداد کاربری واقعی) */
async function submitForm(page) {
  await page.waitForFunction(
    () => {
      const button = document.getElementById('title')?.closest('form')?.querySelector('button[type=submit]');
      return !!button && !button.disabled;
    },
    { timeout: 15000 },
  );
  const handle = await page.evaluateHandle(() =>
    document.getElementById('title').closest('form').querySelector('button[type=submit]'),
  );
  const element = handle.asElement();
  if (!element) throw new Error('دکمه ذخیره فرم پیدا نشد');
  await element.click();
}

async function clickButtonByText(page, text, scope = 'body') {
  const handle = await page.evaluateHandle(
    ({ needle, root }) => {
      const nodes = [...document.querySelectorAll(`${root} button, ${root} a`)];
      return nodes.find((el) => (el.textContent || '').includes(needle)) ?? null;
    },
    { needle: text, root: scope },
  );
  const element = handle.asElement();
  if (!element) throw new Error(`دکمه با متن «${text}» در ${scope} پیدا نشد`);
  await element.click();
  return element;
}

async function loginWithOtp(page, phone) {
  let lastText = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await gotoPage(page, `/login`);
    await page.waitForSelector('#phone');
    await page.click('#phone');
    await page.type('#phone', phone, { delay: 8 });
    await clickButtonByText(page, 'دریافت کد پیامکی', 'main');
    await page.waitForSelector('#code', { timeout: 15000 });
    const code = await page.$eval('div.border-dashed .num-latin', (el) => el.textContent.trim());
    await page.evaluate(() => {
      const el = document.getElementById('code');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.type('#code', code, { delay: 8 });
    await clickButtonByText(page, 'ورود', 'main form');
    const done = await page
      .waitForFunction(() => location.pathname !== '/login', { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (done) return code;
    lastText = await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 200) ?? '(خالی)');
    await sleep(1200);
  }
  throw new Error(`ورود با ${phone} در سه تلاش ناموفق بود — آخرین متن: ${lastText}`);
}

/** در یک تب بدون watcher به آدرس‌هایی برویم که عمداً ۴۰۴ برمی‌گردانند */
async function statusOf(browser, urlPath) {
  const page = await browser.newPage();
  const res = await gotoPage(page, `${urlPath}`);
  const text = await page.evaluate(() => document.body.innerText);
  await page.close();
  return { status: res?.status() ?? 0, text };
}

/* ─────────────۴) تست‌ها ───────────── */

async function main() {
  const pngPath = path.join('.scratch', 'upload-sample.png');
  mkdirSync('.scratch', { recursive: true });
  writeFileSync(pngPath, makePng(64, 48));
  const badUpload = path.join('.scratch', 'upload-sample.txt');
  writeFileSync(badUpload, 'این فایل تصویر نیست');

  // داده‌ی نمونه باید موجود باشد
  const seed = new DatabaseSync(path.join('data', 'app.db'));
  const counts = {
    articles: seed.prepare('SELECT count(*) c FROM articles WHERE is_published = 1').get().c,
    audios: seed.prepare('SELECT count(*) c FROM audios WHERE is_published = 1').get().c,
    photos: seed.prepare('SELECT count(*) c FROM photos').get().c,
    persons: seed.prepare('SELECT count(*) c FROM persons WHERE is_deceased = 1').get().c,
    programs: seed.prepare('SELECT count(*) c FROM programs').get().c,
  };
  seed.prepare('DELETE FROM otp_codes WHERE phone = ?').run(ADMIN_PHONE);
  seed.close();
  check(
    'داده نمونه در دیتابیس هست',
    counts.articles >= 3 && counts.audios === 4 && counts.photos === 6 && counts.persons === 1 && counts.programs === 4,
    JSON.stringify(counts),
  );

  let browser = await openBrowser();
  let created = null;

  try {
    const page = await browser.newPage();
    watch(page, 'desktop');
    const audioResponses = [];
    trackResponse(page, audioResponses);

    // ۱) خانه: پنج بخش زنده بدون «به‌زودی» و بدون برچسب مرحله
    await gotoPage(page, `/`);
    const home = await page.evaluate((liveHrefs) => {
      const mainEl = document.querySelector('main');
      const cards = [...mainEl.querySelectorAll('.rounded-xl')];
      const flagged = [];
      for (const href of liveHrefs) {
        for (const card of cards) {
          if (card.querySelector(`a[href="${href}"]`) && /مرحله|به‌زودی/.test(card.innerText)) flagged.push(href);
        }
      }
      const chips = [
        ...new Set(
          [...mainEl.querySelectorAll('span,div')]
            .filter((el) => el.children.length === 0 && el.textContent.trim().startsWith('مرحله'))
            .map((el) => el.textContent.trim()),
        ),
      ];
      return {
        flagged: [...new Set(flagged)],
        chips,
        soon: mainEl.innerText.includes('به‌زودی'),
        rtl: document.documentElement.dir,
      };
    }, LIVE);
    check('خانه: پنج بخش زنده برچسب «مرحله» یا «به‌زودی» ندارند', home.flagged.length === 0 && !home.soon, JSON.stringify(home.flagged));
    check(
      'خانه: برچسب مرحله فقط برای مهمانسرا و نذورات و پیشرفت ساخت',
      home.chips.length === 2 && home.chips.every((c) => /مرحله [۳۵]/.test(c)),
      home.chips.join(' | '),
    );

    const homeReal = await page.evaluate(() => {
      const text = (document.querySelector('main') ?? document.body).innerText;
      return {
        articles: text.includes('تازه‌ترین مقاله‌ها') && text.includes('چرا حیدریه می‌خوانیم؟'),
        audios: text.includes('آخرین صوت‌ها') && text.includes('روضه شب اول محرم'),
        programs: text.includes('برنامه‌های پیش‌رو') && text.includes('مراسم هفتگی حیدریه'),
        persons: text.includes('آلبوم افراد قدیمی و مرحوم'),
        links: ['/articles/chera-heyarieh-mi-khanim', '/audio', '/gallery/persons'].filter((href) =>
          !!document.querySelector(`main a[href="${href}"]`),
        ).length,
      };
    });
    check(
      'خانه: کارت‌های واقعی مقاله/صوت/برنامه از DB',
      homeReal.articles && homeReal.audios && homeReal.programs && homeReal.persons && homeReal.links === 3,
      JSON.stringify(homeReal),
    );
    await shot(page, '01-home.png');

    // ۲) صوت: پخش + ۲۰۶ Range + ماندن پخش در ناوبری سمت کلاینت
    await gotoPage(page, `/audio`);
    const playButton = await page.waitForSelector('button[aria-label^="پخش"]');
    await playButton.click();
    await page.waitForSelector('.fixed.inset-x-0.bottom-0', { timeout: 10000 });
    await sleep(1200);
    const before = await page.evaluate(() => {
      const el = document.querySelector('audio');
      return { src: el?.currentSrc ?? '', time: el?.currentTime ?? 0, paused: el?.paused ?? true };
    });
    check('پخش صوت از دکمه شروع شد', /\/api\/files\/audio\//.test(before.src) && !before.paused && before.time > 0, JSON.stringify(before));

    const wavResponses = audioResponses.filter((r) => /\/api\/files\/audio\//.test(r.url));
    const ranged = wavResponses.find((r) => r.status === 206);
    check(
      'درخواست فایل صوتی با ۲۰۶ Range پاسخ داد',
      !!ranged,
      wavResponses.map((r) => `${r.status} ${path.basename(r.url)}`).join(' | '),
    );
    check('پاسخ ۲۰۶ سرِ Content-Range دارد', /bytes \d+-\d+\/\d+/.test(ranged?.headers?.['content-range'] ?? ''), ranged?.headers?.['content-range'] ?? '(بدون سرِ)');

    // ناوبری سمت کلاینت: لینک هدر، نه reload
    await page.evaluate(() => {
      document.querySelector('header a[href="/articles"]')?.click();
    });
    await page.waitForFunction(() => location.pathname === '/articles', { timeout: 15000 });
    const after = await page.evaluate(() => {
      const el = document.querySelector('audio');
      const bar = document.querySelector('.fixed.inset-x-0.bottom-0');
      return {
        src: el?.currentSrc ?? '',
        time: el?.currentTime ?? 0,
        ended: el?.ended ?? false,
        bar: !!bar && bar.innerText.length > 0,
      };
    });
    check(
      'پخش‌کننده چسبان پس از رفتن به صفحه‌ی دیگر زنده ماند',
      after.bar && /\/api\/files\/audio\//.test(after.src) && after.time >= before.time,
      JSON.stringify(after),
    );
    await shot(page, '02-audio-player.png');
    await page.evaluate(() => document.querySelector('button[aria-label="بستن پخش‌کننده"]')?.click());

    // ۳) فیلتر مناسبت
    await gotoPage(page, `/audio?occasion=fatimiye`);
    const filtered = await page.evaluate(() => ({
      rows: document.querySelectorAll('main ul li').length,
      text: (document.querySelector('main') ?? document.body).innerText,
    }));
    check(
      'فیلتر مناسبت فقط صوت فاطمیه را نگه می‌دارد',
      filtered.rows === 1 && filtered.text.includes('مرثیه ایام فاطمیه'),
      `ردیف=${filtered.rows}`,
    );
    await gotoPage(page, `/audio?narrator=${encodeURIComponent('مهدی سعادت')}`);
    const byNarrator = await page.evaluate(() => document.querySelectorAll('main ul li').length);
    check('فیلتر راوی دو صوت مهدی سعادت را نشان می‌دهد', byNarrator === 2, `ردیف=${byNarrator}`);

    // ۴) مقاله: markdown رندرشده و تایپوگرافی راست‌به‌چپ + متادیتای OG
    await gotoPage(page, `/articles/mardi-ke-heyat-ra-bana-kard`);
    const art = await page.evaluate(() => {
      const body = document.querySelector('.article-body');
      const style = body ? getComputedStyle(body.querySelector('p') ?? body) : null;
      return {
        h2: body?.querySelectorAll('h2').length ?? 0,
        li: body?.querySelectorAll('li').length ?? 0,
        blockquote: body?.querySelectorAll('blockquote').length ?? 0,
        strong: body?.querySelectorAll('strong').length ?? 0,
        lineHeight: style?.lineHeight,
        dir: body ? getComputedStyle(body).direction : '',
        align: style?.textAlign,
        og: {
          title: document.querySelector('meta[property="og:title"]')?.content ?? '',
          desc: document.querySelector('meta[property="og:description"]')?.content ?? '',
          image: document.querySelector('meta[property="og:image"]')?.content ?? '',
          type: document.querySelector('meta[property="og:type"]')?.content ?? '',
          url: document.querySelector('meta[property="og:url"]')?.content ?? '',
        },
      };
    });
    check('مقاله: ساختار markdown (تیتر، فهرست، نقل‌قول، مضخّم) رندرشده', art.h2 >= 1 && art.li >= 2 && art.blockquote >= 1 && art.strong >= 1, JSON.stringify({ h2: art.h2, li: art.li, bq: art.blockquote, strong: art.strong }));
    check('مقاله: تایپوگرافی راست‌به‌چپ با ارتفاع خط مناسب', art.dir === 'rtl' && parseFloat(art.lineHeight) >= 24, `dir=${art.dir} lineHeight=${art.lineHeight} textAlign=${art.align}`);
    check('مقاله: متادیتای OG کامل در HTML', !!art.og.title && !!art.og.desc && art.og.type === 'article' && /^https?:\/\//.test(art.og.image) && art.og.url.includes('/articles/'), JSON.stringify(art.og));
    const rawHtml = await page.content();
    check('مقاله: تگ og:title در سورس HTML است', /<meta property="og:title"/.test(rawHtml));

    // ۴-ب) مقاله‌ای که تصویر وسط متن دارد
    const dbImg = new DatabaseSync(path.join('data', 'app.db'), { readOnly: true });
    const withImage = dbImg
      .prepare("SELECT slug FROM articles WHERE is_published = 1 AND body_markdown LIKE '%![%' ORDER BY id LIMIT 1")
      .get();
    dbImg.close();
    await gotoPage(page, `/articles/${withImage.slug}`);
    const inText = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.article-body img')];
      return imgs.map((img) => ({ src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0, width: img.clientWidth }));
    });
    check('مقاله: تصویر وسط متن از /api/files بارگذاری و تمام‌عرض شد', inText.some((i) => /\/api\/files\/image\//.test(i.src ?? '') && i.ok && i.width > 100), JSON.stringify(inText));
    await shot(page, '03b-article-image.png');
    await shot(page, '03-article.png');

    // ۵) فیلتر دسته در فهرست مقالات
    const db1 = new DatabaseSync(path.join('data', 'app.db'), { readOnly: true });
    const category = db1.prepare('SELECT c.slug, count(a.id) c FROM categories c LEFT JOIN articles a ON a.category_id = c.id AND a.is_published = 1 WHERE c.kind = \'article\' GROUP BY c.slug ORDER BY c.slug').all();
    db1.close();
    const target = category.find((row) => row.c > 0);
    await gotoPage(page, `/articles?category=${target.slug}`);
    const listFiltered = await page.evaluate(() => ({
      cards: document.querySelectorAll('main a[href^="/articles/"]').length,
      text: (document.querySelector('main') ?? document.body).innerText,
    }));
    check(
      'فهرست مقالات با فیلتر دسته فقط مقالات همان دسته را می‌گذارد',
      listFiltered.cards === Number(target.c),
      `دسته=${target.slug} انتظار=${target.c} لینک=${listFiltered.cards}`,
    );

    // ۶) آلبوم: لایت‌بوکس
    await gotoPage(page, `/gallery/4`);
    const gridButtons = await page.$$eval('button[aria-label^="نمایش عکس"]', (els) => els.length);
    check('آلبوم: شبکه‌ی تصاویر ساخته شد', gridButtons === 3, `دکمه=${gridButtons}`);
    await page.evaluate(() => document.querySelector('button[aria-label^="نمایش عکس"]')?.click());
    await page.waitForSelector('[role="dialog"][aria-label="نمایش بزرگ عکس"]', { timeout: 8000 });
    const counter1 = await page.$eval('[role="dialog"] span.text-white', (el) => el.textContent.trim());
    await page.keyboard.press('ArrowLeft');
    await sleep(250);
    const counter2 = await page.$eval('[role="dialog"] span.text-white', (el) => el.textContent.trim());
    await page.keyboard.press('Escape');
    await sleep(250);
    const closed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
    check('لایت‌بوکس: قبلی/بعدی با کلید جهت کار می‌کند', counter1 !== counter2 && /از/.test(counter2), `${counter1} → ${counter2}`);
    check('لایت‌بوکس: با Esc بسته شد', closed);
    await shot(page, '04-lightbox.png');

    // ۷) شخص متوفی
    await gotoPage(page, `/gallery/persons/seyyed-reza-najafashrafi`);
    const person = await page.evaluate(() => {
      const body = document.querySelector('.article-body');
      const img = document.querySelector('img[alt="سید رضا نجف‌اشرفی"]');
      return {
        text: (document.querySelector('main') ?? document.body).innerText,
        marks: { h2: body?.querySelectorAll('h2').length ?? 0, li: body?.querySelectorAll('li').length ?? 0, bq: body?.querySelectorAll('blockquote').length ?? 0 },
        photo: !!img && img.complete && img.naturalWidth > 0,
        src: img?.getAttribute('src') ?? '',
      };
    });
    check('شخص متوفی: برچسب «متوفی — روحش شاد»', person.text.includes('متوفی'), '');
    check('شخص متوفی: معرفی‌نامه‌ی markdown‌دار', person.marks.h2 >= 1 && person.marks.li >= 2, JSON.stringify(person.marks));
    check('شخص متوفی: عکس اصلی بارگذاری شد', person.photo && /\/api\/files\/image\//.test(person.src), person.src);
    await shot(page, '05-person-deceased.png');

    // ۸) برنامه‌ها: تفکیک بر اساس امروز شمسی + برچسب لغو
    await gotoPage(page, `/programs`);
    const programs = await page.evaluate(() => {
      const sections = [...document.querySelectorAll('main section')].map((s) => ({
        title: s.querySelector('h2')?.innerText?.trim() ?? '',
        text: s.innerText,
      }));
      const byName = Object.fromEntries(sections.map((s) => [s.title, s.text]));
      return { titles: sections.map((s) => s.title), byName, badge: (document.querySelector('main') ?? document.body).innerText.match(/[۰-۹]+ پیش‌رو[^\n]*/)?.[0] ?? '' };
    });
    const upcomingText = programs.byName['پیش‌رو'] ?? '';
    const pastText = programs.byName['برگزارشده'] ?? '';
    check('برنامه‌ها: دو ستون پیش‌رو و برگزارشده', upcomingText.length > 0 && pastText.length > 0, programs.titles.join(' | '));
    check('برنامه‌ها: برنامه‌ی ۱۰ آبان در ستون پیش‌رو است', upcomingText.includes('مراسم هفتگی حیدریه'), upcomingText.replace(/\n/g, ' / ').slice(0, 90));
    check('برنامه‌ها: برنامه‌ی ۲۱ مهر در ستون برگزارشده', pastText.includes('کارگاه تفسیر قرآن'), pastText.replace(/\n/g, ' / ').slice(0, 90));
    check('برنامه‌ها: برچسب «لغوشده» روی برنامه‌ی لغوشده', upcomingText.includes('لغوشده'), programs.badge);
    await shot(page, '06-programs.png');

    // ۹) ویدئو: فایل نرسیده باشد، پلیر پیام فارسی می‌دهد
    await gotoPage(page, `/video/3`);
    const videoText = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
    check('ویدئو: نبودِ فایل با پیام فارسی مدیریت می‌شود', videoText.includes('فایل این ویدئو هنوز روی میزبان نیست'), videoText.split('\n').find((l) => l.includes('میزبان')) ?? '');
    await shot(page, '07-video-missing.png');

    // ۱۰) پنل محتوا: چرخه‌ی کامل ساخت → انتشار → عمومی → unpublish → حذف
    const ARTICLE_MD = '## بخش تست\n\nمتن **مضخّم** برای آزمایش رندر.\n\n- مورد یک\n- مورد دو\n\n> نقل‌قول تست';
    await loginWithOtp(page, ADMIN_PHONE);

    // الف) فایل با پسوند نامجاز باید رد شود
    await gotoPage(page, `/admin/content?tab=articles&edit=new`);
    await page.waitForSelector('#title');
    await page.type('#title', 'مقاله‌ی تست خودکار مرحله دو', { delay: 5 });
    await page.type('#body_markdown', ARTICLE_MD, { delay: 2 });
    await upload(page, '#cover', badUpload);
    await submitForm(page);
    await page.waitForFunction(() => document.body.innerText.includes('پسوند مجاز نیست'), { timeout: 20000 }).catch(() => {});
    const rejected = await page.evaluate(() => document.body.innerText.includes('پسوند مجاز نیست'));
    check('پنل: آپلود فایل با پسوند نامجاز رد شد', rejected);

    // ب) همان فرم، این بار با PNG واقعی (فرم تازه؛ بدون وابستگی به رندر قبلی)
    await gotoPage(page, `/admin/content?tab=articles&edit=new`);
    await page.waitForSelector('#title');
    await page.type('#title', 'مقاله‌ی تست خودکار مرحله دو', { delay: 5 });
    await page.type('#body_markdown', ARTICLE_MD, { delay: 2 });
    await upload(page, '#cover', pngPath);
    const fileState = await page.evaluate(() => {
      const input = document.getElementById('cover');
      return { count: input.files.length, name: input.files[0]?.name ?? '', type: input.files[0]?.type ?? '' };
    });
    check('پنل: فایل PNG به input اضافه شد', fileState.count === 1 && /\.png$/i.test(fileState.name), JSON.stringify(fileState));
    await page.evaluate(() => {
      const box = document.getElementById('title').closest('form').querySelector('input[name="is_published"]');
      if (!box.checked) box.click();
    });
    await submitForm(page);
    let saved = true;
    try {
      await page.waitForFunction(() => document.body.innerText.includes('ذخیره شد'), { timeout: 25000 });
    } catch {
      saved = false;
      writeFileSync(path.join('.scratch', 'panel-dump.txt'), await page.evaluate(() => document.body.innerText));
    }
    const messageText = await page.evaluate(() => document.body.innerText);
    const savedMatch = /مقاله ذخیره شد \(شناسه (\d+)، نشانی \/articles\/([^\s)]+)\)/.exec(messageText);
    check('پنل: پیام ذخیره پس از آپلود درست نمایش داده شد', saved && !!savedMatch, saved ? '' : 'متن صفحه در .scratch/panel-dump.txt');
    created = {
      id: Number(savedMatch?.[1] ?? 0),
      slug: decodeURIComponent(savedMatch?.[2] ?? ''),
      title: 'مقاله‌ی تست خودکار مرحله دو',
    };
    check('پنل: مقاله با نشانی خودساز (slug) ساخته شد', !!created.id && !!created.slug, savedMatch?.[0] ?? messageText.split('\n').slice(-4).join(' | '));

    const publicNew = await gotoPage(page, `/articles/${encodeURIComponent(created.slug)}`);
    const newArt = await page.evaluate(() => {
      const img = document.querySelector('article img');
      const body = document.querySelector('.article-body');
      return {
        h1: document.querySelector('article h1')?.innerText ?? '',
        photo: !!img && img.complete && img.naturalWidth > 0,
        src: img?.getAttribute('src') ?? '',
        marks: { h2: body?.querySelectorAll('h2').length ?? 0, li: body?.querySelectorAll('li').length ?? 0, bq: body?.querySelectorAll('blockquote').length ?? 0 },
      };
    });
    check('پنل→عمومی: تصویر آپلودی در صفحه‌ی مقاله نمایش داده شد', newArt.photo && /\.png$/.test(newArt.src), JSON.stringify(newArt));
    check('پنل→عمومی: markdown پنل همان‌جا رندر شد', newArt.h1 === created.title && newArt.marks.h2 === 1 && newArt.marks.li === 2 && newArt.marks.bq === 1, JSON.stringify(newArt));
    await shot(page, '08-panel-article-created.png');

    // unpublished از پنل
    await gotoPage(page, `/admin/content?tab=articles`);
    const toggled = await page.evaluate((title) => {
      const row = [...document.querySelectorAll('tbody tr')].find((tr) => tr.innerText.includes(title));
      if (!row) return 'ردیف پیدا نشد';
      const box = row.querySelector('input[type=checkbox]');
      box.click();
      row.querySelector('button[type=submit]').click();
      return row.innerText.slice(0, 60);
    }, created.title);
    await sleep(2500);
    const hidden = await statusOf(browser, `/articles/${encodeURIComponent(created.slug)}`);
    check('پنل: پس از خاموش کردن انتشار، صفحه عمومی ۴۰۴ شد', hidden.status === 404, `${hidden.status} | ${toggled}`);
    const db2 = new DatabaseSync(path.join('data', 'app.db'), { readOnly: true });
    const publishedFlag = db2.prepare('SELECT is_published FROM articles WHERE id = ?').get(created.id)?.is_published;
    db2.close();
    check('پنل: مقدار is_published در دیتابیس صفر شد', publishedFlag === 0, `is_published=${publishedFlag}`);

    // حذف + پاک‌سازی فایل
    const db3 = new DatabaseSync(path.join('data', 'app.db'), { readOnly: true });
    const stored = db3.prepare('SELECT stored_path FROM articles a JOIN media_assets m ON m.id = a.cover_asset_id WHERE a.id = ?').get(created.id)?.stored_path;
    db3.close();
    page.on('dialog', (dialog) => dialog.accept());
    await gotoPage(page, `/admin/content?tab=articles`);
    await page.evaluate((title) => {
      const row = [...document.querySelectorAll('tbody tr')].find((tr) => tr.innerText.includes(title));
      // کلاس پایه‌ی دکمه‌ها شامل aria-invalid:border-destructive است؛ برچسب متن مطمئن‌تر از selector کلاس
      const button = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === 'حذف');
      button?.click();
    }, created.title);
    await page.waitForFunction(
      (title) => ![...document.querySelectorAll('tbody tr')].some((tr) => tr.innerText.includes(title)),
      { timeout: 25000, polling: 500 },
      created.title,
    ).catch(() => {});
    const db4 = new DatabaseSync(path.join('data', 'app.db'), { readOnly: true });
    const stillArticle = db4.prepare('SELECT count(*) c FROM articles WHERE id = ?').get(created.id).c;
    const stillAsset = stored ? db4.prepare('SELECT count(*) c FROM media_assets WHERE stored_path = ?').get(stored).c : -1;
    db4.close();
    check('پنل: ردیف مقاله از فهرست و از دیتابیس حذف شد', stillArticle === 0, `ردیف باقی=${stillArticle}`);
    check('پنل: رکورد رسانه‌ی بی‌استفاده هم حذف شد', stillAsset === 0, `media_assets=${stored ?? '(بدون رکورد)'} باقی=${stillAsset}`);
    check('پنل: فایل آپلودی روی دیسک هم پاک شد', !!stored && !existsSync(path.join('storage', 'uploads', stored)), stored ?? '(مسیر ثبت نشده بود)');
    const gone = await statusOf(browser, `/articles/${encodeURIComponent(created.slug)}`);
    check('پس از حذف، نشانی عمومی ۴۰۴ است', gone.status === 404, String(gone.status));

    // ۱۱) پنل: همه سربرگ‌ها باز می‌شوند و داده نمونه را نشان می‌دهند
    for (const [tab, marker] of [['articles', 'مقالات'], ['audio', 'صوت'], ['gallery', 'آلبوم‌ها'], ['video', 'ویدئو'], ['programs', 'برنامه‌ها'], ['categories', 'دسته‌ها']]) {
      await gotoPage(page, `/admin/content?tab=${tab}`);
      const text = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
      check(`پنل: سربرگ ${marker} فهرست و دکمه ساخت دارد`, text.includes(marker) && text.includes('جدید'), `len=${text.length}`);
      if (tab === 'gallery') await shot(page, '09-panel-gallery.png');
    }

    // ۱۲) خانه در موبایل
    const mobile = await openBrowserMobile();
    const mpage = await mobile.newPage();
    watch(mpage, 'mobile');
    await gotoPage(mpage, `/`);
    await mpage.screenshot({ path: path.join(ASSETS, '10-home-mobile.png') });
    const mAudio = await gotoPage(mpage, `/audio`);
    await mpage.screenshot({ path: path.join(ASSETS, '11-audio-mobile.png') });
    check('موبایل: خانه و آرشیو صوت بدون خطا باز شدند', mAudio.status() === 200, String(mAudio.status()));
    await mobile.close();
  } finally {
    await browser?.close().catch(() => {});
    rmSync(PROFILE, { recursive: true, force: true });
    rmSync(`${PROFILE}-mobile`, { recursive: true, force: true });
  }

  // ۱۳) تست‌های HTTP خام: Range و path traversal
  const full = await rawRequest('/api/files/audio/sample-audio-1.wav');
  const total = Number(full.headers['content-length']);
  check('GET کامل: ۲۰۰ با Accept-Ranges و Content-Length', full.status === 200 && full.headers['accept-ranges'] === 'bytes' && total > 0, JSON.stringify({ status: full.status, len: total }));

  const part = await rawRequest('/api/files/audio/sample-audio-1.wav', { headers: { Range: 'bytes=100-199' } });
  check(
    'Range bytes=100-199 → ۲۰۶ با Content-Range و طول درست',
    part.status === 206 && part.headers['content-range'] === `bytes 100-199/${total}` && Number(part.headers['content-length']) === 100,
    JSON.stringify({ status: part.status, cr: part.headers['content-range'], len: part.headers['content-length'] }),
  );

  const suffix = await rawRequest('/api/files/audio/sample-audio-1.wav', { headers: { Range: 'bytes=-50' } });
  check(
    'Range پسوندی bytes=-50 → ۵۰ بایت آخر فایل',
    suffix.status === 206 && Number(suffix.headers['content-length']) === 50 && suffix.headers['content-range'] === `bytes ${total - 50}-${total - 1}/${total}`,
    JSON.stringify({ status: suffix.status, cr: suffix.headers['content-range'], len: suffix.headers['content-length'] }),
  );

  const bad = await rawRequest('/api/files/audio/sample-audio-1.wav', { headers: { Range: 'bytes=999999-' } });
  check('Range خارج از محدوده → ۴۱۶', bad.status === 416 && /bytes \*\//.test(bad.headers['content-range'] ?? ''), JSON.stringify({ status: bad.status, cr: bad.headers['content-range'] }));

  const svg = await rawRequest('/api/files/image/sample-article-1.svg');
  check('SVG با CSP sandbox سرو می‌شود', svg.status === 200 && /sandbox/.test(svg.headers['content-security-policy'] ?? ''), svg.headers['content-security-policy'] ?? '(بدون CSP)');

  const missingVideo = await rawRequest('/api/files/video/sample-video-moharram-sermon.mp4');
  check('ویدئوی ثبت‌شده ولی بدون فایل → ۴۰۴ فارسی', missingVideo.status === 404, String(missingVideo.status));

  const traversal = [
    '/api/files/../../package.json',
    '/api/files/../../windows/win.ini',
    '/api/files/%2e%2e%2f%2e%2e%2fpackage.json',
    '/api/files/audio/../../../package.json',
    '/api/files/..%2f..%2f.env',
    '/api/files/../../data/app.db',
    '/api/files//etc/passwd',
  ];
  const probes = [];
  for (const urlPath of traversal) {
    const res = await rawFollow(urlPath);
    probes.push({ urlPath, status: res.status, via: res.via });
    check(`path traversal رد شد: ${urlPath}`, res.status >= 400 && res.status < 500, `status=${res.status}${res.via ? ` (_after_redirect_=${res.via})` : ''}`);
  }
  const foreign = await rawFollow('/api/files/audio/sample-audio-1.wav/extra');
  check('مسیر اضافی بعد از فایل ثبت‌شده → ۴۰۴', foreign.status === 404, String(foreign.status));

  // ۱۴) خطاهای کنسول
  const realErrors = consoleErrors.filter((e) => !EXPECTED_FAILURES.some((re) => re.test(e)));
  check('صفر خطای کنسول در همه‌ی صفحات مرحله ۲', realErrors.length === 0, realErrors.slice(0, 4).join(' || '));

  console.log(`\nنتیجه: ${results.filter((r) => r.ok).length}/${results.length} PASS`);
  process.exit(failures ? 1 : 0);
}

async function openBrowserMobile() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: `${PROFILE}-mobile`,
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
}

main().catch((err) => {
  console.error('E2E ERROR:', err);
  process.exit(2);
});
