import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUS = ['draft', 'active', 'archived'] as const;

type AllowedStatus = (typeof ALLOWED_STATUS)[number];

type HousingListing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  offer_type: string;
  property_type: string;
  city: string;
  district: string | null;
  price_per_month: number;
  currency: string | null;
  available_from: string | null;
  min_term_months: number | null;
  is_roommate_allowed: boolean;
  show_on_map: boolean;
  map_lat: number | null;
  map_lng: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function parsePagination(url: URL) {
  const limitRaw = Number(url.searchParams.get('limit'));
  const offsetRaw = Number(url.searchParams.get('offset'));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  return { limit, offset };
}

function normalizeStatus(status: string | null): AllowedStatus {
  if (!status || !ALLOWED_STATUS.includes(status as AllowedStatus)) {
    return 'active';
  }
  return status as AllowedStatus;
}

function buildFilters(url: URL) {
  const status = normalizeStatus(url.searchParams.get('status'));
  const cityRaw = url.searchParams.get('city');
  const city = cityRaw ? cityRaw.trim() : null;
  const maxPriceParam = url.searchParams.get('maxPrice');
  let maxPrice: number | null = null;

  if (maxPriceParam !== null) {
    const parsedMaxPrice = Number(maxPriceParam);
    if (Number.isFinite(parsedMaxPrice) && parsedMaxPrice >= 0) {
      maxPrice = parsedMaxPrice;
    }
  }
  const offerTypeRaw = url.searchParams.get('offer_type');
  const offer_type = offerTypeRaw ? offerTypeRaw.trim() : null;
  const propertyTypeRaw = url.searchParams.get('property_type');
  const property_type = propertyTypeRaw ? propertyTypeRaw.trim() : null;
  const mine = url.searchParams.get('mine') === 'true';

  return { status, city, maxPrice, offer_type, property_type, mine };
}

function validatePayload(body: Record<string, unknown>) {
  const title = String(body.title ?? '').trim();
  const offer_type = String(body.offer_type ?? '').trim();
  const property_type = String(body.property_type ?? '').trim();
  const city = String(body.city ?? '').trim();
  const description = body.description !== undefined ? String(body.description ?? '').trim() : '';
  const district = body.district !== undefined ? String(body.district ?? '').trim() : '';
  const currency = String(body.currency ?? 'RUB').trim() || 'RUB';
  const status = normalizeStatus((body.status as string | null) ?? 'active');
  const available_from = body.available_from ? String(body.available_from) : null;
  const is_roommate_allowed = body.is_roommate_allowed !== undefined ? Boolean(body.is_roommate_allowed) : true;
  const show_on_map = Boolean(body.show_on_map);

  const priceRaw = body.price_per_month !== undefined && body.price_per_month !== null ? Number(body.price_per_month) : NaN;
  const price_per_month = Number.isFinite(priceRaw) ? priceRaw : null;

  const minTermRaw = body.min_term_months !== undefined && body.min_term_months !== null ? Number(body.min_term_months) : NaN;
  const min_term_months = Number.isFinite(minTermRaw) ? Math.max(0, Math.floor(minTermRaw)) : null;

  let map_lat: number | null = null;
  let map_lng: number | null = null;

  if (show_on_map) {
    const mapLatNumber = Number(body.map_lat);
    const mapLngNumber = Number(body.map_lng);

    if (!Number.isFinite(mapLatNumber) || mapLatNumber < -90 || mapLatNumber > 90) {
      return {
        ok: false as const,
        error: 'VALIDATION_ERROR',
        details: 'Укажите корректную широту в диапазоне -90..90.',
      };
    }

    if (!Number.isFinite(mapLngNumber) || mapLngNumber < -180 || mapLngNumber > 180) {
      return {
        ok: false as const,
        error: 'VALIDATION_ERROR',
        details: 'Укажите корректную долготу в диапазоне -180..180.',
      };
    }

    map_lat = mapLatNumber;
    map_lng = mapLngNumber;
  }

  if (!title || !offer_type || !property_type || !city || price_per_month === null) {
    return {
      ok: false as const,
      error: 'VALIDATION_ERROR',
      details: 'title, offer_type, property_type, city и price_per_month обязательны',
    };
  }

  return {
    ok: true as const,
    data: {
      title,
      offer_type,
      property_type,
      city,
      description: description || null,
      district: district || null,
      price_per_month,
      currency,
      available_from,
      min_term_months,
      is_roommate_allowed,
      show_on_map,
      map_lat,
      map_lng,
      status,
    },
  };
}

export async function GET(req: Request) {
  try {
    const supabase = getServiceSupabaseClient();
    const url = new URL(req.url);
    const { status, city, maxPrice, offer_type, property_type, mine } = buildFilters(url);
    const { limit, offset } = parsePagination(url);

    const end = offset + limit - 1;

    let query = supabase
      .from('housing_listings')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, end);

    if (mine) {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
      }
      query = query.eq('user_id', currentUser.userId);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (offer_type) {
      query = query.eq('offer_type', offer_type);
    }

    if (property_type) {
      query = query.eq('property_type', property_type);
    }

    if (maxPrice !== null) {
      query = query.lte('price_per_month', maxPrice);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[housing/listings][GET] error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const items: HousingListing[] = data ?? [];
    const hasMore = items.length === limit;

    return NextResponse.json({ ok: true, data: items, pagination: { limit, offset, hasMore } });
  } catch (error) {
    console.error('[housing/listings][GET] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const validation = validatePayload(body);

    if (!validation.ok) {
      return NextResponse.json(validation, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();
    const id = body.id ? String(body.id) : null;

    if (id) {
      const { data: existing, error: fetchError } = await supabase
        .from('housing_listings')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('[housing/listings][POST] fetch error', fetchError);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }

      if (!existing || existing.user_id !== currentUser.userId) {
        return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('housing_listings')
        .update({ ...validation.data })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[housing/listings][POST] update error', error);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, data });
    }

    const payload = { ...validation.data, user_id: currentUser.userId };
    const { data, error } = await supabase.from('housing_listings').insert(payload).select('*').single();

    if (error) {
      console.error('[housing/listings][POST] insert error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[housing/listings][POST] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
