import { NextResponse } from 'next/server';

import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { MapListingDTO, MapListingType } from '../../../maps/types';

export const dynamic = 'force-dynamic';

async function fetchListings(
  table: 'market_listings' | 'housing_listings' | 'job_listings',
  type: MapListingType,
  hrefPrefix: string,
): Promise<MapListingDTO[]> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from(table)
    .select('id, title, city, map_lat, map_lng')
    .eq('status', 'active')
    .eq('show_on_map', true)
    .not('map_lat', 'is', null)
    .not('map_lng', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error(`[maps:listings] ${table} error`, error);
    return [];
  }

  return (data ?? []).flatMap((item) => {
    const lat = typeof item.map_lat === 'number' ? item.map_lat : Number(item.map_lat);
    const lng = typeof item.map_lng === 'number' ? item.map_lng : Number(item.map_lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return [];
    }

    return [
      {
        id: item.id as string,
        type,
        title: (item.title as string) ?? 'Объявление',
        city: (item.city as string | null) ?? null,
        mapLat: lat,
        mapLng: lng,
        href: `${hrefPrefix}${encodeURIComponent(String(item.id))}`,
      },
    ];
  });
}

export async function GET() {
  try {
    const [market, housing, jobs] = await Promise.all([
      fetchListings('market_listings', 'market', '/market?openId='),
      fetchListings('housing_listings', 'housing', '/housing?openId='),
      fetchListings('job_listings', 'job', '/jobs?openId='),
    ]);

    return NextResponse.json([...market, ...housing, ...jobs]);
  } catch (error) {
    console.error('[maps:listings] unexpected error', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
