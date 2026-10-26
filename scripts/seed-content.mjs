/**
 * داده نمونه مرحله ۲ — فقط جدول‌های محتوا و فایل‌های storage/uploads.
 * فایل‌های صوتی: تون ۳ ثانیه‌ای WAV با نویز ملایم. تصاویر: SVG جاholder (placeholder) با نام آلبوم/شخص.
 * ویدئوها: رکورد DB با فایلی که روی میزبان نیست تا پخش‌کننده پیام «فایل موجود نیست» را نشان دهد.
 *
 * اجرا: npm run db:seed:content          (اگر محتوا خالی باشد)
 *       node scripts/seed-content.mjs --force   (پاک‌کردن همه محتوای فعلی + پوشه uploads و ساخت دوباره)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const dbPath = path.join(root, 'data', 'app.db');
const uploads = path.join(root, 'storage', 'uploads');
const force = process.argv.includes('--force');

if (!existsSync(dbPath)) {
  console.error('دیتابیس نیست. اول: npm run db:migrate');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const existing = db
  .prepare(
    `SELECT
       (SELECT COUNT(*) FROM articles) a,
       (SELECT COUNT(*) FROM audios) au,
       (SELECT COUNT(*) FROM albums) al,
       (SELECT COUNT(*) FROM videos) v,
       (SELECT COUNT(*) FROM programs) p,
       (SELECT COUNT(*) FROM persons) pe`,
  )
  .get();
const hasContent = Object.values(existing).some((value) => Number(value) > 0);

if (hasContent && !force) {
  console.error('محتوا خالی نیست؛ برای ساخت دوباره‌ی داده نمونه --force بده.', JSON.stringify(existing));
  process.exit(1);
}

if (force) {
  db.exec('BEGIN');
  for (const table of ['articles', 'audios', 'videos', 'programs', 'persons', 'photos', 'albums', 'categories', 'media_assets']) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  db.exec('COMMIT');
  rmSync(uploads, { recursive: true, force: true });
  console.log('محتوای قبلی و پوشه uploads پاک شد.');
}

for (const kind of ['audio', 'image', 'video']) mkdirSync(path.join(uploads, kind), { recursive: true });

/* ─────────────── تاریخ شمسی امروز (هم‌راستا با src/lib/jalali.ts) ─────────────── */

const faFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tehran',
  calendar: 'persian',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function jalaliToday(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = faFmt.formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** تاریخ میلادی «YYYY-MM-DD HH:MM:SS» — همان قالبی که صفحه‌ها با jalaliLabelFromIso شمسی می‌کنند */
function gregorian(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10) + ' 12:00:00';
}

/* ─────────────── ساخت فایل‌های نمونه ─────────────── */

function wavBuffer(seconds, frequency) {
  const sampleRate = 22050;
  const count = Math.round(seconds * sampleRate);
  const data = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 5) * Math.exp(-1.1 * t);
    const tone = Math.sin(2 * Math.PI * frequency * t) * 0.62 + Math.sin(4 * Math.PI * frequency * t) * 0.14;
    const noise = (Math.random() * 2 - 1) * 0.05;
    const sample = Math.max(-1, Math.min(1, tone * envelope + noise));
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function svgPlaceholder(title, subtitle) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e6b5c"/>
      <stop offset="1" stop-color="#0a4c41"/>
    </linearGradient>
  </defs>
  <rect width="960" height="600" fill="url(#bg)"/>
  <circle cx="820" cy="110" r="72" fill="#c8a45c" opacity="0.5"/>
  <circle cx="820" cy="110" r="40" fill="#f6efdf" opacity="0.35"/>
  <rect x="48" y="452" width="864" height="104" rx="20" fill="#062f28" opacity="0.72"/>
  <text x="480" y="300" text-anchor="middle" direction="rtl" font-family="Vazirmatn, Tahoma, sans-serif" font-size="56" fill="#ffffff">${esc(title)}</text>
  <text x="480" y="360" text-anchor="middle" direction="rtl" font-family="Vazirmatn, Tahoma, sans-serif" font-size="26" fill="#c8a45c">هیئت حیدریه نجف‌اشرف ابولحسن</text>
  <text x="480" y="516" text-anchor="middle" direction="rtl" font-family="Vazirmatn, Tahoma, sans-serif" font-size="28" fill="#f6efdf">${esc(subtitle)}</text>
</svg>
`;
}

const insertAsset = db.prepare(
  `INSERT INTO media_assets (kind, original_name, stored_path, mime, size_bytes, duration_sec)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

/** فایل را می‌نویسد و رسانه را ثبت می‌کند؛ content=null یعنی رکورد بی‌فایل */
function addAsset(kind, stem, extension, mime, content, durationSec) {
  const storedPath = `${kind}/${stem}.${extension}`;
  let size = 0;
  if (content !== null) {
    writeFileSync(path.join(uploads, storedPath), content);
    size = Buffer.byteLength(content);
  }
  const result = insertAsset.run(kind, `${stem}.${extension}`, storedPath, mime, size, durationSec);
  return Number(result.lastInsertRowid);
}

/* ─────────────── دسته‌ها ─────────────── */

const insertCategory = db.prepare('INSERT INTO categories (name, slug, kind) VALUES (?, ?, ?)');
insertCategory.run('معارف و قرآن', 'maaref-va-ghuran', 'article');
insertCategory.run('تاریخچه هیئت', 'tarikhche-heiat', 'article');
const categoryMaaref = Number(
  db.prepare("SELECT id FROM categories WHERE slug = 'maaref-va-ghuran'").get().id,
);
const categoryTarikh = Number(
  db.prepare("SELECT id FROM categories WHERE slug = 'tarikhche-heiat'").get().id,
);

/* ─────────────── صوت (۴ فایل WAV) ─────────────── */

const audiosData = [
  {
    title: 'روضه شب اول محرم ۱۴۰۵',
    narrator: 'مهدی سعادت',
    performer: 'هيئت ابولحسن',
    occasion: 'moharram',
    description: 'قسمتی از روضه شب اول، ضبط زنده در حوضخانه.',
    freq: 392,
  },
  {
    title: 'دعای کمیل — بازخوانی ماه رمضان',
    narrator: 'جواد رحیمی',
    performer: 'ملاخوان: سعادت',
    occasion: 'ramadan',
    description: 'صدای دعای کمیل پس از نماز عشاء، نیمه دوم رمضان.',
    freq: 440,
  },
  {
    title: 'مرثیه ایام فاطمیه',
    narrator: 'حسین احمدی',
    performer: 'بدون همراه',
    occasion: 'fatimiye',
    description: 'مرثیه کوتاه در سوگ حضرت زهرا(س).',
    freq: 494,
  },
  {
    title: 'جلسه هفتگی — ادعیه و موعظه',
    narrator: 'مهدی سعادت',
    performer: 'مدرس: سید رضا نجف‌اشرفی',
    occasion: 'other',
    description: 'پخش شده از جلسه پنجشنبه‌های هیئت.',
    freq: 523,
  },
];

const insertAudio = db.prepare(
  `INSERT INTO audios (title, narrator, performer, occasion, asset_id, description, published_at, is_published)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
);

for (const [index, audio] of audiosData.entries()) {
  const assetId = addAsset('audio', `sample-audio-${index + 1}`, 'wav', 'audio/wav', wavBuffer(3, audio.freq), 3);
  insertAudio.run(audio.title, audio.narrator, audio.performer, audio.occasion, assetId, audio.description, gregorian(-3 - index));
}

/* ─────────────── آلبوم‌ها و عکس‌ها (۲ آلبوم، ۶ عکس) ─────────────── */

const insertAlbum = db.prepare('INSERT INTO albums (title, description, cover_asset_id) VALUES (?, ?, ?)');
const insertPhoto = db.prepare('INSERT INTO photos (album_id, asset_id, caption, sort) VALUES (?, ?, ?, ?)');

const albumsData = [
  {
    title: 'حیدریه محرم ۱۴۰۵',
    description: 'عکس‌های مراسم دهه اول محرم، از ورود پرچم تا پایان روضه.',
    photos: [
      'پرچم هیئت پیش از شروع مراسم',
      'حوضخانه پر از مهمانان',
      'روضه آخر جلسه',
    ],
  },
  {
    title: 'یادِ مردانِ هیئت',
    description: 'تصاویر قدیمی از کسانی که این هیئت را پا نگه داشتند.',
    photos: [
      'سید رضا نجف‌اشرفی در نخستین جلسه',
      'دست جماعت، عکس یادگاری ۱۳۶۰',
      'صندوق نذری قدیمی هیئت',
    ],
  },
];

let albumMaarefId = 0;
const albumIds = [];
for (const [index, album] of albumsData.entries()) {
  const coverId = addAsset(
    'image',
    `sample-album-cover-${index + 1}`,
    'svg',
    'image/svg+xml',
    svgPlaceholder(album.title, 'آلبوم تصویری'),
    null,
  );
  const result = insertAlbum.run(album.title, album.description, coverId);
  const albumId = Number(result.lastInsertRowid);
  albumIds.push(albumId);
  album.photos.forEach((caption, photoIndex) => {
    const assetId = addAsset(
      'image',
      `sample-album-${albumId}-photo-${photoIndex + 1}`,
      'svg',
      'image/svg+xml',
      svgPlaceholder(caption, album.title),
      null,
    );
    insertPhoto.run(albumId, assetId, caption, photoIndex + 1);
  });
}
albumMaarefId = albumIds[0];
const albumYadId = albumIds[1];

const firstPhotoOf = (albumId) =>
  Number(db.prepare('SELECT id FROM photos WHERE album_id = ? ORDER BY sort LIMIT 1').get(albumId).id);

/* ─────────────── اشخاص (۲ نفر، یکی متوفی) ─────────────── */

const insertPerson = db.prepare(
  `INSERT INTO persons (name, slug, bio, is_deceased, main_photo_id, album_id)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

const bioSeyyed = `## سید رضا نجف‌اشرفی

از **بنیان‌گذاران** هیئت حیدریه نجف‌اشرف ابولحسن. بیش از چهل پنجشنبه را با همین جماعت به پایان رساند.

### یادکردگان
- مدرس جلسه هفتگی از سال ۱۳۵۸
- ناظم وقفنامه قدیمی هیئت
- نخستین راوی صوت‌های ضبط‌شده

> «هیئت خانه هر کس است، نه خانه یک نفر.»
`;

const bioHossein = `## حسین احمدی

مداح نسل جوان هیئت و مسئول **صوت و تصویر**. کار ضبط جلسات را از سال ۱۳۹۵ آغاز کرد.

- مسئول آرشیو صوت
- نوازنده دمام در مراسم محرم
`;

insertPerson.run('سید رضا نجف‌اشرفی', 'seyyed-reza-najafashrafi', bioSeyyed, 1, firstPhotoOf(albumYadId), albumYadId);
insertPerson.run('حسین احمدی', 'hossein-ahmadi', bioHossein, 0, firstPhotoOf(albumMaarefId), albumMaarefId);

/* ─────────────── ویدئوها (۲ رکورد، فایل روی میزبان نیست) ─────────────── */

const insertVideo = db.prepare(
  `INSERT INTO videos (title, occasion, asset_id, cover_asset_id, description, program_date_jalali, is_published)
   VALUES (?, ?, ?, ?, ?, ?, 1)`,
);

const videosData = [
  {
    title: 'موعظه پیش از نماز مغرب — دهه اول محرم',
    occasion: 'moharram',
    description: 'فایل ویدئو هنوز به دست تیم سایت نرسیده است؛ رکورد آن ثبت شده تا صفحه آماده باشد.',
    stem: 'sample-video-moharram-sermon',
    offset: -4,
  },
  {
    title: 'مرثیه شب پایانی فاطمیه',
    occasion: 'fatimiye',
    description: 'منتظر رسیدن فایل خام برای برش و انتشار.',
    stem: 'sample-video-fatimiye-elegy',
    offset: -11,
  },
];

for (const video of videosData) {
  const assetId = addAsset('video', video.stem, 'mp4', 'video/mp4', null, null);
  const coverId = addAsset(
    'image',
    `${video.stem}-cover`,
    'svg',
    'image/svg+xml',
    svgPlaceholder(video.title, 'ویدئوی هیئت'),
    null,
  );
  insertVideo.run(video.title, video.occasion, assetId, coverId, video.description, jalaliToday(video.offset));
}

/* ─────────────── برنامه‌ها (۴ برنامه: پیش‌رو، پیش‌رو، برگزارشده، لغوشده) ─────────────── */

const insertProgram = db.prepare(
  `INSERT INTO programs (title, date_jalali, start_time, place, kind, is_cancelled, description)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

insertProgram.run(
  'مراسم هفتگی حیدریه',
  jalaliToday(7),
  '20:30',
  'حوضخانه هیئت',
  'ceremony',
  0,
  'جلسه‌ی هفتگی با قرائت قرآن و روضه.',
);
insertProgram.run(
  'جشن میلاد و قرعه‌کشی',
  jalaliToday(18),
  '19:00',
  'تالار اجتماعات نجف‌اشرف',
  'ceremony',
  0,
  'جشن با پذیرایی از زائران؛ ورود برای همه آزاد است.',
);
insertProgram.run(
  'کارگاه تفسیر قرآن',
  jalaliToday(-12),
  '16:00',
  'حوزه علمیه',
  'class',
  0,
  'جلسات تفسیر سوره حجرات برگزار و تمام شد.',
);
insertProgram.run(
  'سخنرانی درباره آداب زیارت',
  jalaliToday(2),
  '21:00',
  'حسیه',
  'lecture',
  1,
  'به دلیل سفر سخنران لغو شد؛ برنامه جانشین در فهرست نیست.',
);

/* ─────────────── مقالات (۳ منتشرشده + ۱ پیش‌نویس) ─────────────── */

const insertArticle = db.prepare(
  `INSERT INTO articles (title, slug, body_markdown, excerpt, cover_asset_id, author, category_id, tags, published_at, is_published)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const articleCover = (title, index) =>
  addAsset('image', `sample-article-${index}`, 'svg', 'image/svg+xml', svgPlaceholder(title, 'سرصفحه مقاله'), null);

const photoInText = db
  .prepare('SELECT stored_path FROM media_assets WHERE stored_path LIKE ? LIMIT 1')
  .get('image/sample-album-%').stored_path;

const bodyOne = `## چرا حیدریه می‌خوانیم؟

حیدریه تنها یک رسم نیست؛ **یادآوری پیمان** با کسی است که «هلاکُکم السُّرور» را آموخت.

### سه ریشه‌ی جلسه
1. قرآن: «وَ اذكُر فی کِتابِ إدریس»
2. وفایت به عهدِ جماعت
3. تعظیم شعائر دین

> جلسه‌ای که قرآن نداشته باشد، هیئت نیست؛ مجلس خدا نیست.

![پرچم هیئت](/api/files/${esc(photoInText)} "پرچم ابولحسن")

#### ادامه‌ی کار
- صوت جلسات در [آرشیو صوت](/audio) هست.
- تصاویر در [آرشیو تصویر](/gallery).
`;

const bodyTwo = `## مردی که هیئت را بنا کرد

**سید رضا نجف‌اشرفی** هیئت را در خانه‌ای کوچک آغاز کرد؛ خانه‌ای که امروز به حوضخانه رسیده است.

### یادداشت‌های قدیمی
- نخستین جلسه: ۱۳۵۸
- نخستین صوت ضبط‌شده: ۱۳۶۵
- وقفنامه: سه قطعه زمین برای مهمانسرا

> «تا این دیوار پا براست، درِ هیئت باز است.»

متن کامل زندگی‌نامه در صفحه [اشخاص](/gallery/persons) آمده است.
`;

const bodyThree = `## آداب جلسه هفتگی

جلسه پنجشنبه *ساعت ۲۰:۳۰* آغاز می‌شود و پیش از نماز مغرب پایان می‌یابد.

- تلفن همراه را بی‌صدا کنید
- جای خود را برای آمد‌ها باز بگذارید
- نذری را بی‌نام و نشان برسانید

### برنامه نشست
1. قرآن و مدیحه
2. موعظه کوتاه
3. روضه و سینه‌زنی
4. پذیرایی مختصر
`;

const draftBody = `## یادداشت برنامه‌های ایام فاطمیه

(این نوشته هنوز **منتشر نشده** است.)

- زمان دقیق اعلام می‌شود
- راوی مهمان تأیید نشده است
`;

const articlesData = [
  {
    title: 'چرا حیدریه می‌خوانیم؟',
    slug: 'chera-heyarieh-mi-khanim',
    body: bodyOne,
    excerpt: ' سه ریشه‌ی جلسه‌ی حیدریه: قرآن، وفای به عهد و تعظیم شعائر.',
    author: 'روابط عمومی هیئت',
    categoryId: categoryMaaref,
    tags: 'قرآن، محرم',
    published: 1,
    offset: -1,
  },
  {
    title: 'مردی که هیئت را بنا کرد',
    slug: 'mardi-ke-heyat-ra-bana-kard',
    body: bodyTwo,
    excerpt: 'روایت سید رضا نجف‌اشرفی از خانه‌ای کوچک تا حوضخانه امروز.',
    author: 'حسین احمدی',
    categoryId: categoryTarikh,
    tags: 'وفات، ادب',
    published: 1,
    offset: -5,
  },
  {
    title: 'آداب جلسه هفتگی',
    slug: 'adab-e-jalase-haftagi',
    body: bodyThree,
    excerpt: 'یادآوری آداب نشست برای میهمانان تازه.',
    author: 'هیئت تحریریه',
    categoryId: categoryMaaref,
    tags: 'محرم',
    published: 1,
    offset: -9,
  },
  {
    title: 'یادداشت برنامه‌های ایام فاطمیه',
    slug: 'yaddasht-fatimiye-barnameha',
    body: draftBody,
    excerpt: '',
    author: 'روابط عمومی هیئت',
    categoryId: categoryTarikh,
    tags: 'وفات',
    published: 0,
    offset: 0,
  },
];

for (const [index, article] of articlesData.entries()) {
  const coverId = articleCover(article.title, index + 1);
  insertArticle.run(
    article.title,
    article.slug,
    article.body,
    article.excerpt,
    coverId,
    article.author,
    article.categoryId,
    article.tags,
    article.published ? gregorian(article.offset) : null,
    article.published,
  );
}

/* ─────────────── گزارش ─────────────── */

const counts = db
  .prepare(
    `SELECT
       (SELECT COUNT(*) FROM categories) categories,
       (SELECT COUNT(*) FROM media_assets) assets,
       (SELECT COUNT(*) FROM audios) audios,
       (SELECT COUNT(*) FROM albums) albums,
       (SELECT COUNT(*) FROM photos) photos,
       (SELECT COUNT(*) FROM persons) persons,
       (SELECT COUNT(*) FROM videos) videos,
       (SELECT COUNT(*) FROM programs) programs,
       (SELECT COUNT(*) FROM articles) articles`,
  )
  .get();

db.close();

console.log('seed محتوا انجام شد:', JSON.stringify(counts));
console.log(`امروز شمسی در این seed: ${jalaliToday()} | برنامه‌های پیش‌رو: +۲ (لغوشده)، +۷، +۱۸`);
console.log(
  'ویدئوهای بی‌فایل: فایل واقعی را با همین نام‌ها در storage/uploads/video/ بگذارید تا رکورد موجود پخش شود:',
  videosData.map((video) => `video/${video.stem}.mp4`).join(' ، '),
);
