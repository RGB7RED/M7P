-- MVP схема для раздела "Знакомства"
-- Добавляет enum dating_purpose, таблицы dating_profiles, dating_swipes, dating_matches

create extension if not exists "pgcrypto";

-- Enum целей знакомств/сценариев взаимодействия
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dating_purpose') THEN
    CREATE TYPE dating_purpose AS ENUM (
      'romantic',
      'co_rent',
      'rent_tenant',
      'rent_landlord',
      'market_seller',
      'market_buyer',
      'job_employer',
      'job_seeker',
      'job_buddy'
    );
  END IF;
END$$;

-- Анкеты знакомств
CREATE TABLE IF NOT EXISTS dating_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  nickname          text NOT NULL,
  looking_for       text NOT NULL,
  offering          text NOT NULL,
  comment           text,

  purposes          dating_purpose[] NOT NULL DEFAULT '{}',

  photo_urls        text[] NOT NULL DEFAULT '{}',
  has_photo         boolean GENERATED ALWAYS AS (array_length(photo_urls, 1) IS NOT NULL) STORED,

  link_market       boolean NOT NULL DEFAULT false,
  link_housing      boolean NOT NULL DEFAULT false,
  link_jobs         boolean NOT NULL DEFAULT false,

  is_verified       boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'active',

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dating_profiles_status_created
  ON dating_profiles (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dating_profiles_purposes
  ON dating_profiles USING GIN (purposes);

-- Обновление updated_at при изменениях
CREATE TRIGGER dating_profiles_set_updated_at
  BEFORE UPDATE ON dating_profiles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Свайпы (лайк/дизлайк)
CREATE TABLE IF NOT EXISTS dating_swipes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_profile_id  uuid NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,

  decision       text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_dating_swipes_from_to
  ON dating_swipes (from_user_id, to_profile_id);

-- Матчи по взаимным лайкам
CREATE TABLE IF NOT EXISTS dating_matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz,
  CONSTRAINT chk_dating_matches_users_ordered CHECK (user1_id <> user2_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_dating_matches_pair
  ON dating_matches (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));
