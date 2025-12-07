-- Обновление enum dating_purpose до финального набора целей знакомств
-- Добавляем недостающие значения без затрагивания существующих записей

DO $$
BEGIN
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'romantic';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'friends';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'co_rent';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'rent_tenant';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'rent_landlord';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'market_seller';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'market_buyer';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'job_employer';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'job_seeker';
  ALTER TYPE dating_purpose ADD VALUE IF NOT EXISTS 'job_buddy';
END$$;

-- Уточняем тип и ограничения массива целей в анкете
ALTER TABLE dating_profiles
  ALTER COLUMN purposes SET DATA TYPE dating_purpose[] USING purposes::dating_purpose[],
  ALTER COLUMN purposes SET NOT NULL,
  ALTER COLUMN purposes SET DEFAULT '{}'::dating_purpose[];
