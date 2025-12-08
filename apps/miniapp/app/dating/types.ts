export type ListingSection = 'market' | 'housing' | 'jobs';
export type ListingType = 'market' | 'housing' | 'job';

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

export type ListingAttachment = {
  listingType: ListingType;
  listingId: string;
};

export function sectionToListingType(section: ListingSection): ListingType {
  return section === 'jobs' ? 'job' : section;
}
