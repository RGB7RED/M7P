import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';
import { emptySelection, getActiveListingsForUser, getSelectionsForProfiles } from '../../_helpers/listings';
import { ListingAttachment, ListingType } from '../../../../dating/types';

export const dynamic = 'force-dynamic';

function isListingAttachment(value: Record<string, unknown>): value is ListingAttachment {
  return (
    typeof value?.listingType === 'string' &&
    ['market', 'housing', 'job'].includes(value.listingType) &&
    typeof value?.listingId === 'string'
  );
}

async function ensureProfileId(userId: string, supabase = getServiceSupabaseClient()) {
  const { data, error } = await supabase
    .from('dating_profiles')
    .select('id, show_listings')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[dating/profile/listings][profile] lookup error', error);
    throw new Error('PROFILE_LOOKUP_FAILED');
  }

  return data ?? null;
}

async function validateAttachmentOwnership(attachment: ListingAttachment, userId: string, supabase = getServiceSupabaseClient()) {
  const tableByType: Record<ListingType, string> = {
    market: 'market_listings',
    housing: 'housing_listings',
    job: 'job_listings',
  };

  const table = tableByType[attachment.listingType];
  const { data, error } = await supabase
    .from(table)
    .select('id, user_id, status')
    .eq('id', attachment.listingId)
    .maybeSingle();

  if (error) {
    console.error('[dating/profile/listings][validate] lookup error', error);
    return false;
  }

  return Boolean(data && data.user_id === userId && data.status === 'active');
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();
    const profile = await ensureProfileId(currentUser.userId, supabase);

    if (!profile) {
      return NextResponse.json({ ok: false, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const selections = await getSelectionsForProfiles(supabase, [profile.id]);
    const selection = selections.get(profile.id) ?? emptySelection();
    const available = await getActiveListingsForUser(currentUser.userId, supabase, { limitPerType: 50 });

    const attached: ListingAttachment[] = [
      ...selection.market.map((listingId) => ({ listingType: 'market', listingId })),
      ...selection.housing.map((listingId) => ({ listingType: 'housing', listingId })),
      ...selection.job.map((listingId) => ({ listingType: 'job', listingId })),
    ];

    return NextResponse.json({ ok: true, profileId: profile.id, available: available.listings, attached });
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

    const payload = (await req.json()) as Record<string, unknown>;
    const attachmentsRaw = Array.isArray(payload) ? payload : [];
    const attachments = attachmentsRaw.filter((item): item is ListingAttachment =>
      isListingAttachment(item as Record<string, unknown>),
    );

    const supabase = getServiceSupabaseClient();
    const profile = await ensureProfileId(currentUser.userId, supabase);
    if (!profile) {
      return NextResponse.json({ ok: false, error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    const uniqueAttachments = Array.from(
      new Map(attachments.map((item) => [`${item.listingType}:${item.listingId}`, item])).values(),
    );

    const validAttachments: ListingAttachment[] = [];
    for (const attachment of uniqueAttachments) {
      const isValid = await validateAttachmentOwnership(attachment, currentUser.userId, supabase);
      if (isValid) {
        validAttachments.push(attachment);
      }
    }

    const { error: deleteError } = await supabase.from('dating_profile_listings').delete().eq('profile_id', profile.id);

    if (deleteError) {
      console.error('[dating/profile/listings][PUT] delete error', deleteError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    if (validAttachments.length) {
      const rows = validAttachments.map((item) => ({
        profile_id: profile.id,
        listing_type: item.listingType,
        listing_id: item.listingId,
      }));

      const { error: insertError } = await supabase.from('dating_profile_listings').insert(rows);
      if (insertError) {
        console.error('[dating/profile/listings][PUT] insert error', insertError);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }
    }

    const freshSelections = await getSelectionsForProfiles(supabase, [profile.id]);
    const selection = freshSelections.get(profile.id) ?? emptySelection();

    const attached: ListingAttachment[] = [
      ...selection.market.map((listingId) => ({ listingType: 'market', listingId })),
      ...selection.housing.map((listingId) => ({ listingType: 'housing', listingId })),
      ...selection.job.map((listingId) => ({ listingType: 'job', listingId })),
    ];

    return NextResponse.json({ ok: true, attached });
  } catch (error) {
    console.error('[dating/profile/listings][PUT] unexpected error', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
