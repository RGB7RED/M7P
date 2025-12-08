-- Привязка объявлений к анкете знакомств
-- Требует существования таблицы dating_profiles и таблиц объявлений из 006_market_housing_jobs.sql

CREATE TABLE IF NOT EXISTS dating_profile_listings (
  profile_id uuid REFERENCES dating_profiles(id) ON DELETE CASCADE,
  listing_type text NOT NULL CHECK (listing_type IN ('market', 'housing', 'job')),
  listing_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, listing_type, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_dating_profile_listings_by_listing
  ON dating_profile_listings (listing_type, listing_id);
