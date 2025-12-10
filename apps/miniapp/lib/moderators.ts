import { CurrentUser } from './currentUser';

function normalizeUsernames(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean);
}

export function getModeratorUsernames(): string[] {
  return normalizeUsernames(process.env.MODERATOR_USERNAMES);
}

export function isModeratorUser(user: Pick<CurrentUser, 'telegram_username'> | null | undefined): boolean {
  if (!user?.telegram_username) return false;
  const normalizedUsername = user.telegram_username.trim().replace(/^@/, '').toLowerCase();
  return getModeratorUsernames().includes(normalizedUsername);
}
