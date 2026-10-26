# گزارش مرحله ۱ — اسکلت + هویت

- **نویسنده:** دستیار کدنویس (شناسه نشستن `346d0d78-1f00-46a0-973f-11178d7cfc84`)
- **تاریخ:** ۳ آبان ۱۴۰۵
- **پرامپت اجراشده:** فقط بخش «د. پرامپت مرحله ۱» از `Prompt_01_Stage1.html`
- **آدرس تست:** `http://localhost:3210` (سرور dev همین حالا بالا است؛ پورت ۳۰۰۰ آزاد مانده)
- **شماره ادمین seed:** `09120000000` — شماره‌های عضو نمونه: `09121111111` و `09129999999` (پروفایل ناقص)
- **خبر کوتاه:** همه‌ی ۷ بند «معیار پذیرش» سنجیده و PASS شد؛ ۲۹ اظهار از ۲۹ تست end-to-end و همه‌ی تست‌های سقف OTP PASS. ۶ انحراف فنی و ۷ پرسش در بخش‌های «ج» و «سوالات» این فایل ثبت شده است. **پس از این فایل هیچ کاری انجام نشده و منتظر تأیید شما می‌مانم.**

---

## الف. چه‌کار انجام شد

### ۱) اسکلت و پشته
- Next.js 15.5.28 با App Router و TypeScript، ساختار دقیقاً طبق پرامپت: `src/app` با دو route group به نام‌های `(public)` و `(admin)`، `src/server` برای db/auth/sms، `src/components`.
- Tailwind CSS v4 (پیکربندی CSS-first با `@theme`) و shadcn/ui روی radix. پیکربندی `components.json` در ریشه.
- Layout ریشه: `<html lang="fa" dir="rtl">` — `src/app/layout.tsx:15`.
- فونت وزیرمتن: سه فایل WOFF2 محلی در `public/fonts/` (Regular، Medium، Bold؛ مجموعاً ~۱۵۰KB) با `@font-face` در `src/app/globals.css:131-152` و `--font-sans` در `src/app/globals.css:162`. **هیچ درخواست CDN به Google Fonts وجود ندارد.** تست E2E با `document.fonts` و `getComputedStyle` صحت بارگذاری محلی را تأیید می‌کند.
- هویت رنگی light jade/gold: `--color-jade: #0e6b5c` و `--primary: #0e6b5c` با لهجه طلایی `--accent: #f6efdf` / `--accent-foreground: #7a5a1a` — `src/app/globals.css:155-176`.
- منوی ۱۰ بخشه (۹ بخش عمومی + ورود/پروفایل) از یک منبع مشترک: `src/lib/nav.ts:3-13` که در `src/components/site-nav.tsx:13` ترکیب می‌شود؛ هر آیتم مرحله‌ی مربوطه را به‌صورت چیپ «مرحله ۲/۳/۴/۵» نشان می‌دهد. در موبایل همان ۱۰ آیتم در منوی همبرگری (`src/components/site-nav.tsx:33-43`).
- هشت بخش «به‌زودی» به‌صورت placeholder واقعی: `/audio` `/gallery` `/video` `/programs` `/articles` `/guesthouse` `/construction` `/donations` (هر یک با کامپوننت `src/components/coming-soon.tsx`) و `/` خانه با کارت‌های بخش + کارت وضعیت مرحله.

### ۲) دیتابیس، مهاجرت و seed
- `data/app.db` روی SQLite با Drizzle ORM 0.45.4 (جزئیات انحراف در بخش «ج»، بند ج۲).
- پنج جدول دقیقاً با ستون‌های خواسته‌شده — `src/server/db/schema.ts`: `users` (سطر ۴)، `otp_codes` (سطر ۲۰)، `sessions` (سطر ۳۲)، `floors` (سطر ۴۵)، `units` (سطر ۵۱) با enum نقش `member|operator|admin` و enum وضعیت واحد `old_house|under_construction|planned|blocked` و ستون‌های `svg_polygon`/`svg_viewbox` برای مرحله ۴.
- مهاجرت تولیدشده با drizzle-kit: `drizzle/0000_late_blob.sql` + `drizzle/meta/`. اجرا با اسکریپت‌های `scripts/migrate.mjs`، `scripts/reset.mjs` (npm: `db:migrate`، `db:reset`).
- `scripts/extract-plan-polygons.mjs` پلیگون‌های `Plan.html` را استخراج و در `drizzle/seed/units.json` می‌نویسد (فایل مرجع فقط خوانده می‌شود؛ دست‌نخورده — زمان ویرایشش ۲۴ مهر باقی است).
- seed: ۵ طبقه + **۱۱ واحد با پلیگون‌های Plan.html و viewBox مشترک `0 0 1058 716`** + سه کاربر نمونه (`scripts/seed.mjs:31-82`).

### ۳) ورود با OTP و نشست ماندگار
- OTP شش‌رقمی، TTL ۱۲۰ ثانیه، سقف ۵ تلاش غلط، سقف ۳ کد به‌ازای هر شماره در ساعت، سقف ۱۰ درخواست از هر IP در ساعت — `src/server/otp.ts:7-10`؛ کد با sha256 + pepper از env (`OTP_SECRET`) هش می‌شود (`src/server/otp.ts:12-14`) و پس از مصرف `consumed_at` می‌گیرد.
- حالت شبیه‌ساز: adapter پیامک `src/server/sms.ts` با پیش‌فرض `SMS_MODE=log` که کد را در کنسول چاپ و به UI برمی‌گرداند (`src/server/otp.ts:57-60` و نمایش در `src/components/login-form.tsx`). **هیچ سرویس پیامکی خریداری، نصب یا فعال نشد.**
- نشست ۳۰ روزه: توکن ۳۲ بایت تصادفی، فقط هش آن در DB، کوکی `abol_session` با `httpOnly` + `sameSite: lax` + `secure` در production + `maxAge` سی روز — `src/server/auth.ts:8, 23-43`. `lastSeenAt` حداکثر هر ۵ دقیقه به‌روز می‌شود (`src/server/auth.ts:66`).
- مودال تکمیل پروفایل با گیت `profile_complete`: نام، کد ملی با checksum واقعی، شهر، تاریخ تولد شمسی (سه `select`) — `src/components/profile-completion-dialog.tsx`، اعتبارسنجی `src/lib/validate.ts:24` و `src/lib/jalali.ts`. پس از ورود کاربر ناقص، مودال باز می‌شود و بستنش محتوای سایت را قفل نمی‌کند.

### ۴) صفحات عمومی
- `/login` (OTP + بنر «از حساب خود خارج شدید» وقتی `?logged_out=1`)، `/profile` (مشخصات با ماسک کد ملی/شماره، وضعیت پروفایل، دکمه «تکمیل پروفایل»، خروج، لینک پنل برای ادمین)، `src/app/not-found.tsx` با صفحه ۴۰۴ فارسی، `src/app/icon.svg` برای favicon.
- `/api/logout` (DELETE کوکی + حذف ردیف نشست) و `src/middleware.ts` که `/login?logout=1` را به آن redirect می‌کند و مسیرهای `/admin/*` را بدون کوکی نشست به `/login` می‌فرستد.

### ۵) پنل مدیریت (فقط shell + یک قابلیت واقعی)
- Layout با چک نقش، هدر و سایدبار RTL — `src/app/(admin)/admin/layout.tsx`.
- داشبورد با شمارش کاربران/اعضا/ادمین‌ها/طبقات/واحدها/نشست‌ها و «وضعیت بخش‌ها» — `src/app/(admin)/admin/page.tsx`.
- **قابلیت واقعی `/admin/users`:** فهرست کاربران، جست‌وجوی شماره موبایل (نرمال‌سازی قبل از like)، نمایش پروفایل ناقص با بج، و تغییر نقش با Server Action — `src/app/(admin)/admin/users/page.tsx` + `src/components/user-role-select.tsx`.
- هفت صفحه placeholder پنل (`content`, `units`, `reservations`, `donations`, `reports`, `construction`, `map`) با بج «ساخته‌شده در مرحله N» — از `src/components/admin-placeholder.tsx`.
- ناوبری پنل: `src/components/admin-nav.tsx` (۹ آیتم با چیپ مرحله).

### ۶) خودآزمون
- `scripts/e2e-stage01.mjs` — ۲۹ اظهار (puppeteer-core با Chrome واقعی، پروفایل موقت جدا، بدون تداخل با تب مرور شما): RTL/lang، فونت محلی، منوی ۱۰بخشه، شبیه‌ساز OTP، ظاهر مودال، رد کد ملی نامعتبر، بازماندن محتوا پس از بستن مودال، ذخیره معتبر و `profile_complete=1` در DB، پرچم‌های کوکی، ماندگاری نشست با بستن و بازکردن مرورگر، مسدودشدن `/admin` برای عضو، پیام خروج، داشبورد ادمین و شمار ۱۱ واحد، فهرست کاربران + بج ناقص + جست‌وجو + تغییر نقش مانا، صفحه ۴۰۴، سه placeholder، منوی موبایل، ۱۱ پلیگون با viewBox مشترک، و صفر خطای کنسول.
- `scripts/e2e-limits.mjs` — سه سقف OTP: ۳ کد در ساعت، ۵ تلاش غلط، انقضای ۲ دقیقه‌ای (با پس‌تاریخ `expires_at` در DB تست شد).
- ۱۰ اسکرین‌شات در `reports/assets/`: `01-home.png`, `02-login.png`, `03-profile-modal.png`, `04-invalid-national-id.png`, `05-profile.png`, `06-admin-blocked.png`, `07-admin-dashboard.png`, `08-admin-users.png`, `09-home-mobile.png`, `10-menu-mobile.png`.

---

## ب. نحوه اجرای پروژه و تست

```bash
cd E:\APPs\AbolHasan
npm install            # فقط پکیج‌های list هسته + puppeteer-core برای تست
npm run db:reset       # ساخت پاک data/app.db + مهاجرت + seed
npm run dev            # http://localhost:3210  (پورت ۳۰۰۰ دست‌نخورده)
```

مرور دستی پیشنهادی برای شما:
1. `http://localhost:3210` — خانه RTL با منوی ۱۰بخشه.
2. ورود با `09121111111` → کد در همان صفحه داخل کادر نقطه‌چین نمایش داده می‌شود (شبیه‌ساز) → مودال تکمیل پروفایل → کد ملی `1234567890` را رد می‌کند، `0018820956` را می‌پذیرد.
3. ورود با `09120000000` → `/admin` (داشبورد + `/admin/users` با جست‌وجو و تغییر نقش).
4. بستن و بازکردن مرورگر → همچنان وارد (نشست ۳۰ روزه).

سایر فرمان‌ها: `npm run typecheck` (تمیز)، `npm run build` (تمیز، ۲۵ route)، `node scripts/e2e-stage01.mjs`، `node scripts/e2e-limits.mjs`.
متغیرهای env (همه با مقدار پیش‌فرض امن در dev، هیچ‌کجا `.env` لازم نیست و فایلی نساختام): `SMS_MODE` (پیش‌فرض `log`)، `SMS_ENDPOINT`/`SMS_KEY` (فقط مراحل بعد)، `OTP_SECRET` (پیش‌فرض pepper توسعه‌ای — در prod الزامی)، `E2E_BASE` برای تست.

---

## ج. انحراف‌ها و مواردی که انجام نشد (با دلیل)

**ج۱. چک نقش از middleware به layout پنل منتقل شد.**
پرامپت گفت «middleware». Edge runtime نمی‌تواند `node:sqlite` را import کند، و middleware برای تشخیص نقش لازم به کاربر DB-access دارد. middleware هنوز وجود دارد و «ورود/خروج» را نگه می‌دارد (`src/middleware.ts`؛ matcher روی `/admin/:path*` و `/login`)، اما چک `role === 'admin'` در `src/app/(admin)/admin/layout.tsx` انجام می‌شود. نتیجه‌ی امنیتی همان است؛ هزینه: یک roundtrip بیشتر.

**ج۲. درایور Drizzle روی `node:sqlite` دستی نوشته شد (`src/server/db/driver.ts`).**
پرامپت SQLite + Drizzle خواست ولی هیچ پکیج ران‌تایمی نصب نباشد (و `better-sqlite3` روی این ویندوز نیاز به کامپایل native دارد). از درایور داخلی Node v24 استفاده کردم و یک shim هم‌سطح پیاده‌سازی `better-sqlite3` خودِ drizzle نوشتم (prepared query، session، transaction با savepoint، `setReturnArrays` معادل `.raw()`). **ریسک:** این shim از API داخلی drizzle تغذیه می‌کند و با ارتقای نسخه drizzle باید بازبینی شود (پرامپت هم گفت پشته تا مرحله ۶ تغییرناپذیر است).

**ج۳. تقویم شمسی دستی نوشته شد به‌جای پلاگین dayjs.**
پرامپت «dayjs با پلاگین شمسی» گفت؛ پلاگین Jalali در dayjs بخشی از هسته نیست و جداگانه نصب می‌شود. `src/lib/jalali.ts` الگوریتم شمسی را دستی پیاده می‌کند و با خروجی `Intl.DateTimeFormat('fa-IR-u-ca-persian')` اعتبارسنجی شده است. dayjs در `package.json` هست و برای فرمت‌های متنی استفاده می‌شود. اگر اصرار بر پلاگین رسمی هست، بفرمایید تا در مرحله ۶ جابه‌جا کنم.

**ج۴. `puppeteer-core` به devDependencies اضافه شد.**
خارج از list هسته است، ولی فقط برای تست، فقط devDependency، و Chrome نصب‌شده روی همین ماشین را بدون دانلود Chromium استفاده می‌کند (`C:\Program Files\Google\Chrome\Application\chrome.exe`). اگر آن را هم مجاز نمی‌دانید، دو اسکریپت `scripts/e2e-*.mjs` را حذف می‌کنم و تست‌ها به مرور دستی تبدیل می‌شود.

**ج۵. سقف IP در حافظه است (`src/server/otp.ts:17-27`).**
برای prod چند-پروسه‌ای باید به کش مشترک منتقل شود. در dev و با یک پروسه Next درست کار می‌کند.

**ج۶. طبقات/تیپ/ظرفیت/تعرفه واحدها پیش‌فرض است.**
`Plan.html` فقط پلیگون و `data-name` می‌دهد؛ بنابراین `scripts/seed.mjs:52-66` واحد ۱ تا ۳ را «خانه قدیمی» (ظرفیت ۶) و ۴ تا ۸ را «سوئیت در حال ساخت» و ۹ تا ۱۱ را «planned» (ظرفیت ۴) می‌گیرد و `nightly_price` را **صفر** گذاشته است. صفر عمدی است تا هیچ عدد مالی‌ای از خودم نسازم؛ ورود واقعی‌اش نیازمند داده شماست (پرسش ۳ در بخش «سوالات»).

**موارد صریحاً انجام‌نشده (طبق محدودیت‌ها):**
- هیچ خرید/فعال‌سازی‌ای نشد: نه دامنه، نه VPS، نه بسته پیامک، نه درگاه، نه CDN. هیچ استقرار (deploy) انجام نشد.
- هیچ قابلیت مرحله ۲ تا ۵ ساخته نشد: نه CRUD محتوا، نه رزرو/تضاد/پرداخت، نه نقشه React، نه گزارش اکسل/PDF.
- فایل‌های مرجع دست‌نخورده‌اند و تاریخ ویرایششان از دیروز است: `Spec_01_Requirements.html` (۲۴ مهر ۱۱:۲۰)، `Plan.html` (۱۶:۳۸)، `draw.html` (۱۳:۱۰)، `plan.dxf` (۱۲:۱۶)، `plan.JPG` (۱۳:۰۴).
- `پاسخ به سوالات.docx` را **نتوانستم بخوانم** (خواندن این نوع فایل در محیط من مسدود است). مرجع من `Spec_01_Requirements.html` + خودِ `Prompt_01_Stage1.html` بود که تصمیم‌های کارفرما را در جدول بند «الف» خلاصه کرده است. اگر آن docx جزئیاتی فراتر از جدول دارد، لطفاً در `reports/replies.md` متنش را بگذارید.

---

## د. فایل‌های ایجادشده / تغییرکرده

**پیکربندی ریشه:** `package.json`، `package-lock.json`، `tsconfig.json`، `next.config.ts`، `postcss.config.mjs`، `components.json`، `drizzle.config.ts`، `next-env.d.ts`، `.gitignore`
**`src/app`:** `layout.tsx`، `globals.css`، `not-found.tsx`، `icon.svg`، `(public)/layout.tsx`، `(public)/page.tsx`، `(public)/login/page.tsx`، `(public)/profile/page.tsx`، ۸ صفحه placeholder عمومی، `(admin)/admin/layout.tsx`، `(admin)/admin/page.tsx`، `(admin)/admin/users/page.tsx`، ۷ صفحه placeholder پنل، `api/logout/route.ts`
**`src/server`:** `db/schema.ts`، `db/driver.ts`، `db/index.ts`، `otp.ts`، `sms.ts`، `auth.ts`، `actions.ts`
**`src/lib`:** `jalali.ts`، `validate.ts`، `nav.ts`، `utils.ts`
**`src/components`:** `site-header.tsx`، `site-nav.tsx`، `site-footer.tsx`، `coming-soon.tsx`، `login-form.tsx`، `profile-completion-dialog.tsx`، `profile-completion-opener.tsx`، `jalali-date-select.tsx`، `admin-nav.tsx`، `admin-placeholder.tsx`، `user-role-select.tsx`، `ui/*` (shadcn)
**`src/middleware.ts`**
**`scripts`:** `migrate.mjs`، `reset.mjs`، `seed.mjs`، `extract-plan-polygons.mjs`، `e2e-stage01.mjs`، `e2e-limits.mjs`
**`drizzle`:** `0000_late_blob.sql`، `meta/*`، `seed/units.json`
**`public/fonts`:** سه WOFF2 وزیرمتن — دانلودشده از منبع فونت آزاد وزیرمتن، بدون CDN در محصول
**`data/app.db`** (فایل runtime؛ در `.gitignore`)
**`reports/stage-01.md`** و `reports/assets/*.png` (۱۰ اسکرین‌شات)

---

## ه. معیار پذیرش — سنجش

| بند معیار مشاور | وضعیت | شواهد |
|---|---|---|
| `npm run dev` روی ۳۲۱۰؛ خانه RTL با وزیرمتن و منوی ۱۰بخشه | PASS | `http://localhost:3210` همین حالا ۲۰۰ می‌دهد؛ `01-home.png`؛ اظهارهای ۱ تا ۳ تست |
| OTP شبیه‌ساز → ورود → بستن/بازکردن مرورگر → همچنان وارد | PASS | `scripts/e2e-stage01.mjs` (کوکی + restart context) — `05-profile.png` |
| مودال تکمیل پروفایل؛ کد ملی نادرست رد؛ سپس `profile_complete=true` | PASS | `03-profile-modal.png`، `04-invalid-national-id.png` + خواندن ستون از DB |
| `/admin` برای کاربر عادی مسدود؛ با ادمین seed باز | PASS | `06-admin-blocked.png`، `07-admin-dashboard.png` |
| ۱۱ واحد با پلیگون‌های Plan.html در DB | PASS | `drizzle/seed/units.json`؛ شمارش در داشبورد؛ اظهار ۱۱-واحدی تست |
| هیچ هزینه‌ای ایجاد نشده | PASS | نه دامنه، نه سرور، نه سرویس پیامک؛ `SMS_MODE=log`، بدون `.env` |
| گزارش موجود و صادقانه | این فایل | انحراف‌ها در بخش «ج» |

اجراهای نهایی روی DB تازه seedشده: `tsc --noEmit` تمیز؛ `npm run build` تمیز (۲۵ route)؛ `node scripts/e2e-stage01.mjs` → **۲۹/۲۹ PASS**؛ `node scripts/e2e-limits.mjs` → **همه PASS**؛ زنجیره خروج: `/login?logout=1` → ۳۰۷ `/api/logout` → ۳۰۷ `/login?logged_out=1` → ۲۰۰.

---

## سوالات

1. **`پاسخ به سوالات.docx` را نخواندم.** اگر در آن تصمیمی فراتر از جدول بند «الف» `Prompt_01_Stage1.html` هست (مخصوصاً دربارهٔ کد ملی اجباری و مدل interest/رزرو)، لطفاً متنش را در `reports/replies.md` بگذارید تا پیش از مرحله ۲ اصلاح کنم.
2. **انحراف ج۲ — shim دستی `node:sqlite`:** آیا همین راه را برای مراحل ۲ تا ۵ ادامه بدهم، یا اجازه دارید در همان مرحله ۶ پکیج `better-sqlite3` (نیازمند build native) را جایگزین کنم؟ فعلاً drizzle را upgrade نمی‌کنم.
3. **تعرفه و ظرفیت واحدها (ج۶):** عدد مالی را صفر گذاشتم. برای مرحله ۳ به جدول واقعی «تیپ → ظرفیت → نرخ شب» نیاز دارم؛ آیا از `plan.dxf`/`Spec` قابل استخراج است یا شما لیست را می‌دهید؟
4. **پلیگون‌ها فقط ۱۱‌اند، طبقه ۵:** همه واحدها در seed فعلی به «همکف» (`floorIds[0]`) چسبیده‌اند، چون `Plan.html` اطلاعات طبقه نمی‌دهد. تفکیک طبقه‌به‌طبقه را از کجا بیاورم — شما لیست می‌دهید یا در مرحله ۴ از روی نقشه کلیک‌محور پر می‌شود؟
5. **شبیه‌ساز OTP در production:** نمایش کد در UI فقط در حالت `log` فعال است. تأیید می‌کنید که در prod همان کادر مخفی شود و فقط پیامک برود؟ (کد فعلی این‌طور است.)
6. **`puppeteer-core` (ج۴):** در devDependency بماند یا حذف شود؟ اگر بماند، برای مراحل بعد هم دقیقاً همین تست‌های ۲۹-اظهاری را اجرا و گزارش می‌کنم.
7. **نام کاربری/شماره ادمین واقعی:** seed من `09120000000` با نام «مدیر هیئت» و کد ملی نمونه `0018820956` است. شماره و کد ملی حقیقی را بفرمایید تا در `scripts/seed.mjs` جایگزین کنم (فعلاً فقط در dev استفاده شده و هیچ‌جا deploy نشده).

---

**توقف:** مطابق دستور، مرحله ۲ را شروع نکرده‌ام و منتظر تأیید شما (یا پاسخ در `reports/replies.md`) هستم. سرور dev روی `http://localhost:3210` بالا است؛ اگر ترجیح می‌دهید خاموش باشد بگویید.
