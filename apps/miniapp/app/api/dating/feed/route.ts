import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingPurpose, isDatingPurpose } from '../../../../lib/datingPurposes';
import { getActiveListingsForUser, getHasActiveListings, getSelectionsForProfiles } from '../_helpers/listings';

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

    if (purposesFilter.length) {
      query = query.overlaps('purposes', purposesFilter);
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

    const selections = await getSelectionsForProfiles(
      supabase,
      profiles?.map((p) => p.id) ?? [],
    );

    const responseItems = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        try {
          if (profile.show_listings) {
            const selection = selections.get(profile.id);
            const { listings, hasActiveListings } = await getActiveListingsForUser(profile.user_id, supabase, {
              selection,
            });

            return {
              ...profile,
              listings,
              has_active_listings: hasActiveListings,
            };
          }

          const hasActiveListings = await getHasActiveListings(profile.user_id, supabase);

          return {
            ...profile,
            has_active_listings: hasActiveListings,
          };
        } catch (lookupError) {
          console.error('[dating/feed] listings lookup error', lookupError);
          return { ...profile, listings: { market: [], housing: [], jobs: [] }, has_active_listings: false };
        }
      }),
    );

    return NextResponse.json({ ok: true, items: responseItems });
  } catch (error) {
    console.error('[dating/feed] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
