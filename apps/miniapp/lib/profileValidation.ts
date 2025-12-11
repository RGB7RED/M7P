export const USER_GENDERS = ['male', 'female', 'other', 'na'] as const;
export type UserGender = (typeof USER_GENDERS)[number];

export function isUserGender(value: unknown): value is UserGender {
  return typeof value === 'string' && (USER_GENDERS as readonly string[]).includes(value);
}

export const MIN_ALLOWED_AGE = 14;
export const MAX_ALLOWED_AGE = 120;
export const ADULT_AGE = 18;

export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

export function validateBirthDate(value: unknown) {
  if (value === undefined) {
    return { ok: true as const, birthDate: undefined, age: null as number | null };
  }
  if (value === null || value === '') {
    return { ok: true as const, birthDate: null, age: null as number | null };
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return { ok: false as const, error: 'INVALID_DATE' };
  }
  const isoDate = date.toISOString().slice(0, 10);
  const age = calculateAge(isoDate);
  if (age === null) {
    return { ok: false as const, error: 'INVALID_DATE' };
  }
  if (age < MIN_ALLOWED_AGE || age > MAX_ALLOWED_AGE) {
    return { ok: false as const, error: 'AGE_OUT_OF_RANGE' };
  }
  return { ok: true as const, birthDate: isoDate, age };
}

export function isMinorAge(age: number | null): boolean {
  return age !== null && age < ADULT_AGE;
}
