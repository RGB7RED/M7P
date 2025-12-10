-- 009_listing_contact_purchases.sql
-- Покупки контактов по объявлениям (market / housing / jobs)

create table if not exists listing_contact_purchases (
    id uuid primary key default gen_random_uuid(),

    buyer_user_id uuid not null references users(id) on delete cascade,

    -- Раздел, где размещено объявление
    section text not null check (section in ('market', 'housing', 'jobs')),

    -- ID объявления в соответствующей таблице (market_listings / housing_listings / job_listings)
    listing_id uuid not null,

    -- Стоимость покупки в копейках (50 ₽ = 5000)
    price_cents integer not null default 5000,
    currency text not null default 'RUB',

    created_at timestamptz not null default now(),

    -- Один пользователь не может купить один и тот же контакт по одному и тому же объявлению дважды
    unique (buyer_user_id, section, listing_id)
);

create index if not exists listing_contact_purchases_buyer_created_at_idx
    on listing_contact_purchases (buyer_user_id, created_at desc);

create index if not exists listing_contact_purchases_listing_idx
    on listing_contact_purchases (section, listing_id);
