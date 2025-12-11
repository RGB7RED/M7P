create table if not exists map_points (
  id uuid primary key default gen_random_uuid(),
  listing_type text not null,
  listing_id uuid,
  title text not null,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_map_points_active
  on map_points (is_active);

create index if not exists idx_map_points_type
  on map_points (listing_type);
