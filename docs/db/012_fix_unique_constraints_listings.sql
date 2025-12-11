-- Удаляет потенциальные уникальные ограничения по user_id на таблицах объявлений Маркета/Жилья/Работы.
-- По ТЗ один пользователь может создавать несколько объявлений в каждой таблице, поэтому любые уникальные индексы на user_id
-- должны быть убраны. Скрипт безопасно снимает все уникальные индексы/ограничения, где фигурирует user_id.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = ANY (current_schemas(false))
      AND tablename IN ('market_listings', 'housing_listings', 'job_listings')
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%user_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', rec.indexname);
  END LOOP;
END $$;
