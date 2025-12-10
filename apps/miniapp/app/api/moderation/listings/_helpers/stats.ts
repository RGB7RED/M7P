import { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';
import { LISTING_SECTION_TABLES, ListingSection } from '../../../listings/_helpers/sections';

export type ListingModerationStats = {
  newReports: Record<ListingSection, number>;
  listingsWithReports: {
    active: number;
    archived: number;
  };
};

async function countNewReportsBySection(client: SupabaseClient): Promise<Record<ListingSection, number>> {
  const sections: ListingSection[] = ['market', 'housing', 'jobs'];
  const entries = await Promise.all(
    sections.map(async (section) => {
      const { count, error } = await client
        .from('listing_reports')
        .select('id', { count: 'exact', head: true })
        .eq('section', section)
        .eq('status', 'new');

      if (error) {
        console.error('[moderation/listings] failed to count new reports', { section, error });
        throw new Error('NEW_REPORTS_LOOKUP_FAILED');
      }

      return [section, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<ListingSection, number>;
}

async function countListingsWithReports(client: SupabaseClient): Promise<{ active: number; archived: number }> {
  const sections: ListingSection[] = ['market', 'housing', 'jobs'];
  let active = 0;
  let archived = 0;

  for (const section of sections) {
    const { data: reportRows, error: reportError } = await client
      .from('listing_reports')
      .select('listing_id')
      .eq('section', section)
      .limit(2000);

    if (reportError) {
      console.error('[moderation/listings] failed to fetch listing ids', { section, reportError });
      throw new Error('LISTING_IDS_LOOKUP_FAILED');
    }

    const ids = Array.from(new Set((reportRows ?? []).map((row) => row.listing_id).filter(Boolean)));
    if (!ids.length) continue;

    const { data: listings, error: listingsError } = await client
      .from(LISTING_SECTION_TABLES[section])
      .select('id, status')
      .in('id', ids);

    if (listingsError) {
      console.error('[moderation/listings] failed to fetch listing statuses', { section, listingsError });
      throw new Error('LISTING_STATUS_LOOKUP_FAILED');
    }

    (listings ?? []).forEach((row) => {
      if (row.status === 'archived') {
        archived += 1;
      } else {
        active += 1;
      }
    });
  }

  return { active, archived };
}

export async function getListingModerationStats(client?: SupabaseClient): Promise<ListingModerationStats> {
  const supabase = client ?? getServiceSupabaseClient();

  const [newReports, listingsWithReports] = await Promise.all([
    countNewReportsBySection(supabase),
    countListingsWithReports(supabase),
  ]);

  return { newReports, listingsWithReports };
}
