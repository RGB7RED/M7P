-- Базовая модель профиля пользователя (пол, дата рождения, город, описание, 18+)
-- Предполагает наличие таблицы users из 001_init_users_and_auth_codes.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_gender') THEN
    CREATE TYPE user_gender AS ENUM ('male', 'female', 'other', 'na');
  END IF;
END$$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender user_gender NOT NULL DEFAULT 'na',
  ADD COLUMN IF NOT EXISTS birth_date date NULL,
  ADD COLUMN IF NOT EXISTS city text NULL,
  ADD COLUMN IF NOT EXISTS about text NULL,
  ADD COLUMN IF NOT EXISTS is_adult_profile boolean NOT NULL DEFAULT false;
