-- Инициализация базовых таблиц для авторизации через Telegram @username
-- Суместимо с Supabase/Postgres. Выполняется через SQL editor Supabase.

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_username text not null,
  m7_nickname text not null,
  city text,
  birth_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_telegram_username_idx on public.users (telegram_username);

create trigger users_set_updated_at
  before update on public.users
  for each row execute procedure set_updated_at();

create table if not exists public.auth_codes (
  id uuid primary key default gen_random_uuid(),
  telegram_username text not null references public.users(telegram_username) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  is_used boolean not null default false
);

create index if not exists auth_codes_lookup_idx on public.auth_codes (telegram_username, code);
create index if not exists auth_codes_expiry_idx on public.auth_codes (expires_at);
