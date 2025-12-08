import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';
import { getProfileListings, ListingSelection } from '../../_helpers/listings';

export const dynamic = 'force-dynamic';

const LISTING_TYPE_TABLES: Record<ListingSelection['listingType'], string> = {
  market: 'market_listings',
  housing: 'housing_listings',
  job: 'job_listings',
};

function isValidPayload(
  value: unknown,
): value is { listingType: ListingSelection['listingType']; listingId: string } {
  if (!value || typeof value !== 'object') return false;
  const listingType = (value as { listingType?: string }).listingType;
  const listingId = (value as { listingId?: unknown }).listingId;

  return (
    (listingType === 'market' || listingType === 'housing' || listingType === 'job') &&
    typeof listingId === 'string' &&
    !!listingId
  );
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();
    const { data: profile } = await supabase
      .from('dating_profiles')
      .select('id')
      .eq('user_id', currentUser.userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ ok: false, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const listings = await getProfileListings({
      userId: currentUser.userId,
      profileId: profile.id,
      client: supabase,
      selectedOnly: false,
      limitPerType: 0,
    });

    return NextResponse.json({
      ok: true,
      listings: listings.listings,
      selected: listings.selected,
      has_active_listings: listings.hasActiveListings,
    });
  } catch (error) {
    console.error('[dating/profile/listings][GET] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const payloadRaw = (await req.json()) as unknown;
    const incoming = Array.isArray(payloadRaw) ? payloadRaw.filter(isValidPayload) : [];

    if (!Array.isArray(payloadRaw)) {
      return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
    }

    const normalized: ListingSelection[] = [];
    const seen = new Set<string>();

    incoming.forEach((item) => {
      const key = `${item.listingType}-${item.listingId}`;
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push({ listingType: item.listingType, listingId: item.listingId });
    });

    const supabase = getServiceSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from('dating_profiles')
      .select('id')
      .eq('user_id', currentUser.userId)
      .maybeSingle();

    if (profileError) {
      console.error('[dating/profile/listings][PUT] profile lookup error', profileError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ ok: false, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const idsByType: Record<ListingSelection['listingType'], string[]> = {
      market: [],
      housing: [],
      job: [],
    };

    normalized.forEach((entry) => idsByType[entry.listingType].push(entry.listingId));

    const validationResults = await Promise.all(
      Object.entries(idsByType).map(async ([listingType, ids]) => {
        if (!ids.length) return true;
        const table = LISTING_TYPE_TABLES[listingType as ListingSelection['listingType']];
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .eq('user_id', currentUser.userId)
          .eq('status', 'active')
          .in('id', ids);

        if (error) {
          console.error('[dating/profile/listings][PUT] validation error', { listingType, error });
          throw new Error('INTERNAL_ERROR');
        }

        return (data ?? []).length === ids.length;
      }),
    );

    if (validationResults.includes(false)) {
      return NextResponse.json({ ok: false, error: 'INVALID_LISTINGS' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('dating_profile_listings')
      .delete()
      .eq('profile_id', profile.id);

    if (deleteError) {
      console.error('[dating/profile/listings][PUT] failed to reset bindings', deleteError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    if (normalized.length) {
      const { error: insertError } = await supabase.from('dating_profile_listings').upsert(
        normalized.map((item) => ({
          profile_id: profile.id,
          listing_type: item.listingType,
          listing_id: item.listingId,
        })),
      );

      if (insertError) {
        console.error('[dating/profile/listings][PUT] failed to upsert bindings', insertError);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }
    }

    const updatedListings = await getProfileListings({
      userId: currentUser.userId,
      profileId: profile.id,
      client: supabase,
      selectedOnly: true,
      limitPerType: 0,
    });

    return NextResponse.json({
      ok: true,
      selected: updatedListings.selected,
      listings: updatedListings.listings,
      has_active_listings: updatedListings.hasActiveListings,
    });
  } catch (error) {
    console.error('[dating/profile/listings][PUT] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
