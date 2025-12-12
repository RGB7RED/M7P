import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../lib/supabaseConfig';
import { isUserGender, validateBirthDate } from '../../../lib/profileValidation';

type ProfileStats = {
  hasDatingProfile: boolean;
  datingIsActive: boolean;
  listings: {
    marketActive: number;
    housingActive: number;
    jobsActive: number;
  };
};

type UserProfile = {
  id: string;
  telegramUsername: string;
  displayName: string | null;
  gender: string;
  birthDate: string | null;
  city: string | null;
};

async function fetchUserProfile(userId: string) {
  const supabase = getServiceSupabaseClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, telegram_username, m7_nickname, gender, birth_date, city')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    throw new Error('PROFILE_LOOKUP_FAILED');
  }

  const profile: UserProfile = {
    id: user.id,
    telegramUsername: user.telegram_username,
    displayName: user.m7_nickname ?? null,
    gender: user.gender ?? 'na',
    birthDate: user.birth_date ?? null,
    city: user.city ?? null,
  };

  return profile;
}

async function fetchStats(userId: string): Promise<ProfileStats> {
  const supabase = getServiceSupabaseClient();

  const [{ data: profile }, market, housing, jobs] = await Promise.all([
    supabase
      .from('dating_profiles')
      .select('id, is_active')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('market_listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    supabase
      .from('housing_listings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase.from('job_listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
  ]);

  return {
    hasDatingProfile: Boolean(profile?.id),
    datingIsActive: Boolean(profile?.is_active),
    listings: {
      marketActive: market.count ?? 0,
      housingActive: housing.count ?? 0,
      jobsActive: jobs.count ?? 0,
    },
  };
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const [user, stats] = await Promise.all([fetchUserProfile(currentUser.userId), fetchStats(currentUser.userId)]);

    return NextResponse.json({ ok: true, user, stats });
  } catch (error) {
    console.error('[profile][GET] unexpected error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await req.json()) as {
      gender?: string;
      birthDate?: string | null;
      city?: string | null;
    };

    const supabase = getServiceSupabaseClient();
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id, gender, birth_date, city')
      .eq('id', currentUser.userId)
      .maybeSingle();

    if (lookupError || !existingUser) {
      console.error('[profile][PUT] user lookup failed', lookupError);
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    let gender: string | undefined = existingUser.gender ?? 'na';
    if (body.gender !== undefined) {
      if (!isUserGender(body.gender)) {
        return NextResponse.json({ ok: false, error: 'INVALID_GENDER' }, { status: 400 });
      }
      gender = body.gender;
    }

    const birthDateValidation = validateBirthDate(body.birthDate ?? existingUser.birth_date);
    if (!birthDateValidation.ok) {
      return NextResponse.json({ ok: false, error: birthDateValidation.error }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (body.gender !== undefined) updates.gender = gender;
    if (birthDateValidation.birthDate !== undefined) updates.birth_date = birthDateValidation.birthDate;
    if (body.city !== undefined) updates.city = body.city ?? null;

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', currentUser.userId)
      .select('id, telegram_username, m7_nickname, gender, birth_date, city')
      .single();

    if (updateError || !updatedUser) {
      console.error('[profile][PUT] update failed', updateError);
      return NextResponse.json({ ok: false, error: 'UPDATE_FAILED' }, { status: 500 });
    }

    const [user, stats] = await Promise.all([
      fetchUserProfile(currentUser.userId),
      fetchStats(currentUser.userId),
    ]);

    return NextResponse.json({ ok: true, user, stats });
  } catch (error) {
    console.error('[profile][PUT] unexpected error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
