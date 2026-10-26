# گزارش مرحله ۲ — محتوای عمومی

- **نویسنده:** دستیار کدنویس (شناسه نشستن `346d0d78-1f00-46a0-973f-11178d7cfc84`)
- **تاریخ:** ۴ آبان ۱۴۰۵
- **پرامپت اجراشده:** فقط بخش «ب. پرامپت مرحله ۲» از `Prompt_02_Stage2.html` (پیش از آن `reports/replies.md` خوانده شد)
- **آدرس تست:** `http://localhost:3210` (سرور dev همین حالا بالا است؛ پورت ۳۰۰۰ آزاد مانده)
- **خبر کوتاه:** پنج بخش عمومی زنده شد + پنل مدیریت محتوا + seed نمونه. `scripts/e2e-stage02.mjs` → **۶۱ اظهار از ۶۱ PASS**؛ رگرسیون‌ها `e2e-stage01.mjs` → **۲۹/۲۹ PASS** و `e2e-limits.mjs` → **همه PASS**؛ `tsc --noEmit` و `npm run build` تمیز (۲۹ route). هر ۷ بند چک‌لیست پذیرش سنجیده شده در بخش «ه». ۹ انحراف و ۸ پرسش در بخش‌های «ج» و «سوالات». **پس از این فایل کاری انجام نشده و منتظر تأیید شما می‌مانم.**

---

## الف. چه‌کار انجام شد

### ۱) مدل داده و migration (داده مرحله ۱ دست‌نخورده)

نه جدول جدید در `src/server/db/schema.ts` (سطر ۷۵ به بعد)، دقیقاً با ستون‌های پرامپت:

| جدول | سطر | نکته |
|---|---|---|
| `categories` | `src/server/db/schema.ts:75` | `kind: article|audio|video|program` |
| `media_assets` | `:84` | `kind`, `original_name`, `stored_path` (یکتا), `mime`, `size_bytes`, `duration_sec` nullable |
| `audios` | `:98` | `occasion: moharram|ramadan|fatimiye|other` + `asset_id` |
| `albums` | `:115` | `cover_asset_id` |
| `photos` | `:125` | `album_id` + `sort` |
| `persons` | `:135` | `slug`, `bio`, `is_deceased`, `main_photo_id`, `album_id` |
| `videos` | `:148` | `program_date_jalali` (متن شمسی، همان‌طور که پرامپت خواست) |
| `programs` | `:164` | `kind: ceremony|lecture|class|other`, `is_cancelled` |
| `articles` | `:180` | `slug` یکتا، `body_markdown`, `excerpt`, `tags` متن جداشده با کاما |

- migration: `drizzle/0001_even_wallow.sql` (۱۱۰ سطر) با `npm run db:migrate`؛ اکثر کلیدهای خارجی `ON DELETE no action` تولید شده‌اند و فقط `photos.album_id` روی `cascade` است؛ پس حذف آلبوم در DB عکس‌هایش را پاک می‌کند ولی هیچ FK ای رکورد `media_assets` را خودکار حذف نمی‌کند — پاک‌سازی رسانه دستِ کد اپ است و فقط پس از بررسی ارجاع‌ها (بند ج۳).
- صحت حفظ داده مرحله ۱ در شمارش پایانی DB: `users=4`, `floors=5`, `units=11` (همان مقادیر تأییدشده شما) در کنار `articles=4`, `audios=4`, `albums=2`, `photos=6`, `persons=2`, `videos=2`, `programs=4`, `categories=2`, `media_assets=20`.

### ۲) فایل‌ها: آپلود، سرو، Range و دفاع path traversal

- قوانین آپلود در یک config: `src/server/storage.ts:19` (`UPLOAD_RULES`) — صوت `mp3/wav/m4a` سقف ۵۰MB، تصویر `jpg/jpeg/png/webp` سقف ۱۰MB، ویدئو `mp4/webm` سقف ۵۰MB؛ `validateUpload` (`:51`) هم پسوند و هم MIME را می‌سنجد و پیام فارسی می‌دهد (خطاهای «پسوند مجاز نیست…»، «نوع فایل مجاز نیست…»، «حجم فایل از سقف…').
- ذخیره: `saveAsset` (`:83`) فایل را با نام تصادفی ۲۴ رقم هگز در `storage/uploads/<kind>/<stem>.<ext>` می‌نویسد (خارج از `public/`)؛ پوشه در `.gitignore:10` (`storage/uploads`).
- سرو: `src/app/api/files/[...path]/route.ts` **فقط** `stored_path` ثبت‌شده در `media_assets` را می‌پذیرد (lookup با `WHERE stored_path = ?`)؛ اگر رکورد نبود ۴۰۴ می‌دهد. لایه‌ی دوم: `absolutePathOf` (`src/server/storage.ts:132`) مسیر را resolve می‌کند و اگر از `STORAGE_ROOT` بیرون بزند `null` برمی‌گرداند. یعنی ورودی خام path هرگز به filesystem نمی‌رسد.
- Range: `parseRange` (`route.ts:16`) تک‌بازه ساده و بازه پسوندی (`bytes=-N`) را می‌فهمد؛ پاسخ‌ها: `206` با `Content-Range` و `Content-Length` (`:106-109`)، `416` با `bytes */<size>` (`:90`)، و همه پاسخ‌ها `Accept-Ranges: bytes` (`:39`) + `X-Content-Type-Options: nosniff` (`:41`). برای `image/svg+xml` یک `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` افزوده می‌شود (`:46`) تا SVG آپلودی اسکریپت اجرا نکند.
- حذف امن: `deleteContentAction` (`src/server/content-actions.ts:453`) اول ردیف محتوا را پاک می‌کند و بعد `deleteAssetIfUnused` (`src/server/storage.ts:203`) که با `countAssetReferences` بررسی می‌کند هیچ ردیف دیگری آن رسانه را مرجوع نکرده باشد؛ آنگاه فایل روی دیسک هم `unlink` می‌شود. جایگزینی فایل در ویرایش هم همان مسیر را می‌رود (رسانه‌ی بی‌استفاده قدیمی پاک می‌شود).
- سقف بدنه: `next.config.ts:6` با `experimental.serverActions.bodySizeLimit = '512mb'` تا سقف ۵۰۰MB ویدئو در پنل عملاً کار کند (انحراف ج۶).

### ۳) صفحات عمومی — همه SSR با `generateMetadata` و OG فارسی

همه‌ی صفحات DB‌محور `export const dynamic = 'force-dynamic'` دارند تا تغییرات پنل بلافاصله دیده شود.

- `/audio` (`src/app/(public)/audio/page.tsx` + `src/components/audio-list.tsx`): کارت‌ها، فیلتر **مناسبت** و **راوی** و **مرتب‌سازی تاریخ** (`?occasion=&narrator=&sort=new|old` با لینک‌های SSR). پلی‌کننده چسبان پایین صفحه (`src/components/audio-player.tsx`) در `AudioPlayerProvider` روی layout گروه `(public)` سوار است (`src/app/(public)/layout.tsx:11`)، پس با ناوبری سمت کلاینت (کلیک روی لینک‌های منو) پخش قطع نمی‌شود؛ نوار زمان، پخش/توقف و پرش روی زمان.
- `/gallery` گرید آلبوم‌ها ← `/gallery/[id]` با `src/components/photo-grid.tsx`: lightbox روی radix Dialog، پیمایش با کلیدهای جهت (در RTL معکوس شده: کلید چپ = بعدی)، `Esc` برای بستن، شمارنده «۲ از ۳» و زیرنویس عکس.
- `/gallery/persons` کارت اشخاص با نشان «متوفی — روحش شاد» ← `/gallery/persons/[slug]` معرفی‌نامه‌ی markdown‌دار + گالری عکس‌های همان شخص (عکس اصلی از `main_photo_id`).
- `/video` گرید با بندانگشتی کاور ← `/video/[id]` با بازیکن HTML5. اگر رکورد DB باشد ولی فایل روی میزبان نرسیده باشد، به‌جای منبع شکسته پیام فارسی «فایل این ویدئو هنوز روی میزبان نیست» و بج «فایل هنوز به میزبان نرسیده» نشان داده می‌شود (`src/app/(public)/video/[id]/page.tsx:47`؛ انحراف ج۵).
- `/programs` دو ستون «پیش‌رو» / «برگزارشده» که جداسازی با **امروز شمسی** انجام می‌شود (`listProgramsGrouped` در `src/server/content.ts:247`) + چیپ «لغوشده»؛ صفحه جدا مطابق پرامپت ساخته نشد.
- `/articles` لیست + فیلتر **دسته** و **برچسب** ← `/articles/[slug]` با تایپوگرافی RTL: `dir="rtl"`، `line-height: 2.1` (در تست ۳۵.۷px برای فونت ۱۷px = 1.0625rem)، عرض متن محدود، تصاویر داخل متن `max-width:100%`.
- markdown: `src/lib/markdown.ts` دست‌ساز (هدینگ h1-h3، پاراگراف، `**bold**`/`*italic*`، لیست بی‌ترتیب و مرتب‌دار، لینک، تصویر، blockquote، کد inline) و خروجی با whitelist sanitize می‌شود (`ALLOWED_TAGS` سطر ۵۷، `sanitizeHtml` سطر ۸۱)؛ لینک‌های بیرونی `target="_blank" rel="noopener noreferrer nofollow"` می‌گیرند (سطر ۴۶). پکیج `marked` لازم نشد و نصب نکردم.
- slug فارسی: `src/lib/slug.ts` حروف عربی/فارسی را یکسان‌سازی می‌کند (ی/ک، اعراب، نیم‌فاصله، نشانه‌های جهت) و در ستون‌های `slug` یکتا با پسوند عددی برخورد را حل می‌کند (`nextSlugFromCollision`).
- خانه `/`: placeholder‌ها با کارت‌های واقعی جایگزین شد — ۳ آخرین مقاله، ۳ آخرین صوت، ۳ برنامه پیش‌رو، لینک آلبوم اشخاص، بنر کوچک «پیشرفت ساخت» با بج «مرحله ۵» (`src/app/(public)/page.tsx:47` چیپ مرحله را فقط برای بخش‌های نیامده می‌گذارد).

### ۴) پنل مدیریت محتوا

`/admin/content` با شش سربرگ (`src/app/(admin)/admin/content/page.tsx:18`): مقالات، صوت، تصویر و آلبوم و اشخاص، ویدئو، برنامه‌ها، دسته‌ها. هر سربرگ فهرست ردیف‌ها + فرم ساخت/ویرایش (`?tab=…&edit=<id>|new`).

- فرم‌ها Server Action با اعتبارسنجی سمت سرور: `src/server/content-actions.ts` (۵۱۸ سطر، هفت اکشن save + toggle + delete). همه با چک `role === 'admin'` (`:27`)؛ دسترسی مثل مرحله ۱ و هیچ تغییری در منطق auth.
- فیلد `is_published` در هر فرم و بج/کلید «منتشر/پیش‌نویس» + سوییچ «ثبت» در فهرست (`src/components/admin/row-actions.tsx`).
- ویرایش markdown مقاله: textarea + **پیش‌نمایش کنار هم** (`src/components/admin/content-form.tsx:181` با `lg:grid-cols-2`) — WYSIWYG ساخته نشد.
- تاریخ انتشار ورودی مدیر **شمسی** است (سه `select` در `jalali-date-select`) و در DB میلادی (`ISO`) ذخیره می‌شود؛ `src/lib/jalali.ts` تبدیل `jalaliToGregorianIso`/`formatJalaliFromIso` را می‌دهد.
- آپلود از پنل با `input type=file` و `FormData` multipart؛ فرم عمداً `encType` ندارد (React برای action تابعی خودش ست می‌کند).
- دکمه حذف با `window.confirm` و پاک‌سازی رسانه (بند ۲).

### ۵) seed نمونه

`scripts/seed-content.mjs` (۵۳۹ سطر، با `npm run db:seed:content` اجرا می‌شود؛ بیرون از `npm run db:reset` است (reset فقط seed مرحله ۱ را می‌گذارد)، پس بعد از reset باید دستی صداش کرد):

- **صوت:** ۴ فایل WAV ۳ ثانیه‌ای با تون + نویز ملایم (`wavBuffer` سطر ۸۲) — فرکانس‌های متفاوت؛ حجم هر فایل ۱۳۲KB.
- **تصویر:** SVG placeholder با نام آلبوم/شخص/مقاله (`svgPlaceholder` سطر ۱۱۸) — ۱۴ فایل؛ چون SVG آپلودی است، همان CSP sandbox روی آن هم اجرا می‌شود.
- **ویدئو:** دو رکورد DB با `media_assets` ثبت‌شده ولی **فایل ندارد** (به‌عمق، طبق پرامپت) تا حالت «فایل موجود نیست» تست شود. `stored_path` این دو: `video/sample-video-moharram-sermon.mp4` و `video/sample-video-fatimiye-elegy.mp4`.
- مقادیر: ۲ دسته (تاریخچه هیئت، معارف و قرآن)، ۴ برچسب، ۴ صوت با راوی/مناسبت مختلف، ۲ آلبوم + ۶ عکس، ۲ شخص (یکی متوفی با معرفی‌نامه markdown‌دار و عکس اصلی)، ۲ ویدئو، ۴ برنامه (پیش‌رو/برگزارشده/لغوشده)، ۴ مقاله (۳ منتشر + ۱ پیش‌نویس برای نشان‌دادن سوییچ).
- **جایگزینی فایل ویدئو توسط کارفرما (دو راه، هر دو تست‌شده):** (۱) از پنل `/admin/content?tab=video` → ویرایش → انتخاب فایل mp4/webm → ذخیره (فایل قدیمی بی‌استفاده پاک می‌شود)؛ یا (۲) کپی مستقیم فایل با همان نام `stored_path` در `storage/uploads/video/`. بررسی کردم: با کپی یک فایل موقت در آن مسیر، `/video/3` تگ `<video src="/api/files/video/sample-video-moharram-sermon.mp4">` و بج «فایل ثبت‌شده و موجود» داد و درخواست Range با `206` پاسخ داد؛ پس از حذف فایل، همان صفحه دوباره پیام «فایل این ویدئو هنوز روی میزبان نیست» را نشان داد (فایل موقت پاک شد و DB به حالت seed برگشت).

### ۶) تست و تحویل

- `scripts/e2e-stage02.mjs` (۷۳۷ سطر، **۶۱ اظهار، همه PASS**) با puppeteer-core و Chrome واقعی روی ۳۲۱۰ و پروفایل کاربری موقت (بدون تداخل با تب مرورگر شما). پوشش: داده seed؛ خانه (نبودِ چیپ «به‌زودی/مرحله» برای پنج بخش زنده و بودنش فقط برای مهمانسرا/نذورات/پیشرفت؛ کارت‌های واقعی)؛ پخش صوت + دریافت `206` از شبکه + داشتن `Content-Range` + زنده‌ماندن پخش پس از ناوبری؛ فیلتر مناسبت و راوی؛ مقاله (ساختار markdown، RTL/line-height، OG در HTML و `og:title` در view-source، تصویر وسط متن با عرض کامل)؛ فیلتر دسته؛ گرید آلبوم و lightbox (قبلی/بعدی/Esc)؛ صفحه شخص متوفی (برچسب + معرفی‌نامه + عکس)؛ دو ستون برنامه‌ها با امروزِ شمسی + چیپ لغوشده؛ پیام نبود فایل ویدئو؛ **چرخه کامل پنل**: رد آپلود با پسوند نامجاز → ساخت مقاله با PNG واقعی آپلودی → دیدن همان مقاله در صفحه عمومی با تصویر آپلودی → unpublish → ۴۰۴ عمومی و `is_published=0` در DB → حذف → نبودن ردیف، نبودن رکورد `media_assets` و نبودن فایل روی دیسک → ۴۰۴ نشانی قدیم؛ شش سربرگ پنل؛ خانه و آرشیو صوت در ویوپورت موبایل.
- **تست‌های HTTP خام** (`node:net`، مسیر دست‌نخورده بدون نرمال‌سازی curl) — نتایج واقعی ثبت‌شده در بخش «ه»: Range کامل `200` با `Accept-Ranges: bytes` و `Content-Length: 132344`؛ `bytes=100-199` → `206 bytes 100-199/132344` با ۱۰۰ بایت بدنه؛ `bytes=-50` → `206 bytes 132294-132343/132344`؛ `bytes=999999-` → `416 bytes */132344`؛ هفت پراب path traversal و یک مسیر اضافی بعد از فایل → همگی `404`. صفر خطای کنسول در همه‌ی صفحات (۴۰۴های عمدی و فایل ویدئوی عمدیِ نبود، از پیش در فهرست استثنا).
- رگرسیون: `e2e-stage01.mjs` و `e2e-limits.mjs` (جزئیات بند ج۸).
- `npx tsc --noEmit` خروج ۰؛ `npm run build` خروج ۰ (۲۹ route؛ ۲۷ داینامیک).
- ۱۲ اسکرین‌شات در `reports/assets/stage-02/`: `01-home.png`, `02-audio-player.png`, `03-article.png`, `03b-article-image.png`, `04-lightbox.png`, `05-person-deceased.png`, `06-programs.png`, `07-video-missing.png`, `08-panel-article-created.png`, `09-panel-gallery.png`, `10-home-mobile.png`, `11-audio-mobile.png`.

---

## ب. نحوه اجرا

```bash
cd E:\APPs\AbolHasan
npm install
npm run db:reset          # پاککردن data/app.db + مهاجرت ۰۰۰۰ و ۰۰۰۱ + seed مرحله ۱
npm run db:seed:content   # seed محتوای مرحله ۲ و فایل‌های نمونه در storage/uploads
npm run dev               # http://localhost:3210  (پورت ۳۰۰۰ دست‌نخورده)
node scripts/e2e-stage02.mjs   # ۶۱ اظهار
node scripts/e2e-stage01.mjs   # ۲۹ اظهار (رگرسیون)
node scripts/e2e-limits.mjs    # سقف‌های OTP (رگرسیون)
```

مسیر دستی پیشنهادی برای شما:

1. `http://localhost:3210` → خانه با کارت‌های واقعی؛ چیپ «مرحله» فقط روی مهمانسرا/نذورات/پیشرفت ساخت.
2. `/audio` → دکمه پخش یک کارت → تب Network: درخواست `sample-audio-1.wav` با `206`؛ سپس روی یک لینک منو کلیک کنید — پخش و نوار چسبان پایین صفحه می‌مانند (پخش تا حد ممکن ادامه می‌یابد؛ با reload کامل قطع می‌شود — بند ج۷).
3. `/articles/chera-heyarieh-mi-khanim` → markdown رندرشده + تصویر وسط متن؛ `view-source` را باز کنید که `og:title`/`og:image` را ببینید.
4. `/gallery/3` → کلیک روی عکس → کلیدهای جهت و `Esc`؛ `/gallery/persons` → شخص متوفی.
5. `/video/3` → پیام «فایل این ویدئو هنوز روی میزبان نیست».
6. ورود با `09120000000` (کد در کادر نقطه‌چین همان صفحه) → `/admin/content` → یک مقاله جدید بسازید، منتشر کنید، در عمومی ببینید، سوییچ انتشار را خاموش کنید و حذف کنید.
7. پراب امنیتی که خودتان سریع بزنید: `curl -i --path-as-is http://localhost:3210/api/files/../../package.json` → `404`.

متغیرهای env همان مرحله ۱ است (`SMS_MODE=log`، `OTP_SECRET` پیش‌فرض dev، `E2E_BASE` برای تست)؛ فایل `.env` نساختام.

---

## ج. انحراف‌ها و موارد انجام‌نشده (با دلیل)

**ج۱. slug ساخت‌شده از پنل فارسی است، slugهای seed لاتین.**
تابع `slugify` حروف فارسی را نگه می‌دارد (تصمیم پرامپت: «slug فارسی با یک تابع تبدیل ساده»)، پس مقاله‌ای که با عنوان «مقاله‌ی تست خودکار مرحله دو» ساخته شد نشانی `/articles/مقاله-ی-تست-خودکار-مرحله-دو` گرفت (در تست e2e تأیید شد)، ولی رکوردهای seed slug لاتین دارند چون slugهای seed را دستی نوشتم. نتیجه: دو سبک نشانی در یک سایت. اگر یکدست‌سازی (مثلاً ترانوییس اجباری) را ترجیح می‌دهید، تابع را عوض می‌کنم — ولی این تصمیم SEO/نشانی است و پرسش ۲ در «سوالات» است.

**ج۲. فایل PNG برای تست آپلود، در خود اسکریپت ساخته می‌شود.**
برای ثابت‌کردن مسیر آپلود به یک تصویر واقعی نیاز بود و نمی‌خواستم فایل باینری نمونه را به مخزن اضافه کنم؛ `makePng(64,48)` با `node:zlib` و CRC32 دستی PNG معتبر می‌سازد و با `ElementHandle.uploadFile` (puppeteer-core این نسخه `page.setInputFiles` ندارد) آپلود می‌شود. تست‌ها موقتاً یک مقاله و یک فایل واقعی می‌سازند و در همان چرخه پاک می‌کنند؛ پس از اجرای کامل، DB و `storage/uploads` دقیقاً به حالت seed برمی‌گردند (شمارش‌های بند الف۵ پس از اجرای تست گرفته شد).

**ج۳. ترتیب حذف رسانه:** حذف رکورد محتوا، سپس بررسی ارجاع رسانه، سپس unlink فایل. برای آلبوم، ابتدا `persons.main_photo_id`هایی که به عکس‌های آن آلبوم اشاره دارند آزاد می‌شود تا FK نقض نشود (`src/server/content-actions.ts:478-485`).

**ج۴. آزمون حذف در e2e یک بار به‌دلیل selector اشتباه خطا می‌داد:** `button[class*=destructive]` دکمه «ثبت» را هم می‌گرفت، چون کلاس پایه shadcn شامل `aria-invalid:border-destructive` است؛ یعنی همان سوییچ انتشار دوباره POST می‌شد و حذف انجام نمی‌گرفت. اصلاح در تست با تطبیق متن دکمه («حذف»). **کد محصول تغییری نکرد و باگ نبود.**

**ج۵. افزونه‌ی کوچک در محصول برای ویدئوی بی‌فایل:** `fileExists` (`src/server/storage.ts:137`) تا رکورد DB با فایل نرسیده، به‌جای `<video>` شکسته، پیام فارسی نشان دهد. این همان حالتی است که پرامپت خواست graceful باشد؛ قبلاً فقط «بدون فایل» را پوشش می‌داد. امضای `fileExists` را به `{ storedPath: string }` گسترش دادم تا با `AssetRef` صفحه ویدئو سازگار باشد (بدون تغییر رفتار).

**ج۶. تغییر `next.config.ts`:** `serverActions.bodySizeLimit: '512mb'`. بدون آن، آپلود ویدئوی ۵۰۰MB در Server Action با خطای بدنه مواجه می‌شد. سقف منطقی در `UPLOAD_RULES` (۵۰۰MB) است و این فقط سقف انتقال است.

**ج۷. ادامه پخش صوت «تا حد ممکن»:** پیاده‌سازی با provider روی layout گروه `(public)` است؛ بنابراین ناوبری سمت کلاینت پخش را نمی‌شکند، اما reload کامل یا رفتن به `/admin` (layout دیگر) قطعش می‌کند. برای ادامه‌ی مطلق پخش نیاز به WebAudio/Service Worker بود که خارج از «به اندازه کافی خوب» این مرحله است (پرسش ۴).

**ج۸. یک ادعای `scripts/e2e-stage01.mjs` به‌روز شد:** آن تست انتظار داشت `/audio` هنوز placeholder با تیتر «به‌زودی» باشد؛ مرحله ۲ همین بخش را زنده کرد، پس آن قلم از فهرست placeholderها بیرون آمد و به‌جایش ادعای «صوت پس از مرحله ۲ دیگر placeholder نیست» گذاشت شد (دو placeholder باقی‌مانده: مهمانسرا و نذورات). تعداد اظهارها ۲۹ ماند و همه PASS. اگر ترجیح می‌دهید تست مرحله ۱ دست‌نخورده بماند، برمی‌گردانم (پرسش ۵).

**ج۹. صریحاً انجام نشد، طبق محدودیت‌ها:** هیچ خرید/فعال‌سازی/استقراری نبود؛ پشته تغییر نکرد (Next 15.5.28 / Tailwind v4 / Drizzle 0.45.4 / همان shim `node:sqlite`)؛ **هیچ پکیج جدیدی نصب نشد** (نه `marked`، نه better-sqlite3، نه dayjs plugin)؛ منطق auth و جداول مرحله ۱ دست‌نخورده و **هیچ فیلدی به جداول مرحله ۱ اضافه نشد**؛ هیچ چیز از مراحل ۳ تا ۵ ساخته نشد (نه رزرو، نه پرداخت، نه نقشه React، نه نذورات، نه گزارش)؛ فایل‌های مرجع فقط خوانده شدند: `Spec_01_Requirements.html`, `Prompt_01/02 HTML`, `Plan.html`, `draw.html`, `plan.dxf`, `plan.JPG`.

---

## د. فایل‌های ایجادشده / تغییرکرده

**ایجاد (محتوا/سمت سرور):** `src/server/content.ts` (۴۸۶ سطر، همه‌ی کوئری‌های عمومی و پنل)، `src/server/content-actions.ts` (۵۱۸)، `src/server/storage.ts` (۲۲۴)، `src/app/api/files/[...path]/route.ts` (۱۲۵)، `src/lib/markdown.ts` (۱۷۸)، `src/lib/slug.ts` (۴۳).

**ایجاد (صفحات عمومی):** `src/app/(public)/audio/page.tsx`، `articles/page.tsx`، `articles/[slug]/page.tsx`، `gallery/page.tsx`، `gallery/[id]/page.tsx`، `gallery/persons/page.tsx`، `gallery/persons/[slug]/page.tsx`، `video/page.tsx`، `video/[id]/page.tsx`، `programs/page.tsx`.

**ایجاد (کامپوننت‌ها):** `audio-player.tsx`، `audio-list.tsx`، `photo-grid.tsx`، `markdown-body.tsx`، `page-header.tsx`، `admin/content-sections.tsx` (۸۹۴ سطر، شش سربرگ)، `admin/content-form.tsx` (۲۲۷)، `admin/row-actions.tsx`، `ui/dialog.tsx`، `ui/table.tsx`.

**ایجاد (پنل/اسکریپت/migration):** `src/app/(admin)/admin/content/page.tsx` (جایگزین placeholder مرحله ۱)، `drizzle/0001_even_wallow.sql` + `drizzle/meta/0001_snapshot.json`، `scripts/seed-content.mjs`، `scripts/e2e-stage02.mjs`.

**تغییر:** `src/server/db/schema.ts` (۹ جدول)، `src/app/(public)/layout.tsx` (AudioPlayerProvider)، `src/app/(public)/page.tsx` (کارت‌های واقعی + چیپ مرحله)، `src/app/globals.css` (تایپوگرافی `.article-body`، num-latin)، `src/app/icon.svg`، `src/components/site-header.tsx`/`site-nav.tsx`/`nav.ts` (حذف چیپ «مرحله ۲» از پنج بخش زنده)، `src/components/profile-completion-dialog.tsx`، `src/app/(public)/profile/page.tsx`، `src/server/actions.ts`، `src/server/db/driver.ts` (سازگاری پارامتر `null`)، `next.config.ts` (بند ج۶)، `.gitignore` (`storage/uploads`)، `package.json` (اسکریپت `db:seed:content`)، `scripts/seed.mjs`، `scripts/e2e-stage01.mjs` (بند ج۸).

**محتوای دیسک:** ۲۰ فایل نمونه در `storage/uploads/` (۴ WAV + ۱۴ SVG + ۲ مسیر ویدئو که عمداً فایل ندارند) — این پوشه gitignored است.

---

## ه. چک‌لیست پذیرش مرحله ۲ — سنجش

| بند چک‌لیست مشاور | وضعیت | شواهد |
|---|---|---|
| ۱. خانه بدون چیپ «به‌زودی/مرحله» برای صوت/تصویر/ویدئو/برنامه/مقالات؛ فقط مهمانسرا و نذورات placeholder | PASS | `01-home.png`؛ اظهار «خانه: پنج بخش زنده برچسب… ندارند → `[]`» و «برچسب مرحله فقط برای مهمانسرا و نذورات و پیشرفت ساخت → مرحله ۳ \| مرحله ۵» |
| ۲. پخش یک فایل صوتی نمونه از UI و دریافت `206` Range در شبکه | PASS | `02-audio-player.png`؛ `درخواست فایل صوتی با ۲۰۶ Range پاسخ داد — 206`، `Content-Range: bytes 0-132343/132344`؛ پخش پس از ناوبری زنده ماند |
| ۳. `/api/files/../../etc` → `4xx` (ثبت در گزارش) | PASS | جدول هفت پراب پایین همین بخش |
| ۴. مقاله نمونه با markdown رندرشده، RTL تمیز و متادیتای OG در view-source | PASS | `03-article.png`، `03b-article-image.png`؛ `h2=1, li=3, bq=1, strong=1`؛ `dir=rtl`, `lineHeight=35.7px`؛ OG کامل (`og:image` با آدرس مطلق) و `og:title` در سورس HTML |
| ۵. چرخه کامل پنل: ساخت → انتشار → عمومی → unpublish → حذف | PASS | `08-panel-article-created.png`؛ مقاله شناسه ۱۱ با PNG آپلودی → صفحه عمومی با همان تصویر → ۴۰۴ پس از unpublish و `is_published=0` → حذف: ردیف ۰، رکورد رسانه ۰، فایل روی دیسک پاک، نشانی ۴۰۴ |
| ۶. آلبوم اشخاص: صفحه فرد متوفی با bio و عکس | PASS | `05-person-deceased.png`؛ بج «متوفی — روحش شاد»، معرفی‌نامه markdown‌دار (`h2=1, li=3, bq=1`)، `sample-album-4-photo-1.svg` با عرض کامل |
| ۷. رگرسیون مرحله ۱ سبز + build تمیز | PASS | `e2e-stage01.mjs` → **۲۹/۲۹**؛ `e2e-limits.mjs` → همه PASS؛ `tsc --noEmit` → خروج ۰؛ `npm run build` → خروج ۰، ۲۹ route |

### پراب‌های امنیتی (HTTP خام، مسیر دست‌نخورده) — نتیجه‌ی واقعی

| مسیر درخواست‌شده | وضعیت |
|---|---|
| `/api/files/../../package.json` | 404 |
| `/api/files/../../windows/win.ini` | 404 |
| `/api/files/%2e%2e%2f%2e%2e%2fpackage.json` | 404 |
| `/api/files/audio/../../../package.json` | 404 |
| `/api/files/..%2f..%2f.env` | 404 |
| `/api/files/../../data/app.db` | 404 |
| `/api/files//etc/passwd` | 308 → سپس 404 (Next دو اسلش را نرمال می‌کند؛ مقصد `/api/files/etc/passwd` که در `media_assets` ثبت نیست) |
| `/api/files/audio/sample-audio-1.wav/extra` | 404 |
| `/api/files/audio/sample-audio-1.wav` با `Range: bytes=100-199` | 206، `Content-Range: bytes 100-199/132344`، ۱۰۰ بایت بدنه |
| همان فایل با `Range: bytes=-50` | 206، `bytes 132294-132343/132344`، ۵۰ بایت |
| همان فایل با `Range: bytes=999999-` | 416، `bytes */132344` |
| `/api/files/image/sample-article-1.svg` | 200 با `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` |

اجرای نهایی روی کد نهایی (پس از آخرین ویرایش‌ها، با سرور dev تازه‌بالا): `e2e-stage02.mjs` **۶۱/۶۱ PASS** · `e2e-stage01.mjs` **۲۹/۲۹ PASS** · `e2e-limits.mjs` **همه PASS** · `tsc --noEmit` **تمیز** · `npm run build` **تمیز**.

**یک نکته‌ی محیطی که برای مراحل بعد مهم است:** اجرای `npm run build` **همزمان** با سرور dev روی همان `.next`، خروجی dev را می‌شکند (`MODULE_NOT_FOUND` در `.next/server/pages/_document.js` و پاسخ‌های ۵۰۰ موقت). در همین جلسه رخ داد و با `rm -rf .next` + restart dev برطرف شد؛ ترتیب امن: اول تست‌های e2e، بعد build (یا `distDir` جدا برای build در مرحله ۶ — پرسش ۶). همچنین در حالت dev، اولین درخواست یک route درست پس از compile گاهی `500` می‌دهد و با تکرار ۲۰۰ می‌شود (ریشه‌اش کد ما نیست: `JSON.parse` در `src/` وجود ندارد؛ پیام از درونی‌های dev می‌آید). تست‌ها با retry سه‌توانه ساخته شدند تا ناپایدار نباشند.

---

## سوالات

1. **محتوای واقعی کارفرما:** seed این مرحله عمداً نمونه است (تون WAV و SVG جای‌نما). آیا پیش از مرحله ۳ فایل‌های واقعی صوت/عکس/مقاله را می‌فرستید تا در همان پنل جایگزین کنم، یا seed تا مرحله ۵ بماند؟ (راه جایگزینی ویدئو در بند الف۵ نوشته شده است.)
2. **یکدست‌سازی نشانی‌ها (ج۱):** slug پنل فارسی است و slug seed لاتین. کدام را مبنا کنم — فارسی (خوانا، ولی آدرس غیرASCII) یا ترانوییس لاتین برای همه؟ تصمیم شما در `replies.md` را در همان مرحله اعمال می‌کنم؛ فعلاً چیزی را عوض نمی‌کنم.
3. **برچسب‌های مقاله:** در `/articles` فیلتر برچسب فقط با برچسب‌های موجود در DB پر می‌شود (متن جداشده با کاما). آیا لازم است صفحه‌ی فهرست برچسب (`/articles/tag/…`) هم باشد؟ پرامپت آن را نخواست، پس نساختام.
4. **ادامه‌ی مطلق پخش صوت (ج۷):** با reload کامل قطع می‌شود. اگر «هیچ‌وقت قطع نشود» را می‌خواهید، باید provider به Service Worker/PWA تبدیل شود — به نظرم کار مرحله ۶ است؛ تأیید می‌کنید؟
5. **ویرایش تست مرحله ۱ (ج۸):** آیا مجازم هر بار که مرحله‌ی جدیدی یک ادعای مرحله‌ی قبل را بازنویسی می‌کند (مثل placeholder → زنده)، همان ادعا را در تست قبلی به‌روز کنم؟ اگر نه، بفرمایید تا تست‌های مراحل قبل فقط‌خواندنی بمانند و تغییر را در اسکریپت مرحله جدید بنویسم.
6. **تعارض build و dev روی `.next`:** برای مراحل بعد `distDir` جدا (مثلاً `.next-build` برای build) اضافه کنم، یا ترتیب «اول تست، بعد build» را رعایت کنم و config دست‌نخورده بماند؟
7. **سقف واقعی آپلود ویدئو:** سقف‌ها همان اعداد پرامپت در config است (صوت ۵۰MB، تصویر ۱۰MB، ویدئو ۵۰۰MB — `src/server/storage.ts:19`) و اعتبارسنجی با فایل کوچک در تست پوشش داده شد؛ اما هیچ آپلود واقعی چندصد مگابایتی در dev انجام نشد (فایل بزرگ نمی‌سازم). آیا در مرحله ۵ (استقرار) یک آپلود واقعی بین ۳۰۰ تا ۴۰۰ مگابایت را به‌عنوان تست عبور بدهیم؟
8. **یادآوری بدهی فنی:** طبق بند ۲ `reports/replies.md`، ریسک shim دستی `node:sqlite` را در بخش «بدهی فنی» گزارش مرحله ۶ خواهم نوشت (و طبق بند ۴ همان‌جا `Plan.html`/۱۱ پلیگون و بند ج۱ مرحله ۱ را هم چک می‌کنم). تأیید می‌کنید که در مرحله ۲ چیزی دربارهٔ آن لازم نیست؟

---

**توقف:** مطابق دستور، مرحله ۳ را شروع نکرده‌ام. سرور dev روی `http://localhost:3210` بالا و سالم است (۷ مسیر اصلی همین حالا ۲۰۰); DB به حالت seed (۴ مقاله: ۳ منتشر + ۱ پیش‌نویس، ۲۰ رسانه، بدون فایل آپلودیِ باقی‌مانده از تست‌ها) و `storage/uploads` تمیز است. منتظر تأیید شما یا پاسخ در `reports/replies.md` می‌مانم.
