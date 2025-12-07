import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingPurpose, isDatingPurpose } from '../../../../lib/datingPurposes';

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
      .map((p) => p.trim())
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

    let query = supabase
      .from('dating_profiles')
      .select('id, user_id, nickname, looking_for, offering, comment, purposes, photo_urls, has_photo, link_market, link_housing, link_jobs, is_verified, status, created_at')
      .eq('status', 'active')
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

    return NextResponse.json({ ok: true, items: profiles ?? [] });
  } catch (error) {
    console.error('[dating/feed] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
