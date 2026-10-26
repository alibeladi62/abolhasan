/**
 * مهاجرت دیتابیس: فایل‌های SQL تولیدشده با drizzle-kit را به ترتیب ژورنال اعمال می‌کند.
 * جدول __drizzle_migrations همان ساختار/هش خود drizzle است تا مهاجرت‌های بعدی هم‌خوان بمانند.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const dbPath = path.join(root, 'data', 'app.db');
const migrationsFolder = path.join(root, 'drizzle');
const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');

if (!existsSync(journalPath)) {
  console.error('فایل drizzle/meta/_journal.json پیدا نشد. اول: npm run db:generate');
  process.exit(1);
}

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(
  `CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)`,
);

const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
const lastRow = db
  .prepare('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1')
  .get();
const lastApplied = lastRow ? Number(lastRow.created_at) : null;

let applied = 0;
for (const entry of journal.entries) {
  if (lastApplied !== null && entry.when <= lastApplied) continue;

  const file = path.join(migrationsFolder, `${entry.tag}.sql`);
  const text = readFileSync(file, 'utf8');
  const statements = text.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
  const hash = createHash('sha256').update(text).digest('hex');

  db.exec('BEGIN');
  try {
    for (const statement of statements) db.exec(statement);
    db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
      hash,
      entry.when,
    );
    db.exec('COMMIT');
    applied += 1;
    console.log(`applied ${entry.tag} (${statements.length} statement)`);
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(`migration ${entry.tag} failed:`, error.message);
    process.exit(1);
  }
}

db.close();
console.log(applied ? `مهاجرت انجام شد (${applied} فایل)` : 'همه مهاجرت‌ها اعمال شده بودند.');
