import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export const dynamic = 'force-dynamic';

type Section = 'market' | 'housing' | 'jobs';
type ReportReason = 'spam' | 'scam' | 'escort' | 'drugs' | 'weapons' | 'other';

type ReportBody = {
  section?: Section;
  listingId?: string;
  reason?: ReportReason;
  comment?: string;
};

const ALLOWED_SECTIONS: Section[] = ['market', 'housing', 'jobs'];
const ALLOWED_REASONS: ReportReason[] = ['spam', 'scam', 'escort', 'drugs', 'weapons', 'other'];

const SECTION_TABLES: Record<Section, string> = {
  market: 'market_listings',
  housing: 'housing_listings',
  jobs: 'job_listings',
};

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await req.json()) as ReportBody;
    const section = body.section;
    const listingId = body.listingId?.trim();
    const reason = body.reason;
    const comment = body.comment?.trim() || null;

    if (!section || !ALLOWED_SECTIONS.includes(section) || !listingId || !reason || !ALLOWED_REASONS.includes(reason)) {
      return NextResponse.json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();
    const table = SECTION_TABLES[section];

    const { data: listing, error: listingError } = await supabase
      .from(table)
      .select('id, user_id, status')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError) {
      console.error('[listings/report] failed to load listing', listingError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    if (!listing || listing.status === 'archived') {
      return NextResponse.json({ ok: false, error: 'LISTING_NOT_FOUND_OR_ARCHIVED' }, { status: 404 });
    }

    if (listing.user_id === currentUser.userId) {
      return NextResponse.json({ ok: false, error: 'CANNOT_REPORT_OWN_LISTING' }, { status: 400 });
    }

    const { error: insertError } = await supabase.from('listing_reports').insert({
      section,
      listing_id: listingId,
      reporter_user_id: currentUser.userId,
      owner_user_id: listing.user_id,
      reason,
      comment,
      status: 'new',
    });

    if (insertError) {
      if ((insertError as any)?.code === '23505') {
        return NextResponse.json({ ok: false, error: 'ALREADY_REPORTED' }, { status: 409 });
      }
      console.error('[listings/report] insert error', insertError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const { count, error: countError } = await supabase
      .from('listing_reports')
      .select('id', { count: 'exact', head: true })
      .eq('section', section)
      .eq('listing_id', listingId)
      .eq('status', 'new');

    if (countError) {
      console.error('[listings/report] count error', countError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    let autoArchived = false;
    const totalReports = count ?? 0;

    if (totalReports >= 3 && listing.status !== 'archived') {
      const { data: updatedListing, error: archiveError } = await supabase
        .from(table)
        .update({ status: 'archived' })
        .eq('id', listingId)
        .neq('status', 'archived')
        .select('id')
        .maybeSingle();

      if (archiveError) {
        console.error('[listings/report] auto archive error', archiveError);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }

      autoArchived = Boolean(updatedListing);
    }

    return NextResponse.json({ ok: true, autoArchived });
  } catch (error) {
    console.error('[listings/report] unexpected error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
