import { getServiceSupabaseClient } from '../../lib/supabaseConfig';

export type MapPoint = {
  id: string;
  type: 'dating' | 'market' | 'housing' | 'job';
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
};

type CityCoords = {
  lat: number;
  lng: number;
};

const CITY_COORDS: Record<string, CityCoords> = {
  'санкт-петербург': { lat: 59.9311, lng: 30.3609 },
  'санкт петербург': { lat: 59.9311, lng: 30.3609 },
  спб: { lat: 59.9311, lng: 30.3609 },
  колпино: { lat: 59.7467, lng: 30.5891 },
  москва: { lat: 55.7558, lng: 37.6173 },
};

function resolveCityCoords(city?: string | null): CityCoords | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  return CITY_COORDS[key] ?? null;
}

function extractCoords({
  lat,
  lng,
  city,
}: {
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
}): CityCoords | null {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return { lat, lng };
  }
  return resolveCityCoords(city ?? null);
}

async function loadDatingPoints(): Promise<MapPoint[]> {
  const supabase = getServiceSupabaseClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('dating_profiles')
      .select('*')
      .eq('status', 'active')
      .eq('is_active', true)
      .gte('last_activated_at', ninetyDaysAgo)
      .order('last_activated_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[maps] dating lookup error', error);
      return [];
    }

    return (data ?? []).flatMap((profile) => {
      const coords = extractCoords({
        lat: (profile as any).lat,
        lng: (profile as any).lng,
        city: (profile as any).city,
      });

      if (!coords) return [];

      return [
        {
          id: profile.id,
          type: 'dating' as const,
          title: (profile as any).nickname ?? 'Анкета',
          subtitle: (profile as any).city ?? undefined,
          lat: coords.lat,
          lng: coords.lng,
        } satisfies MapPoint,
      ];
    });
  } catch (error) {
    console.error('[maps] unexpected dating lookup error', error);
    return [];
  }
}

async function loadMarketPoints(): Promise<MapPoint[]> {
  const supabase = getServiceSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('market_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[maps] market lookup error', error);
      return [];
    }

    return (data ?? []).flatMap((listing) => {
      const coords = extractCoords(listing as any);
      if (!coords) return [];

      return [
        {
          id: listing.id,
          type: 'market' as const,
          title: listing.title,
          subtitle: listing.city ?? undefined,
          lat: coords.lat,
          lng: coords.lng,
        } satisfies MapPoint,
      ];
    });
  } catch (error) {
    console.error('[maps] unexpected market lookup error', error);
    return [];
  }
}

async function loadHousingPoints(): Promise<MapPoint[]> {
  const supabase = getServiceSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('housing_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[maps] housing lookup error', error);
      return [];
    }

    return (data ?? []).flatMap((listing) => {
      const coords = extractCoords(listing as any);
      if (!coords) return [];

      const subtitle = listing.city ?? listing.district ?? undefined;

      return [
        {
          id: listing.id,
          type: 'housing' as const,
          title: listing.title,
          subtitle,
          lat: coords.lat,
          lng: coords.lng,
        } satisfies MapPoint,
      ];
    });
  } catch (error) {
    console.error('[maps] unexpected housing lookup error', error);
    return [];
  }
}

async function loadJobPoints(): Promise<MapPoint[]> {
  const supabase = getServiceSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('job_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[maps] jobs lookup error', error);
      return [];
    }

    return (data ?? []).flatMap((listing) => {
      const coords = extractCoords(listing as any);
      if (!coords) return [];

      return [
        {
          id: listing.id,
          type: 'job' as const,
          title: listing.title,
          subtitle: listing.city ?? undefined,
          lat: coords.lat,
          lng: coords.lng,
        } satisfies MapPoint,
      ];
    });
  } catch (error) {
    console.error('[maps] unexpected jobs lookup error', error);
    return [];
  }
}

export async function loadMapPoints(): Promise<MapPoint[]> {
  const [dating, market, housing, jobs] = await Promise.all([
    loadDatingPoints(),
    loadMarketPoints(),
    loadHousingPoints(),
    loadJobPoints(),
  ]);

  return [...dating, ...market, ...housing, ...jobs];
}
