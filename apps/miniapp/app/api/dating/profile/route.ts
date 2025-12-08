import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingPurpose, isDatingPurpose } from '../../../../lib/datingPurposes';
import { getActiveListingsForUser } from '../_helpers/listings';

export const dynamic = 'force-dynamic';

type IncomingProfile = {
  nickname?: string;
  looking_for?: string;
  offering?: string;
  comment?: string | null;
  purposes?: DatingPurpose[];
  link_market?: boolean;
  link_housing?: boolean;
  link_jobs?: boolean;
  photo_urls?: string[];
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

    const listings = await getActiveListingsForUser(currentUser.userId, supabase);

    return NextResponse.json({ ok: true, profile: profile ?? null, listings });
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
  const offering = String(body.offering ?? '').trim();
  const comment = body.comment ? String(body.comment).trim() : null;

  const purposesRaw = Array.isArray(body.purposes) ? body.purposes : [];
  const purposes = purposesRaw.filter((p): p is DatingPurpose => isDatingPurpose(p));

  if (!nickname || !looking_for || !offering) {
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
      offering,
      comment,
      purposes,
      link_market: Boolean(body.link_market),
      link_housing: Boolean(body.link_housing),
      link_jobs: Boolean(body.link_jobs),
      photo_urls: photoUrls,
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
    const payload = { user_id: currentUser.userId, ...validation.data };

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
