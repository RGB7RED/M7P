import { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { LISTING_SECTION_TABLES, ListingSection } from './sections';

export type ListingReportReason = 'spam' | 'scam' | 'escort' | 'drugs' | 'weapons' | 'other';

export const LISTING_REPORT_REASONS: ListingReportReason[] = ['spam', 'scam', 'escort', 'drugs', 'weapons', 'other'];

export type ListingSummary = {
  id: string;
  title: string | null;
  city: string | null;
  priceLabel: string | null;
  status: string | null;
};

export async function getListingBasicInfo(
  section: ListingSection,
  listingId: string,
  client?: SupabaseClient,
): Promise<{ id: string; user_id: string; status: string } | null> {
  const supabase = client ?? getServiceSupabaseClient();
  const table = LISTING_SECTION_TABLES[section];

  const { data, error } = await supabase
    .from(table)
    .select('id, user_id, status')
    .eq('id', listingId)
    .maybeSingle();

  if (error) {
    console.error('[listings][reports] failed to fetch listing', { section, listingId, error });
    throw new Error('LISTING_LOOKUP_FAILED');
  }

  if (!data) {
    return null;
  }

  return { id: data.id, user_id: data.user_id, status: data.status };
}

export async function countNewReportsForListing(
  section: ListingSection,
  listingId: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = client ?? getServiceSupabaseClient();

  const { count, error } = await supabase
    .from('listing_reports')
    .select('id', { count: 'exact', head: true })
    .eq('section', section)
    .eq('listing_id', listingId)
    .eq('status', 'new');

  if (error) {
    console.error('[listings][reports] failed to count new reports', { section, listingId, error });
    throw new Error('REPORT_COUNT_FAILED');
  }

  return count ?? 0;
}

export async function updateListingStatus(
  section: ListingSection,
  listingId: string,
  status: string,
  client?: SupabaseClient,
): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();
  const table = LISTING_SECTION_TABLES[section];

  const { data, error } = await supabase
    .from(table)
    .update({ status })
    .eq('id', listingId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[listings][reports] failed to update listing status', { section, listingId, status, error });
    throw new Error('LISTING_STATUS_UPDATE_FAILED');
  }

  return Boolean(data?.id);
}

export async function fetchListingSummaries(
  section: ListingSection,
  listingIds: string[],
  client?: SupabaseClient,
): Promise<Map<string, ListingSummary>> {
  const supabase = client ?? getServiceSupabaseClient();
  const table = LISTING_SECTION_TABLES[section];
  const map = new Map<string, ListingSummary>();

  if (!listingIds.length) return map;

  if (section === 'market') {
    const { data, error } = await supabase
      .from(table)
      .select('id, title, city, price, currency, status')
      .in('id', listingIds);

    if (error) {
      console.error('[listings][reports] failed to fetch market listings', error);
      throw new Error('LISTING_FETCH_FAILED');
    }

    (data ?? []).forEach((row) => {
      map.set(row.id, {
        id: row.id,
        title: row.title ?? null,
        city: row.city ?? null,
        priceLabel: row.price !== null && row.price !== undefined ? `${row.price} ${row.currency ?? 'RUB'}` : null,
        status: row.status ?? null,
      });
    });
    return map;
  }

  if (section === 'housing') {
    const { data, error } = await supabase
      .from(table)
      .select('id, title, city, price_per_month, currency, status')
      .in('id', listingIds);

    if (error) {
      console.error('[listings][reports] failed to fetch housing listings', error);
      throw new Error('LISTING_FETCH_FAILED');
    }

    (data ?? []).forEach((row) => {
      map.set(row.id, {
        id: row.id,
        title: row.title ?? null,
        city: row.city ?? null,
        priceLabel:
          row.price_per_month !== null && row.price_per_month !== undefined
            ? `${row.price_per_month} ${row.currency ?? 'RUB'} / мес`
            : null,
        status: row.status ?? null,
      });
    });
    return map;
  }

  const { data, error } = await supabase
    .from(table)
    .select('id, title, city, salary_from, salary_to, currency, status')
    .in('id', listingIds);

  if (error) {
    console.error('[listings][reports] failed to fetch job listings', error);
    throw new Error('LISTING_FETCH_FAILED');
  }

  (data ?? []).forEach((row) => {
    const from = row.salary_from !== null && row.salary_from !== undefined ? row.salary_from : null;
    const to = row.salary_to !== null && row.salary_to !== undefined ? row.salary_to : null;
    const label = from || to ? `${from ?? 'от'} - ${to ?? '...'} ${row.currency ?? 'RUB'}` : null;

    map.set(row.id, {
      id: row.id,
      title: row.title ?? null,
      city: row.city ?? null,
      priceLabel: label,
      status: row.status ?? null,
    });
  });

  return map;
}

export async function countReportsForListings(
  section: ListingSection,
  listingIds: string[],
  client?: SupabaseClient,
): Promise<Map<string, number>> {
  const supabase = client ?? getServiceSupabaseClient();
  const counts = new Map<string, number>();

  if (!listingIds.length) return counts;

  const { data, error } = await supabase
    .from('listing_reports')
    .select('listing_id')
    .eq('section', section)
    .in('listing_id', listingIds);

  if (error) {
    console.error('[listings][reports] failed to count listing reports', { section, listingIds, error });
    throw new Error('REPORTS_COUNT_FAILED');
  }

  (data ?? []).forEach((row) => {
    if (!row.listing_id) return;
    counts.set(row.listing_id, (counts.get(row.listing_id) ?? 0) + 1);
  });

  return counts;
}
