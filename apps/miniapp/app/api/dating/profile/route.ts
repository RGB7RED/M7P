import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingPurpose, isDatingPurpose } from '../../../../lib/datingPurposes';
import {
  ADULT_AGE,
  MIN_ALLOWED_AGE,
  UserGender,
  calculateAge,
  isMinorAge,
  isUserGender,
} from '../../../../lib/profileValidation';
import { getActiveListingsForUser } from '../_helpers/listings';

export const dynamic = 'force-dynamic';

type IncomingProfile = {
  nickname?: string;
  looking_for?: string;
  offer?: string;
  comment?: string | null;
  purposes?: DatingPurpose[];
  link_market?: boolean;
  link_housing?: boolean;
  link_jobs?: boolean;
  photo_urls?: string[];
  show_listings?: boolean;
  is_active?: boolean;
  preferred_genders?: UserGender[];
  preferred_age_min?: number;
  preferred_age_max?: number;
  preferred_city_mode?: 'same_city' | 'same_region' | 'country' | 'any';
  show_market_listings_in_profile?: boolean;
  show_housing_listings_in_profile?: boolean;
  show_job_listings_in_profile?: boolean;
};

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();
    const { data: profile, error } = await supabase
      .from('dating_profiles')
      .select('*, users:users!inner(gender, birth_date, city, is_adult_profile)')
      .eq('user_id', currentUser.userId)
      .maybeSingle();

    if (error) {
      console.error('[dating/profile][GET] lookup error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const userRow = profile?.users ?? null;
    const user = userRow
      ? {
          gender: userRow.gender ?? 'na',
          birthDate: userRow.birth_date ?? null,
          city: userRow.city ?? null,
          isAdultProfile: Boolean(userRow.is_adult_profile),
        }
      : null;

    const listings = await getActiveListingsForUser(currentUser.userId, supabase);

    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const isStale = profile
      ? !profile.is_active || !profile.last_activated_at
        ? true
        : new Date(profile.last_activated_at).getTime() < ninetyDaysAgo
      : false;

    const resultProfile = profile
      ? {
          ...profile,
          preferred_genders: profile.preferred_genders ?? [],
          preferred_age_min: profile.preferred_age_min ?? ADULT_AGE,
          preferred_age_max: profile.preferred_age_max ?? 99,
          preferred_city_mode: profile.preferred_city_mode ?? 'same_city',
          show_market_listings_in_profile: profile.show_market_listings_in_profile ?? true,
          show_housing_listings_in_profile: profile.show_housing_listings_in_profile ?? true,
          show_job_listings_in_profile: profile.show_job_listings_in_profile ?? true,
          is_stale: isStale,
          users: undefined,
          user,
        }
      : null;

    return NextResponse.json({
      ok: true,
      profile: resultProfile,
      user,
      listings,
    });
  } catch (error) {
    console.error('[dating/profile][GET] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const ADULT_ONLY_PURPOSES: DatingPurpose[] = ['romantic'];

function validateProfileBody(
  body: IncomingProfile,
  options: {
    existingProfile?: any | null;
    userAge: number | null;
    userIsMinor: boolean;
    userCity: string | null;
    userGender: UserGender;
    userHasBirthDate: boolean;
  },
) {
  const nickname = String(body.nickname ?? '').trim();
  const looking_for = String(body.looking_for ?? '').trim();
  const offer = String(body.offer ?? '').trim();
  const comment = body.comment ? String(body.comment).trim() : null;

  const purposesRaw = Array.isArray(body.purposes) ? body.purposes : [];
  const purposes = purposesRaw.filter((p): p is DatingPurpose => isDatingPurpose(p));

  if (!nickname || !looking_for || !offer) {
    return { ok: false as const, error: 'REQUIRED_FIELDS' };
  }

  if (!purposes.length) {
    return { ok: false as const, error: 'PURPOSES_REQUIRED' };
  }

  const photoUrls = Array.isArray(body.photo_urls)
    ? body.photo_urls.map((url) => String(url).trim()).filter(Boolean)
    : options.existingProfile?.photo_urls ?? [];

  const preferredGendersRaw = Array.isArray(body.preferred_genders) ? body.preferred_genders : options.existingProfile?.preferred_genders ?? [];
  const preferred_genders = preferredGendersRaw.filter((g): g is UserGender => isUserGender(g) && g !== 'na');

  if (!preferred_genders.length) {
    return { ok: false as const, error: 'PREFERRED_GENDERS_REQUIRED' };
  }

  const preferred_age_min = Number(
    body.preferred_age_min ?? options.existingProfile?.preferred_age_min ?? (options.userIsMinor ? MIN_ALLOWED_AGE : ADULT_AGE),
  );
  const preferred_age_max = Number(
    body.preferred_age_max ?? options.existingProfile?.preferred_age_max ?? (options.userIsMinor ? ADULT_AGE - 1 : 99),
  );

  if (!Number.isFinite(preferred_age_min) || !Number.isFinite(preferred_age_max)) {
    return { ok: false as const, error: 'INVALID_AGE_RANGE' };
  }

  if (options.userIsMinor) {
    if (preferred_age_min >= ADULT_AGE || preferred_age_max >= ADULT_AGE) {
      return { ok: false as const, error: 'MINOR_CANNOT_TARGET_ADULTS' };
    }
    if (preferred_age_min < MIN_ALLOWED_AGE) {
      return { ok: false as const, error: 'AGE_RANGE_TOO_LOW' };
    }
  } else if (preferred_age_min < ADULT_AGE) {
    return { ok: false as const, error: 'AGE_RANGE_MIN_TOO_LOW' };
  }

  if (preferred_age_max < preferred_age_min) {
    return { ok: false as const, error: 'INVALID_AGE_RANGE' };
  }

  const preferred_city_mode = body.preferred_city_mode ?? options.existingProfile?.preferred_city_mode ?? 'same_city';
  if (!['same_city', 'same_region', 'country', 'any'].includes(preferred_city_mode)) {
    return { ok: false as const, error: 'INVALID_CITY_MODE' };
  }
  if (preferred_city_mode === 'same_city' && !options.userCity) {
    return { ok: false as const, error: 'CITY_REQUIRED_FOR_SAME_CITY' };
  }

  const show_market_listings_in_profile =
    body.show_market_listings_in_profile ?? options.existingProfile?.show_market_listings_in_profile ?? true;
  const show_housing_listings_in_profile =
    body.show_housing_listings_in_profile ?? options.existingProfile?.show_housing_listings_in_profile ?? true;
  const show_job_listings_in_profile =
    body.show_job_listings_in_profile ?? options.existingProfile?.show_job_listings_in_profile ?? true;

  if (options.userIsMinor && purposes.some((purpose) => ADULT_ONLY_PURPOSES.includes(purpose))) {
    return { ok: false as const, error: 'MINOR_PURPOSE_RESTRICTION' };
  }

  const is_active = body.is_active ?? options.existingProfile?.is_active ?? true;
  if (is_active) {
    if (!options.userHasBirthDate || !options.userCity || !options.userGender || options.userGender === 'na') {
      return { ok: false as const, error: 'PROFILE_INCOMPLETE' };
    }
  }

  return {
    ok: true as const,
    data: {
      nickname,
      looking_for,
      offer,
      comment,
      purposes,
      link_market: body.link_market ?? options.existingProfile?.link_market ?? false,
      link_housing: body.link_housing ?? options.existingProfile?.link_housing ?? false,
      link_jobs: body.link_jobs ?? options.existingProfile?.link_jobs ?? false,
      photo_urls: photoUrls,
      show_listings: body.show_listings ?? options.existingProfile?.show_listings ?? true,
      is_active,
      preferred_genders,
      preferred_age_min,
      preferred_age_max,
      preferred_city_mode,
      show_market_listings_in_profile,
      show_housing_listings_in_profile,
      show_job_listings_in_profile,
    },
  };
}

export async function PUT(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await req.json()) as IncomingProfile;
    const supabase = getServiceSupabaseClient();

    const [{ data: userRow, error: userError }, { data: existingProfile, error: profileLookupError }] = await Promise.all([
      supabase
        .from('users')
        .select('id, gender, birth_date, city, is_adult_profile')
        .eq('id', currentUser.userId)
        .maybeSingle(),
      supabase
        .from('dating_profiles')
        .select('*')
        .eq('user_id', currentUser.userId)
        .maybeSingle(),
    ]);

    if (userError || !userRow) {
      console.error('[dating/profile][PUT] user lookup error', userError);
      return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    if (profileLookupError) {
      console.error('[dating/profile][PUT] profile lookup error', profileLookupError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const userAge = calculateAge(userRow.birth_date ?? null);
    const userIsMinor = isMinorAge(userAge);
    const validation = validateProfileBody(body, {
      existingProfile,
      userAge,
      userIsMinor,
      userCity: userRow.city ?? null,
      userGender: (userRow.gender ?? 'na') as UserGender,
      userHasBirthDate: Boolean(userRow.birth_date),
    });

    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    if (userIsMinor && userRow.is_adult_profile) {
      await supabase.from('users').update({ is_adult_profile: false }).eq('id', currentUser.userId);
    }

    const payload = {
      user_id: currentUser.userId,
      ...validation.data,
      last_activated_at: validation.data.is_active ? new Date().toISOString() : undefined,
    };

    const { data: profile, error } = await supabase
      .from('dating_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      console.error('[dating/profile][PUT] upsert error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.error('[dating/profile][PUT] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
