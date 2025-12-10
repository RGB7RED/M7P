import { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';
import {
  countReportsForListings,
  fetchListingSummaries,
  LISTING_REPORT_REASONS,
  ListingReportReason,
} from '../../../listings/_helpers/reports';
import { ListingSection } from '../../../listings/_helpers/sections';

export type ListingModerationFilters = {
  status?: 'new' | 'resolved';
  section?: ListingSection;
  limit?: number;
};

export type ListingModerationReport = {
  id: string;
  section: ListingSection;
  listingId: string;
  reason: ListingReportReason;
  comment: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  moderator_note: string | null;
  reporter: { id: string; telegram_username: string } | null;
  owner: { id: string; telegram_username: string; status: string; isBanned: boolean } | null;
  listing: {
    title: string | null;
    city: string | null;
    priceLabel: string | null;
    status: string | null;
  } | null;
  totalReports: number;
};

export async function fetchListingReports(
  filters: ListingModerationFilters,
  client?: SupabaseClient,
): Promise<{ items: ListingModerationReport[]; reasons: ListingReportReason[] }> {
  const supabase = client ?? getServiceSupabaseClient();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 150);

  let query = supabase
    .from('listing_reports')
    .select(
      `id, section, listing_id, reason, comment, status, created_at, resolved_at, moderator_note, owner_user_id, reporter_user_id,
       reporter:users!listing_reports_reporter_user_id_fkey(id, telegram_username),
       owner:users!listing_reports_owner_user_id_fkey(id, telegram_username, status)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.status === 'resolved') {
    query = query.eq('status', 'resolved');
  } else if (filters.status === 'new') {
    query = query.eq('status', 'new');
  }

  if (filters.section) {
    query = query.eq('section', filters.section);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[moderation/listings] failed to load reports', error);
    throw new Error('REPORTS_LOOKUP_FAILED');
  }

  const reportRows = data ?? [];
  const listingIdsBySection = new Map<ListingSection, Set<string>>();

  reportRows.forEach((row) => {
    const ids = listingIdsBySection.get(row.section as ListingSection) ?? new Set<string>();
    ids.add(row.listing_id);
    listingIdsBySection.set(row.section as ListingSection, ids);
  });

  const listingSummaries = new Map<string, ListingModerationReport['listing']>();
  const reportCounts = new Map<string, number>();

  for (const [section, idsSet] of listingIdsBySection.entries()) {
    const ids = Array.from(idsSet);
    const summaries = await fetchListingSummaries(section, ids, supabase);
    const counts = await countReportsForListings(section, ids, supabase);

    summaries.forEach((summary, listingId) => {
      listingSummaries.set(`${section}:${listingId}`, summary);
    });

    counts.forEach((value, listingId) => {
      reportCounts.set(`${section}:${listingId}`, value);
    });
  }

  const items: ListingModerationReport[] = reportRows.map((row) => {
    const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
    const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
    const listingKey = `${row.section}:${row.listing_id}`;

    return {
      id: row.id,
      section: row.section as ListingSection,
      listingId: row.listing_id,
      reason: row.reason as ListingReportReason,
      comment: row.comment ?? null,
      status: row.status,
      created_at: row.created_at,
      resolved_at: row.resolved_at ?? null,
      moderator_note: row.moderator_note ?? null,
      reporter: reporter
        ? {
            id: reporter.id,
            telegram_username: reporter.telegram_username,
          }
        : null,
      owner: owner
        ? {
            id: owner.id,
            telegram_username: owner.telegram_username,
            status: owner.status,
            isBanned: owner.status === 'banned',
          }
        : null,
      listing: listingSummaries.get(listingKey) ?? null,
      totalReports: reportCounts.get(listingKey) ?? 0,
    };
  });

  return { items, reasons: LISTING_REPORT_REASONS };
}
