import { SupabaseClient } from '@supabase/supabase-js';

import { ListingPreview, ListingPreviewGroups } from '../../../dating/types';

const LISTING_TYPES = {
  market: { table: 'market_listings', section: 'market' as const },
  housing: { table: 'housing_listings', section: 'housing' as const },
  job: { table: 'job_listings', section: 'jobs' as const },
};

export type ListingSelection = { listingType: keyof typeof LISTING_TYPES; listingId: string };

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

type ListingRow = MarketRow | HousingRow | JobRow;

type ListingCounts = { market: number; housing: number; job: number };

type ListingsLookupOptions = {
  userId: string;
  profileId?: string;
  client: SupabaseClient;
  selectedOnly?: boolean;
  limitPerType?: number;
  includeListings?: boolean;
};

type ListingsLookupResult = {
  listings: ListingPreviewGroups;
  hasActiveListings: boolean;
  selected: ListingSelection[];
};

function formatPrice(price: number | null, currency: string | null): string | null {
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

function mapRowsToListingPreviews(type: keyof typeof LISTING_TYPES, rows: ListingRow[]): ListingPreview[] {
  if (type === 'market') {
    return (rows as MarketRow[]).map<ListingPreview>((item) => ({
      id: item.id,
      section: 'market',
      title: item.title,
      city: item.city,
      priceLabel: formatPrice(item.price, item.currency),
    }));
  }

  if (type === 'housing') {
    return (rows as HousingRow[]).map<ListingPreview>((item) => ({
      id: item.id,
      section: 'housing',
      title: item.title,
      city: item.city,
      priceLabel: formatPrice(item.price_per_month, item.currency),
    }));
  }

  return (rows as JobRow[]).map<ListingPreview>((item) => ({
    id: item.id,
    section: 'jobs',
    title: item.title,
    city: item.city,
    priceLabel: formatSalary(item.salary_from, item.salary_to, item.currency),
  }));
}

async function getListingCounts(userId: string, client: SupabaseClient): Promise<ListingCounts> {
  const [market, housing, job] = await Promise.all([
    client.from(LISTING_TYPES.market.table).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    client
      .from(LISTING_TYPES.housing.table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
    client.from(LISTING_TYPES.job.table).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
  ]);

  const error = market.error || housing.error || job.error;
  if (error) {
    console.error('[dating][listings] failed to count listings for user', { userId, error });
    throw new Error('LISTINGS_LOOKUP_FAILED');
  }

  return {
    market: market.count ?? 0,
    housing: housing.count ?? 0,
    job: job.count ?? 0,
  };
}

async function getSelectedListingEntries(profileId: string, client: SupabaseClient): Promise<ListingSelection[]> {
  const { data, error } = await client
    .from('dating_profile_listings')
    .select('listing_type, listing_id')
    .eq('profile_id', profileId);

  if (error) {
    console.error('[dating][listings] failed to load selected listings for profile', { profileId, error });
    throw new Error('LISTINGS_LOOKUP_FAILED');
  }

  return (
    data?.map((row) => ({
      listingType: row.listing_type as ListingSelection['listingType'],
      listingId: row.listing_id,
    })) ?? []
  );
}

export async function getProfileListings(options: ListingsLookupOptions): Promise<ListingsLookupResult> {
  const {
    userId,
    profileId,
    client,
    selectedOnly = false,
    limitPerType = 3,
    includeListings = true,
  } = options;

  const [counts, selected] = await Promise.all([
    getListingCounts(userId, client),
    profileId ? getSelectedListingEntries(profileId, client) : Promise.resolve([]),
  ]);

  if (!includeListings) {
    return { listings: { market: [], housing: [], jobs: [] }, hasActiveListings: hasAnyListings(counts), selected };
  }

  const selectedByType: Record<keyof typeof LISTING_TYPES, string[]> = {
    market: [],
    housing: [],
    job: [],
  };

  selected.forEach((entry) => {
    selectedByType[entry.listingType].push(entry.listingId);
  });

  const [market, housing, job] = await Promise.all([
    fetchListingsForType('market', selectedOnly ? selectedByType.market : null, {
      client,
      userId,
      limitPerType,
    }),
    fetchListingsForType('housing', selectedOnly ? selectedByType.housing : null, {
      client,
      userId,
      limitPerType,
    }),
    fetchListingsForType('job', selectedOnly ? selectedByType.job : null, {
      client,
      userId,
      limitPerType,
    }),
  ]);

  return {
    listings: { market, housing, jobs: job },
    hasActiveListings: hasAnyListings(counts),
    selected,
  };
}

function hasAnyListings(counts: ListingCounts): boolean {
  return counts.market + counts.housing + counts.job > 0;
}

async function fetchListingsForType(
  type: keyof typeof LISTING_TYPES,
  selectedIds: string[] | null,
  options: { userId: string; client: SupabaseClient; limitPerType?: number },
): Promise<ListingPreview[]> {
  if (selectedIds && selectedIds.length === 0) {
    return [];
  }

  const { client, userId, limitPerType = 3 } = options;
  const source = LISTING_TYPES[type];

  let query = client
    .from(source.table)
    .select(getSelectFields(type))
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (selectedIds && selectedIds.length) {
    query = query.in('id', selectedIds);
  }

  if (limitPerType) {
    query = query.limit(limitPerType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[dating][listings] failed to load listings for user', { userId, type, error });
    throw new Error('LISTINGS_LOOKUP_FAILED');
  }

  return mapRowsToListingPreviews(type, (data as ListingRow[]) ?? []);
}

function getSelectFields(type: keyof typeof LISTING_TYPES): string {
  if (type === 'market') {
    return 'id, title, city, price, currency, created_at';
  }

  if (type === 'housing') {
    return 'id, title, city, price_per_month, currency, created_at';
  }

  return 'id, title, city, salary_from, salary_to, currency, created_at';
}
