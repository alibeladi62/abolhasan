import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from './db';
import { sessions, users, type User } from './db/schema';

export const SESSION_COOKIE = 'abol_session';
const SESSION_TTL_DAYS = 30;
const nowEpoch = () => Math.floor(Date.now() / 1000);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function findOrCreateUserByPhone(phone: string): Promise<User> {
  const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ phone, role: 'member', profileComplete: 0 })
    .returning();
  return created;
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: nowEpoch() + SESSION_TTL_DAYS * 24 * 60 * 60,
    lastSeenAt: nowEpoch(),
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, nowEpoch())))
    .limit(1);

  if (!row) return null;

  // نشانه‌ی زنده بودن نشست؛ نوشتن حداکثر هر ۵ دقیقه
  if (!row.session.lastSeenAt || nowEpoch() - row.session.lastSeenAt > 300) {
    await db
      .update(sessions)
      .set({ lastSeenAt: nowEpoch() })
      .where(eq(sessions.id, row.session.id));
  }

  return row.user;
}

export function isAdmin(user: User | null) {
  return user?.role === 'admin';
}
