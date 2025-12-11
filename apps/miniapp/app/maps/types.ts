export type MapListingType = 'market' | 'housing' | 'job';

export type MapListingDTO = {
  id: string;
  type: MapListingType;
  title: string;
  city: string | null;
  mapLat: number;
  mapLng: number;
  href: string;
};
