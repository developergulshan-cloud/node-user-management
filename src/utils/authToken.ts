import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createAuthSession } from '../models/userModel';

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

function getSecret(): string {
  return process.env.AUTH_TOKEN_SECRET || process.env.SESSION_SECRET || 'dev-secret';
}

export async function createAuthToken(userId: number): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const sessionId = randomUUID();
  await createAuthSession(sessionId, userId, expiresAt);
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt, sid: sessionId })).toString('base64url');
  const signature = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export interface AuthTokenClaims { userId: number; sessionId: string; expiresAt: number; }

export function readAuthToken(token: string, allowExpired = false): AuthTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac('sha256', getSecret()).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown; exp?: unknown; sid?: unknown };
    if (!Number.isSafeInteger(value.sub) || (value.sub as number) < 1 || !Number.isInteger(value.exp) || typeof value.sid !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.sid)) return null;
    if (!allowExpired && (value.exp as number) <= Math.floor(Date.now() / 1000)) return null;
    return { userId: value.sub as number, sessionId: value.sid, expiresAt: value.exp as number };
  } catch { return null; }
}
