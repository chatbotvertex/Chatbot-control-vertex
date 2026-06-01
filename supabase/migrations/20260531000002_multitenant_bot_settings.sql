-- ============================================================
-- Isolamento multi-tenant para tabelas de configuração de bot
-- Adiciona user_id em bot_settings, bot_schedules,
-- instagram_settings e instagram_schedules.
-- Idempotente: pode ser executada mais de uma vez.
-- ============================================================

-- ── 1. Adicionar user_id (nullable temporariamente) ──
ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bot_schedules
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.instagram_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.instagram_schedules
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 2. Remover linhas sem dono (dados globais antigos) ──
DELETE FROM public.bot_settings      WHERE user_id IS NULL;
DELETE FROM public.bot_schedules     WHERE user_id IS NULL;
DELETE FROM public.instagram_settings  WHERE user_id IS NULL;
DELETE FROM public.instagram_schedules WHERE user_id IS NULL;

-- ── 3. Tornar NOT NULL ──
ALTER TABLE public.bot_settings      ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.bot_schedules     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.instagram_settings  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.instagram_schedules ALTER COLUMN user_id SET NOT NULL;

-- ── 4. Remover indexes/constraints globais antigos ──
DROP INDEX IF EXISTS public.bot_settings_bot_type_key;
DROP INDEX IF EXISTS public.bot_schedules_bot_type_day_key;
DROP INDEX IF EXISTS public.instagram_schedules_day_key;

ALTER TABLE public.instagram_settings
  DROP CONSTRAINT IF EXISTS instagram_settings_singleton_unique;
ALTER TABLE public.instagram_settings
  DROP COLUMN IF EXISTS singleton;

-- ── 5. Novos indexes únicos por usuário ──
CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_user_bot_type_key
  ON public.bot_settings(user_id, bot_type);

CREATE UNIQUE INDEX IF NOT EXISTS bot_schedules_user_bot_type_day_key
  ON public.bot_schedules(user_id, bot_type, day_of_week);

CREATE UNIQUE INDEX IF NOT EXISTS instagram_settings_user_id_key
  ON public.instagram_settings(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS instagram_schedules_user_day_key
  ON public.instagram_schedules(user_id, day_of_week);

-- ── 6. Atualizar políticas RLS ──
DROP POLICY IF EXISTS "Authenticated can read bot_settings"    ON public.bot_settings;
DROP POLICY IF EXISTS "Authenticated can insert bot_settings"  ON public.bot_settings;
DROP POLICY IF EXISTS "Authenticated can update bot_settings"  ON public.bot_settings;
DROP POLICY IF EXISTS "Authenticated can delete bot_settings"  ON public.bot_settings;

DROP POLICY IF EXISTS "Authenticated can read bot_schedules"    ON public.bot_schedules;
DROP POLICY IF EXISTS "Authenticated can insert bot_schedules"  ON public.bot_schedules;
DROP POLICY IF EXISTS "Authenticated can update bot_schedules"  ON public.bot_schedules;
DROP POLICY IF EXISTS "Authenticated can delete bot_schedules"  ON public.bot_schedules;

DROP POLICY IF EXISTS "Authenticated can read instagram_settings"    ON public.instagram_settings;
DROP POLICY IF EXISTS "Authenticated can insert instagram_settings"  ON public.instagram_settings;
DROP POLICY IF EXISTS "Authenticated can update instagram_settings"  ON public.instagram_settings;
DROP POLICY IF EXISTS "Authenticated can delete instagram_settings"  ON public.instagram_settings;

DROP POLICY IF EXISTS "Authenticated can read instagram_schedules"    ON public.instagram_schedules;
DROP POLICY IF EXISTS "Authenticated can insert instagram_schedules"  ON public.instagram_schedules;
DROP POLICY IF EXISTS "Authenticated can update instagram_schedules"  ON public.instagram_schedules;
DROP POLICY IF EXISTS "Authenticated can delete instagram_schedules"  ON public.instagram_schedules;

CREATE POLICY "Users manage own bot_settings"
  ON public.bot_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own bot_schedules"
  ON public.bot_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own instagram_settings"
  ON public.instagram_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own instagram_schedules"
  ON public.instagram_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
