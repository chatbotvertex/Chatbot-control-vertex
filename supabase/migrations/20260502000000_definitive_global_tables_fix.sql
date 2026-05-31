-- ============================================================
-- MIGRAÇÃO DEFINITIVA — execute no SQL Editor do Supabase
-- Idempotente: pode ser rodada múltiplas vezes sem dano
-- ============================================================

-- ── 1. Dropar TODAS as políticas existentes (antigas e novas) ──
-- (DROP IF EXISTS é seguro mesmo que já tenham sido removidas)

DROP POLICY IF EXISTS "Users can view own bot settings"    ON public.bot_settings;
DROP POLICY IF EXISTS "Users can insert own bot settings"  ON public.bot_settings;
DROP POLICY IF EXISTS "Users can update own bot settings"  ON public.bot_settings;
DROP POLICY IF EXISTS "Users can delete own bot settings"  ON public.bot_settings;
DROP POLICY IF EXISTS "Authenticated can read bot_settings"    ON public.bot_settings;
DROP POLICY IF EXISTS "Authenticated can insert bot_settings"  ON public.bot_settings;
DROP POLICY IF EXISTS "Authenticated can update bot_settings"  ON public.bot_settings;
DROP POLICY IF EXISTS "Authenticated can delete bot_settings"  ON public.bot_settings;

DROP POLICY IF EXISTS "Users can view own bot schedules"    ON public.bot_schedules;
DROP POLICY IF EXISTS "Users can insert own bot schedules"  ON public.bot_schedules;
DROP POLICY IF EXISTS "Users can update own bot schedules"  ON public.bot_schedules;
DROP POLICY IF EXISTS "Users can delete own bot schedules"  ON public.bot_schedules;
DROP POLICY IF EXISTS "Authenticated can read bot_schedules"    ON public.bot_schedules;
DROP POLICY IF EXISTS "Authenticated can insert bot_schedules"  ON public.bot_schedules;
DROP POLICY IF EXISTS "Authenticated can update bot_schedules"  ON public.bot_schedules;
DROP POLICY IF EXISTS "Authenticated can delete bot_schedules"  ON public.bot_schedules;

DROP POLICY IF EXISTS "Users can view own instagram settings"    ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can insert own instagram settings"  ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can update own instagram settings"  ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can delete own instagram settings"  ON public.instagram_settings;
DROP POLICY IF EXISTS "Authenticated can read instagram_settings"    ON public.instagram_settings;
DROP POLICY IF EXISTS "Authenticated can insert instagram_settings"  ON public.instagram_settings;
DROP POLICY IF EXISTS "Authenticated can update instagram_settings"  ON public.instagram_settings;
DROP POLICY IF EXISTS "Authenticated can delete instagram_settings"  ON public.instagram_settings;

DROP POLICY IF EXISTS "Users can view own instagram schedules"    ON public.instagram_schedules;
DROP POLICY IF EXISTS "Users can insert own instagram schedules"  ON public.instagram_schedules;
DROP POLICY IF EXISTS "Users can update own instagram schedules"  ON public.instagram_schedules;
DROP POLICY IF EXISTS "Users can delete own instagram schedules"  ON public.instagram_schedules;
DROP POLICY IF EXISTS "Authenticated can read instagram_schedules"    ON public.instagram_schedules;
DROP POLICY IF EXISTS "Authenticated can insert instagram_schedules"  ON public.instagram_schedules;
DROP POLICY IF EXISTS "Authenticated can update instagram_schedules"  ON public.instagram_schedules;
DROP POLICY IF EXISTS "Authenticated can delete instagram_schedules"  ON public.instagram_schedules;

-- ── 2. Remover colunas user_id (políticas acima já foram dropadas) ──
ALTER TABLE public.bot_settings      DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.bot_schedules     DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.instagram_settings  DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.instagram_schedules DROP COLUMN IF EXISTS user_id;

-- ── 3. Remover constraints antigas baseadas em user_id ──
ALTER TABLE public.bot_settings      DROP CONSTRAINT IF EXISTS bot_settings_user_id_key;
ALTER TABLE public.bot_settings      DROP CONSTRAINT IF EXISTS bot_settings_user_bot_unique;
ALTER TABLE public.bot_schedules     DROP CONSTRAINT IF EXISTS bot_schedules_user_id_bot_type_day_of_week_key;
ALTER TABLE public.instagram_settings  DROP CONSTRAINT IF EXISTS instagram_settings_user_id_key;
ALTER TABLE public.instagram_schedules DROP CONSTRAINT IF EXISTS instagram_schedules_user_id_day_of_week_key;

-- ── 4. Garantir coluna bot_type em bot_settings ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bot_settings' AND column_name = 'bot_type'
  ) THEN
    ALTER TABLE public.bot_settings ADD COLUMN bot_type TEXT NOT NULL DEFAULT 'whatsapp';
  END IF;
END $$;

-- ── 5. Renomear away_message → offline_message se necessário ──
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bot_settings' AND column_name = 'away_message'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bot_settings' AND column_name = 'offline_message'
  ) THEN
    ALTER TABLE public.bot_settings RENAME COLUMN away_message TO offline_message;
  END IF;
END $$;

-- ── 6. Garantir coluna offline_message existe ──
ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS offline_message TEXT NOT NULL DEFAULT 'Estou ausente no momento. Retornarei em breve.';
ALTER TABLE public.instagram_settings
  ADD COLUMN IF NOT EXISTS offline_message TEXT NOT NULL DEFAULT 'Estou ausente no momento. Retornarei em breve.';

-- ── 7. Deduplicar linhas (manter a mais antiga por grupo) ──
DELETE FROM public.bot_settings
WHERE id NOT IN (
  SELECT DISTINCT ON (bot_type) id
  FROM public.bot_settings
  ORDER BY bot_type, created_at ASC
);

DELETE FROM public.bot_schedules
WHERE id NOT IN (
  SELECT DISTINCT ON (bot_type, day_of_week) id
  FROM public.bot_schedules
  ORDER BY bot_type, day_of_week, created_at ASC
);

DELETE FROM public.instagram_settings
WHERE id NOT IN (
  SELECT id FROM public.instagram_settings ORDER BY created_at ASC LIMIT 1
);

DELETE FROM public.instagram_schedules
WHERE id NOT IN (
  SELECT DISTINCT ON (day_of_week) id
  FROM public.instagram_schedules
  ORDER BY day_of_week, created_at ASC
);

-- ── 8. Adicionar coluna singleton em instagram_settings ──
-- Esta coluna permite upsert confiável sem index de expressão
ALTER TABLE public.instagram_settings
  ADD COLUMN IF NOT EXISTS singleton BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.instagram_settings SET singleton = TRUE WHERE singleton IS DISTINCT FROM TRUE;

ALTER TABLE public.instagram_settings
  DROP CONSTRAINT IF EXISTS instagram_settings_singleton_unique;
ALTER TABLE public.instagram_settings
  ADD CONSTRAINT instagram_settings_singleton_unique UNIQUE (singleton);

-- Remover index de expressão antigo (substituído pela constraint acima)
DROP INDEX IF EXISTS public.instagram_settings_singleton_key;

-- ── 9. Garantir indexes únicos globais ──
CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_bot_type_key
  ON public.bot_settings(bot_type);
CREATE UNIQUE INDEX IF NOT EXISTS bot_schedules_bot_type_day_key
  ON public.bot_schedules(bot_type, day_of_week);
CREATE UNIQUE INDEX IF NOT EXISTS instagram_schedules_day_key
  ON public.instagram_schedules(day_of_week);

-- ── 10. Criar novas políticas (acesso total para authenticated) ──
CREATE POLICY "Authenticated can read bot_settings"
  ON public.bot_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert bot_settings"
  ON public.bot_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update bot_settings"
  ON public.bot_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete bot_settings"
  ON public.bot_settings FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read bot_schedules"
  ON public.bot_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert bot_schedules"
  ON public.bot_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update bot_schedules"
  ON public.bot_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete bot_schedules"
  ON public.bot_schedules FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read instagram_settings"
  ON public.instagram_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert instagram_settings"
  ON public.instagram_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update instagram_settings"
  ON public.instagram_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete instagram_settings"
  ON public.instagram_settings FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read instagram_schedules"
  ON public.instagram_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert instagram_schedules"
  ON public.instagram_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update instagram_schedules"
  ON public.instagram_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete instagram_schedules"
  ON public.instagram_schedules FOR DELETE TO authenticated USING (true);

-- ── 11. Seed: garantir dados iniciais ──
INSERT INTO public.bot_settings (bot_type, offline_message)
VALUES ('whatsapp', 'Estou ausente no momento. Retornarei em breve.')
ON CONFLICT (bot_type) DO NOTHING;

INSERT INTO public.bot_schedules (bot_type, day_of_week)
SELECT 'whatsapp', d.day FROM generate_series(0, 6) AS d(day)
ON CONFLICT (bot_type, day_of_week) DO NOTHING;

INSERT INTO public.instagram_settings (singleton, offline_message)
VALUES (true, 'Estou ausente no momento. Retornarei em breve.')
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO public.instagram_schedules (day_of_week)
SELECT d.day FROM generate_series(0, 6) AS d(day)
ON CONFLICT (day_of_week) DO NOTHING;

-- ── 12. Realtime ──
ALTER TABLE public.bot_settings        REPLICA IDENTITY FULL;
ALTER TABLE public.bot_schedules       REPLICA IDENTITY FULL;
ALTER TABLE public.instagram_settings  REPLICA IDENTITY FULL;
ALTER TABLE public.instagram_schedules REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_schedules;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_schedules;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
