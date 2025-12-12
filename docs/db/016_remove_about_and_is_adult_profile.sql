-- Перенос текста «О себе» из users.about в dating_profiles.comment и удаление флага is_adult_profile

-- Попытаться перенести старый текст «О себе» в комментарий анкеты, если там пусто
UPDATE dating_profiles dp
SET comment = u.about
FROM users u
WHERE dp.user_id = u.id
  AND dp.comment IS NULL
  AND u.about IS NOT NULL;

-- Удалить неиспользуемые колонки
ALTER TABLE users
  DROP COLUMN IF EXISTS about,
  DROP COLUMN IF EXISTS is_adult_profile;
