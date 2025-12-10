import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';
import {
  countNewReportsForListing,
  getListingBasicInfo,
  LISTING_REPORT_REASONS,
  ListingReportReason,
  updateListingStatus,
} from '../_helpers/reports';
import { isListingSection } from '../_helpers/sections';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await req.json()) as {
      section?: unknown;
      listingId?: unknown;
      reason?: unknown;
      comment?: unknown;
    };

    const section = body.section;
    const listingIdRaw = body.listingId;
    const reasonRaw = body.reason;
    const commentRaw = body.comment;

    if (!isListingSection(section) || typeof listingIdRaw !== 'string' || typeof reasonRaw !== 'string') {
      return NextResponse.json({ ok: false, error: 'INVALID_REQUEST' }, { status: 400 });
    }

    const listingId = listingIdRaw.trim();
    const reason = reasonRaw.trim() as ListingReportReason;
    const comment = typeof commentRaw === 'string' ? commentRaw.trim() : '';

    if (!listingId) {
      return NextResponse.json({ ok: false, error: 'INVALID_LISTING' }, { status: 400 });
    }

    if (!LISTING_REPORT_REASONS.includes(reason)) {
      return NextResponse.json({ ok: false, error: 'INVALID_REASON' }, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();

    const listing = await getListingBasicInfo(section, listingId, supabase);
    if (!listing) {
      return NextResponse.json({ ok: false, error: 'LISTING_NOT_FOUND' }, { status: 404 });
    }

    if (listing.status === 'archived') {
      return NextResponse.json({ ok: false, error: 'LISTING_NOT_ACTIVE' }, { status: 400 });
    }

    const { error: insertError } = await supabase.from('listing_reports').insert({
      section,
      listing_id: listing.id,
      reporter_user_id: currentUser.userId,
      owner_user_id: listing.user_id,
      reason,
      comment: comment || null,
      status: 'new',
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: false, error: 'REPORT_ALREADY_EXISTS' }, { status: 409 });
      }

      console.error('[listings/report][POST] failed to insert report', insertError);
      return NextResponse.json({ ok: false, error: 'REPORT_CREATION_FAILED' }, { status: 500 });
    }

    const totalNewReports = await countNewReportsForListing(section, listingId, supabase);
    let autoArchived = false;

    if (totalNewReports >= 3) {
      autoArchived = await updateListingStatus(section, listingId, 'archived', supabase);
    }

    return NextResponse.json({ ok: true, autoArchived });
  } catch (error) {
    console.error('[listings/report][POST] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
