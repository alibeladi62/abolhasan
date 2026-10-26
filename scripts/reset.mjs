/** فایل دیتابیس dev را پاک می‌کند تا migrate+seed از صفر اجرا شود. */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data');
for (const suffix of ['.db', '.db-wal', '.db-shm']) {
  const file = path.join(dir, `app${suffix}`);
  if (existsSync(file)) {
    rmSync(file);
    console.log(`removed ${path.relative(process.cwd(), file)}`);
  }
}
