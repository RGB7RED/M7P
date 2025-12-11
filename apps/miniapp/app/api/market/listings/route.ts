import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUS = ['draft', 'active', 'archived'] as const;

type AllowedStatus = (typeof ALLOWED_STATUS)[number];

type MarketListing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  price: number | null;
  currency: string | null;
  city: string | null;
  is_online: boolean;
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
  const categoryRaw = url.searchParams.get('category');
  const category = categoryRaw ? categoryRaw.trim() : null;
  const typeRaw = url.searchParams.get('type');
  const listingType = typeRaw ? typeRaw.trim() : null;
  const mine = url.searchParams.get('mine') === 'true';

  return { status, city, category, listingType, mine };
}

function validatePayload(body: Record<string, unknown>) {
  const title = String(body.title ?? '').trim();
  const category = String(body.category ?? '').trim();
  const type = String(body.type ?? '').trim();
  const description = body.description !== undefined ? String(body.description ?? '').trim() : '';
  const city = body.city !== undefined ? String(body.city ?? '').trim() : '';
  const currency = String(body.currency ?? 'RUB').trim() || 'RUB';
  const is_online = Boolean(body.is_online);
  const show_on_map = Boolean(body.show_on_map);
  const status = normalizeStatus((body.status as string | null) ?? 'active');

  const priceNumber = body.price !== undefined && body.price !== null ? Number(body.price) : NaN;
  const price = Number.isFinite(priceNumber) ? priceNumber : null;

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

  if (!title || !category || !type) {
    return { ok: false as const, error: 'VALIDATION_ERROR', details: 'title, category и type обязательны' };
  }

  return {
    ok: true as const,
    data: {
      title,
      category,
      type,
      description: description || null,
      city: city || null,
      currency,
      price,
      is_online,
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
    const { status, city, category, listingType, mine } = buildFilters(url);
    const { limit, offset } = parsePagination(url);

    const end = offset + limit - 1;

    let query = supabase
      .from('market_listings')
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

    if (category) {
      query = query.eq('category', category);
    }

    if (listingType) {
      query = query.eq('type', listingType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[market/listings][GET] error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const items: MarketListing[] = data ?? [];
    const hasMore = items.length === limit;

    return NextResponse.json({ ok: true, data: items, pagination: { limit, offset, hasMore } });
  } catch (error) {
    console.error('[market/listings][GET] unexpected error', error);
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
        .from('market_listings')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('[market/listings][POST] fetch error', fetchError);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }

      if (!existing || existing.user_id !== currentUser.userId) {
        return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('market_listings')
        .update({ ...validation.data })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[market/listings][POST] update error', error);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, data });
    }

    const payload = { ...validation.data, user_id: currentUser.userId };
    const { data, error } = await supabase.from('market_listings').insert(payload).select('*').single();

    if (error) {
      console.error('[market/listings][POST] insert error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[market/listings][POST] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
