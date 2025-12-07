import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

type Decision = 'like' | 'dislike';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const toProfileId = String(body?.toProfileId || '').trim();
    const decision = body?.decision as Decision;

    if (!toProfileId || !['like', 'dislike'].includes(decision)) {
      return NextResponse.json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();

    const { data: currentProfile } = await supabase
      .from('dating_profiles')
      .select('id, status')
      .eq('user_id', currentUser.userId)
      .maybeSingle();

    if (!currentProfile) {
      return NextResponse.json({ ok: false, error: 'PROFILE_REQUIRED' }, { status: 400 });
    }

    if (currentProfile.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'PROFILE_NOT_ACTIVE' }, { status: 403 });
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('dating_profiles')
      .select('id, user_id, status')
      .eq('id', toProfileId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return NextResponse.json({ ok: false, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    if (targetProfile.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'PROFILE_NOT_ACTIVE' }, { status: 400 });
    }

    if (targetProfile.user_id === currentUser.userId) {
      return NextResponse.json({ ok: false, error: 'CANNOT_SWIPE_SELF' }, { status: 400 });
    }

    const { error: swipeError } = await supabase.from('dating_swipes').upsert(
      {
        from_user_id: currentUser.userId,
        to_profile_id: toProfileId,
        decision,
      },
      { onConflict: 'from_user_id,to_profile_id' },
    );

    if (swipeError) {
      console.error('[dating/swipe] upsert error', swipeError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    let matchCreated = false;

    if (decision === 'like') {
      const { data: reciprocalSwipe, error: reciprocalError } = await supabase
        .from('dating_swipes')
        .select('id')
        .eq('from_user_id', targetProfile.user_id)
        .eq('to_profile_id', currentProfile.id)
        .eq('decision', 'like')
        .maybeSingle();

      if (reciprocalError) {
        console.error('[dating/swipe] reciprocal lookup error', reciprocalError);
      }

      if (reciprocalSwipe) {
        const user1Id = [currentUser.userId, targetProfile.user_id].sort()[0];
        const user2Id = [currentUser.userId, targetProfile.user_id].sort()[1];

        const { data: existingMatch, error: matchLookupError } = await supabase
          .from('dating_matches')
          .select('id')
          .eq('user1_id', user1Id)
          .eq('user2_id', user2Id)
          .maybeSingle();

        if (matchLookupError) {
          console.error('[dating/swipe] match lookup error', matchLookupError);
        }

        if (!existingMatch) {
          const { error: matchError } = await supabase.from('dating_matches').insert({
            user1_id: user1Id,
            user2_id: user2Id,
            last_activity_at: new Date().toISOString(),
          });

          if (matchError) {
            console.error('[dating/swipe] match insert error', matchError);
          } else {
            matchCreated = true;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, matchCreated });
  } catch (error) {
    console.error('[dating/swipe] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
