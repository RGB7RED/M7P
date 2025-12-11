-- Добавляет координаты и флаг отображения на карте для объявлений Маркета, Жилья и Работы

alter table if exists market_listings
  add column if not exists show_on_map boolean not null default false,
  add column if not exists map_lat double precision,
  add column if not exists map_lng double precision;

create index if not exists idx_market_listings_map_filter
  on market_listings (show_on_map, status);

alter table if exists housing_listings
  add column if not exists show_on_map boolean not null default false,
  add column if not exists map_lat double precision,
  add column if not exists map_lng double precision;

create index if not exists idx_housing_listings_map_filter
  on housing_listings (show_on_map, status);

alter table if exists job_listings
  add column if not exists show_on_map boolean not null default false,
  add column if not exists map_lat double precision,
  add column if not exists map_lng double precision;

create index if not exists idx_job_listings_map_filter
  on job_listings (show_on_map, status);
