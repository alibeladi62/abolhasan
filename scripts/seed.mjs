/**
 * داده نمونه (seed) — حداقلی و موقت.
 * طبقه‌بندی/ظرفیت/تعرفه واحداً پیش‌فرض است و پس از تأیید کارفرما در مرحله ۳ اصلاح می‌شود.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const dbPath = path.join(root, 'data', 'app.db');
const planPath = path.join(root, 'drizzle', 'seed', 'units.json');

if (!existsSync(dbPath)) {
  console.error('دیتابیس وجود ندارد. اول: npm run db:migrate');
  process.exit(1);
}
if (!existsSync(planPath)) {
  console.error('فایل drizzle/seed/units.json نیست. اول: node scripts/extract-plan-polygons.mjs');
  process.exit(1);
}

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const plan = JSON.parse(readFileSync(planPath, 'utf8'));

db.exec('BEGIN');

// ── طبقات ۱ تا ۵ ───────────────────────────────────────────────────
const floorNames = [
  'همکف',
  'طبقه اول',
  'طبقه دوم',
  'طبقه سوم',
  'طبقه چهارم',
];
db.prepare('DELETE FROM units').run();
db.prepare('DELETE FROM floors').run();
const insertFloor = db.prepare('INSERT INTO floors (name, "index") VALUES (?, ?)');
const floorIds = [];
for (const [i, name] of floorNames.entries()) {
  const result = insertFloor.run(name, i + 1);
  floorIds.push(Number(result.lastInsertRowid));
}

// ── واحدها از پلیگون‌های Plan.html ─────────────────────────────────
const insertUnit = db.prepare(
  `INSERT INTO units (floor_id, code, type, capacity, nightly_price, status, demolition_date, svg_polygon, svg_viewbox)
   VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
);
for (const unit of plan.units) {
  const code = Number(unit.code);
  const isOldHouse = code <= 3;
  const isUnderConstruction = !isOldHouse && code <= 8;
  insertUnit.run(
    floorIds[0],
    unit.code,
    isOldHouse ? 'خانه قدیمی' : 'سوئیت',
    isOldHouse ? 6 : 4,
    0,
    isOldHouse ? 'old_house' : isUnderConstruction ? 'under_construction' : 'planned',
    unit.points,
    plan.viewBox,
  );
}

// ── کاربران نمونه ──────────────────────────────────────────────────
db.prepare('DELETE FROM sessions').run();
db.prepare('DELETE FROM otp_codes').run();
db.prepare('DELETE FROM users').run();

const insertUser = db.prepare(
  `INSERT INTO users (phone, name, national_id, birth_date_jalali, city, role, profile_complete)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const ADMIN_PHONE = '09120000000';
const MEMBER_PHONE = '09121111111';
const GUEST_PHONE = '09129999999';
insertUser.run(ADMIN_PHONE, 'مدیر هیئت', '0018820956', '1360-01-01', 'نجف‌اشرف', 'admin', 1);
insertUser.run(MEMBER_PHONE, null, null, null, null, 'member', 0);
insertUser.run(GUEST_PHONE, null, null, null, null, 'member', 0);

db.exec('COMMIT');

const counts = {
  floors: db.prepare('SELECT COUNT(*) c FROM floors').get().c,
  units: db.prepare('SELECT COUNT(*) c FROM units').get().c,
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
};
db.close();
console.log(
  'seed انجام شد:',
  JSON.stringify(counts),
  `| ادمین: ${ADMIN_PHONE} | عضو نمونه (پروفایل ناقص): ${MEMBER_PHONE} و ${GUEST_PHONE}`,
);
