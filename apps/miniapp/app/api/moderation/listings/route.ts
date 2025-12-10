import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../../lib/currentUser';
import { isModeratorUser } from '../../../../../lib/moderators';
import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';

export const dynamic = 'force-dynamic';

type Section = 'market' | 'housing' | 'jobs';
type ReportStatus = 'new' | 'resolved';

type ActionBody = {
  action?: 'resolveReport' | 'archiveListing' | 'unarchiveListing' | 'banUser' | 'unbanUser';
  reportId?: string;
  section?: Section;
  listingId?: string;
  ownerUserId?: string;
  moderatorNote?: string;
};

type ReportRow = {
  id: string;
  section: Section;
  listing_id: string;
  reason: string;
  comment: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  moderator_note: string | null;
  reporter: { id: string; telegram_username: string } | null;
  owner: { id: string; telegram_username: string; status: string } | null;
};

type ListingMapItem = {
  id: string;
  title: string;
  city: string | null;
  priceLabel: string | null;
  status: string;
};

const SECTION_TABLES: Record<Section, string> = {
  market: 'market_listings',
  housing: 'housing_listings',
  jobs: 'job_listings',
};

async function assertModerator() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isModeratorUser(currentUser)) {
    return { error: NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 }) } as const;
  }

  return { currentUser } as const;
}

function buildSectionFilter(section: string | null): Section | undefined {
  if (section === 'market' || section === 'housing' || section === 'jobs') return section;
  return undefined;
}

async function fetchListingsBySection(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  section: Section,
  ids: string[],
): Promise<Record<string, ListingMapItem>> {
  if (!ids.length) return {};
  const table = SECTION_TABLES[section];
  const selectFields = {
    market: 'id, title, city, price, currency, status',
    housing: 'id, title, city, price_per_month, currency, status',
    jobs: 'id, title, city, salary_from, salary_to, currency, status',
  }[section];

  const { data, error } = await supabase.from(table).select(selectFields).in('id', ids);

  if (error) {
    console.error('[moderation/listings] failed to fetch listings', { section, error });
    throw new Error('LISTINGS_FETCH_FAILED');
  }

  const map: Record<string, ListingMapItem> = {};

  for (const row of data ?? []) {
    let priceLabel: string | null = null;
    if (section === 'market') {
      const currency = (row as any).currency ?? 'RUB';
      priceLabel = (row as any).price !== null ? `${(row as any).price} ${currency}` : null;
    }
    if (section === 'housing') {
      const currency = (row as any).currency ?? 'RUB';
      priceLabel = `${(row as any).price_per_month} ${currency}/мес`;
    }
    if (section === 'jobs') {
      const currency = (row as any).currency ?? 'RUB';
      const from = (row as any).salary_from;
      const to = (row as any).salary_to;
      if (from && to) priceLabel = `${from}–${to} ${currency}`;
      else if (from) priceLabel = `от ${from} ${currency}`;
      else if (to) priceLabel = `до ${to} ${currency}`;
    }

    map[(row as any).id] = {
      id: (row as any).id,
      title: (row as any).title,
      city: (row as any).city ?? null,
      priceLabel,
      status: (row as any).status,
    };
  }

  return map;
}

async function buildListingCounts(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  section: Section,
): Promise<{ active: number; archived: number }> {
  const { data: reportRows, error } = await supabase
    .from('listing_reports')
    .select('listing_id')
    .eq('section', section);

  if (error) {
    console.error('[moderation/listings] failed to fetch report listing ids', error);
    throw new Error('REPORT_IDS_FETCH_FAILED');
  }

  const ids = Array.from(new Set((reportRows ?? []).map((row) => row.listing_id)));
  if (!ids.length) return { active: 0, archived: 0 };

  const table = SECTION_TABLES[section];
  const { data: listings, error: statusError } = await supabase
    .from(table)
    .select('id, status')
    .in('id', ids);

  if (statusError) {
    console.error('[moderation/listings] failed to fetch listing statuses', statusError);
    throw new Error('LISTING_STATUS_FETCH_FAILED');
  }

  let active = 0;
  let archived = 0;

  for (const item of listings ?? []) {
    if ((item as any).status === 'archived') archived += 1;
    else active += 1;
  }

  return { active, archived };
}

export async function GET(req: Request) {
  const moderator = await assertModerator();
  if ('error' in moderator) return moderator.error;

  try {
    const supabase = getServiceSupabaseClient();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    const sectionParam = buildSectionFilter(url.searchParams.get('section'));
    const statusFilter: ReportStatus | undefined = statusParam === 'new' || statusParam === 'resolved' ? statusParam : undefined;

    let query = supabase
      .from('listing_reports')
      .select(
        `
        id,
        section,
        listing_id,
        reason,
        comment,
        status,
        created_at,
        resolved_at,
        moderator_note,
        reporter:users!listing_reports_reporter_user_id_fkey(id, telegram_username),
        owner:users!listing_reports_owner_user_id_fkey(id, telegram_username, status)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (sectionParam) {
      query = query.eq('section', sectionParam);
    }

    const { data: reportsData, error: reportsError } = await query;

    if (reportsError) {
      console.error('[moderation/listings][GET] failed to load reports', reportsError);
      return NextResponse.json({ ok: false, error: 'REPORTS_FETCH_FAILED' }, { status: 500 });
    }

    const reports: ReportRow[] = reportsData ?? [];

    const marketIds = Array.from(new Set(reports.filter((r) => r.section === 'market').map((r) => r.listing_id)));
    const housingIds = Array.from(new Set(reports.filter((r) => r.section === 'housing').map((r) => r.listing_id)));
    const jobIds = Array.from(new Set(reports.filter((r) => r.section === 'jobs').map((r) => r.listing_id)));

    const [marketMap, housingMap, jobMap] = await Promise.all([
      fetchListingsBySection(supabase, 'market', marketIds),
      fetchListingsBySection(supabase, 'housing', housingIds),
      fetchListingsBySection(supabase, 'jobs', jobIds),
    ]);

    const totalReportCounts: Record<string, number> = {};

    const countForSection = async (section: Section, ids: string[]) => {
      if (!ids.length) return;
      const { data, error } = await supabase
        .from('listing_reports')
        .select('listing_id')
        .eq('section', section)
        .in('listing_id', ids);

      if (error) {
        console.error('[moderation/listings] failed to count reports for section', section, error);
        throw new Error('REPORT_COUNT_FAILED');
      }

      for (const row of data ?? []) {
        const key = `${section}:${row.listing_id}`;
        totalReportCounts[key] = (totalReportCounts[key] ?? 0) + 1;
      }
    };

    await Promise.all([
      countForSection('market', marketIds),
      countForSection('housing', housingIds),
      countForSection('jobs', jobIds),
    ]);

    const responseItems = reports.map((report) => {
      const listingMap = report.section === 'market' ? marketMap : report.section === 'housing' ? housingMap : jobMap;
      const listing = listingMap[report.listing_id] ?? null;
      const totalReports = totalReportCounts[`${report.section}:${report.listing_id}`] ?? 0;

      return { ...report, listing, totalReports };
    });

    const newBySectionEntries = await Promise.all(
      (['market', 'housing', 'jobs'] as Section[]).map(async (section) => {
        const { count, error } = await supabase
          .from('listing_reports')
          .select('id', { count: 'exact', head: true })
          .eq('section', section)
          .eq('status', 'new');

        if (error) {
          console.error('[moderation/listings] failed to count new reports', { section, error });
          throw new Error('NEW_REPORTS_COUNT_FAILED');
        }

        return [section, count ?? 0] as const;
      }),
    );

    const listingStatusCounts = await Promise.all([
      buildListingCounts(supabase, 'market'),
      buildListingCounts(supabase, 'housing'),
      buildListingCounts(supabase, 'jobs'),
    ]);

    const stats = {
      newBySection: Object.fromEntries(newBySectionEntries) as Record<Section, number>,
      listingsWithReports: {
        active: listingStatusCounts.reduce((acc, item) => acc + item.active, 0),
        archived: listingStatusCounts.reduce((acc, item) => acc + item.archived, 0),
      },
    };

    return NextResponse.json({ ok: true, reports: responseItems, stats });
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
    const section = buildSectionFilter(body.section ?? null);
    const listingId = body.listingId?.trim();
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
        console.error('[moderation/listings][POST] resolve error', error);
        return NextResponse.json({ ok: false, error: 'RESOLVE_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'REPORT_NOT_FOUND' }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'archiveListing' || action === 'unarchiveListing') {
      if (!section || !listingId) {
        return NextResponse.json({ ok: false, error: 'SECTION_AND_LISTING_REQUIRED' }, { status: 400 });
      }

      const targetStatus = action === 'archiveListing' ? 'archived' : 'active';
      const table = SECTION_TABLES[section];

      const { data, error } = await supabase
        .from(table)
        .update({ status: targetStatus })
        .eq('id', listingId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[moderation/listings][POST] listing status change error', error);
        return NextResponse.json({ ok: false, error: 'LISTING_STATUS_UPDATE_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'LISTING_NOT_FOUND' }, { status: 404 });
      }

      if (reportId) {
        const updatePayload: Record<string, string> = {
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: currentUser.userId,
        };

        if (moderatorNote !== null) {
          updatePayload.moderator_note = moderatorNote;
        }

        await supabase.from('listing_reports').update(updatePayload).eq('id', reportId);
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'banUser' || action === 'unbanUser') {
      if (!ownerUserId) {
        return NextResponse.json({ ok: false, error: 'OWNER_USER_REQUIRED' }, { status: 400 });
      }

      const targetStatus = action === 'banUser' ? 'banned' : 'active';
      const { data, error } = await supabase
        .from('users')
        .update({ status: targetStatus })
        .eq('id', ownerUserId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[moderation/listings][POST] user status change error', error);
        return NextResponse.json({ ok: false, error: 'USER_STATUS_UPDATE_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });
      }

      if (reportId) {
        const updatePayload: Record<string, string> = {
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: currentUser.userId,
        };

        if (moderatorNote !== null) {
          updatePayload.moderator_note = moderatorNote;
        } else {
          updatePayload.moderator_note =
            action === 'banUser' ? 'Пользователь забанен вручную.' : 'Бан снят вручную.';
        }

        if (action === 'banUser') {
          updatePayload.status = 'resolved';
        }

        await supabase.from('listing_reports').update(updatePayload).eq('id', reportId);
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
