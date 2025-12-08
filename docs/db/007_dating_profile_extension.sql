-- Расширение анкеты знакомств: новые поля видимости, срок актуальности и переименование offering -> offer
-- Скрипт предполагает существование таблицы dating_profiles из 004_dating_schema.sql

-- Переименовываем поле «что предлагаю» для единообразия
ALTER TABLE dating_profiles
  RENAME COLUMN offering TO offer;

-- Настройки видимости и актуальности анкеты
ALTER TABLE dating_profiles
  ADD COLUMN IF NOT EXISTS show_listings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_activated_at timestamptz;

-- При создании новых анкет считаем их свежими
ALTER TABLE dating_profiles
  ALTER COLUMN last_activated_at SET DEFAULT now();

-- Для уже существующих записей заполняем отметку актуальности
UPDATE dating_profiles
SET last_activated_at = COALESCE(last_activated_at, updated_at, created_at, now());

-- Индекс для выборок только по активным и недавним анкетам
CREATE INDEX IF NOT EXISTS idx_dating_profiles_active_recent
  ON dating_profiles (last_activated_at DESC)
  WHERE is_active = true;
