export type ListingSection = 'market' | 'housing' | 'jobs';

export type ListingPreview = {
  id: string;
  section: ListingSection;
  title: string;
  city?: string | null;
  priceLabel?: string | null;
};

export type ListingPreviewGroups = {
  market: ListingPreview[];
  housing: ListingPreview[];
  jobs: ListingPreview[];
};

export type ListingSelection = {
  listingType: 'market' | 'housing' | 'job';
  listingId: string;
};
