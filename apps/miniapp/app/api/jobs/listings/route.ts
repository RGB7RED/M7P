import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUS = ['draft', 'active', 'archived'] as const;

type AllowedStatus = (typeof ALLOWED_STATUS)[number];

type JobListing = {
  id: string;
  user_id: string;
  role_type: string;
  title: string;
  description: string | null;
  city: string | null;
  employment_format: string | null;
  salary_from: number | null;
  salary_to: number | null;
  currency: string | null;
  experience_level: string | null;
  show_on_map: boolean;
  map_lat: number | null;
  map_lng: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function parsePagination(url: URL) {
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');

  const limitRaw = limitParam !== null ? Number(limitParam) : NaN;
  const offsetRaw = offsetParam !== null ? Number(offsetParam) : NaN;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 200;
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
  const roleTypeRaw = url.searchParams.get('role_type');
  const role_type = roleTypeRaw ? roleTypeRaw.trim() : null;
  const employmentRaw = url.searchParams.get('employment_format');
  const employment_format = employmentRaw ? employmentRaw.trim() : null;
  const mine = url.searchParams.get('mine') === 'true';

  return { status, city, role_type, employment_format, mine };
}

function validatePayload(body: Record<string, unknown>) {
  const title = String(body.title ?? '').trim();
  const role_type = String(body.role_type ?? '').trim();
  const description = body.description !== undefined ? String(body.description ?? '').trim() : '';
  const city = body.city !== undefined ? String(body.city ?? '').trim() : '';
  const employment_format = body.employment_format !== undefined ? String(body.employment_format ?? '').trim() : '';
  const experience_level = body.experience_level !== undefined ? String(body.experience_level ?? '').trim() : '';
  const currency = String(body.currency ?? 'RUB').trim() || 'RUB';
  const status = normalizeStatus((body.status as string | null) ?? 'active');
  const show_on_map = Boolean(body.show_on_map);

  const salaryFromRaw = body.salary_from !== undefined && body.salary_from !== null ? Number(body.salary_from) : NaN;
  const salaryToRaw = body.salary_to !== undefined && body.salary_to !== null ? Number(body.salary_to) : NaN;
  const salary_from = Number.isFinite(salaryFromRaw) ? salaryFromRaw : null;
  const salary_to = Number.isFinite(salaryToRaw) ? salaryToRaw : null;

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

  if (!title || !role_type) {
    return { ok: false as const, error: 'VALIDATION_ERROR', details: 'title и role_type обязательны' };
  }

  return {
    ok: true as const,
    data: {
      title,
      role_type,
      description: description || null,
      city: city || null,
      employment_format: employment_format || null,
      salary_from,
      salary_to,
      currency,
      experience_level: experience_level || null,
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
    const { status, city, role_type, employment_format, mine } = buildFilters(url);
    const { limit, offset } = parsePagination(url);

    const end = offset + limit - 1;

    let query = supabase
      .from('job_listings')
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

    if (role_type) {
      query = query.eq('role_type', role_type);
    }

    if (employment_format) {
      query = query.eq('employment_format', employment_format);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[jobs/listings][GET] error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const items: JobListing[] = data ?? [];
    const hasMore = items.length === limit;

    return NextResponse.json({ ok: true, data: items, pagination: { limit, offset, hasMore } });
  } catch (error) {
    console.error('[jobs/listings][GET] unexpected error', error);
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
        .from('job_listings')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('[jobs/listings][POST] fetch error', fetchError);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }

      if (!existing || existing.user_id !== currentUser.userId) {
        return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('job_listings')
        .update({ ...validation.data })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[jobs/listings][POST] update error', error);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, data });
    }

    const payload = { ...validation.data, user_id: currentUser.userId };
    const { data, error } = await supabase.from('job_listings').insert(payload).select('*').single();

    if (error) {
      console.error('[jobs/listings][POST] insert error', error);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[jobs/listings][POST] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
