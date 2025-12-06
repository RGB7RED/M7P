import { cookies } from 'next/headers';
import { verifySessionToken } from './auth';

export type CurrentUser = {
  userId: string;
  telegram_username: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sessionCookie = cookies().get('m7_session');
  if (!sessionCookie?.value) {
    return null;
  }

  const payload = await verifySessionToken(sessionCookie.value);
  if (!payload || !payload.user_id || !payload.telegram_username) {
    return null;
  }

  return {
    userId: String(payload.user_id),
    telegram_username: String(payload.telegram_username),
  };
}
