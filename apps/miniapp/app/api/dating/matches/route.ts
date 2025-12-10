import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();
    const { data: matches, error } = await supabase
      .from('dating_matches')
      .select('id, user1_id, user2_id, created_at, last_activity_at')
      .or(`user1_id.eq.${currentUser.userId},user2_id.eq.${currentUser.userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[dating/matches] lookup error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    if (!matches?.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const otherUserIds = Array.from(
      new Set(
        matches.map((m) => (m.user1_id === currentUser.userId ? m.user2_id : m.user1_id)).filter(Boolean),
      ),
    );

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, telegram_username, m7_nickname, status')
      .in('id', otherUserIds);

    if (usersError) {
      console.error('[dating/matches] users lookup error', usersError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const recentThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: profiles, error: profilesError } = await supabase
      .from('dating_profiles')
      .select('id, user_id, nickname, purposes, has_photo, is_active, last_activated_at, status')
      .in('user_id', otherUserIds)
      .gte('last_activated_at', recentThreshold);

    if (profilesError) {
      console.error('[dating/matches] profiles lookup error', profilesError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const responseItems = matches.map((match) => {
      const otherUserId = match.user1_id === currentUser.userId ? match.user2_id : match.user1_id;
      const user = users?.find((u) => u.id === otherUserId);
      const profile = profiles?.find((p) => p.user_id === otherUserId);

      return {
        matchId: match.id,
        userId: otherUserId,
        telegramUsername: user?.telegram_username ?? '',
        profile: profile ? { ...profile, isBanned: user?.status === 'banned' } : null,
        isBanned: user?.status === 'banned',
        nicknameFallback: user?.m7_nickname ?? '',
        lastActivityAt: match.last_activity_at,
      };
    });

    return NextResponse.json({ ok: true, items: responseItems });
  } catch (error) {
    console.error('[dating/matches] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
