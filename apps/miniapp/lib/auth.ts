import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const USERNAME_REGEX = /^[A-Za-z0-9_]{5,32}$/;
const CODE_LENGTH = 6;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type NormalizedUsername = string;

export function normalizeTelegramUsername(raw: string | undefined | null): NormalizedUsername {
  const cleaned = (raw || '').trim().replace(/^@+/, '');
  return cleaned.toLowerCase();
}

export function isValidTelegramUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export function generateOneTimeCode(): string {
  const code = Math.floor(Math.random() * 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
  return code;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.M7_JWT_SECRET;
  if (!secret) {
    throw new Error('M7_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: {
  user_id: string;
  telegram_username: string;
}): Promise<{ token: string; exp: number }> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getJwtSecret());

  return { token, exp };
}

export async function verifySessionToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch (error) {
    console.warn('JWT verification failed', error);
    return null;
  }
}

export const isDevEnv = process.env.NODE_ENV !== 'production';
