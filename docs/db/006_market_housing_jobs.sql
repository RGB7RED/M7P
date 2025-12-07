-- Минимальная схема для разделов Маркет, Жильё, Работа
-- Добавляет таблицы market_listings, housing_listings, job_listings

create extension if not exists "pgcrypto";

-- Объявления товаров и услуг
create table if not exists market_listings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,

  title           text not null,
  description     text,
  category        text not null,
  type            text not null,
  price           numeric(12,2),
  currency        text not null default 'RUB',
  city            text,
  is_online       boolean not null default false,

  status          text not null default 'active',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_market_listings_status_created
  on market_listings (status, created_at desc);

create index if not exists idx_market_listings_user
  on market_listings (user_id);

create trigger market_listings_set_updated_at
  before update on market_listings
  for each row execute procedure set_updated_at();

-- Объявления по жилью
create table if not exists housing_listings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,

  title               text not null,
  description         text,

  offer_type          text not null,
  property_type       text not null,

  city                text not null,
  district            text,

  price_per_month     numeric(12,2) not null,
  currency            text not null default 'RUB',

  available_from      date,
  min_term_months     integer,
  is_roommate_allowed boolean not null default true,

  status              text not null default 'active',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_housing_listings_status_city_price
  on housing_listings (status, city, price_per_month);

create index if not exists idx_housing_listings_user
  on housing_listings (user_id);

create trigger housing_listings_set_updated_at
  before update on housing_listings
  for each row execute procedure set_updated_at();

-- Вакансии и резюме
create table if not exists job_listings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,

  role_type         text not null,
  title             text not null,
  description       text,

  city              text,
  employment_format text,

  salary_from       numeric(12,2),
  salary_to         numeric(12,2),
  currency          text not null default 'RUB',

  experience_level  text,

  status            text not null default 'active',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_job_listings_status_city
  on job_listings (status, city);

create index if not exists idx_job_listings_user
  on job_listings (user_id);

create trigger job_listings_set_updated_at
  before update on job_listings
  for each row execute procedure set_updated_at();
