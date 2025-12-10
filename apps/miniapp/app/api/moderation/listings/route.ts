import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../lib/currentUser';
import { isModeratorUser } from '../../../../lib/moderators';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { fetchListingReports, ListingModerationFilters } from './_helpers/reports';
import { getListingModerationStats } from './_helpers/stats';
import { isListingSection, LISTING_SECTION_TABLES, ListingSection } from '../../listings/_helpers/sections';

export const dynamic = 'force-dynamic';

type ActionBody = {
  action?: 'resolveReport' | 'archiveListing' | 'unarchiveListing' | 'banUser' | 'unbanUser';
  reportId?: string;
  section?: ListingSection;
  listingId?: string;
  ownerUserId?: string;
  moderatorNote?: string;
};

async function assertModerator() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isModeratorUser(currentUser)) {
    return { error: NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 }) };
  }

  return { currentUser };
}

export async function GET(req: Request) {
  const moderator = await assertModerator();
  if ('error' in moderator) return moderator.error;

  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    const sectionParam = url.searchParams.get('section');
    const limitRaw = Number(url.searchParams.get('limit'));

    const filters: ListingModerationFilters = {
      status: statusParam === 'new' || statusParam === 'resolved' ? statusParam : undefined,
      section: isListingSection(sectionParam) ? sectionParam : undefined,
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    };

    const supabase = getServiceSupabaseClient();
    const [reports, stats] = await Promise.all([
      fetchListingReports(filters, supabase),
      getListingModerationStats(supabase),
    ]);

    return NextResponse.json({ ok: true, reports: reports.items, reasons: reports.reasons, stats });
  } catch (error) {
    console.error('[moderation/listings][GET] unexpected error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const moderator = await assertModerator();
  if ('error' in moderator) return moderator.error;

  const { currentUser } = moderator;
  const supabase = getServiceSupabaseClient();

  try {
    const body = (await req.json()) as ActionBody;
    const action = body.action;
    const reportId = body.reportId?.trim();
    const listingId = body.listingId?.trim();
    const section = body.section;
    const ownerUserId = body.ownerUserId?.trim();
    const moderatorNote = body.moderatorNote?.trim() || null;

    if (!action) {
      return NextResponse.json({ ok: false, error: 'INVALID_ACTION' }, { status: 400 });
    }

    if (action === 'resolveReport') {
      if (!reportId) {
        return NextResponse.json({ ok: false, error: 'REPORT_ID_REQUIRED' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('listing_reports')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: currentUser.userId,
          moderator_note: moderatorNote,
        })
        .eq('id', reportId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[moderation/listings][POST] resolve failed', error);
        return NextResponse.json({ ok: false, error: 'RESOLVE_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'REPORT_NOT_FOUND' }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'archiveListing' || action === 'unarchiveListing') {
      if (!listingId || !isListingSection(section)) {
        return NextResponse.json({ ok: false, error: 'LISTING_REQUIRED' }, { status: 400 });
      }

      const table = LISTING_SECTION_TABLES[section];
      const targetStatus = action === 'archiveListing' ? 'archived' : 'active';

      const { data, error } = await supabase
        .from(table)
        .update({ status: targetStatus })
        .eq('id', listingId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[moderation/listings][POST] update listing status failed', error);
        return NextResponse.json({ ok: false, error: 'LISTING_UPDATE_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'LISTING_NOT_FOUND' }, { status: 404 });
      }

      if (reportId) {
        await supabase
          .from('listing_reports')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by_user_id: currentUser.userId,
            moderator_note: moderatorNote,
          })
          .eq('id', reportId);
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'banUser' || action === 'unbanUser') {
      if (!ownerUserId) {
        return NextResponse.json({ ok: false, error: 'USER_REQUIRED' }, { status: 400 });
      }

      const targetStatus = action === 'banUser' ? 'banned' : 'active';

      const { data, error } = await supabase
        .from('users')
        .update({ status: targetStatus })
        .eq('id', ownerUserId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[moderation/listings][POST] user status update failed', error);
        return NextResponse.json({ ok: false, error: 'USER_STATUS_UPDATE_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });
      }

      if (reportId) {
        await supabase
          .from('listing_reports')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by_user_id: currentUser.userId,
            moderator_note: moderatorNote ??
              (action === 'banUser' ? 'Пользователь забанен модератором.' : 'Бан снят модератором.'),
          })
          .eq('id', reportId);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
  } catch (error) {
    console.error('[moderation/listings][POST] unexpected error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
