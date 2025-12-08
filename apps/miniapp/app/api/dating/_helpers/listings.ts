import { SupabaseClient } from '@supabase/supabase-js';

import { ListingPreview, ListingPreviewGroups, ListingType } from '../../../dating/types';

type MarketRow = {
  id: string;
  title: string;
  city: string | null;
  price: number | null;
  currency: string | null;
  created_at: string;
};

type HousingRow = {
  id: string;
  title: string;
  city: string | null;
  price_per_month: number | null;
  currency: string | null;
  created_at: string;
};

type JobRow = {
  id: string;
  title: string;
  city: string | null;
  salary_from: number | null;
  salary_to: number | null;
  currency: string | null;
  created_at: string;
};

type ListingSelection = Record<ListingType, string[]>;

const EMPTY_SELECTION: ListingSelection = { market: [], housing: [], job: [] };

export function formatPrice(price: number | null, currency: string | null): string | null {
  if (price === null || price === undefined) return null;
  return `${price} ${currency ?? 'RUB'}`;
}

function formatSalary(salaryFrom: number | null, salaryTo: number | null, currency: string | null): string | null {
  const currencyLabel = currency ?? 'RUB';
  if (salaryFrom !== null && salaryFrom !== undefined && salaryTo !== null && salaryTo !== undefined) {
    return `${salaryFrom}–${salaryTo} ${currencyLabel}`;
  }
  if (salaryFrom !== null && salaryFrom !== undefined) {
    return `от ${salaryFrom} ${currencyLabel}`;
  }
  if (salaryTo !== null && salaryTo !== undefined) {
    return `до ${salaryTo} ${currencyLabel}`;
  }
  return null;
}

async function hasAnyActiveListings(userId: string, client: SupabaseClient): Promise<boolean> {
  const [market, housing, jobs] = await Promise.all([
    client.from('market_listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    client.from('housing_listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    client.from('job_listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
  ]);

  const error = market.error || housing.error || jobs.error;
  if (error) {
    console.error('[dating][listings] failed to check listings for user', { userId, error });
    throw new Error('LISTINGS_LOOKUP_FAILED');
  }

  return (market.count ?? 0) > 0 || (housing.count ?? 0) > 0 || (jobs.count ?? 0) > 0;
}

type ListingLookupOptions = {
  selection?: ListingSelection | null;
  limitPerType?: number;
};

async function loadListingsByType(
  userId: string,
  client: SupabaseClient,
  options?: ListingLookupOptions,
): Promise<ListingPreviewGroups> {
  const limit = options?.limitPerType ?? 3;
  const selection = options?.selection ?? null;

  const [market, housing, jobs] = await Promise.all([
    selection && selection.market.length === 0
      ? { data: [] }
      : (() => {
          let query = client
            .from('market_listings')
            .select('id, title, city, price, currency, created_at')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(limit);
          if (selection) {
            query = query.in('id', selection.market);
          }
          return query;
        })(),
    selection && selection.housing.length === 0
      ? { data: [] }
      : (() => {
          let query = client
            .from('housing_listings')
            .select('id, title, city, price_per_month, currency, created_at')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(limit);
          if (selection) {
            query = query.in('id', selection.housing);
          }
          return query;
        })(),
    selection && selection.job.length === 0
      ? { data: [] }
      : (() => {
          let query = client
            .from('job_listings')
            .select('id, title, city, salary_from, salary_to, currency, created_at')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(limit);
          if (selection) {
            query = query.in('id', selection.job);
          }
          return query;
        })(),
  ]);

  const error = (market as { error?: unknown }).error || (housing as { error?: unknown }).error || (jobs as { error?: unknown }).error;
  if (error) {
    console.error('[dating][listings] failed to load listings for user', { userId, error });
    throw new Error('LISTINGS_LOOKUP_FAILED');
  }

  const marketListings = ((market as { data?: MarketRow[] | null }).data ?? []).map<ListingPreview>((item) => ({
    id: item.id,
    section: 'market',
    title: item.title,
    city: item.city,
    priceLabel: formatPrice(item.price, item.currency),
  }));

  const housingListings = ((housing as { data?: HousingRow[] | null }).data ?? []).map<ListingPreview>((item) => ({
    id: item.id,
    section: 'housing',
    title: item.title,
    city: item.city,
    priceLabel: formatPrice(item.price_per_month, item.currency),
  }));

  const jobListings = ((jobs as { data?: JobRow[] | null }).data ?? []).map<ListingPreview>((item) => ({
    id: item.id,
    section: 'jobs',
    title: item.title,
    city: item.city,
    priceLabel: formatSalary(item.salary_from, item.salary_to, item.currency),
  }));

  return { market: marketListings, housing: housingListings, jobs: jobListings };
}

export async function getActiveListingsForUser(
  userId: string,
  client: SupabaseClient,
  options?: ListingLookupOptions,
): Promise<{ listings: ListingPreviewGroups; hasActiveListings: boolean }> {
  const selection = options?.selection;
  const listings = await loadListingsByType(userId, client, options);
  const hasActiveListings = selection ? await hasAnyActiveListings(userId, client) : listings.market.length + listings.housing.length + listings.jobs.length > 0;

  return { listings, hasActiveListings };
}

export async function getHasActiveListings(userId: string, client: SupabaseClient): Promise<boolean> {
  return hasAnyActiveListings(userId, client);
}

export async function getSelectionsForProfiles(
  client: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, ListingSelection>> {
  if (!profileIds.length) return new Map();

  const { data, error } = await client
    .from('dating_profile_listings')
    .select('profile_id, listing_type, listing_id')
    .in('profile_id', profileIds);

  if (error) {
    console.error('[dating][listings] failed to load selections', error);
    throw new Error('LISTING_SELECTION_LOOKUP_FAILED');
  }

  const selections = new Map<string, ListingSelection>();

  (data ?? []).forEach((row) => {
    const type = row.listing_type as ListingType;
    if (!['market', 'housing', 'job'].includes(type)) return;
    const existing = selections.get(row.profile_id) ?? { ...EMPTY_SELECTION };
    existing[type] = [...existing[type], row.listing_id];
    selections.set(row.profile_id, existing);
  });

  return selections;
}

export function emptySelection(): ListingSelection {
  return { ...EMPTY_SELECTION, market: [], housing: [], job: [] };
}
