import { SupabaseClient } from '@supabase/supabase-js';

import { ListingPreview, ListingPreviewGroups } from '../../../dating/types';

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

export async function getActiveListingsForUser(
  userId: string,
  client: SupabaseClient,
): Promise<ListingPreviewGroups> {
  const [market, housing, jobs] = await Promise.all([
    client
      .from('market_listings')
      .select('id, title, city, price, currency, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3),
    client
      .from('housing_listings')
      .select('id, title, city, price_per_month, currency, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3),
    client
      .from('job_listings')
      .select('id, title, city, salary_from, salary_to, currency, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const error = market.error || housing.error || jobs.error;
  if (error) {
    console.error('[dating][listings] failed to load listings for user', { userId, error });
    throw new Error('LISTINGS_LOOKUP_FAILED');
  }

  const marketListings = (market.data as MarketRow[] | null)?.map<ListingPreview>((item) => ({
    id: item.id,
    section: 'market',
    title: item.title,
    city: item.city,
    priceLabel: formatPrice(item.price, item.currency),
  })) ?? [];

  const housingListings = (housing.data as HousingRow[] | null)?.map<ListingPreview>((item) => ({
    id: item.id,
    section: 'housing',
    title: item.title,
    city: item.city,
    priceLabel: formatPrice(item.price_per_month, item.currency),
  })) ?? [];

  const jobListings = (jobs.data as JobRow[] | null)?.map<ListingPreview>((item) => ({
    id: item.id,
    section: 'jobs',
    title: item.title,
    city: item.city,
    priceLabel: formatSalary(item.salary_from, item.salary_to, item.currency),
  })) ?? [];

  return {
    market: marketListings,
    housing: housingListings,
    jobs: jobListings,
  };
}
