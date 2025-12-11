-- Предпочтения знакомств и флаги показа объявлений в анкете
-- Предполагает наличие таблицы dating_profiles из 004_dating_schema.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dating_city_mode') THEN
    CREATE TYPE dating_city_mode AS ENUM ('same_city', 'same_region', 'country', 'any');
  END IF;
END$$;

ALTER TABLE dating_profiles
  ADD COLUMN IF NOT EXISTS preferred_genders user_gender[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_age_min integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS preferred_age_max integer NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS preferred_city_mode dating_city_mode NOT NULL DEFAULT 'same_city',
  ADD COLUMN IF NOT EXISTS show_market_listings_in_profile boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_housing_listings_in_profile boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_job_listings_in_profile boolean NOT NULL DEFAULT true;
