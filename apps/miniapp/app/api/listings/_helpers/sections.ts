export type ListingSection = 'market' | 'housing' | 'jobs';

export function isListingSection(value: unknown): value is ListingSection {
  return value === 'market' || value === 'housing' || value === 'jobs';
}

export const LISTING_SECTION_TABLES: Record<ListingSection, string> = {
  market: 'market_listings',
  housing: 'housing_listings',
  jobs: 'job_listings',
};
