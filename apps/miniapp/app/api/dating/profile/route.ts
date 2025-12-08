import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingPurpose, isDatingPurpose } from '../../../../lib/datingPurposes';
import { getProfileListings } from '../_helpers/listings';

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
      .select('*')
      .eq('user_id', currentUser.userId)
      .maybeSingle();

    if (error) {
      console.error('[dating/profile][GET] lookup error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const listingsLookup = profile
      ? await getProfileListings({
          userId: currentUser.userId,
          profileId: profile.id,
          client: supabase,
          selectedOnly: true,
          includeListings: profile.show_listings,
          limitPerType: 0,
        })
      : null;

    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const isStale = profile
      ? !profile.is_active || !profile.last_activated_at
        ? true
        : new Date(profile.last_activated_at).getTime() < ninetyDaysAgo
      : false;

    return NextResponse.json({
      ok: true,
      profile: profile
        ? {
            ...profile,
            is_stale: isStale,
            has_active_listings: listingsLookup?.hasActiveListings ?? false,
            listings: profile.show_listings ? listingsLookup?.listings : undefined,
          }
        : null,
    });
  } catch (error) {
    console.error('[dating/profile][GET] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function validateProfileBody(body: IncomingProfile) {
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
    : [];

  return {
    ok: true as const,
    data: {
      nickname,
      looking_for,
      offer,
      comment,
      purposes,
      link_market: Boolean(body.link_market),
      link_housing: Boolean(body.link_housing),
      link_jobs: Boolean(body.link_jobs),
      photo_urls: photoUrls,
      show_listings: body.show_listings !== false,
      is_active: body.is_active !== false,
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
    const validation = validateProfileBody(body);

    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();

    // Всегда обновляем last_activated_at при сохранении активной анкеты,
    // чтобы помечать её как актуальную на следующие 90 дней.
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

    const listingsLookup = await getProfileListings({
      userId: currentUser.userId,
      profileId: profile.id,
      client: supabase,
      selectedOnly: true,
      includeListings: profile.show_listings,
      limitPerType: 0,
    });

    return NextResponse.json({
      ok: true,
      profile: {
        ...profile,
        has_active_listings: listingsLookup.hasActiveListings,
        listings: profile.show_listings ? listingsLookup.listings : undefined,
      },
    });
  } catch (error) {
    console.error('[dating/profile][PUT] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
