-- Добавляет telegram_chat_id для привязки чата Telegram к пользователю
-- Скрипт идемпотентный: безопасно выполнять несколько раз

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;

COMMENT ON COLUMN public.users.telegram_chat_id IS 'chat_id приватного чата с пользователем в Telegram';

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id
  ON public.users (telegram_chat_id);
