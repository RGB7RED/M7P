-- Привязка объявлений к анкете знакомств
-- Скрипт предполагает наличие таблиц dating_profiles, market_listings, housing_listings, job_listings

CREATE TABLE IF NOT EXISTS dating_profile_listings (
  profile_id uuid REFERENCES dating_profiles(id) ON DELETE CASCADE,
  listing_type text NOT NULL CHECK (listing_type IN ('market', 'housing', 'job')),
  listing_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, listing_type, listing_id)
);

-- Индекс для быстрого поиска по объявлению вне зависимости от профиля
CREATE INDEX IF NOT EXISTS idx_dating_profile_listings_by_listing
  ON dating_profile_listings (listing_type, listing_id);
