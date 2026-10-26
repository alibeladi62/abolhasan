import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { drizzleNodeSQLite } from './driver';
import * as schema from './schema';

export const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

function createDb() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const client = new DatabaseSync(DB_PATH);
  client.exec('PRAGMA journal_mode = WAL');
  client.exec('PRAGMA foreign_keys = ON');
  return drizzleNodeSQLite(client, { schema });
}

// در dev با HMR چند نسخه از ماژول ساخته می‌شود؛ یک اتصال مشترک نگه می‌داریم
const globalForDb = globalThis as unknown as { __abolHasanDb?: ReturnType<typeof createDb> };

export const db = globalForDb.__abolHasanDb ?? createDb();

if (process.env.NODE_ENV !== 'production') globalForDb.__abolHasanDb = db;

export { schema };
