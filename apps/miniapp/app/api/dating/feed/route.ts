import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingPurpose, isDatingPurpose } from '../../../../lib/datingPurposes';
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

    const { data: currentProfile, error: profileError } = await supabase
      .from('dating_profiles')
      .select('purposes, is_active')
      .eq('user_id', currentUser.userId)
      .maybeSingle();

    if (profileError) {
      console.error('[dating/feed] current profile lookup error', profileError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const currentPurposes = Array.isArray(currentProfile?.purposes)
      ? (currentProfile?.purposes.filter((p): p is DatingPurpose => isDatingPurpose(p)) ?? [])
      : [];

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

    let query = supabase
      .from('dating_profiles')
      .select(
        'id, user_id, nickname, looking_for, offer, comment, purposes, photo_urls, has_photo, link_market, link_housing, link_jobs, show_listings, is_active, last_activated_at, is_verified, status, created_at',
      )
      .eq('status', 'active')
      .eq('is_active', true)
      .gte('last_activated_at', recentThreshold)
      .neq('user_id', currentUser.userId)
      .order('has_photo', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const overlapPurposes = currentPurposes.length ? currentPurposes : purposesFilter;
    if (overlapPurposes.length) {
      query = query.overlaps('purposes', overlapPurposes);
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
          const listings = profile.show_listings
            ? await getActiveListingsForUser(profile.user_id, supabase)
            : { market: [], housing: [], jobs: [] };
          listingsByUserId.set(profile.user_id, listings);
        } catch (lookupError) {
          console.error('[dating/feed] listings lookup error', lookupError);
        }
      }),
    );

    const responseItems = (profiles ?? []).map((profile) => ({
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
