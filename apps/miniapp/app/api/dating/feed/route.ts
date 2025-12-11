import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingPurpose, isDatingPurpose } from '../../../../lib/datingPurposes';
import { ADULT_AGE, MIN_ALLOWED_AGE, calculateAge, isMinorAge } from '../../../../lib/profileValidation';
import { getActiveListingsForUser } from '../_helpers/listings';
import { ListingPreviewGroups } from '../../../dating/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    const purposesFilter = url.searchParams
      .getAll('purposes')
      .flatMap((p) => p.split(',').map((value) => value.trim()))
      .filter((p): p is DatingPurpose => isDatingPurpose(p));

    const [{ data: currentProfile, error: profileError }, { data: userRow, error: userError }] = await Promise.all([
      supabase
        .from('dating_profiles')
        .select(
          'purposes, is_active, preferred_genders, preferred_age_min, preferred_age_max, preferred_city_mode, show_market_listings_in_profile, show_housing_listings_in_profile, show_job_listings_in_profile, show_listings',
        )
        .eq('user_id', currentUser.userId)
        .maybeSingle(),
      supabase
        .from('users')
        .select('gender, birth_date, city, is_adult_profile')
        .eq('id', currentUser.userId)
        .maybeSingle(),
    ]);

    if (profileError) {
      console.error('[dating/feed] current profile lookup error', profileError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    if (userError) {
      console.error('[dating/feed] current user lookup error', userError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const currentPurposes = Array.isArray(currentProfile?.purposes)
      ? (currentProfile?.purposes.filter((p): p is DatingPurpose => isDatingPurpose(p)) ?? [])
      : [];

    const userAge = calculateAge(userRow?.birth_date ?? null);
    const userIsMinor = isMinorAge(userAge);
    const preferredGenders = (currentProfile?.preferred_genders ?? []).filter((g) => typeof g === 'string');
    const preferredAgeMinRaw = Number.isFinite(currentProfile?.preferred_age_min)
      ? Number(currentProfile?.preferred_age_min)
      : userIsMinor
        ? MIN_ALLOWED_AGE
        : ADULT_AGE;
    const preferredAgeMaxRaw = Number.isFinite(currentProfile?.preferred_age_max)
      ? Number(currentProfile?.preferred_age_max)
      : userIsMinor
        ? ADULT_AGE - 1
        : 99;

    const preferredAgeMin = Math.max(preferredAgeMinRaw, userIsMinor ? MIN_ALLOWED_AGE : ADULT_AGE);
    const preferredAgeMax = Math.max(preferredAgeMin, preferredAgeMaxRaw);

    const { data: swipes, error: swipeError } = await supabase
      .from('dating_swipes')
      .select('to_profile_id')
      .eq('from_user_id', currentUser.userId);

    if (swipeError) {
      console.error('[dating/feed] swipe lookup error', swipeError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const excludedProfileIds = (swipes ?? []).map((item) => item.to_profile_id).filter(Boolean);

    // Актуальны только анкеты, которые активны и обновлялись/включались за последние 90 дней.
    const recentThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const now = new Date();
    const maxBirthDate = new Date(now);
    maxBirthDate.setFullYear(now.getFullYear() - preferredAgeMin);
    const minBirthDate = new Date(now);
    minBirthDate.setFullYear(now.getFullYear() - preferredAgeMax);

    const adultBoundary = new Date(now);
    adultBoundary.setFullYear(now.getFullYear() - ADULT_AGE);

    const birthDateUpperBound = maxBirthDate.toISOString().slice(0, 10);
    const birthDateLowerBound = minBirthDate.toISOString().slice(0, 10);
    const adultBoundaryIso = adultBoundary.toISOString().slice(0, 10);

    let query = supabase
      .from('dating_profiles')
      .select(
        'id, user_id, nickname, looking_for, offer, comment, purposes, photo_urls, has_photo, link_market, link_housing, link_jobs, show_listings, show_market_listings_in_profile, show_housing_listings_in_profile, show_job_listings_in_profile, is_active, last_activated_at, is_verified, status, created_at, users!inner(id,status,gender,birth_date,city,is_adult_profile)',
      )
      .eq('status', 'active')
      .eq('is_active', true)
      .eq('users.status', 'active')
      .gte('last_activated_at', recentThreshold)
      .neq('user_id', currentUser.userId)
      .not('users.birth_date', 'is', null)
      .order('has_photo', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const overlapPurposes = currentPurposes.length ? currentPurposes : purposesFilter;
    if (overlapPurposes.length) {
      query = query.overlaps('purposes', overlapPurposes);
    }

    if (preferredGenders.length) {
      query = query.in('users.gender', preferredGenders);
    }

    query = query.gte('users.birth_date', birthDateLowerBound).lte('users.birth_date', birthDateUpperBound);

    const cityMode = currentProfile?.preferred_city_mode ?? 'same_city';
    if (cityMode === 'same_city' && userRow?.city) {
      query = query.eq('users.city', userRow.city);
    }

    if (userIsMinor) {
      query = query.eq('users.is_adult_profile', false).lt('users.birth_date', adultBoundaryIso);
    } else if (userRow && !userRow.is_adult_profile) {
      query = query.eq('users.is_adult_profile', false);
    }

    if (excludedProfileIds.length) {
      const list = `(${excludedProfileIds.map((id) => `"${id}"`).join(',')})`;
      query = query.not('id', 'in', list);
    }

    const { data: profiles, error } = await query;

    if (error) {
      console.error('[dating/feed] profiles lookup error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const listingsByUserId = new Map<string, ListingPreviewGroups>();
    const baseListings: ListingPreviewGroups = { market: [], housing: [], jobs: [] };

    await Promise.all(
      (profiles ?? []).map(async (profile) => {
        try {
          const showMarket = profile.show_market_listings_in_profile ?? true;
          const showHousing = profile.show_housing_listings_in_profile ?? true;
          const showJobs = profile.show_job_listings_in_profile ?? true;
          const shouldShowListings = profile.show_listings && (showMarket || showHousing || showJobs);

          const listings = shouldShowListings
            ? await getActiveListingsForUser(profile.user_id, supabase)
            : { market: [], housing: [], jobs: [] };
          listingsByUserId.set(profile.user_id, {
            market: showMarket ? listings.market : [],
            housing: showHousing ? listings.housing : [],
            jobs: showJobs ? listings.jobs : [],
          });
        } catch (lookupError) {
          console.error('[dating/feed] listings lookup error', lookupError);
        }
      }),
    );

    const responseItems = (profiles ?? []).map(({ users, ...profile }) => ({
      ...profile,
      listings: listingsByUserId.get(profile.user_id) ?? { ...baseListings },
    }));

    return NextResponse.json({ ok: true, items: responseItems });
  } catch (error) {
    console.error('[dating/feed] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
